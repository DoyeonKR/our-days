"use client";

/* 펫 전역 미니 스토어 — 메인 캐릭터를 앱 곳곳(히어로·쿡찌르기·게임 카드·설정…)에서
   쓰기 위한 초경량 공유 상태. 네트워크 0: 섬을 이미 구독 중인 HomePet 이 발행(publish)하고,
   나머지는 useSyncExternalStore 로 구독만 한다. 섬 미생성/미연동이면 null. */

import { useSyncExternalStore } from "react";

export type PetGlobal = { form: string; name: string; mood: string } | null;

let _pet: PetGlobal = null;
const _subs = new Set<() => void>();

/** 섬 구독자(HomePet)가 최신 펫 정보를 발행. 값이 같으면 알리지 않는다. */
export function publishPet(next: PetGlobal): void {
  if (
    _pet === next ||
    (_pet && next && _pet.form === next.form && _pet.name === next.name && _pet.mood === next.mood)
  )
    return;
  _pet = next;
  _subs.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => _subs.delete(fn);
}
const getSnapshot = (): PetGlobal => _pet;
const getServerSnapshot = (): PetGlobal => null;

/** 어디서든 현재 펫(폼/이름/기분)을 구독 — 없으면 null(렌더 생략). */
export function useGlobalPet(): PetGlobal {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
