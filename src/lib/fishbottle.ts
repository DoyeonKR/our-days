/** 유리병 편지 — 자리(2026-11-12). 다음 갈래가 채운다: 보내기(10글자) · 상대 낚시에 걸리기 · 열어 보기. */
import type { IslandState } from "./island.ts";
import type { FishCatch, FishResult } from "./fishing.ts";
import type { SpecialCtx } from "./fishplus.ts";

export function rollBottle(st: IslandState, ctx: SpecialCtx): FishCatch | null { void st; void ctx; return null; }
export function landBottle(st: IslandState, c: FishCatch, ctx: SpecialCtx): FishResult { void st; void c; void ctx; return { ok: false, reason: "아직 준비 중이에요" }; }
