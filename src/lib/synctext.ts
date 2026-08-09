/** 쿡(우편함) 섹션의 상태 문구 — 순수. [2026-08-09]
 *
 * 컴포넌트 안에 두면 테스트가 못 읽는다(CI 의 `node --test` 는 타입만 벗겨내서 JSX 를
 * 못 판다). 화면 문구는 조건 분기가 붙는 순간 로직이라, 로직은 여기 두고 잠근다.
 */

export type SyncPhase = "loading" | "notconfigured" | "unpaired" | "paired";

/** 헤더 부제 — 지금 이 자리에서 뭘 할 수 있는지 한 줄로.
 *
 * ⚠ `waiting` 만으로 갈라선 안 된다. `waiting = members.length < 2` 라 **아직 커플이
 * 없는 상태도 참**이라, '커플 만들기 / 코드로 합류' 카드 위에 "상대가 들어오면
 * 여기서 이어져요"가 떴다 — 들어올 상대가 아직 없는 화면이다. 상태는 `phase` 가 먼저다.
 */
export function subOf(phase: SyncPhase, waiting: boolean): string {
  if (phase !== "paired") return "일단 둘을 묶어야 한다";
  return waiting ? "수감자 한 명 입소 대기 중" : "여기 적은 건 그대로 흡수된다";
}
