"use client";

/* 선택한 날씨 도시 — 날씨 탭과 홈 카드가 **같은 도시**를 봐야 한다.
 * localStorage 만으로는 같은 세션 안에서 서로 못 듣는다(storage 이벤트는 다른 탭에서만
 * 온다) → petglobal 과 같은 초소형 외부 스토어. 값이 바뀔 때만 알린다. */

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
const subs = new Set<() => void>();

function get(): PlaceKey {
  if (current === null) current = typeof localStorage === "undefined" ? DEFAULT_PLACE : readStored();
  return current;
}

export function setWeatherPlace(next: PlaceKey): void {
  if (next === get()) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* 저장 실패해도 세션 안에서는 동작한다 */
  }
  subs.forEach((fn) => fn());
}

export function useWeatherPlace(): PlaceKey {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    get,
    () => DEFAULT_PLACE,
  );
}
