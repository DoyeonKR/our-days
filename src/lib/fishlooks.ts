/* 장비 꾸미기 · 강화 (2026-11-12) — [사용자: "찌 · 낚싯줄 색 · 낚싯대 스킨을 하트로 사고, 낚싯대에 별 강화와 세트 효과를 붙입니다"]
 * §10.25 경제 리뷰가 '안 한 것'으로 남긴 '새 소모처'다. 1년 시뮬레이션에서 하루 순수입이 약 1만(대충) ~ 2만(열심) 하트라
 * 꾸미기는 2,000 ~ 60,000, 강화는 별마다 5,000 ~ 100,000 × 낚싯대 단계 값으로 잡았다(합계는 lookSinkTotal · fishlooks.test).
 *
 * 저장은 섬 맨 위 칸 s.fishPlus 에 — s.fishing 안에 두면 fishingOf 가 아는 칸만 다시 만들어서(옛 앱도 같다) 하트로 산 게 사라진다(fishplus.ts 머리말).
 *   looks   — owned: 산 꾸미기 id(섬 하트로 사니 커플이 같이 갖는다) · wear: 사람마다 낀 것(uid → { bobber · line · rod }). 합치기 스킨(s.merge.skins · wear)과 같은 모양.
 *   enhance — 낚싯대 key → 별(0~5). 낚싯대는 커플이 함께 쓰는 섬 장비라 별도 함께다. 새 낚싯대를 사도 옛 낚싯대의 별은 그 key 에 남는다.
 *
 * 꾸미기는 모습만 바꾼다(능력치 없음). 강화 · 세트만 능력치에 더해지고, 더하는 곳은 gearStats 한 곳 — 화면(FishingGame)의 eff 가 이걸 부른다.
 * ⚠ fishing.ts 는 이 파일을 부르지 않는다 — RODS · NETS 를 여기서 읽으니 거꾸로 부르면 순환 import 가 된다. 그래서 buffedStats 를 감싼다.
 * ⚠ 밸런스 테스트(fishing · fishingbalance · fishingworld)는 맨 능력치(effectiveStats)로 잰다 — 이 덤의 크기는 fishlooks.test 가 따로 잰다. */
import type { IslandState } from "./island.ts";
import { RODS, buffedStats, fishingOf, type FishStat, type FishingState, type GearResult } from "./fishing.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";

export type LookKind = "bobber" | "line" | "rod";
/** color — 줄 색 · 낚싯대에 입히는 색(#rrggbb, 연출의 mix 가 이 꼴만 읽는다). 찌는 연출이 id 로 모양을 그린다(fishingfx 의 FX_BOBBERS). */
export type FishLook = { id: string; kind: LookKind; name: string; price: number; color: string; desc: string };

/** 기본(값 0)은 처음부터 갖고 있다 — 산 목록에 넣지 않는다.
 *  줄 색에 빨강 · 분홍이 없는 이유: 줄이 팽팽해지면 흰색 → 빨강으로 물들며 '곧 끊어진다'를 알린다. 붉은 줄은 그 경고를 가린다.
 *  줄은 전부 밝은 색 — 어두운 물 위에서 줄이 안 보이면 힘겨루기가 안 읽힌다(그림자 줄이 한 번 깔린다). */
export const LOOKS: readonly FishLook[] = [
  { id: "bob_red", kind: "bobber", name: "기본 빨강 찌", price: 0, color: "#e6242d", desc: "처음 받은 찌" },
  { id: "bob_star", kind: "bobber", name: "노랑 별 찌", price: 4000, color: "#facc15", desc: "별 하나가 그려진 노란 찌" },
  { id: "bob_heart", kind: "bobber", name: "하트 찌", price: 8000, color: "#f472b6", desc: "하트 모양 분홍 찌" },
  { id: "bob_duck", kind: "bobber", name: "오리 찌", price: 15000, color: "#fde047", desc: "물 위에 떠 있는 노란 오리" },
  { id: "bob_moon", kind: "bobber", name: "달 찌", price: 30000, color: "#1e2a5a", desc: "밤하늘 찌에 초승달" },
  { id: "bob_gold", kind: "bobber", name: "금빛 찌", price: 60000, color: "#e5b84a", desc: "반짝이는 금빛 찌" },
  { id: "line_white", kind: "line", name: "기본 흰 줄", price: 0, color: "#ffffff", desc: "처음 받은 줄" },
  { id: "line_mint", kind: "line", name: "민트 줄", price: 2000, color: "#a7f3d0", desc: "옅은 민트색" },
  { id: "line_sky", kind: "line", name: "하늘 줄", price: 3000, color: "#bae6fd", desc: "맑은 하늘색" },
  { id: "line_lemon", kind: "line", name: "레몬 줄", price: 5000, color: "#fef08a", desc: "밝은 레몬색" },
  { id: "line_lilac", kind: "line", name: "연보라 줄", price: 10000, color: "#ddd6fe", desc: "라일락 빛" },
  { id: "line_gold", kind: "line", name: "금실", price: 25000, color: "#fcd34d", desc: "금빛 실" },
  { id: "rod_plain", kind: "rod", name: "원래 색", price: 0, color: "", desc: "낚싯대 그림 그대로" },
  { id: "rod_sakura", kind: "rod", name: "벚꽃 칠", price: 10000, color: "#f9a8c9", desc: "연분홍으로 물든 낚싯대" },
  { id: "rod_ocean", kind: "rod", name: "바다 칠", price: 15000, color: "#38bdf8", desc: "푸른 바다색" },
  { id: "rod_forest", kind: "rod", name: "숲 칠", price: 15000, color: "#34d399", desc: "초록 숲색" },
  { id: "rod_night", kind: "rod", name: "밤하늘 칠", price: 30000, color: "#6366f1", desc: "남보라 밤하늘" },
  { id: "rod_gilt", kind: "rod", name: "금박", price: 50000, color: "#e5b84a", desc: "금박을 입힌 낚싯대" },
];
export const LOOK_KINDS: readonly LookKind[] = ["bobber", "line", "rod"];
export const LOOK_KIND_NAME: Readonly<Record<LookKind, string>> = { bobber: "찌", line: "낚싯줄", rod: "낚싯대 색" };
export const lookById = (id: string | null | undefined) => LOOKS.find((x) => x.id === id);
/** 그 종류의 기본 — 처음부터 갖고 있는 것 */
export const defaultLook = (kind: LookKind) => LOOKS.find((x) => x.kind === kind && x.price === 0)!;

export type LooksRec = { owned: string[]; wear: Record<string, Partial<Record<LookKind, string>>> };

/** 저장된 꾸미기 — 모르는 id · 잘못된 모양은 버린다(다른 갈래 · 옛 앱 · 손상된 값이 화면을 깨지 않게). 기본은 owned 에 넣지 않는다. */
export function looksOf(st: Pick<IslandState, "fishPlus">): LooksRec {
  const raw = fishPlusOf(st).looks as { owned?: unknown; wear?: unknown } | undefined;
  const owned = [...new Set(Array.isArray(raw?.owned) ? raw.owned.filter((x): x is string => typeof x === "string" && (lookById(x)?.price ?? 0) > 0) : [])];
  const wear: LooksRec["wear"] = {};
  if (raw?.wear && typeof raw.wear === "object") {
    for (const [who, w] of Object.entries(raw.wear as Record<string, unknown>)) {
      if (!w || typeof w !== "object") continue;
      const mine: Partial<Record<LookKind, string>> = {};
      for (const k of LOOK_KINDS) {
        const id = (w as Record<string, unknown>)[k];
        const look = typeof id === "string" ? lookById(id) : undefined;
        // 산 것만 낀다 — 기본은 아예 적지 않는다(안 적힌 칸 = 기본)
        if (look && look.kind === k && owned.includes(look.id)) mine[k] = look.id;
      }
      if (Object.keys(mine).length) wear[who] = mine;
    }
  }
  return { owned, wear };
}
export const ownsLook = (rec: LooksRec, id: string) => lookById(id)?.price === 0 || rec.owned.includes(id);

/** 이 사람이 지금 낀 것 — 연출(fx.setLook)과 상점이 같이 본다 */
export function wornLooks(st: Pick<IslandState, "fishPlus">, who: string): Record<LookKind, FishLook> {
  const mine = looksOf(st).wear[who] ?? {};
  return { bobber: lookById(mine.bobber) ?? defaultLook("bobber"), line: lookById(mine.line) ?? defaultLook("line"), rod: lookById(mine.rod) ?? defaultLook("rod") };
}

/** ⚠ 쓰기는 저장된 그대로의 값에서 바꿀 칸만 고친다 — 읽기용으로 거른 값(looksOf)을 되쓰면, 다음 버전이 더한 찌 · 낚싯대를
 *  이 번들이 모른다고 지워 버린다(하트로 산 게 사라진다 — fishPlus 칸을 따로 둔 이유와 같다). 거르기는 읽을 때만. */
const rawObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});
function writeLooks(st: IslandState, who: string, look: FishLook, buy: boolean): IslandState {
  const raw = rawObj(fishPlusOf(st).looks);
  const owned = Array.isArray(raw.owned) ? [...raw.owned] : [];
  if (buy && !owned.includes(look.id)) owned.push(look.id);
  const wear = rawObj(raw.wear);
  const mine = rawObj(wear[who]);
  if (look.price === 0) delete mine[look.kind];
  else mine[look.kind] = look.id;
  if (Object.keys(mine).length) wear[who] = mine;
  else delete wear[who];
  return withFishPlus(st, { looks: { ...raw, owned, wear } });
}

/** 꾸미기 사기 — 섬 하트를 내고 산 목록에 넣은 뒤 산 사람이 바로 낀다(상대가 낀 건 그대로). 순수.
 *  이미 있으면 거절한다 — 저장 충돌로 다시 돌아도(act) 두 번 사지 않는다. */
export function buyLook(st: IslandState, who: string, id: string): GearResult {
  const look = lookById(id);
  if (!look) return { ok: false, reason: "없는 꾸미기예요" };
  if (ownsLook(looksOf(st), id)) return { ok: false, reason: "이미 있는 꾸미기예요" };
  if (st.coins < look.price) return { ok: false, reason: `하트가 ${(look.price - st.coins).toLocaleString()}개 모자라요` };
  return { ok: true, state: { ...writeLooks(st, who, look, true), coins: st.coins - look.price } };
}

/** 끼기 — 기본을 고르면 그 칸을 비운다. 산 것만 낀다. 순수. */
export function wearLook(st: IslandState, who: string, id: string): GearResult {
  const look = lookById(id);
  if (!look) return { ok: false, reason: "없는 꾸미기예요" };
  if (!ownsLook(looksOf(st), id)) return { ok: false, reason: "먼저 사야 해요" };
  return { ok: true, state: writeLooks(st, who, look, false) };
}

/* ── 강화 ─────────────────────────────────────────── */

export const STAR_MAX = 5;
/** 별 하나 값(★1 ~ ★5) — 낚싯대 단계 값(STAR_TIER)을 곱한다. 맨 위 별빛 낚싯대 ★5 까지 240,000 = 열심 커플 약 12일 · 대충 커플 약 23일치 */
export const STAR_BASE: readonly number[] = [5000, 12000, 25000, 50000, 100000];
/** 낚싯대 단계 값 — 낮은 낚싯대는 곧 바꿀 거라 싸게. 0 이 아니다(대나무도 강화가 된다 — 값이 0 이면 공짜 별이 된다).
 *  대나무 ★1(1,300)이 유리섬유(1,500 · 힘 +3 · 줄 +3)보다 싸지만 얻는 건 힘 +1 이라 새 낚싯대를 사는 게 늘 낫다. */
export const STAR_TIER: readonly number[] = [0.25, 0.4, 0.6, 0.8, 1, 1.25];
/** 다음 별(1~5)의 값 — 백 단위 */
export const starCost = (rodIdx: number, star: number) => Math.round((STAR_BASE[star - 1] * STAR_TIER[Math.min(STAR_TIER.length - 1, Math.max(0, rodIdx))]) / 100) * 100;

/** 별 하나마다 힘 +1, ★5 에서 줄 다루기 +1 더 — ★5 = 힘 +5 · 줄 +1.
 *  사람 흉내 봇으로 잰 찌낚시 끌어올림 변화(낚시터 수준 장비, fishlooks.test): 대부분 낚시터 0~2%p, 가장 빡빡한 용궁사 +6 · 심해 +4%p.
 *  루어 · 뜰채 · 심해 · 주인전도 같은 eff 를 쓰지만 따로 재지 않았다.
 *  ★3 · ★5 에 줄 +1 씩(힘 +5 · 줄 +2)은 심해에서 7%p 가까이 올라 줄 하나를 뺐다. */
export function starBonus(stars: number): Pick<Record<FishStat, number>, "power" | "line"> {
  const n = Math.max(0, Math.min(STAR_MAX, Math.floor(stars)));
  return { power: n, line: n >= STAR_MAX ? 1 : 0 };
}

/** 낚싯대별 별 — 모르는 낚싯대 · 범위 밖 값은 버린다 */
export function enhanceOf(st: Pick<IslandState, "fishPlus">): Record<string, number> {
  const raw = fishPlusOf(st).enhance;
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const r of RODS) {
      const v = (raw as Record<string, unknown>)[r.key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 1) out[r.key] = Math.min(STAR_MAX, Math.floor(v));
    }
  }
  return out;
}
export const starsOf = (st: Pick<IslandState, "fishPlus">, rodKey: string) => enhanceOf(st)[rodKey] ?? 0;

/** 지금 낚싯대를 ★toStar 로 — 섬 하트. 순수.
 *  누른 순간 본 낚싯대 · 별을 받는다: 저장 충돌이면 화면(act)이 최신 상태로 다시 돌리는데, '다음 별'을 그때 정하면
 *  둘이 같이 ★3 을 누를 때 늦은 쪽이 본 적 없는 ★4 를 두 배 값에 사고, 그 사이 상대가 낚싯대를 바꿨으면 엉뚱한 낚싯대에 붙는다(§10.24 도구 사기와 같은 규칙). */
export function enhanceRod(st: IslandState, rodKey: string, toStar: number): GearResult {
  const f = fishingOf(st), rod = RODS[f.rod];
  if (rod.key !== rodKey) return { ok: false, reason: "낚싯대가 바뀌었어요. 다시 확인해 주세요" };
  const now = starsOf(st, rod.key);
  if (now >= toStar) return { ok: false, reason: `이미 ★${now} 이에요` };
  if (toStar !== now + 1) return { ok: false, reason: "별이 바뀌었어요. 다시 확인해 주세요" };
  if (now >= STAR_MAX) return { ok: false, reason: "별을 다 채웠어요" };
  const cost = starCost(f.rod, toStar);
  if (st.coins < cost) return { ok: false, reason: `하트가 ${(cost - st.coins).toLocaleString()}개 모자라요` };
  return { ok: true, state: { ...withFishPlus(st, { enhance: { ...rawObj(fishPlusOf(st).enhance), [rod.key]: toStar } }), coins: st.coins - cost } };
}

/* ── 세트 ─────────────────────────────────────────── */

/** 세트 — 낚싯대와 뜰채가 둘 다 3단계(카본 · 고무) 이상이면 포획 +1, 둘 다 5단계(용골 · 황금) 이상이면 +2.
 *  '같은 단계'가 아니라 '둘 중 낮은 쪽'으로 잰다 — 같은 단계만 치면 낚싯대를 한 단계 올리는 순간 세트가 풀려 포획이 내려간다(사는 게 손해가 된다). */
export const SET_STEPS: readonly { from: number; catch: number }[] = [
  { from: 2, catch: 1 },
  { from: 4, catch: 2 },
];
export function setBonus(f: Pick<FishingState, "rod" | "net">): { tier: number; catch: number; next: { from: number; catch: number } | null } {
  const tier = Math.min(f.rod, f.net);
  const on = [...SET_STEPS].reverse().find((s) => tier >= s.from);
  return { tier, catch: on?.catch ?? 0, next: SET_STEPS.find((s) => tier < s.from) ?? null };
}

/** 화면이 쓰는 능력치 — buffedStats(도시락 · 수조 행운) + 강화 별 + 세트. 별 · 세트는 도시락 % 뒤에 더해서 표시한 만큼만 붙는다. */
export function gearStats(st: Pick<IslandState, "buffs" | "fishPlus"> & { aquarium?: IslandState["aquarium"] }, f: Pick<FishingState, "stats" | "rod" | "net">, now: number): Record<FishStat, number> {
  const e = buffedStats(st, f, now);
  const star = starBonus(starsOf(st, RODS[f.rod]?.key ?? RODS[0].key));
  return { ...e, power: e.power + star.power, line: e.line + star.line, catch: e.catch + setBonus(f).catch };
}

/** 이 상점이 빨아들일 수 있는 하트 — realistic: 꾸미기 전부 + 맨 위 낚싯대 ★5 · max: 꾸미기 전부 + 모든 낚싯대 ★5 */
export function lookSinkTotal(): { looks: number; topRodStars: number; allRodStars: number; realistic: number; max: number } {
  const looks = LOOKS.reduce((n, x) => n + x.price, 0);
  const rodStars = (i: number) => STAR_BASE.reduce((n, _, k) => n + starCost(i, k + 1), 0);
  const topRodStars = rodStars(RODS.length - 1);
  const allRodStars = RODS.reduce((n, _, i) => n + rodStars(i), 0);
  return { looks, topRodStars, allRodStars, realistic: looks + topRodStars, max: looks + allRodStars };
}
