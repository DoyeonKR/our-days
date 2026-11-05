// 일기장 리뷰 회귀 lock (2026-11-06) — 확인된 결함 19개 + 기능 7개 + 비밀일기 제거(사용자 결정 2026-11-05).
// 소스 스캔은 주석을 먼저 지운다(README — 이 레포는 '왜'를 주석에 길게 남겨 설명문이 먼저 잡힌다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_TAGS,
  MAX_TAG_LEN,
  applyRowChange,
  cleanTag,
  diaryBookHtml,
  entryVersion,
  exchangeDays,
  hasTagQuery,
  isStaleDraft,
  legacyDraftDate,
  legacyDraftKey,
  matchesQuery,
  normalizeTags,
  sortEntries,
  tagCloud,
  toggleTagQuery,
  weatherTag,
} from "./diary.ts";
import { activityRoute, focusIdOf, focusQuery, joinGo, pushUrlFor, splitGo, withFocus } from "./activity.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const deco = strip(read("src/components/DecoBook.tsx"));
const couple = strip(read("src/lib/couple.ts"));
const page = strip(read("src/app/page.tsx"));
const MIG_FILE = "supabase/migrations/20261106000000_diary_review.sql";
const migRaw = read(MIG_FILE).trim();
const mig = migRaw.replace(/--[^\n]*/g, "");
const schema = read("supabase/schema.sql");

const between = (src: string, a: string, b: string) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, `${a} 를 못 찾았다`);
  const j = src.indexOf(b, i + a.length);
  return src.slice(i, j < 0 ? undefined : j);
};
const editor = between(deco, "function DecoEditor(", "\nfunction \u0000"); // 끝까지
const card = between(deco, "function DecoCard(", "type DiaryForm");
const bodyOf = (src: string, decl: string) => between(src, decl, "\nexport ");

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

/* ── 순수 로직 ─────────────────────────────────────────────────────── */

test("#8 #19 태그 — 앞의 # 떼기 · 중복 · 길이 · 개수", () => {
  assert.equal(cleanTag("##여행"), "여행");
  assert.deepEqual(normalizeTags("#여행 ##여행, 제주  맛집 #"), ["여행", "제주", "맛집"]);
  assert.deepEqual(normalizeTags(["Seoul", "seoul", "#SEOUL"]), ["Seoul"], "대소문자만 다른 중복도 하나");
  assert.equal(normalizeTags("가".repeat(40))[0].length, MAX_TAG_LEN);
  assert.equal(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(" ")).length, MAX_TAGS);
});

test("#8 검색 — '#여행' 이 '여행' 태그를 찾고, 여러 낱말은 모두 맞아야 한다", () => {
  const e = { title: "제주 여행", body: "바다가 예뻤다", location: "협재", hashtags: ["여행", "커플"] };
  assert.ok(matchesQuery(e, "#여행"), "예전엔 0편이었다");
  assert.ok(matchesQuery(e, "#커플 바다"));
  assert.ok(!matchesQuery(e, "#바다"), "# 낱말은 태그에서만 찾는다");
  assert.ok(!matchesQuery(e, "제주 서울"), "AND");
  assert.ok(matchesQuery(e, "제주   바다"));
  assert.ok(matchesQuery({ hashtags: ["#여행"] }, "#여행"), "옛 행에 # 이 붙어 저장됐어도 찾는다");
});

test("F2 태그 칩 · 구름 — 켜고 끄기, 많이 쓴 순", () => {
  assert.equal(toggleTagQuery("", "여행"), "#여행");
  assert.equal(toggleTagQuery("바다 #여행", "#여행"), "바다");
  assert.ok(hasTagQuery("바다 #여행", "여행"));
  assert.ok(!hasTagQuery("여행", "여행"), "그냥 낱말은 태그 켬이 아니다");
  const cloud = tagCloud([{ hashtags: ["b", "a"] }, { hashtags: ["a", "A"] }, { hashtags: ["c"] }]);
  assert.deepEqual(cloud.map((x) => [x.tag, x.n]), [["a", 2], ["b", 1], ["c", 1]], "한 일기의 같은 태그는 한 번만 센다");
});

test("F4 같은 날 나란히 — 내 칸 · 상대 칸, 최신 날짜 먼저", () => {
  const d = exchangeDays(
    [
      { entry_date: "2026-11-05", created_by: "me" },
      { entry_date: "2026-11-06", created_by: "you" },
      { entry_date: "2026-11-05", created_by: "you" },
    ],
    "me",
  );
  assert.deepEqual(d.map((x) => [x.date, x.mine.length, x.partner.length]), [["2026-11-06", 0, 1], ["2026-11-05", 1, 1]]);
  assert.match(deco, /exchangeDays\(filtered, uid\)/);
  assert.match(deco, /"기다리는 중"/);
});

test("#14 초안 — 지난 날짜 초안은 '어제 쓰던 글' · 옛 날짜 키를 찾아 옮긴다 · 고친 일기는 버전 비교", () => {
  assert.equal(isStaleDraft("2026-11-05", "2026-11-06"), true);
  assert.equal(isStaleDraft("2026-11-06", "2026-11-06"), false);
  assert.equal(isStaleDraft(undefined, "2026-11-06"), true, "날짜 없는 초안(옛 모양)은 묻는다");
  const keys = ["ourdays:draft:diary:c1:2026-11-04", "ourdays:draft:diary:c1:2026-11-05", "ourdays:draft:diary:c1:new", "ourdays:draft:diary:c2:2026-11-06", "ourdays:draft:diary:c1:abc"];
  assert.equal(legacyDraftKey(keys, "c1"), "ourdays:draft:diary:c1:2026-11-05");
  assert.equal(legacyDraftDate("ourdays:draft:diary:c1:2026-11-05"), "2026-11-05");
  assert.equal(entryVersion({ updated_at: null, created_at: "t0" }), "t0");
  assert.equal(entryVersion({ updated_at: "t1", created_at: "t0" }), "t1");
});

test("#15 실시간 — 행 하나를 적용(넣기 · 고치기 · 지우기), 모르는 신호는 null(통째로 다시)", () => {
  const list = [{ id: "a", created_at: "1" }, { id: "b", created_at: "3" }];
  assert.deepEqual(applyRowChange(list, { eventType: "INSERT", new: { id: "c", created_at: "2" } }, (x) => x.created_at)?.map((x) => x.id), ["a", "c", "b"]);
  assert.equal(applyRowChange(list, { eventType: "INSERT", new: { id: "a", created_at: "1" } })?.length, 2, "같은 id 는 한 번만(내 요청 응답 + 소켓)");
  assert.deepEqual(applyRowChange(list, { eventType: "DELETE", old: { id: "a" } })?.map((x) => x.id), ["b"]);
  assert.equal(applyRowChange(list, { eventType: "resync" }), null);
  assert.equal(applyRowChange(list, { eventType: "DELETE", old: {} }), null);
  const sorted = sortEntries([
    { entry_date: "2026-11-05", created_at: "a" },
    { entry_date: "2026-11-06", created_at: "a" },
    { entry_date: "2026-11-06", created_at: "b" },
  ]);
  assert.deepEqual(sorted.map((x) => x.entry_date + x.created_at), ["2026-11-06b", "2026-11-06a", "2026-11-05a"]);
});

test("F7 날씨 — 오늘(KST) 칸이 있을 때만, 도시 단위 한 줄", () => {
  const fc = { daily: { time: ["2026-11-05", "2026-11-06"], weather_code: [0, 61], temperature_2m_max: [20.4, 14.6], temperature_2m_min: [9.5, 8.2] } };
  const label = (c: number) => (c === 61 ? "비" : "맑음");
  assert.equal(weatherTag(fc, "서울", "2026-11-06", label), "서울 · 비 15°/8°");
  assert.equal(weatherTag(fc, "서울", "2026-11-07", label), null, "다른 날 날씨를 붙이지 않는다");
  assert.equal(weatherTag(null, "서울", "2026-11-06", label), null);
});

test("F8 일기책 — 기간만, 날짜순, 사용자 글은 이스케이프", () => {
  const e = (d: string, title: string) => ({ entry_date: d, title, body: "<b>x</b>", location: null, mood_emoji: null, hashtags: ["a"], photo_urls: [], created_by: "me" });
  const html = diaryBookHtml([e("2026-03-01", "<script>alert(1)</script>"), e("2025-12-31", "작년"), e("2026-01-02", "첫")], {
    title: "우리의 일기 2026",
    from: "2026-01-01",
    to: "2026-12-31",
    nameOf: () => "나",
  });
  assert.ok(!html.includes("<script>"), "제목의 태그가 그 창에서 실행되면 안 된다");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("작년"), "기간 밖은 뺀다");
  assert.ok(html.indexOf("첫") < html.indexOf("&lt;script"), "날짜순");
  assert.match(html, /2편/);
  assert.match(deco, /window\.open\("", "_blank"\)/, "새 창은 누른 순간 연다(팝업 차단)");
  assert.match(deco, /diaryBookHtml\(/);
});

test("F1 경로 — 일기 · 사진은 행 id 로 그 카드까지, id 가 아니면 무시", () => {
  assert.deepEqual(activityRoute("diary"), { view: "diary" }, "옛 모양(id 없음)은 그대로");
  assert.deepEqual(activityRoute("diary", UUID), { view: "diary", focus: UUID });
  assert.deepEqual(activityRoute("photo", UUID), { view: "records", sub: "photos", focus: UUID });
  assert.deepEqual(activityRoute("diary", "<img onerror=x>"), { view: "diary" }, "uuid 가 아니면 DOM id 로 넣지 않는다");
  assert.deepEqual(activityRoute("log", UUID), { view: "records", sub: "log" }, "로그엔 카드 focus 가 없다");
  assert.equal(focusIdOf("nope"), null);
  assert.deepEqual(withFocus({ view: "plan", sub: "cal" }, UUID), { view: "plan", sub: "cal" });
  // 푸시 주소: 옛 앱은 go 만 읽는다(f 는 모른 채 그 화면으로) · 새 앱은 둘 다
  const url = new URL(pushUrlFor("diary") + focusQuery(UUID), "https://x.test/our-days/");
  assert.equal(url.searchParams.get("go"), "diary");
  assert.equal(url.searchParams.get("f"), UUID);
  assert.equal(focusQuery("x"), "");
  assert.deepEqual(splitGo(joinGo("diary", UUID)), { go: "diary", focus: UUID });
  assert.deepEqual(splitGo(joinGo("merge", null)), { go: "merge", focus: null });
  // 화면 배선: 활동함 행이 entity_id 를 넘기고 → page 가 일기장에 focusReq → 일기장이 카드 id 로 찾는다
  assert.match(strip(read("src/components/ActivityInbox.tsx")), /onOpenKind\(event\.kind, event\.entity_id\)/);
  assert.match(page, /route\.view === "diary"[\s\S]{0,200}setDiaryFocus\(\{ id: route\.focus/);
  assert.match(page, /focusReq=\{diaryFocus\}/);
  assert.match(card, /id=\{`diary-\$\{e\.id\}`\}/);
  assert.match(deco, /classList\.add\("focus-flash"\)/, "홈 카드와 같은 반짝임");
  assert.match(between(deco, "function jumpTo(", "useEffect("), /Math\.ceil\(\(i \+ 1\) \/ DIARY_PAGE\) \* DIARY_PAGE/, "10편 밖이면 그 편까지 펼친다");
  assert.match(deco, /getDecoEntry\(focusReq\.id\)/, "목록에 없으면 그 한 편을 읽는다");
});

/* ── 결함 고친 것 ──────────────────────────────────────────────────── */

test("#1 댓글 알림 — 상대가 쓴 함께 보는 일기에만, 비밀 · 내 일기엔 보내지 않는다", () => {
  const fn = between(deco, "async function submitComment(", "async function removeComment(");
  assert.match(fn, /if \(entry && shouldPushComment\(entry, uid\)\) \{\s*sendEventPush\(coupleId, "interact"/);
  assert.equal((fn.match(/sendEventPush\(/g) ?? []).length, 1);
  const guard = between(deco, "function shouldPushComment(", "\n}");
  assert.match(guard, /entry\.created_by !== uid/);
  assert.match(guard, /entry\.visibility === "shared"/);
});

test("#2 자동 초안 — 저장 중 · 저장 뒤엔 타이머가 초안을 되살리지 않는다", () => {
  const eff = between(editor, "useEffect(() => {\n    if (savingRef.current", "}, [draftKey");
  assert.match(eff, /if \(savingRef\.current \|\| doneRef\.current/);
  assert.match(eff, /setTimeout\(\(\) => \{\s*timerRef\.current = null;\s*if \(savingRef\.current \|\| doneRef\.current\) return;/, "터지는 순간에도 다시 본다");
  const save = between(editor, "async function save()", "function pickFiles(");
  assert.ok(save.indexOf("clearTimeout(timerRef.current)") < save.indexOf("clearDraft(localStorage, draftKey)"), "clearDraft 전에 타이머부터");
  assert.ok(save.indexOf("doneRef.current = true") < save.indexOf("clearDraft(localStorage, draftKey)"));
  assert.match(save, /if \(savingRef\.current\) return;/, "두 번 눌러 두 번 저장하지 않는다");
});

test("#3 초안은 열 때 한 번만 읽는다(렌더마다 파싱 · 매번 '복원' 안내 금지)", () => {
  assert.match(editor, /const \[init\] = useState\(\(\) => openDraft\(/);
  assert.equal((deco.match(/loadDraft</g) ?? []).length, 2, "loadDraft 는 openDraft 안(새 키 · 옛 키)에서만");
  assert.ok(between(deco, "function openDraft(", "function DecoEditor(").includes("loadDraft<DiaryDraft>(localStorage, key)"));
  assert.match(editor, /useState\(!!init\.restored\)/);
});

test("#4 고친 일기 — 바뀐 게 있을 때만 dirty · 초안 · 확인창, 다른 기기에서 더 새로 고쳤으면 옛 초안을 버린다", () => {
  assert.match(editor, /const dirty = !sameForm\(form, init\.original\)/);
  assert.match(editor, /if \(!dirty\) \{\s*clearDraft\(localStorage, draftKey\)/, "원본 그대로면 초안을 남기지 않는다");
  assert.match(editor, /entry \? \{ base: entryVersion\(entry\) \}/);
  const open = between(deco, "function openDraft(", "function DecoEditor(");
  assert.match(open, /if \(d\.base === entryVersion\(entry\)\) restored = d;\s*else clearDraft\(localStorage, key\)/);
  assert.match(couple, /DECO_COLS = `\$\{DECO_COLS_BASE\},thumb_paths,updated_at,weather`/);
  assert.match(mig, /new\.updated_at := now\(\)/, "고친 시각은 서버가 채운다(옛 앱이 고쳐도)");
});

test("#5 고치기 — 0행이면 '삭제됐거나 바뀌었어요' 를 던지고 화면은 초안을 남긴다", () => {
  for (const fn of ["export async function updateDecoEntry(", "export async function updateDecoPhotos("]) {
    const body = bodyOf(couple, fn);
    assert.match(body, /\.select\("id"\)\s*\.maybeSingle\(\)/, fn);
    assert.match(body, /throw new DiaryGoneError\(\)/, fn);
  }
  assert.match(couple, /super\("일기가 삭제됐거나 바뀌었어요/);
  const save = between(editor, "async function save()", "function pickFiles(");
  assert.match(save, /if \(e instanceof DiaryGoneError\) \{\s*saveDraft/);
});

test("#6 오늘 = KST — 기기 시간대 훅을 쓰지 않는다", () => {
  // 통합(2026-11-06): useDayTick 자체가 KST 를 돌려주게 바뀌었다(공통 갈래) — 일기장은 그 공용 훅을 쓴다
  assert.match(deco, /const todayIso = useDayTick\(\)/);
  assert.match(readFileSync(join(process.cwd(), "src/lib/useDayTick.ts"), "utf8"), /kstDayKey/, "useDayTick 이 KST 가 아니다");
  assert.match(deco, /heatmapCells\(entries, todayIso, 24\)/);
  assert.match(deco, /currentStreak\(entries\.map\(\(e\) => e\.entry_date\), todayIso\)/);
  assert.match(between(deco, "async function remove(", "// 타이핑"), /e\.entry_date !== todayIso/);
});

test("#7 댓글 Enter — 한국어 조합 중 Enter 무시 + ref 가드(이중 댓글)", () => {
  assert.match(deco, /ev\.nativeEvent\.isComposing \|\| ev\.keyCode === 229/);
  assert.match(card, /if \(ev\.key !== "Enter" \|\| isImeEnter\(ev\)\) return;/);
  assert.match(card, /if \(!body \|\| sendingRef\.current\) return;/);
});

test("#8 F2 카드 태그는 누를 수 있고 태그 구름이 있다", () => {
  assert.match(card, /onClick=\{\(\) => onTag\(h\)\}/);
  assert.match(deco, /tagCloud\(entries, 12\)/);
  assert.match(deco, /toggleTagQuery\(cur, tag\)/);
  assert.match(editor, /hashtags: normalizeTags\(tags\)/);
  assert.ok(!/function parseTags/.test(deco), "옛 태그 파서(앞 # 하나만 · 중복 · 길이 무제한)가 돌아왔다");
});

test("#9 편집기 = 공용 Sheet — 저장 버튼 · 오류가 스크롤 밖 발판에", () => {
  assert.match(deco, /import Sheet from "@\/components\/Sheet"/);
  const footer = between(editor, "footer={", "\n      }\n    >");
  assert.match(footer, /role="alert"/);
  assert.match(footer, /"일기장에 남기기"/);
  assert.ok(!/fixed inset-0/.test(deco), "일기장이 자체 모달을 다시 만들었다");
  assert.match(strip(read("src/components/Sheet.tsx")), /export default function Sheet/);
  assert.ok(!/function Sheet\(/.test(page), "page.tsx 에 시트가 두 벌");
});

test("#10 뒤로 가기 · 포커스 · 이름", () => {
  assert.match(editor, /useBackClose\(\(\) => \{/);
  assert.match(editor, /void requestClose\(\);\s*return false;/, "바뀐 게 있으면 확인창 + 기록 다시 쌓기");
  assert.match(editor, /title=\{isEdit \? "일기 수정" : "일기 쓰기"\}/);
  assert.ok(!/aria-label="일기 쓰기"/.test(deco), "고칠 때도 '일기 쓰기'로 읽혔다");
  assert.match(strip(read("src/components/Sheet.tsx")), /useDialogFocus\(true, onClose\)/, "첫 포커스 · 포커스 가두기는 시트가");
});

test("#13 새 일기 재시도 — 화면이 정한 id 로 · 같은 사진 이름 · unique 위반 = 이미 저장됨", () => {
  const add = bodyOf(couple, "export async function addDecoEntry(");
  assert.match(add, /id: string = crypto\.randomUUID\(\)/);
  assert.match(add, /uploadDecoPhotos\(coupleId, id, files\)/);
  assert.match(add, /error\.code === "23505"/);
  assert.match(add, /const base = \{\s*id,/);
  const up = between(couple, "async function uploadDecoPhotos(", "\nexport ");
  assert.match(up, /`\$\{coupleId\}\/deco-\$\{stem\}-\$\{i\}\./, "이름이 id 로 정해진다(그리고 deco- 접두사)");
  assert.match(up, /upErr && !uploadExists\(upErr\)/, "'이미 있다'는 성공");
  assert.match(editor, /addDecoEntry\(coupleId, \{ entry_date: date, \.\.\.patch, weather \}, files, init\.id\)/);
  assert.match(editor, /\{ date: todayKey, id: init\.id \}/, "초안에도 id — 새로고침 뒤 다시 눌러도 같은 일기");
});

test("#14 새 일기 초안 키엔 날짜가 없다", () => {
  assert.match(deco, /draftStorageKey\("diary", `\$\{coupleId\}:\$\{entry\?\.id \?\? "new"\}`\)/);
  assert.match(editor, /어제 쓰던 글이 있어요/);
  assert.match(editor, /if \(savingRef\.current \|\| doneRef\.current \|\| staleDraft\) return;/, "고르기 전엔 어제 글을 덮지 않는다");
});

test("#15 실시간은 그 행만 — 일기는 한 편 다시 읽기, 반응 · 댓글은 신호 그대로", () => {
  assert.match(bodyOf(couple, "export function subscribeDeco("), /\(p\) => onChange\(p\)/);
  assert.match(bodyOf(couple, "export function subscribeEntryInteractions("), /table: "entry_reactions"/);
  const eff = between(deco, "const dirtyIds = new Set", "return () => {\n      cancelled = true;");
  assert.match(eff, /getDecoEntry\(id\)/);
  assert.match(eff, /applyRowChange\(cur, p\)/);
  assert.match(eff, /applyRowChange\(cur, p, \(c\) => c\.created_at\)/);
  assert.ok(!/subscribeDeco\(coupleId, \(\) => \{/.test(deco), "신호를 버리고 통째로 다시 받는 옛 모양");
  assert.match(deco, /return fullSoon\(\)/, "모르는 신호(resync)는 통째로 — 재연결 공백 보정 유지");
});

test("#16 썸네일 — 480px 를 올리고 카드는 썸네일, 없으면 원본", () => {
  const up = between(couple, "async function uploadDecoPhotos(", "\nexport ");
  // 통합(2026-11-06): 사진첩과 같은 preparePhoto(480px 썸네일 · 다시 그린 바이트만 · GPS 없음)
  assert.match(up, /await preparePhoto\(raw\)/);
  assert.doesNotMatch(up, /resizeImage\(raw\)/, "원본을 그대로 올릴 수 있는 옛 경로");
  assert.match(up, /deco-\$\{stem\}-\$\{i\}\.thumb\./);
  assert.match(couple, /export function decoDisplayPaths\(/);
  assert.match(between(couple, "async function hydrateDeco(", "\nexport "), /orig\[p\]/, "썸네일 서명이 안 되면 원본으로");
  assert.match(deco, /\[\.\.\.e\.photo_paths, \.\.\.e\.thumb_paths\.filter\(Boolean\)\]/, "지울 때 썸네일도");
});

test("#17 댓글 입력은 readOnly(키보드 유지) · 사진은 미리보기 + 빼기 + 더하기", () => {
  assert.match(card, /readOnly=\{sending\}/);
  assert.ok(!/<input[^>]*disabled=\{sending\}/.test(card), "입력칸 disabled 는 모바일 키보드를 내린다");
  assert.match(editor, /setFiles\(\(cur\) => \[\.\.\.cur, \.\.\.picked\]\.slice\(0, room\)\)/);
  assert.match(editor, /URL\.revokeObjectURL/);
  assert.match(editor, /aria-label=\{`고른 사진 \$\{i \+ 1\} 빼기`\}/);
});

test("#18 히트맵은 그림 하나 + 요약", () => {
  assert.match(deco, /role="img"\s*aria-label=\{`최근 24주 동안/);
});

test("F3 F5 F7 — 오늘의 질문 쓸 거리 · 고칠 때 사진 바꾸기 · 날씨", () => {
  assert.match(editor, /todaysQuestion\(/);
  assert.match(editor, /todaysMoodPrompt\(/);
  assert.match(editor, /updateDecoPhotos\(coupleId, entry, keep, files\)/);
  assert.match(editor, /const weather = isEdit \? null : weatherTag\(/, "지난 날 일기에 오늘 날씨를 붙이지 않는다");
  assert.match(bodyOf(couple, "export async function addDecoEntry("), /weather: input\.weather \|\| null/);
});

/* ── 비밀일기 제거 (사용자 결정 2026-11-05) ─────────────────────────── */

test("★ 비밀일기 UI 가 없다 — 공개 범위 고르기 · '나만 보기' · 클라가 보내는 visibility", () => {
  assert.ok(!/나만 보기/.test(deco));
  assert.ok(!/공개 범위/.test(deco));
  assert.ok(!/setVisibility|visibility === "private"/.test(deco));
  for (const fn of ["export async function addDecoEntry(", "export async function updateDecoEntry("]) {
    assert.ok(!/visibility:/.test(bodyOf(couple, fn)), `${fn} 가 공개 범위를 보낸다`);
  }
  // 새 일기 알림은 공개 범위를 보지 않는다(전부 함께 보는 일기)
  assert.match(between(editor, "async function save()", "function pickFiles("), /\} else \{[\s\S]*?sendEventPush\(\s*coupleId,\s*"diary"/);
});

test("★ migration — 백업 후 전부 공개 · 넣기/고치기 직전 공개 고정 · 롤백 방법이 적혀 있다", () => {
  const iBackup = mig.indexOf("insert into private.diary_private_backup");
  const iUpdate = mig.indexOf("update public.deco_entries set visibility = 'shared' where visibility is distinct from 'shared'");
  assert.ok(iBackup > 0 && iUpdate > iBackup, "어느 행이 비밀이었는지 먼저 남기고 바꾼다");
  assert.match(mig, /on conflict \(entry_id\) do nothing/);
  assert.match(mig, /revoke all on table private\.diary_private_backup from public, anon, authenticated/);
  assert.match(mig, /new\.visibility := 'shared'/);
  assert.match(mig, /create trigger deco_before_write before insert or update on public\.deco_entries/);
  assert.match(mig, /alter column visibility set default 'shared'/);
  assert.match(migRaw, /롤백[\s\S]*update public\.deco_entries d set visibility = 'private'[\s\S]*diary_private_backup/);
  assert.match(migRaw, /비밀일기 기능은 없애버려/);
});

test("★ 공개 = 같은 커플 두 사람에게만 — 일기 · 반응 · 댓글 조회 정책은 커플 구성원 집합을 요구한다", () => {
  const sql = schema.replace(/--[^\n]*/g, "");
  const lastPolicy = (name: string, table: string) => {
    const re = new RegExp(`create policy ${name} on public\\.${table}[\\s\\S]*?;`, "g");
    const all = [...sql.matchAll(re)].map((m) => m[0]);
    assert.ok(all.length, `${name} 정책이 없다`);
    return all.at(-1)!;
  };
  for (const [name, table] of [["deco_select", "deco_entries"], ["er_select", "entry_reactions"], ["ec_select", "entry_comments"]]) {
    const p = lastPolicy(name, table);
    assert.match(p, /\bto authenticated\b/, `${name}: 로그인한 사용자만`);
    assert.match(p, /couple_id in \(select private\.my_couple_ids\(\)\)/, `${name}: 같은 커플만`);
    assert.doesNotMatch(p, /using\s*\(\s*true\s*\)/, `${name}: 아무나 보는 정책`);
  }
  // 이 migration 은 정책 · 권한을 넓히지 않는다
  assert.doesNotMatch(mig, /create policy|alter policy|drop policy/);
  assert.doesNotMatch(mig, /grant [^;]* to (anon|public)/i);
  assert.doesNotMatch(mig, /storage\.objects/, "storage 정책은 공통 담당 — 건드리지 않는다");
});

test("★ migration — 여러 번 돌려도 같고 지우는 데이터가 없다 · schema.sql 에 그대로 있다", () => {
  assert.ok(schema.includes(migRaw), "schema.sql 끝의 복사본이 migration 과 다르다");
  assert.doesNotMatch(mig, /\bdrop table\b|\bdelete from\b|\btruncate\b|\bdrop column\b/i);
  for (const c of ["updated_at timestamptz", "thumb_paths text[]", "weather text"])
    assert.ok(mig.includes(`add column if not exists ${c}`), c);
  const adds = [...mig.matchAll(/add constraint (\w+)[\s\S]*?not valid;/g)].map((m) => m[1]);
  assert.deepEqual(adds.sort(), ["deco_location_len", "deco_photos_len", "deco_stickers_len", "deco_tags_len", "deco_title_len", "deco_weather_len"]);
  for (const c of adds) assert.ok(mig.includes(`drop constraint if exists ${c}`), c);
  assert.match(mig, /exception when check_violation then/, "옛 행이 어기면 NOT VALID 로 둔다(옛 일기를 고치지 않는다)");
  assert.doesNotMatch(mig, /errcode\s*=\s*'40001'|'40P01'/, "PostgREST 무한 재시도 코드 금지(rpcerrcode)");
  assert.match(mig, /revoke execute on function public\.deco_before_write\(\) from public, anon, authenticated/);
});
