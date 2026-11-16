/** 모험 커플 레이드 — 섬 행에 쓰는 길(화면 전용). 규칙 · 다시 돌리기는 advraid.ts(raidCommit — 순수, advraid.test).
 *  ⚠ 섬 엔진(island.ts)은 값으로 부르지 않는다 — 모험 탭에 섬 엔진을 싣지 않게(타입만). */
import { loadIsland, saveIsland } from "@/lib/couple";
import { newSaveMark } from "@/lib/islandsync";
import { raidCommit, type RaidDeps } from "@/lib/advraid";
import type { IslandState } from "@/lib/island";

export function raidDeps(coupleId: string): RaidDeps {
  return {
    load: () => loadIsland(coupleId),
    save: (version, state, mark) => saveIsland(coupleId, version, state, mark),
    mark: newSaveMark,
  };
}
export const raidAct = <R extends { ok: true; state: IslandState } | { ok: false; reason: string }>(coupleId: string, make: (st: IslandState) => R) => raidCommit(raidDeps(coupleId), make);
