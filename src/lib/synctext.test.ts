// 쿡 섹션 헤더 부제 회귀 lock. [2026-08-09]
//
// 실제로 낸 버그다: 부제를 `waiting` 하나로 갈랐는데 `waiting = members.length < 2` 라
// **아직 커플이 없는 상태(unpaired)도 참**이었다. 그래서 "커플 만들기 / 코드로 합류"
// 카드 위에 "상대가 들어오면 여기서 이어져요"가 떴다 — 들어올 상대가 없는 화면인데.
// (그리고 세 번째 가지 "둘을 잇고 시작해요"는 도달 불가능한 죽은 코드였다.)
//
// 홈은 로그인 게이트 뒤라 프로브 라우트로 실화면을 띄우고서야 잡혔다. 눈으로 한 번
// 본 걸 여기 순수 함수로 옮겨 잠근다 — 다음엔 프로브 없이도 걸린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { type SyncPhase, subOf } from "./synctext.ts";

test("쿡 헤더 부제 — 미연결에 '상대가 들어오면'이 뜨지 않는다 [회귀 lock]", () => {
  // 아직 커플이 없다 = 둘을 잇는 게 할 일. waiting 이 참이어도 문구가 흔들리면 안 된다.
  const before: SyncPhase[] = ["loading", "notconfigured", "unpaired"];
  for (const p of before) {
    assert.equal(subOf(p, true), "일단 둘을 묶어야 한다", `${p} 부제`);
    assert.equal(subOf(p, false), "일단 둘을 묶어야 한다", `${p} 부제(waiting=false)`);
  }
  // 커플은 만들었지만 상대가 아직 안 들어왔다
  assert.equal(subOf("paired", true), "수감자 한 명 입소 대기 중");
  // 둘 다 있다 = 이제 말을 걸면 된다
  assert.equal(subOf("paired", false), "여기 적은 건 그대로 흡수된다");
});

test("쿡 헤더 부제 — 세 상태가 서로 다른 말을 한다(중복 금지)", () => {
  // 미연결 / 상대 대기 / 연결됨 셋이 같아지면 부제가 상태를 알려 주는 일을 멈춘 것이다.
  const three = [subOf("unpaired", true), subOf("paired", true), subOf("paired", false)];
  assert.equal(new Set(three).size, 3, `상태별 부제가 겹친다: ${three.join(" / ")}`);
});
