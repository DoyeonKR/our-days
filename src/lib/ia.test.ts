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
});
