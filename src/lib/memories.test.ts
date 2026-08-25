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
