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
  /** 경기장 고리 — 값은 순항 빠르기(다 큰 몸길이/초). 몸이 수조 앞뒤 폭만큼 긴 물고기(고래상어)는 '몸이 어느 쪽을 보든 유리 안'으로 잡으면
   *  고리 앞뒤 반지름이 0.3 으로 눌려(가로 2.0) 양 끝이 바늘 굽이였다 — 빠르게 하면 끝에서 홱 돌았다(2026-11-12 측정 p99 2.3 ~ 2.7 rad/s, 0.07 ~ 0.10 L/s).
   *  곧은 길에선 몸이 가로로 누우니 앞뒤로 더 나가도 되고, 양 끝은 몸 끝이 유리에 안 닿는 가장 큰 반원으로 돈다(lapGeometry) */
  lap?: number;
};

const swim = (lo: number, hi: number, speed: number, reach: number, depth: number, more: Partial<FishHabit> = {}): FishHabit => ({ lo, hi, speed, reach, depth, ...more });
/** 바닥 생활 — 높이는 hug 가 정하므로 lo · hi 는 바닥 근처 값으로 둔다 */
const floor = (hug: number, speed: number, reach: number, depth: number, more: Partial<FishHabit> = {}): FishHabit => ({ lo: -5, hi: -3.5, speed, reach, depth, hug, tilt: 0, ...more });

const SCHOOL_TOP = swim(1.2, 3.6, 0.28, 0.72, 1.7, { school: true, dart: 0.22, pace: 1.35 });
const SCHOOL_MID = swim(-0.8, 1.6, 0.26, 0.72, 1.7, { school: true, dart: 0.2, pace: 1.25 });
const POTTER = swim(-2.8, 0.2, 0.12, 0.46, 1.2, { school: true, pace: 0.8 });
const STATELY = swim(-1, 1.8, 0.09, 0.4, 1.1, { school: true, pace: 0.6 });
const CRUISER = swim(-0.6, 2.2, 0.26, 1, 2, { school: true, pace: 1.2, tilt: 0.2 });
const GLIDER = swim(0.4, 2.6, 0.3, 1, 1.8, { pace: 0.5, tilt: 0.2 });
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
  great_white: swim(-1, 1.6, 0.35, 1, 2, { pace: 0.8, tilt: 0.2 }),
  hammerhead: swim(-1.4, 1, 0.17, 1, 2, { pace: 0.85, dart: 0.08, tilt: 0.2 }),
  // 아로와나는 수면 바로 밑을 순찰한다
  arowana: swim(2, 3.6, 0.12, 0.9, 1.4, { pace: 0.7, tilt: 0.1 }),
  // 해파리는 헤엄치지 않고 떠다니며 갓을 오므려 솟는다 · 거북은 평소 낮게 있다 숨 쉬러 수면까지 올라간다
  jellyfish: DRIFT,
  moon_jelly: swim(-0.5, 3.6, 0.035, 0.3, 1, { tilt: 0, pace: 0.5, jet: 3.2, feeds: false }),
  sea_turtle: swim(-3.2, -1.4, 0.1, 0.8, 1.6, { breathe: 72, pace: 0.5, tilt: 0.6 }),
  // 거대한 여과 섭식자는 넓게 천천히
  whale_shark: swim(0.2, 1.5, 0.25, 1, 1.6, { pace: 0.45, tilt: 0.15, lap: 0.155 }),
  manta: GLIDER,
  aurora_ray: GLIDER,
  // 심해어는 언제나 바닥 [사용자: "심해어는 무조건 바닥에만"]
  megamouth: floor(0.13, 0.12, 0.8, 1.4, { bob: 0.08, pace: 0.45, lane: 0.95 }),
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

/** 장식 · 바위 — 물고기 길이 피해 간다. x · r 은 월드(넓힌 어항이면 넓힌 뒤), z 는 물고기 길 좌표(깊은 수조면 월드 z ÷ 깊이), h 는 꼭대기 높이(WORLD.floor 에서 잰 값, 길 좌표).
 *  r 은 월드 반지름이다 — 깊은 수조에서도 발자국은 월드에서 원이다(2026-11-11 — 예전엔 길 좌표에서 원으로 봐서 깊이만큼 앞뒤로 부풀었다. 돔은 앞뒤를 거의 다 막았다).
 *  kind: 없거나 "decor" 면 장식(들여다보러 간다) · "rock" 은 바닥 바위 · "hall" 은 터널 · 돔 유리 */
export type Obstacle = { x: number; z: number; r: number; h: number; kind?: "decor" | "rock" | "hall" };
/** 터널 · 돔 — 낮게 사는 물고기는 이 둘레를 아예 안 지나가게 고리를 옮긴다. r 은 월드 반지름, h 는 Obstacle.h 와 같은 높이(길 좌표) */
export type Hall = { kind: "tunnel" | "dome"; r: number; h: number };
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
  /** 앞뒤 깊이 배율(tankDeep) — 엔진이 길의 z 에 곱한다. 장애물 · 유리 거리를 월드에서 재는 데 쓴다(없으면 1) */
  deep?: number;
  /** 위로 늘린 배율(tankTall) — 엔진이 길의 y 를 tallY 로 늘린다. 수면 · 몸 두께를 월드에서 맞추는 데 쓴다(없으면 1) */
  tall?: number;
  /** 터널 · 돔(10 · 11단계) */
  hall?: Hall | null;
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
  /** 0~1 — 먹이에 몰려 있는 정도(먹이 쪽으로 섞는 무게와 같은 값). 지느러미를 펴는 데 쓴다(glb.fishMotion) */
  feed?: number;
};

const TAU = Math.PI * 2;
/** 두 · 세 성분의 길이 — Math.hypot 은 넘침을 막느라 느리고(V8 에서 인자 배열을 만든다) 프레임마다 수천 번 불려 쓰레기를 남겼다(2026-11-12 측정: 11단계 한 프레임 약 0.47MB).
 *  수조 좌표는 수십 안쪽이라 넘칠 일이 없어 제곱근으로 충분하다 */
export const hyp2 = (a: number, b: number) => Math.sqrt(a * a + b * b);
export const hyp3 = (a: number, b: number, c: number) => Math.sqrt(a * a + b * b + c * c);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clampN = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const ease = (x: number) => { const v = clamp01(x); return v * v * (3 - 2 * v); };
const frac = (x: number) => x - Math.floor(x);
/** 0~1 고른 값 — id 와 소금(salt)만으로 정한다 */
const unit = (hash: number, salt: number) => ((Math.imul(hash ^ salt, 2246822519) >>> 0) % 10007) / 10007;
/** 물높이 — 수면은 길 좌표 5.56(엔진이 tallY 로 늘린다). 위로 늘린 수조에서 수면 · 먹이 높이는 월드에서 수면과의 거리를 지킨다 */
const WATER_TOP = 5.56;
/** tall 배로 늘린 수조에서 '1단계의 y' 와 수면까지 월드 거리가 같은 길 좌표 — tall 1 이면 그대로 */
const nearTop = (y: number, tall: number) => WATER_TOP - (WATER_TOP - y) / tall;
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
// cx · cz · rx · zr 은 지금 고리(천천히 떠도는 값까지), bcx · bcz · brx · bzr 은 떠돌기 전 기준 고리 — 어느 쪽으로 비킬지는 기준 고리로만 정한다(시간 따라 안 바뀐다)
const S = { cx: 0, cz: 0, rx: 0, zr: 0, bcx: 0, bcz: 0, brx: 0, bzr: 0, zs: 1, zj: 0, phase: 0, hug: -1, bob: 0, floorY: 0, length: 1, mid: 0, amp: 0, scale: 1, half: 0.5, bodyH: 0.1, yBand: 1,
  kneeX: 1, limX: 1, kneeZ: 1, limZ: 1, deep: 1, tall: 1, minBottom: 0, lane: 0, hash: 0, tx: 1, tz: 0,
  // 경기장 고리(lap) — 곧은 길 반길이 lapX · 양 끝 반원 반지름 lapR(둘 다 월드) · 한 바퀴 길이 lapP. lap 0 이면 타원 고리
  lap: 0, lapX: 0, lapR: 0, lapP: 1, lapFree: 0 };
const Q = new Float64Array(9); // u-δ · u · u+δ 세 점의 x,y,z

/** 경기장 고리의 유리 여유(월드) */
const LAP_MARGIN = 0.15;
/** 반원(반지름 R) 위에서 몸(반길이 half)의 코끝 · 꼬리 끝이 반원 중심에서 가장 멀리 나가는 거리 — 몸은 반원의 접선으로 누워 있다(√(R² + half²)).
 *  경기장 고리를 도는 종은 옆모습 돌리기를 안 한다(sideon.SIDE_ON 0 — habits.test): 돌리면 반원 끝마다 옆이 넘어가며 몸이 0.3초에 홱 돌고,
 *  넘어가는 동안 몸이 시선(앞뒤)으로 서서 코끝이 앞유리를 뚫었다 */
const lapReach = (R: number, half: number) => Math.sqrt(R * R + half * half);
/** 경기장 고리 중심이 앞뒤로 떠도는 폭(월드) — 반원 위 몸 끝이 앞뒤 유리 안에 남는 만큼(많아야 1.5 — 깊은 수조에서 앞유리까지 쏠리지 않게) */
const lapDriftZ = (gz: number, R: number, half: number) => Math.min(1.5, 0.8 * Math.max(0, gz - Math.sqrt(R * R + half * half)));
/** 장애물 피하기가 힘을 쓰기 시작하는 폭(needOf + 0.45) — 경기장 고리는 이만큼 비켜 두고, 비켜 두면 장애물 피하기를 아예 안 거친다.
 *  피하기(avoid)는 고리 중심에서 뻗은 방향으로 미는 식이라 길쭉한 경기장 고리에선 반원 위 한 자리를 움푹 휘게 해 몸이 홱 돌았다(4 ~ 5 rad/s) */
const LAP_CLEAR = 0.45;
/** 경기장 고리(가운데 · 곧은 길 반길이 X · 반원 반지름 R, 월드)와 장애물 사이 여유(몸이 닿을 높이의 장식 · 바위만 — 터널 · 돔 유리는 낮은 물고기 몫) —
 *  떠도는 동안 줄어드는 반원(0.88 배) · 곧은 길(0.82 배)과 옆으로 떠도는 몫(0.18·X)까지 본 가장 작은 값. needOf 는 S.lap 을 본다 */
function lapGap(obstacles: readonly Obstacle[], floorY: number, R: number, X: number) {
  let g = Infinity;
  for (const o of obstacles) {
    if (o.kind === "hall" || S.minBottom - (floorY + o.h) >= S.yBand) continue;
    const need = needOf(o), oz = o.z * S.deep;
    for (let k = 0; k < 4; k++) {
      const r = k & 1 ? 0.88 * R : R, x = k & 2 ? 0.82 * X : X;
      g = Math.min(g, Math.abs(hyp2(Math.max(0, Math.abs(o.x) - x), oz) - r) - need - 0.18 * X);
    }
  }
  return g;
}
/** 장애물을 비킨 경기장 고리 — 반지름을 먼저 지킨다(양 끝에서 도는 빠르기 = 빠르기 ÷ 반지름). 반지름마다 곧은 길을 줄여 보고(구석 바위는 곧은 길을 줄이면 비켜 간다),
 *  안 되면 반지름을 줄인다(원래의 0.6 배까지). 끝내 안 되면 원래 값(free 0 — 장애물 피하기에 맡긴다). slack 은 앞뒤로 떠돌아도 되는 여유.
 *  장애물 목록 · 물고기 · 수조만으로 정해져 목록마다 한 번만 찾는다 */
const LAPS = new WeakMap<readonly Obstacle[], Map<number, Memo>>(), LAPFIT = { R: 0, X: 0, free: 0, slack: 0 };
function lapFit(obstacles: readonly Obstacle[], floorY: number, R0: number, X0: number) {
  KEY[0] = R0; KEY[1] = X0; KEY[2] = S.deep; KEY[3] = S.half; KEY[4] = S.minBottom; KEY[5] = S.yBand; KEY[6] = floorY; KEY[7] = S.scale; KEY[8] = 0; KEY[9] = obstacles.length;
  const hit = memoOf(LAPS, obstacles, KEY), memo = memoMap;
  if (hit) { LAPFIT.R = hit.v[0]; LAPFIT.X = hit.v[1]; LAPFIT.free = hit.v[2]; LAPFIT.slack = hit.v[3]; return; }
  LAPFIT.R = R0; LAPFIT.X = X0; LAPFIT.free = 0; LAPFIT.slack = Infinity;
  search: for (let R = R0; R >= Math.max(0.5, 0.6 * R0) - 1e-9; R -= 0.05) for (let X = X0; X >= Math.max(0.3, 0.3 * X0) - 1e-9; X -= 0.1) {
    const g = lapGap(obstacles, floorY, R, X);
    if (g >= LAP_CLEAR) { LAPFIT.R = R; LAPFIT.X = X; LAPFIT.free = 1; LAPFIT.slack = g - LAP_CLEAR; break search; }
  }
  memo.set(S.hash, { k: KEY.slice(), v: Float64Array.of(LAPFIT.R, LAPFIT.X, LAPFIT.free, LAPFIT.slack) });
}
/** 경기장 고리 위의 점 — u 한 바퀴(2π)가 곧은 길 → 반원 → 곧은 길 → 반원. 길이를 따라 고르게 간다(타원처럼 끝에서 몰리지 않는다) */
function lapPoint(u: number, i: number) {
  const X = S.lapX, R = S.lapR, PR = Math.PI * R, s = frac(u / TAU) * S.lapP;
  let x: number, z: number;
  if (s < X) { x = s; z = R; }
  else if (s < X + PR) { const a = (s - X) / R; x = X + R * Math.sin(a); z = R * Math.cos(a); }
  else if (s < 3 * X + PR) { x = X - (s - X - PR); z = -R; }
  else if (s < 3 * X + 2 * PR) { const a = (s - 3 * X - PR) / R; x = -X - R * Math.sin(a); z = -R * Math.cos(a); }
  else { x = -X + (s - 3 * X - 2 * PR); z = R; }
  Q[i] = S.cx + x;
  Q[i + 2] = S.cz + (S.zs * z) / S.deep;
}

/** 고리 위의 점(장애물 · 벽 처리 전) */
function ringPoint(u: number, i: number) {
  if (S.lap) lapPoint(u, i);
  else {
    Q[i] = S.cx + S.rx * Math.sin(u);
    Q[i + 2] = S.cz + S.zs * S.zr * Math.cos(u + S.zj);
  }
  Q[i + 1] = S.hug >= 0 ? S.floorY + S.hug * S.length + S.bob * Math.sin(u * 2 + S.phase) : S.mid + S.amp * Math.sin(u * 2 + S.phase);
}

/** 기준 고리 중심에서 (dx, dz) 쪽 고리 반지름 — 월드에서 잰다(축에 맞춘 타원) */
function ringRadius(dx: number, dz: number) {
  const a = Math.max(1e-3, S.brx), b = Math.max(1e-3, S.bzr * S.deep);
  return 1 / Math.sqrt((dx * dx) / (a * a) + (dz * dz) / (b * b));
}
/** 고리 중심에서 (ex, ez) 쪽으로 유리(무릎)까지의 월드 거리 */
function glassReach(cx: number, czw: number, ex: number, ez: number) {
  const kx = S.kneeX, kz = S.kneeZ * S.deep;
  const tx = ex > 1e-9 ? (kx - cx) / ex : ex < -1e-9 ? (-kx - cx) / ex : Infinity;
  const tz = ez > 1e-9 ? (kz - czw) / ez : ez < -1e-9 ? (-kz - czw) / ez : Infinity;
  return Math.max(0, Math.min(tx, tz));
}
/** 장애물에서 몸 가운데까지 띄울 거리 — 몸이 어느 쪽을 보든(반길이의 0.55 배). 경기장 고리는 몸이 늘 길을 따라 누워 있어 옆으로 몸 반폭(반길이의 0.16 배)만 —
 *  고래상어(반길이 2.6)가 뒷벽 높은 바위 곁을 지날 때 2.3 이나 띄워 곧은 길이 가운데로 휘어 들었다(2026-11-12) */
const needOf = (o: Obstacle) => o.r + S.half * (S.lap ? 0.16 : 0.55) + 0.1;

// 물고기 × 장애물마다 바깥으로 도나(1 · 고리 중심을 품은 '벽'이면 2) · 안쪽으로 지나가나(0) · 아직 안 정했나(-1) — 한 번 부를 때 처음 쓰일 때만 정한다
let decide = new Int8Array(64);
// 이 물고기 고리 근처의 장애물만(바위 · 터널 기둥까지 더해 장애물이 60 개를 넘는다)
let cand = new Int32Array(64), nCand = 0;
function resetDecide(n: number) { if (decide.length < n) decide = new Int8Array(n * 2); decide.fill(-1, 0, n); }

/** 이 물고기가 장애물 k 를 바깥으로 돌아가나 — 기준 고리 · 장애물 · 유리 · 다른 장애물 위치만으로 정한다(물고기 × 장애물마다 하나, 고리 위 점마다 바뀌지 않는다).
 *  2026-11-11 — 예전엔 '바깥으로 돌아 내려앉을 자리가 다른 장식 속인가'를 고리 위 점마다 그 점 방향으로 재서, 점마다 바깥 · 안쪽이 뒤집혀 길이 순간 이동했다(장애물 탓 순간 이동 1,167번 / 2분). */
function outsideOf(k: number, obstacles: readonly Obstacle[], floorTop: number): boolean {
  const known = decide[k];
  if (known !== -1) return known >= 1;
  const o = obstacles[k], D = S.deep, need = needOf(o), needE = need + 0.45;
  const ox = o.x - S.bcx, oz = (o.z - S.bcz) * D, od = hyp2(ox, oz);
  let out: boolean;
  // 터널 · 돔 옆 길(낮은 물고기)은 유리 쪽으로만 — 터널을 건너가는 일이 없다
  if (o.kind === "hall" && S.lane) out = false;
  // 고리 중심이 장애물 곁(안쪽으로 지나갈 틈이 없다) — 바깥으로만. 이런 장애물은 '벽'이라 다른 장애물이 안쪽으로 당겨도 그 너머로는 못 간다(2)
  else if (isWall(od, need, ox, oz)) { decide[k] = 2; return true; }
  // 고리 중심 곁이지만 벽이 아닌 장애물(유리에 붙어 너머로 돌 틈이 없다) — 안쪽(고리 중심 쪽)으로 지나간다. 고리 중심이 장애물 몸 밖이라 장식도 안 뚫는다
  else if (od < needE + 0.15) out = false;
  else {
    const dx = ox / od, dz = oz / od;
    // 장애물이 고리 안쪽에 있고, 그 뒤 유리까지 몸 하나 들어갈 틈이 있으면 바깥으로
    out = ringRadius(dx, dz) > od && glassReach(S.bcx, S.bcz * D, dx, dz) - (od + need) > S.half * 0.8;
    if (out) {
      // 바깥으로 돌아 내려앉을 자리(장애물 쪽 방향의 먼 가장자리)가 다른 장애물 속이면 안쪽으로 지나간다
      const lx = S.bcx + dx * (od + needE), lz = S.bcz * D + dz * (od + needE);
      for (let m = 0; m < obstacles.length; m++) {
        const o2 = obstacles[m];
        if (o2 !== o && S.minBottom < floorTop + o2.h && hyp2(lx - o2.x, lz - o2.z * D) < o2.r + S.half * 0.55) { out = false; break; }
      }
    } else if (ringRadius(dx, dz) > od - needE && glassReach(S.bcx, S.bcz * D, dx, dz) - (od + need) > S.half * 0.8) {
      // 고리가 닿는 장애물인데 안쪽으로 지나갈 틈이 고리 중심을 품은 장애물(벽)에 막혔으면 바깥으로 돈다(2026-11-11 — 가운데 장식 곁을 도는 바닥 물고기가 옆 장식에 고리 중심까지 당겨져 가운데 장식 속에 있었다)
      for (let m = 0; m < obstacles.length; m++) {
        const o2 = obstacles[m];
        if (o2 === o || S.minBottom >= floorTop + o2.h) continue;
        const n2 = needOf(o2) + 0.45, wx = o2.x - S.bcx, wz = (o2.z - S.bcz) * D;
        if (!isWall(hyp2(wx, wz), needOf(o2), wx, wz)) continue;
        const q2 = wx * dx + wz * dz, p2 = Math.abs(wx * dz - wz * dx);
        if (p2 < n2 && od - needE < q2 + Math.sqrt(n2 * n2 - p2 * p2) + 0.1) { out = true; break; }
      }
    }
  }
  decide[k] = out ? 1 : 0;
  return out;
}

/** 고리 중심을 품은 '벽' 장애물인가 — 고리 중심이 장애물 곁(od < need + 0.6)이라 안쪽으로 지나갈 틈이 없어 바깥으로만 돈다.
 *  2026-11-12 — 고리 중심이 장애물 몸(need) 밖이고 장애물 너머가 유리(무릎)에 닿아 돌아갈 자리가 없으면 벽이 아니다: 앞유리에 붙은 장식 곁에 사는
 *  우럭 · 쏘가리 · 꺽지가 그 장식 너머(유리 밖)로 밀렸다가 유리에 눌려 납작해진 길 위에서 가로로만 오가며 머리가 한 프레임에 180° 뒤집혔다
 *  (우럭 4분에 34° 넘게 29번). 그런 장애물은 안쪽(고리 중심 쪽)으로 지나간다 */
function isWall(od: number, need: number, ox: number, oz: number) {
  if (od >= need + 0.6) return false;
  if (od < need || od < 1e-6) return true;
  return glassReach(S.bcx, S.bcz * S.deep, ox / od, oz / od) - (od + need) > 0;
}

// 장애물을 보는 순서 — 기준 고리 중심에서 가까운 것부터(정해진 순서라 고리 위 점마다 바뀌지 않는다)
let order = new Int32Array(64), orderKey = new Float64Array(64);
function sortCandidates(obstacles: readonly Obstacle[], idx: Int32Array, count: number) {
  if (order.length < count) { order = new Int32Array(count * 2); orderKey = new Float64Array(count * 2); }
  for (let j = 0; j < count; j++) { const o = obstacles[idx[j]]; order[j] = idx[j]; orderKey[j] = hyp2(o.x - S.bcx, (o.z - S.bcz) * S.deep) - o.r; }
  // 삽입 정렬(몇십 개) — 같은 거리면 목록 순서
  for (let a = 1; a < count; a++) { const k = order[a], v = orderKey[a]; let b = a - 1; while (b >= 0 && orderKey[b] > v) { order[b + 1] = order[b]; orderKey[b + 1] = orderKey[b]; b--; } order[b + 1] = k; orderKey[b + 1] = v; }
}

/** 장애물 피하기 — 고리 중심에서 그 점으로 난 방향(월드)을 따라 반지름만 줄이거나(장애물 안쪽으로 지나감) 늘린다(바깥으로 돌아감).
 *  어느 쪽으로 돌지는 물고기 · 장애물마다 한 번 정해지고(outsideOf — 바깥으로 돌아 내려앉을 자리가 다른 장애물 속이면 안쪽으로), 장애물 가장자리에서 힘이 0 으로 줄어
 *  길이 끊기거나 순간 이동하지 않는다. 장애물보다 높이 떠 있으면 상관하지 않는다.
 *  2026-11-11 — 한 방향에 장애물이 여럿이면 예전엔 목록 순서대로 한 번씩만 처리해 마지막 것이 이겼다(가운데 장식을 피한 자리가 옆 장식 속이라 바닥 물고기가 가운데 장식 안에 25% 시간 있었다).
 *  이제 기준 고리에서 가까운 장애물부터 두 번 돈다 — 뒤 장애물이 밀어 넣은 자리를 앞 장애물이 다시 본다. 순서가 정해져 있고 하나하나가 이어지는 식이라 길이 끊기지 않는다 */
/** 부드러운 min · max(2차 다항식 섞기 — 두 값이 k 안으로 가까우면 둘을 섞고, 멀면 min · max 그대로). 결과는 늘 min 이하 · max 이상, 차이는 많아야 k/4.
 *  2026-11-12 — 장애물 피하기가 Math.max · Math.min 과 'rho < lim 이면 민다'로 잘라서, 두 한계가 바뀌는 자리마다 길이 꺾였다(모서리 — 머리가 한 프레임에
 *  34° 넘게 튀는 일이 메기 · 둑중개 · 광어에 4분에 26 · 31 · 41번, 2 · 6 · 9단계 합). 꺾이는 자리를 이것으로 바꾸니 0 · 0 · 4번 */
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
/** 피하기 한계를 섞는 폭(월드) — 0.3 은 모서리가 절반쯤 남고, 0.75 부터는 장식 속 시간이 늘었다 */
const AVOID_K = 0.6;
/** 안쪽으로 당길 때 고리 중심에서 남기는 최소 거리 — 부드러운 min 은 한계 밑으로 k/4 까지 내려가서, 고리 중심 바로 곁(방향이 흔들리는 곳)까지 끌려가
 *  큰 크라켄이 한 프레임에 2.6 을 건너뛰었다. 이 바닥도 부드럽게(폭 0.1) 지킨다 */
const AVOID_FLOOR = 0.2, AVOID_FLOOR_K = 0.1;
function avoid(i: number, obstacles: readonly Obstacle[], floorTop: number, idx: Int32Array | null, count: number) {
  const D = S.deep;
  // 벽(고리 중심을 품은 장애물)이 이 방향에서 끝나는 거리 — 안쪽으로 당길 때 이보다 안으로는 안 간다
  let wall = 0, wallCore = 0;
  {
    const px = Q[i] - S.cx, pz = (Q[i + 2] - S.cz) * D, rho = hyp2(px, pz);
    if (rho < 1e-6) return;
    const ex = px / rho, ez = pz / rho;
    for (let j = 0; j < count; j++) {
      const k = idx ? idx[j] : j, o = obstacles[k];
      if (!outsideOf(k, obstacles, floorTop) || decide[k] !== 2) continue;
      const wy = 1 - ease((Q[i + 1] - S.bodyH - (floorTop + o.h)) / S.yBand);
      if (wy <= 0) continue;
      const need = needOf(o), needE = need + 0.45, ox = o.x - S.cx, oz = (o.z - S.cz) * D;
      const q = ox * ex + oz * ez, p = Math.abs(ox * ez - oz * ex);
      if (p >= needE) continue;
      const ww = wy * ease((needE - p) / (needE - need));
      wall = Math.max(wall, (q + Math.sqrt(needE * needE - p * p)) * ww);
      wallCore = Math.max(wallCore, (q + (p < need ? Math.sqrt(need * need - p * p) : 0)) * ww);
    }
  }
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j < count; j++) {
    const k = idx ? idx[j] : j, o = obstacles[k];
    const px = Q[i] - S.cx, pz = (Q[i + 2] - S.cz) * D;
    let rho = hyp2(px, pz);
    if (rho < 1e-6) return;
    // 높이로 풀리는 폭은 몸이 클수록 넓게 — 큰 거북이 장식 높이를 지나 내려앉을 때 옆으로 확 밀리지 않게
    const wy = 1 - ease((Q[i + 1] - S.bodyH - (floorTop + o.h)) / S.yBand);
    if (wy <= 0) continue;
    const need = needOf(o), needE = need + 0.45;
    const ex = px / rho, ez = pz / rho, ox = o.x - S.cx, oz = (o.z - S.cz) * D;
    const q = ox * ex + oz * ez, p = Math.abs(ox * ez - oz * ex);
    if (p >= needE) continue;
    const sE = Math.sqrt(needE * needE - p * p), w = wy * ease((needE - p) / (needE - need));
    // 바깥으로 — 한계(lim)와 지금 거리 중 큰 쪽으로 민다(부드러운 max — 한계에 막 닿는 자리에서 길이 꺾이지 않게)
    if (outsideOf(k, obstacles, floorTop)) { const lim = q + sE, nr = smax(rho, lim, AVOID_K); if (nr - rho > 1e-9) rho += (nr - rho) * w; else continue; }
    // 안쪽으로 — 장애물이 고리 중심 옆쪽으로 비껴 있을수록(q → 0) 힘을 줄인다(q 가 0 을 지날 때 끊기지 않게)
    // 벽과 이 장애물 사이에 틈이 없으면(둘 다 막힘) 두 몸(need) 사이 한가운데 — 어느 한쪽 깊숙이 들어가지 않게
    else { const sC = p < need ? Math.sqrt(need * need - p * p) : 0, K = AVOID_K, lim = smax(smax(AVOID_FLOOR, q - sE, K), smin(wall, 0.5 * (wallCore + q - sC), K), K), wq = w * ease(q / 0.4), nr = smax(smin(rho, lim, K), AVOID_FLOOR, AVOID_FLOOR_K); if (wq > 0 && rho - nr > 1e-9) rho -= (rho - nr) * wq; else continue; }
    Q[i] = S.cx + ex * rho; Q[i + 2] = S.cz + (ez * rho) / D;
  }
}

function contain(i: number) {
  Q[i] = softClamp(Q[i], S.kneeX, S.limX);
  Q[i + 2] = softClamp(Q[i + 2], S.kneeZ, S.limZ);
}

/** 먹이로 가는 길의 한 점을 장애물 옆으로 — 기준 고리 중심 → 먹이 자리(gx, gz) 방향을 길로 보고, 길 위의 장애물은 정해진 쪽(그 장애물이 길의 반대편에 있는 쪽)으로 비켜 지난다.
 *  장애물 가운데에서 바깥으로 미는 식(keepOut)은 길이 장애물 한가운데를 지날 때 미는 쪽이 뒤집혀 순간 이동했다. 터널 · 돔은 keepOut 과 같다. 결과는 P 에 */
function detour(x: number, z: number, y: number, gx: number, gz: number, obstacles: readonly Obstacle[] | undefined, floorTop: number, hall: Hall | null, fallback: number) {
  const D = S.deep, bottom = y - S.bodyH;
  let ux = gx - S.bcx, uz = (gz - S.bcz) * D;
  const ul = hyp2(ux, uz);
  if (ul > 1e-6) { ux /= ul; uz /= ul; } else { ux = 1; uz = 0; }
  const nx = -uz, nz = ux;
  let px = x, pz = z;
  if (obstacles) for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k];
    if (o.kind === "hall") continue;
    const wy = 1 - ease((bottom - (floorTop + o.h)) / S.yBand);
    if (wy <= 0) continue;
    const want = needOf(o), rx = px - o.x, rz = (pz - o.z) * D, along = rx * ux + rz * uz, perp = rx * nx + rz * nz;
    const f = 1 - ease((Math.abs(along) - want * 0.7) / (want * 1.3));
    if (f <= 0) continue;
    // 비키는 쪽 — 장애물이 길(고리 중심 → 먹이)의 왼쪽이면 오른쪽으로(정해진 값)
    const side0 = (o.x - S.bcx) * nx + (o.z - S.bcz) * D * nz, side = side0 > 1e-6 ? -1 : side0 < -1e-6 ? 1 : (Math.cos(fallback) < 0 ? -1 : 1);
    const lack = want - side * perp;
    if (lack <= 0) continue;
    const push = lack * f * wy;
    px += nx * side * push; pz += (nz * side * push) / D;
  }
  if (hall && bottom < floorTop + hall.h) {
    const want = hall.r + S.half * 0.55 + 0.1;
    if (hall.kind === "tunnel") { if (Math.abs(px) < want) px = (S.lane || (px < 0 ? -1 : 1)) * want; }
    else { const d = hyp2(px, pz * D); if (d < want) { const ex = d > 1e-3 ? px / d : Math.cos(fallback), ez = d > 1e-3 ? (pz * D) / d : Math.sin(fallback); px = ex * want; pz = (ez * want) / D; } }
  }
  P.x = softClamp(px, S.kneeX, S.limX); P.z = softClamp(pz, S.kneeZ, S.limZ);
}
/** 한 점을 장애물 · 터널 · 돔 밖으로 — 장애물 가운데에서 바깥쪽으로(먹이 자리 · 먹이로 가는 길에 쓴다). pad 만큼 더 띄운다. 결과는 P 에.
 *  터널은 늘 이 물고기 쪽(S.lane, 없으면 x 의 부호)으로 — 가운데(x = 0)에서 좌우가 뒤집히지 않게. y 는 길 좌표 */
const P = { x: 0, z: 0 };
function keepOut(x: number, z: number, y: number, pad: number, obstacles: readonly Obstacle[] | undefined, floorTop: number, hall: Hall | null, fallback: number) {
  const D = S.deep, bottom = y - S.bodyH;
  let px = x, pz = z;
  for (let pass = 0; pass < 2; pass++) {
    if (obstacles) for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      if (o.kind === "hall" || bottom >= floorTop + o.h) continue;
      const want = needOf(o) + pad, dx = px - o.x, dz = (pz - o.z) * D, d = hyp2(dx, dz);
      if (d >= want) continue;
      const ux = d > 1e-3 ? dx / d : Math.cos(fallback), uz = d > 1e-3 ? dz / d : Math.sin(fallback);
      px = o.x + ux * want; pz = (o.z * D + uz * want) / D;
    }
    if (hall && bottom < floorTop + hall.h) {
      const want = hall.r + S.half * 0.55 + 0.1 + pad;
      if (hall.kind === "tunnel") {
        if (Math.abs(px) < want) px = (S.lane || (px < 0 ? -1 : 1)) * want;
      } else {
        const d = hyp2(px, pz * D);
        if (d < want) { const ux = d > 1e-3 ? px / d : Math.cos(fallback), uz = d > 1e-3 ? (pz * D) / d : Math.sin(fallback); px = ux * want; pz = (uz * want) / D; }
      }
    }
    px = softClamp(px, S.kneeX, S.limX); pz = softClamp(pz, S.kneeZ, S.limZ);
  }
  P.x = px; P.z = pz;
}

// 길 위치 u(시간 → 길) 계산에 쓰는 값
const U = { speed: 0, phase: 0, rest: 0, hop: 1, dart: 0, hoverP: 0, hoverO: 0, hover: false, moving: 1, hoverW: 0, hoverN: 0, c: 0, breathe: 0, hash: 0 };
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
  // 거북 — 숨 쉬는 동안(수면) · 모래 위에서 쉬는 동안은 길을 거의 안 간다(2026-11-12 — B.loss 를 구해 놓고 안 써서 모래 위에서도 평소의 63% 빠르기로 미끄러졌다)
  if (U.breathe > 0) { turtleAt(t, U.hash, U.breathe); tau = t - B.loss; }
  if (U.hover) {
    // 가끔 멈춰 떠 있는다 — 그동안 길을 거의 안 간다(가슴지느러미만 부친다)
    tau = t - 0.92 * windows(t, U.hoverP, U.hoverO, 7, 0.3, 0.3);
    U.hoverW = winWeight; U.hoverN = winIndex;
  } else U.hoverW = 0;
  const v = tau * U.speed + U.phase;
  U.moving = 1;
  return v + U.dart * Math.sin(v * 3.1 + U.phase);
}

/** 고리 위치 u 를 다시 매긴다 — w > 0 이면 x 끝(sin u = ±1)에서 1 − w 배로 천천히 · 앞뒤 끝에서 1 + w 배로 빨리, w < 0 이면 거꾸로(앞뒤로 긴 고리) */
const RING_WARP = 0.6;
const warpU = (u: number, w: number) => (w ? u + 0.5 * w * Math.sin(2 * u) : u);

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
/** 거북 높이 — 숨 쉬러 올라간 몫(b)과 모래 위에서 쉬는 몫(s)을 섞는다(habitCourse 안에서 화살표 함수로 두면 부를 때마다 함수 객체가 생겼다) */
const breathMix = (y: number, b: number, s: number, breathY: number, sandY: number) => { const up = y + (breathY - y) * b; return up + (sandY - up) * s; };
const FEED_END = 16;
/** 먹이 반응 무게 — 헤엄치는 물고기는 곧장 수면으로, 바닥 물고기는 먹이가 바닥에 닿을 즈음. ta 는 다가오는 데 걸리는 초(멀수록 길다 — 2026-11-11 전엔 누구나 1.6초에 달려와 평소의 7배로 돌진했다).
 *  늦게 닿은 물고기도 16초 안에 원래 길로 돌아간다(먹이를 안 준 길과 같아진다) */
function feedWeight(tau: number, floorFish: boolean, delay: number, ta: number) {
  // 돌아가는 것도 멀수록 천천히(다가온 시간과 같은 몫, 3 ~ 6초) — 다 돌아간 뒤에야 16초
  const tb = clampN(ta, 3, 6);
  if (floorFish) { const start = 4.2 + delay, out = Math.min(FEED_END - tb - 0.05, Math.max(12, start + ta + 1.5)); return ease((tau - start) / ta) * (1 - ease((tau - out) / tb)); }
  const out = Math.min(FEED_END - tb - 0.05, Math.max(8, delay + ta + 1.5));
  return ease((tau - delay) / ta) * (1 - ease((tau - out) / tb));
}

/** 고리 근처 장애물만 후보로 — 고리에서 멀거나 늘 그 위로 떠 다니는 장애물은 볼 필요가 없다 */
/** 후보 고르기 · 터널 옆 길 맞추기는 장애물 목록 · 기준 고리만으로 정해진다 — 목록마다 · 물고기마다 한 번 계산해 둔다(무리는 대장 길을 한 프레임에 세 번 부른다).
 *  같은 입력이면 같은 값이라 결과가 바뀌지 않는다(값이 다르면 다시 계산한다) */
type Memo = { k: Float64Array; v: Int32Array | Float64Array };
const CANDS = new WeakMap<readonly Obstacle[], Map<number, Memo>>(), LANES = new WeakMap<readonly Obstacle[], Map<number, Memo>>();
const KEY = new Float64Array(10);
// 방금 memoOf 가 찾은 목록의 표 — 결과를 객체로 묶어 돌려주면 프레임마다 물고기마다 새 객체가 생겼다(2026-11-12). 다음 memoOf 전까지만 쓴다
let memoMap: Map<number, Memo> = new Map();
function memoOf(store: WeakMap<readonly Obstacle[], Map<number, Memo>>, obstacles: readonly Obstacle[], key: Float64Array): Memo | null {
  let m = store.get(obstacles);
  if (!m) { m = new Map(); store.set(obstacles, m); }
  memoMap = m;
  const e = m.get(S.hash);
  if (!e) return null;
  // 값끼리 견준다(every 와 화살표 함수는 부를 때마다 함수 객체를 만든다)
  for (let i = 0; i < key.length; i++) if (e.k[i] !== key[i]) return null;
  return e;
}
function candidatesFor(obstacles: readonly Obstacle[], floorTop: number) {
  KEY[0] = S.bcx; KEY[1] = S.bcz; KEY[2] = S.brx; KEY[3] = S.bzr; KEY[4] = S.deep; KEY[5] = S.half; KEY[6] = S.minBottom; KEY[7] = S.yBand; KEY[8] = floorTop; KEY[9] = obstacles.length;
  const e = memoOf(CANDS, obstacles, KEY), m = memoMap;
  if (e) { nCand = e.v.length; if (order.length < nCand) { order = new Int32Array(nCand * 2); orderKey = new Float64Array(nCand * 2); } order.set(e.v); return; }
  pickCandidates(obstacles, floorTop); sortCandidates(obstacles, cand, nCand);
  m.set(S.hash, { k: KEY.slice(), v: order.slice(0, nCand) });
}
function laneFor(obstacles: readonly Obstacle[], floorY: number, roomZs: number) {
  KEY[0] = S.cx; KEY[1] = S.cz; KEY[2] = S.rx; KEY[3] = S.zr; KEY[4] = S.deep; KEY[5] = S.half; KEY[6] = S.minBottom; KEY[7] = roomZs; KEY[8] = floorY; KEY[9] = obstacles.length;
  const e = memoOf(LANES, obstacles, KEY), m = memoMap;
  if (e) { S.cz = e.v[0]; S.zr = e.v[1]; return; }
  fitLane(obstacles, floorY, roomZs);
  m.set(S.hash, { k: KEY.slice(), v: Float64Array.of(S.cz, S.zr) });
}
function pickCandidates(obstacles: readonly Obstacle[], floorTop: number) {
  if (cand.length < obstacles.length) cand = new Int32Array(obstacles.length * 2);
  // 기준 고리로 고른다(떠도는 고리로 고르면 후보가 시간 따라 바뀌어 길이 튄다). 밀려난 점이 고리 밖으로 나가는 몫까지 넉넉히
  const D = S.deep, reach = Math.max(S.brx, S.bzr * D) * 1.25 + S.half + 2.6;
  nCand = 0;
  for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k];
    if (S.minBottom > floorTop + o.h + S.yBand) continue;
    if (hyp2(o.x - S.bcx, (o.z - S.bcz) * D) - o.r > reach) continue;
    cand[nCand++] = k;
  }
}

/** 습성대로 도는 길 — scale 은 넓힌 어항의 가로 배율, floorY 는 평평하다고 친 바닥(실제 모래 높이는 엔진이 ground 만큼 더한다) */
export function habitCourse(id: number, seconds: number, length: number, habit: FishHabit, scale: number, floorY: number, opts?: CourseOptions, adult?: number): Course {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const phase = (hash % 6283) / 1000;
  const half = length / 2;
  const grown = Math.max(0.1, opts?.adult ?? adult ?? length);
  const D = Math.max(1, opts?.deep ?? 1), tall = Math.max(1, opts?.tall ?? 1), hall = opts?.hall ?? null;
  // 빠르기 — 물고기는 몸이 작을수록 몸길이에 비해 빨리 헤엄치지만 절대 속도는 몸길이의 제곱근쯤으로 준다(헤엄 속도의 상대 성장).
  // 옛 길은 치어와 어른이 같은 속도라 치어가 몸길이로 1.4~3배 빨랐다. 어른(습성표가 맞춘 크기)은 1 그대로.
  const sizeSpeed = Math.max(0.6, Math.min(1.15, Math.sqrt(length / grown)));
  // 한 마리마다 ±15% — 같은 계열도 똑같이 움직이지 않는다
  const own = 1 + 0.15 * (2 * unit(hash, 11) - 1);
  const rest = habit.rest ?? 0;
  U.speed = habit.speed * sizeSpeed * own; U.phase = phase; U.rest = rest; U.hop = habit.hop ?? 1; U.dart = habit.dart ?? 0;
  U.hover = rest === 0 && habit.hug === undefined && !habit.jet && !habit.breathe;
  U.hoverP = 55 + 40 * unit(hash, 23); U.hoverO = unit(hash, 29) * U.hoverP;
  // 거북 숨 쉬는 주기 — 길(pathU)이 쉬는 몫을 빼려면 길보다 먼저 정한다
  U.breathe = habit.breathe ? habit.breathe * (0.9 + 0.25 * unit(hash, 13)) : 0; U.hash = hash;

  // 어항 밖으로 몸이 나가지 않게 몸길이만큼 안쪽에서 돈다 — 가로 · 앞뒤 모두(옛 길은 앞뒤 폭이 몸길이를 안 봐서 고래상어가 앞 유리를 21% 뚫었다)
  const roomXs = roomX(half, 1), roomZs = roomZ(half);
  const floorHab = habit.hug !== undefined;
  // 바닥 물고기는 한 마리마다 고리 크기가 다르다 — 같은 계열의 고리(lane) 안에서 0.55 ~ 1 배(2026-11-11 — 예전엔 8% 만 달라 같은 계열 광어 둘이 같은 고리를 돌며 겹쳤다)
  const lane = floorHab ? (habit.lane ?? 0.9) * (1 - 0.45 * unit(hash, 5)) : 1;
  const rx = Math.min(habit.reach * 4.6, roomXs) * lane;
  const zr = Math.min(habit.depth, roomZs) * lane;
  const home = !!habit.home;
  S.cx = home ? ((((hash >>> 8) % 1000) / 1000) * 2 - 1) * Math.max(0, roomXs - rx) * scale : 0;
  S.cz = home ? ((((hash >>> 18) % 1000) / 1000) * 2 - 1) * Math.max(0, roomZs - zr) : 0;
  // 바닥 물고기의 고리 중심도 조금씩 어긋난다(남는 자리 안에서만)
  if (floorHab && !home) { S.cx += (unit(hash, 59) - 0.5) * 0.5 * Math.max(0, roomXs - rx) * scale; S.cz += (unit(hash, 61) - 0.5) * 0.4 * Math.max(0, roomZs - zr); }
  S.rx = rx * scale; S.zr = zr;
  // 앞뒤 흔들림은 가로와 90° 어긋나게(약간만 흔든다) — 옛 식은 id 의 9% 가 가로 · 앞뒤가 같이 움직여 비스듬히 왔다 갔다 하며 180° 뒤집혔다
  S.zs = unit(hash, 3) < 0.5 ? 1 : -1; S.zj = (unit(hash, 7) - 0.5) * 0.6;
  S.phase = phase; S.hug = habit.hug ?? -1; S.bob = habit.bob ?? 0; S.floorY = floorY; S.length = length; S.scale = scale; S.half = half; S.hash = hash; S.lap = 0;
  S.deep = D; S.tall = tall;
  // 몸 두께 · 높이로 풀리는 폭은 월드 크기 — 길 좌표는 위로 늘리기 전이라 tall 로 나눈다
  S.bodyH = (length * 0.16) / tall; S.yBand = (0.5 + length * 0.5) / tall;
  // 큰 물고기는 위아래로 덜 움직인다 — 그대로 두면 고래상어가 거의 수직으로 헤엄친다
  const calm = Math.max(0.3, 1 - Math.max(0, length - 2.5) * 0.3);
  // 위로 늘린 수조에선 윗물 물고기가 늘어난 위쪽도 쓴다 — 수면까지 월드 거리를 1단계와 비슷하게(2026-11-11 — 5단계에서 위 1/3 이 비어 보였다). 1단계는 그대로
  const hi = tall > 1 && !floorHab && !habit.breathe && !habit.jet && habit.hi >= 1.5 ? nearTop(habit.hi, tall) : habit.hi;
  S.mid = (habit.lo + hi) / 2; S.amp = ((hi - habit.lo) / 2) * calm;
  S.kneeX = roomX(half, scale); S.limX = S.kneeX + 0.15 * scale; S.kneeZ = roomZ(half); S.limZ = S.kneeZ + 0.07;
  const minY = floorHab ? floorY + (habit.hug ?? 0) * length - S.bob : habit.breathe ? Math.min(S.mid - S.amp, floorY + length * 0.2) : S.mid - S.amp;
  S.minBottom = minY - S.bodyH;

  // 터널 · 돔(2026-11-11) — 낮게 사는 물고기가 터널 · 돔 속으로 다녔다(터널 수족관에서 바닥 물고기가 시간의 절반을 터널 안에 있었다).
  // 터널: 고리를 터널 한쪽 옆 길로 옮긴다(앞뒤로 긴 고리 — 큰 물고기는 유리 쪽 좁은 길). 돔: 고리 중심이 돔 안이면 장애물 피하기가 돔 둘레로 민다
  S.lane = 0;
  if (hall && S.minBottom < floorY + hall.h && hall.kind === "tunnel") {
    S.lane = S.cx !== 0 ? (S.cx < 0 ? -1 : 1) : unit(hash, 53) < 0.5 ? -1 : 1;
    const inner = hall.r + half * 0.55 + 0.1 + 0.45 + 0.15, outer = S.kneeX, w = Math.max(0.12, Math.min(S.rx, (outer - inner) / 2));
    S.rx = w; S.cx = S.lane * Math.max(Math.min(Math.abs(S.cx), outer - w), inner + w);
    if (inner + w > outer) S.cx = S.lane * Math.max(outer - w, 0);
  }
  const obstacles = opts?.obstacles;
  if (home && obstacles && obstacles.length) placeHome(obstacles, floorY, hall, roomXs, roomZs, rx, zr);
  // 터널 옆 길은 좁아 장식 · 바위를 옆으로 비킬 틈이 없다 — 길에서 막히지 않은 가장 긴 구간에 고리를 앉힌다(2026-11-11 — 터널 옆으로 비켜 앉힌 장식이 바로 이 길 위였다)
  else if (S.lane && obstacles && obstacles.length) laneFor(obstacles, floorY, roomZs);
  // 경기장 고리(2026-11-12) — 앞뒤 반원 반지름은 반원 위 어느 자리에서도 몸 끝이 앞뒤 유리 안인 가장 큰 값(√(R² + 반길이²) ≤ 앞뒤 유리),
  // 곧은 길은 반원 끝의 코끝이 옆 유리 안인 만큼(lapReach). 반지름이 0.5 도 안 나오면(몸이 수조 앞뒤보다 길다) 타원 고리 그대로
  let lapR0 = 0, lapX0 = 0, lapGZ = 0, lapSlack = Infinity;
  if (habit.lap && !floorHab && !home && !S.lane) {
    const gx = 5 * scale - LAP_MARGIN;
    lapGZ = 3 * D - LAP_MARGIN;
    let R = Math.min(habit.depth * D, Math.sqrt(Math.max(0, lapGZ * lapGZ - half * half)));
    // 깊은 수조(앞뒤 2.4배)에선 반원이 옆 유리에 닿아 곧은 길이 없어진다 — 곧은 길이 몸길이의 0.3 배 남을 때까지 반원을 줄인다
    while (R > 0.5 && gx - lapReach(R, half) < 0.6 * half) R -= 0.1;
    let X = Math.min(habit.reach * 4.6 * scale, gx - lapReach(R, half));
    if (R >= 0.5 && X >= 0.3) {
      S.lap = 1;
      // 반원 · 곧은 길이 닿는 높이의 장애물(뒷벽 높은 바위 등)을 반지름을 줄여 비켜 둔다 — 장애물 피하기가 곧은 길을 움푹 휘게 하면 그 자리에서 몸이 홱 돌았다
      LAPFIT.free = 1; LAPFIT.slack = Infinity;
      if (obstacles && obstacles.length) { lapFit(obstacles, floorY, R, X); R = LAPFIT.R; X = LAPFIT.X; }
      S.lapFree = LAPFIT.free; lapSlack = LAPFIT.slack; lapR0 = R; lapX0 = X; S.cx = 0; S.cz = 0; S.rx = X + R; S.zr = R / D;
      // 고리 자체가 유리를 지키므로 무릎은 고리 바깥 끝(+ 고리 중심이 떠도는 몫) — 장애물 피하기가 바깥으로 민 자리만 눌러 담는다(먹이 · 구경 때는 아래에서 옛 무릎으로 섞는다)
      S.kneeX = X + R + 0.05; S.limX = S.kneeX + 0.1; S.kneeZ = (R + Math.min(lapSlack, lapDriftZ(lapGZ, 0.88 * R, half)) + 0.05) / D; S.limZ = S.kneeZ + 0.05 / D;
      // 한 바퀴 빠르기 — 길 위치 u 는 2π 가 한 바퀴라, 순항 빠르기(월드/초)를 한 바퀴 길이로 나눠 u 의 빠르기로(떠도는 크기와 상관없이 늘 같은 값 — 같은 시각 = 같은 자리)
      S.lapX = X; S.lapR = R; S.lapP = 4 * X + TAU * R;
      U.speed = (habit.lap * grown * sizeSpeed * own * TAU) / S.lapP;
    }
  }
  // 기준 고리 — 어느 쪽으로 비킬지는 이것으로만 정한다
  S.bcx = S.cx; S.bcz = S.cz; S.brx = S.rx; S.bzr = S.zr;

  // 길 위치와 그 빠르기(du/dt) — 수치 미분(닫힌 식이라 같은 시각이면 같다)
  const h = 0.05;
  // 길게 늘어난 고리는 곧은 쪽에서 빨리, 양 끝(돌아서는 곳)에서 천천히 — 같은 빠르기로 돌면 끝의 굽이가 좁아 몸이 제자리에서 휙 돌았다(2026-11-12).
  // 한 바퀴 평균 빠르기는 그대로다(u 를 다시 매길 뿐 — 같은 시각 = 같은 자리). 고리가 둥글면(가로 · 앞뒤 비 1.5 아래) 그대로
  // 경기장 고리는 이미 길이를 따라 고르게 간다(양 끝 반원이 넉넉하다) — 다시 매기지 않는다
  const ringAsp = S.brx / Math.max(1e-3, S.bzr * D), warp = S.lap ? 0 : RING_WARP * (ringAsp >= 1 ? ease((ringAsp - 1.5) / 3) : -ease((1 / ringAsp - 1.5) / 3));
  const u1 = warpU(pathU(seconds + h), warp), u0 = warpU(pathU(seconds - h), warp), u = warpU(pathU(seconds), warp);
  const udot = (u1 - u0) / (2 * h);
  const moving = U.moving, hoverW = U.hoverW, hoverN = U.hoverN, cycle = U.c;
  // 같은 고리를 영원히 되풀이하지 않게 — 고리 중심 · 크기가 물고기마다 다른 긴 주기(3 ~ 6분)로 천천히 떠돈다(2026-11-11 — 고래상어는 68.5초마다 몸길이의 2% 안으로 같은 길을 돌았다).
  // 시계는 길 위치(u)로 잰다 — 쉬는 물고기는 쉬는 동안 고리도 그대로다(모래 위에서 미끄러지지 않게)
  {
    const tw = u / Math.max(1e-6, U.speed), pd = 190 + 140 * unit(hash, 67), k = home ? 0.3 : 1;
    // 떠도는 폭은 고리가 유리 안(무릎)에 남는 만큼만 — 큰 고리는 크기만 줄었다 늘었다 한다
    if (S.lap) {
      // 경기장 고리 — 곧은 길 · 반원을 줄였다 늘였다(줄이기만 해서 유리 안), 줄인 만큼만 고리 중심이 옆 · 앞뒤로 떠돈다. 한 바퀴 길이도 따라 바뀐다
      const sx = 1 - 0.18 * (0.5 + 0.5 * Math.sin((tw * TAU) / (pd * 0.83) + phase * 3)), sr = 1 - 0.12 * (0.5 + 0.5 * Math.sin((tw * TAU) / (pd * 1.19) + phase * 5));
      S.lapX = lapX0 * sx; S.lapR = lapR0 * sr; S.lapP = 4 * S.lapX + TAU * S.lapR;
      S.cx = Math.sin((tw * TAU) / pd + phase) * (lapX0 - S.lapX);
      S.cz = (Math.sin((tw * TAU) / (pd * 1.37) + phase * 2) * Math.min(lapSlack, lapDriftZ(lapGZ, S.lapR, half))) / D;
      S.rx = S.lapX + S.lapR; S.zr = S.lapR / D;
    }
    const ax = Math.min(0.35 * scale, Math.max(0, S.kneeX - Math.abs(S.cx) - S.rx)), az = Math.min(0.2, Math.max(0, S.kneeZ - Math.abs(S.cz) - S.zr));
    if (!S.lane && !S.lap) S.cx += Math.sin((tw * TAU) / pd + phase) * ax * k;
    if (!S.lane && !S.lap) S.cz += Math.sin((tw * TAU) / (pd * 1.37) + phase * 2) * az * k;
    // 헤엄치는 물고기는 사는 높이도 조금 떠돈다(고리가 유리를 꽉 채운 큰 물고기는 이것과 크기만 달라진다)
    if (!floorHab && !habit.breathe && !habit.jet) S.mid += Math.sin((tw * TAU) / (pd * 0.71) + phase * 7) * 0.3 * k;
    if (!S.lane && !S.lap) S.rx *= 1 - 0.18 * k * (0.5 + 0.5 * Math.sin((tw * TAU) / (pd * 0.83) + phase * 3));
    if (!S.lap) S.zr *= 1 - 0.18 * k * (0.5 + 0.5 * Math.sin((tw * TAU) / (pd * 1.19) + phase * 5));
  }
  if (obstacles && obstacles.length) { resetDecide(obstacles.length); candidatesFor(obstacles, floorY); } else nCand = 0;

  // 세 점(u-δ, u, u+δ) — 장애물 · 벽을 거친 길의 접선과 휘는 정도까지 구한다
  const d = 0.02;
  ringPoint(u - d, 0); ringPoint(u, 3); ringPoint(u + d, 6);
  // 고리 자체의 접선(장애물 · 구경 · 먹이 전, 월드) — 무리가 대장이 멈춰 있을 때 자리를 잡는 방향
  S.tx = Q[6] - Q[0]; S.tz = (Q[8] - Q[2]) * D;
  let yT = 0, vyT = 0, ground = floorHab ? 1 : 0;
  if (habit.breathe) {
    const period = U.breathe;
    turtleAt(seconds + h, hash, period); const bp = B.breath, sp = B.sand;
    turtleAt(seconds - h, hash, period); const bm = B.breath, sm = B.sand;
    turtleAt(seconds, hash, period);
    const sandY = floorY + length * 0.2;
    // 숨 쉬는 높이는 월드의 수면에서 잰다 — 위로 늘린 수조에서 수면보다 1.3 넘게 아래에서 멈췄다(2026-11-11). 1단계는 그대로(5 - 몸길이 × 0.12)
    const breathY = nearTop(SURFACE_Y - Math.max(0, length * 0.12), tall);
    for (let i = 1; i < 9; i += 3) Q[i] = breathMix(Q[i], B.breath, B.sand, breathY, sandY);
    vyT = (breathMix(Q[4], bp, sp, breathY, sandY) - breathMix(Q[4], bm, sm, breathY, sandY)) / (2 * h);
    ground = B.sand;
  } else if (habit.jet) {
    const p = unit(hash, 17);
    jetAt(seconds + h, habit.jet, p); const rp = J.rise;
    jetAt(seconds - h, habit.jet, p); const rm = J.rise;
    jetAt(seconds, habit.jet, p);
    yT = J.rise * 0.22; vyT = ((rp - rm) * 0.22) / (2 * h);
    for (let i = 1; i < 9; i += 3) Q[i] += yT;
  }
  // 장애물을 비켜 둔 경기장 고리는 피하기를 안 거친다(lapFit)
  if (nCand && !(S.lap && S.lapFree)) for (let i = 0; i < 9; i += 3) avoid(i, obstacles!, floorY, order, nCand);
  for (let i = 0; i < 9; i += 3) contain(i);

  let x = Q[3], y = Q[4], z = Q[5];
  // 접선(u 로 미분) · 두 번 미분 — 몸이 도는 빠르기(turn)
  const tx = (Q[6] - Q[0]) / (2 * d), ty = (Q[7] - Q[1]) / (2 * d), tz = (Q[8] - Q[2]) / (2 * d);
  const ax = (Q[6] - 2 * Q[3] + Q[0]) / (d * d), az = (Q[8] - 2 * Q[5] + Q[2]) / (d * d);
  const txz = hyp2(tx, tz);
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

  // 장식 구경 — 멈춰 떠 있는 동안 가까운 장식 하나에 다가가 들여다본다(그쪽을 본다). 바위 · 터널 · 돔은 구경하지 않는다(장식은 목록 앞쪽에 있다)
  let nDecor = 0;
  if (obstacles) while (nDecor < obstacles.length && (obstacles[nDecor].kind ?? "decor") === "decor") nDecor++;
  if (nDecor && hoverW > 0) {
    const o = obstacles![(Math.imul(hash ^ (hoverN * 40503), 2654435761) >>> 0) % nDecor];
    const top = floorY + o.h;
    if (habit.lo < top + 0.8) {
      // 월드에서 잰다(깊은 수조에서 앞뒤로 늘어난 거리)
      const ox = x - o.x, oz = (z - o.z) * D, od = hyp2(ox, oz) || 1e-6;
      // 들여다보는 자리는 장식마다 하나(어항 앞 가운데 쪽) — 물고기 쪽 방향으로 잡으면 장식 위를 지날 때 방향이 뒤집혀 반대편으로 순간 이동했다.
      // 그쪽에 이미 와 있을 때만 다가간다(장식을 뚫고 가로지르지 않게)
      const vx0 = -o.x * 0.35, vz0 = (2 - o.z) * D, vl = hyp2(vx0, vz0) || 1, vx = vx0 / vl, vz = vz0 / vl;
      // 들여다보는 쪽으로 얼마나 나와 있나(거리 그대로 — 방향으로 나누면 장식 바로 위에서 값이 튄다)
      const facing = ox * vx + oz * vz;
      const stand = o.r + half + 0.25, far = od - stand;
      const gx = o.x + vx * stand, gz = o.z + (vz * stand) / D, gy = Math.max(habit.lo, Math.min(habit.hi, top * 0.5 + floorY * 0.5 + 0.3));
      // 들여다보는 자리가 다른 장애물(장식 · 바위 · 터널 · 돔) 속이면 안 간다(2026-11-11 — 가운데 돌 앞자리가 구석 장식 안이라 광어 · 메기가 그 장식에 박혀 쉬었다)
      let blocked = !!(hall && gy - S.bodyH < floorY + hall.h && (hall.kind === "tunnel" ? Math.abs(gx) < hall.r + half * 0.55 + 0.1 : hyp2(gx, gz * D) < hall.r + half * 0.55 + 0.1));
      for (let k = 0; k < obstacles!.length && !blocked; k++) {
        const o2 = obstacles![k];
        if (o2 !== o && gy - S.bodyH < floorY + o2.h && hyp2(gx - o2.x, (gz - o2.z) * D) < o2.r + half * 0.55 + 0.1) blocked = true;
      }
      const w = blocked ? 0 : hoverW * (1 - ease((far - 3) / 2)) * ease(facing / (stand * 0.8));
      if (w > 0) {
        x += (gx - x) * w; z += (gz - z) * w; y += (gy - y) * w;
        hx += (-vx * 0.3 - hx) * w; hz += ((-vz * 0.3) / D - hz) * w; hy *= 1 - w;
      }
    }
  }

  // 먹이 — 수면의 먹이 쪽으로 몰려와 이리저리 채고, 바닥 물고기는 가라앉은 먹이를 바닥에서 쫓는다. 끝나면 원래 길로 부드럽게 돌아간다
  // 평소 가장 빠른 빠르기(월드, 초당) — 먹이에 달려갈 때도 이것의 1.8배 안에서(2026-11-11)
  const vTop = Math.max(0.15, U.speed * hyp2(Math.max(S.brx, S.bzr * D), 2 * S.amp * tall) * (rest > 0 ? 1.6 / Math.max(0.15, 1 - rest) : 1 + 3.1 * U.dart));
  // feedTurn — 머리가 먹이 쪽으로 돈 정도(아래 방향 섞기와 같은 값) — 경기장 고리의 유리 무릎을 섞는 데 쓴다
  let feedW = 0, feedTurn = 0;
  const feed = opts?.feed;
  if (feed && habit.feeds !== false && seconds >= feed.t && seconds - feed.t < FEED_END) {
    const tau = seconds - feed.t, floorFish = floorHab, delay = 0.2 + 0.9 * unit(hash, 31);
    const orbit = 0.45 + 0.25 * unit(hash, 43), fp = phase * 1.3, away = unit(hash, 47) * TAU;
    // 먹이 둘레에서 맴돌 자리 — 물고기마다 · 먹이마다 정해진 한 자리. 장식 · 바위 · 터널 · 돔 속이면 밖으로 옮긴다(2026-11-11 — 먹이를 가운데 주면 바닥 물고기가 돔 속으로 달려갔다)
    const gy0 = floorFish ? floorY + (habit.hug ?? 0) * length + 0.15 : nearTop(Math.min(3.4, 4.2 - length * 0.25), tall);
    keepOut(feed.x + (unit(hash, 37) - 0.5) * 1.6, (unit(hash, 41) - 0.5) * 1.8, gy0 - 0.15, orbit, obstacles, floorY, hall, away);
    const g0x = P.x, g0z = P.z;
    // 다가오는 시간 — 멀수록 오래 걸린다. 가까운 물고기는 예전처럼 1.6초
    const dist = hyp2(Math.hypot(g0x - S.bcx, (g0z - S.bcz) * D) + Math.max(S.brx, S.bzr * D), floorFish ? 0 : (Math.abs(gy0 - S.mid) + S.amp) * tall);
    // 다가오는 빠르기는 평소 가장 빠른 빠르기의 1.3배까지 — 먹이 둘레를 맴도는 몫(0.4배)을 더해도 1.8배 안
    const need = (1.5 * dist) / (1.3 * vTop), ta = clampN(need, floorFish ? 2.5 : 1.6, 7);
    // 너무 멀고 느리면 먹이가 사라지기 전에 닿지 못한다 — 갈 수 있는 만큼만 다가간다(빠르기 상한을 지킨다)
    const reach = Math.min(1, 7 / need);
    feedW = feedWeight(tau, floorFish, delay, ta) * reach;
    const dw = ((feedWeight(tau + h, floorFish, delay, ta) - feedWeight(tau - h, floorFish, delay, ta)) / (2 * h)) * reach;
    if (feedW > 0 || dw !== 0) {
      // 먹이 둘레를 맴도는 빠르기도 그 물고기 빠르기에 맞춘다(느린 물고기가 먹이 둘레만 빙빙 빨리 돌지 않게)
      const om = Math.min(2.3, (0.4 * vTop) / orbit), bob = floorFish ? 0.1 : 0.25, omY = Math.min(3.7, (0.3 * vTop) / bob);
      const gx = g0x + orbit * Math.sin(tau * om + fp), gz = g0z + (orbit * Math.cos(tau * om + fp)) / D;
      const gy = gy0 + bob * Math.sin(tau * omY + fp);
      const vgx = orbit * om * Math.cos(tau * om + fp), vgz = (-orbit * om * Math.sin(tau * om + fp)) / D, vgy = bob * omY * Math.cos(tau * omY + fp);
      const hx0 = hx, hz0 = hz;
      hx = hx * (1 - feedW) + vgx * feedW + dw * (gx - x); hz = hz * (1 - feedW) + vgz * feedW + dw * (gz - z); hy = hy * (1 - feedW) + (vgy * feedW + dw * (gy - y)) * Math.max(tilt, 0.3);
      // 다 먹고 돌아설 때 거의 멈추는 순간 머리가 한 프레임에 뒤집혔다(87 rad/s) — 느려질수록 먹이 쪽 옆으로 비스듬히 돌아선다(물고기마다 정해진 쪽)
      const gdx = gx - x, gdz = (gz - z) * D, gl = hyp2(gdx, gdz), sp = hyp2(hx, hz * D), vmin = Math.max(0.05, vTop * 0.25);
      if (gl > 1e-6 && sp < vmin * 3) {
        // 먹이에 끌리는 만큼만(먹이 반응이 막 시작될 땐 0 — 멈춰 떠 있던 물고기 머리가 한 프레임에 돌지 않게)
        const k = (1 - ease(sp / (vmin * 3))) * vmin * 1.5 * ease(feedW * 3 + Math.abs(dw) * 2) * (unit(hash, 71) < 0.5 ? -1 : 1);
        hx += (-gdz / gl) * k; hz += (gdx / gl / D) * k;
      }
      // 먹이에 끌리는 정도만큼 원래 머리 방향에서 먹이 쪽 방향으로 돌린다(방향끼리 섞는다 — 벡터로 섞으면 먹이가 끝날 때 0 을 지나며 뒤집혔다)
      {
        const sF = ease(Math.min(1, feedW * 3 + Math.abs(dw) * 2)); feedTurn = sF;
        const a0 = Math.atan2(hz0 * D, hx0), a1 = Math.atan2(hz * D, hx);
        let da = a1 - a0; da -= Math.round(da / TAU) * TAU;
        const ang = a0 + da * sF, mag = hyp2(hx0, hz0 * D) + (hyp2(hx, hz * D) - hyp2(hx0, hz0 * D)) * sF;
        hx = Math.cos(ang) * mag; hz = (Math.sin(ang) * mag) / D;
      }
      if (hall && hall.kind === "dome" && S.minBottom < floorY + hall.h) {
        // 돔 둘레를 돌아서 간다 — 돔 가운데 둘레의 각도 · 거리로 섞는다(곧게 섞으면 반대편 물고기가 돔을 가로질렀다).
        // 먹이와 정반대 쪽에선 어느 쪽으로 돌지 정할 수 없어 덜 다가간다(그 자리에선 안 움직이니 뒤집혀도 튀지 않는다)
        const a0 = Math.atan2(z * D, x), a1 = Math.atan2(gz * D, gx), r0 = hyp2(x, z * D), r1 = hyp2(gx, gz * D);
        let da = a1 - a0; da -= Math.round(da / TAU) * TAU;
        const wf = feedW * (1 - ease((Math.abs(da) - 0.75 * Math.PI) / (0.25 * Math.PI))), ang = a0 + da * wf, rad = r0 + (r1 - r0) * wf;
        // 돔보다 높이 떠 있으면(수면의 먹이로 가는 물고기) 곧게 — 높이에 따라 부드럽게 섞는다
        const yNow = y + (gy - y) * feedW, wd = 1 - ease((yNow - S.bodyH - (floorY + hall.h)) / S.yBand);
        const lx = x + (gx - x) * feedW, lz = z + (gz - z) * feedW;
        x = lx + (Math.cos(ang) * rad - lx) * wd; z = lz + ((Math.sin(ang) * rad) / D - lz) * wd; y = yNow;
      } else { x += (gx - x) * feedW; y += (gy - y) * feedW; z += (gz - z) * feedW; }
      turn *= 1 - feedW;
      // 먹이로 가는 길도 장식 · 바위 · 터널 · 돔을 뚫지 않는다 — 장애물 옆으로 비켜 돌아간다(비키는 쪽은 고리 중심 · 먹이 자리로 정해져 가는 동안 안 바뀐다)
      if (feedW > 0) { detour(x, z, y, g0x, g0z, obstacles, floorY, hall, away); const k = ease(feedW * 3); x += (P.x - x) * k; z += (P.z - z) * k; }
    }
  }
  if (feedW > 0 || hoverW > 0) {
    // 경기장 고리의 무릎은 '몸이 고리를 따라 누웠을 때'만 맞다 — 먹이 · 장식 구경으로 고리를 벗어나면 고리 접선 방향의 무릎(몸 끝이 유리 안:
    // |x| + 반길이·|접선 가로 성분|, |z| + 반길이·|접선 앞뒤 성분| — 고리 위에선 고리보다 바깥이라 안 건드린다)을 머리가 먹이 쪽으로 돈 만큼(feedTurn)
    // '어느 쪽을 보든' 무릎으로 섞는다. 지금 머리 방향으로 재면 먹이 둘레를 맴돌며 머리가 빙빙 도는 동안 무릎도 같이 돌아 몸이 한 프레임에 0.3 ~ 0.5 씩 끌렸다
    let kx = S.kneeX, lx = S.kneeX + 0.15 * scale, kz = S.kneeZ, lz = S.kneeZ + 0.07;
    if (S.lap) {
      const tl = hyp2(S.tx, S.tz) || 1, ux = Math.abs(S.tx) / tl, uz = Math.abs(S.tz) / tl;
      lx = 5 * scale - LAP_MARGIN - half * (ux + (1 - ux) * feedTurn); kx = lx - 0.1;
      lz = (3 * D - LAP_MARGIN - half * (uz + (1 - uz) * feedTurn)) / D; kz = lz - 0.07 / D;
    }
    x = softClamp(x, kx, lx); z = softClamp(z, kz, lz);
  }
  y = Math.max(floorY - 0.05, Math.min(habit.breathe ? nearTop(SURFACE_Y + 0.1, tall) : nearTop(4.25, tall), y));

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
  // 거북 — 모래 위에서 쉬는 동안 지느러미를 거의 안 젓고(effort · amp), 수면에서 숨 쉬는 동안은 천천히 젓는다. turtle.ts 가 amp · ground · hover 를 읽는다
  let turtleRest = 0;
  if (habit.breathe) { turtleAt(seconds, hash, U.breathe); turtleRest = Math.max(B.sand, B.breath * 0.6); effort *= 1 - 0.85 * B.sand - 0.35 * B.breath * (1 - B.sand); amp += (0.12 - amp) * B.sand; amp += (0.5 - amp) * B.breath * (1 - B.sand); }

  // 바닥 물고기가 옮겨 갔다 내려앉은 뒤 지난 시간 — 엔진이 모래 먼지를 그린다
  let puff = -1;
  if (rest > 0 && floorHab) {
    const age = frac(cycle) / Math.max(1e-6, U.speed / U.hop);
    if (age < 2.5) puff = age;
  }

  // 거의 멈췄을 때 머리 방향이 0 을 지나며 한 프레임에 뒤집히지 않게 — 아주 작아지면 고리 쪽(접선과 그 옆 사이, 물고기마다 정해진 쪽)으로 조금 기운다
  {
    const hm = hyp2(hx, hz * D), floor = 0.04;
    if (hm < floor) {
      const tl = hyp2(S.tx, S.tz) || 1, sd = unit(hash, 73) < 0.5 ? -1 : 1, bx = (S.tx - sd * S.tz) / tl, bz = (S.tz + sd * S.tx) / tl, k = (floor - hm) * 0.7;
      hx += bx * k; hz += (bz * k) / D;
    }
  }
  const out = opts?.out ?? ({} as Course);
  out.x = x; out.y = y; out.z = z;
  out.dx = hx || 1e-3; out.dy = hy; out.dz = hz;
  out.effort = effort; out.turn = turn; out.amp = amp;
  out.pulse = habit.jet ? J.pulse : 0; out.ground = ground; out.puff = puff; out.hover = rest > 0 ? 1 - moving : Math.max(hoverW, turtleRest);
  out.feed = feedW;
  return out;
}

/** 제자리 물고기(home)의 자리가 장애물 안이면 곁으로 옮긴다(바위틈 물고기는 바위 옆에 산다) — 장애물 위치만으로 정해져 늘 같다.
 *  2026-11-11 — 예전엔 유리 쪽에 자리가 없으면 어항 가운데 쪽으로 옮겼는데, 터널 · 돔 수족관에선 그 가운데가 터널 축 · 돔 한가운데였다.
 *  이제 장애물 둘레의 몇 자리(바깥 · 좌우 · 앞뒤)를 가까운 순으로 보고, 유리 안 · 터널 옆 길 · 돔 밖인 첫 자리로 간다. 거리는 월드에서 잰다 */
function placeHome(obstacles: readonly Obstacle[], floorY: number, hall: Hall | null, roomXs: number, roomZs: number, rx: number, zr: number) {
  const D = S.deep, mx = Math.max(0, roomXs - rx) * S.scale, mz = Math.max(0, roomZs - zr), ringR = Math.max(S.rx, zr * D);
  KEY[0] = S.cx; KEY[1] = S.cz; KEY[2] = S.scale; KEY[3] = D; KEY[4] = S.tall; KEY[5] = S.length; KEY[6] = S.rx; KEY[7] = zr; KEY[8] = hall ? (hall.kind === "tunnel" ? 1 : 2) : 0; KEY[9] = obstacles.length;
  const hit = memoOf(HOMES, obstacles, KEY), memo = memoMap;
  if (hit) { S.cx = hit.v[0]; S.cz = hit.v[1]; if (hit.v[2]) S.lane = hit.v[2]; return; }
  const hallLow = !!hall && S.minBottom < floorY + hall.h, bottom = S.minBottom;
  // 이 자리에 고리를 두면 장애물 · 터널 · 돔에 얼마나 걸치나(월드 거리) — 0 이면 아무 데도 안 걸친다
  const penalty = (x: number, z: number) => {
    let p = 0;
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      if (o.kind === "hall" || bottom >= floorY + o.h) continue;
      p += Math.max(0, o.r + ringR + S.half * 0.55 + 0.2 - hyp2(x - o.x, (z - o.z) * D));
    }
    if (hallLow) p += hall!.kind === "tunnel" ? Math.max(0, hall!.r + S.half * 0.55 + 0.1 + S.rx - Math.abs(x)) * 4 : Math.max(0, hall!.r + ringR + S.half * 0.55 + 0.2 - hyp2(x, z * D)) * 4;
    return p;
  };
  const x0 = S.cx, z0 = S.cz;
  let bx = x0, bz = z0, best = penalty(x0, z0);
  if (best > 0) {
    // 원래 자리 · 장애물마다 둘레 여덟 자리 · 터널 양옆 — 가장 덜 걸치는 곳, 같으면 원래 자리에서 가까운 곳(정해진 순서)
    const tryAt = (x: number, z: number) => {
      const nx = Math.max(-mx, Math.min(mx, x)), nz = Math.max(-mz, Math.min(mz, z));
      const p = penalty(nx, nz), cost = p + 0.02 * hyp2(nx - x0, (nz - z0) * D);
      if (cost < best + 0.02 * hyp2(bx - x0, (bz - z0) * D) - 1e-9) { best = p; bx = nx; bz = nz; }
    };
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      if (o.kind === "hall" || bottom >= floorY + o.h) continue;
      const want = o.r + ringR + S.half * 0.55 + 0.25;
      for (let a = 0; a < 8; a++) tryAt(o.x + Math.cos(a * Math.PI / 4) * want, o.z + (Math.sin(a * Math.PI / 4) * want) / D);
    }
    if (hallLow && hall!.kind === "tunnel") for (const sd of [-1, 1]) tryAt(sd * (hall!.r + S.half * 0.55 + 0.2 + S.rx), z0);
    for (const fx of [-1, -0.5, 0, 0.5, 1]) for (const fz of [-1, 0, 1]) tryAt(fx * mx, fz * mz);
  }
  S.cx = bx; S.cz = bz;
  if (hallLow && hall!.kind === "tunnel" && !S.lane) S.lane = S.cx < 0 ? -1 : 1;
  // 이 함수는 KEY 를 다시 쓰지 않는다 — 처음 찾을 때만 떠 둔다(찾은 자리를 다시 쓸 때마다 복사하지 않게)
  memo.set(S.hash, { k: KEY.slice(), v: Float64Array.of(S.cx, S.cz, S.lane) });
}
/** 터널 옆 길(x = S.cx ± S.rx)을 앞뒤로 따라 장애물이 막는 구간을 빼고, 가장 긴 빈 구간(같으면 가운데에 가까운 곳)에 고리를 앉힌다 — 장애물 위치만으로 정해진다 */
function fitLane(obstacles: readonly Obstacle[], floorY: number, roomZs: number) {
  const D = S.deep, lim = roomZs * D, bottom = S.minBottom, cuts: number[] = [];
  for (const o of obstacles) {
    if (o.kind === "hall" || bottom >= floorY + o.h) continue;
    const reach = o.r + S.half * 0.55 + 0.1, dx = Math.max(0, Math.abs(o.x - S.cx) - S.rx);
    if (dx >= reach) continue;
    const half = Math.sqrt(reach * reach - dx * dx), oz = o.z * D;
    cuts.push(oz - half, oz + half);
  }
  if (!cuts.length) return;
  // 막힌 구간을 합치고 빈 구간을 훑는다
  const iv: [number, number][] = [];
  for (let k = 0; k < cuts.length; k += 2) iv.push([cuts[k], cuts[k + 1]]);
  iv.sort((a, b) => a[0] - b[0]);
  let best = -1, bz0 = 0, bz1 = 0, at = -lim;
  const take = (z0: number, z1: number) => { const len = z1 - z0; if (len > best + 1e-6 || (Math.abs(len - best) <= 1e-6 && Math.abs(z0 + z1) < Math.abs(bz0 + bz1))) { best = len; bz0 = z0; bz1 = z1; } };
  for (const [a, b] of iv) { if (a > at) take(at, Math.min(a, lim)); at = Math.max(at, b); if (at >= lim) break; }
  if (at < lim) take(at, lim);
  if (best < 0.6) return;
  // 길이 넉넉하면 앞 · 뒤 반 중 하나(물고기마다 정해진 쪽) — 좁은 길에 여럿이 같은 고리를 돌면 늘 겹쳤다
  if (bz1 - bz0 > 2.5 * S.length + 1) { const mid = (bz0 + bz1) / 2; if (unit(S.hash, 79) < 0.5) bz1 = mid; else bz0 = mid; }
  // 고리 앞뒤 반지름은 빈 구간의 반(조금 안쪽) — 원래 고리보다 길어지지는 않는다
  S.cz = (bz0 + bz1) / 2 / D;
  S.zr = Math.max(0.12, Math.min(S.zr, ((bz1 - bz0) / 2 - 0.15) / D));
}
/** 집 자리는 장애물 목록 · 물고기만으로 정해진다 — 목록마다 한 번만 찾는다(같은 입력 = 같은 자리) */
const HOMES = new WeakMap<readonly Obstacle[], Map<number, Memo>>();

/** 이 물고기를 정해진 고리 중심 둘레의 점으로 보고 장애물 · 벽 · 터널 · 돔에 맞춘다 — 무리 따라가기 · 불가사리가 쓴다. 결과는 c 에 쓴다.
 *  ring 을 주면 그 고리로, 안 주면 방금 부른 habitCourse(대장 길)의 고리 값을 그대로 쓴다 */
export function settlePoint(c: { x: number; y: number; z: number }, length: number, scale: number, floorY: number, obstacles?: readonly Obstacle[], opts?: { deep?: number; tall?: number; hall?: Hall | null; ring?: { cx: number; cz: number; rx: number; zr: number; lane?: number }; leader?: { x: number; z: number } }) {
  const half = length / 2, kx = roomX(half, scale), kz = roomZ(half), D = Math.max(1, opts?.deep ?? 1), tall = Math.max(1, opts?.tall ?? 1), hall = opts?.hall ?? null;
  S.half = half; S.length = length; S.scale = scale; S.deep = D; S.tall = tall; S.lap = 0; S.bodyH = (length * 0.16) / tall; S.yBand = (0.5 + length * 0.5) / tall;
  S.kneeX = kx; S.limX = kx + 0.15 * scale; S.kneeZ = kz; S.limZ = kz + 0.07;
  if (opts?.ring) { const r = opts.ring; S.cx = S.bcx = r.cx; S.cz = S.bcz = r.cz; S.rx = S.brx = r.rx; S.zr = S.bzr = r.zr; S.lane = r.lane ?? 0; }
  S.minBottom = c.y - S.bodyH;
  Q[0] = c.x; Q[1] = c.y; Q[2] = c.z;
  if (obstacles && obstacles.length) {
    if (opts?.leader) towardLeader(obstacles, floorY, opts.leader);
    else { resetDecide(obstacles.length); avoid(0, obstacles, floorY, null, obstacles.length); }
  }
  Q[0] = softClamp(Q[0], kx, kx + 0.15 * scale);
  Q[2] = softClamp(Q[2], kz, kz + 0.07);
  // 터널 · 돔 속으로는 안 들어간다(터널은 고리 쪽 옆으로 — 가운데에서 좌우가 안 뒤집힌다)
  if (hall) { keepOut(Q[0], Q[2], c.y, 0, undefined, floorY, hall, S.hash * 1e-4); Q[0] = P.x; Q[2] = P.z; }
  c.x = Q[0]; c.z = Q[2];
  return c;
}
/** 방금 부른 habitCourse 의 고리 접선(월드, 크기 상관없음) — 장애물 · 구경 · 먹이로 휘기 전이라 대장이 멈춰 돌아봐도 안 튄다 */
const RT = { x: 0, z: 0 };
export const ringTangent = () => { RT.x = S.tx; RT.z = S.tz; return RT; }; // 늘 같은 객체 — 다음 habitCourse 전에 읽는다(프레임마다 새 객체를 안 만든다)
/** 따라가는 물고기 자리(Q[0..2])가 대장 너머 장애물 속이면 대장 쪽으로 당긴다(대장에서 자리까지 줄을 그어 장애물 앞에서 멈춘다) — 무리 자리는 고리 위가 아니라
 *  고리 중심 근처일 수도 있어서, 고리 중심에서 바깥으로 미는 식(avoid)은 자리가 고리 중심을 지날 때 미는 쪽이 뒤집혀 순간 이동했다(2026-11-11). 대장은 장애물 밖이다 */
/** 장애물 너머 자리를 대장 쪽으로 당겨도 대장에게서 몸길이의 이만큼 안으로는 안 당긴다(2026-11-12) — 끝까지 당기면 장식 많은 수조에서 무리가
 *  대장 위로 한데 포개졌다(9단계 명태 무리 서로 뚫은 시간 합 542%). 0.5 → 347% · 0.9 → 161%, 그만큼 몸이 장식에 조금 더 걸친다(9단계 13.9 → 15.4%) */
const FOLLOW_GAP = 0.9;
function towardLeader(obstacles: readonly Obstacle[], floorTop: number, lead: { x: number; z: number }) {
  const D = S.deep;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < obstacles.length; k++) {
    const o = obstacles[k];
    if (o.kind === "hall") continue;
    const wy = 1 - ease((Q[1] - S.bodyH - (floorTop + o.h)) / S.yBand);
    if (wy <= 0) continue;
    // 대장 → 자리 방향(월드)으로 장애물 앞까지 당긴다 — 대장에서 본 장애물이 옆으로 비껴 있을수록 약하게(끊기지 않게)
    const px = Q[0] - lead.x, pz = (Q[2] - lead.z) * D, rho = hyp2(px, pz);
    if (rho < 1e-6) continue;
    const ex = px / rho, ez = pz / rho, need = needOf(o), needE = need + 0.45, ox = o.x - lead.x, oz = (o.z - lead.z) * D;
    const q = ox * ex + oz * ez, p = Math.abs(ox * ez - oz * ex);
    if (p >= needE || q <= 0) continue;
    const lim = Math.max(FOLLOW_GAP * S.length, q - Math.sqrt(needE * needE - p * p)), w = wy * ease((needE - p) / (needE - need)) * ease(q / 0.4);
    if (rho <= lim) continue;
    const r = rho - (rho - lim) * w;
    Q[0] = lead.x + ex * r; Q[2] = lead.z + (ez * r) / D;
  }
}
/** 무리 따라가는 물고기를 장애물 · 벽에 맞춘다 — 방금 부른 habitCourse(대장 길)의 고리 값을 그대로 쓴다. leader 를 주면 장애물 속 자리를 대장 쪽으로 뺀다 */
export function settleFollower(c: Course, length: number, scale: number, floorY: number, obstacles?: readonly Obstacle[], opts?: { deep?: number; tall?: number; hall?: Hall | null; leader?: { x: number; z: number } }) {
  settlePoint(c, length, scale, floorY, obstacles, opts);
  return c;
}
