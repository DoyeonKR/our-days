import { kstDate } from "./kst.ts";

/* 실시간 날씨 — 순수 로직. [사용자 요청 2026-08-11 "로그/일기장 잠시 숨기고 그 자리에
 * 날씨. 한국 기준 오늘 오전/오후 + 1주일 예보"]
 *
 * 데이터: Open-Meteo (open-meteo.com). 고른 이유가 이 앱의 제약 그 자체다 —
 *   · **API 키가 없다.** 정적 export 라 서버가 없어서, 키가 필요한 API(기상청 포함)는
 *     키를 번들에 박아 공개하는 수밖에 없다. 키가 없으면 그 문제도 없다.
 *   · **CORS 가 열려 있다**(access-control-allow-origin: *, 실측 2026-08-11).
 *     GitHub Pages 에서 브라우저가 직접 부른다. 프록시 없음.
 *   · 비상업 무료 한도(1만 호출/일)가 커플 둘이 쓰기엔 무한대다.
 *
 * ⚠ 섬(island.ts)의 '날씨'와 전혀 다른 것이다. 그쪽은 날짜 해시로 만드는 **게임 연출**
 *   (양쪽 클라이언트가 같아야 해서 실제 날씨를 못 쓴다), 여기는 **진짜 하늘**이다.
 *   이름을 realweather 로 하지 않은 건 화면 쪽 이름이 '날씨' 하나뿐이기 때문 —
 *   섬 쪽은 앞으로도 weatherOf(island) 를 쓰지 이 파일을 import 할 일이 없다.
 */

/* ── 위치 ─────────────────────────────────────────────────────── */

/** 고정 좌표 2곳(서울시청·인천시청). 위치 권한 팝업을 띄우지 않으려는 선택이다 —
 *  커플 앱에서 첫 화면부터 권한을 묻는 건 부담이고, 시 단위 예보는 이걸로 충분하다.
 *  [사용자 요청 2026-08-11 "인천쪽도 보여줬음 좋겠고"] — 두 사람의 생활권이 서울·인천.
 *  도시를 더하려면 여기 한 줄 + (필요하면 기본값 검사) 뿐이다. */
export const PLACES = {
  seoul: { name: "서울", lat: 37.5665, lon: 126.978 },
  incheon: { name: "인천", lat: 37.4563, lon: 126.7052 },
} as const;
export type PlaceKey = keyof typeof PLACES;
export const DEFAULT_PLACE: PlaceKey = "seoul";
/** 옛 이름 호환 — 홈 카드 등 '기본 도시' 만 필요한 자리가 쓴다. */
export const PLACE = PLACES[DEFAULT_PLACE];

export function forecastUrl(lat: number, lon: number): string {
  const q = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    "current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m",
    "hourly=temperature_2m,precipitation_probability,weather_code",
    "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    "timezone=Asia%2FSeoul", // 응답의 모든 시각이 KST 문자열로 온다 — 기기 시간대 무관
    "forecast_days=7",
  ].join("&");
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/* ── 응답 형태(쓰는 부분만) ────────────────────────────────────── */

export type Forecast = {
  current: {
    time: string; // "2026-08-11T09:15" (KST)
    temperature_2m: number;
    weather_code: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    weather_code: number[];
  };
  daily: {
    time: string[]; // "2026-08-11"
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
};

/* ── WMO 코드 → 아이콘·라벨 ────────────────────────────────────── */

export type WeatherIconKind =
  | "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "thunder";

export type WmoInfo = { label: string; icon: WeatherIconKind; severity: number };

/** severity — '오전에 해도 나고 비도 오면 뭘 보여줄까'의 답. 큰 쪽이 이긴다.
 *  나갈지 말지를 정하는 화면이라 **나쁜 날씨가 대표**여야 한다(맑음이 대표로 뜨고
 *  소나기가 숨으면 우산 없이 나간다). */
const WMO: Record<number, WmoInfo> = {
  0: { label: "맑음", icon: "sun", severity: 0 },
  1: { label: "대체로 맑음", icon: "sun", severity: 1 },
  2: { label: "구름 조금", icon: "partly", severity: 2 },
  3: { label: "흐림", icon: "cloud", severity: 3 },
  45: { label: "안개", icon: "fog", severity: 4 },
  48: { label: "짙은 안개", icon: "fog", severity: 4 },
  51: { label: "이슬비", icon: "drizzle", severity: 5 },
  53: { label: "이슬비", icon: "drizzle", severity: 5 },
  55: { label: "이슬비", icon: "drizzle", severity: 5 },
  56: { label: "어는 이슬비", icon: "drizzle", severity: 6 },
  57: { label: "어는 이슬비", icon: "drizzle", severity: 6 },
  61: { label: "비", icon: "rain", severity: 7 },
  63: { label: "비", icon: "rain", severity: 7 },
  65: { label: "강한 비", icon: "rain", severity: 8 },
  66: { label: "어는 비", icon: "rain", severity: 8 },
  67: { label: "어는 비", icon: "rain", severity: 8 },
  71: { label: "눈", icon: "snow", severity: 7 },
  73: { label: "눈", icon: "snow", severity: 7 },
  75: { label: "폭설", icon: "snow", severity: 8 },
  77: { label: "싸락눈", icon: "snow", severity: 7 },
  80: { label: "소나기", icon: "rain", severity: 7 },
  81: { label: "소나기", icon: "rain", severity: 7 },
  82: { label: "강한 소나기", icon: "rain", severity: 8 },
  85: { label: "소낙눈", icon: "snow", severity: 7 },
  86: { label: "소낙눈", icon: "snow", severity: 8 },
  95: { label: "뇌우", icon: "thunder", severity: 9 },
  96: { label: "뇌우·우박", icon: "thunder", severity: 10 },
  99: { label: "뇌우·우박", icon: "thunder", severity: 10 },
};

/** 모르는 코드는 흐림으로 — 안 뜨는 것보다 두루뭉술한 게 낫다. */
export function wmoInfo(code: number): WmoInfo {
  return WMO[code] ?? { label: "흐림", icon: "cloud", severity: 3 };
}

/* ── 시간 (전부 KST 문자열 연산 — 기기 시간대 무관) ──────────────── */

/** now(ms) → KST 날짜 "YYYY-MM-DD" — 단일 소스(lib/kst)의 별칭(기존 이름 유지). */
export const kstDateStr = kstDate;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 일간 행 라벨 — 오늘/내일/요일. dateStr 은 KST "YYYY-MM-DD". */
export function dayLabelOf(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "오늘";
  const d = Date.parse(dateStr + "T00:00:00Z");
  const t = Date.parse(todayStr + "T00:00:00Z");
  if (d - t === 86400_000) return "내일";
  return DOW[new Date(d).getUTCDay()];
}

/** 일간 행 날짜 — "8/13". [사용자 요청 2026-08-11 "일별에 날짜까지"]
 *  0 패딩 없이(08/13 은 표가 아니라 화면이다), 연도 없이(일주일 예보에 연도는 소음). */
export function mdLabelOf(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

/* ── 오전/오후 집계 ────────────────────────────────────────────── */

export type HalfDay = {
  label: string; // 대표 날씨 이름
  icon: WeatherIconKind;
  tMin: number;
  tMax: number;
  pop: number; // 강수확률 최대 (%)
};

/** 하루의 반(오전 0~11시 / 오후 12~23시)을 한 칸으로 접는다 — 기상청과 같은 나눔.
 *  대표 날씨는 severity 최대(나쁜 쪽), 강수확률은 최대, 기온은 범위.
 *  해당 시간대 데이터가 없으면 null(자정 직후 API 가 오늘 앞부분을 안 줄 때). */
export function halfDayOf(
  hourly: Forecast["hourly"],
  dateStr: string,
  half: "am" | "pm",
): HalfDay | null {
  const [lo, hi] = half === "am" ? [0, 11] : [12, 23];
  let tMin = Infinity;
  let tMax = -Infinity;
  let pop = 0;
  let worst: WmoInfo | null = null;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i];
    if (!t.startsWith(dateStr)) continue;
    const h = Number(t.slice(11, 13));
    if (h < lo || h > hi) continue;
    tMin = Math.min(tMin, hourly.temperature_2m[i]);
    tMax = Math.max(tMax, hourly.temperature_2m[i]);
    pop = Math.max(pop, hourly.precipitation_probability[i] ?? 0);
    const info = wmoInfo(hourly.weather_code[i]);
    if (!worst || info.severity > worst.severity) worst = info;
  }
  if (!worst) return null;
  return {
    label: worst.label,
    icon: worst.icon,
    tMin: Math.round(tMin),
    tMax: Math.round(tMax),
    pop: Math.round(pop),
  };
}

/* ── 캐시 신선도 ───────────────────────────────────────────────── */

/** 30분 — 예보 모델 갱신 주기(1시간)의 절반이면 '실시간'으로 충분하고,
 *  하루 종일 켜 놔도 호출 48번이라 무료 한도의 0.5% 다. */
export const WEATHER_TTL_MS = 30 * 60_000;

export function isFresh(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < WEATHER_TTL_MS && fetchedAt <= now;
}
