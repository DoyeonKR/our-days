/** 어종별 습성 [사용자: "심해어는 무조건 바닥 · 불가사리나 광어는 바닥에 붙어 산다 · 우리가 관리하는 모든 물고기 특성을 반영"]
 *  수조 안의 움직임만 정한다(저장값 · 경제와 무관). 새 계열을 FAMILIES 에 더하면 여기에도 더한다 — habits.test 가 빠진 계열을 잡는다.
 *  물높이는 월드 y(바닥 -5.3, 수면 약 4). */
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
  /** 평소엔 아래에 있다가 가끔만 위로 — 숨 쉬러 올라가는 거북 */
  peak?: number;
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
const DRIFT = swim(-2.5, 3.4, 0.035, 0.3, 1, { tilt: 0, pace: 0.5 });
const AMBUSH = swim(-1.8, 1, 0.18, 0.8, 1.7, { rest: 0.35, hop: 1.2, pace: 0.9 });

export const FISH_HABITS: Readonly<Record<string, FishHabit>> = {
  // 작은 물고기는 무리 지어 위쪽을 빠르게 — 구피 · 은어는 수면 가까이, 테트라는 가운데
  guppy: SCHOOL_TOP,
  tetra: SCHOOL_MID,
  sweetfish: swim(0.4, 2.6, 0.3, 0.92, 1.9, { school: true, dart: 0.12, pace: 1.3 }),
  // 금붕어는 아래쪽을 느긋하게 뒤진다 · 베타는 위쪽 자기 자리를 지킨다(무리 안 지음)
  goldfish: POTTER,
  betta: swim(1, 3.2, 0.09, 0.22, 0.6, { home: true, pace: 0.6 }),
  // 바닥에 붙어 사는 물고기
  catfish: SITTER,
  flounder: floor(0.05, 0.05, 0.7, 1.5, { rest: 0.85, hop: 1, pace: 1.1 }),
  rockfish: HIDER,
  nurse_shark: floor(0.12, 0.05, 0.7, 1.5, { rest: 0.7, hop: 0.7, pace: 0.6 }),
  leopard_shark: floor(0.22, 0.13, 0.9, 1.7, { bob: 0.25, pace: 0.75 }),
  croaker: BOTTOM_CRUISE,
  ray: floor(0.07, 0.08, 0.72, 1.6, { rest: 0.55, hop: 0.9, pace: 0.8 }),
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
  // 해파리는 헤엄치지 않고 떠다닌다 · 거북은 평소 낮게 있다 숨 쉬러 올라간다
  jellyfish: DRIFT,
  moon_jelly: swim(-0.5, 3.6, 0.035, 0.3, 1, { tilt: 0, pace: 0.5 }),
  sea_turtle: swim(-3.2, 3.4, 0.1, 0.8, 1.6, { peak: 3, pace: 0.5, tilt: 0.6 }),
  // 거대한 여과 섭식자는 넓게 천천히
  whale_shark: swim(0.2, 1.5, 0.09, 1, 1.6, { pace: 0.45, tilt: 0.15 }),
  manta: GLIDER,
  aurora_ray: GLIDER,
  // 심해어는 언제나 바닥 [사용자: "심해어는 무조건 바닥에만"]
  megamouth: floor(0.13, 0.07, 0.8, 1.4, { bob: 0.08, pace: 0.45 }),
  gulper_eel: DEEP,
  anglerfish: floor(0.3, 0.05, 0.5, 1.2, { rest: 0.75, hop: 0.8, pace: 0.5 }),
  oarfish: floor(0.14, 0.05, 0.75, 1.2, { bob: 0.1, pace: 0.5 }),
  coelacanth: DEEP,
  giant_squid: floor(0.25, 0.06, 0.6, 1.2, { bob: 0.1, pace: 0.5 }),
  kraken: floor(0.42, 0.04, 0.5, 1, { bob: 0.08, pace: 0.4 }),
  // 바닥을 기어 다니는 무척추동물
  starfish: floor(0.09, 0.012, 0.85, 1.4, { pace: 0.3 }),
  octopus: floor(0.42, 0.05, 0.7, 1.5, { rest: 0.7, hop: 0.8, pace: 0.7, idle: 0.5 }),
  squid: swim(-1.6, 2, 0.2, 0.72, 1.6, { school: true, rest: 0.4, hop: 1, pace: 1.2, tilt: 0.1, idle: 0.4 }),
  // 신화의 물고기
  rising: swim(-2.5, 3.4, 0.13, 0.6, 1.4, { tilt: 0.8, pace: 0.8 }),
  astral: swim(0.2, 3.4, 0.13, 0.85, 1.8, { pace: 0.7 }),
  // 앞으로 켤 토종 · 대표 어종(design/FISH-NATIVE-ART.md)
  crucian: POTTER,
  pale_chub: SCHOOL_TOP,
  chinese_minnow: SCHOOL_MID,
  smelt: SCHOOL_MID,
  bullhead: SITTER,
  common_carp: swim(-3, 0, 0.1, 0.7, 1.5, { school: true, pace: 0.7 }),
  masu_salmon: swim(-0.4, 2, 0.2, 0.6, 1.5, { pace: 1.1 }),
  snakehead: swim(2, 3.6, 0.07, 0.5, 1.2, { rest: 0.6, hop: 0.9, pace: 0.7 }),
  mandarin_fish: HIDER,
  perch_kkeokji: HIDER,
  eel: floor(0.1, 0.06, 0.7, 1.4, { rest: 0.5, hop: 0.9, pace: 0.9 }),
  lenok: swim(-1, 1.6, 0.14, 0.6, 1.4, { pace: 0.9 }),
  mackerel: CRUISER,
  rockfish_bollak: swim(-2.6, -0.6, 0.08, 0.4, 1, { school: true, pace: 0.6 }),
  black_seabream: LOW_REEF,
  hairtail: swim(-1, 2, 0.05, 0.5, 1, { pace: 0.5, tilt: 0.1 }),
  barred_knifejaw: swim(-3, -0.8, 0.14, 0.45, 1.1, { home: true, pace: 1 }),
  cutlassfish_pollock: floor(0.24, 0.14, 0.85, 1.6, { school: true, bob: 0.3, pace: 0.9 }),
  sailfin_sandfish: floor(0.1, 0.06, 0.7, 1.5, { rest: 0.7, hop: 0.8, pace: 0.9 }),
  puffer: swim(-3, -0.6, 0.08, 0.45, 1.1, { pace: 1.2, tilt: 0.1 }),
};

/** 표에 없는 물고기의 기본 — 옛 움직임과 비슷하게 가운데를 돈다 */
const DEFAULT_HABIT = swim(-2.4, 2.6, 0.2, 0.8, 1.7, { school: true });
export const habitOf = (key: string): FishHabit => FISH_HABITS[key] ?? DEFAULT_HABIT;
/** 품종이 자기 습성을 따로 가졌으면 그쪽(달빛 해파리 · 오로라 가오리는 같은 계열의 다른 품종과 몸이 다르다) */
export const habitKey = (family: string, key: string): string => (FISH_HABITS[key] ? key : family);
export const hugsFloor = (key: string): boolean => habitOf(key).hug !== undefined;

const ease = (x: number) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
const frac = (x: number) => x - Math.floor(x);

/** 습성대로 도는 길 — scale 은 넓힌 어항의 가로 배율, floorY 는 평평하다고 친 바닥(실제 모래 높이는 scene 이 더한다) */
export function habitCourse(id: number, seconds: number, length: number, habit: FishHabit, scale: number, floorY: number) {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const phase = (hash % 6283) / 1000;
  const half = length / 2;
  const hop = habit.hop ?? 1;
  const rest = habit.rest ?? 0;
  let u: number, moving = 1;
  if (rest > 0) {
    // 멈춰 있다가 짧게 옮겨 간다 — 쉬는 동안 길의 위치 u 가 그대로라 몸도 그대로다
    const c = seconds * habit.speed / hop + phase;
    const go = (frac(c) - rest) / (1 - rest);
    u = (Math.floor(c) + ease(go)) * hop;
    moving = go > 0 ? Math.sin(Math.min(1, go) * Math.PI) : 0;
  } else {
    const t = seconds * habit.speed + phase;
    u = t + (habit.dart ?? 0) * Math.sin(t * 3.1 + phase);
  }
  // 어항 밖으로 몸이 나가지 않게 몸길이만큼 안쪽에서 돈다
  const room = Math.max(0.4, 4.6 - half);
  const home = !!habit.home;
  const rx = Math.min(habit.reach * 4.6, room);
  const cx = home ? ((((hash >>> 8) % 1000) / 1000) * 2 - 1) * Math.max(0, room - rx) * scale : 0;
  const cz = home ? (((hash >>> 18) % 1000) / 1000 * 2 - 1) * Math.max(0, 2.1 - habit.depth) : 0;
  // 큰 물고기는 위아래로 덜 움직인다 — 그대로 두면 고래상어가 거의 수직으로 헤엄친다
  const calm = Math.max(0.3, 1 - Math.max(0, length - 2.5) * 0.3);
  const mid = (habit.lo + habit.hi) / 2, amp = ((habit.hi - habit.lo) / 2) * calm;
  const at = (v: number) => {
    const x = cx + rx * scale * Math.sin(v), z = cz + habit.depth * Math.cos(v + phase * 0.7);
    let y: number;
    if (habit.hug !== undefined) y = floorY + habit.hug * length + (habit.bob ?? 0) * Math.sin(v * 2 + phase);
    else if (habit.peak) y = habit.lo + (habit.hi - habit.lo) * calm * (0.5 + 0.5 * Math.sin(v * 0.37 + phase)) ** habit.peak;
    else y = mid + amp * Math.sin(v * 2 + phase);
    return { x, y, z };
  };
  const p = at(u), a = at(u - 0.02), b = at(u + 0.02);
  const dx = (b.x - a.x) * 25, dz = (b.z - a.z) * 25, dy = ((b.y - a.y) * 25) * (habit.tilt ?? 0.36);
  const pace = habit.pace ?? 1;
  const beat = rest > 0 ? (habit.idle ?? 0.06) + moving : 0.7 + Math.abs(Math.cos(u)) * 0.55;
  return { x: p.x, y: p.y, z: p.z, dx: dx || 1e-3, dy, dz, effort: beat * pace };
}
