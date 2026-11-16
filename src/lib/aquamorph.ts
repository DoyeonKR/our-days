/** 색 변이 품종(2026-11-13) [사용자: 색 변이 품종 · 물고기 개체 이야기 "Build all"]
 *
 *  수조의 알에서 깬 물고기가 드물게 색이 다르게 태어난다 — 알비노 · 황금 · 흑색, 아주 드물게 오로라. 보기와 도감 수집만 바뀐다:
 *  하트 · 경험치 · 보내 주기 값 · 성장은 그대로다(새 하트 수도꼭지 금지).
 *
 *  · 뽑기는 결정적이다 — 치어 id 와 계열만 쓴다(Math.random 금지, 두 기기가 같은 변이를 본다).
 *  · 물려받기 — 알을 낳은 짝 중 변이가 있으면 확률이 오르고(하나 15% · 둘 30%), 변이가 나오면 열에 여섯은 부모의 변이를 닮는다.
 *  · 저장은 섬 맨 위 칸 s.aquaMorph(stow 가 쓴다) — s.aquarium 의 물고기는 옛 앱이 아는 칸으로 다시 지으므로 거기 두면 사라진다.
 *  · 옛 앱이 알을 낳았으면 변이가 안 적힌다 — 그 치어는 부모 없이(5%) 같은 주사위로 다시 굴린다(adoptMorphs). 같은 주사위라
 *    태어날 때 '변이 없음'이었던 치어는 다시 굴려도 늘 없음이다(부모가 있으면 문턱이 더 높으므로). since 보다 앞선 id(이 기능 전에 깬 물고기)는 안 굴린다.
 *  ⚠ 이 파일은 aquarium.ts 를 값으로 부르지 않는다(aquarium.ts 가 이 파일을 부른다 — 고리를 만들지 않는다). */

export const MORPHS = ["albino", "golden", "melanistic", "aurora"] as const;
export type Morph = (typeof MORPHS)[number];
export const MORPH_INFO: Readonly<Record<Morph, { name: string; desc: string; weight: number }>> = {
  albino: { name: "알비노", desc: "색소가 빠져 하얗고 눈이 붉어요", weight: 40 },
  golden: { name: "황금", desc: "온몸이 금빛으로 빛나요", weight: 30 },
  melanistic: { name: "흑색", desc: "검은 비늘이 짙게 덮였어요", weight: 25 },
  aurora: { name: "오로라", desc: "보는 각도마다 무지갯빛이 흘러요", weight: 5 },
};
/** 변이 확률 — 부모에 변이가 없을 때 · 하나일 때 · 둘일 때 */
export const MORPH_BASE = 0.05;
export const MORPH_ONE_PARENT = 0.15;
export const MORPH_TWO_PARENTS = 0.3;
/** 변이가 나왔을 때 부모의 변이를 닮을 확률 */
export const MORPH_LIKE_PARENT = 0.6;

/** 저장 모양(s.aquaMorph) — by: 지금 사는 물고기 id → 변이 · seen: '계열:변이' → 태어난 수(떠나도 남는다) · since: 이 id 부터 옛 앱이 낳은 치어도 굴린다 */
export type MorphBook = { by: Record<string, Morph>; seen: Record<string, number>; since: number };

export const isMorph = (v: unknown): v is Morph => typeof v === "string" && (MORPHS as readonly string[]).includes(v);

function h32(n: number, salt: string): number {
  let h = (2166136261 ^ (n | 0)) >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0;
  // 마지막 섞기 — FNV 만으로는 이웃한 id 의 낮은 비트가 비슷하다
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
const unit = (n: number, salt: string) => h32(n, salt) / 4294967296;

export const morphOdds = (parents: readonly (Morph | null | undefined)[]): number => {
  const n = parents.filter(Boolean).length;
  return n >= 2 ? MORPH_TWO_PARENTS : n === 1 ? MORPH_ONE_PARENT : MORPH_BASE;
};

/** 알에서 깬 치어의 변이 — 같은 (id, 계열, 부모 변이) = 같은 결과. 없으면 null */
export function rollMorph(fryId: number, family: string, parents: readonly (Morph | null | undefined)[] = []): Morph | null {
  const pm = parents.filter((x): x is Morph => isMorph(x));
  if (unit(fryId, `morph:${family}`) >= morphOdds(pm)) return null;
  const r2 = unit(fryId, `like:${family}`);
  if (pm.length && r2 < MORPH_LIKE_PARENT) return pm[Math.min(pm.length - 1, Math.floor((r2 / MORPH_LIKE_PARENT) * pm.length))];
  const total = MORPHS.reduce((n, m) => n + MORPH_INFO[m].weight, 0);
  let r = unit(fryId, `kind:${family}`) * total;
  for (const m of MORPHS) {
    if (r < MORPH_INFO[m].weight) return m;
    r -= MORPH_INFO[m].weight;
  }
  return MORPHS[0];
}

/** 저장값 읽기 — 다른 기기 · 다른 판이 쓴 값이라 모양을 검사한다. 없으면 since = 지금 다음 id(이 기능 전에 깬 물고기는 안 굴린다) */
export function readMorphBook(v: unknown, nextId: number): MorphBook {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const by: Record<string, Morph> = {}, seen: Record<string, number> = {};
  if (o?.by && typeof o.by === "object") for (const [k, m] of Object.entries(o.by as Record<string, unknown>)) if (isMorph(m)) by[k] = m;
  if (o?.seen && typeof o.seen === "object") for (const [k, n] of Object.entries(o.seen as Record<string, unknown>)) if (typeof n === "number" && Number.isFinite(n) && n > 0) seen[k] = Math.floor(n);
  const since = typeof o?.since === "number" && Number.isFinite(o.since) ? Math.floor(o.since) : nextId;
  return { by, seen, since };
}

type FishLike = { id: number; family: string; bred?: boolean };
/** 이 물고기의 변이 — 적힌 값, 없으면(옛 앱이 낳은 치어) 부모 없이 같은 주사위로 */
export function morphOf(book: MorphBook | undefined, f: FishLike): Morph | null {
  if (!book) return null;
  const m = book.by[String(f.id)];
  if (m) return m;
  return f.bred && f.id >= book.since ? rollMorph(f.id, f.family) : null;
}
export const morphKey = (family: string, m: Morph) => `${family}:${m}`;
/** 태어난 변이를 적는다 — by 와 seen 을 같이 */
export function noteMorph(book: MorphBook, f: { id: number; family: string }, m: Morph): MorphBook {
  const k = morphKey(f.family, m);
  return { ...book, by: { ...book.by, [String(f.id)]: m }, seen: { ...book.seen, [k]: (book.seen[k] ?? 0) + 1 } };
}
/** 정산 뒤 — 옛 앱이 낳은 치어의 변이를 적고, 떠난 물고기의 칸은 지운다(추모 칸이 변이를 따로 들고 있다) */
export function adoptMorphs(book: MorphBook, fish: readonly FishLike[], living: ReadonlySet<number>): MorphBook {
  let out = book;
  for (const f of fish) {
    if (out.by[String(f.id)] || !f.bred || f.id < out.since) continue;
    const m = rollMorph(f.id, f.family);
    if (m) out = noteMorph(out, f, m);
  }
  const by = Object.fromEntries(Object.entries(out.by).filter(([k]) => living.has(Number(k))));
  return Object.keys(by).length === Object.keys(out.by).length ? out : { ...out, by };
}
/** 도감 — 계열마다 만난 변이 */
export function morphDex(book: MorphBook | undefined): { family: string; morph: Morph; n: number }[] {
  if (!book) return [];
  return Object.entries(book.seen).flatMap(([k, n]) => {
    const i = k.lastIndexOf(":"), family = k.slice(0, i), morph = k.slice(i + 1);
    return isMorph(morph) && family ? [{ family, morph, n }] : [];
  });
}
