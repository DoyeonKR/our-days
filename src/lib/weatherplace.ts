"use client";

/* 홈 하늘이 따르는 날씨 도시. 도시를 고르던 날씨 탭은 2026-09-24 지웠다(몇 주째 숨겨져 있었다) —
 * 그때 고른 값(서울/인천)은 그대로 읽는다. 바꾸는 화면이 없으니 알림 구독도 필요 없다. */

import { useSyncExternalStore } from "react";
import { DEFAULT_PLACE, PLACES, type PlaceKey } from "./weather";

const KEY = "ourdays.weather.place";

function readStored(): PlaceKey {
  try {
    const v = localStorage.getItem(KEY);
    return v && v in PLACES ? (v as PlaceKey) : DEFAULT_PLACE;
  } catch {
    return DEFAULT_PLACE;
  }
}

let current: PlaceKey | null = null; // 지연 초기화 — SSR/정적 export 에선 localStorage 가 없다

function get(): PlaceKey {
  if (current === null) current = typeof localStorage === "undefined" ? DEFAULT_PLACE : readStored();
  return current;
}

const noSubscribe = () => () => {};

/** 서버 스냅샷은 기본 도시 — 정적 export 의 첫 그림과 하이드레이션이 어긋나지 않게. */
export function useWeatherPlace(): PlaceKey {
  return useSyncExternalStore(noSubscribe, get, () => DEFAULT_PLACE);
}
