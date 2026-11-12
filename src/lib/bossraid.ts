/** 주인 레이드(2026-11-11) [사용자: "커플 보스전은 일반 낚시 말고 다른 방법으로 즐겼으면 좋겠어"]
 *  낚시터의 주인과 겨루는 전용 한 판 — 찌낚시 힘겨루기를 다시 쓰지 않는다. 손이 하는 일은 둘:
 *   ① 막기 — 주인이 덮칠 쪽을 미리 알린다(화살표). 덮치는 순간 그쪽으로 밀면(스와이프 · 방향키) 막는다. 엉뚱한 쪽 · 너무 이르면 줄이 하나 끊긴다.
 *   ② 연타 — 막으면 주인이 비틀거린다. 그동안 두드리는 만큼 체력을 깎는다.
 *  한 판 30초 · 줄 셋. 점수(0~1) = 깎은 양 ÷ need — 저장은 옛 주인전과 같은 길(bossOpen → 판이 끝나는 순간 bossLost(깎은 양 = chunk × 점수) · 다 깎으면 bossWon)이라
 *  하루 3번 · 협공 1.5배 · 쉬는 날 회복 · 분노 단계 · 둘의 몫 기록이 그대로다.
 *  커플: 상대가 오늘 이 주인을 깎았으면 '상대가 남긴 상처' — 판을 비틀거리는 주인으로 시작한다(혼자 하는 섬은 없다).
 *  순수 — 시드와 dt 만 쓴다(난수 · 시계 금지). 화면은 events 를 읽어 그린다. */

export type RaidDir = 0 | 1 | 2 | 3;
/** ← ↑ → ↓ */
export const RAID_DIRS = ["←", "↑", "→", "↓"] as const;
export const RAID_DIR_NAME = ["왼쪽", "위", "오른쪽", "아래"] as const;

export type RaidTune = {
  /** 알리고 덮치기까지(초) */ warn: number;
  /** 다음 공격까지 쉬는 시간(초, 이 값의 0.7~1.3배) */ gap: number;
  /** 막은 뒤 비틀거리는 시간(초) */ stagger: number;
  /** 방향을 바꾸는 속임수 확률 */ feint: number;
  /** 줄(목숨) */ hearts: number;
  /** 한 판 길이(초) */ dur: number;
  /** 점수 1 에 필요한 양 */ need: number;
  /** 연타 한 번 · 막기 한 번의 세기 */ power: number;
  /** 연속 공격 확률 */ double: number;
  /** 큰 공격 확률 */ heavy: number;
};

/** 막기가 먹히는 때 — 덮치기 이만큼 전부터 이만큼 뒤까지 */
export const PARRY_EARLY = 0.45, PARRY_LATE = 0.12, PERFECT = 0.12;
/** 공격 종류(2026-11-13) [사용자: "보스전도 게임 자체가 너무 허접해"] — 한 가지 덮치기만 되풀이하던 것에
 *  ① 연속(double): 막자마자 곧바로 다른 쪽에서 한 번 더 — 둘 다 막아야 비틀거린다
 *  ② 큰 공격(heavy): 길게 모았다가 덮친다 — 완벽히 막으면 오래 비틀거리고 크게 깎인다
 *  가 섞인다. 화날수록 연속이 잦다. */
export type RaidKind = "strike" | "double" | "heavy";
/** 연타 콤보 — 한 번 비틀거리는 동안 이어 두드린 수만큼 세진다(최대 COMBO_MAX 배) */
export const COMBO_STEP = 0.03, COMBO_MAX = 1.5;
/** 연타는 0.12초에 한 번까지만 센다(초당 8번 남짓 — 손이 빠른 사람과 느린 사람의 차이를 줄인다) */
export const TAP_GAP = 0.12;
export const RAID_DUR = 30;

const soft = (x: number) => x / (1 + Math.max(0, x) / 110);

/** 주인 · 기세(분노 단계) · 능력치로 정한다. difficulty 1.2(돌쇠) ~ 7.2(크라켄) */
export function raidTune(difficulty: number, phase: 0 | 1 | 2, eff: { power: number; line: number }): RaidTune {
  const d = Math.max(1, difficulty);
  const warn = Math.max(0.5, 1.18 - 0.07 * d - 0.07 * phase + soft(eff.line) * 0.0025);
  return {
    warn,
    gap: Math.max(0.45, 1.05 - 0.05 * d - 0.08 * phase),
    stagger: Math.max(0.8, 1.5 - 0.07 * d) + soft(eff.power) * 0.004,
    feint: Math.min(0.45, Math.max(0, (d - 2.5) * 0.06) + phase * 0.08),
    double: Math.min(0.4, d >= 2 ? 0.12 + (d - 2) * 0.03 + phase * 0.08 : 0),
    heavy: d >= 1.8 ? 0.14 : 0,
    hearts: 3,
    dur: RAID_DUR,
    // 점수 1 에 필요한 양 — 주인이 셀수록 · 화날수록 공격이 잦아 막기 · 연타 기회가 늘어서(같은 손이 더 깎았다) 그만큼 더 요구한다.
    // ⚠ 예전 105 고정은 대충 하는 손도 0.8~0.9, 화살표만 맞히면 거의 늘 1 이었다(2026-11-11 실측) — 잘하는 손 ≈ 0.85~1, 대충 ≈ 0.6~0.7
    need: Math.round(121 + 2.6 * (d - 1) + 6.3 * phase),
    power: 1 + soft(eff.power) * 0.004,
  };
}

export type RaidEvent =
  | { k: "warn"; t: number; dir: RaidDir }
  | { k: "feint"; t: number; dir: RaidDir }
  | { k: "parry"; t: number; dir: RaidDir; perfect: boolean; kind?: RaidKind; chain?: boolean }
  | { k: "hit"; t: number; dir: RaidDir; why: "wrong" | "early" | "late" }
  | { k: "tap"; t: number; d: number; combo: number }
  | { k: "rage"; t: number; phase: number }
  | { k: "end"; t: number; why: RaidEnd };
export type RaidEnd = "time" | "down" | "kill";

export type RaidAttack = { dir: RaidDir; warnAt: number; hitAt: number; switchAt?: number; to?: RaidDir; swapped?: boolean; kind: RaidKind; /** 연속의 첫 번째면 1(막으면 하나 더) */ chain?: number };
export type Raid = {
  t: number; seed: number; tune: RaidTune;
  hearts: number; dealt: number;
  atk: RaidAttack | null; nextAt: number;
  stagger: number; lastTap: number; combo: number; maxCombo: number;
  /** 판 도중의 분노 — 연 때 체력 · 한 판 몫으로 지금 체력을 재서 2/3 · 1/3 을 넘으면 오른다. 오른 만큼 빨라진다 */
  hp0: number; chunk: number; phase0: number; phase: number;
  parried: number; perfect: number; missed: number; taps: number;
  /** 다 깎으면 끝나는 양(남은 체력 ÷ chunk × need) — 그 이상은 의미가 없다 */
  killAt: number;
  end: RaidEnd | null;
  events: RaidEvent[];
};

function next(r: Raid): number {
  // mulberry32 — 시드만으로 같은 판
  let x = (r.seed = (r.seed + 0x6d2b79f5) >>> 0);
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

/** 판을 연다. hp · chunk 는 지금 체력과 한 판을 다 했을 때 깎이는 양(협공이면 1.5배가 들어 있다). wound = 상대가 남긴 상처(처음 비틀거리는 시간) */
export function startRaid(seed: number, tune: RaidTune, hp: number, chunk: number, wound = 0): Raid {
  const r: Raid = {
    t: 0, seed: seed >>> 0, tune, hearts: tune.hearts, dealt: 0, atk: null, nextAt: wound > 0 ? wound + 0.6 : 1.2,
    stagger: wound > 0 ? wound : 0, lastTap: -1, combo: 0, maxCombo: 0, parried: 0, perfect: 0, missed: 0, taps: 0,
    hp0: hp, chunk, phase0: phaseOf(hp), phase: phaseOf(hp),
    killAt: chunk > 0 ? (Math.max(0, hp) / chunk) * tune.need : Infinity, end: null, events: [],
  };
  return r;
}

export const raidScore = (r: Pick<Raid, "dealt" | "tune">) => Math.min(1, r.dealt / r.tune.need);
/** 주인 기세 — fishing.bossPhase 와 같은 경계(2/3 · 1/3) */
const phaseOf = (hp: number) => (hp <= 1 / 3 ? 2 : hp <= 2 / 3 ? 1 : 0);
/** 판 도중 분노로 빨라진 배율 */
const speedOf = (r: Pick<Raid, "phase" | "phase0">) => 1 + 0.12 * Math.max(0, r.phase - r.phase0);
/** 이 판이 끝난 뒤 남는 체력 — 0 이면 토벌 */
export const raidLeft = (hp: number, chunk: number, r: Pick<Raid, "dealt" | "tune" | "end">) => (r.end === "kill" ? 0 : Math.max(0, hp - chunk * raidScore(r)));

function finish(r: Raid, why: RaidEnd) {
  if (r.end) return;
  r.end = why;
  r.atk = null;
  r.events.push({ k: "end", t: r.t, why });
}
function deal(r: Raid, d: number) {
  r.dealt += d;
  if (r.dealt >= r.killAt) { r.dealt = r.killAt; finish(r, "kill"); return; }
  // 판 도중 분노 — 지금 체력이 경계를 넘으면
  const ph = phaseOf(r.hp0 - r.chunk * raidScore(r));
  if (ph > r.phase) { r.phase = ph; r.events.push({ k: "rage", t: r.t, phase: ph }); }
}
function hurt(r: Raid, why: "wrong" | "early" | "late") {
  const a = r.atk!;
  r.events.push({ k: "hit", t: r.t, dir: a.dir, why });
  r.missed++;
  r.hearts--;
  r.atk = null;
  r.nextAt = r.t + (r.tune.gap / speedOf(r)) * (0.9 + next(r) * 0.5);
  if (r.hearts <= 0) finish(r, "down");
}

/** 시간을 dt 만큼 — 공격을 알리고, 속임수로 방향을 틀고, 덮칠 때 못 막았으면 줄이 끊긴다 */
export function stepRaid(r: Raid, dt: number): Raid {
  if (r.end) return r;
  r.t += dt;
  if (r.t >= r.tune.dur) { finish(r, "time"); return r; }
  if (r.stagger > 0) {
    r.stagger = Math.max(0, r.stagger - dt);
    if (r.stagger === 0) { r.combo = 0; r.nextAt = Math.max(r.nextAt, r.t + (r.tune.gap / speedOf(r)) * (0.5 + next(r) * 0.4)); }
    return r;
  }
  const a = r.atk;
  if (!a) {
    if (r.t >= r.nextAt) {
      const dir = Math.floor(next(r) * 4) as RaidDir, sp = speedOf(r);
      // 종류 — 큰 공격 · 연속 · 보통. 뽑는 순서를 고정해 같은 시드 = 같은 판
      const roll = next(r);
      const kind: RaidKind = roll < r.tune.heavy ? "heavy" : roll < r.tune.heavy + r.tune.double ? "double" : "strike";
      const atk: RaidAttack = { dir, kind, warnAt: r.t, hitAt: r.t + (r.tune.warn / sp) * (0.9 + next(r) * 0.25) * (kind === "heavy" ? 1.6 : 1) };
      if (kind === "double") atk.chain = 1;
      if (kind !== "heavy" && next(r) < r.tune.feint) {
        atk.switchAt = atk.warnAt + (atk.hitAt - atk.warnAt) * 0.45;
        atk.to = ((dir + 1 + Math.floor(next(r) * 3)) % 4) as RaidDir;
        // 속임수가 있는 공격은 조금 늦게 덮친다 — 바뀐 걸 보고 움직일 틈
        atk.hitAt += 0.25;
      }
      r.atk = atk;
      r.events.push({ k: "warn", t: r.t, dir });
    }
    return r;
  }
  if (a.switchAt !== undefined && !a.swapped && r.t >= a.switchAt) {
    a.swapped = true;
    a.dir = a.to!;
    r.events.push({ k: "feint", t: r.t, dir: a.dir });
  }
  if (r.t > a.hitAt + PARRY_LATE) hurt(r, "late");
  return r;
}

/** 민다(스와이프 · 방향키) */
export function swipeRaid(r: Raid, dir: RaidDir): Raid {
  if (r.end || r.stagger > 0) return r;
  const a = r.atk;
  if (!a) return r;
  if (r.t < a.hitAt - PARRY_EARLY) { hurt(r, "early"); return r; }
  if (dir !== a.dir) { hurt(r, "wrong"); return r; }
  const perfect = Math.abs(r.t - a.hitAt) <= PERFECT;
  r.events.push({ k: "parry", t: r.t, dir, perfect, kind: a.kind, chain: !!a.chain });
  r.parried++;
  if (perfect) r.perfect++;
  r.atk = null;
  const heavy = a.kind === "heavy";
  deal(r, 2 * r.tune.power * (perfect ? 1.5 : 1) * (heavy ? 1.8 : 1));
  if (r.end) return r;
  // 연속의 첫 번째 — 곧바로 다른 쪽에서 한 번 더(비틀거림은 둘 다 막은 뒤)
  if (a.chain) {
    const d2 = ((a.dir + 1 + Math.floor(next(r) * 3)) % 4) as RaidDir;
    r.atk = { dir: d2, kind: "double", warnAt: r.t, hitAt: r.t + Math.max(0.5, (r.tune.warn / speedOf(r)) * 0.8) };
    r.events.push({ k: "warn", t: r.t, dir: d2 });
    return r;
  }
  r.stagger = (r.tune.stagger + (perfect ? 0.4 : 0)) * (heavy && perfect ? 1.6 : a.kind === "double" ? 1.25 : 1);
  r.combo = 0;
  return r;
}

/** 두드린다 — 비틀거리는 동안만 깎는다 */
export function tapRaid(r: Raid): Raid {
  if (r.end || r.stagger <= 0) return r;
  if (r.lastTap >= 0 && r.t - r.lastTap < TAP_GAP) return r;
  r.lastTap = r.t;
  r.taps++;
  r.combo++;
  r.maxCombo = Math.max(r.maxCombo, r.combo);
  const d = r.tune.power * Math.min(COMBO_MAX, 1 + (r.combo - 1) * COMBO_STEP);
  r.events.push({ k: "tap", t: r.t, d, combo: r.combo });
  deal(r, d);
  return r;
}

/* ── 손가락 판정 ─────────────────────────────────────
 * ⚠ 손을 뗄 때 판정하면 박자에 맞춰 민 손가락이 늦게(late) 잡혔다 — 미는 동안 SWIPE_PX 를 넘는 순간 바로 판정한다.
 * ⚠ 손가락마다 시작점을 따로 둔다 — 두 엄지로 번갈아 두드리면 한 시작점을 함께 써서 멀리 떨어진 두 점이 '밀기'로 읽혔다. */

/** 이만큼 밀어야 밀기 — 그보다 짧으면 누르기 */
export const SWIPE_PX = 28;
export type RaidTouch = { x: number; y: number; done: boolean };
export type RaidGesture = { k: "swipe"; dir: RaidDir } | { k: "tap" } | null;
export const swipeDir = (dx: number, dy: number): RaidDir => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : dy < 0 ? 1 : 3);
export function touchDown(m: Map<number, RaidTouch>, id: number, x: number, y: number) {
  m.set(id, { x, y, done: false });
}
/** 미는 중 — 처음 SWIPE_PX 를 넘는 순간 한 번만 밀기 */
export function touchMove(m: Map<number, RaidTouch>, id: number, x: number, y: number): RaidGesture {
  const s = m.get(id);
  if (!s || s.done || Math.hypot(x - s.x, y - s.y) < SWIPE_PX) return null;
  s.done = true;
  return { k: "swipe", dir: swipeDir(x - s.x, y - s.y) };
}
/** 뗐다 — 이미 밀기로 판정했으면 아무것도 아니다. 짧으면 누르기 · 움직임을 못 받았으면 여기서 밀기 */
export function touchUp(m: Map<number, RaidTouch>, id: number, x: number, y: number): RaidGesture {
  const s = m.get(id);
  m.delete(id);
  if (!s || s.done) return null;
  return Math.hypot(x - s.x, y - s.y) < SWIPE_PX ? { k: "tap" } : { k: "swipe", dir: swipeDir(x - s.x, y - s.y) };
}

/** 상대가 남긴 상처 — 오늘 상대가 이 주인을 깎은 양(0~1)에 비례해 처음 비틀거리는 시간(최대 3초). 혼자면 0 */
export function partnerWound(log: readonly { who: string; d: number; day: string }[] | undefined, who: string, today: string): number {
  const d = (log ?? []).filter((h) => h.who !== who && h.day === today).reduce((a, h) => a + h.d, 0);
  return d > 0 ? Math.min(3, 1.2 + d * 12) : 0;
}
