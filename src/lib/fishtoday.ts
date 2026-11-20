// 오늘 할 일 한 줄 — 2026-11-20 [사용자: 리뷰 "기능 수에 비해 장기 목표가 흩어져 있어요 … 매일 무엇부터 하면 좋을지" → "이렇게만 진행해"]
// 의뢰 · 목표 · 주인 도전이 저마다 다른 칸에 있어 오늘 무엇이 남았는지 한눈에 안 보였다. 낚시 화면 위 칩 하나가 남은 것을 급한 순서로 센다.
// 순수 함수 — 목표 탭 · 장비 탭 · 주인 칩이 쓰는 같은 판정(claimableGoals · todayRequests · bossBlockOf)을 그대로 쓴다.
// 원정은 아래 준비 줄에 이미 늘 보여서(원정 n/m) 여기엔 넣지 않는다.
import { bossBlockOf, type FishingState } from "./fishing.ts";
import { claimableGoals } from "./fishinggoals.ts";
import { todayRequests } from "./fishrequest.ts";
import { BOSSES } from "./fishingworld.ts";
import type { IslandState } from "./island.ts";

export type TodayItem = { key: "goal" | "request" | "boss"; n: number; text: string };

/** 남은 것을 급한 순서로 — 받기만 하면 되는 목표 → 오늘의 의뢰 → 싸우던 주인 중 오늘 도전할 수 있는 것. 없으면 빈 배열 */
export function fishTodayItems(st: Pick<IslandState, "fishPlus" | "seed" | "fishing">, fs: FishingState, today: string, who: string): TodayItem[] {
  const out: TodayItem[] = [];
  const goals = claimableGoals(fs, today);
  if (goals > 0) out.push({ key: "goal", n: goals, text: `받을 목표 ${goals}` });
  const req = todayRequests(st, today);
  const left = req.frozen ? 0 : req.done.filter((d) => !d).length;
  if (left > 0) out.push({ key: "request", n: left, text: `의뢰 ${left}개` });
  // 이미 싸우기 시작한 주인만(기록이 있다) — 열린 주인을 다 세면 Lv.30 에 14곳이라 할 일이 아니었다(2026-11-20 화면 확인)
  const bosses = BOSSES.filter((b) => fs.bosses[b.key] && bossBlockOf(fs, b, who, today) === null).length;
  if (bosses > 0) out.push({ key: "boss", n: bosses, text: `주인 도전 ${bosses}곳` });
  return out;
}

/** 칩에 쓰는 글 — 가장 급한 것 하나 + 나머지 개수 */
export function fishTodayLabel(items: readonly TodayItem[]): string | null {
  if (!items.length) return null;
  return items.length > 1 ? `${items[0].text} 외 ${items.length - 1}` : items[0].text;
}
