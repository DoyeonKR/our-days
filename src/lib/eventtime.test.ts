// 일정 시간 lock. [2026-10-30 UX 점검 — 플래너인데 날짜만 있어 "저녁 7시 약속"을 적을 곳이 없었다]
// 잠그는 것: 시간 정규화 · 표기 · 저장 확인(eventContentMatches)이 시간까지 본다 · migration 이 schema.sql 끝에 그대로 있다 ·
// 데이터 계층이 추가·편집 모두 event_time 을 보낸다 · 시트에 시간 칸이 있다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventContentMatches, eventTimeLabel, normalizeEventTime, type CoupleEvent } from "./dday.ts";
import { eventPushMessage } from "./eventpush.ts";

const read = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");

test("시간 정규화 — HH:MM 만, 나머지는 종일", () => {
  assert.equal(normalizeEventTime("19:30"), "19:30");
  assert.equal(normalizeEventTime("00:00"), "00:00");
  for (const bad of ["", null, undefined, "24:00", "7:30", "19:60", "19:30:00"]) assert.equal(normalizeEventTime(bad), undefined);
  assert.equal(eventTimeLabel("19:30"), "오후 7:30");
  assert.equal(eventTimeLabel("00:05"), "오전 12:05");
  assert.equal(eventTimeLabel("12:00"), "오후 12:00");
  assert.equal(eventTimeLabel(undefined), "");
});

test("저장 확인은 시간까지 본다 — 서버가 시간을 잃으면 저장 실패로 잡힌다", () => {
  const base: CoupleEvent = { id: "a", title: "영화", date: "2026-11-03", repeatYearly: false, recurrence: "none" };
  assert.ok(eventContentMatches({ ...base }, { ...base }));
  assert.ok(eventContentMatches({ ...base, time: "19:30" }, { ...base, time: "19:30" }));
  assert.ok(!eventContentMatches({ ...base }, { ...base, time: "19:30" }));
});

test("푸시 본문에 시간이 붙는다", () => {
  assert.equal(eventPushMessage({ title: "영화", date: "2026-11-03", time: "19:30" }), "영화 · 11월 3일 19:30");
  assert.equal(eventPushMessage({ title: "영화", date: "2026-11-03", time: "bad" }), "영화 · 11월 3일");
});

test("migration 이 schema.sql 끝에 그대로 있고, 데이터 계층·시트가 시간을 다룬다", () => {
  const migration = read("supabase", "migrations", "20261030000000_event_time.sql").trim();
  assert.ok(read("supabase", "schema.sql").includes(migration), "schema.sql 끝의 복사본이 migration 과 달라졌어요");
  assert.match(migration, /add column if not exists event_time text/);
  const couple = read("src", "lib", "couple.ts");
  assert.equal((couple.match(/event_time: normalizeEventTime\(ev\.time\) \?\? null/g) ?? []).length, 2, "추가·편집 둘 다 event_time 을 보내야 한다");
  assert.match(couple, /time: normalizeEventTime\(r\.event_time\)/);
  const page = read("src", "app", "page.tsx");
  assert.match(page, /<Field label="시간 \(선택\)">/);
  assert.match(page, /time: normalizeEventTime\(time\)/);
});
