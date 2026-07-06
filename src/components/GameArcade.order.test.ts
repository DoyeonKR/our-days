// GameArcade.submitMatch 호출 순서 회귀 lock. [2026-07-06]
// 하루 캡이 3→1(한 판=3라운드)로 줄면서, 비가역 recordPlay(일일 캡 소모)를 커플 대결 쓰기보다
// 먼저 부르면 중간 transient 실패가 치명적이 됐다:
//  - 새 대결: createGameChallenge 실패 시 '대결 미생성인데 하루 소진'(자정까지 재시도 불가)
//  - 응답: submitGameAttempt/resolve 실패 시 상대가 영원히 '대기중' + 본인 캡으로 재시도 불가(데드락)
// 따라서 커플 대결 쓰기(create/attempt+resolve)를 먼저, recordPlay 를 마지막에 둔다.
// 이 순서가 뒤집히면 데드락 회귀 → 소스 순서로 lock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "GameArcade.tsx"), "utf8");

test("submitMatch: 비가역 recordPlay(일일 캡)는 커플 대결 쓰기보다 뒤에 온다 [회귀 lock]", () => {
  // 세 호출은 submitMatch 안에서만 등장하는 유일 문자열이라 파일 인덱스 비교로 순서 검증.
  const iRecord = src.indexOf("await recordPlay(");
  const iCreate = src.indexOf("await createGameChallenge(");
  const iAttempt = src.indexOf("await submitGameAttempt(");
  assert.ok(iCreate >= 0, "createGameChallenge 호출 존재");
  assert.ok(iAttempt >= 0, "submitGameAttempt 호출 존재");
  assert.ok(iRecord >= 0, "recordPlay 호출 존재");
  // recordPlay 는 반드시 두 커플 쓰기 뒤 — 먼저 부르면 캡 소진 후 대결 미생성/데드락 회귀
  assert.ok(iRecord > iCreate, "recordPlay 는 createGameChallenge 뒤여야(새 대결 캡-소진 회귀 차단)");
  assert.ok(iRecord > iAttempt, "recordPlay 는 submitGameAttempt 뒤여야(응답 데드락 회귀 차단)");
});
