"use client";

/* 아트 스타일 설정 — 픽셀(기본) ↔ 일러스트.
 *
 * 왜 전역 스토어인가: 사용자가 섬에서 스타일을 바꾸면 **홈·쿡찌르기·게임 카드에 있는 같은 펫도
 * 즉시 같이 바뀌어야** 한다. 각 컴포넌트가 마운트 때 localStorage 를 읽기만 하면, 섬 오버레이를
 * 닫아도 뒤에 있던 홈은 예전 스타일 그대로 남는다(리마운트가 없으므로).
 *
 * 기본값 = 픽셀. 사용자 요청("모든걸 픽셀화 기본으로") 이 계약이며 pixelpref.test.ts 가 고정한다. */

import { useSyncExternalStore } from "react";

const KEY = "ourdays:pixelPet";

/** 저장값 → 불리언. 저장된 적 없으면 픽셀(true). */
export function parsePixelPref(raw: string | null): boolean {
  return raw == null ? true : raw === "1";
}

let _pixel = true;
let _loaded = false;
const _subs = new Set<() => void>();

function load(): void {
  if (_loaded) return;
  _loaded = true;
  try {
    _pixel = parsePixelPref(localStorage.getItem(KEY));
  } catch {
    /* 프라이빗 모드 등 — 기본값 유지 */
  }
}

export function setPixelArt(next: boolean): void {
  load();
  if (_pixel === next) return;
  _pixel = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* noop */
  }
  _subs.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => {
    _subs.delete(fn);
  };
}

function snapshot(): boolean {
  load();
  return _pixel;
}

/** 서버 스냅샷은 항상 기본값 — 정적 export 라 하이드레이션 불일치를 만들지 않는다. */
const serverSnapshot = () => true;

export function usePixelArt(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
