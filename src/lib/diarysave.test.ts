// 일기 저장 규칙(순수) 회귀 lock (2026-11-11) — 응답을 잃은 뒤의 재시도 · 사진 정리 · 사진 자리 · 지워진 일기의 글.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIARY_PHOTO_TIMEOUT_MS,
  DIARY_SAVE_TIMEOUT_MS,
  alignedPhotoUrls,
  diaryPhotoStem,
  isDefiniteRejection,
  isDuplicateKey,
  mergeIntoNewDraft,
  retryPhotoPlan,
  sameDiaryContent,
  samePaths,
  visiblePhotoUrls,
} from "./diarysave.ts";

test("서버가 분명히 거절했을 때만 '거절' — 연결 끊김(코드 없음)은 반영됐는지 모른다", () => {
  assert.equal(isDefiniteRejection({ code: "23514" }), true);
  assert.equal(isDefiniteRejection({ code: "PGRST116" }), true);
  assert.equal(isDefiniteRejection({ code: "" }), false, "supabase-js 의 네트워크 오류는 code 가 빈 문자열");
  assert.equal(isDefiniteRejection({ code: undefined }), false);
  assert.equal(isDefiniteRejection(null), false);
  assert.equal(isDuplicateKey({ code: "23505" }), true);
  assert.equal(isDuplicateKey({ code: "", message: "duplicate key value violates unique constraint" }), true);
  assert.equal(isDuplicateKey({ code: "23514" }), false);
});

test("사진 이름 줄기는 시도마다 다르다 — 같은 일기를 다시 저장해도 다시 고른 사진이 첫 사진에 묻히지 않는다", () => {
  const a = diaryPhotoStem("abc", 1_000, "x1");
  const b = diaryPhotoStem("abc", 2_000, "x1");
  const c = diaryPhotoStem("abc", 1_000, "y2");
  assert.ok(a.startsWith("abc-") && b.startsWith("abc-"), "앞부분은 일기 id(deco-<id> 접두사 유지)");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(diaryPhotoStem("abc"), diaryPhotoStem("abc"));
});

test("사진 주소는 photo_paths 와 같은 자리 — 못 받은 칸은 '' 로 남고, 거르는 건 그릴 때만", () => {
  const urls = { "c/deco-1-1.thumb.webp": "U2" };
  const out = alignedPhotoUrls(["c/deco-1-0.webp", "c/deco-1-1.webp"], ["c/deco-1-0.thumb.webp", "c/deco-1-1.thumb.webp"], urls);
  assert.deepEqual(out, ["", "U2"], "첫 사진을 못 받아도 두 번째 사진이 첫 자리로 당겨지지 않는다");
  assert.deepEqual(alignedPhotoUrls(["a", "b"], ["", ""], { a: "A" }, { b: "B" }), ["A", "B"], "썸네일이 없으면 원본");
  assert.deepEqual(alignedPhotoUrls(["a"], ["at"], {}, { a: "A0" }), ["A0"], "썸네일 서명이 안 되면 원본 서명");
  assert.deepEqual(visiblePhotoUrls(out), ["U2"]);
});

test("같은 글인가 — 응답을 잃은 내 저장(버전만 바뀜)과 다른 기기의 수정을 가른다", () => {
  const row = { title: "바다", body: "좋았다", location: null, mood_emoji: "🥰", bg: "pink", hashtags: ["여행"], stickers: [{ emoji: "⭐" }] };
  assert.equal(sameDiaryContent(row, { ...row, location: "" }), true, "null 과 빈 칸은 같다");
  assert.equal(sameDiaryContent(row, { ...row, body: "좋았다 " }), true, "앞뒤 공백");
  assert.equal(sameDiaryContent(row, { ...row, body: "별로였다" }), false);
  assert.equal(sameDiaryContent(row, { ...row, stickers: [] }), false);
  assert.equal(samePaths(["a", "b"], ["a", "b"]), true);
  assert.equal(samePaths(["a", "b"], ["b", "a"]), false);
});

test("23505 재시도의 사진 — 새로 고른 게 있으면 바꾸고 옛 것은 치울 목록에, 없으면 있던 사진을 남긴다", () => {
  const existing = { photo_paths: ["c/deco-1-aa-0.webp"], thumb_paths: ["c/deco-1-aa-0.thumb.webp"] };
  const none = retryPhotoPlan(existing, { paths: [], thumbs: [] });
  assert.deepEqual(none, { photo_paths: ["c/deco-1-aa-0.webp"], thumb_paths: ["c/deco-1-aa-0.thumb.webp"], gone: [] }, "사진을 말없이 지우지 않는다");
  const fresh = retryPhotoPlan(existing, { paths: ["c/deco-1-bb-0.webp"], thumbs: [""] });
  assert.deepEqual(fresh.photo_paths, ["c/deco-1-bb-0.webp"]);
  assert.deepEqual(fresh.gone.sort(), ["c/deco-1-aa-0.thumb.webp", "c/deco-1-aa-0.webp"]);
});

test("지워진 일기의 글 → 새 일기 초안 — 쓰던 새 일기 초안은 덮지 않고 뒤에 붙인다", () => {
  const moved = { title: "어제 고치던 글", body: "본문", bg: "mint" };
  assert.deepEqual(mergeIntoNewDraft(null, moved), moved);
  assert.deepEqual(mergeIntoNewDraft({ title: "", body: " ", bg: "pink" }, moved), moved, "빈 초안이면 그대로 옮긴다");
  const merged = mergeIntoNewDraft({ title: "오늘", body: "오늘 쓰던 글", bg: "pink" }, moved);
  assert.equal(merged.title, "오늘", "쓰던 초안의 제목 · 꾸미기는 그대로");
  assert.equal(merged.bg, "pink");
  assert.equal(merged.body, "오늘 쓰던 글\n\n어제 고치던 글\n본문");
});

test("시간 제한 — 사진 한 장 · 행 한 번을 무한히 기다리지 않는다", () => {
  assert.ok(DIARY_PHOTO_TIMEOUT_MS >= 15_000 && DIARY_PHOTO_TIMEOUT_MS <= 60_000);
  assert.ok(DIARY_SAVE_TIMEOUT_MS >= 8_000 && DIARY_SAVE_TIMEOUT_MS <= 30_000);
});
