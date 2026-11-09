// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
import { MAX_LEVEL, MOVES, REGIONS, SPECIES, SPECIES_KEYS, movesOf, statsOf, type AdvSave, type Battle, type Fighter, type Mon, type Rng } from "./adventure.ts";

export const TEAM_MAX = 3;
export const RATING_START = 1000;

export const K_PLAYER = 32;
export const K_BOT = 16;

export const K_DEFENDER = 16;
export const DAILY_DUELS = 60;

export const DAILY_GAIN_CAP = 120;

export const SAME_OPP_DAILY = 3;

export const MATCH_TTL_MIN = 10;

const FILLERS = [0x115f, 0x1160, 0x3164, 0xffa0, 0x2800, 0x00ad].map((c) => String.fromCharCode(c)).join("");
const INVISIBLE = new RegExp(`[${FILLERS}]|\\p{Cf}`, "u");

const VISIBLE = /[\p{L}\p{N}]/u;

export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (INVISIBLE.test(raw)) return null;
  const s = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s || [...s].length > 12 || !VISIBLE.test(s)) return null;
  if (/https?:|www\.|\.[a-z]{2,}\//i.test(s)) return null;
  return s;
}

export function pickTeam(save: AdvSave, ids: readonly string[]): Mon[] {
  const all = [...save.party, ...save.box];
  const out: Mon[] = [];
  for (const id of ids) {
    if (out.length >= TEAM_MAX) break;
    const m = all.find((x) => x.id === id);
    if (!m || out.some((x) => x.id === id) || !SPECIES[m.species]) continue;
    out.push(freshMon(m));
  }
  return out;
}

function legendUnlocked(save: AdvSave, species: string): boolean {
  const badges = save.badges ?? [];
  return REGIONS.some((r, i) => r.table.some(([k]) => k === species) && (i === 0 || badges.includes(REGIONS[i - 1].key) || badges.includes(r.key)));
}

export function teamProblem(save: AdvSave, ids: readonly string[]): string | null {
  const all = [...save.party, ...save.box];
  const mons = [...new Set(ids.map(String))].map((id) => all.find((x) => x.id === id)).filter((m): m is Mon => !!m);
  if (!mons.length) return "empty team";
  if (mons.length > TEAM_MAX) return "team size";
  for (const m of mons) {
    if (!SPECIES[m.species]) return "bad mon";
    const lv = Number(m.level);
    if (!Number.isInteger(lv) || lv < 1 || lv > MAX_LEVEL) return "bad mon";
    for (const k of ["hp", "atk", "def", "spd"] as const) {
      const g = Number(m.gene?.[k] ?? 0);
      if (!Number.isInteger(g) || g < 0 || g > 7) return "bad mon";
    }
    if (SPECIES[m.species].legend && !legendUnlocked(save, m.species)) return "legend locked";
  }
  return null;
}

export function freshMon(m: Mon): Mon {
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(m.level) || 1)));
  const g = (v: unknown) => Math.min(7, Math.max(0, Math.floor(Number(v) || 0)));
  const gene = { hp: g(m.gene?.hp), atk: g(m.gene?.atk), def: g(m.gene?.def), spd: g(m.gene?.spd) };
  const base: Mon = { id: String(m.id).slice(0, 40), species: m.species, level, xp: 0, hp: 0, gene, moves: [] };
  base.hp = statsOf(base).hp;
  if (Array.isArray(m.picked)) base.picked = m.picked.map(String).slice(0, 4);
  base.moves = movesOf(base).map((id) => ({ id, pp: MOVES[id].pp }));
  return base;
}

export function validTeam(team: unknown): team is Mon[] {
  return Array.isArray(team) && team.length >= 1 && team.length <= TEAM_MAX && team.every((m) => m && SPECIES[(m as Mon).species]);
}

export const teamPower = (team: readonly Mon[]) => team.reduce((a, m) => a + m.level, 0);
export const teamLevel = (team: readonly Mon[]) => (team.length ? Math.round(teamPower(team) / team.length) : 1);

const rnd = (r: Rng) => {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const BOT_NAMES = ["숲지기", "물빛 소년", "동굴 탐험가", "바람 사냥꾼", "별빛 수집가"] as const;

export function botTeam(level: number, index: number, day: string): { name: string; team: Mon[] } {
  let h = 2166136261;
  for (const ch of `${day}:${index}:${level}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r: Rng = { s: h | 0 };
  const lv = Math.max(3, Math.min(MAX_LEVEL, level + [-2, 0, 1, 2, 3][index % 5]));
  const stage = lv >= 32 ? 4 : lv >= 16 ? 3 : 2;
  const pool = SPECIES_KEYS.filter((k) => SPECIES[k].stage === stage && !SPECIES[k].legend);
  const team: Mon[] = [];
  while (team.length < TEAM_MAX) {
    const k = pool[Math.floor(rnd(r) * pool.length)];
    if (team.some((m) => SPECIES[m.species].lineage === SPECIES[k].lineage)) continue;
    const m = freshMon({ id: `bot${index}-${team.length}`, species: k, level: Math.max(1, lv + Math.floor(rnd(r) * 3) - 1), xp: 0, hp: 0, moves: [], gene: { hp: Math.floor(rnd(r) * 8), atk: Math.floor(rnd(r) * 8), def: Math.floor(rnd(r) * 8), spd: Math.floor(rnd(r) * 8) } });
    team.push(m);
  }
  return { name: `${BOT_NAMES[index % BOT_NAMES.length]}(연습)`, team };
}

const fighter = (mon: Mon): Fighter => ({ mon: { ...mon, moves: mon.moves.map((x) => ({ ...x })) }, stats: statsOf(mon), stages: { atk: 0, def: 0, spd: 0 }, sleep: 0 });

export function startDuel(mine: readonly Mon[], theirs: readonly Mon[], seed: number, names: [string, string]): Battle {
  return {
    seed: seed | 0,
    sides: [
      { team: mine.map(fighter), active: 0, name: names[0] },
      { team: theirs.map(fighter), active: 0, name: names[1] },
    ],
    wild: false, turn: 0, runTries: 0, needSwap: false, over: null,
    joined: mine.slice(0, 1).map((m) => m.id),
  };
}

export function eloDelta(me: number, opp: number, score: 0 | 1, k: number): number {
  const expect = 1 / (1 + Math.pow(10, (opp - me) / 400));
  return Math.round(k * (score - expect));
}
