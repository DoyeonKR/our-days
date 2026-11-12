/** 미끼 만들기(2026-11-12) [사용자: "꽝 쓰레기 · 작은 물고기 · 섬 작물을 섞어 특수 미끼(향 미끼 · 빛 미끼)를 만듭니다"]
 *
 *  저장 — 섬 맨 위 칸 s.fishPlus 의 두 칸(fishplus.ts 머리말: s.fishing 안에 두면 옛 앱이 한 번만 낚아도 지운다).
 *   · craft: 만든 미끼별 남은 횟수. 산 미끼(s.fishing.baits)와 섞지 않는다 — 옛 앱은 모르는 미끼 key 를 BAITS 에서 못 찾아 판이 깨진다.
 *   · craftJunk: 미끼에 쓴 쓰레기 장부(key 별 개수). 수집함(s.fishing.junk)은 줄이지 않는다 — 수집함 숫자 · '쓰레기 N종' 목표 ·
 *     수조 먹이 쿠폰(junkCoupons)이 모두 그 숫자를 읽어서, 줄이면 셋이 같이 흔들린다. 대신 쿠폰이 이 장부만큼 빼서 본다(한 쓰레기는 한 번만 쓴다).
 *  남는 쓰레기 = 건진 수 − 1(수집함에 남길 한 개) − 미끼에 쓴 수. 처음 건진 한 개는 늘 수집품으로 남는다.
 *
 *  미끼 1% 규칙(사용자 결정)을 건드리지 않는다 — 만든 미끼는 저마다 산 미끼 한 단계(tier)로 물고기를 뽑는다(등급 상한 · 확률이 그 미끼와 똑같다).
 *  다른 점은 등급과 무관한 덤 하나뿐이다(craftEffects): 향 = 입질이 빨리 · 빛 = 밤 · 깊은 곳에서 대물 · 반짝 = 유리병 · 보물이 잘 · 끈끈 = 덜 빠져나감.
 *  덤은 fishing.ts 의 작은 선택 인자로만 들어간다(기본값이면 예전과 같다) — fishing.ts 는 이 모듈을 값으로 부르지 않는다.
 *
 *  경제 — 만들기는 하트 · 작물 · 쓰레기 · 치어를 빨아들이는 곳이다. 재료의 바닥값(하트 + 작물 판매가 + 치어 보내 주기 값)이
 *  같은 단계 산 미끼로 같은 횟수를 던지는 값보다 늘 크거나 같다(fishcraft.test 가 잠근다). 덤이 그 차이를 메운다.
 *  ⚠ 섬 엔진(island.ts)은 타입만 부른다 — 낚시 창 조각에 섬 엔진이 실리지 않게. 작물 이름은 아래 표에 따로 두고 테스트가 섬 표와 맞춰 본다. */
import type { IslandState } from "./island.ts";
import { BAITS, JUNKS, castBlock, fishingOf, methodOf, type FishBait, type FishSpot, type FishingState, type GearResult, type MethodKey } from "./fishing.ts";
import { GRADES, aquaOf, familyOf, fishName, junkCoupons, releaseReward, stow, syncAqua, type AquaFish } from "./aquarium.ts";
import { fishDay } from "./fishinggoals.ts";
import { laterDay, type FishMoment } from "./fishingworld.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";
import { josa } from "./josa.ts";

export type CraftKey = "craft_scent" | "craft_glow" | "craft_shine" | "craft_sticky";
export type CraftBait = { key: CraftKey; name: string; tier: string; effect: string };
/** 만든 미끼 — tier 는 물고기를 뽑을 때 쓰는 산 미끼 단계(그 미끼와 등급 상한 · 확률이 같다) */
export const CRAFT_BAITS: readonly CraftBait[] = [
  { key: "craft_scent", name: "향 미끼", tier: "bait_shrimp", effect: "입질이 빨리 와요(기다림 ×0.7)" },
  { key: "craft_glow", name: "빛 미끼", tier: "bait_squid", effect: "밤 · 심해 방식 · 깊은 바다에서 대물이 잘 나와요" },
  { key: "craft_shine", name: "반짝 미끼", tier: "bait_shrimp", effect: "유리병 편지 · 보물이 두 배 잘 걸려요" },
  { key: "craft_sticky", name: "끈끈 미끼", tier: "bait_paste", effect: "수조에 담을 확률 +5%p(최대 95%)" },
];
export const craftBaitOf = (key: string | null | undefined) => CRAFT_BAITS.find((x) => x.key === key);
export const isCraftKey = (key: string | null | undefined): key is CraftKey => !!craftBaitOf(key);
/** 만든 미끼가 물고기를 뽑을 때 쓰는 산 미끼 */
export const craftTier = (c: Pick<CraftBait, "tier">): FishBait => BAITS.find((b) => b.key === c.tier) ?? BAITS[0];

/* ── 덤 ───────────────────────────────────────────── */

/** 향 미끼 — 입질까지 기다리는 시간 배율(간 보기도 같이 당겨진다) */
export const SCENT_WAIT = 0.7;
/** 빛 미끼 — 대물(트로피 크기) 뽑기 문턱에 더하는 값. 길이의 최댓값은 그대로다(1.3~1.7배) — 대물이 '잘' 나올 뿐 '더 크게' 나오진 않는다 */
export const GLOW_TROPHY = 0.08;
/** 빛 미끼가 듣는 깊은 바다 — 울릉도 앞바다(Lv.18)부터 */
export const GLOW_DEEP_LEVEL = 18;
/** 반짝 미끼 — 유리병 · 보물 걸릴 확률 배율(1 을 넘지 않게 자른다) */
export const SHINE_SPECIAL = 2;
/** 끈끈 미끼 — 포획 확률에 더하는 값(captureChance 의 5~95% 자르기 안에서 더한다) */
export const STICKY_CAPTURE = 0.05;

export type CraftFx = { wait: number; size: number; special: number; capture: number };
export const NO_CRAFT_FX: CraftFx = { wait: 1, size: 0, special: 1, capture: 0 };
/** 빛 미끼가 듣는 때 · 곳 — 밤 · 새벽, 심해 방식, 깊은 바다 */
export const glowActive = (ctx: { spot: Pick<FishSpot, "minLevel" | "water">; method: MethodKey; when?: FishMoment }) =>
  ctx.when?.time === "night" || ctx.when?.time === "dawn" || ctx.method === "deep" || (ctx.spot.water === "sea" && ctx.spot.minLevel >= GLOW_DEEP_LEVEL);
/** 이 미끼의 덤 — 만든 미끼가 아니면 아무것도 바꾸지 않는다. 등급 · 계열 뽑기에는 어떤 값도 들어가지 않는다 */
export function craftEffects(key: string | null | undefined, ctx: { spot: Pick<FishSpot, "minLevel" | "water">; method: MethodKey; when?: FishMoment }): CraftFx {
  switch (key) {
    case "craft_scent": return { ...NO_CRAFT_FX, wait: SCENT_WAIT };
    case "craft_glow": return { ...NO_CRAFT_FX, size: glowActive(ctx) ? GLOW_TROPHY : 0 };
    case "craft_shine": return { ...NO_CRAFT_FX, special: SHINE_SPECIAL };
    case "craft_sticky": return { ...NO_CRAFT_FX, capture: STICKY_CAPTURE };
    default: return NO_CRAFT_FX;
  }
}

/* ── 재료 ───────────────────────────────────────────── */

/** 미끼에 쓰는 섬 작물 — 이름 · 판매가는 island.ts CROPS 와 같아야 한다(fishcraft.test). 전설 작물은 안 쓴다(한 칸에 하나뿐인 작물을 미끼로 녹이면 아깝다) */
export const CRAFT_CROPS: Readonly<Record<string, { name: string; sell: number }>> = {
  strawberry: { name: "딸기", sell: 18 },
  tomato: { name: "토마토", sell: 28 },
  grape: { name: "포도", sell: 45 },
  corn: { name: "옥수수", sell: 38 },
  pumpkin: { name: "호박", sell: 60 },
  mushroom: { name: "버섯", sell: 22 },
  cabbage: { name: "양배추", sell: 32 },
};
/** 작물 묶음 — 계절마다 나는 작물이 달라서 한 가지로 묶으면 철이 아닐 때 못 만든다 */
export type CropNeed = { label: string; keys: readonly string[]; n: number };
export type CraftRecipe = { id: string; bait: CraftKey; uses: number; junk: number; crops?: CropNeed; fry?: number; coins: number };
const FRUIT: Omit<CropNeed, "n"> = { label: "과일(딸기 · 토마토 · 포도)", keys: ["strawberry", "tomato", "grape"] };
const GOLD: Omit<CropNeed, "n"> = { label: "옥수수 · 호박", keys: ["corn", "pumpkin"] };
const DEW: Omit<CropNeed, "n"> = { label: "버섯 · 양배추", keys: ["mushroom", "cabbage"] };
/** 만들기 — 위의 미끼일수록 재료가 많다. 하트는 끝까지 빨아들이는 몫(바닥값 ≥ 같은 단계 산 미끼 값) */
export const CRAFT_RECIPES: readonly CraftRecipe[] = [
  { id: "scent_fruit", bait: "craft_scent", uses: 10, junk: 2, crops: { ...FRUIT, n: 2 }, coins: 90 },
  { id: "scent_fry", bait: "craft_scent", uses: 10, junk: 1, fry: 1, coins: 110 },
  { id: "glow", bait: "craft_glow", uses: 10, junk: 3, crops: { ...GOLD, n: 1 }, coins: 150 },
  { id: "shine", bait: "craft_shine", uses: 6, junk: 2, fry: 1, crops: { ...DEW, n: 1 }, coins: 40 },
  { id: "sticky", bait: "craft_sticky", uses: 10, junk: 4, crops: { ...GOLD, n: 2 }, coins: 220 },
];
export const recipeOf = (id: string) => CRAFT_RECIPES.find((x) => x.id === id);
/** 작은 물고기로 칠 수 있는 치어 — 흔함 · 보통 계열의 치어(주인 · 처음부터 귀한 계열은 아니다) */
export const FRY_MAX_GRADE = 1;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const numBook = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (num(x) > 0) out[k] = num(x);
  return out;
};
/** 만든 미끼 남은 횟수 */
export const craftStock = (st: Pick<IslandState, "fishPlus">): Record<string, number> => numBook(fishPlusOf(st).craft);
export const craftLeft = (st: Pick<IslandState, "fishPlus">, key: string) => craftStock(st)[key] ?? 0;
/** 미끼에 쓴 쓰레기 장부 */
export const craftJunkSpent = (st: Pick<IslandState, "fishPlus">): Record<string, number> => numBook(fishPlusOf(st).craftJunk);
/** 남는 쓰레기 — key 별. 수집함에 하나는 남긴다 */
export function spareJunk(st: Pick<IslandState, "fishing" | "fishPlus">): Record<string, number> {
  const have = fishingOf(st).junk, spent = craftJunkSpent(st), out: Record<string, number> = {};
  for (const j of JUNKS) {
    const n = num(have[j.key]) - 1 - (spent[j.key] ?? 0);
    if (n > 0) out[j.key] = n;
  }
  return out;
}
export const spareJunkTotal = (st: Pick<IslandState, "fishing" | "fishPlus">) => Object.values(spareJunk(st)).reduce((n, v) => n + v, 0);
/** 지금 미끼에 쓸 수 있는 쓰레기 수 — 남는 쓰레기와 수조 먹이 쿠폰 중 적은 쪽. 쿠폰을 먹이로 이미 바꿨으면 그 쓰레기는 다 쓴 것이다(한 쓰레기는 한 번만) */
export const usableJunk = (st: IslandState) => Math.min(spareJunkTotal(st), junkCoupons(st, aquaOf(st)));
/** 쓸 쓰레기 고르기 — 가장 많이 남은 것부터(같으면 JUNKS 순서). 같은 상태 = 같은 결과라 두 기기가 갈리지 않는다 */
export function pickJunk(spare: Record<string, number>, n: number): Record<string, number> | null {
  const left = { ...spare }, take: Record<string, number> = {};
  const order = JUNKS.map((j) => j.key);
  for (let i = 0; i < n; i++) {
    let best: string | null = null;
    for (const k of order) if ((left[k] ?? 0) > 0 && (best === null || left[k] > left[best])) best = k;
    if (!best) return null;
    left[best]--;
    take[best] = (take[best] ?? 0) + 1;
  }
  return take;
}
/** 창고의 작물 수 */
const barnQty = (st: Pick<IslandState, "farm">, key: string) => num(st.farm?.barn?.[key]?.qty);
/** 쓸 작물 고르기 — 묶음 안에서 가장 많이 쌓인 것부터(같으면 싼 것부터 — 비싼 작물을 아낀다) */
export function pickCrops(st: Pick<IslandState, "farm">, need: CropNeed): Record<string, number> | null {
  const left: Record<string, number> = Object.fromEntries(need.keys.map((k) => [k, barnQty(st, k)]));
  const take: Record<string, number> = {};
  for (let i = 0; i < need.n; i++) {
    let best: string | null = null;
    for (const k of need.keys) {
      if (left[k] <= 0) continue;
      if (best === null || left[k] > left[best] || (left[k] === left[best] && CRAFT_CROPS[k].sell < CRAFT_CROPS[best].sell)) best = k;
    }
    if (!best) return null;
    left[best]--;
    take[best] = (take[best] ?? 0) + 1;
  }
  return take;
}
export const cropsHave = (st: Pick<IslandState, "farm">, need: CropNeed) => need.keys.reduce((n, k) => n + barnQty(st, k), 0);
/** 작은 물고기로 쓸 수 있는 치어 — 보내 주면 돌려받는 하트가 가장 적은 것부터 */
export function spareFry(fish: readonly AquaFish[]): AquaFish[] {
  return fish
    .filter((f) => f.stage === 0 && !f.crown && GRADES.indexOf(familyOf(f.family)?.finals[0].grade ?? "태초") <= FRY_MAX_GRADE)
    .sort((a, b) => releaseReward(a) - releaseReward(b) || a.id - b.id);
}

/* ── 만들기 ─────────────────────────────────────────── */

export type CraftNeedRow = { label: string; have: number; need: number };
/** 재료 한 줄씩 — 화면이 그대로 그린다(있는 수 · 필요한 수) */
export function craftNeeds(st: IslandState, r: CraftRecipe, now: number): CraftNeedRow[] {
  const rows: CraftNeedRow[] = [{ label: "남는 쓰레기", have: usableJunk(st), need: r.junk }];
  if (r.crops) rows.push({ label: r.crops.label, have: cropsHave(st, r.crops), need: r.crops.n });
  if (r.fry) rows.push({ label: "작은 물고기(흔함 · 보통 치어)", have: spareFry(syncAqua(st, now).a.fish).length, need: r.fry });
  rows.push({ label: "하트", have: st.coins, need: r.coins });
  return rows;
}
/** 못 만드는 이유 — 화면과 저장이 같은 판정을 쓴다 */
export function craftWhy(st: IslandState, recipeId: string, now: number): string | null {
  const r = recipeOf(recipeId);
  if (!r || !craftBaitOf(r.bait)) return "없는 만들기예요";
  const spare = usableJunk(st);
  if (spare < r.junk) return spareJunkTotal(st) >= r.junk ? "남는 쓰레기를 수조 먹이로 이미 바꿨어요 — 쓰레기를 더 건져 와요" : `남는 쓰레기가 ${r.junk - spare}개 모자라요 — 같은 쓰레기를 두 번 넘게 건지면 남아요`;
  if (r.crops) {
    const have = cropsHave(st, r.crops);
    if (have < r.crops.n) return `${r.crops.label} ${r.crops.n - have}개가 모자라요 — 섬 창고에 있는 작물을 써요`;
  }
  if (r.fry) {
    const n = spareFry(syncAqua(st, now).a.fish).length;
    if (n < r.fry) return "수조에 흔함 · 보통 치어가 없어요";
  }
  if (st.coins < r.coins) return `하트가 ${(r.coins - st.coins).toLocaleString()}개 모자라요`;
  return null;
}
export type CraftResult = { ok: true; state: IslandState; note: string } | { ok: false; reason: string };
/** 만든다 — 남는 쓰레기는 장부에, 작물은 창고에서, 치어는 수조에서, 하트는 지갑에서 빠지고 만든 미끼 횟수가 는다 */
export function craftBait(st0: IslandState, recipeId: string, now: number): CraftResult {
  const why = craftWhy(st0, recipeId, now);
  if (why) return { ok: false, reason: why };
  const r = recipeOf(recipeId)!, bait = craftBaitOf(r.bait)!;
  let st = st0;
  const used: string[] = [];
  // 치어 — 수조를 정산한 뒤 뺀다(stow 가 모르는 계열 · 옛 앱 칸을 그대로 되돌린다)
  if (r.fry) {
    const sync = syncAqua(st, now);
    const take = spareFry(sync.a.fish).slice(0, r.fry);
    const ids = new Set(take.map((f) => f.id));
    st = stow(sync.state, { ...sync.a, fish: sync.a.fish.filter((f) => !ids.has(f.id)) });
    used.push(...take.map((f) => fishName(f)));
  }
  // 작물 — 창고 칸의 별(★)은 그대로, 개수만
  if (r.crops) {
    const take = pickCrops(st, r.crops)!;
    const barn = { ...(st.farm.barn ?? {}) };
    for (const [k, n] of Object.entries(take)) {
      const b = barn[k];
      const left = (b?.qty ?? 0) - n;
      if (left > 0) barn[k] = { ...b, qty: left };
      else delete barn[k];
      used.push(`${CRAFT_CROPS[k].name} ${n}`);
    }
    st = { ...st, farm: { ...st.farm, barn } };
  }
  const junk = pickJunk(spareJunk(st), r.junk)!;
  const spent = craftJunkSpent(st);
  for (const [k, n] of Object.entries(junk)) spent[k] = (spent[k] ?? 0) + n;
  const stock = craftStock(st);
  st = withFishPlus({ ...st, coins: st.coins - r.coins }, { craft: { ...stock, [bait.key]: (stock[bait.key] ?? 0) + r.uses }, craftJunk: spent });
  return { ok: true, state: st, note: `${bait.name} ${r.uses}회를 만들었어요${used.length ? ` — ${used.join(" · ")}` : ""}` };
}

/* ── 던지기 ─────────────────────────────────────────── */

/** 못 던지는 이유 — 방식 레벨 · 이 낚시터에서 무는지는 그 단계 산 미끼와 같은 판정(castBlock), 횟수만 만든 미끼에서 센다 */
export function castBlockCraft(st: Pick<IslandState, "fishPlus">, f: Pick<FishingState, "level">, spot: FishSpot, method: MethodKey, key: string, today: string): string | null {
  const c = craftBaitOf(key);
  if (!c) return "미끼를 골라 주세요";
  const tier = craftTier(c);
  // 횟수는 따로 세므로 산 미끼 칸엔 넉넉히 넣어 둔다(오늘 = 지렁이 채운 날 — 공짜 지렁이 계산이 끼지 않게)
  const why = castBlock({ level: f.level, baits: { [tier.key]: Number.MAX_SAFE_INTEGER }, wormDay: today }, spot, method, tier.key, today);
  if (why) return why;
  const how = methodOf(method), have = craftLeft(st, c.key);
  if (have < how.baitCost) return have > 0 ? `${josa(how.name, "은/는")} 미끼가 ${how.baitCost}개 필요해요` : `${josa(c.name, "이/가")} 다 떨어졌어요`;
  return null;
}
/** 지금 쓸 만든 미끼 — 골랐고 이 낚시터 · 방식에 던질 수 있을 때만. 아니면 null(화면은 산 미끼로 넘어간다 — currentBait) */
export function craftInUse(st: IslandState, f: Pick<FishingState, "level">, spot: FishSpot, method: MethodKey, pick: string | null, today: string): CraftBait | null {
  const c = craftBaitOf(pick);
  return c && !castBlockCraft(st, f, spot, method, c.key, today) ? c : null;
}
/** 화면의 { shown, bait } 자리 — 만든 미끼는 늘 그 단계 산 미끼로 뽑는다(미끼 key 는 BAITS 안의 것만 화면 · 뽑기로 간다) */
export const craftAsBait = (c: CraftBait): { shown: FishBait; bait: FishBait } => ({ shown: craftTier(c), bait: craftTier(c) });

/** 던질 때 만든 미끼를 쓴다 — spendBait 와 같은 하루 기록(오늘 칸 · 최장 거리)을 남기고, 산 미끼 · 공짜 지렁이는 건드리지 않는다 */
export function spendCraft(st: IslandState, spot: FishSpot, method: MethodKey, key: string, today: string, castM = 0): GearResult {
  const f = fishingOf(st);
  const why = castBlockCraft(st, f, spot, method, key, today);
  if (why) return { ok: false, reason: why };
  const stock = craftStock(st);
  const left = (stock[key] ?? 0) - methodOf(method).baitCost;
  const next = { ...stock, [key]: left };
  if (left <= 0) delete next[key];
  const d = fishDay(f, today);
  const fished: IslandState = { ...st, fishing: { ...d, day: laterDay(d.day, today), bestCast: Math.max(f.bestCast, castM), dayCast: Math.max(d.dayCast, castM) } };
  return { ok: true, state: withFishPlus(fished, { craft: next }) };
}
