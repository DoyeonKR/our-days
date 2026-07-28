// '내 행/상대 행' 분리 — 커플 2인 데이터의 공통 귀속 규칙. [2026-07-28]
// ⚠ 회귀 배경(사용자 리포트): 한 사람이 '미지근'을 고르면 상대가 다른 걸 골라도 그걸로 보임.
// 원인: uid 미확정(null) 상태에서 `rows.find(r => r.user_id !== uid)` 가 **아무 행이나**
// '상대'로 귀속 — 내 행이 상대 칸에 뜨고, 내 선택은 어디에도 하이라이트되지 않았다.
// 규칙: uid 를 모르면 어느 쪽도 귀속하지 않는다(오귀속 < 미표시). MoodLine/TodayLogCard/
// DailyQuestion 이 공유한다 — 개별 컴포넌트에서 raw find 부활 금지(회귀 lock).

export function splitByOwner<T>(
  rows: T[],
  myUid: string | null | undefined,
  uidOf: (r: T) => string,
): { mine: T | null; partner: T | null } {
  if (!myUid) return { mine: null, partner: null };
  return {
    mine: rows.find((r) => uidOf(r) === myUid) ?? null,
    partner: rows.find((r) => uidOf(r) !== myUid) ?? null,
  };
}
