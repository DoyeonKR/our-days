"use client";

/* 쿡찌르기 전역 미니 스토어 — petglobal 과 같은 패턴. 네트워크 0.
 *
 * 왜 필요한가: 홈 월드의 우편함이 '쿡찌르기'라는 글자만 들고 있어서 탭할 이유가 없었다.
 * 쿡 데이터는 CoupleSync 가 **이미 로드+구독** 중인데(recentPokes + subscribePokes),
 * 컴포넌트 내부 state 라 형제인 HomeWorld 가 못 본다. 발행/구독으로만 잇는다 —
 * 새 쿼리도, 새 실시간 채널도 만들지 않는다(무료 티어라 채널 수가 곧 비용이다).
 */

import { useSyncExternalStore } from "react";

/** 로컬 기준선 키 — 발행부(CoupleSync)와 소비부(홈 우편함 탭)가 반드시 같은 값을 써야 한다. */
export const POKE_SEEN_KEY = "poke";

export type PokeGlobal = {
  /** 내 기준선 이후에 상대가 보낸 쿡 개수(로컬 판정 — lib/seen.ts 참고). */
  unread: number;
  /** 상대가 마지막으로 보낸 쿡 시각(ms). 없으면 null. */
  lastAt: number | null;
};

const EMPTY: PokeGlobal = { unread: 0, lastAt: null };
let _poke: PokeGlobal = EMPTY;
const _subs = new Set<() => void>();

/** CoupleSync 가 발행. 값이 같으면 알리지 않는다(불필요한 리렌더 차단). */
export function publishPoke(next: PokeGlobal): void {
  if (_poke.unread === next.unread && _poke.lastAt === next.lastAt) return;
  _poke = next;
  _subs.forEach((fn) => fn());
}

/** 사용자가 우편함을 열었다 — 개수만 0 으로. lastAt 은 사실이므로 유지한다. */
export function clearPokeUnread(): void {
  if (_poke.unread === 0) return;
  publishPoke({ ..._poke, unread: 0 });
}

function subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => _subs.delete(fn);
}
const getSnapshot = (): PokeGlobal => _poke;
// 서버 스냅샷은 **고정 객체**여야 한다 — 매번 새 객체를 만들면 하이드레이션이 무한 루프에 빠진다.
const getServerSnapshot = (): PokeGlobal => EMPTY;

/** 어디서든 '안 본 쿡' 상태를 구독. */
export function useGlobalPoke(): PokeGlobal {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
