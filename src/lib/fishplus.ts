/** 낚시 업그레이드의 저장 자리(2026-11-12) [사용자: "업그레이드에 초점을 둬 낚시관련 업그레이드 할것들 확인해봐" → 열 가지 "다 진행해"]
 *
 *  ⚠ 새 칸은 s.fishing 이 아니라 섬 맨 위 칸 s.fishPlus 에 둔다. fishingOf 는 아는 칸만 다시 만들어 저장하므로(옛 앱도 같다)
 *  s.fishing 안에 둔 새 칸은 상대가 옛 앱으로 한 번만 낚아도 지워진다 — 하트로 산 꾸미기 · 만든 미끼 · 편지가 사라지면 안 된다.
 *  섬 복제(clone)와 모든 화면의 쓰기는 맨 위 칸을 ...st 로 그대로 흘린다(수조의 aquaPlus 와 같은 이유).
 *  읽기는 fishPlusOf(모르는 칸도 그대로 둔다), 쓰기는 withFishPlus(넘긴 칸만 덮는다) — 갈래마다 자기 칸 이름을 쓴다
 *  (bottles · mastery · treasure · craft · looks · …). 화면 전용 기기 값(본 편지 번호 등)은 여기 두지 않는다.
 *
 *  특별한 것 낚기 — 유리병 편지 · 보물은 물고기 뽑기와 따로 뽑는다(rollSpecial — 물고기 뽑기 순서가 그대로다). 끌어올리면 landSpecial 이
 *  처리한다: 꽝 수집함에 안 들어가고, 피버가 안 끼고, 순위판(submit_fish_catch)에 안 오른다. */
import type { IslandState } from "./island.ts";
import type { FishCatch, FishResult, FishSpot, MethodKey } from "./fishing.ts";
import { landBottle, rollBottle } from "./fishbottle.ts";
import { landTreasure, rollTreasure } from "./fishtreasure.ts";

export type FishPlus = Record<string, unknown>;
export const fishPlusOf = (st: Pick<IslandState, "fishPlus">): FishPlus => ({ ...(st.fishPlus ?? {}) });
export function withFishPlus(st: IslandState, patch: FishPlus): IslandState {
  return { ...st, fishPlus: { ...(st.fishPlus ?? {}), ...patch } };
}

export type SpecialKind = "bottle" | "treasure";
/** 끌어올린 특별한 것의 결과 카드 — 화면이 그대로 그린다 */
export type SpecialCard = { kind: SpecialKind; title: string; body: string; note?: string; from?: string; art?: string };
/** 뽑기 · 끌어올리기에 넘기는 것 */
/** cast — 이번 판의 던지기 점수(0~1, castScore). 보물 · 유물은 멀리 던질수록 조금 더 잘 걸린다. 옵셔널 = 끌어올릴 때 · 옛 호출은 없다 */
export type SpecialCtx = { who: string; couple: boolean; spot: FishSpot; method: MethodKey; seed: number; now: number; today: string; cast?: number };
/** 특별한 것을 낚을 거리로 — 힘겨루기는 가장 쉬운 물고기처럼(그림자는 기본 모양) */
export const specialCatch = (kind: SpecialKind, id: string, title: string): FishCatch => ({ family: "special", stage: 0, grade: "흔함", difficulty: 1, special: { kind, id, title } });

/** 던질 때 — 물고기 대신 특별한 것이 걸리나. 주인전 · 특별한 것이 없으면 null */
export function rollSpecial(st: IslandState, ctx: SpecialCtx): FishCatch | null {
  return rollBottle(st, ctx) ?? rollTreasure(st, ctx);
}
/** 끌어올렸다 — 저장을 바꾸고 결과 카드를 돌려준다. 같은 것을 두 번 끌어올려도(다시 보내기) 한 번만 친다(id 로) */
export function landSpecial(st: IslandState, c: FishCatch, ctx: SpecialCtx): FishResult {
  if (!c.special) return { ok: false, reason: "특별한 것이 아니에요" };
  return c.special.kind === "bottle" ? landBottle(st, c, ctx) : landTreasure(st, c, ctx);
}
