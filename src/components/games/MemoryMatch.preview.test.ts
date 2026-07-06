// 기억력 프리뷰(시작 시 카드 공개) 회귀 lock. [2026-07-06]
// 사용자 요청으로 추가: "기억력 게임은 처음에 한번 카드 위치를 보여줘야". 계약 2가지가
// 깨지면 게임이 이상해지므로 소스로 lock:
//  (1) 프리뷰 중엔 탭 무시(flip 가드에 previewing) — 안 그러면 공개 상태에서 짝맞추기 시작됨.
//  (2) 점수 타이머(startRef)는 프리뷰 종료 콜백에서 시작 — 공개시간이 점수에 포함되면 안 됨(불공정).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MEMORY_PREVIEW_MS } from "../../lib/game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "MemoryMatch.tsx"), "utf8");

test("MemoryMatch: 프리뷰 중 탭 무시 + 점수 타이머는 프리뷰 종료 후 시작 [회귀 lock]", () => {
  assert.ok(MEMORY_PREVIEW_MS > 0, "프리뷰 공개 시간은 양수");
  // (1) flip 가드 첫 조건에 previewing — 프리뷰 중 탭 무시
  assert.match(src, /function flip\([^)]*\)\s*\{\s*if \(previewing/);
  // (2) startRef(점수 타이머) 대입이 setPreviewing(false) 와 같은 블록(프리뷰 종료 콜백)에 위치.
  //     → 공개시간은 점수에서 제외. 마운트 최상단에서 startRef 를 잡으면 이 거리 단언이 깨진다.
  const iStart = src.indexOf("startRef.current = performance.now()");
  const iPreviewOff = src.indexOf("setPreviewing(false)");
  assert.ok(iStart >= 0, "startRef 시작 지점 존재");
  assert.ok(iPreviewOff >= 0, "프리뷰 종료(setPreviewing(false)) 존재");
  assert.ok(
    Math.abs(iStart - iPreviewOff) < 120,
    "점수 타이머 시작은 프리뷰 종료와 같은 블록이어야(공개시간 점수 제외)",
  );
});
