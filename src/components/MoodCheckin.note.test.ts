// 오늘의 기분 '한마디(note)' 메인화면 표시 회귀 lock. [2026-07-07]
// 사용자: "오늘의 한마디가 길게쓰면 메인화면에서 말줄임표로 나오고 볼 수 없어". 노트를 truncate
// (한 줄 말줄임)로 렌더하면 긴 한마디가 잘려 안 보인다 → 전체 줄바꿈(whitespace-pre-wrap
// break-words)으로 표시. note 렌더에 truncate 가 다시 붙으면 이 lock 이 깨진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "MoodCheckin.tsx"), "utf8");

test("오늘의 기분 노트는 잘리지 않고 전체 표시(줄바꿈) [회귀 lock]", () => {
  // 내/상대 note 렌더가 전체 줄바꿈으로 보여야(긴 한마디도 볼 수 있게)
  const noteLines = src
    .split("\n")
    .filter((l) => l.includes(".note}") && l.includes("<p"));
  assert.ok(noteLines.length >= 2, "내/상대 note 렌더 2줄 존재");
  for (const l of noteLines) {
    assert.ok(
      !/\btruncate\b/.test(l),
      `note 렌더에 truncate(한 줄 말줄임) 금지 — 긴 한마디가 잘림: ${l.trim()}`,
    );
    assert.ok(
      /break-words/.test(l),
      `note 렌더는 break-words 로 전체 줄바꿈 표시해야: ${l.trim()}`,
    );
  }
});
