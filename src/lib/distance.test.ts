import { test } from "node:test";
import assert from "node:assert/strict";
import { cityClock, cityCurrentWeatherUrl, cityDistanceKm, isDistanceCity } from "./distance.ts";

test("장거리: 도시 간 거리를 합리적 범위로 계산한다", () => {
  assert.equal(cityDistanceKm("seoul", "seoul"), 0);
  assert.ok(cityDistanceKm("seoul", "tokyo") > 1_000);
  assert.ok(cityDistanceKm("seoul", "new_york") > 10_000);
});

test("장거리: 같은 순간을 각 도시 현지 시각으로 표시한다", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.match(cityClock("Asia/Seoul", now).time, /09:00/);
  assert.match(cityClock("America/New_York", now).time, /19:00/);
});

test("장거리: 허용 도시만 받고 날씨 URL에 좌표와 current를 넣는다", () => {
  assert.equal(isDistanceCity("london"), true);
  assert.equal(isDistanceCity("unknown"), false);
  const url = cityCurrentWeatherUrl("sydney");
  assert.match(url, /latitude=-33\.8688/);
  assert.match(url, /current=temperature_2m%2Cweather_code/);
});
