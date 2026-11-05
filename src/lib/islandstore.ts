"use client";

/* 공유 섬 저장소 — 커플(솔로)마다 구독 하나 · 캐시 한 행. 몸통은 lib/islandcache(순수 — islandcache.test).
 * 홈 펫 · 게임 허브 · 섬 · 합치기가 이것만 본다. 낚시 · 수조는 아직 자기 loadIsland/watchIsland 를 쓰지만
 * 그 저장 응답도 couple.ts 의 onIslandRow 로 여기 캐시에 들어온다(다른 화면이 다시 받지 않는다).
 * ⚠ 섬 엔진(island.ts)을 값으로 부르지 않는다 — 홈 첫 로드(firstload.test)에 실리면 안 된다. */

import { useCallback, useEffect, useState } from "react";
import { loadIsland, onIslandRow, watchIsland, type IslandRow } from "@/lib/couple";
import { createIslandCache, type IslandSnap } from "@/lib/islandcache";

const cache = createIslandCache<IslandRow>({ load: loadIsland, watch: watchIsland });
// 어디서 받았든 · 저장했든 캐시가 따라온다(버전이 더 클 때만)
onIslandRow((coupleId, row) => cache.adopt(coupleId, row));

export type IslandStoreSnap = IslandSnap<IslandRow>;
export const refreshIsland = cache.refresh;
export const islandSnapshot = cache.snapshot;
export const watchIslandStore = cache.watch;

/** 화면용 — 캐시된 섬 · 받았나 · 오류 · 다시 받기. */
export function useIslandStore(coupleId: string | null): IslandStoreSnap & { reload: () => Promise<IslandRow | null> } {
  const [snap, setSnap] = useState<IslandStoreSnap>(() => cache.snapshot(coupleId));
  useEffect(() => cache.watch(coupleId, setSnap), [coupleId]);
  const reload = useCallback(() => cache.refresh(coupleId), [coupleId]);
  return { ...snap, reload };
}
