/* 홈 히어로 하늘 ← 실시간 날씨. [사용자 요청 2026-08-11 "날씨에따라 홈 화면 히어로
 * 배경이 달라졌으면 좋겠어 … 흐리면 흐리고 비오면 비오고 천둥이면 천둥치고 …
 * 실시간 날씨 반영 … 애니메이션 효과를 넣어서"]
 *
 * 원래 홈 하늘의 날씨는 섬의 **게임 날씨**(island.weatherOf — 날짜 해시, 양쪽
 * 클라이언트 동일)를 물려받았다. 그건 게임 밸런스의 축이라 실제 날씨로 바꿀 수 없다
 * (비 오면 밭이 젖는다 — 서울만 비 와도 부산 폰과 갈린다). 그래서 축을 가른다:
 *   · 섬 게임(밭·펫) = 게임 날씨 그대로
 *   · 홈 히어로 하늘 = **실제 하늘**(Open-Meteo), 데이터가 없으면 게임 날씨로 폴백
 *
 * 이 파일은 그 매핑의 단일 소스다 — 순수 함수라 sceneweather.test.ts 가 전부 잠근다.
 * ⚠ 하늘 **그라데이션(skyLook)은 건드리지 않는다.** 하늘색은 96조합 대비 lock
 * (worldui.test)과 headerDark 판정이 걸려 있는 축이다. 날씨는 전부 그 위에 **얹는다**
 * (구름 밀도·입자·번쩍임) — '오늘의 경사'가 축포를 얹는 것과 같은 문법이다.
 */

import type { Weather } from "./island.ts";
import type { WeatherIconKind } from "./weather.ts";

export type HeroWx = {
  /** 강수 입자 — drizzle 은 방울 수가 절반이다 */
  precip: "none" | "drizzle" | "rain";
  /** 진짜 눈 — 계절과 무관하다(3월에 눈 오면 눈이 온다) */
  snow: boolean;
  /** 구름 밀도 — 0 맑음 · 1 구름 많음 · 2 흐림(추가 구름 + 해가 흐려진다) */
  overcast: 0 | 1 | 2;
  fog: boolean;
  /** 번개 번쩍임(은은한 플래시 — 스크린 전체를 하얗게 때리지 않는다) */
  thunder: boolean;
  /** 구름 속도 배수(섬 날씨 wind 유지용) */
  windMul: 1 | 2;
  /** 무지개 — 실제 API 엔 없는 값이라 게임 날씨의 선물로 남긴다. 실제 하늘이
   *  맑을 때만(비 오는데 무지개가 뜨면 실시간이 아니라 장식이다). */
  rainbow: boolean;
};

const CLEAR: HeroWx = {
  precip: "none", snow: false, overcast: 0, fog: false, thunder: false, windMul: 1, rainbow: false,
};

/** 실제 날씨(있으면) + 게임 날씨(폴백/무지개) → 히어로 연출.
 *  @param winterSnow 게임 날씨 폴백에서 겨울 비=눈보라 규칙 유지용(look.snow) */
export function heroWxOf(real: WeatherIconKind | null, island: Weather, winterSnow: boolean): HeroWx {
  if (real === null) {
    // 오프라인/첫 로드 — 예전 동작 그대로(게임 날씨). 여기가 변하면 폴백이 아니라 회귀다.
    switch (island) {
      case "rain":
        return { ...CLEAR, precip: "rain", snow: winterSnow };
      case "wind":
        return { ...CLEAR, windMul: 2 };
      case "rainbow":
        return { ...CLEAR, rainbow: true };
      default:
        return CLEAR;
    }
  }
  const base: Record<WeatherIconKind, HeroWx> = {
    sun: CLEAR,
    partly: { ...CLEAR, overcast: 1 },
    cloud: { ...CLEAR, overcast: 2 },
    fog: { ...CLEAR, overcast: 2, fog: true },
    drizzle: { ...CLEAR, overcast: 1, precip: "drizzle" },
    rain: { ...CLEAR, overcast: 2, precip: "rain" },
    snow: { ...CLEAR, overcast: 1, snow: true },
    thunder: { ...CLEAR, overcast: 2, precip: "rain", thunder: true, windMul: 2 },
  };
  const wx = base[real];
  // 게임 무지개는 실제 하늘이 맑을 때만 얹는다(선물은 남기되 실시간을 거스르지 않게)
  if (island === "rainbow" && (real === "sun" || real === "partly")) return { ...wx, rainbow: true };
  return wx;
}
