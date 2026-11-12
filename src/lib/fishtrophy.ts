/** 어탁 · 대물 인증 카드(2026-11-12) [사용자: "크기 기록을 깬 물고기를 먹물로 찍어 낸 '어탁' 카드로 만들어 … 공유 카드로 내보냅니다(이름 · cm · 낚시터 · 날짜 · 잡은 사람)"]
 *
 *  저장 — 섬 맨 위 칸 fishPlus.trophies(모습 하나에 한 장, 그 모습의 가장 긴 한 마리) · fishPlus.hung(벽에 건 모습 key, 6장까지).
 *   · s.fishing 에 두지 않는 이유는 fishplus.ts 머리말 — fishingOf 가 아는 칸만 다시 만들어 옛 앱이 한 번만 낚아도 지워진다.
 *   · 크기 기록(fs.sizes = 모습 key → 사람 → cm)에는 낚시터 · 날짜가 없다. 그래서 기록을 깬 순간(같은 저장 안)에 그 둘과 잡은 사람 이름을 남긴다.
 *   · 이름을 남기는 이유 — who 는 사용자 id 라 카드에 못 쓰고, 상대 이름은 이 화면이 모른다. 낚은 기기가 자기 이름을 적는다.
 *   · 섬 한 행은 1MB 한도라 120장에서 자른다 — 건 것은 지우지 않고, 나머지는 오래된 것부터. 잘린 모습도 어탁첩에서 사라지진 않는다(아래 보기가 크기 기록으로 채운다).
 *  보기 — trophyView 가 저장된 어탁과 크기 기록을 합친다. 옛 기록(이 기능 전) · 옛 앱으로 상대가 깬 기록도 첫날부터 보이게 —
 *   그런 칸은 낚시터 · 날짜를 모르니 카드가 그 줄을 빼고 그린다.
 *  카드 배치(printLayout)는 순수 계산이라 여기 둔다 — 그림이 글자를 덮지 않는지 테스트가 잰다. 그리기는 lib/gyotaku.ts(브라우저 전용). */
import type { IslandState } from "./island.ts";
import type { FishCatch, FishResult } from "./fishing.ts";
import { fishingOf, spotOf } from "./fishing.ts";
import { ALL_FORMS, FISH_BASE_CM, FISH_STAGE_SIZE, fishArtKey, fishName, type AquaForm } from "./aquarium.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";

/** 저장되는 한 장 — 짧은 칸 이름(섬 한 행이 작아야 한다). spot 은 낚시터 key(이름이 바뀌어도 따라가게), day 는 KST 날짜, by 는 잡은 사람 이름 */
export type Trophy = { key: string; cm: number; who: string; by: string; spot: string; day: string };
export const TROPHY_MAX = 120;
export const HUNG_MAX = 6;

const formMap = (() => {
  let m: Map<string, AquaForm> | null = null;
  return () => (m ??= new Map(ALL_FORMS.map((f) => [f.key, f])));
})();
export const formOfKey = (key: string): AquaForm | undefined => formMap().get(key);

function isTrophy(x: unknown): x is Trophy {
  const t = x as Trophy;
  return !!t && typeof t === "object" && typeof t.key === "string" && typeof t.cm === "number" && Number.isFinite(t.cm) && t.cm > 0;
}
/** 저장된 어탁 — 모르는 모양 · 같은 모습이 두 장인 것(손으로 고친 저장 등)은 긴 쪽 하나만 */
export function trophiesOf(st: Pick<IslandState, "fishPlus">): Trophy[] {
  const raw = fishPlusOf(st).trophies;
  const out = new Map<string, Trophy>();
  for (const x of Array.isArray(raw) ? raw : []) {
    if (!isTrophy(x)) continue;
    const t: Trophy = { key: x.key, cm: x.cm, who: String(x.who ?? ""), by: String(x.by ?? ""), spot: String(x.spot ?? ""), day: String(x.day ?? "") };
    const had = out.get(t.key);
    if (!had || t.cm > had.cm) out.set(t.key, t);
  }
  return [...out.values()];
}
export function hungOf(st: Pick<IslandState, "fishPlus">): string[] {
  const raw = fishPlusOf(st).hung;
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string"))].slice(0, HUNG_MAX) : [];
}

/** 한 장 더하기(같은 모습이면 더 길 때만 바꾼다) — 넘치면 건 것을 빼고 가장 오래된 날 · 같은 날이면 짧은 것부터 덜어 낸다(언제 돌려도 같은 결과) */
export function addTrophy(list: readonly Trophy[], t: Trophy, hung: readonly string[] = [], max = TROPHY_MAX): Trophy[] {
  const had = list.find((x) => x.key === t.key);
  if (had && had.cm >= t.cm) return [...list];
  const next = [t, ...list.filter((x) => x.key !== t.key)];
  if (next.length <= max) return next;
  const keep = new Set(hung);
  keep.add(t.key); // 방금 깬 기록은 지우지 않는다
  const order = next.filter((x) => !keep.has(x.key)).sort((a, b) => (a.day || "0").localeCompare(b.day || "0") || a.cm - b.cm || a.key.localeCompare(b.key));
  const drop = new Set(order.slice(0, next.length - max).map((x) => x.key));
  return next.filter((x) => !drop.has(x.key));
}

/** 끌어올린 판에 어탁을 얹는다(FishingGame 이 담기 · 팔기 저장 안에서 부른다 — 한 번의 저장으로 같이 들어가고, 저장이 다시 돌아도 같은 결과).
 *  이 모습의 가장 긴 기록이 이 한 마리가 됐을 때만 — 첫 기록도 남긴다(결과 카드의 '기록' 소식은 첫 기록엔 없지만, 어탁은 낚시터 · 날짜가 있어야 찍을 수 있다).
 *  놓쳐도(slipped) 크기 기록은 남는 엔진 규칙(gain)을 그대로 따른다. 주인 · 꽝 · 특별한 것은 크기 기록이 아니다. */
export function noteTrophy(r: FishResult, c: FishCatch, ctx: { who: string; by: string; spot: string; day: string }): FishResult {
  const cm = c.cm;
  if (!r.ok || !cm || c.boss || c.junk || c.special) return r;
  const key = fishArtKey(c);
  const row = fishingOf(r.state).sizes[key] ?? {};
  if (row[ctx.who] !== cm) return r; // 이 사람의 기록이 안 바뀌었다
  if (Object.values(row).some((v) => v > cm)) return r; // 상대 기록이 더 길다 — 모습마다 가장 긴 한 장만
  const t: Trophy = { key, cm, who: ctx.who, by: ctx.by.trim().slice(0, 12), spot: ctx.spot, day: ctx.day };
  const list = trophiesOf(r.state);
  const next = addTrophy(list, t, hungOf(r.state));
  if (next.length === list.length && next.every((x, i) => x === list[i])) return r;
  return { ...r, state: withFishPlus(r.state, { trophies: next }) };
}

/** 벽에 걸기 · 내리기 — 6장이 넘으면 막는다(무엇을 내릴지는 사람이 고른다). 어탁첩에 있는 모습만 건다 */
export function toggleHung(st: IslandState, key: string): { ok: true; state: IslandState } | { ok: false; reason: string } {
  const hung = hungOf(st);
  if (hung.includes(key)) return { ok: true, state: withFishPlus(st, { hung: hung.filter((k) => k !== key) }) };
  if (hung.length >= HUNG_MAX) return { ok: false, reason: `벽에는 ${HUNG_MAX}장까지 걸 수 있어요` };
  if (!formOfKey(key)) return { ok: false, reason: "모르는 어탁이에요" };
  return { ok: true, state: withFishPlus(st, { hung: [...hung, key] }) };
}

/** 화면 · 카드가 그리는 한 장 */
export type TrophyCard = { key: string; family: string; stage: 0 | 1 | 2; name: string; cm: number; ratio: number; spot: string; spotName: string; day: string; by: string; stored: boolean };
/** 이 모습의 보통 길이 대비 — 실루엣 크기 · '대물' 표시. rollCm 은 0.75~1.7 배를 낸다 */
export function sizeRatio(form: Pick<AquaForm, "family" | "stage">, cm: number): number {
  const base = (FISH_BASE_CM[form.family] ?? 20) * FISH_STAGE_SIZE[form.stage];
  return base > 0 ? cm / base : 1;
}
export function trophyCard(t: Pick<Trophy, "key" | "cm" | "spot" | "day" | "by">, stored: boolean): TrophyCard | null {
  const form = formOfKey(t.key);
  if (!form) return null;
  return { key: t.key, family: form.family, stage: form.stage, name: fishName(form), cm: t.cm, ratio: sizeRatio(form, t.cm), spot: t.spot, spotName: (t.spot && spotOf(t.spot)?.name) || "", day: t.day, by: t.by, stored };
}

/** 어탁첩 — 저장된 어탁 + 크기 기록(옛 기록 · 옛 앱의 상대 기록). 모습마다 가장 긴 한 장, 최근 · 긴 순.
 *  me · meName — 크기 기록에서 채운 칸의 '잡은 사람'(내 기록이면 내 이름, 상대면 '상대', 혼자 섬이면 비운다) */
export function trophyView(st: Pick<IslandState, "fishPlus" | "fishing">, me: string, meName: string, couple: boolean): TrophyCard[] {
  const stored = new Map(trophiesOf(st).map((t) => [t.key, t]));
  const sizes = fishingOf(st).sizes;
  const keys = new Set([...Object.keys(sizes), ...stored.keys()]);
  const out: TrophyCard[] = [];
  for (const key of keys) {
    const t = stored.get(key);
    let best: [string, number] | null = null;
    for (const [who, cm] of Object.entries(sizes[key] ?? {})) if (typeof cm === "number" && cm > 0 && (!best || cm > best[1])) best = [who, cm];
    // 저장된 어탁이 크기 기록만큼 길면 그것(낚시터 · 날짜가 있다). 옛 앱으로 상대가 더 긴 걸 잡았으면 크기 기록 쪽
    const card = t && (!best || t.cm >= best[1])
      ? trophyCard(t, true)
      : best ? trophyCard({ key, cm: best[1], spot: "", day: "", by: best[0] === me ? meName : couple ? "상대" : meName }, false) : null;
    if (card) out.push(card);
  }
  return out.sort((a, b) => (b.day || "").localeCompare(a.day || "") || b.ratio - a.ratio || a.key.localeCompare(b.key));
}

/** 'YYYY-MM-DD'(KST 날짜) → '2026년 11월 12일' */
export function fmtTrophyDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : "";
}
/** 낙관에 새길 한 글자 — 이름 첫 글자, 없으면 '魚' 대신 한글 '어'(서체에 한자가 없는 기기가 있다) */
export const sealChar = (by: string) => Array.from(by.trim())[0] ?? "어";

/* ── 카드 배치(1080×1350) ──────────────────────────────
 * 세로 띠로 나눈다: 머리글 → 실루엣 칸 → (왼쪽) 이름 · 길이 · 낚시터 · 날짜 · 잡은 사람 / (오른쪽) 낙관 → 꼬리글.
 * 실루엣은 기울여 찍으니 기운 뒤의 테두리(fishBounds)가 칸 안에 들어가게 줄인다. 글자 폭은 그릴 때 measureText 로 칸에 맞춰 줄인다. */
export const PRINT_W = 1080;
export const PRINT_H = 1350;
export type Box = { x: number; y: number; w: number; h: number };
export type PrintLine = { label: string; text: string; box: Box };
export type PrintLayout = { head: Box; fishArea: Box; fish: Box; fishBounds: Box; tilt: number; name: Box; cm: Box; lines: PrintLine[]; seal: Box; foot: Box };
const M = 72;
/** 보통 크기(1배)면 칸의 62%, 대물(1.7배 이상)이면 거의 칸 가득 — 작은 치어 기록도 알아보게 바닥을 둔다 */
export function fishScale(ratio: number): number {
  const r = Math.min(1.8, Math.max(0.6, Number.isFinite(ratio) ? ratio : 1));
  return 0.46 + (0.5 * (r - 0.6)) / 1.2;
}
export function printLayout(p: { ratio: number; aspect: number; lines: readonly (readonly [string, string])[] }): PrintLayout {
  const head: Box = { x: M, y: 60, w: PRINT_W - M * 2, h: 48 };
  const fishArea: Box = { x: M, y: 136, w: PRINT_W - M * 2, h: 620 };
  const tilt = -0.06;
  const aspect = Math.min(6, Math.max(0.3, Number.isFinite(p.aspect) && p.aspect > 0 ? p.aspect : 2));
  // 기운 사각형의 테두리: W' = w·cos + h·sin, H' = w·sin + h·cos (h = w / aspect)
  const c = Math.cos(tilt), s = Math.abs(Math.sin(tilt));
  const perW = c + s / aspect, perH = s + c / aspect;
  const fitW = Math.min(fishArea.w / perW, fishArea.h / perH);
  const w = fitW * fishScale(p.ratio), h = w / aspect;
  const bw = w * perW, bh = w * perH;
  const cx = fishArea.x + fishArea.w / 2, cy = fishArea.y + fishArea.h / 2;
  const fish: Box = { x: cx - w / 2, y: cy - h / 2, w, h };
  const fishBounds: Box = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
  const sealSide = 168;
  const seal: Box = { x: PRINT_W - M - sealSide, y: 800, w: sealSide, h: sealSide };
  const textW = seal.x - 32 - M;
  const name: Box = { x: M, y: 792, w: textW, h: 118 };
  const cm: Box = { x: M, y: 926, w: textW, h: 92 };
  const lines = p.lines.slice(0, 3).map(([label, text], i): PrintLine => ({ label, text, box: { x: M, y: 1050 + i * 62, w: PRINT_W - M * 2, h: 50 } }));
  const foot: Box = { x: M, y: PRINT_H - 56 - 36, w: PRINT_W - M * 2, h: 36 };
  return { head, fishArea, fish, fishBounds, tilt, name, cm, lines, seal, foot };
}
/** 카드에 실을 줄 — 모르는 것(옛 기록의 낚시터 · 날짜, 혼자 섬의 이름 없는 기록)은 뺀다 */
export function printLines(t: Pick<TrophyCard, "spotName" | "day" | "by">): [string, string][] {
  const out: [string, string][] = [];
  if (t.spotName) out.push(["낚시터", t.spotName]);
  const d = fmtTrophyDay(t.day);
  if (d) out.push(["날짜", d]);
  if (t.by) out.push(["잡은 사람", t.by]);
  return out;
}
export const boxesOverlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const boxInside = (a: Box, outer: Box) => a.x >= outer.x - 0.01 && a.y >= outer.y - 0.01 && a.x + a.w <= outer.x + outer.w + 0.01 && a.y + a.h <= outer.y + outer.h + 0.01;

/** 그림 무늬 씨앗 — 같은 어탁은 언제 찍어도 같은 번짐(공유할 때마다 달라 보이면 '진짜 한 장'이 아니다) */
export function printSeed(key: string, cm: number): number {
  let h = 2166136261;
  const s = `${key}:${cm}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}
