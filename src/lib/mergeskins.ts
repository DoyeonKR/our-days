/* 정원 합치기 스킨 상점 (2026-10-31) — [사용자: "단계별 스킨을 하트로 살 수 있는 상점 … 우리 에셋 활용해 …
 * 특정 단계를 특정 그림으로 바꿀 수 있는거야 하트로 사서 가격은 비싸게"]
 * 그림은 새로 그리지 않고 섬 히어로 원화(public/heroes — lib/heroassets)를 그대로 쓴다. 단계마다 두 장.
 * 낮은 단계엔 알 · 아기 · 성장기, 높은 단계로 갈수록 신화 · 사신 · 황룡 — 재료 사다리와 같은 '점점 귀해진다'.
 * 저장은 섬 상태 s.merge 의 옵셔널 칸(무마이그레이션):
 *   skins — 산 스킨 id 목록(섬 하트로 사니 커플이 같이 쓴다) · wear — 사람마다 단계별로 낀 스킨(uid → { 단계: id }).
 * ⚠ 이 파일은 섬 엔진을 값으로 부르지 않는다(타입만) — 게임 탭 첫 로드에 섬 엔진이 실리지 않게. 이름은 PET_FORMS 와 같아야 한다(mergeskins.test). */
import type { IslandState } from "./island.ts";
import { MAX_LV, mergeOf, type MergeRecord } from "./merge.ts";

export type MergeSkin = { id: string; lv: number; form: string; name: string; price: number };

/** 단계별 가격 — 5,000 에서 단계마다 ×1.2, 천 단위. 1단계 5,000 · 10단계 26,000 · 17단계 92,000. */
export function skinPrice(lv: number): number {
  return Math.round((5000 * 1.2 ** (Math.max(1, lv) - 1)) / 1000) * 1000;
}

const PICKS: readonly (readonly [string, string])[][] = [
  [["egg", "알"], ["hatchling", "아기"]],
  [["sunny", "햇살이"], ["cozy", "포근이"]],
  [["sprout", "새싹이"], ["dewy", "이슬이"]],
  [["rabbit", "토끼"], ["squirrel", "다람쥐"]],
  [["fox", "여우"], ["cat", "고양이"]],
  [["otter", "수달"], ["deer", "사슴"]],
  [["bear", "곰"], ["panda", "판다"]],
  [["owl", "부엉이"], ["wolf", "늑대"]],
  [["lucky_cat", "행운고양이"], ["honey_bear", "꿀곰"]],
  [["moon_rabbit", "달토끼"], ["crystal_deer", "수정사슴"]],
  [["celestial_fox", "천상여우"], ["starlight_fox", "별빛여우"]],
  [["mudeung_tiger", "무등산호랑이"], ["bengal_tiger", "뱅갈호랑이"]],
  [["baengnok", "백록"], ["cheonma", "천마"]],
  [["imugi", "이무기"], ["bulgasari", "불가사리"]],
  [["phoenix", "봉황"], ["samjoko", "삼족오"]],
  [["azure_dragon", "청룡"], ["white_tiger", "백호"]],
  [["yellow_dragon", "황룡"], ["hong_dragon", "홍룡"]],
];

export const SKINS: readonly MergeSkin[] = PICKS.flatMap((pair, i) =>
  pair.map(([form, name]) => ({ id: `${i + 1}:${form}`, lv: i + 1, form, name, price: skinPrice(i + 1) })),
);
const BY_ID = new Map(SKINS.map((k) => [k.id, k]));
export const skinById = (id: string | undefined): MergeSkin | undefined => (id ? BY_ID.get(id) : undefined);
export const skinsOfLv = (lv: number): MergeSkin[] => SKINS.filter((k) => k.lv === lv);

/** 산 스킨 — 표에 없는 id(옛 · 잘못된 값)는 버린다. */
export function ownedSkins(rec: Pick<MergeRecord, "skins"> | null | undefined): Set<string> {
  return new Set((rec?.skins ?? []).filter((id) => BY_ID.has(id)));
}

/** 이 사람이 단계별로 낀 스킨의 그림(히어로 폼) — 산 것만, 단계가 맞는 것만. 키는 단계 번호. */
export function wornForms(rec: Pick<MergeRecord, "skins" | "wear"> | null | undefined, who: string): Record<number, string> {
  const own = ownedSkins(rec);
  const out: Record<number, string> = {};
  for (const [lv, id] of Object.entries(rec?.wear?.[who] ?? {})) {
    const k = skinById(id);
    if (k && own.has(id) && String(k.lv) === lv && k.lv <= MAX_LV) out[k.lv] = k.form;
  }
  return out;
}

export type SkinResult = { ok: true; state: IslandState } | { ok: false; reason: string };

function withRecord(s: IslandState, rec: MergeRecord): IslandState {
  return { ...s, merge: rec };
}

function wearOf(rec: MergeRecord, who: string, lv: number, id: string | null): MergeRecord["wear"] {
  const mine = { ...(rec.wear?.[who] ?? {}) };
  if (id) mine[String(lv)] = id;
  else delete mine[String(lv)];
  return { ...(rec.wear ?? {}), [who]: mine };
}

/** 스킨 사기 — 섬 하트를 내고 산 목록에 넣은 뒤 바로 낀다. 순수. */
export function buySkin(s: IslandState, who: string, id: string): SkinResult {
  const k = skinById(id);
  if (!k) return { ok: false, reason: "없는 스킨이에요" };
  const rec = mergeOf(s);
  if (ownedSkins(rec).has(id)) return { ok: false, reason: "이미 있는 스킨이에요" };
  if (s.coins < k.price) return { ok: false, reason: `하트가 ${(k.price - s.coins).toLocaleString()}개 모자라요` };
  const next: MergeRecord = { ...rec, skins: [...ownedSkins(rec), id], wear: wearOf(rec, who, k.lv, id) };
  return { ok: true, state: { ...withRecord(s, next), coins: s.coins - k.price } };
}

/** 끼기 · 벗기 — id 가 null 이면 그 단계를 원래 그림으로. 산 스킨만 낀다. 순수. */
export function wearSkin(s: IslandState, who: string, lv: number, id: string | null): SkinResult {
  const rec = mergeOf(s);
  if (id) {
    const k = skinById(id);
    if (!k || k.lv !== lv) return { ok: false, reason: "이 단계의 스킨이 아니에요" };
    if (!ownedSkins(rec).has(id)) return { ok: false, reason: "먼저 사야 해요" };
  }
  return { ok: true, state: withRecord(s, { ...rec, wear: wearOf(rec, who, lv, id) }) };
}
