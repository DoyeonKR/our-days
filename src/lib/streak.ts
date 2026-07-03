// 연속 기록 스트릭 — '함께 남긴 기록(3초 브이로그·일기)'이 며칠 연속인지.
// 순수 함수(다른 모듈 import 없음 → CI node --test 에서 @/ 별칭 문제 회피, 회귀 lock 가능).

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type Streak = { count: number; activeToday: boolean };

/**
 * activeDays(ISO 'YYYY-MM-DD' 집합) 기준, todayIso 로 끝나는 연속 활동일 수.
 * - 오늘 활동이 있으면 오늘부터 역순으로 연속 카운트(activeToday=true).
 * - 오늘 활동이 없어도 어제가 활동일이면 스트릭은 '살아있음'(어제까지 카운트, activeToday=false).
 * - 오늘·어제 모두 없으면 스트릭 0(끊김).
 */
export function computeStreak(activeDays: Iterable<string>, todayIso: string): Streak {
  const set = activeDays instanceof Set ? activeDays : new Set(activeDays);
  const activeToday = set.has(todayIso);
  const cursor = parseIso(todayIso);
  if (!activeToday) {
    cursor.setDate(cursor.getDate() - 1); // 어제부터 확인
    if (!set.has(toIso(cursor))) return { count: 0, activeToday: false };
  }
  let count = 0;
  while (set.has(toIso(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { count, activeToday };
}

const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 1000];

/** 오늘 정확히 마일스톤에 도달했으면 그 값(축하용), 아니면 null. */
export function streakMilestone(count: number): number | null {
  return MILESTONES.includes(count) ? count : null;
}
