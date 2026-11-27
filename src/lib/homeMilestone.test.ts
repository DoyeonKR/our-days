import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientMoodOf, nextMilestoneOf } from "./homeMilestone.ts";

test("nextMilestoneOf computes 100-day milestone progress accurately", () => {
  const d1 = nextMilestoneOf(1);
  assert.equal(d1.prev, 0);
  assert.equal(d1.target, 100);
  assert.equal(d1.left, 99);
  assert.equal(d1.isToday, false);
  assert.equal(d1.label, "100일까지 99일");

  const d247 = nextMilestoneOf(247);
  assert.equal(d247.prev, 200);
  assert.equal(d247.target, 300);
  assert.equal(d247.left, 53);
  assert.equal(d247.pct, 47);
  assert.equal(d247.isToday, false);
  assert.equal(d247.label, "300일까지 53일");

  const d300 = nextMilestoneOf(300);
  assert.equal(d300.isToday, true);
  assert.equal(d300.pct, 100);
  assert.equal(d300.left, 0);
  assert.equal(d300.label, "오늘은 300일!");

  const d1000 = nextMilestoneOf(1000);
  assert.equal(d1000.isToday, true);
  assert.equal(d1000.label, "오늘은 1,000일!");
});

test("ambientMoodOf maps KST hours to five calm atmospheric tones", () => {
  assert.equal(ambientMoodOf(6).tone, "dawn");
  assert.equal(ambientMoodOf(9).tone, "morning");
  assert.equal(ambientMoodOf(14).tone, "day");
  assert.equal(ambientMoodOf(18).tone, "golden");
  assert.equal(ambientMoodOf(23).tone, "night");
  assert.equal(ambientMoodOf(2).tone, "night");
});
