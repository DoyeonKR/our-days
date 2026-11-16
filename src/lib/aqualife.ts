/** 물고기 개체 이야기(2026-11-13) [사용자: 색 변이 품종 · 물고기 개체 이야기 "Build all"]
 *
 *  물고기마다 이름(둘이 지어 준다) · 수조에서 지낸 날 · 짧은 이야기(어디서 누가 잡았나 · 언제 자랐나 · 누구의 알에서 깼나 ·
 *  누구를 먹었나)가 남고, 떠난 물고기(잡아먹힘 · 보내 줌)는 추모 칸에 이름 · 산 날 · 까닭으로 남는다.
 *
 *  · 저장은 섬 맨 위 칸 s.aquaLife(stow 가 쓴다). s.aquarium · s.aquaPlus 는 옛 앱이 아는 칸으로 다시 지어 모르는 칸을 버린다 —
 *    맨 위 칸은 옛 앱도 ...st 로 그대로 흘린다(fishPlus · aquaTankTop 과 같은 이유).
 *  · 이야기는 따로 지어내지 않고 소식(news)을 쓰는 같은 자리에서 남긴다(aquarium.ts pushNews). 옛 앱이 남긴 소식은
 *    n(어디까지 옮겼나)보다 뒤인 것을 다음 정산에서 '무렵'(a)으로 옮긴다. 옛 앱이 소식 없이 뺀 물고기(보내 줌)는 '떠났어요'.
 *  · 크기 상한 — 물고기마다 12줄(처음 한 줄 + 최근 11줄) · 추모 30 · 이름 10글자. 섬 한 행은 1MB 를 넘으면 저장이 거절된다.
 *  · 시각은 분 단위로 둥근다 — 쪼개 정산해도(소수점 끝이 달라도) 같은 줄이 된다.
 *  ⚠ 값 import 는 shorttext · aquamorph 뿐이다(aquarium.ts 가 이 파일을 부른다 — 고리 금지). */
import { isMorph, type Morph } from "./aquamorph.ts";
import { URL_LIKE, VISIBLE, clipShortText, graphemes, normalizeShortText } from "./shorttext.ts";

export type LifeRef = { id: number; key: string };
type Base = { t: number; /** 정확한 때를 모른다(옛 앱 · 기록 전) — '무렵' */ a?: 1 };
export type LifeEntry = Base & (
  | { k: "caught"; key: string; spot?: string; by?: string; net?: 1 }
  | { k: "hatched"; key: string; p?: LifeRef[]; m?: Morph }
  | { k: "grew"; key: string; stage: 1 | 2 }
  | { k: "ate"; prey: LifeRef }
  | { k: "named"; name: string; by?: string }
  | { k: "start"; key: string }
);
export type LifeCause = "eaten" | "released" | "gone";
export type Memorial = { id: number; key: string; name?: string; morph?: Morph; from?: number; to: number; cause: LifeCause; by?: LifeRef; a?: 1 };
export type AquaLife = { names: Record<string, string>; log: Record<string, LifeEntry[]>; memorial: Memorial[]; /** 이야기로 옮긴 마지막 소식 번호 */ n: number };

export const NAME_LEN = 10;
/** UTF-16 상한 — 한 글자에 조합 표시를 끝없이 붙여도 안 불어나게(유리병 편지와 같은 160 — 가족 이모지 열 글자가 110 단위다) */
export const NAME_UNITS = 160;
export const LOG_MAX = 12;
export const MEMORIAL_MAX = 30;

/** 분 단위로 둥근 시각 */
export const lifeTime = (t: number) => Math.round(t / 60_000) * 60_000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 64) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);
const ref = (v: unknown): LifeRef | undefined => (isObj(v) && Number.isFinite(v.id) && str(v.key) ? { id: Number(v.id), key: v.key as string } : undefined);

function readEntry(v: unknown): LifeEntry | null {
  if (!isObj(v) || !Number.isFinite(v.t)) return null;
  const base: Base = { t: Number(v.t), ...(v.a === 1 ? { a: 1 as const } : {}) };
  const key = str(v.key);
  switch (v.k) {
    case "caught": return key ? { ...base, k: "caught", key, ...(str(v.spot) ? { spot: v.spot as string } : {}), ...(str(v.by, 80) ? { by: v.by as string } : {}), ...(v.net === 1 ? { net: 1 as const } : {}) } : null;
    case "hatched": {
      if (!key) return null;
      const p = Array.isArray(v.p) ? v.p.map(ref).filter((x): x is LifeRef => !!x).slice(0, 2) : [];
      return { ...base, k: "hatched", key, ...(p.length ? { p } : {}), ...(isMorph(v.m) ? { m: v.m } : {}) };
    }
    case "grew": return key && (v.stage === 1 || v.stage === 2) ? { ...base, k: "grew", key, stage: v.stage } : null;
    case "ate": { const prey = ref(v.prey); return prey ? { ...base, k: "ate", prey } : null; }
    case "named": return typeof v.name === "string" ? { ...base, k: "named", name: clipName(v.name), ...(str(v.by, 80) ? { by: v.by as string } : {}) } : null;
    case "start": return key ? { ...base, k: "start", key } : null;
    default: return null;
  }
}
function readMemorial(v: unknown): Memorial | null {
  if (!isObj(v) || !Number.isFinite(v.id) || !Number.isFinite(v.to) || !str(v.key)) return null;
  const cause: LifeCause = v.cause === "eaten" || v.cause === "released" ? v.cause : "gone";
  const by = ref(v.by), name = typeof v.name === "string" ? clipName(v.name) : "";
  return {
    id: Number(v.id), key: v.key as string, to: Number(v.to), cause,
    ...(name ? { name } : {}), ...(isMorph(v.morph) ? { morph: v.morph } : {}), ...(Number.isFinite(v.from) ? { from: Number(v.from) } : {}),
    ...(by ? { by } : {}), ...(v.a === 1 ? { a: 1 as const } : {}),
  };
}
/** 처음 한 줄(어떻게 왔나)은 늘 남기고 나머지는 최근 것부터 */
const capLog = (list: LifeEntry[]) => (list.length <= LOG_MAX ? list : [list[0], ...list.slice(-(LOG_MAX - 1))]);

/** 저장값 읽기 — 다른 기기 · 다른 판이 쓴 값이라 모양을 검사하고 상한을 다시 건다. 없으면 지금 소식 번호부터 옮긴다(지난 소식을 '오늘'로 적지 않게) */
export function readLife(v: unknown, newsN: number): AquaLife {
  const o = isObj(v) ? v : {};
  const names: Record<string, string> = {}, log: Record<string, LifeEntry[]> = {};
  if (isObj(o.names)) for (const [id, n] of Object.entries(o.names)) { const c = typeof n === "string" ? clipName(n) : ""; if (c) names[id] = c; }
  if (isObj(o.log)) for (const [id, l] of Object.entries(o.log)) {
    const list = Array.isArray(l) ? l.map(readEntry).filter((x): x is LifeEntry => !!x) : [];
    if (list.length) log[id] = capLog(list);
  }
  const memorial = Array.isArray(o.memorial) ? o.memorial.map(readMemorial).filter((x): x is Memorial => !!x).slice(0, MEMORIAL_MAX) : [];
  const n = typeof o.n === "number" && Number.isFinite(o.n) ? Math.max(0, Math.floor(o.n)) : Math.max(0, Math.floor(newsN));
  return { names, log, memorial, n };
}

/* ── 이름 ─────────────────────────────────────────── */

/** 그릴 때 — 저장된 값이 길어도 10글자까지만 */
export const clipName = (s: string): string => clipShortText(s, NAME_LEN, NAME_UNITS);
export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };
/** 이름 검사 — 빈 이름은 '이름 지우기'다(ok, name ""). 10글자(자소 묶음) · 주소 금지 · NFC */
export function checkFishName(raw: string): NameCheck {
  const name = normalizeShortText(raw);
  if (!name) return { ok: true, name: "" };
  if (!VISIBLE.test(name)) return { ok: false, reason: "보이는 글자로 지어 주세요" };
  if (graphemes(name).length > NAME_LEN || name.length > NAME_UNITS) return { ok: false, reason: `이름은 ${NAME_LEN}글자까지 지을 수 있어요` };
  if (URL_LIKE.test(name)) return { ok: false, reason: "주소는 이름으로 쓸 수 없어요" };
  return { ok: true, name };
}

/* ── 고치기(전부 새 객체 — 저장값을 건드리지 않는다) ─────────────── */

export function lifeLog(life: AquaLife, id: number, e: LifeEntry): AquaLife {
  const k = String(id);
  return { ...life, log: { ...life.log, [k]: capLog([...(life.log[k] ?? []), { ...e, t: lifeTime(e.t) }]) } };
}
export function lifeName(life: AquaLife, id: number, name: string): AquaLife {
  const names = { ...life.names };
  if (name) names[String(id)] = name;
  else delete names[String(id)];
  return { ...life, names };
}
/** 이 물고기가 처음 적힌 때(수조에 온 때) */
export const lifeSince = (life: AquaLife | undefined, id: number): LifeEntry | undefined => life?.log[String(id)]?.[0];
/** 마지막으로 알던 모습 */
export function lifeKey(life: AquaLife, id: number): string | undefined {
  const list = life.log[String(id)] ?? [];
  for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if ("key" in e) return e.key; }
  return undefined;
}
/** 떠났다 — 추모 칸에 올리고(같은 id 는 한 번만) 이름 · 이야기를 지운다 */
export function lifeLeave(life: AquaLife, f: LifeRef, cause: LifeCause, to: number, extra: { by?: LifeRef; morph?: Morph | null; approx?: boolean } = {}): AquaLife {
  const k = String(f.id), first = life.log[k]?.[0], name = life.names[k];
  const names = { ...life.names }, log = { ...life.log };
  delete names[k];
  delete log[k];
  if (life.memorial.some((m) => m.id === f.id)) return { ...life, names, log };
  const m: Memorial = {
    id: f.id, key: f.key, to: lifeTime(to), cause,
    ...(name ? { name } : {}), ...(extra.morph ? { morph: extra.morph } : {}), ...(first ? { from: first.t } : {}),
    ...(extra.by ? { by: extra.by } : {}), ...(extra.approx ? { a: 1 as const } : {}),
  };
  return { ...life, names, log, memorial: [m, ...life.memorial].slice(0, MEMORIAL_MAX) };
}
/** 정산 뒤 — 이야기가 없는 물고기(옛 앱이 담았다 · 기록 전부터 있었다)에 첫 줄을 '무렵'으로, 수조에 없는데 이야기가 남은 물고기(옛 앱이 보내 줬다)는 추모 칸으로 */
export function lifeSettle(life: AquaLife, living: readonly LifeRef[], keep: ReadonlySet<number>, t0: number): AquaLife {
  let out = life;
  const alive = new Set([...living.map((f) => f.id), ...keep]);
  for (const id of new Set([...Object.keys(out.log), ...Object.keys(out.names)].map(Number))) {
    if (alive.has(id)) continue;
    const key = lifeKey(out, id);
    out = key ? lifeLeave(out, { id, key }, "gone", t0, { approx: true }) : (() => { const names = { ...out.names }, log = { ...out.log }; delete names[String(id)]; delete log[String(id)]; return { ...out, names, log }; })();
  }
  for (const f of living) if (!out.log[String(f.id)]?.length) out = lifeLog(out, f.id, { k: "start", t: t0, key: f.key, a: 1 });
  return out;
}
/** 살아 있는 날 — 처음 적힌 때부터(그날 = 1일째) */
export const lifeDays = (from: number, to: number) => Math.max(1, Math.floor((to - from) / 86_400_000) + 1);
