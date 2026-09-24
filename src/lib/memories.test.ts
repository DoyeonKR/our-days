import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyRecap, onThisDayMemories, shiftedMonthKey, type MemorySnapshot } from "./memories.ts";

const snapshot: MemorySnapshot = {
  diaries: [
    { id: "d1", entry_date: "2025-08-25", title: "바다", body: "좋았다", mood_emoji: "🥰", photo_paths: ["c/d.webp"], created_by: "me" },
    { id: "d2", entry_date: "2026-08-01", title: null, body: null, mood_emoji: "🥰", photo_paths: [], created_by: "me" },
  ],
  photos: [{ id: "p1", storage_path: "c/p.webp", thumb_path: null, created_by: "partner", created_at: "2026-08-02T00:00:00Z" }],
  logs: [{ id: "l1", log_date: "2024-08-25", body: "산책", emoji: "🌿", created_by: "me", created_at: "2024-08-25T01:00:00Z" }],
  answers: [{ id: "a1", question_id: "q", body: "같이 여행", user_id: "partner", created_at: "2026-08-03T00:00:00Z" }],
};

test("추억: 같은 월·일의 과거 기록만 모으고 몇 년 전인지 계산한다", () => {
  const items = onThisDayMemories(snapshot, "2026-08-25");
  assert.deepEqual(items.map((item) => [item.kind, item.yearsAgo]), [["diary", 1], ["log", 2]]);
  assert.equal(items[0].mediaPath, "c/d.webp");
});

test("월간 리캡: 종류별 수와 중복 없는 활동일, 대표 기분을 계산한다", () => {
  const recap = monthlyRecap(snapshot, "2026-08");
  assert.deepEqual(
    { diaries: recap.diaries, photos: recap.photos, logs: recap.logs, answers: recap.answers, activeDays: recap.activeDays, topMood: recap.topMood },
    { diaries: 1, photos: 1, logs: 0, answers: 1, activeDays: 3, topMood: "🥰" },
  );
  assert.equal(shiftedMonthKey("2026-01-10", -1), "2025-12");
});

test("월간 리캡: 이 달 일기의 기분 분포(많은 순, 빈 기분 제외) — 일기장에서 옮겨 온 '이번 달 우리 기분'", () => {
  const snap: MemorySnapshot = {
    ...snapshot,
    diaries: [
      { id: "a", entry_date: "2026-09-01", title: null, body: null, mood_emoji: "😊", photo_paths: [], created_by: "me" },
      { id: "b", entry_date: "2026-09-02", title: null, body: null, mood_emoji: "🥰", photo_paths: [], created_by: "partner" },
      { id: "c", entry_date: "2026-09-03", title: null, body: null, mood_emoji: "😊", photo_paths: [], created_by: "me" },
      { id: "d", entry_date: "2026-09-04", title: null, body: null, mood_emoji: null, photo_paths: [], created_by: "me" },
      { id: "e", entry_date: "2026-09-05", title: null, body: null, mood_emoji: "", photo_paths: [], created_by: "me" },
      { id: "f", entry_date: "2026-08-30", title: null, body: null, mood_emoji: "😢", photo_paths: [], created_by: "me" },
    ],
  };
  const recap = monthlyRecap(snap, "2026-09");
  assert.deepEqual(recap.moods, [
    { emoji: "😊", count: 2 },
    { emoji: "🥰", count: 1 },
  ]);
  assert.equal(recap.topMood, "😊");
  assert.deepEqual(monthlyRecap(snap, "2026-07").moods, []);
});

test("지난해 같은 날짜: KST 하루 범위와 윤년 2/29", async () => {
  const { pastSameDays } = await import("./memories.ts");
  const r = pastSameDays("2026-09-24", 3);
  assert.deepEqual(r.dates, ["2025-09-24", "2024-09-24", "2023-09-24"]);
  // KST 2025-09-24 00:00 = UTC 2025-09-23 15:00, 끝은 다음 날 KST 자정
  assert.deepEqual(r.ranges[0], ["2025-09-23T15:00:00Z", "2025-09-24T15:00:00Z"]);
  // 2/29 는 윤년에만 — 3/1 로 밀면 다른 날의 추억이 섞인다
  assert.deepEqual(pastSameDays("2028-02-29", 8).dates, ["2024-02-29", "2020-02-29"]);
  // 같은 날짜 목록은 onThisDayMemories 가 고르는 날과 같다
  for (const d of r.dates) assert.equal(d.slice(5), "09-24");
});
