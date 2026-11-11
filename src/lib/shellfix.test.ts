// 앱 뼈대 튼튼하게 lock (2026-11-09 — README §10.23).
// 탭 · 실시간 · 서비스워커 · 저장 같은 '앱 전체에 걸친 뼈대'에서 확인된 결함 여덟 가지를 고쳤다. 각 수정이 되돌아가지 않게 잠근다.
// 소스 스캔은 주석을 먼저 지운다(README §10.5 — 이 저장소는 '왜'를 주석에 길게 쓴다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as nodeModule from "node:module";
import { beginBusy, isBusy } from "./busy.ts";
import { hasVisibleOverlay } from "./scrollLock.ts";
import { claimPokeBanner, pickPushedPoke } from "./pokesync.ts";

// couple.ts 는 @/ 경로를 불러와 node 에서 통째로 못 읽는다 — 순수 함수 하나만 꺼내 타입을 지우고 돌린다(Node 22.13+, @types/node 엔 아직 없다)
const stripTypeScriptTypes = (nodeModule as unknown as { stripTypeScriptTypes: (src: string) => string }).stripTypeScriptTypes;
const root = join(import.meta.dirname, "..", "..");
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
// 줄 주석은 줄 머리나 공백 뒤의 // 만 — 문자열 속 "//" · https:// 는 코드다
const code = (p: string) => raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");

/** 파일에서 함수 하나를 꺼낸다(중괄호 짝 맞추기). */
function fnSrc(src: string, name: string): string {
  let a = src.search(new RegExp(`function ${name}[(<]`));
  assert.ok(a >= 0, name);
  if (src.slice(a - 6, a) === "async ") a -= 6;
  // 인자 · 반환 타입의 { } 를 건너뛰려고 본문 시작은 시그니처 끝의 '{\n' 으로 잡는다
  const open = src.indexOf("{\n", a);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(a, i + 1);
  }
  throw new Error(name);
}
/** TS 함수 하나를 꺼내 타입을 지우고 실제로 돌린다. */
function tsFn<T>(path: string, name: string, prelude = ""): T {
  const js = stripTypeScriptTypes(prelude + fnSrc(code(path), name));
  return new Function(`${js}\nreturn ${name};`)() as T;
}

// ── 1. 올리는 중 자동 새로고침 ────────────────────────────────────────────────
test("1 바쁨 셈 — 끝 함수는 한 번만 세고, 다 끝나야 한가하다", () => {
  assert.equal(isBusy(), false);
  const a = beginBusy();
  const b = beginBusy();
  assert.equal(isBusy(), true);
  a();
  a(); // 두 번 불러도 한 번
  assert.equal(isBusy(), true, "b 가 아직 바쁘다");
  b();
  assert.equal(isBusy(), false);
});

test("1 자동 새로고침은 바쁜 동안 미룬다 · 올리기 · 내보내기가 바쁨을 건다 · 웹만 떠나기 확인", () => {
  const chip = code("src/components/UpdateChip.tsx");
  const can = chip.slice(chip.indexOf("function canReloadNow("), chip.indexOf("function reloadOnce("));
  assert.match(can, /if \(isBusy\(\)\) return false;/);
  const album = code("src/components/PhotoAlbum.tsx");
  const onFiles = album.slice(album.indexOf("async function onFiles("), album.indexOf("async function openTrash("));
  assert.match(onFiles, /const endBusy = beginBusy\(\);[\s\S]*for \(let i = 0; i < list\.length[\s\S]*\} finally \{\s+endBusy\(\);/);
  assert.match(code("src/components/TodayLog.tsx"), /async function flushDrafts\([\s\S]*?const endBusy = beginBusy\(\);[\s\S]*?finally \{[\s\S]*?endBusy\(\);/);
  assert.match(code("src/components/LogCapture.tsx"), /async function post\(\) \{[\s\S]*?const endBusy = beginBusy\(\);\s+try \{\s+await postNow\(\);\s+\} finally \{\s+endBusy\(\);/);
  assert.match(code("src/components/DecoBook.tsx"), /const endBusy = beginBusy\(\);[\s\S]*?finally \{\s+endBusy\(\);/);
  assert.match(code("src/components/AccountSection.tsx"), /async function runExport\([\s\S]*?const endBusy = beginBusy\(\);[\s\S]*?finally \{\s+endBusy\(\);/);
  const busy = code("src/lib/busy.ts");
  assert.match(busy, /isNativeApp\(\)\) return;/, "네이티브 앱엔 떠나기 확인창이 없다");
  assert.match(busy, /addEventListener\("beforeunload", onBeforeUnload\)/);
  assert.match(busy, /removeEventListener\("beforeunload", onBeforeUnload\)/, "늘 걸어 두면 bfcache 를 막는다");
});

// ── 2. 일정 재시도 중복 ───────────────────────────────────────────────────────
test("2 일정 id 는 시트마다 한 번(uuid) · 서버에 그 id 로 넣고 23505 는 이미 저장된 것", () => {
  const page = code("src/app/page.tsx");
  // 2026-11-11: 새 일정은 초안에 적힌 id 를 이어 쓴다(시트를 닫았다 열어도 같은 id) — 없으면 새 uuid
  assert.match(page, /const \[eventId, setEventId\] = useState\(\(\) => existing\?\.id \?\? \(restored && isUuid\(restored\.id\) \? restored\.id : newEventId\(\)\)\);/);
  assert.match(page, /id: eventId,/);
  assert.doesNotMatch(page, /id: existing\?\.id \?\? uid\(\)/, "누를 때마다 새 id 가 되살아났다");
  assert.match(fnSrc(page, "newEventId"), /crypto\.randomUUID\(\)/);
  const add = code("src/lib/couple.ts").slice(code("src/lib/couple.ts").indexOf("export async function addCoupleEvent("), code("src/lib/couple.ts").indexOf("const EVENT_UPDATING"));
  assert.match(add, /const clientId = isUuid\(ev\.id\) \? ev\.id\.toLowerCase\(\) : null;/);
  assert.match(add, /\.\.\.\(clientId \? \{ id: clientId \} : \{\}\)/);
  assert.match(add, /if \(clientId && duplicateKey\(error\)\) \{[\s\S]*getCoupleEvent\(clientId\)/);
  const isUuid = tsFn<(v: unknown) => boolean>("src/lib/couple.ts", "isUuid");
  assert.equal(isUuid("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b"), true);
  assert.equal(isUuid("k3j9x2a"), false, "옛 로컬 id 는 uuid 칸에 못 넣는다");
  assert.equal(isUuid(undefined), false);
  const dup = tsFn<(e: { code?: string; message?: string } | null) => boolean>("src/lib/couple.ts", "duplicateKey");
  assert.equal(dup({ code: "23505", message: "" }), true);
  assert.equal(dup({ message: 'duplicate key value violates unique constraint "couple_events_pkey"' }), true);
  assert.equal(dup({ code: "42501", message: "row-level security" }), false);
  assert.equal(dup(null), false);
});

test("2 저장은 됐는데 다시 읽기만 실패하면 실패로 말하지 않는다", () => {
  const page = code("src/app/page.tsx");
  const save = page.slice(page.indexOf("async function saveEvent("), page.indexOf("async function skipOccurrence("));
  assert.match(save, /const authoritative = await listCoupleEvents\(coupleId\)\.catch\(\(\) => null\);/);
  assert.match(save, /setEvents\(\(cur\) => \[\.\.\.cur\.filter\(\(item\) => item\.id !== savedEvent\.id\), savedEvent\]\);/);
  assert.match(save, /window\.setTimeout\(\(\) => \{\s+listCoupleEvents\(cid\)\.then\(setEvents\)/, "목록은 잠시 뒤 다시 읽는다");
});

// ── 3. 숨은 탭의 전체 화면 창 ─────────────────────────────────────────────────
test("3 스크롤 잠금은 숨은 탭([hidden]) 안의 오버레이를 세지 않는다", () => {
  const el = (hiddenAncestor: boolean) => ({ closest: (s: string) => (s === "[hidden]" && hiddenAncestor ? {} : null) });
  assert.equal(hasVisibleOverlay([]), false);
  assert.equal(hasVisibleOverlay([el(true)]), false, "숨은 탭의 사진 보기만 남았다");
  assert.equal(hasVisibleOverlay([el(true), el(false)]), true);
  const mgr = code("src/components/ScrollLockManager.tsx");
  assert.match(mgr, /hasVisibleOverlay\(document\.querySelectorAll\(OVERLAY_SELECTOR\)\)/);
  assert.match(mgr, /attributes: true, attributeFilter: \["hidden"\]/, "탭 전환(hidden 속성)도 다시 따진다");
  assert.match(mgr, /r\.type === "attributes"/);
});

test("3 탭이 숨으면 사진 보기 · 촬영기를 닫는다(카메라 · 뒤로 가기 기록까지 풀린다)", () => {
  const page = code("src/app/page.tsx");
  assert.match(page, /active=\{view === "records" && recordView === "log"\}/);
  assert.match(page, /active=\{view === "records" && recordView === "photos"\}/);
  const album = code("src/components/PhotoAlbum.tsx");
  assert.match(album, /useEffect\(\(\) => \{\s+if \(active\) return;\s+setViewerId\(null\);\s+setConfirm\(null\);\s+\}, \[active\]\);/);
  const log = code("src/components/TodayLog.tsx");
  assert.match(log, /useEffect\(\(\) => \{\s+if \(active \|\| !captureOpenRef\.current\) return;\s+setCapture\(null\);\s+void flushDrafts\(true\);/);
  // 닫히면 언마운트가 정리한다 — 사진 보기는 useBackClose, 촬영기는 카메라 트랙 정지
  assert.match(code("src/components/PhotoViewer.tsx"), /useBackClose\(onClose\);/);
  assert.match(code("src/components/LogCapture.tsx"), /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/);
});

// ── 4. 문서 시간 제한 ─────────────────────────────────────────────────────────
const sw = code("public/sw.js");
function swFn(name: string) {
  return new Function(`${fnSrc(sw, name)}\nreturn ${name};`)();
}

test("4 SW 문서 — 3.5초 안에 오면 네트워크, 늦으면 저장된 문서(네트워크는 살려 둬 캐시 갱신), 캐시가 없으면 계속 기다린다", async () => {
  assert.match(sw, /const DOC_TIMEOUT_MS = 3500;/);
  const race = swFn("raceDocument") as (net: Promise<unknown>, getCached: () => Promise<unknown>, ms: number, keep: (p: Promise<unknown>) => void) => Promise<unknown>;
  const later = <T,>(v: T, ms: number) => new Promise<T>((r) => setTimeout(() => r(v), ms));
  const kept: Promise<unknown>[] = [];
  // 제때 온 네트워크
  assert.equal(await race(later("net", 5), async () => "cache", 50, (p) => kept.push(p)), "net");
  assert.equal(kept.length, 0);
  // 늦은 네트워크 + 캐시 있음 → 캐시, 네트워크는 keep
  assert.equal(await race(later("net", 80), async () => "cache", 20, (p) => kept.push(p)), "cache");
  assert.equal(kept.length, 1);
  // 늦은 네트워크 + 캐시 없음 → 네트워크를 끝까지
  assert.equal(await race(later("net", 60), async () => undefined, 10, (p) => kept.push(p)), "net");
  // 제한 전에 실패하면 던진다(호출부가 캐시 폴백)
  await assert.rejects(race(Promise.reject(new Error("offline")), async () => "cache", 50, () => {}));
  const nav = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf('/_next/static/")) {'));
  assert.match(nav, /raceDocument\(net, \(\) => caches\.match\(docKey\(url\), \{ ignoreSearch: true \}\), DOC_TIMEOUT_MS, keep\)/);
  assert.match(nav, /keep\(caches\.open\(CACHE\)\.then\(\(c\) => c\.put\(docKey\(url\), copy\)\)/, "늦게 온 문서도 캐시를 갈아 끼운다");
  assert.match(sw, /const POKE_REPLY = "ourdays:poke-reply-tokens"/, "답장 토큰 캐시는 그대로");
});

// ── 5. 앱 복귀 뒤 실시간 ──────────────────────────────────────────────────────
test("5 30초 넘게 숨었다 돌아오면 소켓을 새로 열고 커플 채널을 다시 지어 전부 다시 읽는다", () => {
  const should = tsFn<(h: number | null, n: number) => boolean>("src/lib/couple.ts", "shouldReviveRealtime", "const REALTIME_REVIVE_AFTER_MS = 30_000;\n");
  assert.equal(should(null, 100_000), false);
  assert.equal(should(0, 29_999), false, "잠깐 다른 앱을 본 건 그대로");
  assert.equal(should(0, 30_000), true);
  const couple = code("src/lib/couple.ts");
  const revive = fnSrc(couple, "reviveRealtime");
  assert.match(revive, /await sb\.realtime\.disconnect\(\);[\s\S]*sb\.realtime\.connect\(\);/);
  assert.match(revive, /entry\.fullResync = true;\s+_muxRebuild\(entry\);/, "좀비 소켓의 채널은 다시 join 하지 않으므로 새로 짓는다");
  assert.match(fnSrc(couple, "_bindWake"), /addEventListener\("visibilitychange"/);
  assert.match(fnSrc(couple, "muxOn"), /_bindWake\(\);/);
});

test("5 SW 가 쿡 알림을 숨기면 그 창에 알리고, 앱은 쿡 id 로 한 번만 띄운다", () => {
  const push = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf('addEventListener("pushsubscriptionchange"'));
  const focused = push.slice(push.indexOf("c.focused"), push.indexOf("if (!isWebKitPush()) return;"));
  assert.match(focused, /c\.postMessage\(\{ type: "pokePush"/);
  const sync = code("src/components/CoupleSync.tsx");
  assert.match(sync, /d\.type !== "pokePush"/);
  assert.match(sync, /pickPushedPoke\(rows, uid, shownPokes\.current, Date\.now\(\)\)/);
  assert.match(sync, /if \(!claimPokeBanner\(shownPokes\.current, p\.id\)\) return;/);

  const shown = new Set<string>();
  assert.equal(claimPokeBanner(shown, "p1"), true);
  assert.equal(claimPokeBanner(shown, "p1"), false, "실시간 · SW 두 길이 같은 쿡을 두 번 띄우지 않는다");
  assert.equal(claimPokeBanner(shown, "tmp-1"), false, "내가 보낸 낙관적 행");
  const now = Date.parse("2026-11-09T10:00:00Z");
  const rows = [
    { id: "a", from_user: "me", kind: "love", message: null, created_at: "2026-11-09T09:59:59Z" },
    { id: "b", from_user: "you", kind: "love", message: null, created_at: "2026-11-09T09:59:50Z" },
    { id: "c", from_user: "you", kind: "miss", message: null, created_at: "2026-11-09T09:50:00Z" },
  ];
  assert.equal(pickPushedPoke(rows, "me", new Set(), now)?.id, "b", "상대의 가장 새 쿡 하나");
  assert.equal(pickPushedPoke(rows, "me", new Set(["b"]), now), null, "이미 띄웠으면 옛 쿡까지 내려가지 않는다");
  assert.equal(pickPushedPoke(rows.slice(2), "me", new Set(), now), null, "3분 넘은 쿡은 지금 온 푸시가 아니다");
});

// ── 6. 채널 교체 때 전부 다시 읽던 것 ─────────────────────────────────────────
test("6 채널 교체는 새 구독만 다시 읽고, 재연결 · 옛 채널이 죽었을 때는 전부", () => {
  const targets = tsFn<<B>(all: Iterable<B>, prev: ReadonlySet<B> | null | undefined, live: boolean, full: boolean) => B[]>("src/lib/couple.ts", "muxResyncTargets");
  const [a, b, c] = [{ n: "a" }, { n: "b" }, { n: "c" }];
  assert.deepEqual(targets([a, b, c], new Set([a, b]), true, false), [c], "이미 받고 있던 a · b 는 건너뛴다");
  assert.deepEqual(targets([a, b, c], new Set([a, b]), false, false), [a, b, c], "옛 채널이 joined 가 아니면 놓친 이벤트가 있을 수 있다");
  assert.deepEqual(targets([a, b, c], new Set([a, b]), true, true), [a, b, c], "앱 복귀 재연결은 전부");
  assert.deepEqual(targets([a, b], null, true, false), [a, b], "첫 연결은 전부");
  const couple = code("src/lib/couple.ts");
  const rebuild = couple.slice(couple.indexOf("function _muxRebuild"), couple.indexOf("function _muxSchedule"));
  assert.match(rebuild, /fanoutResync\(muxResyncTargets\(entry\.bindings\.values\(\), prevBindings, prevLive, full\)\);/);
  assert.match(rebuild, /if \(entry\.active === ch\) \{\s+fanoutResync\(\);/, "재조인(같은 채널)은 여전히 전부");
  assert.match(rebuild, /\.state === "joined"/);
});

// ── 7. 1000행 상한 ───────────────────────────────────────────────────────────
test("7 일기 · 일기 표시 · 질문 답은 쪽으로 끝까지, 순서는 id 로 끝맺는다", () => {
  const couple = code("src/lib/couple.ts");
  const body = (name: string) => couple.slice(couple.indexOf(`export async function ${name}(`), couple.indexOf("\nexport ", couple.indexOf(`export async function ${name}(`) + 10));
  for (const name of ["listDiaryMarks", "listDecoEntries", "listAllAnswers"]) {
    const b = body(name);
    assert.match(b, /fetchAllPages\(/, `${name} 이 1000행에서 잘린다`);
    assert.match(b, /\.order\("id"/, `${name} 의 쪽 경계가 흔들린다(동률 순서)`);
    assert.match(b, /\.range\(from, to\)/);
  }
  assert.match(body("listDecoEntries"), /cols = DECO_COLS_BASE;/, "새 칸이 없는 DB 폴백은 그대로");
});

// ── 8. 홈 사진줄 만료 ─────────────────────────────────────────────────────────
test("8 홈 사진줄 — 첫 실패엔 다시 서명, 두 번째 실패만 숨긴다(죽은 HomeWorld 복사본은 지웠다)", () => {
  const home = code("src/components/HomeExperience.tsx");
  const photo = home.slice(home.indexOf("function MemoryPhoto("), home.indexOf("export default function HomeExperience("));
  assert.match(photo, /if \(!path \|\| !onExpired \|\| tried\) \{\s+setHidden\(true\);\s+return;\s+\}\s+setTried\(true\);\s+void onExpired\(path\)/);
  assert.match(photo, /src=\{fixed \?\? url\}/);
  assert.doesNotMatch(home, /onError=\{\(event\)=>\{event\.currentTarget\.style\.visibility="hidden";\}\}/, "첫 실패에 바로 숨기던 것");
  assert.match(home, /onExpired=\{props\.onPhotoExpired\}/);
  assert.doesNotMatch(code("src/components/HomeWorld.tsx"), /fixedUrl|setRetried/);
});
