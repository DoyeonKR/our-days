/* 게임 창 머리가 노치 밑으로 들어가지 않게 재는 계산 (2026-11-02) [사용자: "아이폰에서 게임 닫기버튼이 상단 노치에 걸려서 못누르고 있어"]
 * CSS 패딩(--game-safe-top)만으로는 부족했다 — 창 자체가 화면 위로 밀려 있으면 패딩을 얼마를 줘도 그만큼 같이 올라간다.
 * 그래서 화면(GameWindowGuard)이 실제 자리를 재고 모자란 만큼만 패딩을 더한다. 순수 함수라 기기 없이 시험한다. */

/** iOS 상태 표시줄 · 다이나믹 아일랜드 높이의 바닥값. globals.css 의 --game-safe-top 과 같은 값 */
export const IOS_SAFE_FLOOR = 59;
/** 머리 칸 안쪽 버튼 위에 남길 여유 */
const MARGIN = 6;

/** 창 위쪽(shellTop) · 보이는 영역 위쪽(viewportTop) · 머리 패딩으로 모자란 px. 스크롤과 무관하게 창 자리로만 잰다. */
export function headDeficit(shellTop: number, viewportTop: number, headPadding: number, floor: number): number {
  return Math.max(0, Math.ceil(floor + MARGIN - (shellTop - viewportTop) - headPadding));
}
