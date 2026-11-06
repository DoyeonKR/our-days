/* 매달 '지난달의 우리' 팝업 — 언제 띄우나 · 무엇을 말하나. [사용자 2026-11-05 "1일마다 이전 달의 우리를 보여주는 팝업"]
 * 1일에 앱을 안 열면 영영 못 보므로, 그달 처음 여는 날(1~7일) 한 번 띄운다.
 * ⚠ 홈 첫 로드에 실린다 — 값으로는 아무것도 불러오지 않는다. */
import type { MonthlyRecap } from "@/lib/memories";

export const RECAP_POPUP_DAYS = 7;

/** YYYY-MM-DD → 지난달 YYYY-MM */
export function previousMonth(today: string): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** 지금 보여 줄 달. 없으면 null. */
export function recapPopupMonth(today: string, seen: string | null): string | null {
  if (Number(today.slice(8, 10)) > RECAP_POPUP_DAYS) return null;
  const month = previousMonth(today);
  return seen === month ? null : month;
}

/** 지금 띄워도 되나 — 알림 · 링크로 다른 곳에 가는 중이면 그 자리를 덮지 않는다(2026-11-06 화면 리뷰).
 *  routed: 이번에 알림 · 링크 · 활동함으로 들어왔다(사용자가 홈 탭을 다시 누를 때까지) · focusPending: 카드 · 사진 · 일정으로 가는 중. */
export function recapPopupAllowed(s: { view: string; routed: boolean; focusPending: boolean }): boolean {
  return s.view === "home" && !s.routed && !s.focusPending;
}

const key = (coupleId: string, userId: string | null) => `ourdays:recap-popup:${coupleId}:${userId ?? "me"}`;

export function recapPopupSeen(coupleId: string, userId: string | null): string | null {
  try {
    return localStorage.getItem(key(coupleId, userId));
  } catch {
    return null;
  }
}

export function markRecapPopupSeen(coupleId: string, userId: string | null, month: string): void {
  try {
    localStorage.setItem(key(coupleId, userId), month);
  } catch {
    /* 저장이 막힌 기기에선 다음에 또 뜬다 */
  }
}

/** 팝업의 이야기 줄 — 숫자만 늘어놓지 않게. photoDays = 그 달 사진의 찍은 날(YYYY-MM-DD). */
export function recapHighlights(recap: MonthlyRecap, before: MonthlyRecap | null, photoDays: readonly string[]): string[] {
  const [y, m] = recap.monthKey.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lines = [`${m}월 ${days}일 중 ${recap.activeDays}일을 함께 기록했어요`];
  const grew = before ? recap.total - before.total : 0;
  if (grew > 0) lines.push(`지난달보다 ${grew}개의 순간을 더 남겼어요`);
  const count = new Map<string, number>();
  for (const d of photoDays) count.set(d, (count.get(d) ?? 0) + 1);
  let best: [string, number] | null = null;
  for (const [d, n] of count) if (!best || n > best[1] || (n === best[1] && d < best[0])) best = [d, n];
  if (best && best[1] >= 2) lines.push(`${Number(best[0].slice(5, 7))}월 ${Number(best[0].slice(8, 10))}일에 사진을 가장 많이 남겼어요 · ${best[1]}장`);
  return lines;
}
