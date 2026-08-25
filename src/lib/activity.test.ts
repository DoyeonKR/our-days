import { test } from "node:test";
import assert from "node:assert/strict";
import { activityPresentation, activityTime, unreadActivityCount } from "./activity.ts";
import type { ActivityEvent } from "./couple.ts";

const event = (created_at: string): ActivityEvent => ({
  id: created_at,
  couple_id: "c",
  actor_user: "partner",
  kind: "photo",
  entity_id: "p",
  summary: null,
  metadata: {},
  created_at,
});

test("활동함: 작성자를 애칭으로 풀고 활동 종류를 사용자 문장으로 바꾼다", () => {
  const shown = activityPresentation(
    { ...event("2026-08-25T00:00:00Z"), summary: "바다" },
    [{ couple_id: "c", user_id: "partner", nickname: "꼬꼬", joined_at: "" }],
    "me",
  );
  assert.equal(shown.title, "꼬꼬님이 사진을 올렸어요");
  assert.equal(shown.detail, "바다");
});

test("활동함: 마지막 읽은 시각 이후만 미확인으로 센다", () => {
  const events = [event("2026-08-25T10:00:00Z"), event("2026-08-24T10:00:00Z")];
  assert.equal(unreadActivityCount(events, "2026-08-25T00:00:00Z"), 1);
  assert.equal(activityTime("2026-08-25T09:59:30Z", Date.parse("2026-08-25T10:00:00Z")), "방금");
});

test("활동함: 내가 만든 활동은 새 소식 배지를 올리지 않는다", () => {
  const events = [event("2026-08-25T10:00:00Z"), { ...event("2026-08-25T11:00:00Z"), actor_user: "me" }];
  assert.equal(unreadActivityCount(events, null, "me"), 1);
});
