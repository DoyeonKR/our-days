// 3라운드제 무결성 회귀 lock — 결과 화면의 라운드 재시도('다시') 금지. [2026-07-06]
// 사용자: "다시 버튼 없애줘 이거하면 3라운드가 사실상 아니잖아". 라운드 점수를 확인한 뒤 좋은
// 점수 나올 때까지 다시 굴릴 수 있으면 3라운드 평균이 무의미 → reaction/tap/timing 결과화면의
// setPhase("ready") 재시도 버튼 제거. 재도입되면 이 lock 이 깨진다.
// ⚠ reaction 의 폴스스타트 복구는 start()(대기 재시작)라 점수 재굴림이 아님 — 유지. 그건
//   setPhase("ready") 도 '다시</button>' 도 아니므로 이 단언에 안 걸린다("다시 시작"은 <span>).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const GAMES = ["ReactionGame.tsx", "TapRace.tsx", "TimingBar.tsx"];

test("게임 결과 화면에 라운드 재시도 없음 (3라운드 평균 무결성) [회귀 lock]", () => {
  for (const f of GAMES) {
    const src = readFileSync(join(here, f), "utf8");
    assert.ok(
      !src.includes('setPhase("ready")'),
      `${f}: 결과 화면 재시도(setPhase("ready")) 재도입 금지 — 라운드 재굴림 차단`,
    );
    assert.ok(
      !/>\s*다시\s*<\/button>/.test(src),
      `${f}: '다시' 재시도 버튼 재도입 금지 ('다시 시작' 폴스스타트 span 은 예외)`,
    );
  }
});
