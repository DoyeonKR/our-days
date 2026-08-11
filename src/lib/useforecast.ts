"use client";

/* 예보 가져오기 훅 — WeatherView(날씨 탭)와 HomeWeatherCard(홈 카드)가 공유한다.
 * 캐시 키가 하나라 두 화면이 떠 있어도 30분에 한 번만 부른다.
 * 실패하면 아까 본 것을 그대로 둔다 — PWA 오프라인에서 빈 화면보다 어제 하늘이 낫다. */

import { useCallback, useEffect, useState } from "react";
import { type Forecast, PLACES, type PlaceKey, WEATHER_TTL_MS, forecastUrl, isFresh } from "@/lib/weather";

export type CachedForecast = { fetchedAt: number; fc: Forecast };
// 도시별 캐시 — 키에 도시가 들어간다(서울 캐시로 인천을 그리면 그건 실측이 아니다)
const keyOf = (p: PlaceKey) => `ourdays.weather.v2:${p}`;

function readCache(place: PlaceKey): CachedForecast | null {
  try {
    const raw = localStorage.getItem(keyOf(place));
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedForecast;
    return c?.fc?.current && c?.fc?.daily ? c : null;
  } catch {
    return null;
  }
}

export function useForecast(place: PlaceKey = "seoul"): {
  cached: CachedForecast | null;
  busy: boolean;
  failed: boolean;
  reload: (force: boolean) => void;
} {
  const [cached, setCached] = useState<CachedForecast | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(
    (force: boolean) => {
      void (async () => {
        const have = readCache(place);
        if (have && !force && isFresh(have.fetchedAt, Date.now())) {
          setCached(have);
          return;
        }
        if (have) setCached(have); // 신선하지 않아도 일단 보여주고 갈아끼운다
        setBusy(true);
        try {
          const p = PLACES[place];
          const res = await fetch(forecastUrl(p.lat, p.lon));
          if (!res.ok) throw new Error(String(res.status));
          const fc = (await res.json()) as Forecast;
          const next = { fetchedAt: Date.now(), fc };
          setCached(next);
          setFailed(false);
          try {
            localStorage.setItem(keyOf(place), JSON.stringify(next));
          } catch {
            /* 저장 실패는 치명적이지 않다(프라이빗 모드 등) */
          }
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      })();
    },
    [place],
  );

  useEffect(() => {
    // 도시가 바뀌면 이전 도시 화면을 들고 있지 않는다 — 캐시가 있으면 그걸로 즉시 갈아탄다
    setCached(readCache(place));
    reload(false);
    const iv = setInterval(() => reload(false), WEATHER_TTL_MS);
    return () => clearInterval(iv);
  }, [reload, place]);

  return { cached, busy, failed, reload };
}
