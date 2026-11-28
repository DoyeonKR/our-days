/** 낚시 어종 목록 · 수조 목록 · 도감용 순수 검색/필터 헬퍼(240종 · 648형태 규모 대응) */
import { familyOf, GRADES } from "./aquarium.ts";
import { familyDepth, SPOTS } from "./fishing.ts";
import { MOON_FISH, TIMED_FISH } from "./fishingworld.ts";
import { EVENT_FISH } from "./eventfish.ts";
import { isPredator } from "./predation.ts";
import { habitOf } from "./aqua3d/habits.ts";

export type DepthFilter = "all" | 0 | 1 | 2;
export const DEPTH_FILTERS: readonly (readonly [DepthFilter, string])[] = [
  ["all", "전체"],
  [0, "표층"],
  [1, "중층"],
  [2, "바닥"],
];

export type AquaTraitFilter = "all" | "fresh" | "sea" | "walk" | "predator" | "rare";
export const AQUA_TRAIT_FILTERS: readonly (readonly [AquaTraitFilter, string])[] = [
  ["all", "전체"],
  ["fresh", "민물"],
  ["sea", "바다"],
  ["walk", "해변·바위"],
  ["predator", "사냥꾼"],
  ["rare", "희귀↑"],
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

/** 바다 낚시터(spot.water === "sea")에서 잡히는 계열 집합(풀 · 때 손님 · 보름달 · 이벤트 포함) */
const SEA_FAMILIES: ReadonlySet<string> = (() => {
  const seaSpots = new Set(SPOTS.filter((s) => s.water === "sea").map((s) => s.key));
  const out = new Set<string>();
  for (const s of SPOTS) if (seaSpots.has(s.key)) for (const [k] of s.pool) out.add(k);
  for (const t of TIMED_FISH) if (seaSpots.has(t.spot)) out.add(t.species);
  for (const m of MOON_FISH) if (seaSpots.has(m.spot)) out.add(m.species);
  for (const e of EVENT_FISH) if (seaSpots.has(e.spot)) out.add(e.species);
  return out;
})();

/** 수심 필터 일치 여부 (0=표층 · 1=중층 · 2=바닥) */
export function matchDepthFilter(familyKey: string, filter: DepthFilter): boolean {
  return filter === "all" || familyDepth(familyKey) === filter;
}

/** 종 이름(계열명 · 성체 이름 · 별명 등 추가 텍스트) 부분 검색 */
export function matchFishQuery(familyKey: string, query: string, extraText?: string): boolean {
  const q = norm(query);
  if (!q) return true;
  if (norm(familyKey).includes(q)) return true;
  if (extraText && norm(extraText).includes(q)) return true;
  const fam = familyOf(familyKey);
  if (!fam) return false;
  if (norm(fam.name).includes(q)) return true;
  return fam.finals.some((f) => norm(f.name).includes(q));
}

/** 종의 서식 수역(바다 여부) — 바다 낚시터 서식 계열 기준 */
export function isSeaFamily(familyKey: string): boolean {
  if (SEA_FAMILIES.has(familyKey)) return true;
  const fam = familyOf(familyKey);
  return fam ? fam.finals.some((f) => SEA_FAMILIES.has(f.key)) : false;
}

/** 수조/도감 특성 필터(민물 · 바다 · 해변/바위 휴식/보행 · 사냥꾼 · 희귀 이상) */
export function matchAquaTrait(familyKey: string, trait: AquaTraitFilter): boolean {
  if (trait === "all") return true;
  const fam = familyOf(familyKey);
  if (!fam) return false;
  if (trait === "fresh") return !isSeaFamily(familyKey);
  if (trait === "sea") return isSeaFamily(familyKey);
  if (trait === "walk") {
    const h = habitOf(familyKey) as { haul?: boolean; walk?: boolean; float?: boolean };
    return Boolean(h.walk || (h.haul && !h.float));
  }
  if (trait === "predator") return isPredator(familyKey);
  if (trait === "rare") {
    return fam.finals.some((f) => GRADES.indexOf(f.grade) >= 2);
  }
  return true;
}
