/** 주인 레이드 점수에 따른 토벌 보상(2026-11-18) [사용자: 레이드 점수에 따라 보상을 다르게 — 0.8배 ~ 1.25배, 결과 화면에 단계]
 *
 *  왜 '토벌 판 점수'가 아니라 '이번 출현의 평균'인가 — 토벌 판은 남은 체력을 다 깎는 순간 끝나서(bossraid 의 killAt)
 *  점수 = 남은 체력 ÷ 한 판 몫이다. 체력 3% 남은 주인을 끝낸 판은 아무리 잘해도 점수가 작다. 보상은 둘이 6~11판에 걸쳐
 *  깎은 끝에 한 번 나오므로, 이번에 나타난 뒤 둘이 낸 레이드 점수의 평균으로 단계를 정한다.
 *
 *  저장은 섬 맨 위 칸 s.raidMark — s.fishing(bosses)은 옛 앱이 아는 칸으로 다시 지어 모르는 칸을 버린다(§14.4.6 · fishplus.ts 머리말).
 *    raidMark[주인 key] = { n: 이 점수들이 쌓인 출현 번호(caught), s: [[판 번호, 점수×100], …] 최근 RAID_MARK_KEEP 판,
 *                          p?: [토벌 뒤 출현 번호, 준 배율] — 응답을 잃어 다시 저장할 때 같은 보상 문구를 보이려고 }
 *  · 판 번호(레이드 시드)로 같은 판을 두 번 적지 않는다(응답을 잃어 다시 저장해도 한 번).
 *  · 출현 번호가 바뀌면(상대가 잡았다 · 다음 출현) 지난 점수는 버린다 — 다음 주인에 얹지 않는다.
 *  · 옛 앱이 싸운 판은 점수가 없다 — 점수가 하나도 없으면 1배(지금과 같은 보상).
 *  · 찌낚시 주인전은 2026-11-11 부터 들어갈 길이 없다(bossraid.test) — 옛 저장을 끝내는 길만 남아 점수를 적지 않는다(그 출현은 레이드 점수로만).
 *  ⚠ 값 import 는 없다(fishing.ts 가 이 파일을 부른다 — 고리 금지). */
import type { IslandState } from "./island.ts";

export const RAID_MARK_KEEP = 16;
export type RaidMarkRec = { n: number; s: [number, number][]; p?: [number, number] };
export type RaidTier = { key: string; name: string; min: number; mult: number };

/** 단계 — 아래부터. 2026-11-11 튜닝 뒤 봇 기준 점수는 대충 하는 손 0.57~0.70 · 잘하는 손 0.81~0.88(§10.24).
 *  1년 모형(econbalance.test)으로 정했다: §10.25 시뮬레이션은 점수 0.85 를 가정했으므로 0.85 가 1배('잘했어요')여야 그 해 경제가 그대로다.
 *  처음 안(0.8 부터 1.1배)은 0.85 가정에서 주인 수입이 +4.9% · 보내 주기까지 +5.4% 로 ±5% 를 넘었다.
 *  그래서 1.1배는 잘하는 봇의 위쪽(0.86~)부터, 1.25배는 봇도 못 넘는 0.93 부터 — 둘 다 '평소보다 잘한 출현'의 보상이다.
 *  0.9배는 대충 하는 손(0.5~0.68), 0.8배는 줄이 거의 다 끊긴 판들(0.5 밑). */
export const RAID_TIERS: readonly RaidTier[] = [
  { key: "c", name: "아쉬워요", min: 0, mult: 0.8 },
  { key: "b", name: "괜찮아요", min: 0.5, mult: 0.9 },
  { key: "a", name: "잘했어요", min: 0.68, mult: 1 },
  { key: "s", name: "훌륭해요", min: 0.86, mult: 1.1 },
  { key: "ss", name: "완벽해요", min: 0.93, mult: 1.25 },
];
/** 점수가 없을 때(옛 앱이 싸웠다 · 찌낚시만) — 예전과 같은 1배 */
export const RAID_TIER_NONE: RaidTier = { key: "none", name: "기록 없음", min: 0, mult: 1 };
export function raidTier(avg: number | null): RaidTier {
  if (avg === null || !Number.isFinite(avg)) return RAID_TIER_NONE;
  let t = RAID_TIERS[0];
  for (const x of RAID_TIERS) if (avg >= x.min - 1e-9) t = x;
  return t;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** 저장값 읽기 — 다른 기기 · 손상된 값이 화면을 깨지 않게 모양을 검사하고 상한을 다시 건다 */
export function raidMarkOf(st: Pick<IslandState, "raidMark">): Record<string, RaidMarkRec> {
  const raw = st.raidMark;
  const out: Record<string, RaidMarkRec> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!isObj(v) || !Number.isFinite(v.n)) continue;
    const s = Array.isArray(v.s)
      ? v.s.filter((x): x is [number, number] => Array.isArray(x) && x.length === 2 && Number.isFinite(x[0]) && Number.isFinite(x[1])).map(([i, p]) => [i, Math.max(0, Math.min(100, Math.round(p)))] as [number, number]).slice(-RAID_MARK_KEEP)
      : [];
    const p = Array.isArray(v.p) && v.p.length === 2 && Number.isFinite(v.p[0]) && Number.isFinite(v.p[1]) ? [Number(v.p[0]), Number(v.p[1])] as [number, number] : undefined;
    out[k] = { n: Math.floor(Number(v.n)), s, ...(p ? { p } : {}) };
  }
  return out;
}
const withMark = (st: IslandState, key: string, rec: RaidMarkRec): IslandState => ({ ...st, raidMark: { ...raidMarkOf(st), [key]: rec } });

/** 한 판의 점수를 적는다 — seen = 판을 열 때 본 출현 번호, id = 판 번호. 같은 판은 한 번만 */
export function noteRaidScore(st: IslandState, key: string, seen: number, id: number, score: number): IslandState {
  if (!Number.isFinite(score) || !Number.isFinite(id)) return st;
  const cur = raidMarkOf(st)[key];
  const base: RaidMarkRec = cur && cur.n === seen ? cur : { n: seen, s: [], ...(cur?.p ? { p: cur.p } : {}) };
  if (base.s.some(([i]) => i === id)) return st;
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  return withMark(st, key, { ...base, s: [...base.s, [id, pct] as [number, number]].slice(-RAID_MARK_KEEP) });
}
/** 이번 출현(seen)에 둘이 낸 점수들(0~1) — 레이드 결과 화면이 이 판을 더한 평균을 미리 보인다 */
export function raidScores(st: Pick<IslandState, "raidMark">, key: string, seen: number): number[] {
  const r = raidMarkOf(st)[key];
  return r && r.n === seen ? r.s.map(([, p]) => p / 100) : [];
}
/** 점수들의 평균 — 비면 null */
export const avgOf = (list: readonly number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
/** 이번 출현(seen)에 둘이 낸 점수의 평균 — 없으면 null */
export function raidAvg(st: Pick<IslandState, "raidMark">, key: string, seen: number): number | null {
  const r = raidMarkOf(st)[key];
  if (!r || r.n !== seen || r.s.length === 0) return null;
  return r.s.reduce((a, [, p]) => a + p, 0) / r.s.length / 100;
}
/** 토벌 때 준 배율을 남긴다 — after = 토벌 뒤 출현 번호(caught + 1). 지난 점수는 비운다 */
export function notePaid(st: IslandState, key: string, after: number, mult: number): IslandState {
  return withMark(st, key, { n: after, s: [], p: [after, mult] });
}
/** 이미 저장된 토벌을 다시 받았을 때 — 그때 준 배율(없으면 1) */
export function paidMult(st: Pick<IslandState, "raidMark">, key: string, after: number): number {
  const p = raidMarkOf(st)[key]?.p;
  return p && p[0] === after ? p[1] : 1;
}
/** 준 배율로 단계 이름 찾기(다시 받은 저장의 문구용) — 표에 없는 값이면 '기록 없음' */
export const raidTierOfMult = (mult: number): RaidTier => RAID_TIERS.find((x) => Math.abs(x.mult - mult) < 1e-9) ?? RAID_TIER_NONE;
/** 배율을 곱한 보상 — 하트는 정수 */
export const tierReward = (base: number, mult: number) => Math.round(base * mult);
