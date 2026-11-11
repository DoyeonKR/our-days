// 일기 · 오늘의 질문 저장 리뷰 회귀 lock (2026-11-11) — 소스 계약.
// 순수 규칙은 lib/diarysave.test · lib/questiondraft.test 가 값으로 잰다. 여기는 화면 · 데이터 계층이 그 규칙을 쓰는지.
// 소스 스캔은 주석을 먼저 지운다(README §10.5 — 설명문이 먼저 잡힌다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const deco = strip(read("src/components/DecoBook.tsx"));
const couple = strip(read("src/lib/couple.ts"));
const dq = strip(read("src/components/DailyQuestion.tsx"));
const cal = strip(read("src/components/Calendar.tsx"));
const reader = strip(read("src/components/DiaryBookReader.tsx"));
const between = (src: string, a: string, b: string) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, `${a} 를 못 찾았다`);
  const j = src.indexOf(b, i + a.length);
  return src.slice(i, j < 0 ? undefined : j);
};
const fnBody = (src: string, decl: string) => between(src, decl, "\nexport ");
const add = fnBody(couple, "export async function addDecoEntry(");
const upd = fnBody(couple, "export async function updateDecoEntry(");
const photos = fnBody(couple, "export async function updateDecoPhotos(");
const upload = between(couple, "async function uploadDecoPhotos(", "\nexport ");
const editor = between(deco, "function DecoEditor(", "\nfunction \u0000");
const save = between(editor, "async function save(", "function overwrite(");
const autosave = between(editor, "useEffect(() => {\n    if (savingRef.current", "}, [draftKey");

test("1 · 23505 — 내 오늘 일기면 지금 글로 고친다(성공으로 삼키지 않는다) · 남의 행 · 지난 날 id 면 새 id", () => {
  assert.doesNotMatch(add, /error\.code === "23505"[^\n]*\)\)\s*return;/, "23505 를 그냥 성공으로 끝내던 옛 코드");
  const dup = between(add, "if (isDuplicateKey(error))", "if (error) {");
  assert.match(dup, /getDecoEntry\(rowId\)/, "행을 읽어 본다");
  assert.match(dup, /cur\.created_by === uid && cur\.entry_date === todayISO/, "내 행 · 오늘 일기인지");
  assert.match(dup, /\.update\(/, "지금 글로 고친다");
  assert.match(dup, /\.eq\("created_by", uid\)/);
  assert.match(dup, /retryPhotoPlan\(cur, \{ paths, thumbs \}\)/);
  assert.match(dup, /rowId = crypto\.randomUUID\(\);\s*error = await insertAs\(rowId\);/, "남의 행 · 어제 id 는 새 id 로");
  assert.match(add, /return rowId;/, "실제로 저장된 id 를 돌려준다(푸시가 가리킬 곳)");
});

test("1 · 사진 이름은 시도마다 다르다 — 새 일기 · 고치기 모두", () => {
  assert.match(add, /uploadDecoPhotos\(coupleId, diaryPhotoStem\(id\), files\)/);
  assert.match(photos, /uploadDecoPhotos\(coupleId, diaryPhotoStem\(entry\.id\),/);
});

test("1 · 어제 초안의 id 는 쓰지 않는다 · '지우기' · '이어 쓰기' 뒤엔 새 id · 푸시는 저장된 id", () => {
  const open = between(deco, "function openDraft(", "function draftOf(");
  assert.doesNotMatch(open, /stale\?\.id/, "어제 초안의 id 를 오늘 일기에 다시 쓰던 길");
  assert.match(open, /id: restored\?\.id \|\| crypto\.randomUUID\(\)/);
  assert.match(editor, /const \[draftId, setDraftId\] = useState\(init\.id\)/);
  const banner = between(editor, "{staleDraft && (", "<div className=\"flex gap-2\">\n");
  assert.equal((banner.match(/setDraftId\(crypto\.randomUUID\(\)\)/g) ?? []).length, 2, "이어 쓰기 · 지우기 둘 다");
  assert.match(save, /const savedId = await addDecoEntry\(coupleId, \{ entry_date: date, \.\.\.patch, weather \}, files, draftId\)/);
  assert.match(save, /sendEventPush\([\s\S]{0,200}savedId,\s*\)/, "새 일기 알림은 실제로 저장된 일기로");
  assert.doesNotMatch(save, /init\.id/);
});

test("2 · 응답을 잃으면 사진을 지우지 않는다 — 서버가 분명히 거절했을 때만, 연결 끊김은 행부터 본다", () => {
  const tail = add.slice(add.lastIndexOf("if (error) {"));
  assert.match(tail, /if \(isDefiniteRejection\(error\)\) \{\s*dropDecoFiles\(fresh\);/);
  assert.match(tail, /const landed = await diaryStep\(getDecoEntry\(rowId\)\)\.catch\(\(\) => undefined\);\s*if \(landed && landed\.created_by === uid\) return rowId;/);
  assert.equal((tail.match(/dropDecoFiles\(fresh\)/g) ?? []).length, 1, "연결 끊김 갈래에선 지우지 않는다");
  assert.doesNotMatch(add, /if \(error\) \{\s*if \(fresh\.length\) sb\.storage/, "옛 코드: 오류면 무조건 사진 삭제");
  assert.match(photos, /if \(isDefiniteRejection\(error\)\) \{\s*dropDecoFiles\(up\.fresh\);/);
  assert.match(photos, /samePaths\(cur\.photo_paths, photo_paths\)/, "연결 끊김이면 이미 들어갔는지 본다");
  assert.doesNotMatch(photos, /if \(error \|\| !data\) \{\s*if \(up\.fresh\.length\)/, "옛 코드: 오류 · 0행을 같이 보고 사진 삭제");
});

test("3 · '어제 쓰던 글' 동안 — 표시는 사실대로 · 쓰기 시작하면 오늘 키에 저장 · 덮기 전에 묻는다", () => {
  assert.match(editor, /const \[draftSaved, setDraftSaved\] = useState\(!!init\.restored\)/, "true 로 시작하면 저장 안 된 초안이 '저장됨'");
  assert.doesNotMatch(editor, /if \(savingRef\.current \|\| doneRef\.current \|\| staleDraft\) return;/, "배너가 떠 있는 내내 자동 저장이 꺼졌다");
  assert.match(editor, /const holdingStale = !!staleDraft && !formDirty;/);
  assert.match(editor, /\{!dirty \|\| holdingStale \|\| gone \? "" : draftSaved \? "이 기기에 초안 저장됨" : "초안 저장 중…"\}/);
  const banner = between(editor, "{staleDraft && (", "<div className=\"flex gap-2\">\n");
  assert.match(banner, /formDirty &&\s*!\(await confirmDialog\(\{ message: "지금 쓴 글을 어제 글로 바꿀까요\?"/);
  assert.match(banner, /if \(holdingStale\) clearDraft\(localStorage, draftKey\);/, "'지우기'가 오늘 쓴 초안을 지우지 않게");
});

test("4 · 시간 제한 — 사진 한 장마다 · 행 쓰기마다, 시간이 다 되면 초안을 남기고 닫을 수 있다", () => {
  assert.match(couple, /import \{ withTimeout \} from "@\/lib\/logreview";/);
  assert.match(between(couple, "async function diaryStep<T>(", "\n}\n"), /withTimeout\(Promise\.resolve\(p\), ms, onLate\)/);
  assert.equal((upload.match(/DIARY_PHOTO_TIMEOUT_MS/g) ?? []).length, 2, "원본 · 썸네일");
  assert.match(upload, /lateDrop\(p\)/, "시간이 지나 올라온 파일은 치운다");
  for (const body of [add, upd, photos]) assert.match(body, /await diaryStep\(/);
  assert.match(couple, /class DiarySaveTimeoutError extends Error/);
  assert.doesNotMatch(editor, /if \(confirmingRef\.current \|\| busy\) return;/, "저장 중엔 시트를 못 닫던 것");
  assert.match(between(editor, "async function requestClose()", "useBackClose("), /if \(busy\) \{[\s\S]*closedRef\.current = true;\s*onClose\(\);/);
  assert.match(save, /onSaved\(closedRef\.current\)/);
  assert.match(between(deco, "onSaved={async (closed)", "/>"), /if \(!closed\) setEditing\(null\)/, "닫은 뒤 끝난 저장이 다시 연 편집기를 닫지 않게");
});

test("5 · 오늘의 질문 — 어제 초안은 그 질문 글을 '어제 질문'으로, 옮기기 · 유예 · 말없이 지우지 않기", () => {
  assert.doesNotMatch(dq, /localStorage\.removeItem\(k\)/, "오늘 키가 아니면 전부 지우던 청소");
  assert.match(dq, /pickStaleQuestionDraft\(/);
  assert.match(dq, /offered: true/);
  assert.match(dq, /const draftState = questionDraftState\(draft\.trim\(\) \? draftQid : null, q\.id, nowMs\);/);
  assert.match(dq, />어제 질문</);
  assert.match(dq, /\{questionText\(draftQid\)\}/, "초안의 질문 글을 보여 준다");
  assert.match(dq, /오늘 질문으로 옮기기/);
  assert.match(between(dq, "function moveDraftToToday()", "function discardStaleDraft()"), /setDraftQid\(q\.id\)/);
  assert.match(dq, /if \(!draft\.trim\(\) \|\| draftState === "expired"\) return;/, "유예가 지난 어제 질문엔 내지 않는다");
  assert.match(dq, /disabled=\{busy \|\| !draft\.trim\(\) \|\| draftState === "expired"\}/);
});

test("6 · 고치기 버전 확인 — 연 때의 updated_at 일 때만, 0행이면 다시 읽어 지워짐 · 바뀜 · 내 저장을 가른다", () => {
  assert.match(upd, /expect\.updated_at \? q\.eq\("updated_at", expect\.updated_at\) : q\.is\("updated_at", null\)/, "안 고친 일기는 updated_at 이 null");
  assert.match(photos, /expect!\.updated_at \? q\.eq\("updated_at", expect!\.updated_at\) : q\.is\("updated_at", null\)/);
  assert.match(upd, /if \(!cur\) throw new DiaryGoneError\(\);\s*if \(sameDiaryContent\(cur, patch\)\) return \{ updated_at: cur\.updated_at \?\? null, latest: cur \};\s*throw new DiaryConflictError\(cur\);/);
  assert.match(save, /updateDecoEntry\(entry\.id, patch, cur\.updated_at === undefined \? undefined : \{ updated_at: cur\.updated_at \}\)/);
  assert.match(save, /cur = res\.latest \?\? \{ \.\.\.cur, updated_at:/, "사진 단계는 글이 들어간 뒤의 버전으로(첫 update 가 updated_at 을 올린다)");
  assert.match(editor, /다른 기기에서 이 일기를 먼저 고쳤어요/);
  assert.match(editor, /내 글로 저장/);
  assert.match(editor, /저장된 글 불러오기/);
  // 지워진 일기의 글은 새 일기 초안으로 — 예전엔 지워진 일기의 키에 남아 다시 열 길이 없었다
  assert.match(between(deco, "function moveToNewDraft(", "\nfunction "), /draftStorageKey\("diary", `\$\{coupleId\}:new`\)/);
  assert.match(save, /if \(moveToNewDraft\(coupleId, form, todayKey\)\) clearDraft\(localStorage, draftKey\);/);
});

test("7 · photo_urls 는 photo_paths 와 같은 자리 — 거르는 건 그릴 때만", () => {
  const hydrate = between(couple, "async function hydrateDeco(", "\nexport ");
  assert.doesNotMatch(hydrate, /\.filter\(Boolean\)/, "빈 칸을 걸러 두 번째 사진이 첫 자리로 당겨졌다");
  const recover = between(deco, "async function recoverPhotos(", "async function remove(");
  assert.doesNotMatch(recover, /\.filter\(Boolean\)/);
  assert.match(recover, /if \(next\.some\(Boolean\)\)/);
  assert.match(deco, /visiblePhotoUrls\(e\.photo_urls\)\.map\(/, "카드는 그릴 때 거른다");
  assert.match(editor, /base\.photo_paths\.map\(\(p, i\) => \(\{ p, u: base\.photo_urls\[i\] \?\? "" \}\)\)/);
  assert.match(editor, /\{x\.u \? \(/, "주소를 못 받은 사진은 빈 칸으로(다른 사진을 대신 보여 주지 않는다)");
  assert.match(reader, /p\.entry\.photo_urls\.filter\(Boolean\)\.map\(/);
});

test("8 · 저장이 실패해도 마지막 글자까지 초안에", () => {
  const caught = save.slice(save.indexOf("} catch (e) {"));
  assert.match(caught, /\} else \{\s*setDraftSaved\(saveDraft<DiaryDraft>\(localStorage, draftKey, draftOf\(form, cur, todayKey, draftId\)\)\);/);
  // 누르는 순간에도 바로 — 400ms 타이머를 지운 뒤라 그 사이 글자가 빠지지 않게
  assert.ok(save.indexOf("timerRef.current = null;") < save.indexOf("saveDraft<DiaryDraft>(localStorage, draftKey, draftOf(form, cur"));
});

test("달력 '오늘'은 기기 자정에 바뀐다(useLocalDayTick)", () => {
  assert.match(cal, /import \{ useLocalDayTick \} from "@\/lib\/useDayTick";/);
  assert.match(cal, /const dayKey = useLocalDayTick\(\);\s*const t = useMemo\(\(\) => parseDate\(dayKey\), \[dayKey\]\);/);
  assert.doesNotMatch(cal, /const t = today\(\);/, "렌더 때만 재던 오늘");
});

test("일기 본문 칸은 글만큼 자란다(field-sizing + JS 대체) · 최대 높이", () => {
  const ta = between(editor, "<textarea", "/>");
  assert.match(ta, /ref=\{bodyRef\}/);
  assert.match(ta, /field-sizing-content/);
  assert.match(ta, /max-h-\[45dvh\]/);
  assert.match(editor, /CSS\.supports\?\.\("field-sizing", "content"\)/);
  assert.match(editor, /el\.style\.height = `\$\{Math\.min\(el\.scrollHeight \+ 2, Math\.round\(window\.innerHeight \* BODY_MAX_VH\)\)\}px`/);
});

test("일기책 — 그 해 일기를 useMemo 로 한 번만(반응 하나에 쪽 나누기를 다시 하지 않게)", () => {
  assert.doesNotMatch(deco, /entries=\{entries\.filter\(/);
  assert.match(deco, /const readerEntries = useMemo\(/);
  assert.match(deco, /\[entries, readYear\],?\s*\)/);
  assert.match(deco, /entries=\{readerEntries\}/);
});

test("추억 · 홈 '작년 오늘'의 일기 사진은 썸네일 칸을 받는다", () => {
  const snap = between(couple, "export async function listOnThisDaySnapshot(", "\nexport ");
  assert.match(snap, /diaryRows\(`\$\{diaryCols\},thumb_paths`\)/);
  assert.match(snap, /missingColumn\(diaryFirst\.error\) \? await diaryRows\(diaryCols\) : diaryFirst/, "칸이 없는 옛 DB 면 옛 칸만");
});

test("6 · 충돌 뒤 — 자동 초안도 최신 버전 위에 · 응답을 잃은 내 저장 뒤 사진은 rebaseKeep 로(다른 기기 사진을 지우지 않는다)", () => {
  assert.match(autosave, /draftOf\(form, conflict \?\? base, todayKey, draftId\)/, "옛 버전으로 쓰면 다시 열 때 openDraft 가 글을 버린다");
  assert.match(editor, /\}, \[draftKey, form, dirty, holdingStale, base, conflict, todayKey, draftId\]\);/);
  assert.match(save, /if \(res\.latest\) \{\s*keepNow = rebaseKeep\(keepNow, cur\.photo_paths, res\.latest\.photo_paths\);/);
  assert.ok(save.indexOf("rebaseKeep(") < save.indexOf("updateDecoPhotos("), "사진 단계 전에 남길 사진을 다시 정한다");
  assert.match(between(editor, "function overwrite()", "async function takeLatest()"), /rebaseKeep\(keep, base\?\.photo_paths \?\? \[\], latest\.photo_paths\)/);
});

test("4 · 저장 중에 닫고 다시 저장 — 늦게 끝난 옛 시도가 새 글을 덮지 않는다", () => {
  assert.match(couple, /const decoAttempts = new Map<string, number>\(\);/);
  const dup = between(add, "if (isDuplicateKey(error))", "if (error) {");
  assert.match(dup, /decoAttempts\.get\(id\) !== attempt\) \{\s*dropDecoFiles\(fresh\);\s*return rowId;/, "옛 시도는 23505 에서 고치지 않는다");
  assert.ok(dup.indexOf("decoAttempts.get(id) !== attempt") < dup.indexOf(".update("));
  assert.match(deco, /const saveAttempts = new Map<string, number>\(\);/);
  const caught = save.slice(save.indexOf("} catch (e) {"));
  assert.match(caught, /^\} catch \(e\) \{\s*if \(saveAttempts\.get\(attemptKey\) !== attempt\) \{/, "옛 시도의 실패는 새 시도의 초안을 덮지 않는다");
  assert.match(caught, /e instanceof DiaryConflictError && entry && !closedRef\.current/, "닫힌 편집기는 충돌 초안을 최신 버전 위에 남기지 않는다");
});
