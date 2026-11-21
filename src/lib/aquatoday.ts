// 수조 오늘 할 일(2026-11-21) [사용자: 리뷰 "수조에 매일 돌아올 이유가 약해요 … 오늘 할 일 한 줄" · "배고픈 사냥꾼 알림이 없어요" → "진행해"]
// 먹이 · 물 · 손님 · 대기 그물 · 가득 찬 수조 · 배고픈 사냥꾼이 저마다 다른 칸에 흩어져 있어 무엇이 급한지 한눈에 안 보였다.
// 순수 함수 — 수조 화면(머리 칩)과 게임 탭 카드(한 줄)가 같은 판정을 본다. 정산(tickAqua/syncAqua)이 끝난 수조를 받는다.
import { HUNGRY_BELOW, nextMealTime } from "./predation.ts";
import { BREED_H, GOOD_HUNGER, GOOD_WATER, aquaDangers, aquaEffects, breedPairs, careHoursLeft, fishRoom, requestMet, type AquaState } from "./aquarium.ts";
import { modsAt } from "./aquaevent.ts";

export type AquaTodayKey = "hunter" | "feed" | "water" | "request" | "net" | "full";
export type AquaTodayItem = { key: AquaTodayKey; text: string; urgent: boolean };

/** 먹이까지 이만큼 남았으면 '곧' 으로 미리 알린다 */
export const FEED_SOON_H = 3;

/** 급한 순서 — 배고픈 사냥꾼(물고기를 잃는다) → 먹이 · 물(정성이 멈췄다) → 손님 → 대기 그물(하루 지나면 팔린다) → 가득 찬 수조 */
export function aquaTodayItems(a: AquaState): AquaTodayItem[] {
  if (!a.fish.length) return [];
  const out: AquaTodayItem[] = [];
  const left = careHoursLeft(a);
  const pairs = aquaDangers(a);
  if (pairs.length && a.hunger < HUNGRY_BELOW) {
    const prey = new Set(pairs.map((p) => p.prey.id)).size;
    out.push({ key: "hunter", text: `배고픈 사냥꾼 — 먹이를 주세요(위험 ${prey}마리)`, urgent: true });
  } else if (left.feed <= 0) out.push({ key: "feed", text: "먹이 주기", urgent: true });
  else if (left.feed <= FEED_SOON_H) out.push({ key: "feed", text: `먹이 ${Math.max(1, Math.ceil(left.feed))}시간 뒤`, urgent: false });
  if (left.clean <= 0) out.push({ key: "water", text: "물 갈기", urgent: true });
  if (a.req && !a.req.done) out.push({ key: "request", text: requestMet(a) ? "손님에게 보여 주기" : "오늘의 손님 부탁", urgent: requestMet(a) });
  const net = a.net?.length ?? 0;
  if (net > 0) out.push({ key: "net", text: `대기 그물 ${net}마리`, urgent: fishRoom(a) > 0 });
  else if (fishRoom(a) <= 0 && a.fish.some((f) => f.stage === 2)) out.push({ key: "full", text: "수조 가득 — 다 큰 물고기 보내기", urgent: false });
  return out;
}

/** 게임 탭 카드 한 줄 — 급한 것만(없으면 null) */
export function aquaAlert(a: AquaState | null): string | null {
  if (!a) return null;
  const first = aquaTodayItems(a).find((x) => x.urgent);
  return first ? first.text : null;
}

/* ── 알(번식) 진행 · 다음 사냥 시각(2026-11-21 리뷰 ② · ③) ───────────────────────── */

/** 알 — 짝(다 큰 같은 계열 둘 이상)이 잘 지낸 시간이 BREED_H 만큼 쌓이면 치어 하나. 화면이 진행을 보이게 정산과 같은 값으로 센다.
 *  · pairs: 짝이 있는 계열 · single: 다 큰 물고기가 하나뿐인 계열(하나 더 있으면 짝)
 *  · h: 쌓인 시간 · leftH: 지금처럼 잘 돌보면 남은 실제 시간(못 돌보는 중이면 null) · blocked: 쌓이지 않는 까닭 */
export type BreedInfo = { pairs: string[]; single: string[]; h: number; need: number; leftH: number | null; blocked: "room" | "care" | null };
export function breedInfo(a: AquaState): BreedInfo {
  const adults = new Map<string, number>();
  for (const f of a.fish) if (f.stage === 2) adults.set(f.family, (adults.get(f.family) ?? 0) + 1);
  const pairs = breedPairs(a);
  const single = [...adults].filter(([, n]) => n === 1).map(([k]) => k).sort();
  const h = Math.min(BREED_H, a.breedH ?? 0);
  const good = a.hunger >= GOOD_HUNGER && a.water >= GOOD_WATER;
  const room = fishRoom(a) > 0;
  const blocked = !pairs.length ? null : !room ? "room" : !good ? "care" : null;
  const rate = aquaEffects(a, modsAt(a.at)).breed;
  const leftH = pairs.length && !blocked ? Math.max(0, BREED_H - h) / Math.max(0.01, rate) : null;
  return { pairs, single, h, need: BREED_H, leftH, blocked };
}

/** 다음 사냥이 일어날 때(절대 ms) — 상성이 안 맞는 짝이 있고, 사냥 기회 시각(predation 의 시각표)에 포만이 HUNGRY_BELOW 밑일 첫 때.
 *  먹이를 안 준다고 칠 때의 예측이다(먹이를 주면 미뤄진다). 72시간 안에 없으면 null */
export function nextHuntAt(a: AquaState, now: number): number | null {
  if (!aquaDangers(a).length) return null;
  const perH = 100 / aquaEffects(a, modsAt(a.at)).hungerHours;
  const until = now + 72 * HOUR_MS;
  let from = now;
  for (let i = 0; i < 40; i++) {
    const r = nextMealTime(from, until);
    if (!r) return null;
    const hunger = a.hunger - Math.max(0, (r.t - a.at) / HOUR_MS) * perH;
    if (hunger < HUNGRY_BELOW) return r.t;
    from = r.t;
  }
  return null;
}
const HOUR_MS = 3_600_000;

/** 한국 시각으로 '오늘 오후 3시' · '내일 오전 9시' */
export function kstWhen(t: number, now: number): string {
  const k = (ms: number) => new Date(ms + 9 * HOUR_MS);
  const d = k(t), n = k(now);
  const day = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) / 86_400_000);
  const hr = d.getUTCHours(), ap = hr < 12 ? "오전" : "오후", h12 = hr % 12 === 0 ? 12 : hr % 12;
  const mm = d.getUTCMinutes();
  return `${day === 0 ? "오늘" : day === 1 ? "내일" : "모레"} ${ap} ${h12}시${mm ? ` ${mm}분` : ""}`;
}
