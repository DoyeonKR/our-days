// 날씨 순수 로직 회귀 lock. [2026-08-11 날씨 탭]
//
// 화면(WeatherView)은 가져오고 그릴 뿐이고, 판단은 전부 여기 함수들이 한다 —
// 오전/오후 접기, 대표 날씨 고르기, KST 날짜, 캐시 신선도. 그래서 여기를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Forecast,
  PLACE,
  WEATHER_TTL_MS,
  dayLabelOf,
  forecastUrl,
  halfDayOf,
  isFresh,
  kstDateStr,
  wmoInfo,
} from "./weather.ts";

test("WMO 코드 — 주요 코드가 제 아이콘으로 간다", () => {
  assert.equal(wmoInfo(0).icon, "sun");
  assert.equal(wmoInfo(2).icon, "partly");
  assert.equal(wmoInfo(3).icon, "cloud");
  assert.equal(wmoInfo(45).icon, "fog");
  assert.equal(wmoInfo(55).icon, "drizzle");
  assert.equal(wmoInfo(63).icon, "rain");
  assert.equal(wmoInfo(80).icon, "rain"); // 소나기도 비 계열
  assert.equal(wmoInfo(71).icon, "snow");
  assert.equal(wmoInfo(95).icon, "thunder");
  // 모르는 코드는 흐림 폴백 — 안 뜨는 것보다 두루뭉술한 게 낫다
  assert.equal(wmoInfo(42).icon, "cloud");
});

test("WMO 심각도 — 나쁜 날씨가 이긴다(맑음 < 흐림 < 비 < 뇌우)", () => {
  assert.ok(wmoInfo(0).severity < wmoInfo(3).severity);
  assert.ok(wmoInfo(3).severity < wmoInfo(63).severity);
  assert.ok(wmoInfo(63).severity < wmoInfo(95).severity);
  assert.ok(wmoInfo(95).severity < wmoInfo(96).severity, "우박이 최상위");
});

/** 시험용 hourly — 오늘 0~23시, 기온은 시각과 같고 9시만 비(63)·강수 80%. */
function fakeHourly(date: string): Forecast["hourly"] {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const precipitation_probability: (number | null)[] = [];
  const weather_code: number[] = [];
  for (let h = 0; h < 24; h++) {
    time.push(`${date}T${String(h).padStart(2, "0")}:00`);
    temperature_2m.push(h);
    precipitation_probability.push(h === 9 ? 80 : h === 15 ? null : 10);
    weather_code.push(h === 9 ? 63 : 1);
  }
  return { time, temperature_2m, precipitation_probability, weather_code };
}

test("오전/오후 접기 — 대표는 severity 최대, 강수는 최대, 기온은 범위 [회귀 lock]", () => {
  const H = fakeHourly("2026-08-11");
  const am = halfDayOf(H, "2026-08-11", "am")!;
  // 9시에 비가 왔으면 오전 대표는 '비'다 — 맑음이 대표로 뜨면 우산 없이 나간다
  assert.equal(am.icon, "rain");
  assert.equal(am.pop, 80);
  assert.equal(am.tMin, 0);
  assert.equal(am.tMax, 11);

  const pm = halfDayOf(H, "2026-08-11", "pm")!;
  assert.equal(pm.icon, "sun"); // 오후엔 비가 없다(9시는 오전)
  assert.equal(pm.pop, 10); // null 시각(15시)은 0 취급 — 최대에 영향 없음
  assert.equal(pm.tMin, 12);
  assert.equal(pm.tMax, 23);

  // 다른 날짜를 물으면 null — 있지도 않은 반나절을 지어내지 않는다
  assert.equal(halfDayOf(H, "2026-08-12", "am"), null);
});

test("KST 날짜 — 기기 시간대와 무관하게 +9h [회귀 lock]", () => {
  // 2026-08-10 23:30 UTC = 2026-08-11 08:30 KST → 날짜가 넘어가 있어야 한다
  assert.equal(kstDateStr(Date.UTC(2026, 7, 10, 23, 30)), "2026-08-11");
  assert.equal(kstDateStr(Date.UTC(2026, 7, 11, 14, 59)), "2026-08-11");
  assert.equal(kstDateStr(Date.UTC(2026, 7, 11, 15, 0)), "2026-08-12");
});

test("일간 라벨 — 오늘/내일/요일", () => {
  const today = "2026-08-11"; // 화요일
  assert.equal(dayLabelOf("2026-08-11", today), "오늘");
  assert.equal(dayLabelOf("2026-08-12", today), "내일");
  assert.equal(dayLabelOf("2026-08-13", today), "목");
  assert.equal(dayLabelOf("2026-08-15", today), "토");
  assert.equal(dayLabelOf("2026-08-16", today), "일");
});

test("캐시 신선도 — TTL 경계", () => {
  const t = 1_000_000_000;
  assert.ok(isFresh(t, t + WEATHER_TTL_MS - 1));
  assert.ok(!isFresh(t, t + WEATHER_TTL_MS));
  assert.ok(!isFresh(t + 60_000, t), "미래에 찍힌 캐시는 신선하지 않다(시계 역행 방어)");
});

test("요청 URL — KST 시간대·서울 좌표·7일이 박혀 있다", () => {
  const u = forecastUrl(PLACE.lat, PLACE.lon);
  assert.ok(u.includes("timezone=Asia%2FSeoul"), "응답이 KST 로 와야 집계가 성립한다");
  assert.ok(u.includes("latitude=37.5665"));
  assert.ok(u.includes("forecast_days=7"), "1주일 예보");
  assert.ok(u.includes("precipitation_probability"), "강수확률이 이 화면의 존재 이유");
  assert.ok(u.startsWith("https://api.open-meteo.com/"), "키 없는 공개 API — 프록시 없음");
});
