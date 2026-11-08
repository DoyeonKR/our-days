// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
import { LINEAGES } from "./lineages.ts";
import { josa } from "./josa.ts";

export const TYPES = ["노말", "불꽃", "물", "풀", "전기", "얼음", "벌레", "악", "고스트", "페어리"] as const;
export type MonType = (typeof TYPES)[number];

const CHART: Record<MonType, [MonType[], MonType[]]> = {
  노말: [[], ["고스트"]],
  불꽃: [["풀", "벌레", "얼음"], ["물", "불꽃"]],
  물: [["불꽃"], ["물", "풀", "얼음"]],
  풀: [["물"], ["불꽃", "벌레", "풀"]],
  전기: [["물"], ["풀", "전기"]],
  얼음: [["풀", "벌레"], ["불꽃", "물", "얼음"]],
  벌레: [["풀", "악"], ["불꽃", "페어리"]],
  악: [["고스트"], ["페어리", "악"]],
  고스트: [["페어리", "노말"], ["악"]],
  페어리: [["악", "벌레"], ["불꽃", "고스트"]],
};

export function effectiveness(atk: MonType, def: MonType): number {
  const [good, bad] = CHART[atk];
  if (good.includes(def)) return 2;
  if (bad.includes(def)) return 0.5;
  return 1;
}

export const TYPE_COLOR: Record<MonType, string> = {
  노말: "#9a958a", 불꽃: "#e8623a", 물: "#3d8be0", 풀: "#4fae4f", 전기: "#e3b51c",
  얼음: "#5cc6d6", 벌레: "#93a827", 악: "#5b4a63", 고스트: "#7a63c4", 페어리: "#e27fb3",
};

export type Status = "burn" | "poison" | "para" | "sleep";
export type StatKey = "atk" | "def" | "spd";

export type Move = {
  id: string;
  name: string;
  type: MonType;

  power: number;
  acc: number;
  pp: number;

  inflict?: { status: Status; chance: number };

  boost?: { stat: StatKey; by: number; self: boolean };

  heal?: number;
  priority?: number;

  hits?: [number, number];

  drain?: number;

  recoil?: number;

  crit?: number;

  flinch?: number;

  fx: FxStyle;
  note: string;
};

export type FxStyle = "contact" | "shot" | "beam" | "rain" | "burst" | "wave" | "slash" | "spiral" | "self" | "debuff";

const M = (m: Move) => m;
export const MOVES: Record<string, Move> = Object.fromEntries(
  [
    M({ id: "bump", name: "콩 부딪기", type: "노말", power: 40, acc: 100, pp: 30, fx: "contact", note: "가볍게 몸을 부딪쳐요" }),
    M({ id: "flurry", name: "콩콩 연타", type: "노말", power: 18, acc: 95, pp: 20, hits: [2, 5], fx: "contact", note: "2~5번 연달아 때려요" }),
    M({ id: "roll", name: "데굴구르기", type: "노말", power: 65, acc: 95, pp: 20, fx: "contact", note: "굴러가 들이받아요" }),
    M({ id: "slam", name: "온몸 던지기", type: "노말", power: 100, acc: 90, pp: 10, recoil: 0.25, fx: "contact", note: "아주 세지만 나도 조금 아파요" }),
    M({ id: "dash", name: "번쩍 달려들기", type: "노말", power: 40, acc: 100, pp: 20, priority: 1, fx: "contact", note: "먼저 움직여요" }),
    M({ id: "stretch", name: "기지개", type: "노말", power: 0, acc: 100, pp: 20, boost: { stat: "atk", by: 2, self: true }, fx: "self", note: "내 공격이 크게 올라가요" }),
    M({ id: "growl", name: "으르렁", type: "노말", power: 0, acc: 100, pp: 25, boost: { stat: "atk", by: -1, self: false }, fx: "debuff", note: "상대 공격이 내려가요" }),
    M({ id: "rest", name: "쉬어 가기", type: "노말", power: 0, acc: 100, pp: 5, heal: 0.5, fx: "self", note: "체력을 절반 되찾아요" }),
    M({ id: "shell", name: "껍질 다지기", type: "노말", power: 0, acc: 100, pp: 20, boost: { stat: "def", by: 2, self: true }, fx: "self", note: "내 방어가 크게 올라가요" }),
    M({ id: "breeze", name: "바람 타기", type: "노말", power: 0, acc: 100, pp: 15, boost: { stat: "spd", by: 2, self: true }, fx: "self", note: "내 스피드가 크게 올라가요" }),

    M({ id: "spark", name: "불티 튀기기", type: "불꽃", power: 40, acc: 100, pp: 25, inflict: { status: "burn", chance: 0.1 }, fx: "shot", note: "불티를 쏴요 · 가끔 화상" }),
    M({ id: "emberrain", name: "불씨 소나기", type: "불꽃", power: 22, acc: 95, pp: 15, hits: [2, 4], inflict: { status: "burn", chance: 0.1 }, fx: "rain", note: "불씨가 2~4번 쏟아져요" }),
    M({ id: "flametail", name: "불꽃 꼬리", type: "불꽃", power: 70, acc: 95, pp: 15, inflict: { status: "burn", chance: 0.2 }, fx: "contact", note: "불붙은 꼬리로 후려쳐요" }),
    M({ id: "lava", name: "용암 분출", type: "불꽃", power: 100, acc: 85, pp: 5, inflict: { status: "burn", chance: 0.3 }, fx: "burst", note: "땅에서 용암이 솟아요" }),

    M({ id: "drop", name: "물방울 톡", type: "물", power: 40, acc: 100, pp: 25, fx: "shot", note: "물방울을 쏘아요" }),
    M({ id: "bubbles", name: "거품 세례", type: "물", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "거품이 2~5번 터져요" }),
    M({ id: "wave", name: "물결 밀기", type: "물", power: 70, acc: 95, pp: 15, fx: "wave", note: "물결로 밀어내요" }),
    M({ id: "whirl", name: "소용돌이 파도", type: "물", power: 100, acc: 85, pp: 5, fx: "spiral", note: "거센 소용돌이" }),

    M({ id: "leafy", name: "잎사귀 휙", type: "풀", power: 40, acc: 100, pp: 25, fx: "shot", note: "잎을 날려요" }),
    M({ id: "sap", name: "수액 빨기", type: "풀", power: 55, acc: 100, pp: 15, drain: 0.5, fx: "burst", note: "준 피해의 절반을 되찾아요" }),
    M({ id: "thorn", name: "가시덩굴", type: "풀", power: 70, acc: 95, pp: 15, crit: 0.2, fx: "slash", note: "덩굴로 휘감아요 · 급소에 잘 맞아요" }),
    M({ id: "grove", name: "숲의 울림", type: "풀", power: 100, acc: 85, pp: 5, fx: "rain", note: "숲 전체가 울려요" }),
    M({ id: "lullaby", name: "꽃가루 자장가", type: "풀", power: 0, acc: 75, pp: 10, inflict: { status: "sleep", chance: 1 }, fx: "debuff", note: "상대를 재워요" }),

    M({ id: "zap", name: "찌릿 손뼉", type: "전기", power: 40, acc: 100, pp: 25, inflict: { status: "para", chance: 0.1 }, fx: "contact", note: "가끔 마비" }),
    M({ id: "jolt", name: "번개 꼬리", type: "전기", power: 60, acc: 100, pp: 15, crit: 0.25, fx: "slash", note: "급소에 잘 맞아요" }),
    M({ id: "bolt", name: "번개 줄기", type: "전기", power: 70, acc: 95, pp: 15, inflict: { status: "para", chance: 0.2 }, fx: "beam", note: "가끔 마비" }),
    M({ id: "thunder", name: "천둥 낙하", type: "전기", power: 100, acc: 85, pp: 5, inflict: { status: "para", chance: 0.3 }, fx: "rain", note: "하늘에서 내리꽂혀요" }),

    M({ id: "frost", name: "서리 입김", type: "얼음", power: 40, acc: 100, pp: 25, fx: "beam", note: "차가운 입김" }),
    M({ id: "icicle", name: "고드름 연발", type: "얼음", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "고드름을 2~5번 쏴요" }),
    M({ id: "shard", name: "얼음 조각", type: "얼음", power: 70, acc: 95, pp: 15, flinch: 0.2, fx: "shot", note: "가끔 상대가 움찔해요" }),
    M({ id: "glacier", name: "빙하 낙하", type: "얼음", power: 100, acc: 85, pp: 5, fx: "rain", note: "얼음 덩어리가 떨어져요" }),

    M({ id: "antenna", name: "더듬이 찌르기", type: "벌레", power: 40, acc: 100, pp: 25, fx: "contact", note: "더듬이로 콕" }),
    M({ id: "buzz", name: "날갯짓 연타", type: "벌레", power: 18, acc: 95, pp: 20, hits: [2, 5], fx: "contact", note: "2~5번 연달아 쳐요" }),
    M({ id: "sting", name: "따끔 침", type: "벌레", power: 60, acc: 100, pp: 20, inflict: { status: "poison", chance: 0.3 }, fx: "shot", note: "가끔 독" }),
    M({ id: "horn", name: "뿔 들이받기", type: "벌레", power: 95, acc: 90, pp: 10, fx: "contact", note: "뿔로 힘껏" }),

    M({ id: "pinch", name: "몰래 꼬집기", type: "악", power: 40, acc: 100, pp: 25, priority: 1, fx: "contact", note: "먼저 움직여요" }),
    M({ id: "siphon", name: "그림자 빨기", type: "악", power: 55, acc: 100, pp: 15, drain: 0.5, fx: "burst", note: "준 피해의 절반을 되찾아요" }),
    M({ id: "nightfall", name: "밤그늘 베기", type: "악", power: 70, acc: 95, pp: 15, crit: 0.25, fx: "slash", note: "급소에 잘 맞아요" }),
    M({ id: "moonless", name: "달 없는 밤", type: "악", power: 95, acc: 90, pp: 10, flinch: 0.2, fx: "burst", note: "깜깜한 밤의 일격" }),

    M({ id: "beckon", name: "으스스 손짓", type: "고스트", power: 40, acc: 100, pp: 25, fx: "shot", note: "오싹해요" }),
    M({ id: "spook", name: "깜짝 놀래기", type: "고스트", power: 40, acc: 100, pp: 10, priority: 1, flinch: 0.3, fx: "burst", note: "먼저 움직여요 · 상대가 움찔해요" }),
    M({ id: "blanket", name: "이불 덮치기", type: "고스트", power: 70, acc: 95, pp: 15, fx: "contact", note: "이불로 푹" }),
    M({ id: "haunt", name: "혼령 폭풍", type: "고스트", power: 95, acc: 90, pp: 10, fx: "spiral", note: "혼령이 몰아쳐요" }),

    M({ id: "glitter", name: "반짝 가루", type: "페어리", power: 40, acc: 100, pp: 25, fx: "shot", note: "반짝반짝" }),
    M({ id: "candy", name: "별사탕 톡톡", type: "페어리", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "별사탕이 2~5번 터져요" }),
    M({ id: "dreamy", name: "꿈결 별빛", type: "페어리", power: 65, acc: 95, pp: 15, drain: 0.3, fx: "beam", note: "준 피해의 일부를 되찾아요" }),
    M({ id: "rainbow", name: "무지개 빛살", type: "페어리", power: 95, acc: 90, pp: 10, fx: "beam", note: "일곱 빛깔 광선" }),
    M({ id: "scent", name: "포근한 향", type: "페어리", power: 0, acc: 100, pp: 20, boost: { stat: "atk", by: -2, self: false }, fx: "debuff", note: "상대 공격이 크게 내려가요" }),
  ].map((m) => [m.id, m]),
);

const TYPE_MOVES: Record<MonType, [string, string, string, string]> = {
  노말: ["bump", "flurry", "roll", "slam"],
  불꽃: ["spark", "emberrain", "flametail", "lava"],
  물: ["drop", "bubbles", "wave", "whirl"],
  풀: ["leafy", "sap", "thorn", "grove"],
  전기: ["zap", "jolt", "bolt", "thunder"],
  얼음: ["frost", "icicle", "shard", "glacier"],
  벌레: ["antenna", "buzz", "sting", "horn"],
  악: ["pinch", "siphon", "nightfall", "moonless"],
  고스트: ["beckon", "spook", "blanket", "haunt"],
  페어리: ["glitter", "candy", "dreamy", "rainbow"],
};

type Profile = { hp: number; atk: number; def: number; spd: number; type: MonType; extra: string };

const ROSTER: Record<string, Profile> = {
  leaf: { hp: 1.0, atk: 0.9, def: 1.1, spd: 0.9, type: "풀", extra: "lullaby" },
  beetle: { hp: 0.95, atk: 1.2, def: 1.1, spd: 0.8, type: "벌레", extra: "stretch" },
  burr: { hp: 1.2, atk: 0.95, def: 1.1, spd: 0.75, type: "노말", extra: "shell" },
  puff: { hp: 1.15, atk: 0.9, def: 0.95, spd: 1.0, type: "페어리", extra: "scent" },
  conch: { hp: 1.0, atk: 0.9, def: 1.3, spd: 0.75, type: "물", extra: "shell" },
  volt: { hp: 0.85, atk: 1.1, def: 0.8, spd: 1.3, type: "전기", extra: "breeze" },
  snow: { hp: 1.1, atk: 1.0, def: 1.0, spd: 0.9, type: "얼음", extra: "rest" },
  bat: { hp: 0.9, atk: 1.1, def: 0.85, spd: 1.2, type: "악", extra: "dash" },
  ghost: { hp: 0.95, atk: 1.1, def: 0.9, spd: 1.1, type: "고스트", extra: "growl" },
  ember: { hp: 0.9, atk: 1.2, def: 0.85, spd: 1.1, type: "불꽃", extra: "stretch" },
};

export type Species = {
  key: string;
  name: string;
  lineage: string;
  stage: 2 | 3 | 4;
  type: MonType;
  base: { hp: number; atk: number; def: number; spd: number };

  evolves?: { to: string; at: number };

  learn: [number, string][];
  catchRate: number;
  xp: number;
  note: string;
};

const STAGE_BASE = { 2: 55, 3: 75, 4: 98 } as const;
export const EVOLVE_AT = { 2: 16, 3: 32 } as const;

export const SPECIES: Record<string, Species> = {};
for (const l of LINEAGES) {
  const p = ROSTER[l.key];
  if (!p) continue;
  const [weak, second, mid, strong] = TYPE_MOVES[p.type];
  const normal = p.type === "노말" ? ["dash", "growl"] : ["bump", "flurry"];
  l.forms.forEach((form, i) => {
    const stage = (i + 2) as 2 | 3 | 4;
    const b = STAGE_BASE[stage];
    const next = l.forms[i + 1];
    SPECIES[form.key] = {
      key: form.key,
      name: form.name,
      lineage: l.key,
      stage,
      type: p.type,
      base: { hp: Math.round(b * p.hp), atk: Math.round(b * p.atk), def: Math.round(b * p.def), spd: Math.round(b * p.spd) },
      evolves: next && stage < 4 ? { to: next.key, at: EVOLVE_AT[stage as 2 | 3] } : undefined,
      learn: [[1, normal[0]], [1, weak], [5, p.extra], [8, second], [13, mid], [19, normal[1]], [25, strong], [33, "slam"], [40, "rest"]],
      catchRate: stage === 2 ? 0.6 : stage === 3 ? 0.34 : 0.14,
      xp: stage === 2 ? 40 : stage === 3 ? 70 : 110,
      note: l.note,
    };
  });
}
export const SPECIES_KEYS = Object.keys(SPECIES);

export function movesAt(species: string, level: number): string[] {
  const sp = SPECIES[species];
  const learned = [...new Set(sp.learn.filter(([lv]) => lv <= level).map(([, id]) => id))];
  const own = learned.filter((id) => MOVES[id].power > 0 && MOVES[id].type === sp.type);
  const other = learned.filter((id) => MOVES[id].power > 0 && MOVES[id].type !== sp.type);
  const status = learned.filter((id) => MOVES[id].power === 0);
  const pick = [...own.slice(sp.type === "노말" ? -3 : -2), ...other.slice(-1), ...status.slice(-1)];
  for (const id of [...learned].reverse()) {
    if (pick.length >= 4) break;
    if (!pick.includes(id) && MOVES[id].power > 0) pick.splice(pick.length - (status.length && pick.includes(status[status.length - 1]) ? 1 : 0), 0, id);
  }
  return pick.slice(0, 4);
}

export type Mon = {
  id: string;
  species: string;
  level: number;

  xp: number;
  hp: number;
  status?: Status;

  moves: { id: string; pp: number }[];

  gene: { hp: number; atk: number; def: number; spd: number };
  caughtAt?: string;
};

export const MAX_LEVEL = 50;
export const xpFor = (level: number) => Math.round(Math.pow(level, 3) * 0.8);

export type Stats = { hp: number; atk: number; def: number; spd: number };
export function statsOf(m: Pick<Mon, "species" | "level" | "gene">): Stats {
  const b = SPECIES[m.species].base;
  const L = m.level;
  const st = (base: number, g: number) => Math.floor(((base + g) * (L + 8)) / 28) + 4;
  return {
    hp: Math.floor(((b.hp + m.gene.hp) * (L + 8)) / 22) + 8,
    atk: st(b.atk, m.gene.atk),
    def: st(b.def, m.gene.def),
    spd: st(b.spd, m.gene.spd),
  };
}

export function makeMon(species: string, level: number, rng: Rng, id: string, at?: string): Mon {
  const gene = { hp: rint(rng, 0, 7), atk: rint(rng, 0, 7), def: rint(rng, 0, 7), spd: rint(rng, 0, 7) };
  const lv = clamp(Math.round(level), 1, MAX_LEVEL);
  const mon: Mon = { id, species, level: lv, xp: xpFor(lv), hp: 0, gene, moves: [], caughtAt: at };
  mon.hp = statsOf(mon).hp;
  mon.moves = movesAt(species, lv).map((m) => ({ id: m, pp: MOVES[m].pp }));
  return mon;
}

export function grantXp(mon: Mon, amount: number): { mon: Mon; notes: string[] } {
  const m: Mon = { ...mon, moves: mon.moves.map((x) => ({ ...x })) };
  const notes: string[] = [];
  m.xp += Math.max(0, Math.round(amount));
  while (m.level < MAX_LEVEL && m.xp >= xpFor(m.level + 1)) {
    const before = statsOf(m).hp;
    m.level++;
    m.hp = Math.min(statsOf(m).hp, m.hp + (statsOf(m).hp - before));
    notes.push(`${SPECIES[m.species].name}의 레벨이 ${m.level}이 됐다!`);
    const evo = SPECIES[m.species].evolves;
    if (evo && m.level >= evo.at) {
      const was = SPECIES[m.species].name;
      const hpGap = statsOf(m).hp - m.hp;
      m.species = evo.to;
      m.hp = Math.max(1, statsOf(m).hp - hpGap);
      notes.push(`${josa(was, "이/가")} ${josa(SPECIES[m.species].name, "으로/로")} 진화했다!`);
    }
    const want = movesAt(m.species, m.level);
    for (const id of want)
      if (!m.moves.some((x) => x.id === id)) notes.push(`${josa(SPECIES[m.species].name, "은/는")} ${josa(MOVES[id].name, "을/를")} 배웠다!`);
    m.moves = want.map((id) => m.moves.find((x) => x.id === id) ?? { id, pp: MOVES[id].pp });
  }
  if (m.level >= MAX_LEVEL) m.xp = Math.min(m.xp, xpFor(MAX_LEVEL));
  return { mon: m, notes };
}

export function healMon(m: Mon): Mon {
  return { ...m, hp: statsOf(m).hp, status: undefined, moves: m.moves.map((x) => ({ id: x.id, pp: MOVES[x.id].pp })) };
}

export type Rng = { s: number };
export function rnd(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (r: Rng, a: number, b: number) => a + Math.floor(rnd(r) * (b - a + 1));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type Region = {
  key: string;
  name: string;
  blurb: string;
  levels: [number, number];

  needLevel: number;
  table: [string, number][];
  sky: [string, string];
  ground: string;
};

export const REGIONS: Region[] = [
  {
    key: "meadow", name: "들꽃 숲", blurb: "풀숲과 꽃밭 — 처음 떠나기 좋은 곳",
    levels: [2, 5], needLevel: 0,
    table: [["leaf_2", 25], ["beetle_2", 25], ["burr_2", 25], ["puff_2", 20], ["leaf_3", 3], ["beetle_3", 2]],
    sky: ["#bfe6ff", "#e9f8de"], ground: "#8fcf6a",
  },
  {
    key: "lake", name: "물빛 호수", blurb: "맑은 물가 — 번개 새와 눈송이가 놀러 와요",
    levels: [9, 16], needLevel: 8,
    table: [["conch_2", 22], ["volt_2", 22], ["snow_2", 22], ["puff_2", 10], ["conch_3", 8], ["volt_3", 7], ["snow_3", 7], ["burr_3", 2]],
    sky: ["#9fd4f5", "#d8f1f7"], ground: "#7cc3c9",
  },
  {
    key: "cave", name: "달빛 동굴", blurb: "깜깜한 동굴 — 귀한 생물이 숨어 있어요",
    levels: [17, 30], needLevel: 17,
    table: [["bat_2", 16], ["ghost_2", 16], ["ember_2", 12], ["bat_3", 14], ["ghost_3", 14], ["ember_3", 8], ["volt_3", 6], ["snow_3", 6], ["leaf_3", 4], ["bat_4", 2], ["ghost_4", 2]],
    sky: ["#2c2346", "#4c3d6e"], ground: "#5d5470",
  },
];

export function regionOpen(save: AdvSave, r: Region): boolean {
  return topLevel(save) >= r.needLevel;
}
export const topLevel = (save: AdvSave) => Math.max(0, ...save.party.map((m) => m.level), ...save.box.map((m) => m.level));

export function rollWild(region: Region, rng: Rng): { species: string; level: number } {
  const total = region.table.reduce((a, [, w]) => a + w, 0);
  let x = rnd(rng) * total;
  let species = region.table[0][0];
  for (const [k, w] of region.table) {
    if ((x -= w) < 0) {
      species = k;
      break;
    }
  }
  let level = rint(rng, region.levels[0], region.levels[1]);
  const st = SPECIES[species].stage;
  if (st === 3) level = Math.max(level, EVOLVE_AT[2]);
  if (st === 4) level = Math.max(level, EVOLVE_AT[3]);
  for (let evo = SPECIES[species].evolves; evo && level >= evo.at; evo = SPECIES[species].evolves) species = evo.to;
  return { species, level };
}

export const BALLS = {
  basic: { name: "도토리공", mult: 1, price: 100, note: "기본 공" },
  great: { name: "물방울공", mult: 1.6, price: 300, note: "잘 잡혀요" },
  star: { name: "별빛공", mult: 2.4, price: 900, note: "아주 잘 잡혀요" },
} as const;
export type BallKey = keyof typeof BALLS;

export const ITEMS = {
  potion: { name: "상처약", heal: 40, price: 150, note: "체력 40 회복" },
  bigpotion: { name: "큰상처약", heal: 9999, price: 500, note: "체력 모두 회복" },
  cure: { name: "깨움약", heal: 0, price: 120, note: "상태이상 회복" },
} as const;
export type ItemKey = keyof typeof ITEMS;

export function applyItem(m: Mon, item: ItemKey): Mon | null {
  const max = statsOf(m).hp;
  if (m.hp <= 0) return null;
  if (item === "cure") return m.status ? { ...m, status: undefined } : null;
  if (m.hp >= max) return null;
  return { ...m, hp: Math.min(max, m.hp + ITEMS[item].heal) };
}

export type AdvSave = {
  v: 1;
  gold: number;
  balls: Record<BallKey, number>;
  items: Record<ItemKey, number>;
  party: Mon[];
  box: Mon[];
  seen: string[];
  caught: string[];
  wins: number;
  catches: number;

  next: number;
  seed: number;
};

export const PARTY_MAX = 6;
export const STARTERS = ["leaf_2", "ember_2", "conch_2"] as const;

export function newSave(starter: string, seed: number): AdvSave {
  const rng = { s: seed | 0 };
  const mon = makeMon(starter, 5, rng, "m1");
  return {
    v: 1, gold: 500,
    balls: { basic: 5, great: 0, star: 0 },
    items: { potion: 3, bigpotion: 0, cure: 1 },
    party: [mon], box: [], seen: [starter], caught: [starter],
    wins: 0, catches: 0, next: 2, seed: rng.s,
  };
}

export function normalizeSave(raw: unknown): AdvSave | null {
  const s = raw as Partial<AdvSave> | null;
  if (!s || s.v !== 1 || !Array.isArray(s.party)) return null;
  const okMon = (m: Mon) => !!m && !!SPECIES[m.species];
  const fixMon = (m: Mon): Mon => {
    const had = new Map((m.moves ?? []).map((x) => [x.id, x.pp]));
    const moves = movesAt(m.species, m.level).map((id) => ({ id, pp: Math.min(MOVES[id].pp, had.get(id) ?? MOVES[id].pp) }));
    return { ...m, moves, hp: clamp(m.hp ?? 0, 0, statsOf(m).hp) };
  };
  const party = s.party.filter(okMon).map(fixMon);
  if (!party.length) return null;
  return {
    v: 1,
    gold: Math.max(0, Math.floor(s.gold ?? 0)),
    balls: { basic: s.balls?.basic ?? 0, great: s.balls?.great ?? 0, star: s.balls?.star ?? 0 },
    items: { potion: s.items?.potion ?? 0, bigpotion: s.items?.bigpotion ?? 0, cure: s.items?.cure ?? 0 },
    party,
    box: (s.box ?? []).filter(okMon).map(fixMon),
    seen: (s.seen ?? []).filter((k) => SPECIES[k]),
    caught: (s.caught ?? []).filter((k) => SPECIES[k]),
    wins: s.wins ?? 0, catches: s.catches ?? 0, next: s.next ?? 100, seed: s.seed ?? 1,
  };
}

export type Fighter = {
  mon: Mon;
  stats: Stats;
  stages: Record<StatKey, number>;
  sleep: number;

  flinch?: boolean;
};
export type Side = { team: Fighter[]; active: number; name: string };
export type Battle = {
  seed: number;
  sides: [Side, Side];
  wild: boolean;
  region?: string;
  turn: number;
  runTries: number;

  needSwap: boolean;
  over: null | "win" | "lose" | "run" | "caught";

  joined: string[];
  caught?: Mon;
};

export type Action =
  | { kind: "move"; i: number }
  | { kind: "swap"; to: number }
  | { kind: "item"; item: ItemKey; target: number }
  | { kind: "ball"; ball: BallKey; aim: number }
  | { kind: "run" };

export type Ev =
  | { t: "text"; s: string }
  | { t: "use"; side: 0 | 1; move: string }

  | { t: "hit"; side: 0 | 1; dmg: number; eff: number; crit: boolean; move?: string; n?: number; recoil?: boolean }
  | { t: "miss"; side: 0 | 1 }
  | { t: "heal"; side: 0 | 1; amount: number; drain?: boolean }
  | { t: "status"; side: 0 | 1; status: Status }
  | { t: "stat"; side: 0 | 1; stat: StatKey; by: number }
  | { t: "faint"; side: 0 | 1 }
  | { t: "swap"; side: 0 | 1; to: number }
  | { t: "throw"; ball: BallKey; shakes: number; caught: boolean }
  | { t: "end"; result: NonNullable<Battle["over"]> };

const fighter = (mon: Mon): Fighter => ({ mon: { ...mon, moves: mon.moves.map((x) => ({ ...x })) }, stats: statsOf(mon), stages: { atk: 0, def: 0, spd: 0 }, sleep: 0 });

export function startWild(save: AdvSave, region: Region): { battle: Battle; save: AdvSave } {
  const rng = { s: save.seed };
  const w = rollWild(region, rng);
  const wildMon = makeMon(w.species, w.level, rng, "wild");
  const lead = Math.max(0, save.party.findIndex((m) => m.hp > 0));
  const battle: Battle = {
    seed: rng.s,
    sides: [
      { team: save.party.map(fighter), active: lead, name: "나" },
      { team: [fighter(wildMon)], active: 0, name: "야생" },
    ],
    wild: true, region: region.key, turn: 0, runTries: 0, needSwap: false, over: null,
    joined: [save.party[lead].id],
  };
  const seen = save.seen.includes(w.species) ? save.seen : [...save.seen, w.species];
  return { battle, save: { ...save, seed: rng.s, seen } };
}

export function cloneBattle(b: Battle): Battle {
  return JSON.parse(JSON.stringify(b)) as Battle;
}

export const activeOf = (b: Battle, side: 0 | 1) => b.sides[side].team[b.sides[side].active];
const nameOf = (f: Fighter) => SPECIES[f.mon.species].name;
const stageMul = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

function speedOf(f: Fighter): number {
  return f.stats.spd * stageMul(f.stages.spd) * (f.mon.status === "para" ? 0.5 : 1);
}

export function damage(att: Fighter, def: Fighter, move: Move, rng: Rng): { dmg: number; eff: number; crit: boolean } {
  const eff = effectiveness(move.type, SPECIES[def.mon.species].type);
  const crit = rnd(rng) < (move.crit ?? 1 / 16);
  const a = att.stats.atk * stageMul(crit ? Math.max(0, att.stages.atk) : att.stages.atk) * (att.mon.status === "burn" ? 0.5 : 1);
  const d = def.stats.def * stageMul(crit ? Math.min(0, def.stages.def) : def.stages.def);
  const stab = SPECIES[att.mon.species].type === move.type ? 1.3 : 1;
  const roll = 0.86 + rnd(rng) * 0.14;
  const dmg = Math.max(1, Math.floor(((move.power * (a / d) * (att.mon.level + 10)) / 55) * stab * eff * (crit ? 1.5 : 1) * roll));
  return { dmg, eff, crit };
}

export function aiPick(b: Battle, side: 0 | 1, rng: Rng): Action {
  const me = activeOf(b, side);
  const foe = activeOf(b, side === 0 ? 1 : 0);
  const usable = me.mon.moves.map((m, i) => ({ m, i })).filter((x) => x.m.pp > 0);
  if (!usable.length) return { kind: "move", i: -1 };
  const scored = usable.map(({ m, i }) => {
    const mv = MOVES[m.id];
    let w = mv.power > 0 ? (mv.power * effectiveness(mv.type, SPECIES[foe.mon.species].type) * mv.acc) / 100 : 18;
    if (mv.heal && me.mon.hp > me.stats.hp * 0.6) w = 1;
    if (mv.heal && me.mon.hp < me.stats.hp * 0.35) w = 60;
    if (mv.inflict?.status && mv.power === 0 && foe.mon.status) w = 1;
    return { i, w: w + 1 };
  });
  const total = scored.reduce((a, x) => a + x.w * x.w, 0);
  let x = rnd(rng) * total;
  for (const s of scored) if ((x -= s.w * s.w) < 0) return { kind: "move", i: s.i };
  return { kind: "move", i: scored[0].i };
}

const STRUGGLE: Move = { id: "struggle", name: "버둥거리기", type: "노말", power: 30, acc: 100, pp: 1, fx: "contact", note: "쓸 기술이 없어요" };

export const moveOf = (id: string): Move => MOVES[id] ?? STRUGGLE;
const STATUS_NAME: Record<Status, string> = { burn: "화상", poison: "독", para: "마비", sleep: "잠듦" };
const STAT_NAME: Record<StatKey, string> = { atk: "공격", def: "방어", spd: "스피드" };

function doMove(b: Battle, side: 0 | 1, i: number, rng: Rng, ev: Ev[], foeLater = false) {
  const me = activeOf(b, side);
  const foeSide = (side === 0 ? 1 : 0) as 0 | 1;
  const foe = activeOf(b, foeSide);
  if (me.mon.hp <= 0) return;
  if (me.flinch) {
    me.flinch = false;
    ev.push({ t: "text", s: `${josa(nameOf(me), "은/는")} 움찔해서 움직이지 못했다!` });
    return;
  }
  if (me.mon.status === "sleep") {
    if (me.sleep > 0) {
      me.sleep--;
      ev.push({ t: "text", s: `${josa(nameOf(me), "은/는")} 쿨쿨 자고 있다` });
      return;
    }
    me.mon.status = undefined;
    ev.push({ t: "text", s: `${josa(nameOf(me), "이/가")} 잠에서 깼다!` });
  }
  if (me.mon.status === "para" && rnd(rng) < 0.25) {
    ev.push({ t: "text", s: `${josa(nameOf(me), "은/는")} 몸이 저려 움직이지 못했다` });
    return;
  }
  const slot = me.mon.moves[i];
  const move = slot && slot.pp > 0 ? MOVES[slot.id] : STRUGGLE;
  if (slot && slot.pp > 0) slot.pp--;
  ev.push({ t: "use", side, move: move.id });
  ev.push({ t: "text", s: `${nameOf(me)}의 ${move.name}!` });
  const targetsFoe = move.power > 0 || (move.inflict && move.power === 0) || (move.boost && !move.boost.self);
  if (targetsFoe && rnd(rng) * 100 >= move.acc) {
    ev.push({ t: "miss", side: foeSide });
    ev.push({ t: "text", s: "그러나 빗나갔다!" });
    return;
  }
  if (move.power > 0) {
    const times = move.hits ? rint(rng, move.hits[0], move.hits[1]) : 1;
    let total = 0;
    let count = 0;
    let eff = 1;
    let crits = 0;
    for (let k = 0; k < times && foe.mon.hp > 0; k++) {
      const r = damage(me, foe, move, rng);
      const dealt = Math.min(foe.mon.hp, r.dmg);
      foe.mon.hp -= dealt;
      total += dealt;
      count++;
      eff = r.eff;
      if (r.crit) crits++;
      ev.push({ t: "hit", side: foeSide, dmg: dealt, eff: r.eff, crit: r.crit, move: move.id, n: count });
    }
    if (crits) ev.push({ t: "text", s: crits > 1 ? `급소에 ${crits}번 맞았다!` : "급소에 맞았다!" });
    if (eff > 1) ev.push({ t: "text", s: "아주 잘 들었다!" });
    else if (eff < 1) ev.push({ t: "text", s: "별로 안 들었다…" });
    if (move.hits) ev.push({ t: "text", s: `${count}번 맞았다!` });
    if (move.drain && total > 0 && me.mon.hp > 0) {
      const back = Math.min(me.stats.hp - me.mon.hp, Math.max(1, Math.floor(total * move.drain)));
      if (back > 0) {
        me.mon.hp += back;
        ev.push({ t: "heal", side, amount: back, drain: true });
        ev.push({ t: "text", s: `${nameOf(foe)}의 힘을 빨아들였다!` });
      }
    }
    const recoil = move === STRUGGLE ? Math.max(1, Math.floor(me.stats.hp / 4)) : move.recoil && total > 0 ? Math.max(1, Math.floor(total * move.recoil)) : 0;
    if (recoil > 0) {
      const back = Math.min(me.mon.hp, recoil);
      me.mon.hp -= back;
      ev.push({ t: "hit", side, dmg: back, eff: 1, crit: false, recoil: true });
      ev.push({ t: "text", s: `${josa(nameOf(me), "은/는")} 반동으로 아프다` });
    }
    if (move.flinch && foe.mon.hp > 0 && foeLater && rnd(rng) < move.flinch) foe.flinch = true;
  }
  if (move.heal) {
    const amount = Math.min(me.stats.hp - me.mon.hp, Math.floor(me.stats.hp * move.heal));
    me.mon.hp += amount;
    ev.push({ t: "heal", side, amount });
    ev.push({ t: "text", s: amount > 0 ? `${nameOf(me)}의 체력이 회복됐다` : "그러나 체력이 이미 가득하다" });
  }
  if (move.boost) {
    const who = move.boost.self ? me : foe;
    const whoSide = move.boost.self ? side : foeSide;
    if (who.mon.hp > 0) {
      const before = who.stages[move.boost.stat];
      who.stages[move.boost.stat] = clamp(before + move.boost.by, -6, 6);
      const by = who.stages[move.boost.stat] - before;
      ev.push({ t: "stat", side: whoSide, stat: move.boost.stat, by });
      ev.push({ t: "text", s: by === 0 ? "더는 변하지 않는다" : `${nameOf(who)}의 ${josa(STAT_NAME[move.boost.stat], "이/가")} ${by > 0 ? "올라갔다" : "내려갔다"}!` });
    }
  }
  if (move.inflict && foe.mon.hp > 0 && !foe.mon.status && rnd(rng) < move.inflict.chance) {
    const st = move.inflict.status;
    const t = SPECIES[foe.mon.species].type;
    const immune = (st === "burn" && t === "불꽃") || (st === "para" && t === "전기");
    if (!immune) {
      foe.mon.status = st;
      if (st === "sleep") foe.sleep = rint(rng, 1, 3);
      ev.push({ t: "status", side: foeSide, status: st });
      ev.push({ t: "text", s: `${josa(nameOf(foe), "은/는")} ${STATUS_NAME[st]} 상태가 됐다!` });
    }
  } else if (move.inflict && move.power === 0 && foe.mon.status) ev.push({ t: "text", s: "그러나 아무 일도 없었다" });
  if (foe.mon.hp <= 0) {
    ev.push({ t: "faint", side: foeSide });
    ev.push({ t: "text", s: `${josa(nameOf(foe), "은/는")} 쓰러졌다!` });
  }
  if (me.mon.hp <= 0) {
    ev.push({ t: "faint", side });
    ev.push({ t: "text", s: `${josa(nameOf(me), "은/는")} 쓰러졌다!` });
  }
}

function endOfTurn(b: Battle, ev: Ev[]) {
  for (const side of [0, 1] as const) {
    const f = activeOf(b, side);
    if (f.mon.hp <= 0) continue;
    const frac = f.mon.status === "burn" ? 1 / 12 : f.mon.status === "poison" ? 1 / 10 : 0;
    if (!frac) continue;
    const dmg = Math.min(f.mon.hp, Math.max(1, Math.floor(f.stats.hp * frac)));
    f.mon.hp -= dmg;
    ev.push({ t: "hit", side, dmg, eff: 1, crit: false });
    ev.push({ t: "text", s: `${josa(nameOf(f), "은/는")} ${STATUS_NAME[f.mon.status!]} 때문에 아프다` });
    if (f.mon.hp <= 0) {
      ev.push({ t: "faint", side });
      ev.push({ t: "text", s: `${josa(nameOf(f), "은/는")} 쓰러졌다!` });
    }
  }
}

const alive = (s: Side) => s.team.some((f) => f.mon.hp > 0);

function settle(b: Battle, ev: Ev[]) {
  const mine = alive(b.sides[0]);
  const theirs = alive(b.sides[1]);
  if (!theirs) {
    b.over = "win";
    ev.push({ t: "end", result: "win" });
    return;
  }
  if (!mine) {
    b.over = "lose";
    ev.push({ t: "text", s: "눈앞이 캄캄해졌다…" });
    ev.push({ t: "end", result: "lose" });
    return;
  }
  const foe = b.sides[1];
  if (foe.team[foe.active].mon.hp <= 0) {
    foe.active = foe.team.findIndex((f) => f.mon.hp > 0);
    ev.push({ t: "swap", side: 1, to: foe.active });
    ev.push({ t: "text", s: `${josa(foe.name, "은/는")} ${josa(nameOf(foe.team[foe.active]), "을/를")} 내보냈다!` });
  }
  if (b.sides[0].team[b.sides[0].active].mon.hp <= 0) b.needSwap = true;
}

export function catchChance(f: Fighter, ball: BallKey, aim: number): number {
  const sp = SPECIES[f.mon.species];
  const hpPart = 1 - (2 / 3) * (f.mon.hp / f.stats.hp);
  const st = f.mon.status === "sleep" ? 1.6 : f.mon.status ? 1.25 : 1;
  const aimMul = 0.8 + clamp(aim, 0, 1) * 0.5;
  return clamp(sp.catchRate * hpPart * st * BALLS[ball].mult * aimMul, 0.03, 0.97);
}

export function playTurn(input: Battle, action: Action, bag?: { balls: Record<BallKey, number>; items: Record<ItemKey, number> }): { battle: Battle; events: Ev[] } {
  const b = cloneBattle(input);
  const ev: Ev[] = [];
  if (b.over) return { battle: b, events: ev };
  const rng = { s: b.seed };
  const me = b.sides[0];

  if (b.needSwap) {
    if (action.kind !== "swap" || !me.team[action.to] || me.team[action.to].mon.hp <= 0) return { battle: input, events: [] };
    me.active = action.to;
    b.needSwap = false;
    if (!b.joined.includes(me.team[action.to].mon.id)) b.joined.push(me.team[action.to].mon.id);
    ev.push({ t: "swap", side: 0, to: action.to });
    ev.push({ t: "text", s: `가랏, ${nameOf(me.team[action.to])}!` });
    b.seed = rng.s;
    return { battle: b, events: ev };
  }

  b.turn++;
  let foeAct: Action = aiPick(b, 1, rng);
  let meFirst = true;

  if (action.kind === "run") {
    if (!b.wild) return { battle: input, events: [] };
    b.runTries++;
    const mine = speedOf(activeOf(b, 0));
    const theirs = speedOf(activeOf(b, 1));
    const p = clamp(0.45 + (mine - theirs) / (2 * theirs) + b.runTries * 0.15, 0.1, 1);
    if (rnd(rng) < p) {
      b.over = "run";
      ev.push({ t: "text", s: "무사히 도망쳤다!" });
      ev.push({ t: "end", result: "run" });
      b.seed = rng.s;
      return { battle: b, events: ev };
    }
    ev.push({ t: "text", s: "도망칠 수 없었다!" });
    meFirst = false;
    action = { kind: "move", i: -2 };
  } else if (action.kind === "swap") {
    if (action.to === me.active || !me.team[action.to] || me.team[action.to].mon.hp <= 0) return { battle: input, events: [] };
    const back = activeOf(b, 0);
    back.stages = { atk: 0, def: 0, spd: 0 };
    ev.push({ t: "text", s: `돌아와, ${nameOf(back)}!` });
    me.active = action.to;
    if (!b.joined.includes(me.team[action.to].mon.id)) b.joined.push(me.team[action.to].mon.id);
    ev.push({ t: "swap", side: 0, to: action.to });
    ev.push({ t: "text", s: `가랏, ${nameOf(me.team[action.to])}!` });
    action = { kind: "move", i: -2 };
    meFirst = false;
  } else if (action.kind === "item") {
    const target = me.team[action.target];
    if (!bag || (bag.items[action.item] ?? 0) <= 0 || !target) return { battle: input, events: [] };
    const used = applyItem(target.mon, action.item);
    if (!used) return { battle: input, events: [] };
    const gain = used.hp - target.mon.hp;
    target.mon = used;
    ev.push({ t: "text", s: `${josa(ITEMS[action.item].name, "을/를")} 썼다!` });
    if (action.target === me.active) {
      if (gain > 0) ev.push({ t: "heal", side: 0, amount: gain });
    }
    ev.push({ t: "text", s: gain > 0 ? `${nameOf(target)}의 체력이 ${gain} 회복됐다` : `${josa(nameOf(target), "이/가")} 개운해졌다` });
    if (action.item === "cure") target.sleep = 0;
    action = { kind: "move", i: -2 };
    meFirst = false;
  } else if (action.kind === "ball") {
    if (!b.wild || !bag || (bag.balls[action.ball] ?? 0) <= 0) return { battle: input, events: [] };
    const wild = activeOf(b, 1);
    const p = catchChance(wild, action.ball, action.aim);
    const each = Math.pow(p, 1 / 3);
    let shakes = 0;
    while (shakes < 3 && rnd(rng) < each) shakes++;
    const caught = shakes === 3;
    ev.push({ t: "text", s: `${josa(BALLS[action.ball].name, "을/를")} 던졌다!` });
    ev.push({ t: "throw", ball: action.ball, shakes, caught });
    if (caught) {
      b.over = "caught";
      b.caught = { ...wild.mon, moves: wild.mon.moves.map((x) => ({ ...x })) };
      ev.push({ t: "text", s: `${josa(nameOf(wild), "을/를")} 잡았다!` });
      ev.push({ t: "end", result: "caught" });
      b.seed = rng.s;
      return { battle: b, events: ev };
    }
    ev.push({ t: "text", s: shakes === 0 ? "공에서 바로 튀어나왔다!" : shakes === 1 ? "아까워! 금방 나왔다" : "조금만 더였는데!" });
    action = { kind: "move", i: -2 };
    meFirst = false;
  } else {
    const myMove = MOVES[me.team[me.active].mon.moves[action.i]?.id] ?? STRUGGLE;
    const foeMove = foeAct.kind === "move" ? MOVES[activeOf(b, 1).mon.moves[foeAct.i]?.id] ?? STRUGGLE : STRUGGLE;
    const pa = myMove.priority ?? 0;
    const pb = foeMove.priority ?? 0;
    const sa = speedOf(activeOf(b, 0));
    const sb = speedOf(activeOf(b, 1));
    meFirst = pa !== pb ? pa > pb : sa !== sb ? sa > sb : rnd(rng) < 0.5;
  }

  const order: (0 | 1)[] = meFirst ? [0, 1] : [1, 0];
  order.forEach((side, pos) => {
    if (b.over) return;
    const f = activeOf(b, side);
    const other = activeOf(b, side === 0 ? 1 : 0);
    if (f.mon.hp <= 0 || other.mon.hp <= 0) return;
    if (side === 0) {
      if (action.kind === "move" && action.i >= -1) doMove(b, 0, action.i, rng, ev, pos === 0);
    } else {
      if (foeAct.kind !== "move") foeAct = { kind: "move", i: -1 };
      doMove(b, 1, foeAct.i, rng, ev, pos === 0);
    }
  });
  for (const s of b.sides) for (const f of s.team) f.flinch = false;
  endOfTurn(b, ev);
  settle(b, ev);
  b.seed = rng.s;
  return { battle: b, events: ev };
}

export type Outcome = { save: AdvSave; notes: string[]; gold: number };

export function finishBattle(save: AdvSave, b: Battle, spent: { balls: Record<BallKey, number>; items: Record<ItemKey, number> }): Outcome {
  const notes: string[] = [];
  let party: Mon[] = b.sides[0].team.map((f) => ({ ...f.mon, status: f.mon.status === "sleep" ? undefined : f.mon.status }));
  let gold = 0;
  const foe = b.sides[1].team;
  if (b.over === "win" || b.over === "caught") {
    const totalXp = foe.reduce((a, f) => a + (f.mon.hp <= 0 || b.over === "caught" ? (SPECIES[f.mon.species].xp * f.mon.level) / 7 : 0), 0);
    const share = b.joined.filter((id) => party.some((m) => m.id === id && m.hp > 0));
    party = party.map((m) => {
      if (!share.includes(m.id)) return m;
      const r = grantXp(m, totalXp / Math.max(1, share.length) * (b.wild ? 1 : 1.5));
      notes.push(...r.notes);
      return r.mon;
    });
    if (b.over === "win") gold = foe.reduce((a, f) => a + f.mon.level * 8 + 10, 0);
  }
  let box = save.box;
  let caught = save.caught;
  let next = save.next;
  if (b.over === "caught" && b.caught) {
    const mon: Mon = { ...b.caught, id: `m${next++}`, status: undefined, caughtAt: b.region };
    if (party.length < PARTY_MAX) party = [...party, mon];
    else {
      box = [...box, mon];
      notes.push(`팀이 가득 차서 ${josa(SPECIES[mon.species].name, "은/는")} 보관함으로 갔다`);
    }
    if (!caught.includes(mon.species)) caught = [...caught, mon.species];
  }
  for (const m of party) if (!caught.includes(m.species)) caught = [...caught, m.species];
  const seen = [...new Set([...save.seen, ...caught])];
  if (b.over === "lose") {
    const lost = Math.floor(save.gold * 0.1);
    gold = -lost;
    party = party.map(healMon);
    notes.push(`쉼터로 돌아와 모두 회복했다${lost ? ` · 골드 ${lost} 를 잃었다` : ""}`);
  }
  return {
    save: {
      ...save,
      party, box, caught, seen, next,
      gold: Math.max(0, save.gold + gold),
      balls: spent.balls,
      items: spent.items,
      wins: save.wins + (b.over === "win" ? 1 : 0),
      catches: save.catches + (b.over === "caught" ? 1 : 0),
      seed: b.seed,
    },
    notes,
    gold,
  };
}
