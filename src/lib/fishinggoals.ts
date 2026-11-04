/* 낚시 목표 (2026-11-03) — 도감 · 수집함 · 기록이 칸마다 흩어져 있어 '다음에 뭘 하지'가 안 보였다. 한 판에 모으고 하트로 보상한다.
 * 진행은 전부 이미 있는 기록에서 파생한다(저장하는 건 받았는지뿐). 오늘의 목표 하트는 낚시 하루 한도와 따로 센다 — 목표를 깼는데 한도 때문에 0 이면 거짓말이다. */
import type { FishingState } from "./fishing.ts";

export type FishGoal = { id: string; name: string; now: number; need: number; coins: number; done: boolean; claimed: boolean };
type Track = { key: string; name: (n: number) => string; steps: readonly (readonly [number, number])[]; value: (f: FishingState) => number };

const TRACKS: readonly Track[] = [
  { key: "landed", name: (n) => `물고기 ${n}마리 끌어올리기`, steps: [[10, 100], [50, 300], [200, 800], [1000, 3000]], value: (f) => f.landed },
  { key: "seen", name: (n) => `서로 다른 물고기 ${n}종 만나기`, steps: [[5, 150], [20, 500], [40, 1500], [60, 5000], [100, 10000], [135, 20000]], value: (f) => f.seen.length },
  { key: "junk", name: (n) => `쓰레기 ${n}종 건지기`, steps: [[5, 120], [15, 1000]], value: (f) => Object.values(f.junk).filter((v) => v > 0).length },
  { key: "cast", name: (n) => `${n}m 던지기`, steps: [[30, 150], [50, 600], [65, 1500]], value: (f) => Math.floor(f.bestCast) },
  { key: "level", name: (n) => `낚시 Lv.${n} 되기`, steps: [[5, 200], [15, 800], [30, 2500], [50, 8000]], value: (f) => f.level },
  { key: "grade", name: (n) => `${["", "보통", "고급", "희귀", "영웅", "전설", "신화", "태초"][n]} 등급 낚기`, steps: [[3, 300], [4, 800], [5, 2000], [6, 4000], [7, 8000]], value: (f) => f.topGrade },
];

const DAILY: readonly { id: string; name: string; need: number; coins: number; value: (f: FishingState) => number }[] = [
  { id: "d_landed", name: "오늘 3마리 끌어올리기", need: 3, coins: 60, value: (f) => f.dayLanded },
  { id: "d_stored", name: "오늘 1마리 수조에 담기", need: 1, coins: 60, value: (f) => f.dayStored },
  { id: "d_cast", name: "오늘 15m 넘게 던지기", need: 15, coins: 40, value: (f) => Math.floor(f.dayCast) },
];

/** 하루가 바뀌었으면 오늘 칸을 비워서 본다 */
export const fishDay = (f: FishingState, today: string): FishingState =>
  f.day === today ? f : { ...f, dayCoins: 0, dayLanded: 0, dayStored: 0, dayCast: 0, dayClaimed: [] };

export function dailyGoals(f0: FishingState, today: string): FishGoal[] {
  const f = fishDay(f0, today);
  return DAILY.map((d) => {
    const now = d.value(f);
    return { id: d.id, name: d.name, now: Math.min(now, d.need), need: d.need, coins: d.coins, done: now >= d.need, claimed: f.dayClaimed.includes(d.id) };
  });
}

/** 길마다 아직 안 받은 가장 가까운 목표 하나씩 */
export function nextGoals(f: FishingState): FishGoal[] {
  const out: FishGoal[] = [];
  for (const t of TRACKS) {
    const v = t.value(f);
    const step = t.steps.find(([n]) => !f.goals.includes(`${t.key}_${n}`));
    if (!step) continue;
    const [need, coins] = step;
    out.push({ id: `${t.key}_${need}`, name: t.name(need), now: Math.min(v, need), need, coins, done: v >= need, claimed: false });
  }
  return out;
}

export const goalTotal = () => TRACKS.reduce((n, t) => n + t.steps.length, 0);

/** 받을 수 있는 목표 수 — 탭의 숫자 */
export const claimableGoals = (f: FishingState, today: string) =>
  dailyGoals(f, today).filter((g) => g.done && !g.claimed).length + nextGoals(f).filter((g) => g.done).length;

/** 목표 보상 받기 — 받을 수 없으면 null */
export function claimGoal(f0: FishingState, id: string, today: string): { f: FishingState; coins: number } | null {
  const f = fishDay(f0, today);
  const d = dailyGoals(f, today).find((g) => g.id === id);
  if (d) return d.done && !d.claimed ? { f: { ...f, day: today, dayClaimed: [...f.dayClaimed, id] }, coins: d.coins } : null;
  const g = nextGoals(f).find((x) => x.id === id);
  return g?.done ? { f: { ...f0, goals: [...f0.goals, id] }, coins: g.coins } : null;
}
