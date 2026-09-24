// 날씨 순수 로직 회귀 lock. [2026-08-11 날씨 탭]
//
// 날씨 탭은 2026-09-24 지웠다. 지금 이 모듈을 쓰는 건 홈 하늘(HomeWorld — 실제 날씨를 하늘에 그린다)이다 —
// 대표 날씨 고르기, 캐시 신선도, 요청 URL. 그래서 여기를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLACE,
  PLACE,
  PLACES,
  WEATHER_TTL_MS,
  forecastUrl,
  isFresh,
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

test("도시 — 서울·인천 둘 다 있고 좌표가 실제 위치다 [사용자 요청 2026-08-11]", () => {
  assert.equal(PLACES.seoul.name, "서울");
  assert.equal(PLACES.incheon.name, "인천");
  // 인천시청 근방(±0.1도) — 좌표를 잘못 적으면 이름만 인천이고 하늘은 딴 동네다
  assert.ok(Math.abs(PLACES.incheon.lat - 37.4563) < 0.1, `인천 위도 ${PLACES.incheon.lat}`);
  assert.ok(Math.abs(PLACES.incheon.lon - 126.7052) < 0.1, `인천 경도 ${PLACES.incheon.lon}`);
  assert.equal(PLACE, PLACES[DEFAULT_PLACE], "옛 이름 PLACE 는 기본 도시를 가리킨다(호환)");
});
