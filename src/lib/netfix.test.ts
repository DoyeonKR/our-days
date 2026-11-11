// 끊긴 연결 · 두 번 누르기 · 휴대폰 공유 lock (2026-11-11).
// 1) 오프라인으로 연 앱이 연결이 돌아와도 '연결 전' 화면에 남던 것은 맨 아래.
// 응답을 잃은 저장이 두 줄이 되던 것(일정 · 버킷 · 댓글), 끝없이 기다리던 저장 · 올리기, iOS 공유 거절, 아침 사진 날짜,
// 삭제 실패가 남의 변경까지 되돌리던 것, 댓글 읽기 실패가 '0개'로 보이던 것. 소스 스캔은 주석을 먼저 지운다(README §10.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kstMonthDay } from "./kst.ts";
import { webShareOrDownload } from "./sharefile.ts";
import { retryIdFor } from "./clientid.ts";
import { PHOTO_ERRORS } from "./image.ts";
import { LS_COUPLE, coupleLookupStatus, coupleRetryDelay, keepRetrying, markCoupleLookup, onCoupleLookup } from "./couplelookup.ts";

const root = join(import.meta.dirname, "..", "..");
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const code = (p: string) => raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
/** 함수 본문(다음 최상위 선언 전까지). */
const fnBody = (src: string, head: string, until: string) => {
  const a = src.indexOf(head);
  assert.ok(a >= 0, head);
  const b = src.indexOf(until, a + head.length);
  return src.slice(a, b > a ? b : undefined);
};

const page = code("src/app/page.tsx");
const couple = code("src/lib/couple.ts");
const viewer = code("src/components/PhotoViewer.tsx");

// ── 2. 댓글 두 번 · 한글 조합 Enter ──────────────────────────────────────────
test("2 사진 댓글 · 캡션 · 기분 한마디 — 동기 잠금 + 조합 중 Enter 무시", () => {
  const send = fnBody(viewer, "async function sendComment(", "async function removeComment(");
  assert.match(send, /commentLock\.current\) return;\s+commentLock\.current = true;/, "busy(state)만으론 Enter · 버튼 연타가 두 번 보낸다");
  assert.match(send, /finally \{\s+commentLock\.current = false;/);
  assert.match(viewer, /const isImeEnter = \(e: React\.KeyboardEvent\) => e\.nativeEvent\.isComposing \|\| e\.keyCode === 229;/);
  assert.match(viewer, /e\.key === "Enter" && !isImeEnter\(e\)\) void sendComment\(photo\)/);
  assert.match(viewer, /e\.key === "Enter" && !isImeEnter\(e\)\) void saveCaption\(photo, editing\.text\)/);
  assert.doesNotMatch(viewer, /if \(e\.key === "Enter"\) void/, "조합 검사 없는 Enter 가 되살아났다");
  const mood = code("src/components/MoodLine.tsx");
  assert.match(mood, /e\.key === "Enter" && !e\.nativeEvent\.isComposing && e\.keyCode !== 229\) void saveNote\(\)/);
  assert.match(mood, /sending\.current\) return;\s+sending\.current = true;/);
});

// ── 3. 일정 — 응답을 잃은 저장 ──────────────────────────────────────────────
test("3 새 일정 id 는 초안에 남아 다시 열어도 같다 · 초안을 버리면 새 id", () => {
  const sheet = fnBody(page, "function AddEvent(", "function Settings(");
  assert.match(sheet, /id\?: string;/, "초안에 id 칸이 없다");
  assert.match(sheet, /id: existing \? undefined : eventId,/);
  // 2026-11-11 2차: 그 id 가 이미 다른 내용의 일정에 쓰였으면(takenCheck) 새 id — reviewfix1111.test
  assert.match(sheet, /restored && isUuid\(restored\.id\) && takenCheck === "keep" \? restored\.id : newEventId\(\)/);
  assert.match(sheet, /if \(!existing\) setEventId\(newEventId\(\)\);/, "버린 초안의 id(이미 저장됐을 수 있다)를 새 일정이 이어 쓴다");
});

test("3 편집 — 0행인데 서버 행이 내가 보낸 내용이면 충돌이 아니라 성공 · 새 일정 재시도에 내용을 고쳤으면 덮어쓴다", () => {
  const upd = fnBody(couple, "export async function updateCoupleEvent(", "export async function deleteCoupleEvent(");
  const match = upd.indexOf("if (fresh && eventContentMatches(fresh, ev)) return fresh;");
  assert.ok(match > 0, "내 저장이 이미 들어간 걸 충돌로 본다");
  assert.ok(match < upd.indexOf("throw new EventConflictError(fresh)"));
  const add = fnBody(couple, "export async function addCoupleEvent(", "const EVENT_UPDATING");
  // 2026-11-11 2차: 덮는 건 이 시트가 보낸 내용 그대로인 행일 때만(dupKeyDecision) — reviewfix1111.test
  assert.match(add, /if \(decision === "same"\) return existing;\s+if \(decision === "taken"\) throw new EventIdTakenError\(existing\);\s+return updateCoupleEvent\(\{ \.\.\.sent, createdBy: existing\.createdBy, updatedAt: existing\.updatedAt \}\);/);
});

// ── 4. 버킷 — 응답을 잃은 추가 ──────────────────────────────────────────────
test("4 버킷 추가는 화면이 만든 uuid · 23505 는 성공 · 같은 글 재시도는 같은 id", () => {
  const add = fnBody(couple, "export async function addBucket(", "export async function setBucketDone(");
  assert.match(add, /id\?: string,/);
  assert.match(add, /\.\.\.\(clientId \? \{ id: clientId \} : \{\}\)/);
  assert.ok(add.indexOf("if (clientId && duplicateKey(error)) return;") < add.indexOf("if (error) throw"), "중복 키를 오류로 본다");
  const fresh = () => "new-id";
  const pending = { id: "old-id", title: "제주 여행", category: "trip" };
  assert.equal(retryIdFor(pending, "제주 여행", "trip", fresh), "old-id", "다시 누르면 새 id 로 한 줄 더 생긴다");
  assert.equal(retryIdFor(pending, "부산 여행", "trip", fresh), "new-id");
  assert.equal(retryIdFor(pending, "제주 여행", "food", fresh), "new-id");
  assert.equal(retryIdFor(null, "제주 여행", "trip", fresh), "new-id");
  const list = code("src/components/BucketList.tsx");
  assert.match(list, /const id = retryIdFor\(pendingAdd\.current, text, c, newClientId\);/);
  assert.match(list, /await service\.add\(coupleId, text, c, id\);/);
  assert.match(list, /if \(pending && b\.some\(\(x\) => x\.id === pending\.id\)\) \{[\s\S]*?setTitle\(/, "들어간 게 확인되면 입력을 비운다");
});

// ── 5. 일정 시트 — 끝없는 저장 · 닫기 ────────────────────────────────────────
test("5 일정 저장엔 시간 제한 · 저장 중에도 시트를 닫을 수 있다 · 늦게 끝나도 다른 시트를 닫지 않는다", () => {
  const sheet = fnBody(page, "function AddEvent(", "function Settings(");
  assert.match(sheet, /await withTimeout\(onSave\(payload, \{ isNew: !existing, sent: sentBefore \}\), EVENT_SAVE_TIMEOUT_MS, landedLate\);/, "시간 초과 뒤에 들어간 저장의 초안이 남는다(다시 열어 다른 일정을 쓰면 그 id 로 덮는다)");
  assert.doesNotMatch(sheet, /onClose=\{busy \? \(\) => \{\} : onClose\}/, "저장 중엔 닫을 수 없던 것이 되살아났다");
  assert.match(sheet, /if \(alive\.current\) onClose\(\);/);
  assert.doesNotMatch(sheet, /\n\s+onClose\(\);\n/, "늦게 끝난 저장 · 건너뛰기 · 삭제가 그 뒤에 연 다른 시트를 닫는다");
  assert.match(sheet, /withTimeout\(onSkip!\(existing!, occurrence!\), EVENT_SAVE_TIMEOUT_MS/, "건너뛰기 저장에 끝이 없다");
  assert.match(page, /reason\.message === "upload-timeout" \? EVENT_SAVE_SLOW/, "시간 초과 원문(upload-timeout)이 화면에 뜬다");
  assert.match(page, /onLateError=\{\(message\) => showNotice\(/);
});

// ── 6. 여러 장 올리기 — 한 장이 멈춰도 ──────────────────────────────────────
test("6 한 장마다 시간 제한 · 실패해도 다음 장 · 잠금은 finally 에서 풀린다 · 실패한 것만 다시", () => {
  const album = code("src/components/PhotoAlbum.tsx");
  const up = fnBody(album, "async function onFiles(", "async function openTrash(");
  assert.match(up, /await withTimeout\(uploadPhoto\(coupleId, f\), PHOTO_UPLOAD_TIMEOUT_MS\)/);
  assert.match(up, /\} finally \{\s+endBusy\(\);\s+uploading\.current = false;\s+setUpload\(null\);/, "잠금이 finally 밖이면 한 번 걸린 뒤 다시 못 올린다");
  assert.match(up, /await withTimeout\(refreshRef\.current\(\), 15_000\)\.catch/, "목록 다시 읽기도 끝이 있어야 한다");
  assert.match(up, /failed\.push\(f\);/);
  assert.match(up, /label: "실패한 것만 다시", run: \(\) => void onFiles\(failed\)/);
  assert.match(album, /onClick=\{\(\) => void onFiles\(failedFiles\)\}/);
  assert.match(album, /실패한 것만 다시 올리기/);
});

// ── 7. iOS 저장 · 공유 ─────────────────────────────────────────────────────
type Fake = { shared: number; downloads: number; restore: () => void };
function fakeBrowser(share: ((d: ShareData) => Promise<void>) | null, canShare = true): Fake {
  const state = { shared: 0, downloads: 0 };
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const savedDoc = (globalThis as { document?: unknown }).document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: share
      ? { share: (d: ShareData) => { state.shared += 1; return share(d); }, canShare: () => canShare }
      : {},
  });
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ click: () => { state.downloads += 1; }, remove: () => {} }),
    body: { appendChild: () => {} },
  };
  return {
    get shared() { return state.shared; },
    get downloads() { return state.downloads; },
    restore: () => {
      if (saved) Object.defineProperty(globalThis, "navigator", saved);
      (globalThis as { document?: unknown }).document = savedDoc;
    },
  } as Fake;
}
const domErr = (name: string) => Object.assign(new Error(name), { name });
const photo = () => new File([new Uint8Array([1, 2, 3])], "haru.jpg", { type: "image/jpeg" });

test("7 공유는 첫 await 전에 불린다 · NotAllowedError 면 내려받기 · 닫으면 cancelled", async () => {
  let fx = fakeBrowser(() => Promise.reject(domErr("NotAllowedError")));
  try {
    const run = webShareOrDownload(photo(), "우리 사진");
    assert.equal(fx.shared, 1, "share 를 동기로 부르지 않으면 iOS 가 탭 동작을 잃는다");
    assert.equal(await run, "saved");
    assert.equal(fx.downloads, 1, "거절되면 내려받기로 넘어가야 한다(예전엔 '저장하지 못했어요')");
  } finally {
    fx.restore();
  }
  fx = fakeBrowser(() => Promise.reject(domErr("AbortError")));
  try {
    assert.equal(await webShareOrDownload(photo(), "우리 사진"), "cancelled");
    assert.equal(fx.downloads, 0, "사용자가 시트를 닫았는데 내려받는다");
  } finally {
    fx.restore();
  }
  fx = fakeBrowser(() => Promise.resolve());
  try {
    assert.equal(await webShareOrDownload(photo(), "우리 사진"), "shared");
  } finally {
    fx.restore();
  }
  fx = fakeBrowser(null);
  try {
    assert.equal(await webShareOrDownload(photo(), "우리 사진"), "saved");
    assert.equal(fx.downloads, 1);
  } finally {
    fx.restore();
  }
});

test("7 사진 보기는 원본을 미리 받아 두고 탭 안에서 바로 공유 · 매달 카드도 거절되면 내려받기", () => {
  const share = fnBody(viewer, "function share(p: Photo) {", "async function finishShare(");
  assert.doesNotMatch(share, /await/, "탭 처리기에 await 가 끼면 iOS 가 공유를 거절한다");
  assert.match(share, /shareFiles\.current\.get\(p\.path\)/);
  assert.match(share, /void finishShare\(webShareOrDownload\(ready, "우리 사진"\)\)/);
  assert.match(viewer, /m\.set\(p\.path, photoFile\(p, blob\)\);/, "보기를 열 때 미리 받지 않는다");
  assert.match(viewer, /onClick=\{\(\) => share\(photo\)\}/);
  const card = code("src/lib/recapcard.ts");
  assert.match(card, /await webShareOrDownload\(file, "우리의 한 달"\)/);
  assert.match(card, /if \(how === "cancelled"\) throw new DOMException\("취소됨", "AbortError"\);/, "닫은 것을 오류로 띄운다");
  assert.doesNotMatch(card, /await nav\.share\(/);
});

// ── 8. 홈 사진 날짜 ─────────────────────────────────────────────────────────
test("8 홈 빨랫줄 날짜는 KST — 아침 9시 전에 올린 사진이 하루 이르지 않다", () => {
  assert.equal(kstMonthDay("2026-11-10T23:30:00.000Z"), "11.11", "KST 11일 08:30 에 올린 사진");
  assert.equal(kstMonthDay("2026-11-11T05:00:00+00:00"), "11.11");
  assert.equal(kstMonthDay("2026-12-31T15:00:00Z"), "01.01");
  assert.equal(kstMonthDay("not a date"), "", "kstDate 는 NaN 에서 던진다");
  assert.match(page, /date: kstMonthDay\(p\.created_at\)/);
  assert.doesNotMatch(page, /created_at\.slice\(5, 10\)/);
});

// ── 9. 삭제 실패 되돌리기 ───────────────────────────────────────────────────
test("9 삭제 실패는 그 줄만 되돌린다(목록 통째 되돌리기 금지) · 보관함(extra)도", () => {
  const log = code("src/components/TodayLog.tsx");
  assert.doesNotMatch(log, /setLogs\(prev\)/);
  assert.match(log, /if \(inLogs\) setLogs\(\(cur\) => \(cur\.some\(\(x\) => x\.id === l\.id\) \? cur : \[\.\.\.cur, l\]\)\);/);
  assert.match(log, /if \(inExtra\) setExtra\(/, "보관함에서 고른 날의 줄이 안 돌아온다");
  const album = code("src/components/PhotoAlbum.tsx");
  assert.doesNotMatch(album, /setPhotos\(prev\)/);
  assert.doesNotMatch(album, /setAlbum\(prevAlbum\)/);
  assert.match(album, /setPhotos\(restoreOne\)/);
});

// ── 10. 댓글 읽기 실패 ≠ 0개 ────────────────────────────────────────────────
test("10 댓글 · 하트 읽기가 실패하면 failed — 보기는 '불러오지 못했어요 · 다시 시도', 하트는 잠근다", () => {
  const list = fnBody(couple, "export async function listPhotoInteractions(", "export async function addPhotoComment(");
  assert.match(list, /failed: true/);
  assert.match(list, /missingTableErr\(c\.error\)/, "표가 아직 없으면 정말로 빈 목록이어야 한다");
  assert.doesNotMatch(list, /if \(c\.error \|\| r\.error\) return empty;/);
  assert.match(viewer, /불러오지 못했어요/);
  assert.match(viewer, /void reloadInter\(photo\.id\)/);
  assert.match(viewer, /interFailed && \(\s*<button onClick=\{\(\) => void reloadInter\(photo\.id\)\}[^>]*>\s*불러오지 못했어요 · 다시 시도/, "댓글 칸을 접어 두면 실패가 안 보인다");
  assert.match(viewer, /disabled=\{!interReady\}/, "모르는 채 하트를 누르면 하나 더 생긴다");
  assert.match(viewer, /r\.failed \? \(cur\?\.id === id \? \{ \.\.\.cur, failed: true \}/, "다시 읽기 실패가 지난 목록을 빈 목록으로 덮는다");
});

// ── 11. HEIC 안내 ───────────────────────────────────────────────────────────
test("11 HEIC 안내는 갤럭시 HEIF 에도 맞는다(짧게)", () => {
  assert.match(PHOTO_ERRORS.heic, /HEIF/);
  assert.match(PHOTO_ERRORS.heic, /갤럭시/);
  assert.match(PHOTO_ERRORS.heic, /높은 호환성/);
  assert.ok(PHOTO_ERRORS.heic.length < 110, `안내가 길다(${PHOTO_ERRORS.heic.length}자)`);
});

// ── 1. 오프라인으로 연 앱 — 조회 실패 ≠ 커플 없음 ──────────────────────────────
type Timer = { fn: () => void; ms: number };
function fakeEnv() {
  const timers: Timer[] = [];
  let listener: ((why: "online" | "visible") => void) | null = null;
  let visible = true;
  return {
    timers,
    fire: (why: "online" | "visible") => listener?.(why),
    setVisible: (v: boolean) => { visible = v; },
    env: {
      setTimeout: (fn: () => void, ms: number) => { const t = { fn, ms }; timers.push(t); return t; },
      clearTimeout: (t: unknown) => { const i = timers.indexOf(t as Timer); if (i >= 0) timers.splice(i, 1); },
      listen: (fn: (why: "online" | "visible") => void) => { listener = fn; return () => { listener = null; }; },
      visible: () => visible,
    },
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("1 다시 묻기 — 실패하면 2 · 4 · 8 … 60초, 연결 복구 · 앱 복귀엔 바로, 성공하면 멈춘다", async () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 20].map(coupleRetryDelay), [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  const f = fakeEnv();
  let calls = 0;
  let failNext = 3;
  const r = keepRetrying(async () => { calls += 1; if (failNext-- > 0) throw new Error("Failed to fetch"); }, f.env);
  r.kick();
  await flush();
  assert.equal(calls, 1);
  assert.equal(r.failing(), true);
  assert.deepEqual(f.timers.map((t) => t.ms), [2000], "실패 뒤 다시 묻지 않는다(예전 버그)");
  f.fire("online"); // 연결 복구 — 타이머를 기다리지 않는다
  await flush();
  assert.equal(calls, 2);
  assert.deepEqual(f.timers.map((t) => t.ms), [4000], "기다리던 타이머는 취소하고 다음 간격으로");
  f.setVisible(false);
  f.timers.shift()!.fn(); // 숨어 있는 동안 타이머가 울려도 묻지 않는다
  await flush();
  assert.equal(calls, 2);
  f.setVisible(true);
  f.fire("visible");
  await flush();
  assert.equal(calls, 3);
  f.fire("visible");
  await flush();
  assert.equal(calls, 4);
  assert.equal(r.failing(), false);
  assert.equal(f.timers.length, 0, "성공하면 더 묻지 않는다");
  f.fire("online");
  await flush();
  assert.equal(calls, 4, "성공한 뒤엔 연결 복구마다 묻지 않는다");
  r.stop();
});

test("1 조회 상태 — getMyCouple 이 성공 · 실패를 적고, 빈 화면은 답을 받은 뒤에만 '혼자 시작하기'", () => {
  assert.equal(coupleLookupStatus(), "pending");
  let seen = 0;
  const off = onCoupleLookup(() => { seen += 1; });
  markCoupleLookup("failed");
  markCoupleLookup("failed");
  markCoupleLookup("ok");
  off();
  assert.equal(seen, 2, "같은 상태로는 알리지 않는다");
  const get = fnBody(couple, "export async function getMyCouple(", "async function fetchMyCouple(");
  assert.match(get, /const state = await couplePending;\s+markCoupleLookup\("ok"\);/);
  assert.match(get, /catch \(e\) \{\s+markCoupleLookup\("failed"\);\s+throw e;/);
  const cf = code("src/components/ConnectFirst.tsx");
  assert.match(cf, /if \(isSupabaseConfigured && lookup !== "ok"\) \{/);
  assert.ok(cf.indexOf('lookup !== "ok"') < cf.indexOf("혼자 시작하기"), "확인 전에 혼자 시작하기를 내민다");
  assert.match(cf, /연결 확인 중/);
});

test("1 page — 실패를 삼키지 않고 다시 묻는다 · 답을 받기 전 실패면 마지막으로 알던 공간으로 · CoupleSync 는 unpaired 로 안 떨어진다", () => {
  assert.doesNotMatch(page, /void refresh\(\)\.catch\(\(\) => \{\}\)/, "한 번 묻고 실패를 삼키던 것이 되살아났다");
  assert.match(page, /const retry = keepRetrying\(async \(\) => \{/);
  assert.match(page, /if \(!cancelled && !answered\) \{\s+const known = lastKnownCoupleId\(myUserId\);\s+if \(known\) setCoupleId\(\(cur\) => cur \?\? known\);/);
  assert.match(page, /onCoupleChanged\(\(\) => retry\.kick\(\)\)/);
  assert.match(page, /retry\.stop\(\);/);
  assert.match(page, /coupleLookupStatus\(\) === "failed" && !retry\.failing\(\) && !retry\.running\(\)\) retry\.kick\(\)/,
    "다른 곳의 조회 실패로 '연결 확인 중'이 되면 아무도 다시 묻지 않는다");
  const sync = code("src/components/CoupleSync.tsx");
  const load = fnBody(sync, "const load = async () => {", "const retry = keepRetrying(load);");
  const fail = load.slice(load.lastIndexOf("} catch (e) {"));
  assert.doesNotMatch(fail, /setPhase\("unpaired"\)/, "조회 실패가 '커플 만들기' 메뉴로 떨어진다");
  assert.match(fail, /setLookupFailed\(true\);\s+throw e;/);
  assert.match(sync, /onClick=\{\(\) => lookupRetry\.current\?\.kick\(\)\}/);
  // 기억한 공간의 키는 로그아웃 정리와 같아야 한다(다음 계정이 옛 공간으로 이어 가지 않게)
  assert.equal(LS_COUPLE, "ourdays:couple");
  assert.match(raw("src/lib/auth.ts"), /localStorage\.removeItem\("ourdays:couple"\)/);
});
