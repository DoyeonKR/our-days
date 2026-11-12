/** 보물 · 유물 낚기(2026-11-12) [사용자: "드물게 보물상자 · 난파선 유물이 걸리고, 모으면 수조 장식으로 바뀝니다"]
 *
 *  저장은 섬 맨 위 칸 s.fishPlus 의 세 칸 — relics(조각 → 건진 수) · relicSets(다 모은 세트) · treasureLog(끌어올린 보물 id).
 *  s.fishing 에 두면 상대가 옛 앱으로 한 번만 낚아도 fishingOf 가 지운다(fishplus.ts 머리말).
 *
 *  · 걸리는 확률 — 유물 1.2% · 보물상자 0.4%(던질 때마다, 물고기 대신). 바다는 1.5배(유물이 가라앉는 곳), 심해 낚시는 1.5배(바닥까지 내린다),
 *    멀리 던질수록 조금 더(0.75~1.25배 — 던지기 솜씨가 보상받게). 상한 유물 3% · 상자 1%. 뜰채는 0 — 수면 가까이 떠오른 그림자를 건지는
 *    방식이라 바닥에 가라앉은 것이 닿지 않는다(그리고 뜰채는 '고르는' 방식이라 특별한 것이 끼면 고를 거리가 흐려진다).
 *    주인전에는 화면이 rollSpecial 을 아예 부르지 않는다(FishingGame — fishplus.test 가 그 줄을 잠근다).
 *  · 특별한 것은 그 판의 물고기를 대신한다 — 미끼는 이미 썼으니 그 판의 물고기 값(30~40 하트)을 잃는 셈이다. 그래서 겹친 조각을 하트로
 *    바꿔 주는 값(8~15)은 물고기보다 작게 둔다: 유물로 하트를 버는 길이 되면 안 된다. 하트로 버는 몫은 보물상자 하나뿐이고 그것도 드물다.
 *  · 세트를 다 모으면 수조 장식 하나 — 사기와 같은 길(aquarium.grantDecor: 정산 → 보관함 +1)로 값만 안 받는다. 세트마다 한 번(relicSets).
 *  · 조각은 못 모은 것이 3배 잘 나온다(수조의 '못 만난 형태가 먼저'와 같은 이유) — 똑같이 뽑으면 마지막 조각 하나에 수백 판이 든다.
 *  · 순수 엔진: 시각(now) · 주사위(seed)는 호출자가 넘긴다. 끌어올릴 때의 ctx.seed 는 던질 때와 다르므로(FishingGame 이 그때 시각으로 다시
 *    만든다) 무엇이 나왔는지는 던질 때 정해 special.id 에 담고, 상자 안의 것은 id 의 해시로 정한다 — 두 기기 · 다시 보내기가 같은 답을 본다.
 *  · fishplus.ts 와 서로 부르므로 그쪽 값은 함수 안에서만 쓴다(fishbottle.ts 와 같은 규칙). */
import type { IslandState } from "./island.ts";
import { BAITS, SPOTS, baitIndex, baitStock, fishingOf, rng, spotMinBait, spotOf, type FishCatch, type FishResult, type FishSpot, type MethodKey } from "./fishing.ts";
import { laterDay } from "./fishingworld.ts";
import { decorOf, grantDecor } from "./aquarium.ts";
import { fishPlusOf, specialCatch, withFishPlus, type SpecialCard, type SpecialCtx } from "./fishplus.ts";

/* ── 표 ─────────────────────────────────────────── */

export type RelicPiece = { key: string; name: string };
/** fresh · sea — 민물(강 · 호수 · 계곡 · 늪 · 열대관) · 바다에서 이 세트가 나오는 무게. deep — 심해 낚시일 때 곱하는 값 */
export type RelicSet = { key: string; name: string; reward: string; dupe: number; fresh: number; sea: number; deep?: number; where: string; pieces: readonly RelicPiece[] };

/** 세트 보상은 DECOR 에 이미 있는 장식만 쓴다(fishtreasure.test 가 잠근다) — 새 장식은 그림 · 3D 모델이 먼저다.
 *  용궁(60,000 하트짜리 장식)은 바다에서만 · 가장 드물게: 세트 무게가 가장 작고 심해 낚시에서만 두 배. */
export const RELIC_SETS: readonly RelicSet[] = [
  { key: "pottery", name: "옛 도자기", reward: "hanok", dupe: 8, fresh: 3, sea: 1, where: "강 · 호수 바닥에서 잘 나와요", pieces: [
    { key: "pottery_vase", name: "청자 매병" }, { key: "pottery_jar", name: "백자 달항아리" },
    { key: "pottery_bowl", name: "분청 대접" }, { key: "pottery_dropper", name: "청자 연적" },
  ] },
  { key: "wreck", name: "난파선", reward: "sunken_ship", dupe: 8, fresh: 1, sea: 3, where: "바다에서 잘 나와요", pieces: [
    { key: "wreck_plate", name: "배 이름 명판" }, { key: "wreck_compass", name: "놋쇠 나침반" }, { key: "wreck_bell", name: "뱃종" },
    { key: "wreck_anchor", name: "닻 조각" }, { key: "wreck_wheel", name: "키 손잡이" },
  ] },
  { key: "pirate", name: "해적의 보물", reward: "treasure", dupe: 10, fresh: 0, sea: 2, where: "바다에서만 나와요", pieces: [
    { key: "pirate_coin", name: "금화" }, { key: "pirate_glass", name: "망원경" },
    { key: "pirate_key", name: "녹슨 열쇠" }, { key: "pirate_map", name: "보물 지도 조각" },
  ] },
  { key: "palace", name: "용궁", reward: "dragon_palace", dupe: 15, fresh: 0, sea: 1, deep: 2, where: "바다에서만 · 심해 낚시에서 잘 나와요", pieces: [
    { key: "palace_scale", name: "용의 비늘" }, { key: "palace_pearl", name: "여의주" }, { key: "palace_crown", name: "산호 관" },
    { key: "palace_tile", name: "용궁 기와" }, { key: "palace_seal", name: "거북 인장" },
  ] },
];
export const RELIC_PIECES: readonly (RelicPiece & { set: RelicSet })[] = RELIC_SETS.flatMap((s) => s.pieces.map((p) => ({ ...p, set: s })));
export const relicOf = (key: string | undefined) => RELIC_PIECES.find((p) => p.key === key);

export const RELIC_BASE = 0.012;
export const CHEST_BASE = 0.004;
export const RELIC_MAX = 0.03;
export const CHEST_MAX = 0.01;
/** 못 모은 조각의 무게 */
export const MISSING_WEIGHT = 3;
/** 상자 안 — 하트 · 미끼 · 유물 조각의 비율(나머지가 조각) */
export const CHEST_HEARTS = 0.45;
export const CHEST_BAIT = 0.35;
/** 상자의 미끼 묶음 — 그 낚시터에서 무는 가장 싼 미끼(지렁이면 민물새우) 몇 회분. 상점 한 묶음(15~40회)보다 작게 */
export const CHEST_BAIT_USES = 8;
/** 남겨 두는 끌어올린 보물 id(다시 보내기 · 두 기기가 같은 보물을 두 번 열지 않게) · 조각 하나의 건진 수 상한 */
export const TREASURE_LOG = 30;
export const RELIC_COUNT_MAX = 99;
/** 세트 장식을 줄 수 없을 때(장식 표가 바뀐 옛 저장 등)의 대신 하트 */
export const SET_FALLBACK_COINS = 300;
const TREASURE_SEED = 0x7a3c5e1;

/* ── 읽기 ─────────────────────────────────────────── */

/** fishPlus 는 다른 기기 · 다른 판이 쓴 값이다 — 모양이 틀린 칸만 버린다. 모르는 조각(새 판이 더한 것)은 그대로 들고 다닌다 */
export function relicsOf(st: Pick<IslandState, "fishPlus">): Record<string, number> {
  const v = fishPlusOf(st).relics;
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === "number" && Number.isFinite(n) && n > 0) out[k] = Math.min(RELIC_COUNT_MAX, Math.floor(n));
  }
  return out;
}
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const relicSetsOf = (st: Pick<IslandState, "fishPlus">): string[] => strings(fishPlusOf(st).relicSets);
export const treasureLogOf = (st: Pick<IslandState, "fishPlus">): string[] => strings(fishPlusOf(st).treasureLog);
/** 세트에서 모은 조각 수 */
export const setHave = (relics: Readonly<Record<string, number>>, set: RelicSet) => set.pieces.filter((p) => (relics[p.key] ?? 0) > 0).length;

/* ── 걸리기 ─────────────────────────────────────────── */

const isSea = (spot: Partial<FishSpot> | undefined) => spot?.water === "sea";

/** 이번 판에 유물 · 상자가 걸릴 확률 — 낚시터 물 · 방식 · 던지기 점수로만 정한다 */
export function treasureChance(ctx: Pick<SpecialCtx, "spot" | "method" | "cast">): { relic: number; chest: number } {
  if (ctx.method === "scoop") return { relic: 0, chest: 0 };
  const cast = typeof ctx.cast === "number" && Number.isFinite(ctx.cast) ? Math.min(1, Math.max(0, ctx.cast)) : 0.5;
  const k = (isSea(ctx.spot) ? 1.5 : 1) * (ctx.method === "deep" ? 1.5 : 1) * (0.75 + 0.5 * cast);
  return { relic: Math.min(RELIC_MAX, RELIC_BASE * k), chest: Math.min(CHEST_MAX, CHEST_BASE * k) };
}

/** 조각 하나 고르기 — 세트 무게(물 · 방식) × 못 모은 조각 3배. 나올 세트가 없으면(그럴 일은 없다) 첫 조각 */
export function pickRelic(relics: Readonly<Record<string, number>>, sea: boolean, method: MethodKey | undefined, r: number): string {
  const w = RELIC_PIECES.map((p) => {
    const setW = (sea ? p.set.sea : p.set.fresh) * (method === "deep" ? p.set.deep ?? 1 : 1);
    return setW * ((relics[p.key] ?? 0) > 0 ? 1 : MISSING_WEIGHT);
  });
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return RELIC_PIECES[0].key;
  let v = r * total;
  for (let i = 0; i < w.length; i++) {
    if (v < w[i]) return RELIC_PIECES[i].key;
    v -= w[i];
  }
  return RELIC_PIECES[RELIC_PIECES.length - 1].key;
}

/** id — 종류 · 무엇(조각 key 또는 낚시터 key) · seed · 시각. 판마다 다르고(seed+now) 끌어올릴 때 이것만으로 무엇인지 안다 */
const idTail = (ctx: Pick<SpecialCtx, "seed" | "now">) => `${(ctx.seed >>> 0).toString(36)}.${Math.max(0, Math.floor(ctx.now)).toString(36)}`;
const relicCatch = (piece: string, ctx: SpecialCtx) => specialCatch("treasure", `relic.${piece}.${idTail(ctx)}`, "오래된 유물");
const chestCatch = (ctx: SpecialCtx) => specialCatch("treasure", `chest.${ctx.spot?.key ?? "x"}.${idTail(ctx)}`, "보물상자");

export type TreasureId = { type: "relic"; piece: string } | { type: "chest"; spot: string };
export function parseTreasureId(id: string | undefined): TreasureId | null {
  const m = /^(relic|chest)\.([a-z0-9_]+)\.[0-9a-z]+\.[0-9a-z]+$/.exec(id ?? "");
  if (!m) return null;
  if (m[1] === "chest") return { type: "chest", spot: m[2] };
  return relicOf(m[2]) ? { type: "relic", piece: m[2] } : null;
}
/** 화면의 꼬리표 · 그림 — 유물이면 그 조각, 상자면 null */
export const treasurePiece = (id: string | undefined): string | null => { const t = parseTreasureId(id); return t?.type === "relic" ? t.piece : null; };

/* ── 개발용 — 다음 판을 보물로 ─────────────────────────── */

let forced: string | null = null;
/** 개발 화면에서 혼자 시험할 때 — 다음 판 하나가 보물상자("chest") · 아무 유물("relic") · 그 조각(조각 key)이 된다. 배포 빌드에선 아무것도 안 한다 */
export function devForceTreasure(kind = "chest"): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (kind !== "chest" && kind !== "relic" && !relicOf(kind)) return false;
  forced = kind;
  return true;
}
/** 테스트가 남은 값을 비운다 */
export const devClearForced = () => { forced = null; };

/** 던질 때 — 유물 · 보물상자가 물고기 대신 걸리나. 주사위는 seed 에 소금을 쳐서 따로(물고기 · 유리병 뽑기와 얽히지 않게) */
export function rollTreasure(st: IslandState, ctx: SpecialCtx): FishCatch | null {
  const r = rng((ctx.seed ^ TREASURE_SEED) >>> 0);
  const f = forced;
  if (f && process.env.NODE_ENV !== "production") {
    forced = null;
    if (f === "chest") return chestCatch(ctx);
    return relicCatch(f === "relic" ? pickRelic(relicsOf(st), isSea(ctx.spot), ctx.method, r()) : f, ctx);
  }
  const { relic, chest } = treasureChance(ctx);
  const x = r();
  if (x < chest) return chestCatch(ctx);
  if (x < chest + relic) return relicCatch(pickRelic(relicsOf(st), isSea(ctx.spot), ctx.method, r()), ctx);
  return null;
}

/* ── 끌어올리기 ─────────────────────────────────────── */

/** 문자열 해시(FNV-1a) — 상자 안의 것을 id 만으로 정한다 */
function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
const josaEul = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? "을" : "를"; };
const josaI = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? "이" : "가"; };

type Land = { state: IslandState; coins: number; card: SpecialCard };

/** 조각 하나를 넣는다 — 겹치면 하트, 세트를 다 채우면 장식(세트마다 한 번). via 는 상자에서 나왔을 때의 머리말 */
function addPiece(st: IslandState, pieceKey: string, now: number, fromChest: boolean): Land {
  const piece = relicOf(pieceKey)!;
  const set = piece.set;
  const relics = relicsOf(st);
  const dupe = (relics[pieceKey] ?? 0) > 0;
  relics[pieceKey] = Math.min(RELIC_COUNT_MAX, (relics[pieceKey] ?? 0) + 1);
  let coins = dupe ? set.dupe : 0;
  let state = withFishPlus(st, { relics });
  const have = setHave(relics, set);
  const done = relicSetsOf(state);
  let note = dupe ? `이미 모은 유물이라 하트 ${set.dupe}개로 바꿨어요` : `${set.name} ${have}/${set.pieces.length} · 수집 탭에 남아요`;
  // 다 모았고 아직 장식을 안 받은 세트 — 겹친 조각이어도 본다(예전에 장식을 못 받은 채 남은 세트를 여기서 마저 준다)
  if (have === set.pieces.length && !done.includes(set.key)) {
    state = withFishPlus(state, { relicSets: [...done, set.key] });
    const g = grantDecor(state, set.reward, now);
    const decor = decorOf(set.reward)?.name ?? "장식";
    if (g.ok) { state = g.state; note = `${set.name} 세트를 다 모았어요 — 수조 보관함에 ${decor}${josaEul(decor)} 넣었어요`; }
    else { coins += SET_FALLBACK_COINS; note = `${set.name} 세트를 다 모았어요 — 하트 ${SET_FALLBACK_COINS}개를 드려요`; }
  }
  state = { ...state, coins: state.coins + coins };
  const body = fromChest ? `상자 안에 ${piece.name}${josaI(piece.name)} 들어 있었어요` : dupe ? `${set.name}의 ${piece.name} — 또 만났어요` : `${set.name}의 ${piece.name}`;
  return { state, coins, card: { kind: "treasure", title: fromChest ? "보물상자" : piece.name, body, note, ...(fromChest ? { art: pieceKey } : {}) } };
}

/** 상자의 하트 — 낚시터가 깊을수록 조금 더(60 ~ 200 안팎, 같은 상자는 늘 같은 값) */
export const chestHearts = (spot: FishSpot | undefined, r: number) => {
  const i = Math.max(0, SPOTS.findIndex((s) => s.key === spot?.key));
  return Math.round(((60 + 10 * i) * (0.8 + 0.4 * r)) / 5) * 5;
};
/** 상자의 미끼 — 그 낚시터에서 무는 가장 싼 미끼(지렁이는 매일 공짜라 한 칸 위) */
export const chestBait = (spot: FishSpot | undefined) => BAITS[Math.max(1, spot ? baitIndex(spotMinBait(spot).key) : 1)];

/** 끌어올렸다 — 저장을 바꾸고 결과 카드를 돌려준다. 같은 보물을 두 번 끌어올려도(다시 보내기 · 두 기기) 한 번만 연다 */
export function landTreasure(st: IslandState, c: FishCatch, ctx: SpecialCtx): FishResult {
  const id = c.special?.id;
  const t = c.special?.kind === "treasure" ? parseTreasureId(id) : null;
  if (!id || !t) return { ok: false, reason: "보물이 아니에요" };
  const log = treasureLogOf(st);
  if (log.includes(id)) return { ok: false, reason: "이미 열어 본 보물이에요" };
  const s0 = withFishPlus(st, { treasureLog: [id, ...log].slice(0, TREASURE_LOG) });
  let out: Land;
  if (t.type === "relic") out = addPiece(s0, t.piece, ctx.now, false);
  else {
    const r = rng(hashId(id));
    const x = r();
    const spot = spotOf(t.spot);
    if (x < CHEST_HEARTS) {
      const n = chestHearts(spot, r());
      out = { state: { ...s0, coins: s0.coins + n }, coins: n, card: { kind: "treasure", title: "보물상자", body: `하트 ${n}개가 들어 있었어요`, note: "바다 깊은 곳일수록 상자가 무거워요" } };
    } else if (x < CHEST_HEARTS + CHEST_BAIT) {
      // 미끼 더하기는 buyBait 와 같은 길 — 지렁이는 오늘 채워진 양을 먼저 셈에 넣고 채운 날을 남긴다(안 그러면 공짜 채우기가 덮는다)
      const bait = chestBait(spot);
      const f = fishingOf(s0);
      const worm = BAITS[0].key;
      const baits = { ...f.baits, [worm]: baitStock(f, worm, ctx.today) };
      baits[bait.key] = (baits[bait.key] ?? 0) + CHEST_BAIT_USES;
      out = { state: { ...s0, fishing: { ...f, baits, wormDay: laterDay(f.wormDay, ctx.today) } }, coins: 0,
        card: { kind: "treasure", title: "보물상자", body: `${bait.name} ${CHEST_BAIT_USES}회분이 들어 있었어요`, note: "미끼 칸에 바로 넣었어요" } };
    } else out = addPiece(s0, pickRelic(relicsOf(s0), isSea(spot), undefined, r()), ctx.now, true);
  }
  return { ok: true, state: out.state, outcome: "special", coins: out.coins, levelUp: 0, special: out.card };
}
