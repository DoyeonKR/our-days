// KST 날짜 유틸 — 단일 소스. [리뷰 2026-08-25 중복 통합]
//
// 같은 공식이 island/hunt/weather/moodPrompt 네 곳에 따로 살았다. 전부 KST 고정이
// 규칙(두 사람이 같은 '오늘'을 봐야 한다)이라 공식이 하나여야 하고, 한 곳이 기기
// 시간대로 이탈하면 조용히 날짜가 갈린다. 기존 모듈들은 이름을 유지한 채 재수출한다.

/** KST 기준 'YYYY-MM-DD'. */
export const kstDate = (now: number): string => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

/** KST 기준 며칠째인지(자정 경계 일련번호). */
export const kstDayOf = (now: number): number => Math.floor((now + 9 * 3600_000) / 86400_000);
