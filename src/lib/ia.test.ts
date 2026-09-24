import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("정보구조: 하단 내비는 홈·기록·계획·함께·게임 5개 상위 목적지만 둔다", () => {
  for (const key of ["home", "records", "plan", "together", "game"])
    assert.match(nav, new RegExp(`k: "${key}"`));
  assert.equal((nav.match(/\{ k: "/g) ?? []).length, 5);
});

test("정보구조: 기록과 계획은 하위 세그먼트로 기존 기능을 보존한다", () => {
  assert.match(page, /recordView/);
  assert.match(page, /planView/);
  // 기록 = 지난 우리: 로그 · 일기 · 사진 · 추억 [2026-09-24 IA 개편 — 추억은 함께 탭에서 옮겨 왔다]
  const seg = page.slice(page.indexOf('ariaLabel="기록 종류"'), page.indexOf('ariaLabel="기록 종류"') + 500);
  for (const v of ["log", "diary", "photos", "memories"]) assert.ok(seg.includes(`value: "${v}"`), `기록 세그먼트에 ${v} 가 없다`);
});
