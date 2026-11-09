/* 모험 온라인 대전 — 순수 규칙(서버 함수 adventure-battle 과 화면이 같이 쓴다). README §14.6
 *
 * 대전은 서버가 판정한다(2026-11-08 실시간 전투로 바뀐 뒤): 앱이 실시간 아레나(lib/arena)를 돌리며 내 입력만 기록하고,
 * 판이 끝나면 그 기록을 보낸다. 엣지 함수가 엔진 복사본(_shared/adventure, scripts/adventure-shared.mjs 가 만든다)으로
 * 같은 시작 판에서 처음부터 다시 돌려(replayDuel) 승패를 정한다. 상대 쪽은 등록된 '대전 팀'을 엔진의 컴퓨터(think)가 조종한다.
 * ⚠ 팀은 앱이 보낸 생물 그대로가 아니라 서버에 저장된 모험 기록에서 id 로 골라, 능력을 다시 계산하고 체력 · 기술을 새로 채운다.
 *   모험 기록 자체는 앱이 쓰므로 완전한 부정 방지는 아니다 — 엔진이 못 만드는 값만 막는다(teamProblem).
 * ⚠ 이 파일은 값으로 lib/adventure 만 읽는다(복사본에서도 그대로 풀리게 상대 경로 .ts). */
import { MAX_LEVEL, MOVES, REGIONS, SPECIES, SPECIES_KEYS, movesOf, statsOf, type AdvSave, type Battle, type Fighter, type Mon, type Rng } from "./adventure.ts";

export const TEAM_MAX = 3;
export const RATING_START = 1000;
/** 사람 상대 · 연습 상대의 점수 변동 폭 */
export const K_PLAYER = 32;
export const K_BOT = 16;
/** 방어한 쪽(자리에 없던 사람)은 절반만 움직인다 */
export const K_DEFENDER = 16;
export const DAILY_DUELS = 60;
/** 하루(KST) 점수 상승 상한 — 사람 상대만, 방어로 오르는 점수도 같이 센다(migration 20261107050000 의 v_cap 과 같은 값) */
export const DAILY_GAIN_CAP = 120;
/** 같은 상대에게 하루(KST) 걸 수 있는 판 — 넘으면 PT429(같은 migration 의 트리거와 같은 값) */
export const SAME_OPP_DAILY = 3;
/** 판을 연 뒤 이 시간이 지나 보낸 기록은 진 것 — 시드를 받아 밖에서 이기는 입력을 오래 찾지 못하게 */
export const MATCH_TTL_MIN = 10;

/** 보이지 않는 글자 — 서식 글자(Cf: 폭 없는 공백 · 방향 표시 · BOM · 부드러운 하이픈) · 한글 채움 글자 넷 · 점자 빈칸 */
// 글자 코드로 만든다 — 소스에 이스케이프를 두면 함수 배포 도구가 풀어 버려 정규식이 깨졌다(2026-11-08)
const FILLERS = [0x115f, 0x1160, 0x3164, 0xffa0, 0x2800, 0x00ad].map((c) => String.fromCharCode(c)).join("");
const INVISIBLE = new RegExp(`[${FILLERS}]|\\p{Cf}`, "u");
/** 보이는 글자 · 숫자가 하나는 있어야 한다(채움 글자는 Lo 라 따로 뺀 뒤 본다) */
const VISIBLE = /[\p{L}\p{N}]/u;

/** 닉네임 — 공백 정리 · 12자 · 링크 · 보이지 않는 글자 금지 · 보이는 글자 하나 이상. 안 되면 null. */
export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // 공백으로 바꾸기 전에 본다 — \s 가 BOM 을 공백으로 삼켜 숨은 글자가 걸러지지 않는다
  if (INVISIBLE.test(raw)) return null;
  const s = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s || [...s].length > 12 || !VISIBLE.test(s)) return null;
  if (/https?:|www\.|\.[a-z]{2,}\//i.test(s)) return null;
  return s;
}

/** 모험 기록에서 id 로 대전 팀을 고른다 — 최대 셋, 겹치지 않게, 능력 · 기술 · 체력을 새로. 하나도 없으면 빈 배열. */
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

/** 이 생물이 들어 있는 지역이 이 기록의 뱃지로 열렸나 — 전설은 신전에서만 나온다(앞 지역 대장 뱃지 또는 그 지역 뱃지) */
function legendUnlocked(save: AdvSave, species: string): boolean {
  const badges = save.badges ?? [];
  return REGIONS.some((r, i) => r.table.some(([k]) => k === species) && (i === 0 || badges.includes(REGIONS[i - 1].key) || badges.includes(r.key)));
}

/** 대전 팀 등록 전 그럴듯한지 — 엔진이 만들 수 없는 값이면 오류 코드(조작한 기록), 괜찮으면 null.
 *  ⚠ 모험 기록은 앱이 쓰므로 이걸로 완전히 막지는 못한다 — 엔진에 없는 값(레벨 50 초과 · 개체값 7 초과 · 소수 · 모르는 종 ·
 *  뱃지 없이 전설 · 팀 넷 이상)만 거른다. 엔진에 '뱃지 수마다 레벨 상한'이 없어 레벨은 50 까지 그대로 믿는다. */
export function teamProblem(save: AdvSave, ids: readonly string[]): string | null {
  const all = [...save.party, ...save.box];
  // 서버에 아직 없는 id(방금 잡아 저장 전 · 놓아준 생물)는 pickTeam 처럼 건너뛴다 — 고른 것 중 있는 것만 본다
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

/** 대전용으로 다시 만든 생물 — 레벨 1~50, 개체값 0~7 정수, 지금 레벨의 기술 넷, 체력 가득, 상태 없음 */
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

/** 이 팀이 대전 규칙에 맞나 */
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

/** 연습 상대 — 내 팀 평균 레벨 근처, 그 레벨에 맞는 진화 단계의 생물 셋. 같은 (레벨, 번호, 날) = 같은 팀. */
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

/** 대전 판 — 야생이 아니라 공 · 도망 · 가방이 없다(엔진이 막는다). */
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

/** 점수 변동(ELO) — score 1 이김 · 0 짐 */
export function eloDelta(me: number, opp: number, score: 0 | 1, k: number): number {
  const expect = 1 / (1 + Math.pow(10, (opp - me) / 400));
  return Math.round(k * (score - expect));
}
