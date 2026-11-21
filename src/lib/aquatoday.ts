// 수조 오늘 할 일(2026-11-21) [사용자: 리뷰 "수조에 매일 돌아올 이유가 약해요 … 오늘 할 일 한 줄" · "배고픈 사냥꾼 알림이 없어요" → "진행해"]
// 먹이 · 물 · 손님 · 대기 그물 · 가득 찬 수조 · 배고픈 사냥꾼이 저마다 다른 칸에 흩어져 있어 무엇이 급한지 한눈에 안 보였다.
// 순수 함수 — 수조 화면(머리 칩)과 게임 탭 카드(한 줄)가 같은 판정을 본다. 정산(tickAqua/syncAqua)이 끝난 수조를 받는다.
import { HUNGRY_BELOW } from "./predation.ts";
import { aquaDangers, careHoursLeft, fishRoom, requestMet, type AquaState } from "./aquarium.ts";

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
