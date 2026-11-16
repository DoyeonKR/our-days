/* 계절 수조 행사 — 한정 장식 받기 (2026-11-13). 순수.
 *
 * 행사마다(한 번의 행사 = "winter:2026") 커플이 한 번, 그 행사의 한정 장식을 받는다.
 *   · 장식 자체는 이미 있는 장식(base)을 grantDecor 로 — 낚시 유물 · 시즌 미션 보상과 같은 길이라 보관함은 옛 앱도 아는 칸(s.aquarium.bag)에 남는다.
 *     옛 앱에선 보통 장식으로 보이고, 놓기 · 조합 · 아름다움도 산 것과 똑같다. 되팔 길이 없어 하트가 생기지 않는다.
 *   · 행사 빛깔(tint)과 받음 표시는 섬 **맨 위 칸 s.aquaEvent** 하나 — s.aquarium · s.aquaPlus 에 두면 옛 앱이 아는 칸만 다시 지어 버린다(aquacare.test 규칙).
 *       { claimed: ["autumn:2026", …](최근 CLAIMED_MAX), tint: { 장식 key: [행사 key, …] } }
 *     빛깔은 '그 장식 중 몇 개가 어느 행사 빛깔인가'만 센다(어느 한 조각에 묶지 않는다) — 놓인 같은 장식을 id 순으로 앞에서부터 칠한다(eventTints).
 *     그래서 옛 앱이 장식을 옮기거나 보관함에 넣었다 꺼내도 빛깔이 사라지지 않는다.
 *   · 받음 표시와 장식이 **같은 저장**이라 두 폰이 같이 눌러도 늦은 쪽은 "이미 받았어요"(버전 잠금 저장이 다시 읽어 claimBlock 에 걸린다).
 *   · 날짜는 앞으로만(§10.25) — 받은 행사 중 가장 늦게 시작한 것보다 먼저 끝난 행사는 받을 수 없다(목록이 넘쳐 밀려난 행사가 다시 열리지 않게).
 * 쓰기는 저장된 그대로에서 바꿀 칸만 고친다 — 다음 버전이 더한 칸을 지우지 않게. */
import type { IslandState } from "./island.ts";
import { decorOf, grantDecor, type PlacedDecor } from "./aquarium.ts";
import { AQUA_EVENTS, eventDef, eventsAt, occurrence, type AquaEventKey } from "./aquaevent.ts";
import { josa } from "./josa.ts";

export type AquaEventSave = { claimed: string[]; tint: Record<string, AquaEventKey[]> };
export type EventClaimResult = { ok: true; state: IslandState; note: string } | { ok: false; reason: string };

/** 받음 표시는 최근 이만큼(8개 행사 × 약 4년) */
export const CLAIMED_MAX = 32;
/** 한 장식 key 에 붙는 빛깔 수 상한 */
export const TINT_MAX = 40;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const KEYS = new Set<string>(AQUA_EVENTS.map((e) => e.key));
const isKey = (v: unknown): v is AquaEventKey => typeof v === "string" && KEYS.has(v);
const ID = /^([a-z]+):(\d{4})$/;
/** "winter:2026" → 그 행사의 시작 날(모르는 id 면 null) */
export function claimStart(id: string): string | null {
  const m = ID.exec(id);
  return m && isKey(m[1]) ? occurrence(m[1], Number(m[2]))?.start ?? null : null;
}

/** 읽기 — 저장값을 검증한다(모르는 행사 · 장식은 뺀다) */
export function readEventSave(raw: unknown): AquaEventSave {
  if (!isObj(raw)) return { claimed: [], tint: {} };
  const claimed = Array.isArray(raw.claimed) ? raw.claimed.filter((x): x is string => typeof x === "string" && claimStart(x) !== null).slice(-CLAIMED_MAX) : [];
  const tint: Record<string, AquaEventKey[]> = {};
  if (isObj(raw.tint)) for (const [k, v] of Object.entries(raw.tint)) {
    if (!decorOf(k) || !Array.isArray(v)) continue;
    const list = v.filter(isKey).slice(-TINT_MAX);
    if (list.length) tint[k] = list;
  }
  return { claimed, tint };
}
export const eventSaveOf = (st: object | null | undefined) => readEventSave((st as { aquaEvent?: unknown } | null | undefined)?.aquaEvent);

/** 받을 수 없는 이유(없으면 null) — 화면 버튼과 받기가 같은 판정을 쓴다 */
export function claimBlock(st: IslandState, key: AquaEventKey, now: number): string | null {
  const e = eventsAt(now).find((x) => x.def.key === key);
  if (!e) return "지금은 그 행사 기간이 아니에요";
  const save = eventSaveOf(st as { aquaEvent?: unknown });
  if (save.claimed.includes(e.id)) return "이미 받았어요 — 행사마다 한 번이에요";
  const newest = save.claimed.map(claimStart).reduce<string>((m, d) => (d && d > m ? d : m), "");
  if (newest && e.end <= newest) return "이미 지난 행사예요";
  return null;
}
export const hasClaimed = (st: IslandState, id: string) => eventSaveOf(st as { aquaEvent?: unknown }).claimed.includes(id);

/** 받기 — 그 행사의 한정 장식을 보관함에 넣고 받음 표시 · 빛깔을 같은 상태에 적는다 */
export function claimEventDecor(st: IslandState, key: AquaEventKey, now: number): EventClaimResult {
  const why = claimBlock(st, key, now);
  if (why) return { ok: false, reason: why };
  const e = eventsAt(now).find((x) => x.def.key === key)!;
  const def = e.def;
  const g = grantDecor(st, def.decor.base, now);
  if (!g.ok) return g;
  const raw = isObj((st as { aquaEvent?: unknown }).aquaEvent) ? { ...((st as { aquaEvent?: unknown }).aquaEvent as Record<string, unknown>) } : {};
  const save = readEventSave(raw);
  const base = def.decor.base;
  const aquaEvent = {
    ...raw,
    claimed: [...save.claimed, e.id].slice(-CLAIMED_MAX),
    tint: { ...save.tint, [base]: [...(save.tint[base] ?? []), def.key].slice(-TINT_MAX) },
  };
  const name = def.decor.name;
  return { ok: true, state: { ...g.state, aquaEvent } as IslandState, note: `${josa(name, "을/를")} 수조 보관함에 넣었어요 — 놓으면 ${def.name} 빛깔로 보여요` };
}

/** 놓인 장식 중 행사 빛깔로 그릴 것 — 같은 장식 key 끼리 id 순으로 앞에서부터. placed id → 행사 key */
export function eventTints(save: AquaEventSave, placed: readonly Pick<PlacedDecor, "id" | "key">[]): Record<number, AquaEventKey> {
  const out: Record<number, AquaEventKey> = {};
  for (const [k, list] of Object.entries(save.tint)) {
    const mine = placed.filter((p) => p.key === k).map((p) => p.id).sort((a, b) => a - b);
    for (let i = 0; i < Math.min(mine.length, list.length); i++) out[mine[i]] = list[i];
  }
  return out;
}

/** 보관함의 한정 장식 수 — 그 key 의 빛깔 수 − 놓인 수(빛깔은 놓인 것부터 칠하므로) */
export function tintedInBag(save: AquaEventSave, key: string, placedCount: number): AquaEventKey[] {
  return (save.tint[key] ?? []).slice(placedCount);
}
/** 한정 장식 이름(빛깔 이름) — 없으면 null */
export const tintName = (k: AquaEventKey) => eventDef(k)?.decor.name ?? null;
