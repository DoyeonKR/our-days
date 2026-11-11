// 끊긴 연결 · 두 번 누르기 · 휴대폰 공유 lock (2026-11-11).
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
  assert.match(sheet, /restored && isUuid\(restored\.id\) \? restored\.id : newEventId\(\)/);
  assert.match(sheet, /if \(!existing\) setEventId\(newEventId\(\)\);/, "버린 초안의 id(이미 저장됐을 수 있다)를 새 일정이 이어 쓴다");
});

test("3 편집 — 0행인데 서버 행이 내가 보낸 내용이면 충돌이 아니라 성공 · 새 일정 재시도에 내용을 고쳤으면 덮어쓴다", () => {
  const upd = fnBody(couple, "export async function updateCoupleEvent(", "export async function deleteCoupleEvent(");
  const match = upd.indexOf("if (fresh && eventContentMatches(fresh, ev)) return fresh;");
  assert.ok(match > 0, "내 저장이 이미 들어간 걸 충돌로 본다");
  assert.ok(match < upd.indexOf("throw new EventConflictError(fresh)"));
  const add = fnBody(couple, "export async function addCoupleEvent(", "const EVENT_UPDATING");
  assert.match(add, /if \(eventContentMatches\(existing, sent\)\) return existing;\s+return updateCoupleEvent\(\{ \.\.\.sent, createdBy: existing\.createdBy, updatedAt: existing\.updatedAt \}\);/);
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
  assert.match(sheet, /await withTimeout\(onSave\(\{/);
  assert.match(sheet, /\}\), EVENT_SAVE_TIMEOUT_MS\);/);
  assert.doesNotMatch(sheet, /onClose=\{busy \? \(\) => \{\} : onClose\}/, "저장 중엔 닫을 수 없던 것이 되살아났다");
  assert.match(sheet, /if \(alive\.current\) onClose\(\);/);
  assert.match(sheet, /reason\.message !== "upload-timeout"/, "시간 초과 원문(upload-timeout)이 화면에 뜬다");
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
