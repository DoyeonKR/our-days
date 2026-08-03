// 오늘이 특별한 날인가 — 홈 하늘에 얹는 '경사' 레이어.
//
// 왜: D-day 앱인데 **배경이 오늘이 무슨 날인지 전혀 몰랐다**. 하늘은 시각·계절·날씨만 따르고,
// 1000일이든 주년 당일이든 평범한 화요일과 똑같은 그림이었다. 데이터 비용은 0 이다 —
// nDays 와 다음 기념일 라벨은 이미 홈이 들고 있다. 희소하기 때문에 체감 다양성이 가장 크다.
//
// 순수 함수 + 결정적: 같은 입력이면 두 사람 화면이 같다. 렌더에서 몇 번을 불러도 같은 값.

/** 입자 종류는 pixelfx 의 기존 스프라이트 키를 재사용한다(새 아트 0). */
export type OccasionFx = "heart" | "spark" | "petal" | "snow";

export type Occasion = {
  id: string;
  /** 하늘에 뜨는 한 줄 — 짧게(긴 문장은 배경 위에서 안 읽힌다). */
  label: string;
  emoji: string;
  fx: OccasionFx;
  /** 리본/배너 색. */
  tint: string;
};

/** KST 기준 월/일. now 는 UTC ms. */
function kstMonthDay(now: number): [number, number] {
  const d = new Date(now + 9 * 3600_000);
  return [d.getUTCMonth() + 1, d.getUTCDate()];
}

/**
 * 오늘의 경사. 없으면 null(대부분의 날 — 그래야 있는 날이 특별하다).
 *
 * @param nDays     함께한 일수(오늘 포함, 1부터). 0 이하면 아직 안 셈.
 * @param ddayToday 오늘이 기념일 당일인가(표지판의 D-DAY 와 같은 판정).
 * @param now       UTC ms.
 *
 * 우선순위: 기념일 당일 > 100일 단위 > 절기. 겹치는 날엔 더 '우리 것'이 이긴다.
 */
export function occasionOf(nDays: number, ddayToday: boolean, now: number): Occasion | null {
  if (ddayToday) {
    return { id: "dday", label: "오늘이 그날이에요", emoji: "🎉", fx: "heart", tint: "#ff5f97" };
  }
  if (nDays > 0 && nDays % 100 === 0) {
    return { id: `d${nDays}`, label: `${nDays}일`, emoji: "🎊", fx: "heart", tint: "#ffb703" };
  }
  const [m, d] = kstMonthDay(now);
  if (m === 12 && (d === 24 || d === 25)) {
    return { id: "xmas", label: "메리 크리스마스", emoji: "🎄", fx: "snow", tint: "#e63946" };
  }
  if (m === 1 && d === 1) {
    return { id: "newyear", label: "새해 복 많이", emoji: "🎆", fx: "spark", tint: "#ffd166" };
  }
  return null;
}
