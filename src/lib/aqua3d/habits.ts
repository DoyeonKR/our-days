/** 어종별 습성 [사용자: "심해어는 무조건 바닥 · 불가사리나 광어는 바닥에 붙어 산다 · 우리가 관리하는 모든 물고기 특성을 반영"]
 *  수조 안의 움직임만 정한다(저장값 · 경제와 무관). 새 계열을 FAMILIES 에 더하면 여기에도 더한다 — habits.test 가 빠진 계열을 잡는다.
 *  물높이는 월드 y(바닥 -5.3, 수면 약 5.5).
 *  모든 계산은 (id, 시각, 몸길이, 옵션) 만으로 정해진다 — 두 사람 기기에서 같은 시각이면 같은 자리다. Math.random 을 쓰지 않는다. */
export type FishHabit = {
  /** 몸 중심이 오가는 높이 */
  lo: number;
  hi: number;
  /** 초당 길을 도는 각도. 같은 어항에서 빠르기 차이가 곧 성격이다 */
  speed: number;
  /** 어항 폭을 얼마나 쓰나(0~1) */
  reach: number;
  /** 앞뒤로 움직이는 폭 */
  depth: number;
  /** 바닥에 붙어 산다 — 값은 모래에서 몸 중심까지의 높이(몸길이 배수). 있으면 lo · hi 대신 쓴다 */
  hug?: number;
  /** 바닥 위에서 들썩이는 폭 */
  bob?: number;
  /** 가만히 있는 시간의 비율 — 멈췄다 짧게 옮겨 간다 */
  rest?: number;
  /** 한 번 옮겨 갈 때 길을 얼마나 가나 */
  hop?: number;
  /** 자기 자리를 맴돈다(말미잘 · 바위틈 · 텃세) */
  home?: boolean;
  /** 같은 계열끼리 무리 짓는다 */
  school?: boolean;
  /** 갑자기 방향을 튼다 */
  dart?: number;
  /** 쉬는 동안에도 몸을 움직이는 정도 — 두족류 팔은 멈춰 있어도 꿈틀거린다 */
  idle?: number;
  /** 꼬리 치는 빠르기 */
  pace?: number;
  /** 오르내릴 때 몸을 얼마나 기울이나 */
  tilt?: number;
  /** 바닥 물고기의 고리 크기(0.5~1) — 광어 · 메기가 같은 고리를 돌면 한 바퀴마다 겹쳤다. 계열마다 다른 고리를 돈다 */
  lane?: number;
  /** 숨 쉬러 수면까지 올라가는 주기(초) — 거북. 가끔 모래 위에서 쉬기도 한다 */
  breathe?: number;
  /** 해파리 — 갓을 오므리는 주기(초). 오므리면 위로 솟고 천천히 가라앉는다 */
  jet?: number;
  /** 먹이를 줘도 안 온다(해파리) */
  feeds?: false;
};

const swim = (lo: number, hi: number, speed: number, reach: number, depth: number, more: Partial<FishHabit> = {}): FishHabit => ({ lo, hi, speed, reach, depth, ...more });
/** 바닥 생활 — 높이는 hug 가 정하므로 lo · hi 는 바닥 근처 값으로 둔다 */
const floor = (hug: number, speed: number, reach: number, depth: number, more: Partial<FishHabit> = {}): FishHabit => ({ lo: -5, hi: -3.5, speed, reach, depth, hug, tilt: 0, ...more });

const SCHOOL_TOP = swim(1.2, 3.6, 0.28, 0.72, 1.7, { school: true, dart: 0.22, pace: 1.35 });
const SCHOOL_MID = swim(-0.8, 1.6, 0.26, 0.72, 1.7, { school: true, dart: 0.2, pace: 1.25 });
const POTTER = swim(-2.8, 0.2, 0.12, 0.46, 1.2, { school: true, pace: 0.8 });
const STATELY = swim(-1, 1.8, 0.09, 0.4, 1.1, { school: true, pace: 0.6 });
const CRUISER = swim(-0.6, 2.2, 0.26, 1, 2, { school: true, pace: 1.2, tilt: 0.2 });
const GLIDER = swim(0.4, 2.6, 0.1, 1, 1.8, { pace: 0.5, tilt: 0.2 });
const LOW_REEF = swim(-3, -0.6, 0.16, 0.7, 1.6, { school: true });
const HIDER = floor(0.2, 0.09, 0.2, 0.5, { home: true, rest: 0.55, hop: 0.9, bob: 0.08, pace: 0.7 });
const SITTER = floor(0.12, 0.07, 0.72, 1.6, { rest: 0.62, hop: 0.8, pace: 0.8 });
const BOTTOM_CRUISE = floor(0.2, 0.12, 0.85, 1.7, { bob: 0.22, pace: 0.8 });
const DEEP = floor(0.22, 0.06, 0.68, 1.4, { bob: 0.08, pace: 0.45 });
const DRIFT = swim(-2.5, 3.4, 0.035, 0.3, 1, { tilt: 0, pace: 0.5, jet: 2.8, feeds: false });
const AMBUSH = swim(-1.8, 1, 0.18, 0.8, 1.7, { rest: 0.35, hop: 1.2, pace: 0.9 });

export const FISH_HABITS: Readonly<Record<string, FishHabit>> = {
  // 작은 물고기는 무리 지어 위쪽을 빠르게 — 구피 · 은어는 수면 가까이, 테트라는 가운데
  guppy: SCHOOL_TOP,
  tetra: SCHOOL_MID,
  sweetfish: swim(0.4, 2.6, 0.3, 0.92, 1.9, { school: true, dart: 0.12, pace: 1.3 }),
  // 금붕어는 아래쪽을 느긋하게 뒤진다 · 베타는 위쪽 자기 자리를 지킨다(무리 안 지음)
  goldfish: POTTER,
  betta: swim(1, 3.2, 0.09, 0.22, 0.6, { home: true, pace: 0.6 }),
  // 바닥에 붙어 사는 물고기 — lane 이 서로 달라 같은 고리를 돌지 않는다(광어는 가운데 빈 모래, 메기는 바깥)
  catfish: { ...SITTER, lane: 1 },
  flounder: floor(0.05, 0.05, 0.7, 1.5, { rest: 0.85, hop: 1, pace: 1.1, lane: 0.55 }),
  rockfish: HIDER,
  nurse_shark: floor(0.12, 0.05, 0.7, 1.5, { rest: 0.7, hop: 0.7, pace: 0.6, lane: 0.8 }),
  leopard_shark: floor(0.22, 0.13, 0.9, 1.7, { bob: 0.25, pace: 0.75, lane: 1 }),
  croaker: { ...BOTTOM_CRUISE, lane: 0.9 },
  ray: floor(0.07, 0.08, 0.72, 1.6, { rest: 0.55, hop: 0.9, pace: 0.8, lane: 0.72 }),
  // 넓적한 몸은 가운데에서 품위 있게 · 흰동가리는 말미잘 곁을 떠나지 않는다
  angel: STATELY,
  discus: swim(-0.6, 1.2, 0.08, 0.35, 1, { school: true, pace: 0.5 }),
  clown: swim(-3.2, -1.2, 0.22, 0.16, 0.5, { home: true, dart: 0.2, pace: 1.4 }),
  sea_bream: LOW_REEF,
  // 농어는 멈췄다 달려드는 사냥꾼
  sea_bass: AMBUSH,
  salmon: swim(-0.4, 2.4, 0.24, 0.95, 1.9, { school: true, pace: 1.2, tilt: 0.2 }),
  koi: swim(-0.4, 2.6, 0.1, 0.7, 1.6, { school: true, pace: 0.7 }),
  // 쉬지 않고 어항 끝까지 도는 회유어 · 큰 상어
  yellowtail: CRUISER,
  striped_jack: swim(-1, 1.4, 0.28, 1, 2, { school: true, pace: 1.25, tilt: 0.2 }),
  bluefin: swim(-0.4, 2.2, 0.3, 1, 2, { school: true, pace: 1.4, tilt: 0.15 }),
  blue_shark: swim(0, 2.4, 0.17, 1, 2, { pace: 0.8, tilt: 0.2 }),
  great_white: swim(-1, 1.6, 0.16, 1, 2, { pace: 0.8, tilt: 0.2 }),
  hammerhead: swim(-1.4, 1, 0.17, 1, 2, { pace: 0.85, dart: 0.08, tilt: 0.2 }),
  // 아로와나는 수면 바로 밑을 순찰한다
  arowana: swim(2, 3.6, 0.12, 0.9, 1.4, { pace: 0.7, tilt: 0.1 }),
  // 해파리는 헤엄치지 않고 떠다니며 갓을 오므려 솟는다 · 거북은 평소 낮게 있다 숨 쉬러 수면까지 올라간다
  jellyfish: DRIFT,
  moon_jelly: swim(-0.5, 3.6, 0.035, 0.3, 1, { tilt: 0, pace: 0.5, jet: 3.2, feeds: false }),
  sea_turtle: swim(-3.2, -1.4, 0.1, 0.8, 1.6, { breathe: 72, pace: 0.5, tilt: 0.6 }),
  // 거대한 여과 섭식자는 넓게 천천히
  whale_shark: swim(0.2, 1.5, 0.09, 1, 1.6, { pace: 0.45, tilt: 0.15 }),
  manta: GLIDER,
  aurora_ray: GLIDER,
  // 심해어는 언제나 바닥 [사용자: "심해어는 무조건 바닥에만"]
  megamouth: floor(0.13, 0.07, 0.8, 1.4, { bob: 0.08, pace: 0.45, lane: 0.95 }),
  gulper_eel: { ...DEEP, lane: 0.75 },
  anglerfish: floor(0.3, 0.05, 0.5, 1.2, { rest: 0.75, hop: 0.8, pace: 0.5, lane: 0.5 }),
  oarfish: floor(0.14, 0.05, 0.75, 1.2, { bob: 0.1, pace: 0.5, lane: 0.9 }),
  coelacanth: { ...DEEP, lane: 0.85 },
  giant_squid: floor(0.25, 0.06, 0.6, 1.2, { bob: 0.1, pace: 0.5, lane: 0.7 }),
  kraken: floor(0.42, 0.04, 0.5, 1, { bob: 0.08, pace: 0.4, lane: 0.6 }),
  // 바닥을 기어 다니는 무척추동물
  starfish: floor(0.09, 0.012, 0.85, 1.4, { pace: 0.3, lane: 0.95 }),
  octopus: floor(0.42, 0.05, 0.7, 1.5, { rest: 0.7, hop: 0.8, pace: 0.7, idle: 0.5, lane: 0.65 }),
  squid: swim(-1.6, 2, 0.2, 0.72, 1.6, { school: true, rest: 0.4, hop: 1, pace: 1.2, tilt: 0.1, idle: 0.4 }),
  // 신화의 물고기
  rising: swim(-2.5, 3.4, 0.13, 0.6, 1.4, { tilt: 0.8, pace: 0.8 }),
  astral: swim(0.2, 3.4, 0.13, 0.85, 1.8, { pace: 0.7 }),
  // 앞으로 켤 토종 · 대표 어종(design/FISH-NATIVE-ART.md)
  crucian: POTTER,
  pale_chub: SCHOOL_TOP,
  chinese_minnow: SCHOOL_MID,
  smelt: SCHOOL_MID,
  bullhead: { ...SITTER, lane: 0.85 },
  common_carp: swim(-3, 0, 0.1, 0.7, 1.5, { school: true, pace: 0.7 }),
  masu_salmon: swim(-0.4, 2, 0.2, 0.6, 1.5, { pace: 1.1 }),
  snakehead: swim(2, 3.6, 0.07, 0.5, 1.2, { rest: 0.6, hop: 0.9, pace: 0.7 }),
  mandarin_fish: HIDER,
  perch_kkeokji: HIDER,
  eel: floor(0.1, 0.06, 0.7, 1.4, { rest: 0.5, hop: 0.9, pace: 0.9, lane: 0.78 }),
  lenok: swim(-1, 1.6, 0.14, 0.6, 1.4, { pace: 0.9 }),
  mackerel: CRUISER,
  rockfish_bollak: swim(-2.6, -0.6, 0.08, 0.4, 1, { school: true, pace: 0.6 }),
  black_seabream: LOW_REEF,
  hairtail: swim(-1, 2, 0.05, 0.5, 1, { pace: 0.5, tilt: 0.1 }),
  barred_knifejaw: swim(-3, -0.8, 0.14, 0.45, 1.1, { home: true, pace: 1 }),
  cutlassfish_pollock: floor(0.24, 0.14, 0.85, 1.6, { school: true, bob: 0.3, pace: 0.9, lane: 0.95 }),
  sailfin_sandfish: floor(0.1, 0.06, 0.7, 1.5, { rest: 0.7, hop: 0.8, pace: 0.9, lane: 0.62 }),
  puffer: swim(-3, -0.6, 0.08, 0.45, 1.1, { pace: 1.2, tilt: 0.1 }),
};

/** 표에 없는 물고기의 기본 — 옛 움직임과 비슷하게 가운데를 돈다 */
const DEFAULT_HABIT = swim(-2.4, 2.6, 0.2, 0.8, 1.7, { school: true });
export const habitOf = (key: string): FishHabit => FISH_HABITS[key] ?? DEFAULT_HABIT;
/** 품종이 자기 습성을 따로 가졌으면 그쪽(달빛 해파리 · 오로라 가오리는 같은 계열의 다른 품종과 몸이 다르다) */
export const habitKey = (family: string, key: string): string => (FISH_HABITS[key] ? key : family);
export const hugsFloor = (key: string): boolean => habitOf(key).hug !== undefined;

/** 장식 · 바위 — 물고기 길이 피해 간다. x · z 는 월드 좌표(넓힌 어항이면 넓힌 뒤), r 은 바닥에서 본 반지름, h 는 꼭대기 높이(WORLD.floor 에서 잰 값) */
export type Obstacle = { x: number; z: number; r: number; h: number };
/** 먹이 — t 는 course 와 같은 시계의 초, x 는 먹이를 뿌린 가로 위치(월드 좌표) */
export type Feed = { t: number; x: number };
export type CourseOptions = {
  obstacles?: readonly Obstacle[];
  feed?: Feed | null;
  /** 다 컸을 때 몸길이 — 치어가 몸길이에 비해 너무 빨리 달리지 않게 빠르기 · 꼬리 박자를 맞춘다. 없으면 지금 몸길이를 다 큰 것으로 본다 */
  adult?: number;
  /** 무리 대장의 몸길이 — 대장과 같은 길을 따라가려면 대장 몸으로 길을 계산해야 한다 */
  leaderLength?: number;
  /** 결과를 여기에 쓴다(매 프레임 새 객체를 안 만든다) */
  out?: Course;
};
export type Course = {
  x: number; y: number; z: number;
  /** 머리가 향하는 쪽(속도와 같은 단위 · 크기는 상관없다) */
  dx: number; dy: number; dz: number;
  /** 꼬리 박자 — 엔진이 phase += dt·effort 로 쌓는다. 실제 빠르기 ÷ 몸길이를 따른다 */
  effort: number;
  /** 몸 방향이 도는 빠르기(rad/s, +Y 축 기준) — 몸을 C 자로 굽히고 기울이는 데 쓴다 */
  turn: number;
  /** 꼬리를 흔드는 폭(1 = 보통) — 멈춰 떠 있을 땐 작아지고 가슴지느러미만 부친다 */
  amp: number;
  /** 해파리 갓 — 1 펴짐 · -1 오므림. 해파리가 아니면 0 */
  pulse: number;
  /** 0~1 — 엔진이 y 에 ground·(모래 높이 - WORLD.floor) 를 더한다. 바닥 물고기는 1, 모래 위에서 쉬는 거북은 그동안 1 */
  ground: number;
  /** 모래에 내려앉은 뒤 지난 초(모래 먼지 그리기용) — 없으면 -1 */
  puff: number;
  /** 0~1 — 멈춰 떠 있는 정도 */
  hover: number;
};

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x: number) => { const v = clamp01(x); return v * v * (3 - 2 * v); };
const frac = (x: number) => x - Math.floor(x);
/** 0~1 고른 값 — id 와 소금(salt)만으로 정한다 */
const unit = (hash: number, salt: number) => ((Math.imul(hash ^ salt, 2246822519) >>> 0) % 10007) / 10007;
/** smoothstep 의 적분(0~x) — 창 안에서 늦춰진 시간을 닫힌 식으로 구한다 */
const easeArea = (x: number) => x * x * x - (x * x * x * x) / 2;
/** 창 하나(0~1): 오르기 a · 머물기 · 내리기 b */
function bump(s: number, a: number, b: number) {
  if (s <= 0 || s >= 1) return 0;
  if (s < a) return ease(s / a);
  if (s > 1 - b) return ease((1 - s) / b);
  return 1;
}
function bumpArea(s: number, a: number, b: number) {
  const full = 1 - (a + b) / 2;
  if (s <= 0) return 0;
  if (s >= 1) return full;
  if (s < a) return a * easeArea(s / a);
  if (s <= 1 - b) return a / 2 + (s - a);
  return full - b * easeArea((1 - s) / b);
}
let winWeight = 0, winIndex = 0;
/** period 마다 한 번(every=2 면 두 번에 한 번) 오는 dur 초짜리 창 — 지금까지 쌓인 넓이(초)를 돌려준다.
 *  시간을 t - k·넓이 로 늦추면 창 동안만 천천히 가고, 적분이 닫힌 식이라 매 프레임 쌓지 않아도 같은 시각엔 같은 자리다. */
function windows(t: number, period: number, start: number, dur: number, a: number, b: number, every = 1) {
  const l = t + start, n = Math.floor(l / period), s = (l - n * period) / dur;
  const on = every === 1 || (((n % 2) + 2) % 2) === 0;
  const done = every === 1 ? n : Math.floor((n + 1) / 2);
  winWeight = on ? bump(s, a, b) : 0; winIndex = n;
  return dur * (done * (1 - (a + b) / 2) + (on ? bumpArea(s, a, b) : 0));
}

/** 벽 가까이에서 부드럽게 눌러 담는다 — knee 까지는 그대로, 그 뒤로는 lim 에 다가갈 뿐 넘지 않는다(딱 잘라 멈추면 벽에 쌓여 보였다) */
export function softClamp(v: number, knee: number, lim: number) {
  const a = Math.abs(v);
  if (a <= knee) return v;
  const room = Math.max(1e-6, lim - knee);
  return Math.sign(v) * (knee + room * (1 - Math.exp(-(a - knee) / room)));
}
/** 몸 전체가 유리 안에 있게 — 몸이 어느 쪽을 보든 반 길이만큼 안쪽(가로 유리 ±5·scale, 앞뒤 유리 ±3) */
export const roomX = (half: number, scale: number) => Math.max(0.2, 4.6 - half) * scale;
export const roomZ = (half: number) => Math.max(0.12, 2.9 - half);
export const glassRoom = (half: number, scale: number) => ({ x: roomX(half, scale), z: roomZ(half) });

// 한 번 부를 때 쓰는 값들 — 매 프레임 객체를 새로 만들지 않으려고 모듈에 둔다(단일 스레드)
const S = { cx: 0, cz: 0, rx: 0, zr: 0, zs: 1, zj: 0, phase: 0, hug: -1, bob: 0, floorY: 0, length: 1, mid: 0, amp: 0, scale: 1, half: 0.5, bodyH: 0.1, kneeX: 1, limX: 1, kneeZ: 1, limZ: 1, yHere: 0 };
const Q = new Float64Array(9); // u-δ · u · u+δ 세 점의 x,y,z

/** 고리 위의 점(장애물 · 벽 처리 전) */
function ringPoint(u: number, i: number) {
  Q[i] = S.cx + S.rx * Math.sin(u);
  Q[i + 2] = S.cz + S.zs * S.zr * Math.cos(u + S.zj);
  Q[i + 1] = S.hug >= 0 ? S.floorY + S.hug * S.length + S.bob * Math.sin(u * 2 + S.phase) : S.mid + S.amp * Math.sin(u * 2 + S.phase);
}

/** 고리 중심에서 장애물 쪽 고리 반지름(축에 맞춘 타원으로 어림) */
function ringRadius(ex: number, ez: number) {
  const a = Math.max(1e-3, S.rx), b = Math.max(1e-3, S.zr);
  return 1 / Math.sqrt((ex * ex) / (a * a) + (ez * ez) / (b * b));
}

/** 장애물 피하기 — 고리 중심에서 그 점으로 난 방향을 따라 반지름만 줄이거나(장애물 안쪽으로 지나감) 늘린다(바깥으로 돌아감).
 *  어느 쪽으로 돌지는 물고기 · 장애물마다 한 번 정해지고(고리 · 장애물 · 벽 위치만으로), 장애물 가장자리에서 힘이 0 으로 줄어
 *  길이 끊기거나 순간 이동하지 않는다. 장애물보다 높이 떠 있으면 상관하지 않는다. */
function avoid(i: number, obstacles: readonly Obstacle[], floorTop: number) {
  for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k];
    const top = floorTop + o.h, bottom = Q[i + 1] - S.bodyH;
    // 높이로 풀리는 폭은 몸이 클수록 넓게 — 큰 거북이 장식 높이를 지나 내려앉을 때 옆으로 확 밀리지 않게
    const wy = 1 - ease((bottom - top) / (0.5 + S.length * 0.5));
    if (wy <= 0) continue;
    const need = o.r + S.half * 0.55 + 0.1, needE = need + 0.45;
    const ox = o.x - S.cx, oz = o.z - S.cz, od = Math.hypot(ox, oz);
    const px = Q[i] - S.cx, pz = Q[i + 2] - S.cz;
    let rho = Math.hypot(px, pz);
    if (rho < 1e-6) continue;
    const ex = px / rho, ez = pz / rho;
    const q = ox * ex + oz * ez, p = Math.abs(ox * ez - oz * ex);
    if (p >= needE) continue;
    const sE = Math.sqrt(needE * needE - p * p);
    const w = wy * ease((needE - p) / (needE - need));
    // 바깥으로 돌 자리가 있나 — 장애물 뒤 유리까지 몸 하나 들어갈 틈
    let outside = od < needE + 0.2;
    if (!outside && od > 1e-6) {
      const dx = ox / od, dz = oz / od;
      const gx = Math.abs(dx) > 1e-6 ? ((dx > 0 ? S.limX : -S.limX) - S.cx) / dx : Infinity;
      const gz = Math.abs(dz) > 1e-6 ? ((dz > 0 ? S.limZ : -S.limZ) - S.cz) / dz : Infinity;
      outside = ringRadius(dx, dz) > od && Math.min(gx, gz) - (od + need) > S.half * 0.8;
    }
    if (outside) {
      const lim = q + sE;
      if (rho < lim) rho += (lim - rho) * w;
    } else {
      if (q <= 0) continue;
      const lim = Math.max(0.2, q - sE);
      if (rho > lim) rho -= (rho - lim) * w;
    }
    Q[i] = S.cx + ex * rho; Q[i + 2] = S.cz + ez * rho;
  }
}

function contain(i: number) {
  Q[i] = softClamp(Q[i], S.kneeX, S.limX);
  Q[i + 2] = softClamp(Q[i + 2], S.kneeZ, S.limZ);
}

// 길 위치 u(시간 → 길) 계산에 쓰는 값
const U = { speed: 0, phase: 0, rest: 0, hop: 1, dart: 0, hoverP: 0, hoverO: 0, hover: false, moving: 1, hoverW: 0, hoverN: 0, c: 0 };
function pathU(t: number) {
  if (U.rest > 0) {
    // 멈춰 있다가 짧게 옮겨 간다 — 쉬는 동안 길의 위치 u 가 그대로라 몸도 그대로다
    const c = (t * U.speed) / U.hop + U.phase;
    const go = (frac(c) - U.rest) / (1 - U.rest);
    U.moving = go > 0 ? Math.sin(Math.min(1, go) * Math.PI) : 0; U.c = c;
    U.hoverW = 0;
    return (Math.floor(c) + ease(go)) * U.hop;
  }
  let tau = t;
  if (U.hover) {
    // 가끔 멈춰 떠 있는다 — 그동안 길을 거의 안 간다(가슴지느러미만 부친다)
    tau = t - 0.92 * windows(t, U.hoverP, U.hoverO, 7, 0.3, 0.3);
    U.hoverW = winWeight; U.hoverN = winIndex;
  } else U.hoverW = 0;
  const v = tau * U.speed + U.phase;
  U.moving = 1;
  return v + U.dart * Math.sin(v * 3.1 + U.phase);
}

/** 거북 — 숨 쉬러 수면(약 5)까지 올라가 잠깐 머물고, 두 번에 한 번은 모래 위에서 쉰다. 무게(0~1)와 늦춘 시간을 돌려준다 */
const B = { breath: 0, sand: 0, loss: 0 };
function turtleAt(t: number, hash: number, period: number) {
  const start = unit(hash, 71) * period;
  const l1 = windows(t, period, start, 22, 7 / 22, 11 / 22);
  B.breath = winWeight;
  const l2 = windows(t, period, (start + period / 2) % period, 26, 6 / 26, 6 / 26, 2);
  B.sand = winWeight;
  B.loss = 0.75 * l1 + 0.95 * l2;
}

/** 해파리 — 짧게 오므리며(앞 30%) 솟고, 길게 펴면서 천천히 가라앉는다. 갓 모양(1 펴짐 · -1 오므림)과 높이 변화 */
const J = { pulse: 0, rise: 0 };
function jetAt(t: number, period: number, phase: number) {
  const th = frac(t / period + phase);
  const g = th < 0.3 ? (th / 0.3) * 0.5 : 0.5 + ((th - 0.3) / 0.7) * 0.5;
  J.pulse = Math.cos(TAU * g);
  J.rise = th < 0.3 ? ease(th / 0.3) : 1 - ease((th - 0.3) / 0.7);
}

const SURFACE_Y = 5;
const FEED_END = 16;
/** 먹이 반응 무게 — 헤엄치는 물고기는 곧장 수면으로, 바닥 물고기는 먹이가 바닥에 닿을 즈음 */
function feedWeight(tau: number, floorFish: boolean, delay: number) {
  if (floorFish) return ease((tau - 4.2 - delay) / 2.5) * (1 - ease((tau - 12) / 3.2));
  return ease((tau - delay) / 1.6) * (1 - ease((tau - 8) / 3));
}

/** 습성대로 도는 길 — scale 은 넓힌 어항의 가로 배율, floorY 는 평평하다고 친 바닥(실제 모래 높이는 엔진이 ground 만큼 더한다) */
export function habitCourse(id: number, seconds: number, length: number, habit: FishHabit, scale: number, floorY: number, opts?: CourseOptions, adult?: number): Course {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const phase = (hash % 6283) / 1000;
  const half = length / 2;
  const grown = Math.max(0.1, opts?.adult ?? adult ?? length);
  // 빠르기 — 물고기는 몸이 작을수록 몸길이에 비해 빨리 헤엄치지만 절대 속도는 몸길이의 제곱근쯤으로 준다(헤엄 속도의 상대 성장).
  // 옛 길은 치어와 어른이 같은 속도라 치어가 몸길이로 1.4~3배 빨랐다. 어른(습성표가 맞춘 크기)은 1 그대로.
  const sizeSpeed = Math.max(0.6, Math.min(1.15, Math.sqrt(length / grown)));
  // 한 마리마다 ±15% — 같은 계열도 똑같이 움직이지 않는다
  const own = 1 + 0.15 * (2 * unit(hash, 11) - 1);
  const rest = habit.rest ?? 0;
  U.speed = habit.speed * sizeSpeed * own; U.phase = phase; U.rest = rest; U.hop = habit.hop ?? 1; U.dart = habit.dart ?? 0;
  U.hover = rest === 0 && habit.hug === undefined && !habit.jet && !habit.breathe;
  U.hoverP = 55 + 40 * unit(hash, 23); U.hoverO = unit(hash, 29) * U.hoverP;

  // 어항 밖으로 몸이 나가지 않게 몸길이만큼 안쪽에서 돈다 — 가로 · 앞뒤 모두(옛 길은 앞뒤 폭이 몸길이를 안 봐서 고래상어가 앞 유리를 21% 뚫었다)
  const roomXs = roomX(half, 1), roomZs = roomZ(half);
  const lane = habit.hug !== undefined ? (habit.lane ?? 0.9) * (1 - 0.08 * unit(hash, 5)) : 1;
  const rx = Math.min(habit.reach * 4.6, roomXs) * lane;
  const zr = Math.min(habit.depth, roomZs) * lane;
  const home = !!habit.home;
  S.cx = home ? ((((hash >>> 8) % 1000) / 1000) * 2 - 1) * Math.max(0, roomXs - rx) * scale : 0;
  S.cz = home ? ((((hash >>> 18) % 1000) / 1000) * 2 - 1) * Math.max(0, roomZs - zr) : 0;
  S.rx = rx * scale; S.zr = zr;
  const obstacles = opts?.obstacles;
  if (home && obstacles && obstacles.length) {
    // 제자리 물고기의 자리가 장식 안이면 장식 곁으로 옮긴다(바위틈 물고기는 바위 옆에 산다) — 장식 위치만으로 정해져 늘 같다
    const mx = Math.max(0, roomXs - rx) * scale, mz = Math.max(0, roomZs - zr);
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k], want = o.r + Math.max(S.rx, zr) + half * 0.55 + 0.2;
      const dx = S.cx - o.x, dz = S.cz - o.z, dd = Math.hypot(dx, dz);
      if (dd >= want) continue;
      const ex = dd > 1e-3 ? dx / dd : 0, ez = dd > 1e-3 ? dz / dd : 1;
      let nx = Math.max(-mx, Math.min(mx, o.x + ex * want)), nz = Math.max(-mz, Math.min(mz, o.z + ez * want));
      if (Math.hypot(nx - o.x, nz - o.z) < want * 0.95) {
        // 유리 쪽으로는 자리가 없다(장식이 구석에 있다) — 어항 가운데 쪽으로 옮긴다
        const cl = Math.hypot(o.x, o.z) || 1;
        nx = Math.max(-mx, Math.min(mx, o.x - (o.x / cl) * want)); nz = Math.max(-mz, Math.min(mz, o.z - (o.z / cl) * want));
      }
      S.cx = nx; S.cz = nz;
    }
  }
  // 앞뒤 흔들림은 가로와 90° 어긋나게(약간만 흔든다) — 옛 식은 id 의 9% 가 가로 · 앞뒤가 같이 움직여 비스듬히 왔다 갔다 하며 180° 뒤집혔다
  S.zs = unit(hash, 3) < 0.5 ? 1 : -1; S.zj = (unit(hash, 7) - 0.5) * 0.6;
  S.phase = phase; S.hug = habit.hug ?? -1; S.bob = habit.bob ?? 0; S.floorY = floorY; S.length = length; S.scale = scale; S.half = half;
  S.bodyH = length * 0.16;
  // 큰 물고기는 위아래로 덜 움직인다 — 그대로 두면 고래상어가 거의 수직으로 헤엄친다
  const calm = Math.max(0.3, 1 - Math.max(0, length - 2.5) * 0.3);
  S.mid = (habit.lo + habit.hi) / 2; S.amp = ((habit.hi - habit.lo) / 2) * calm;
  S.kneeX = roomX(half, scale); S.limX = S.kneeX + 0.15 * scale; S.kneeZ = roomZ(half); S.limZ = S.kneeZ + 0.07;

  // 길 위치와 그 빠르기(du/dt) — 수치 미분(닫힌 식이라 같은 시각이면 같다)
  const h = 0.05;
  const u1 = pathU(seconds + h), u0 = pathU(seconds - h), u = pathU(seconds);
  const udot = (u1 - u0) / (2 * h);
  const moving = U.moving, hoverW = U.hoverW, hoverN = U.hoverN, cycle = U.c;

  // 세 점(u-δ, u, u+δ) — 장애물 · 벽을 거친 길의 접선과 휘는 정도까지 구한다
  const d = 0.02;
  ringPoint(u - d, 0); ringPoint(u, 3); ringPoint(u + d, 6);
  let yT = 0, vyT = 0, ground = habit.hug !== undefined ? 1 : 0;
  if (habit.breathe) {
    const period = habit.breathe * (0.9 + 0.25 * unit(hash, 13));
    turtleAt(seconds + h, hash, period); const bp = B.breath, sp = B.sand;
    turtleAt(seconds - h, hash, period); const bm = B.breath, sm = B.sand;
    turtleAt(seconds, hash, period);
    const sandY = floorY + length * 0.2;
    const mix = (y: number, b: number, s: number) => { const up = y + (SURFACE_Y - Math.max(0, length * 0.12) - y) * b; return up + (sandY - up) * s; };
    for (let i = 1; i < 9; i += 3) Q[i] = mix(Q[i], B.breath, B.sand);
    vyT = (mix(Q[4], bp, sp) - mix(Q[4], bm, sm)) / (2 * h);
    ground = B.sand;
  } else if (habit.jet) {
    const p = unit(hash, 17);
    jetAt(seconds + h, habit.jet, p); const rp = J.rise;
    jetAt(seconds - h, habit.jet, p); const rm = J.rise;
    jetAt(seconds, habit.jet, p);
    yT = J.rise * 0.22; vyT = ((rp - rm) * 0.22) / (2 * h);
    for (let i = 1; i < 9; i += 3) Q[i] += yT;
  }
  if (obstacles && obstacles.length) for (let i = 0; i < 9; i += 3) avoid(i, obstacles, floorY);
  for (let i = 0; i < 9; i += 3) contain(i);

  let x = Q[3], y = Q[4], z = Q[5];
  // 접선(u 로 미분) · 두 번 미분 — 몸이 도는 빠르기(turn)
  const tx = (Q[6] - Q[0]) / (2 * d), ty = (Q[7] - Q[1]) / (2 * d), tz = (Q[8] - Q[2]) / (2 * d);
  const ax = (Q[6] - 2 * Q[3] + Q[0]) / (d * d), az = (Q[8] - 2 * Q[5] + Q[2]) / (d * d);
  const txz = Math.hypot(tx, tz);
  let turn = txz > 1e-6 ? ((tz * ax - tx * az) / (txz * txz)) * udot : 0;
  if (!Number.isFinite(turn)) turn = 0;
  turn = Math.max(-3, Math.min(3, turn));
  // 실제 빠르기(초당) — 머리 방향은 멈춰 있어도 길의 접선을 따른다
  const spXZ = txz * Math.abs(udot);
  const tilt = habit.tilt ?? 0.36;
  const vy = ty * udot + vyT;
  const ux = txz > 1e-9 ? tx / txz : 1, uz = txz > 1e-9 ? tz / txz : 0;
  const lead = Math.max(spXZ, 0.05);
  let hx = ux * lead, hz = uz * lead, hy = vy * tilt;

  // 장식 구경 — 멈춰 떠 있는 동안 가까운 장식 하나에 다가가 들여다본다(그쪽을 본다)
  if (obstacles && obstacles.length && hoverW > 0) {
    const o = obstacles[(Math.imul(hash ^ (hoverN * 40503), 2654435761) >>> 0) % obstacles.length];
    const top = floorY + o.h;
    if (habit.lo < top + 0.8) {
      const ox = x - o.x, oz = z - o.z, od = Math.hypot(ox, oz) || 1e-6;
      // 들여다보는 자리는 장식마다 하나(어항 앞 가운데 쪽) — 물고기 쪽 방향으로 잡으면 장식 위를 지날 때 방향이 뒤집혀 반대편으로 순간 이동했다.
      // 그쪽에 이미 와 있을 때만 다가간다(장식을 뚫고 가로지르지 않게)
      const vx0 = -o.x * 0.35, vz0 = 2 - o.z, vl = Math.hypot(vx0, vz0) || 1, vx = vx0 / vl, vz = vz0 / vl;
      // 들여다보는 쪽으로 얼마나 나와 있나(거리 그대로 — 방향으로 나누면 장식 바로 위에서 값이 튄다)
      const facing = ox * vx + oz * vz;
      const stand = o.r + half + 0.25, far = od - stand;
      const w = hoverW * (1 - ease((far - 3) / 2)) * ease(facing / (stand * 0.8));
      if (w > 0) {
        const gx = o.x + vx * stand, gz = o.z + vz * stand, gy = Math.max(habit.lo, Math.min(habit.hi, top * 0.5 + floorY * 0.5 + 0.3));
        x += (gx - x) * w; z += (gz - z) * w; y += (gy - y) * w;
        hx += (-vx * 0.3 - hx) * w; hz += (-vz * 0.3 - hz) * w; hy *= 1 - w;
      }
    }
  }

  // 먹이 — 수면의 먹이 쪽으로 몰려와 이리저리 채고, 바닥 물고기는 가라앉은 먹이를 바닥에서 쫓는다. 끝나면 원래 길로 부드럽게 돌아간다
  let feedW = 0;
  const feed = opts?.feed;
  if (feed && habit.feeds !== false && seconds >= feed.t && seconds - feed.t < FEED_END) {
    const tau = seconds - feed.t, floorFish = habit.hug !== undefined, delay = 0.2 + 0.9 * unit(hash, 31);
    feedW = feedWeight(tau, floorFish, delay);
    const dw = (feedWeight(tau + h, floorFish, delay) - feedWeight(tau - h, floorFish, delay)) / (2 * h);
    if (feedW > 0 || dw !== 0) {
      const jx = (unit(hash, 37) - 0.5) * 1.6, jz = (unit(hash, 41) - 0.5) * 1.8, fp = phase * 1.3;
      const r = 0.45 + 0.25 * unit(hash, 43);
      const gx = feed.x + jx + r * Math.sin(tau * 2.3 + fp), gz = jz + r * Math.cos(tau * 2.3 + fp);
      const gy = floorFish ? floorY + (habit.hug ?? 0) * length + 0.15 + 0.1 * Math.sin(tau * 3.7 + fp) : Math.min(3.4, 4.2 - length * 0.25) + 0.25 * Math.sin(tau * 3.7 + fp);
      const vgx = r * 2.3 * Math.cos(tau * 2.3 + fp), vgz = -r * 2.3 * Math.sin(tau * 2.3 + fp), vgy = (floorFish ? 0.37 : 0.925) * Math.cos(tau * 3.7 + fp);
      hx = hx * (1 - feedW) + vgx * feedW + dw * (gx - x); hz = hz * (1 - feedW) + vgz * feedW + dw * (gz - z); hy = hy * (1 - feedW) + (vgy * feedW + dw * (gy - y)) * Math.max(tilt, 0.3);
      x += (gx - x) * feedW; y += (gy - y) * feedW; z += (gz - z) * feedW;
      turn *= 1 - feedW;
    }
  }
  if (feedW > 0 || hoverW > 0) { x = softClamp(x, S.kneeX, S.limX); z = softClamp(z, S.kneeZ, S.limZ); }
  y = Math.max(floorY - 0.05, Math.min(habit.breathe ? SURFACE_Y + 0.1 : 4.25, y));

  // 꼬리 박자 — 실제 빠르기 ÷ 몸길이를 따른다(스트루할 수: 박자 ∝ 빠르기/몸길이). 치어는 같은 빠르기에도 더 바쁘게, 급하게 돌면 빨라진다
  const pace = habit.pace ?? 1;
  const tailSize = Math.max(0.8, Math.min(1.6, Math.sqrt(grown / Math.max(0.1, length))));
  const meanSpeed = Math.max(1e-3, Math.sqrt((S.rx * S.rx + S.zr * S.zr) / 2) * U.speed);
  const ratio = Math.min(2, spXZ / meanSpeed);
  let effort: number, amp: number;
  if (habit.jet) { effort = pace; amp = 1; }
  else if (rest > 0) { effort = pace * tailSize * ((habit.idle ?? 0.06) + moving); amp = 0.2 + 0.8 * moving; }
  else { effort = pace * tailSize * (0.4 + 0.6 * ratio) + pace * 0.3 * Math.min(2, Math.abs(turn)); amp = Math.max(0.2, Math.min(1.3, 0.25 + 0.75 * ratio)); }
  if (feedW > 0) { effort += (pace * tailSize * 1.8 - effort) * feedW; amp += (1.15 - amp) * feedW; }

  // 바닥 물고기가 옮겨 갔다 내려앉은 뒤 지난 시간 — 엔진이 모래 먼지를 그린다
  let puff = -1;
  if (rest > 0 && habit.hug !== undefined) {
    const age = frac(cycle) / Math.max(1e-6, U.speed / U.hop);
    if (age < 2.5) puff = age;
  }

  const out = opts?.out ?? ({} as Course);
  out.x = x; out.y = y; out.z = z;
  out.dx = hx || 1e-3; out.dy = hy; out.dz = hz;
  out.effort = effort; out.turn = turn; out.amp = amp;
  out.pulse = habit.jet ? J.pulse : 0; out.ground = ground; out.puff = puff; out.hover = rest > 0 ? 1 - moving : hoverW;
  return out;
}

/** 무리 따라가는 물고기를 장애물 · 벽에 맞춘다 — 방금 부른 habitCourse(대장 길)의 고리 값을 그대로 쓴다 */
export function settleFollower(c: Course, length: number, scale: number, floorY: number, obstacles?: readonly Obstacle[]) {
  const half = length / 2, kx = roomX(half, scale), kz = roomZ(half);
  S.half = half; S.bodyH = length * 0.16; S.limX = kx + 0.15 * scale; S.limZ = kz + 0.07;
  Q[0] = c.x; Q[1] = c.y; Q[2] = c.z;
  if (obstacles && obstacles.length) avoid(0, obstacles, floorY);
  c.x = softClamp(Q[0], kx, kx + 0.15 * scale);
  c.z = softClamp(Q[2], kz, kz + 0.07);
  return c;
}
