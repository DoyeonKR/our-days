/** 보물 · 유물 낚기 — 자리(2026-11-12). 다음 갈래가 채운다. */
import type { IslandState } from "./island.ts";
import type { FishCatch, FishResult } from "./fishing.ts";
import type { SpecialCtx } from "./fishplus.ts";

export function rollTreasure(st: IslandState, ctx: SpecialCtx): FishCatch | null { void st; void ctx; return null; }
export function landTreasure(st: IslandState, c: FishCatch, ctx: SpecialCtx): FishResult { void st; void c; void ctx; return { ok: false, reason: "아직 준비 중이에요" }; }
