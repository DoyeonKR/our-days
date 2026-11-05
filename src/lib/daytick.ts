// '오늘' 키 계산(순수) — useDayTick 이 쓴다. 테스트가 바로 불러 본다(react · 별칭 import 없음).
import { kstDate } from "./kst.ts";

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
// 자정 직후 경계 오차(타이머 조기 발화 · 기기 시계 흔들림) 여유
const SLACK_MS = 5_000;

/** KST 기준 '오늘'(YYYY-MM-DD). 저장 날짜(kstDate)와 같은 공식이다. */
export const kstDayKey = (now: number): string => kstDate(now);

/** 기기(로컬) 기준 '오늘'(YYYY-MM-DD) — dday.ts 의 toISODate 와 같은 결과. */
export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 다음 KST 자정 + 5초까지 남은 ms. KST 는 서머타임이 없어 ms 산술이 안전하다. */
export function msUntilNextKstMidnight(now: number): number {
  const into = (((now + KST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return Math.max(1000, DAY_MS - into + SLACK_MS);
}

/** 다음 기기(로컬) 자정 + 5초까지 남은 ms. 서머타임이 있는 지역이라 달력 필드로 계산한다. */
export function msUntilNextLocalMidnight(now: number): number {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, SLACK_MS / 1000);
  return Math.max(1000, next.getTime() - now);
}
