// KST 날짜 유틸 — 단일 소스. [리뷰 2026-08-25 중복 통합]
//
// 같은 공식이 island/hunt/weather/moodPrompt 네 곳에 따로 살았다. 전부 KST 고정이
// 규칙(두 사람이 같은 '오늘'을 봐야 한다)이라 공식이 하나여야 하고, 한 곳이 기기
// 시간대로 이탈하면 조용히 날짜가 갈린다. 기존 모듈들은 이름을 유지한 채 재수출한다.

/** KST 기준 'YYYY-MM-DD'. */
export const kstDate = (now: number): string => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

export type Season = "spring" | "summer" | "autumn" | "winter";

/** 실제 달(now, KST)로 계절 판정. 섬 엔진(lib/island)이 재수출한다.
 *  ⚠ 여기 둔 이유 — 홈(히어로 · 섹션 머리)이 계절 하나 때문에 섬 엔진을 불러오면 엔진 전체가 첫 로드에
 *  딸려 온다(번들러는 표를 만드는 최상위 코드를 못 버린다). 2026-09-25 에 압축 68KB 를 이렇게 덜었다. */
export function seasonOf(now: number): Season {
  const m = new Date(now + 9 * 3_600_000).getUTCMonth(); // 0-11
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

/** KST 기준 며칠째인지(자정 경계 일련번호). */
export const kstDayOf = (now: number): number => Math.floor((now + 9 * 3600_000) / 86400_000);
