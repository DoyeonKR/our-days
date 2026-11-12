/** 유리병 편지(2026-11-12) [사용자: "내가 쓴 짧은 편지를 병에 넣어 띄우면, 상대가 낚시하다 그 병을 낚아 엽니다 … 10글자 이내로 쓸 수 있도록 해"]
 *
 *  저장은 섬 맨 위 칸 s.fishPlus 의 세 칸 — bottles(떠다니는 병) · bottleLog(열어 본 편지) · bottleSeq(번호). s.fishing 에 두면
 *  상대가 옛 앱으로 한 번만 낚아도 fishingOf 가 지운다(fishplus.ts 머리말).
 *  · 값은 공짜다 — 하트는 낚시로 버는 돈이고 미끼 · 장비와 겨루게 하면 편지를 아끼게 된다. 도배는 개수 상한(한 사람 3 · 바다 10)이 막고,
 *    병을 건져도 하트 · 경험치가 없어서 찍어 낼 것도 없다.
 *  · 걸리는 확률 — 던질 때마다 18% 에서 시작해 병이 떠다닌 시간만큼 곧게 올라 하루(24시간)면 100% 다. 병마다 던진 횟수를 세려면
 *    저장이 늘어야 해서 나이(지금 − 띄운 때)로 대신한다: 띄운 날 몇 번만 던져도 대개 건지고, 하루 넘게 안 낚았으면 다음 첫 판에 건진다.
 *  · 10글자는 자소 묶음(Intl.Segmenter — 한글 조합 · 이모지 조합을 한 글자로)으로 센다. 보낼 때 엔진이 막고, 그릴 때 한 번 더 자른다
 *    (옛 앱 · 다른 기기가 쓴 값일 수 있다). 한 글자에 조합 표시를 끝없이 붙일 수 있어서 UTF-16 길이 상한도 따로 둔다 — 섬 한 행은 1MB 다.
 *  · 순수 엔진: 시각(now) · 주사위(seed)는 호출자가 넘긴다. fishplus.ts 와 서로 부르므로 그쪽 값은 함수 안에서만 쓴다(맨 위에서 부르면
 *    모듈이 덜 만들어진 채로 읽힌다). */
import type { IslandState } from "./island.ts";
import { rng, type FishCatch, type FishResult, type GearResult } from "./fishing.ts";
import { fishPlusOf, specialCatch, withFishPlus, type SpecialCtx } from "./fishplus.ts";

export type Bottle = { id: string; from: string; text: string; at: number };
export type OpenedBottle = Bottle & { by: string; openedAt: number };

export const BOTTLE_LEN = 10;
/** 한 글자에 조합 표시를 몇십 개씩 붙여도 저장이 안 불어나게 — 10글자 × 이모지 조합(최대 10여 단위)을 넉넉히 덮는다 */
export const BOTTLE_UNITS = 80;
/** 한 사람이 동시에 띄워 둘 수 있는 병 · 바다 전체 · 남겨 두는 열어 본 편지 */
export const BOTTLE_PER_SENDER = 3;
export const BOTTLE_QUEUE = 10;
export const BOTTLE_LOG = 30;
export const BOTTLE_BASE = 0.18;
export const BOTTLE_SURE_MS = 24 * 3_600_000;
/** 개발 화면에서 혼자 시험할 때 넣는 '상대' — 혼자 하는 섬에서도 이 병만은 걸린다 */
export const DEV_PARTNER = "__dev_partner";
const BOTTLE_SEED = 0x0b077e1;

/* ── 글자 ─────────────────────────────────────────── */

type Seg = new (l?: string, o?: { granularity: "grapheme" }) => { segment(s: string): Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: Seg }).Segmenter;
/** 자소 묶음으로 나눈다 — Segmenter 가 없는 옛 브라우저는 코드 포인트(이모지 조합은 여러 글자로 셀 수 있다) */
export function graphemes(s: string): string[] {
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return Array.from(s);
}
/** 줄바꿈 · 제어 문자는 띄어쓰기로, 띄어쓰기는 한 칸으로, 앞뒤는 다듬는다. NFC — 풀어 쓴 한글(ㅎ+ㅏ+ㄴ)도 한 글자로 저장 */
export function normalizeBottleText(raw: string): string {
  return String(raw ?? "").normalize("NFC").replace(/[\r\n\u2028\u2029]+/g, " ").replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim();
}
/** 그릴 때 — 저장된 값이 길어도(옛 앱 · 다른 기기) 10글자까지만 */
export const clipBottleText = (s: string): string => graphemes(normalizeBottleText(s)).slice(0, BOTTLE_LEN).join("").slice(0, BOTTLE_UNITS);
/** 화면의 'n/10' — 입력 그대로가 아니라 보낼 모양으로 센다 */
export const bottleLength = (raw: string): number => graphemes(normalizeBottleText(raw)).length;

/** 주소는 못 넣는다 — 둘만 보는 편지지만 남의 링크를 실어 나르는 길이 되면 안 된다 */
const URL_LIKE = /(https?:|www\.|:\/\/|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|co|gg|app|xyz|link)\b)/i;

export type BottleCheck = { ok: true; text: string } | { ok: false; reason: string };
export function checkBottleText(raw: string): BottleCheck {
  const text = normalizeBottleText(raw);
  if (!text) return { ok: false, reason: "편지를 한 글자 이상 써 주세요" };
  if (graphemes(text).length > BOTTLE_LEN || text.length > BOTTLE_UNITS) return { ok: false, reason: `편지는 ${BOTTLE_LEN}글자까지 쓸 수 있어요` };
  if (URL_LIKE.test(text)) return { ok: false, reason: "주소는 넣을 수 없어요" };
  return { ok: true, text };
}

/* ── 읽기 ─────────────────────────────────────────── */

const isBottle = (b: unknown): b is Bottle => {
  const x = b as Bottle | null;
  return !!x && typeof x === "object" && typeof x.id === "string" && typeof x.from === "string" && typeof x.text === "string" && Number.isFinite(x.at);
};
/** fishPlus 는 다른 기기 · 다른 판이 쓴 값이다 — 모양이 틀린 칸은 버리고 읽는다 */
export function bottlesOf(st: Pick<IslandState, "fishPlus">): Bottle[] {
  const v = fishPlusOf(st).bottles;
  return Array.isArray(v) ? v.filter(isBottle) : [];
}
export function bottleLogOf(st: Pick<IslandState, "fishPlus">): OpenedBottle[] {
  const v = fishPlusOf(st).bottleLog;
  return Array.isArray(v) ? v.filter((b): b is OpenedBottle => isBottle(b) && typeof (b as OpenedBottle).by === "string" && Number.isFinite((b as OpenedBottle).openedAt)) : [];
}
const seqOf = (st: Pick<IslandState, "fishPlus">): number => {
  const v = fishPlusOf(st).bottleSeq;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
};

/* ── 띄우기 ─────────────────────────────────────────── */

/** 병 번호 — 보낸 사람 · 때 · 늘기만 하는 번호(bottleSeq). 남은 병 개수로 세면 건진 뒤에 같은 번호가 다시 나와
 *  '이미 열어 본 편지'로 막힌다. 그래도 겹치면 번호를 더 올린다. */
function nextId(st: IslandState, from: string, at: number): { id: string; seq: number } {
  const used = new Set([...bottlesOf(st), ...bottleLogOf(st)].map((b) => b.id));
  let seq = seqOf(st) + 1;
  const make = (n: number) => `${from.slice(0, 8)}.${Math.max(0, Math.floor(at)).toString(36)}.${n.toString(36)}`;
  while (used.has(make(seq))) seq++;
  return { id: make(seq), seq };
}

function putBottle(st: IslandState, from: string, text: string, at: number): GearResult {
  const list = bottlesOf(st);
  if (list.length >= BOTTLE_QUEUE) return { ok: false, reason: "바다에 병이 너무 많아요. 상대가 건지면 다시 띄워 주세요" };
  const { id, seq } = nextId(st, from, at);
  return { ok: true, state: withFishPlus(st, { bottles: [...list, { id, from, text, at }], bottleSeq: seq }) };
}

/** 병 띄우기 — 커플 섬 화면만 부른다(혼자 하는 섬은 화면이 숨긴다) */
export function sendBottle(st: IslandState, who: string, raw: string, now: number): GearResult {
  const c = checkBottleText(raw);
  if (!c.ok) return c;
  if (bottlesOf(st).filter((b) => b.from === who).length >= BOTTLE_PER_SENDER) return { ok: false, reason: `병은 한 번에 ${BOTTLE_PER_SENDER}개까지 띄울 수 있어요` };
  return putBottle(st, who, c.text, now);
}

/** 개발용 — 혼자 하는 미리보기에서 상대의 병을 하나 넣는다. 띄운 때를 하루 전으로 둬서 다음 판에 바로 걸린다 */
export function devSeedBottle(st: IslandState, text: string, now: number): GearResult {
  if (process.env.NODE_ENV === "production") return { ok: false, reason: "개발 화면에서만 돼요" };
  const c = checkBottleText(text);
  if (!c.ok) return c;
  return putBottle(st, DEV_PARTNER, c.text, now - BOTTLE_SURE_MS);
}

/* ── 걸리기 · 열기 ─────────────────────────────────────── */

/** 병이 떠다닌 시간으로 이번 판에 걸릴 확률 — 시계가 어긋나 나이가 음수면 0 으로 본다 */
export function bottleChance(ageMs: number): number {
  const k = Math.min(1, Math.max(0, ageMs / BOTTLE_SURE_MS));
  return BOTTLE_BASE + (1 - BOTTLE_BASE) * k;
}

/** 내가 건질 수 있는 병 — 내가 띄운 병은 아니다. 혼자 하는 섬은 개발용 병만 */
const catchable = (b: Bottle, ctx: Pick<SpecialCtx, "who" | "couple">) => b.from !== ctx.who && (ctx.couple || b.from === DEV_PARTNER);

/** 던질 때 — 가장 오래 떠다닌 병 하나를 그 나이의 확률로. 주사위는 seed 에 소금을 쳐서 따로(물고기 뽑기와 얽히지 않게) */
export function rollBottle(st: IslandState, ctx: SpecialCtx): FishCatch | null {
  const mine = bottlesOf(st).filter((b) => catchable(b, ctx)).sort((a, b) => a.at - b.at);
  const b = mine[0];
  if (!b) return null;
  const r = rng((ctx.seed ^ BOTTLE_SEED) >>> 0)();
  return r < bottleChance(ctx.now - b.at) ? specialCatch("bottle", b.id, "유리병") : null;
}

function ageNote(ms: number): string {
  const h = Math.floor(Math.max(0, ms) / 3_600_000);
  if (h < 1) return "방금 띄운 병이에요";
  if (h < 24) return `${h}시간 동안 떠다닌 병이에요`;
  return `${Math.floor(h / 24)}일 동안 떠다닌 병이에요`;
}

/** 끌어올렸다 — 떠다니는 병에서 빼서 열어 본 편지로. 같은 병을 두 번 끌어올려도(다시 보내기 · 두 기기) 한 번만 연다 */
export function landBottle(st: IslandState, c: FishCatch, ctx: SpecialCtx): FishResult {
  const id = c.special?.id;
  if (!id) return { ok: false, reason: "유리병이 아니에요" };
  const list = bottlesOf(st);
  const b = list.find((x) => x.id === id);
  const log = bottleLogOf(st);
  if (!b) return { ok: false, reason: log.some((x) => x.id === id) ? "이미 열어 본 편지예요" : "병이 물결에 떠내려갔어요" };
  if (!catchable(b, ctx)) return { ok: false, reason: "내가 띄운 병이에요" };
  const opened: OpenedBottle = { ...b, text: clipBottleText(b.text), by: ctx.who, openedAt: ctx.now };
  const state = withFishPlus(st, {
    bottles: list.filter((x) => x.id !== id),
    bottleLog: [opened, ...log.filter((x) => x.id !== id)].slice(0, BOTTLE_LOG),
  });
  return {
    ok: true, state, outcome: "special", coins: 0, levelUp: 0,
    special: { kind: "bottle", title: "유리병 편지", body: opened.text, from: b.from === DEV_PARTNER ? "연습용 편지" : "상대가 띄운 편지", note: `${ageNote(ctx.now - b.at)} · 수집 탭에 남아요` },
  };
}
