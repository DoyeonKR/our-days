/* 보글보글 — 히어로가 거품을 쏴서 몬스터를 가두고, 터뜨려 잡는 액션 게임.
 *
 * [사용자 요청 2026-08-07 "히어로인을 이용할 수 있는 보글보글 게임 만들어줘
 *  보글보글은 스테이지 별로 난이도가 올라가야해"]
 *
 * 사냥(hunt.ts)이 **안 보고 있어도 되는** 방치형이라면, 이건 정반대다 — 손으로 하는 게임.
 * 그래서 설계 원칙이 다르다:
 *   · 사냥은 경과 시간을 한 번에 정산한다(settle).
 *   · 보글보글은 **고정 타임스텝**으로 한 프레임씩 굴린다(step). 프레임률이 흔들려도
 *     같은 입력이면 같은 결과가 나와야 테스트가 가능하고, 느린 기기에서 물리가 안 깨진다.
 *
 * ⚠ 이 파일에는 Date.now() 도 Math.random() 도 없다. 시간은 프레임 수로 세고,
 *   무작위는 상태에 든 카운터(rng)로 뽑는다. 그래야 "스테이지 7이 이상하다"는 제보를
 *   시드만 받아서 그대로 재현할 수 있다.
 *
 * ⚠ 진행 상태(BubbleState)는 **서버에 저장하지 않는다.** 초당 60프레임짜리 물리를
 *   무료 티어 DB 에 밀어 넣을 이유가 없다. 남기는 건 기록(BubbleRecord)뿐이고,
 *   그것도 스테이지를 깼을 때만 쓴다.
 */

import { hash01 } from "./pixel.ts";

// ── 무대 ──────────────────────────────────────────────────────────────────
export const TILE = 8;
/* 원작은 256×224 — **가로가 긴** 아케이드 화면이다. 1차판은 18×22(세로가 김)라
   아무리 잘 그려도 "아케이드"로 안 읽혔다. 20×18 은 1.11:1 로 원작(1.14:1)과 사실상 같다.
   폭을 더 키우면 폰에서 정수 2배 확대가 안 돼 도트가 찌그러진다(160×2=320 이 상한). */
export const COLS = 20;
export const ROWS = 18;
export const W = COLS * TILE; // 160
export const H = ROWS * TILE; // 144
/** 고정 타임스텝. 화면 주사율이 뭐든 물리는 이 간격으로만 전진한다. */
export const DT = 1000 / 60;

/* 히어로/몬스터 히트박스. 스프라이트(16×16)보다 조금 작다 —
   도트 게임에서 히트박스를 그림에 딱 맞추면 "안 닿았는데 죽었다"가 된다. */
export const HERO_W = 11;
export const HERO_H = 13;
export const MON_W = 12;
export const MON_H = 12;
export const BUB_R = 6;

const GRAVITY = 0.42;
const MAX_FALL = 5.4;
const RUN = 1.35;
/* 점프 최고 높이 = v²/(2g). 이 값이 **층간 거리보다 확실히 커야** 게임이 성립한다.
   -6.2 였을 때 최고 45px 인데 바닥에서 첫 발판까지가 48px 이라 사실상 못 올라갔다
   (자동 플레이 20판 중 아래층에 갇혀 못 깬 판이 여럿 나왔다). -6.9 면 57px 로 여유가 생긴다. */
const JUMP_V = -6.9;

// ── 스테이지 배치 ─────────────────────────────────────────────────────────
/* 손으로 그린 배치 4종. 층은 **2, 6, 10, 14행 + 바닥 17행**으로 고정이다 —
   층 사이 4타일(32px), 바닥→14행 24px. 점프 최고가 57px 이라 둘 다 여유가 있다.
   0·1행은 비워 둔다 — 빈 거품이 천장까지 떠올라 스러지는 자리다.
   절차 생성을 안 쓴 이유: 발판이 하나만 잘못 놓여도
   **닿을 수 없는 몬스터**가 생겨 스테이지를 영영 못 깬다. 무작위성은 몬스터 쪽에만 준다.
   '#' 발판 · ' ' 빈칸. 맨 아랫줄은 항상 바닥이다. */
const LAYOUTS: string[][] = [
  [
    "                    ",
    "                    ",
    "  #####      ###### ",
    "                    ",
    "                    ",
    "                    ",
    "####    #####    ###",
    "                    ",
    "                    ",
    "                    ",
    "   #######     #####",
    "                    ",
    "                    ",
    "                    ",
    " #####    #####     ",
    "                    ",
    "                    ",
    "####################",
  ],
  [
    "                    ",
    "                    ",
    "######     #####    ",
    "                    ",
    "                    ",
    "                    ",
    "    ######     #####",
    "                    ",
    "                    ",
    "                    ",
    "###   ####  #####   ",
    "                    ",
    "                    ",
    "                    ",
    "   #####     #######",
    "                    ",
    "                    ",
    "####################",
  ],
  [
    "                    ",
    "                    ",
    "   #####   ######   ",
    "                    ",
    "                    ",
    "                    ",
    "####            ####",
    "                    ",
    "                    ",
    "                    ",
    "  ######   #####    ",
    "                    ",
    "                    ",
    "                    ",
    "     #####    ######",
    "                    ",
    "                    ",
    "####################",
  ],
  [
    "                    ",
    "                    ",
    " ################   ",
    "                    ",
    "                    ",
    "                    ",
    " ###          ###   ",
    "                    ",
    "                    ",
    "                    ",
    " ###   ######  ###  ",
    "                    ",
    "                    ",
    "                    ",
    "  ################  ",
    "                    ",
    "                    ",
    "####################",
  ],
];

/** 스테이지의 발판 배치. 4종을 돌려 쓰되 홀수 바퀴는 좌우를 뒤집어 8종처럼 보이게 한다. */
export function layoutFor(stage: number): string[] {
  const i = (stage - 1) % LAYOUTS.length;
  const mirror = Math.floor((stage - 1) / LAYOUTS.length) % 2 === 1;
  const rows = LAYOUTS[i];
  return mirror ? rows.map((r) => [...r].reverse().join("")) : rows;
}

/** (col,row) 가 발판인가. 바깥은 발판이 아니다(가장자리는 감싸서 통과한다). */
export function solidAt(rows: string[], col: number, row: number): boolean {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0 || col >= COLS) return false;
  return rows[row][col] === "#";
}

// ── 난이도 ────────────────────────────────────────────────────────────────
/* 사용자 요청의 핵심: **스테이지마다 확실히 어려워져야 한다.**
   한 축만 올리면 금방 질리거나(수만 늘면 지겹고) 불공평해진다(속도만 올리면 억울하다).
   그래서 축을 넷으로 나눠 서로 다른 속도로 올린다. */

/** 몬스터 수 — 2마리에서 시작해 두 스테이지마다 하나씩, 최대 8마리. */
export const monsterCount = (stage: number): number =>
  Math.min(8, 2 + Math.floor((stage - 1) / 2));

/** 몬스터 속도 배수 — 스테이지당 +5%, 2.2배에서 멈춘다(그 위는 반응이 불가능해진다). */
export const monsterSpeed = (stage: number): number =>
  Math.min(2.2, 1 + (stage - 1) * 0.05);

/** 가둬 둘 수 있는 시간(ms). 6초에서 시작해 2.2초까지 줄어든다 — 후반엔 바로 터뜨려야 한다. */
export const captureMs = (stage: number): number =>
  Math.max(2200, 6000 - (stage - 1) * 190);

/** 점프하는 몬스터가 나오는 스테이지. 4부터 섞이기 시작한다. */
export const jumperFrom = 4;
/** 히어로를 쫓아오는 확률 — 6스테이지부터 붙어 0.55 에서 멈춘다. */
export const chaseChance = (stage: number): number =>
  stage < 6 ? 0 : Math.min(0.55, (stage - 5) * 0.07);
/** 10스테이지마다 보스 — 체력 대신 **두 번 가둬야** 잡히는 놈으로 만든다. */
export const isBossStage = (stage: number): boolean => stage % 10 === 0;

/* ── 원작의 시간 장치 ─────────────────────────────────────────────────────
   원작은 판마다 두 아이템을 정해진 시각에 띄우고(점수템 ~7초, 특수템 ~12초),
   오래 끌면 HURRY UP! 과 함께 **가둘 수 없는 해골**을 보낸다.
   시간이 곧 압박이라 '안전한 구석에서 버티기'가 성립하지 않는다. */
/** 점수 아이템이 뜨는 시각(ms) */
export const ITEM1_MS = 7_000;
/** 특수 아이템이 뜨는 시각(ms) */
export const ITEM2_MS = 12_000;
/** 이 시각을 넘기면 HURRY UP! 경고 */
export const HURRY_MS = 30_000;
/** 경고 뒤 해골이 실제로 나오는 시각 */
export const SKEL_MS = 36_000;
/** 특수 거품이 흘러들어오는 간격 */
export const SPECIAL_EVERY_MS = 9_000;
/** 강화 아이템 지속시간 */
export const BOOST_MS = 12_000;
/** 해골 속도(px/프레임) — 느리지만 벽도 발판도 통과한다. 도망칠 수는 있어야 한다. */
export const SKEL_SPEED = 0.62;

/* 몬스터 종류 — 원작(Taito 1986)의 적을 그대로 가져왔다. 이름이 실제 캐릭터라
   그림도 그 캐릭터로 그릴 수 있다(pixelbubble.ts). 예전엔 사냥 몬스터를 빌려 썼는데,
   그건 이 게임의 캐릭터가 아니라 남의 게임에서 온 손님처럼 보였다. */
export const MON_KINDS = ["zen", "monsta", "banebou", "pulpul", "hidegons"] as const;
export type MonKind = (typeof MON_KINDS)[number];

/** 원작의 적은 생김새가 아니라 **움직임**으로 기억된다. 종마다 대처법이 달라야 한다. */
export type MonBehavior = "walk" | "fly" | "bounce" | "hover" | "breathe";

export const behaviorOf = (kind: MonKind): MonBehavior =>
  kind === "monsta"
    ? "fly" // 고래 — 대각선으로 날며 발판에 튕긴다
    : kind === "banebou"
      ? "bounce" // 용수철 — 쉬지 않고 튄다
      : kind === "pulpul"
        ? "hover" // 프로펠러 — 떠서 히어로 높이를 따라온다
        : kind === "hidegons"
          ? "breathe" // 털북숭이 — 걸으면서 불을 뿜는다
          : "walk"; // Zen-Chan — 기본 걸음

/** 불을 뿜는 간격(ms). 스테이지가 올라도 이건 안 줄인다 — 이미 충분히 성가시다. */
export const BREATH_EVERY_MS = 2600;

export function kindFor(stage: number, i: number): MonKind {
  if (isBossStage(stage)) return i === 0 ? "monsta" : MON_KINDS[i % 4];
  // 스테이지가 오를수록 뒤쪽(사나운) 종류가 섞인다
  const pool = Math.min(MON_KINDS.length, 2 + Math.floor(stage / 3));
  return MON_KINDS[(stage + i * 3) % pool];
}

// ── 무기 연동 ─────────────────────────────────────────────────────────────
/* 사냥과 같은 무기를 쓴다. 여기서 무기는 '공격력'이 아니라 **거품의 성능**이 된다.
   액션 게임에서 숫자만 커지면 재미가 안 붙으므로, 손에 잡히는 차이로 바꾼다. */

/** 거품 사거리(px). 맨손 44 → 좋은 무기일수록 화면 절반까지 닿는다. */
export const bubbleRange = (atk: number): number => Math.min(96, 44 + atk * 1.6);
/** 재장전(ms). 맨손 420ms → 최대 180ms 까지 빨라진다. */
export const reloadMs = (atk: number): number => Math.max(180, 420 - atk * 7);
/** 이동 속도 배수 — 히어로 레벨이 올라가면 조금 빨라진다(최대 +30%). */
export const heroSpeed = (level: number): number => Math.min(1.3, 1 + (level - 1) * 0.012);

// ── 상태 ──────────────────────────────────────────────────────────────────
export type Hero = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  onGround: boolean;
  /** 남은 재장전(ms) */
  cool: number;
  /** 남은 무적(ms) — 부활 직후 */
  inv: number;
};

export type MonState = "free" | "bubbled" | "dead";
export type Mon = {
  id: number;
  kind: MonKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  st: MonState;
  /** 가둔 뒤 남은 시간(ms). 0 이 되면 풀려난다. */
  hold: number;
  /** 한 번 풀려난 놈은 화가 나서 빨라진다 */
  angry: boolean;
  /** 보스는 두 번 가둬야 잡힌다 */
  tough: number;
  /** 다음 불을 뿜기까지 남은 시간(ms). breathe 종만 쓴다. */
  breath: number;
};

export type Bub = {
  id: number;
  x: number;
  y: number;
  vx: number;
  /** 남은 직진 거리(px). 0 이 되면 위로 뜬다. */
  dash: number;
  /** 남은 수명(ms) */
  life: number;
  /** 가둔 몬스터 id (없으면 null) */
  hold: number | null;
};

export type Drop = {
  id: number;
  x: number;
  y: number;
  vy: number;
  life: number;
  value: number;
};

/** 특수 거품 — 히어로가 만든 게 아니라 **화면 밖에서 흘러들어온다**. */
export type SpecialKind = "lightning" | "fire" | "water";
export type Special = {
  id: number;
  kind: SpecialKind;
  x: number;
  y: number;
  vx: number;
  life: number;
};

/** 터진 특수 거품이 남기는 것 — 번개는 가로로 뻗고, 불·물은 떨어진다. */
export type BlastKind = "bolt" | "flame" | "flood";
export type Blast = {
  id: number;
  kind: BlastKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** true = **적이 쏜 것**. 히어로를 해치고 몬스터는 안 죽인다.
   *  하나의 배열로 관리하되 방향만 뒤집는다 — 목록을 둘로 나누면 그리기·정리가 두 벌이 된다. */
  foe?: boolean;
};

/** 아이템. gem 은 점수, 나머지는 능력이 바뀐다. */
export type ItemKind = "gem" | "candy" | "shoes" | "lantern";
export type Item = { id: number; kind: ItemKind; x: number; y: number; vy: number; life: number };

/** EXTEND 글자 — 여섯 개를 다 모으면 목숨이 하나 는다. */
export const EXTEND_LETTERS = ["E", "X", "T", "E", "N", "D"] as const;
export type Letter = { id: number; idx: number; x: number; y: number; vy: number; life: number };

/** 해골 — 가둘 수 없고 벽·발판을 통과해 곧장 쫓아온다. */
export type Skel = { on: boolean; x: number; y: number };

export type Phase = "play" | "clear" | "dead" | "over";

export type BubbleState = {
  stage: number;
  lives: number;
  score: number;
  /** 이번 판에서 번 하트(코인). 죽어도 남는다 — 헛수고로 끝나면 다시 안 켠다. */
  coins: number;
  hero: Hero;
  mons: Mon[];
  bubs: Bub[];
  drops: Drop[];
  specials: Special[];
  blasts: Blast[];
  items: Item[];
  letters: Letter[];
  /** 모은 EXTEND 글자 6칸. **판이 넘어가도 유지된다** — 한 판에 다 모으는 건 거의 불가능하다. */
  extend: boolean[];
  /** 이번 판 경과(ms). 아이템 등장·HURRY 판정의 단일 시계다. */
  stageMs: number;
  /** 이번 판에 이미 뿌린 아이템 수(0→1→2) */
  itemsOut: number;
  /** 특수 거품을 마지막으로 흘려보낸 시각 */
  lastSpecialMs: number;
  /** 남은 강화(ms). 판이 끝나면 사라진다. */
  boost: { rapid: number; speed: number };
  skel: Skel;
  rng: number;
  nextId: number;
  /** 경과 프레임 수(연출용 시계 — 실제 시각이 아니다) */
  frame: number;
  phase: Phase;
  /** 현재 phase 가 지속된 ms */
  phaseMs: number;
};

export type Input = {
  left: boolean;
  right: boolean;
  jump: boolean;
  fire: boolean;
};

export const NO_INPUT: Input = { left: false, right: false, jump: false, fire: false };

export const START_LIVES = 3;

/** 결정적 난수 0~1. 카운터를 하나 올리며 뽑는다. */
function rand(s: { rng: number }): number {
  s.rng += 1;
  return hash01(s.rng, 9173);
}

/** 몬스터를 발판 위 안전한 곳에 놓는다. 히어로 시작점 근처는 피한다(시작하자마자 죽으면 억울하다). */
function spawnMons(stage: number, seed: { rng: number }, nextId: number): { mons: Mon[]; nextId: number } {
  const rows = layoutFor(stage);
  const spots: { x: number; y: number }[] = [];
  for (let r = 1; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (solidAt(rows, c, r) && !solidAt(rows, c, r - 1)) {
        const x = c * TILE + TILE / 2;
        const y = r * TILE - MON_H / 2;
        // 히어로 시작점(왼쪽 아래) 반경 40px 은 비워 둔다
        if (Math.hypot(x - TILE * 2, y - (H - TILE - HERO_H / 2)) < 40) continue;
        spots.push({ x, y });
      }

  const n = monsterCount(stage);
  const mons: Mon[] = [];
  let id = nextId;
  const speed = monsterSpeed(stage);
  for (let i = 0; i < n && spots.length > 0; i++) {
    const pick = Math.floor(rand(seed) * spots.length);
    const at = spots.splice(pick, 1)[0];
    const kind = kindFor(stage, i);
    const beh = behaviorOf(kind);
    mons.push({
      id: id++,
      kind,
      x: at.x,
      y: at.y,
      vx: (rand(seed) < 0.5 ? -1 : 1) * 0.5 * speed,
      // 나는 놈은 처음부터 대각선으로 뜬다(가만히 있다 떨어지면 걷는 놈처럼 보인다)
      vy: beh === "fly" ? (rand(seed) < 0.5 ? -1 : 1) * 0.55 * speed : 0,
      onGround: beh !== "fly" && beh !== "hover",
      st: "free",
      hold: 0,
      breath: 0,
      angry: false,
      tough: isBossStage(stage) && i === 0 ? 2 : 1,
    });
  }
  return { mons, nextId: id };
}

/** 발판 윗면 중 한 칸을 고른다(아이템을 허공에 띄우지 않으려고). */
function pickSpot(stage: number, seed: { rng: number }): { x: number; y: number } {
  const rows = layoutFor(stage);
  const spots: { x: number; y: number }[] = [];
  for (let r = 1; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (solidAt(rows, c, r) && !solidAt(rows, c, r - 1))
        spots.push({ x: c * TILE + TILE / 2, y: r * TILE - 6 });
  if (spots.length === 0) return { x: W / 2, y: H / 2 };
  return spots[Math.floor(rand(seed) * spots.length)];
}

export function createStage(stage: number, seed: number, carry?: Partial<BubbleState>): BubbleState {
  const s: { rng: number } = { rng: seed * 1013 + stage * 7919 };
  const { mons, nextId } = spawnMons(stage, s, carry?.nextId ?? 1);
  return {
    stage,
    lives: carry?.lives ?? START_LIVES,
    score: carry?.score ?? 0,
    coins: carry?.coins ?? 0,
    hero: {
      x: TILE * 2,
      y: H - TILE - HERO_H / 2,
      vx: 0,
      vy: 0,
      face: 1,
      onGround: true,
      cool: 0,
      inv: 1200,
    },
    mons,
    bubs: [],
    drops: [],
    specials: [],
    blasts: [],
    items: [],
    letters: [],
    extend: carry?.extend ?? [false, false, false, false, false, false],
    stageMs: 0,
    itemsOut: 0,
    lastSpecialMs: 0,
    boost: { rapid: 0, speed: 0 },
    skel: { on: false, x: W / 2, y: 8 },
    rng: s.rng,
    nextId,
    frame: 0,
    phase: "play",
    phaseMs: 0,
  };
}

// ── 물리 ──────────────────────────────────────────────────────────────────
/* 발판은 **한 방향**이다 — 아래에서는 뚫고 올라가고, 위에서 떨어질 때만 딛는다.
   양방향으로 막으면 좁은 통로에 끼어 못 나오는 상황이 생긴다(이 장르에서 가장 흔한 사고).
   그리고 화면 밖으로 나가면 반대편에서 나온다 — 원작의 상징이자, 구석에 몰리는 걸 막는다. */

const wrapX = (x: number): number => ((x % W) + W) % W;

/** 발이 발판 윗면을 이번 프레임에 '가로질렀는가'. 통과 판정의 전부다. */
function landedOn(rows: string[], prevFootY: number, footY: number, x: number, w: number): number | null {
  if (footY <= prevFootY) return null; // 올라가는 중엔 안 딛는다
  const r0 = Math.floor(prevFootY / TILE);
  const r1 = Math.floor(footY / TILE);
  for (let r = r0; r <= r1; r++) {
    const top = r * TILE;
    if (top < prevFootY || top > footY) continue;
    const cl = Math.floor(wrapX(x - w / 2) / TILE);
    const cr = Math.floor(wrapX(x + w / 2 - 0.01) / TILE);
    if (solidAt(rows, cl, r) || solidAt(rows, cr, r)) return top;
  }
  return null;
}

// ── 한 프레임 ─────────────────────────────────────────────────────────────

export type StepFx = {
  /** 이번 프레임에 터진 거품 수(효과음/진동용) */
  pops: number;
  /** 몬스터를 가뒀다 */
  caught: number;
  /** 히어로가 맞았다 */
  hurt: boolean;
  /** 스테이지를 깼다 */
  cleared: boolean;
  /** 특수 거품이 터졌다(종류) */
  special: SpecialKind | null;
  /** 아이템을 먹었다(종류) */
  item: ItemKind | null;
  /** EXTEND 를 완성해 목숨이 늘었다 */
  extended: boolean;
};

const NO_FX: StepFx = {
  pops: 0,
  caught: 0,
  hurt: false,
  cleared: false,
  special: null,
  item: null,
  extended: false,
};

/**
 * 한 프레임(DT) 전진. **순수 함수** — 새 상태를 만들어 돌려준다.
 * @param atk 장착 무기 공격력(거품 사거리·재장전에 쓰인다)
 * @param lv  히어로 레벨(이동 속도)
 */
export function step(s0: BubbleState, input: Input, atk: number, lv: number): { state: BubbleState; fx: StepFx } {
  const s: BubbleState = {
    ...s0,
    hero: { ...s0.hero },
    mons: s0.mons.map((m) => ({ ...m })),
    bubs: s0.bubs.map((b) => ({ ...b })),
    drops: s0.drops.map((d) => ({ ...d })),
    specials: s0.specials.map((x) => ({ ...x })),
    blasts: s0.blasts.map((x) => ({ ...x })),
    items: s0.items.map((x) => ({ ...x })),
    letters: s0.letters.map((x) => ({ ...x })),
    extend: [...s0.extend],
    boost: { ...s0.boost },
    skel: { ...s0.skel },
  };
  const fx: StepFx = { ...NO_FX };
  s.frame += 1;
  s.phaseMs += DT;
  if (s.phase === "play") s.stageMs += DT;
  s.boost = {
    rapid: Math.max(0, s.boost.rapid - DT),
    speed: Math.max(0, s.boost.speed - DT),
  };

  const rows = layoutFor(s.stage);

  // 죽은 뒤/깬 뒤에는 물리를 멈추고 연출만 흘린다
  if (s.phase === "clear") return { state: s, fx };
  if (s.phase === "over") return { state: s, fx };
  if (s.phase === "dead") {
    if (s.phaseMs > 900) {
      if (s.lives <= 0) {
        s.phase = "over";
      } else {
        s.phase = "play";
        s.hero = { ...s.hero, x: TILE * 2, y: H - TILE - HERO_H / 2, vx: 0, vy: 0, onGround: true, inv: 1500, cool: 0 };
        // 해골은 화면 반대쪽으로 물린다 — 부활하자마자 겹쳐 있으면 무적이 끝나는 순간 또 죽는다
        if (s.skel.on) s.skel = { on: true, x: (TILE * 2 + W / 2) % W, y: 8 };
        // 풀려난 몬스터는 그대로 둔다 — 죽었다고 판이 리셋되면 긴장이 사라진다
      }
      s.phaseMs = 0;
    }
    return { state: s, fx };
  }

  // ── 히어로 ──
  const h = s.hero;
  // 신발을 먹으면 눈에 띄게 빨라진다(원작의 파란 사탕/신발 자리)
  const spd = RUN * heroSpeed(lv) * (s.boost.speed > 0 ? 1.45 : 1);
  h.vx = input.left ? -spd : input.right ? spd : 0;
  if (input.left) h.face = -1;
  if (input.right) h.face = 1;
  if (input.jump && h.onGround) {
    h.vy = JUMP_V;
    h.onGround = false;
  }
  h.x = wrapX(h.x + h.vx);

  const hPrevFoot = h.y + HERO_H / 2;
  h.vy = Math.min(MAX_FALL, h.vy + GRAVITY);
  h.y += h.vy;
  h.onGround = false;
  if (h.vy > 0) {
    const top = landedOn(rows, hPrevFoot, h.y + HERO_H / 2, h.x, HERO_W);
    if (top !== null) {
      h.y = top - HERO_H / 2;
      h.vy = 0;
      h.onGround = true;
    }
  }
  /* ── 거품 타기 ────────────────────────────────────────────────────────
     원작에서 거품은 무기이자 **발판**이다. 떠오르는 거품에 올라타면 발판만으로는
     못 가는 자리에 닿는다. 판정을 하나로 갈랐다:
       · 떨어지는 중(vy>0)에 **윗면**을 밟으면 → 탄다
       · 그 외의 접촉(옆·아래) → 터진다
     그래서 잡는 감각은 그대로 두면서 이동 수단이 하나 늘어난다.
     ⚠ 타고 있는 거품은 이번 프레임의 터뜨리기 판정에서 **뺀다**. 안 그러면
       올라탄 순간 스스로 터뜨려 절대 못 탄다. */
  let riding: number | null = null;
  if (h.vy >= 0 && !h.onGround) {
    for (const b of s.bubs) {
      if (b.dash > 0) continue; // 날아가는 중인 거품은 못 밟는다
      if (Math.abs(shortestDx(b.x, h.x)) > BUB_R + HERO_W / 2 - 2) continue;
      const foot = h.y + HERO_H / 2;
      if (foot < b.y - BUB_R - 2 || foot > b.y) continue; // 윗면 근처에서만
      h.y = b.y - BUB_R - HERO_H / 2;
      h.vy = 0;
      h.onGround = true;
      riding = b.id;
      break;
    }
  }

  // 아래로 떨어지면 위에서 나온다(원작 그대로)
  if (h.y - HERO_H / 2 > H) h.y = -HERO_H / 2;
  if (h.y + HERO_H / 2 < 0) h.y = H + HERO_H / 2;

  h.cool = Math.max(0, h.cool - DT);
  h.inv = Math.max(0, h.inv - DT);

  // 거품 발사
  if (input.fire && h.cool <= 0) {
    // 사탕을 먹으면 연사가 된다(원작의 노란 사탕)
    h.cool = reloadMs(atk) * (s.boost.rapid > 0 ? 0.45 : 1);
    s.bubs.push({
      id: s.nextId++,
      x: wrapX(h.x + h.face * 8),
      y: h.y,
      vx: h.face * 2.6,
      dash: bubbleRange(atk),
      life: captureMs(s.stage) + 1800,
      hold: null,
    });
  }

  // ── 거품 ──
  for (const b of s.bubs) {
    if (b.dash > 0) {
      const d = Math.abs(b.vx);
      b.x = wrapX(b.x + b.vx);
      b.dash -= d;
      if (b.dash <= 0) b.vx = 0;
    } else if (b.hold === null) {
      // 빈 거품은 위로 떠올라 천장에서 스러진다
      b.y -= 0.5;
      // 좌우로 살짝 흔들려야 거품처럼 보인다(결정적: 프레임+id 기반)
      b.x = wrapX(b.x + Math.sin((s.frame + b.id * 17) / 22) * 0.22);
      if (b.y < 6) b.y = 6;
    } else {
      /* 몬스터를 가둔 거품은 **뜨지 않고 그 자리에서 흔들린다.**
       *
       * 처음엔 원작처럼 천천히 떠오르게 했는데, 가둠 시간(6초) 동안 100px 넘게 올라가
       * 천장에 붙어 버렸다 — 아래층에 있던 히어로는 손도 못 대고 몬스터는 다시 풀려났다
       * (자동 플레이 테스트: 3마리 가두고 터뜨린 건 0마리). 가두는 게 아무 소용이 없으면
       * 게임의 축이 통째로 없어진다. 무게로 눌려 제자리에 뜬다고 보면 그림도 어색하지 않다. */
      b.y += Math.sin((s.frame + b.id * 13) / 18) * 0.18;
      b.x = wrapX(b.x + Math.cos((s.frame + b.id * 29) / 26) * 0.14);
    }
    b.life -= DT;
  }

  // 거품 ↔ 자유 몬스터: 가둔다
  for (const b of s.bubs) {
    // 이번 프레임에 수명이 다한 거품은 못 가둔다 — 가두면 아래 수명 정리가 같은 프레임에
    // 몬스터를 성난 상태로 풀어놓아 '잡혔다 이펙트 + 즉시 화난 탈출'이 된다(유령 포획).
    if (b.hold !== null || b.life <= 0) continue;
    for (const m of s.mons) {
      if (m.st !== "free") continue;
      if (Math.abs(shortestDx(b.x, m.x)) > BUB_R + MON_W / 2) continue;
      if (Math.abs(b.y - m.y) > BUB_R + MON_H / 2) continue;
      if (m.tough > 1) {
        // 보스: 첫 방은 튕겨 나가고 단단함만 깎인다
        m.tough -= 1;
        b.life = 0;
        break;
      }
      m.st = "bubbled";
      m.hold = captureMs(s.stage);
      b.hold = m.id;
      b.dash = 0;
      b.vx = 0;
      fx.caught += 1;
      break;
    }
  }

  // 가둔 몬스터는 거품을 따라다닌다
  for (const b of s.bubs) {
    if (b.hold === null) continue;
    const m = s.mons.find((x) => x.id === b.hold);
    if (!m) continue;
    m.x = b.x;
    m.y = b.y;
    m.hold -= DT;
    if (m.hold <= 0) {
      // 시간이 다 되면 풀려난다 — 화가 나서 더 빨라진다
      m.st = "free";
      m.angry = true;
      m.vx = (m.vx >= 0 ? 1 : -1) * 0.9 * monsterSpeed(s.stage);
      m.vy = 0;
      b.hold = null;
      b.life = 0;
    }
  }

  /* 히어로가 거품에 닿으면 터진다. 붙어 있는 거품은 같이 터진다(연쇄).
   *
   * ⚠ **날아가는 중(dash > 0)인 거품은 못 터뜨린다.** 거품은 히어로 몸에서 8px 떨어진
   *   곳에 생기는데 그건 히어로 히트박스 안이라, 이 조건이 없으면 쏘는 즉시 자기 거품을
   *   자기가 터뜨린다(실제로 그래서 발사 관련 테스트 4개가 한꺼번에 떨어졌다).
   *   게임 흐름으로도 이게 맞다 — 쏜다 → 날아간다 → 뜬다 → 올라타서 터뜨린다. */
  const popped = new Set<number>();
  for (const b of s.bubs) {
    if (popped.has(b.id) || b.dash > 0) continue;
    if (b.id === riding) continue; // 올라탄 거품은 안 터진다(위 주석 참조)
    if (Math.abs(shortestDx(b.x, h.x)) > BUB_R + HERO_W / 2) continue;
    if (Math.abs(b.y - h.y) > BUB_R + HERO_H / 2) continue;
    // 연쇄: 닿은 거품에서 시작해 가까운 거품으로 번진다
    const queue = [b];
    popped.add(b.id);
    while (queue.length) {
      const cur = queue.pop()!;
      for (const o of s.bubs) {
        if (popped.has(o.id) || o.dash > 0) continue; // 날아가는 거품은 연쇄에도 안 걸린다
        if (o.id === riding) continue; // 올라탄 거품도 연쇄로는 안 터진다 — 발판이 꺼지면 억울한 낙사다
        if (Math.hypot(shortestDx(cur.x, o.x), cur.y - o.y) > BUB_R * 2.2) continue;
        popped.add(o.id);
        queue.push(o);
      }
    }
    break;
  }

  if (popped.size > 0) {
    // 연쇄가 길수록 값이 커진다 — 모아서 한 번에 터뜨릴 이유를 만든다
    let chain = 0;
    for (const b of s.bubs) {
      if (!popped.has(b.id)) continue;
      fx.pops += 1;
      if (b.hold === null) continue;
      const m = s.mons.find((x) => x.id === b.hold);
      if (!m) continue;
      m.st = "dead";
      chain += 1;
      const value = dropValue(s.stage, chain);
      s.score += value;
      s.drops.push({ id: s.nextId++, x: b.x, y: b.y, vy: -1.4, life: 5200, value });
      // EXTEND — 아직 못 모은 글자가 있으면 가끔 떨어진다(원작: 글자 거품)
      const miss = s.extend.findIndex((v) => !v);
      if (miss >= 0 && rand(s) < 0.3)
        s.letters.push({ id: s.nextId++, idx: miss, x: b.x, y: b.y - 4, vy: -1.8, life: 7000 });
    }
    s.bubs = s.bubs.filter((b) => !popped.has(b.id));
  }

  /* 수명이 다한 거품은 사라진다.
   *
   * ⚠ 사라지기 전에 **가둔 몬스터를 반드시 풀어 줘야 한다.** 안 그러면 그 몬스터는
   *   "bubbled" 인 채로 주인 거품이 없어 영원히 남는다 — 죽지도, 풀려나지도 않으니
   *   스테이지가 영영 안 깨진다. 자동 플레이 테스트가 90초를 돌고도 못 깨서 잡혔다
   *   (거품 수명 7.8초 < 가둠 시간 6초 + 뜨는 시간이라 실제로 자주 일어난다). */
  for (const b of s.bubs) {
    if (b.life > 0 || b.hold === null) continue;
    const m = s.mons.find((x) => x.id === b.hold);
    if (!m || m.st !== "bubbled") continue;
    m.st = "free";
    m.angry = true;
    m.vy = 0;
  }
  s.bubs = s.bubs.filter((b) => b.life > 0);

  /* 빈 거품이 천장에 쌓이면 화면이 안 보이고 프레임도 떨어진다. 오래된 것부터 터뜨린다.
     (가둔 거품은 절대 안 지운다 — 그게 곧 스테이지 진행이다) */
  const MAX_BUBS = 14;
  if (s.bubs.length > MAX_BUBS) {
    let over = s.bubs.length - MAX_BUBS;
    s.bubs = s.bubs.filter((b) => {
      if (over <= 0 || b.hold !== null) return true;
      over -= 1;
      return false;
    });
  }

  // ── 몬스터 ──
  const mspeed = monsterSpeed(s.stage);
  for (const m of s.mons) {
    if (m.st !== "free") continue;
    const base = 0.5 * mspeed * (m.angry ? 1.6 : 1);
    // 쫓아오기 — 스테이지가 오르면 확률이 붙는다. 매 프레임 뽑으면 부들거리므로 가끔만.
    if (s.frame % 40 === 0 && rand(s) < chaseChance(s.stage)) {
      m.vx = Math.sign(shortestDx(m.x, h.x) * -1 || 1) * base;
    }
    if (m.vx === 0) m.vx = base;
    m.x = wrapX(m.x + m.vx);

    const beh = behaviorOf(m.kind);
    if (beh === "fly") {
      /* 고래 — 중력이 없다. 대각선으로 날다 발판·천장·바닥에 튕긴다.
         발판을 딛지 않으니 '아래층에 몰리는' 문제에서 자유롭고, 그래서 위층이 위험해진다. */
      m.y += m.vy;
      const solidPt = (x: number, y: number) =>
        solidAt(rows, Math.floor(wrapX(x) / TILE), Math.floor(y / TILE));
      if (m.y < 6 || m.y > H - 6) m.vy *= -1;
      else if (solidPt(m.x, m.y + Math.sign(m.vy) * (MON_H / 2))) {
        m.vy *= -1;
        m.y += m.vy; // 벽에 박힌 채로 진동하지 않게 한 칸 빼 준다
      }
      if (solidPt(m.x + Math.sign(m.vx) * (MON_W / 2), m.y)) m.vx *= -1;
      m.onGround = false;
    } else if (beh === "hover") {
      /* 프로펠러 — 떠서 **히어로의 높이를 따라온다**. 도망칠 층이 없다는 게 이놈의 위협이다.
         다만 아주 느려서 마주 보고 서 있지만 않으면 피할 수 있다. */
      const want = h.y;
      m.vy = Math.max(-0.5, Math.min(0.5, (want - m.y) * 0.02)) * mspeed;
      m.y += m.vy + Math.sin((s.frame + m.id * 17) / 26) * 0.25;
      m.y = Math.max(8, Math.min(H - 8, m.y));
      m.onGround = false;
    } else {
      // 걷기·튀기·불뿜기 — 중력을 받고 발판을 딛는다
      const prevFoot = m.y + MON_H / 2;
      m.vy = Math.min(MAX_FALL, m.vy + GRAVITY);
      m.y += m.vy;
      m.onGround = false;
      if (m.vy > 0) {
        const top = landedOn(rows, prevFoot, m.y + MON_H / 2, m.x, MON_W);
        if (top !== null) {
          m.y = top - MON_H / 2;
          m.vy = 0;
          m.onGround = true;
        }
      }
      if (m.y - MON_H / 2 > H) m.y = -MON_H / 2;

      // 발판 끝에서 돌아선다 — 안 그러면 전부 바닥으로 떨어져 아래층에 몰린다
      if (m.onGround) {
        const aheadCol = Math.floor(wrapX(m.x + Math.sign(m.vx) * (MON_W / 2 + 2)) / TILE);
        const footRow = Math.floor((m.y + MON_H / 2 + 1) / TILE);
        if (!solidAt(rows, aheadCol, footRow)) m.vx *= -1;
        if (beh === "bounce") {
          // 용수철 — 쉬지 않고 튄다. 층을 마음대로 넘나들어 가두기가 어렵다.
          m.vy = JUMP_V * 0.78;
        } else if (s.stage >= jumperFrom && s.frame % 50 === 0 && rand(s) < 0.25) {
          // 나머지도 가끔은 위층으로 올라간다(스테이지가 낮으면 안 뛴다)
          m.vy = JUMP_V * 0.8;
        }
      }
    }

    /* 불 뿜기 — 걸으면서 **바라보는 쪽으로** 불을 쏜다. 이 종만 원거리 공격이 있어
       "가까이 가면 위험"이 아니라 "같은 층에 있으면 위험"이 된다. */
    if (beh === "breathe") {
      m.breath -= DT;
      if (m.breath <= 0) {
        m.breath = BREATH_EVERY_MS;
        s.blasts.push({
          id: s.nextId++,
          kind: "flame",
          x: wrapX(m.x + Math.sign(m.vx) * 8),
          y: m.y,
          vx: Math.sign(m.vx) * 1.5,
          vy: 0,
          life: 1800,
          foe: true,
        });
      }
    }

    // 히어로와 부딪히면 한 목숨
    if (h.inv <= 0 && s.phase === "play") {
      if (
        Math.abs(shortestDx(m.x, h.x)) < (MON_W + HERO_W) / 2 - 2 &&
        Math.abs(m.y - h.y) < (MON_H + HERO_H) / 2 - 2
      ) {
        s.lives -= 1;
        s.phase = "dead";
        s.phaseMs = 0;
        fx.hurt = true;
      }
    }
  }

  // ── 떨어진 열매 ──
  for (const d of s.drops) {
    d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * 0.5);
    d.y += d.vy;
    const prevFoot = d.y + 4;
    const top = landedOn(rows, prevFoot - d.vy, prevFoot, d.x, 6);
    if (top !== null) {
      d.y = top - 4;
      d.vy = 0;
    }
    if (d.y > H) d.y = H - 4;
    d.life -= DT;
  }
  const taken = s.drops.filter(
    (d) => Math.abs(shortestDx(d.x, h.x)) < 9 && Math.abs(d.y - h.y) < 11,
  );
  if (taken.length) {
    for (const d of taken) s.coins += d.value;
    const ids = new Set(taken.map((d) => d.id));
    s.drops = s.drops.filter((d) => !ids.has(d.id));
  }
  s.drops = s.drops.filter((d) => d.life > 0);

  /* ── 특수 거품(번개·불·물) ──────────────────────────────────────────────
     원작의 핵심 장치다. 히어로가 만든 게 아니라 **화면 밖에서 흘러들어오고**,
     터뜨리면 거품이 아니라 '효과'가 나간다. 이게 없으면 가두기 한 가지로만
     끝나는 게임이 된다. */
  if (s.stageMs - s.lastSpecialMs > SPECIAL_EVERY_MS) {
    s.lastSpecialMs = s.stageMs;
    const kinds: SpecialKind[] = ["lightning", "fire", "water"];
    const kind = kinds[Math.floor(rand(s) * kinds.length)];
    const fromLeft = rand(s) < 0.5;
    s.specials.push({
      id: s.nextId++,
      kind,
      x: fromLeft ? 2 : W - 2,
      y: 12 + rand(s) * (H - 48),
      vx: (fromLeft ? 1 : -1) * 0.42,
      life: 22_000,
    });
  }
  for (const sp of s.specials) {
    sp.x = wrapX(sp.x + sp.vx);
    sp.y += Math.sin((s.frame + sp.id * 11) / 24) * 0.2;
    sp.life -= DT;
  }
  // 히어로가 닿으면 터진다 — 터진 자리에서 효과가 시작된다
  const burst = s.specials.filter(
    (sp) =>
      Math.abs(shortestDx(sp.x, h.x)) < BUB_R + HERO_W / 2 &&
      Math.abs(sp.y - h.y) < BUB_R + HERO_H / 2,
  );
  for (const sp of burst) {
    fx.special = sp.kind;
    if (sp.kind === "lightning") {
      // 번개 — 좌우로 뻗는 전격. 한 줄을 통째로 쓸어낸다.
      for (const dir of [-1, 1])
        s.blasts.push({ id: s.nextId++, kind: "bolt", x: sp.x, y: sp.y, vx: dir * 4.2, vy: 0, life: 1200 });
    } else if (sp.kind === "fire") {
      // 불 — 아래로 떨어져 발판 위에 불웅덩이로 남는다
      for (let i = -1; i <= 1; i++)
        s.blasts.push({ id: s.nextId++, kind: "flame", x: wrapX(sp.x + i * 7), y: sp.y, vx: 0, vy: 0.4, life: 3600 });
    } else {
      // 물 — 흘러내리며 몬스터를 아래로 쓸어 간다
      s.blasts.push({ id: s.nextId++, kind: "flood", x: sp.x, y: sp.y, vx: rand(s) < 0.5 ? -0.9 : 0.9, vy: 1.1, life: 5200 });
    }
  }
  if (burst.length) {
    const gone = new Set(burst.map((sp) => sp.id));
    s.specials = s.specials.filter((sp) => !gone.has(sp.id));
  }
  s.specials = s.specials.filter((sp) => sp.life > 0);

  // ── 터진 효과: 움직이고, 닿은 몬스터를 즉사시킨다 ──
  for (const bl of s.blasts) {
    bl.life -= DT;
    if (bl.kind === "bolt" || bl.foe) {
      // 적의 불은 곧게 날아간다(떨어뜨리면 자기 발밑에 고여 우스워진다)
      bl.x = wrapX(bl.x + bl.vx);
    } else {
      bl.vy = Math.min(MAX_FALL, bl.vy + GRAVITY * 0.35);
      const prevFoot = bl.y + 3;
      bl.y += bl.vy;
      const top = landedOn(rows, prevFoot, bl.y + 3, bl.x, 6);
      if (top !== null) {
        bl.y = top - 3;
        if (bl.kind === "flame") bl.vy = 0; // 불은 발판 위에 고인다
        else {
          // 물은 발판을 타고 옆으로 흐르다 끝에서 다시 떨어진다
          bl.vy = 0;
          bl.x = wrapX(bl.x + bl.vx * 2.2);
        }
      }
      if (bl.y > H) bl.y = H;
    }
  }
  for (const bl of s.blasts) {
    // 적이 쏜 불은 히어로만 해친다 — 몬스터끼리 죽이면 가만히 두는 게 최적해가 된다
    if (bl.foe) {
      if (
        h.inv <= 0 &&
        s.phase === "play" &&
        Math.abs(shortestDx(bl.x, h.x)) < 5 + HERO_W / 2 &&
        Math.abs(bl.y - h.y) < 5 + HERO_H / 2
      ) {
        s.lives -= 1;
        s.phase = "dead";
        s.phaseMs = 0;
        fx.hurt = true;
      }
      continue;
    }
    for (const m of s.mons) {
      if (m.st !== "free") continue;
      if (Math.abs(shortestDx(bl.x, m.x)) > 6 + MON_W / 2) continue;
      if (Math.abs(bl.y - m.y) > 6 + MON_H / 2) continue;
      m.st = "dead";
      const value = dropValue(s.stage, 2); // 특수 거품으로 잡으면 값이 좋다
      s.score += value;
      s.drops.push({ id: s.nextId++, x: m.x, y: m.y, vy: -1.4, life: 5200, value });
    }
  }
  s.blasts = s.blasts.filter((bl) => bl.life > 0);

  /* ── 아이템 — 원작은 판마다 둘을 정해진 시각에 띄운다 ── */
  if (s.itemsOut === 0 && s.stageMs >= ITEM1_MS) {
    s.itemsOut = 1;
    const at = pickSpot(s.stage, s);
    s.items.push({ id: s.nextId++, kind: "gem", x: at.x, y: at.y, vy: 0, life: 14_000 });
  } else if (s.itemsOut === 1 && s.stageMs >= ITEM2_MS) {
    s.itemsOut = 2;
    const at = pickSpot(s.stage, s);
    const kinds: ItemKind[] = ["candy", "shoes", "lantern"];
    const kind = kinds[Math.floor(rand(s) * kinds.length)];
    s.items.push({ id: s.nextId++, kind, x: at.x, y: at.y, vy: 0, life: 14_000 });
  }
  for (const it of s.items) {
    it.vy = Math.min(MAX_FALL, it.vy + GRAVITY * 0.4);
    const prevFoot = it.y + 4;
    it.y += it.vy;
    const top = landedOn(rows, prevFoot, it.y + 4, it.x, 6);
    if (top !== null) {
      it.y = top - 4;
      it.vy = 0;
    }
    if (it.y > H) it.y = H - 8;
    it.life -= DT;
  }
  const got = s.items.filter(
    (it) => Math.abs(shortestDx(it.x, h.x)) < 10 && Math.abs(it.y - h.y) < 12,
  );
  for (const it of got) {
    fx.item = it.kind;
    if (it.kind === "gem") {
      s.score += 120 + s.stage * 20;
      s.coins += 20 + s.stage * 4;
    } else if (it.kind === "candy") {
      s.boost.rapid = BOOST_MS;
    } else if (it.kind === "shoes") {
      s.boost.speed = BOOST_MS;
    } else {
      // 등불 — 화면에 있는 몬스터를 한 번에 정리한다(원작의 보라 등불)
      for (const m of s.mons) {
        if (m.st === "dead") continue;
        m.st = "dead";
        const value = dropValue(s.stage, 3);
        s.score += value;
        s.drops.push({ id: s.nextId++, x: m.x, y: m.y, vy: -1.4, life: 5200, value });
      }
      s.bubs = s.bubs.filter((b) => b.hold === null);
    }
  }
  if (got.length) {
    const gone = new Set(got.map((it) => it.id));
    s.items = s.items.filter((it) => !gone.has(it.id));
  }
  s.items = s.items.filter((it) => it.life > 0);

  /* ── EXTEND 글자 ── */
  for (const lt of s.letters) {
    lt.vy = Math.min(MAX_FALL, lt.vy + GRAVITY * 0.35);
    const prevFoot = lt.y + 4;
    lt.y += lt.vy;
    const top = landedOn(rows, prevFoot, lt.y + 4, lt.x, 6);
    if (top !== null) {
      lt.y = top - 4;
      lt.vy = 0;
    }
    if (lt.y > H) lt.y = H - 8;
    lt.life -= DT;
  }
  const letters = s.letters.filter(
    (lt) => Math.abs(shortestDx(lt.x, h.x)) < 10 && Math.abs(lt.y - h.y) < 12,
  );
  for (const lt of letters) s.extend[lt.idx] = true;
  if (letters.length) {
    const gone = new Set(letters.map((lt) => lt.id));
    s.letters = s.letters.filter((lt) => !gone.has(lt.id));
    if (s.extend.every(Boolean)) {
      s.lives += 1;
      s.extend = [false, false, false, false, false, false];
      fx.extended = true;
    }
  }
  s.letters = s.letters.filter((lt) => lt.life > 0);

  /* ── HURRY UP! — 오래 끌면 가둘 수 없는 해골이 온다 ──────────────────────
     이게 없으면 '안전한 구석에서 거품만 쏘며 버티기'가 최적해가 된다.
     해골은 벽도 발판도 통과하고 거품에 안 갇힌다. 대신 느려서 도망은 갈 수 있다. */
  if (!s.skel.on && s.stageMs > SKEL_MS) {
    s.skel = { on: true, x: (h.x + W / 2) % W, y: 8 };
  }
  if (s.skel.on) {
    const dx = -shortestDx(s.skel.x, h.x);
    const dy = h.y - s.skel.y;
    const d = Math.hypot(dx, dy) || 1;
    // 오래 끌수록 조금씩 빨라진다 — 무한정 도망칠 수는 없다
    const sp = SKEL_SPEED * (1 + Math.min(1, (s.stageMs - SKEL_MS) / 30_000));
    s.skel.x = wrapX(s.skel.x + (dx / d) * sp);
    s.skel.y += (dy / d) * sp;
    if (
      h.inv <= 0 &&
      s.phase === "play" &&
      Math.abs(shortestDx(s.skel.x, h.x)) < 9 &&
      Math.abs(s.skel.y - h.y) < 11
    ) {
      s.lives -= 1;
      s.phase = "dead";
      s.phaseMs = 0;
      fx.hurt = true;
    }
  }

  // ── 클리어 판정 ──
  if (s.phase === "play" && s.mons.every((m) => m.st === "dead")) {
    s.phase = "clear";
    s.phaseMs = 0;
    s.coins += clearBonus(s.stage);
    s.blasts = [];
    s.specials = [];
    fx.cleared = true;
  }

  return { state: s, fx };
}

/** 감싸는 무대에서의 최단 x 거리. 왼쪽 끝과 오른쪽 끝은 사실 붙어 있다. */
export function shortestDx(a: number, b: number): number {
  let d = a - b;
  if (d > W / 2) d -= W;
  if (d < -W / 2) d += W;
  return d;
}

/** 열매 값 — 스테이지가 오를수록, 연쇄가 길수록 커진다. */
export const dropValue = (stage: number, chain: number): number =>
  Math.round((6 + stage * 2) * (1 + (chain - 1) * 0.6));

/** 스테이지 클리어 보너스. */
export const clearBonus = (stage: number): number => 40 + stage * 12;

/** 클리어 연출이 끝났는지(다음 스테이지로 넘길 때) */
export const CLEAR_MS = 1400;

/** 다음 스테이지 상태. 목숨·점수·하트는 이어진다. */
export function nextStage(s: BubbleState, seed: number): BubbleState {
  return createStage(s.stage + 1, seed, {
    lives: s.lives,
    score: s.score,
    coins: s.coins,
    nextId: s.nextId,
    // EXTEND 만 판을 넘어 이어진다. 강화·아이템·해골은 판마다 초기화 —
    // 이어지면 후반에 무한 강화가 되고, 초기화되지 않으면 새 판이 시작하자마자 쫓긴다.
    extend: s.extend,
  });
}

// ── 기록(저장되는 유일한 부분) ────────────────────────────────────────────
export type BubbleRecord = {
  /** 도달한 최고 스테이지 */
  best: number;
  /** 깬 스테이지 총합 */
  clears: number;
  /** 최고 점수 */
  score: number;
};

export const emptyRecord = (): BubbleRecord => ({ best: 0, clears: 0, score: 0 });

/** 판이 끝났을 때 기록을 갱신한다(줄어드는 일은 없다). */
export function mergeRecord(r: BubbleRecord, s: BubbleState): BubbleRecord {
  return {
    best: Math.max(r.best, s.stage),
    clears: r.clears + Math.max(0, s.stage - 1),
    score: Math.max(r.score, s.score),
  };
}
