// 오늘의 활동 리마인더 메시지 결정 — Edge(activity-nudge)의 서버 로직과 동일한 순수 함수.
// Deno(Edge)에서 import 못 해 본문을 복사하므로, 여기를 고치면
// supabase/functions/activity-nudge/index.ts 도 함께 갱신할 것. (quiet.ts 미러와 동일 패턴)

export type NudgeState = {
  didAm: boolean;
  didPm: boolean;
  didDiary: boolean;
};

export type NudgeMessage = { title: string; body: string };

/**
 * 시간대(evening)와 오늘 활동 상태로 보낼 리마인더를 결정. 보낼 게 없으면 null.
 * - 오전 점검(evening=false): 오전 로그가 없을 때만 (오전 슬롯이 아직 열려 있음).
 * - 저녁 점검(evening=true): 오후 로그 / 일기 (둘 다 자정 전까지 가능) 중 빠진 것.
 */
export function nudgeFor(evening: boolean, s: NudgeState): NudgeMessage | null {
  if (!evening) {
    if (s.didAm) return null;
    return { title: "☀️ 오전 브이로그 아직이에요", body: "오전이 지나기 전에 3초만 남겨봐요" };
  }
  const missPm = !s.didPm;
  const missDiary = !s.didDiary;
  if (!missPm && !missDiary) return null;
  if (missPm && missDiary)
    return { title: "🌙 오늘 오후 로그와 일기가 아직이에요", body: "자기 전에 오늘의 우리를 남겨봐요" };
  if (missPm) return { title: "🌙 오후 브이로그 아직이에요", body: "오늘 오후 3초, 남겨볼까요?" };
  return { title: "📔 오늘 일기가 아직이에요", body: "오늘 하루 어땠는지 적어봐요" };
}
