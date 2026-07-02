// 목록 정렬 회귀 lock. [2026-07-02]
// 일기장: entry_date 만으로 정렬하면 같은 날짜(둘이 같은 날 씀) 안에서 DB 임의
// 순서 — 늦게 쓴 글이 작성자에 따라 아래로 깔린다(사용자 리포트). 반드시
// created_at 2차 정렬(작성 역순)이 있어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const couple = readFileSync(
  join(import.meta.dirname, "couple.ts"),
  "utf8",
);

test("일기 목록: entry_date 1차 + created_at(작성시각) 2차 역순 정렬", () => {
  const m = couple.match(
    /from\("deco_entries"\)[\s\S]{0,400}?\.order\("entry_date", \{ ascending: false \}\)[\s\S]{0,200}?\.order\("created_at", \{ ascending: false \}\)/,
  );
  assert.ok(
    m,
    "deco_entries 조회에 created_at 2차 정렬이 없음 — 같은 날짜 내 작성순 뒤섞임 재발",
  );
});
