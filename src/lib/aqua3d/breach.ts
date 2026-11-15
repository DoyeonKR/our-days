/** 범고래 뛰어오르기(2026-11-15) [사용자: "범고래는 클릭하면 상호작용으로 수조 위를 박차고 올라가서 쩜프하고 다시 들어오는 액션 … 돌고래 쇼 처럼 수조를 나갈때와 들어갈때 물 효과도"]
 *  누르면 깊이 잠수했다가 꼬리를 세게 쳐서 솟구쳐 수면을 박차고 나가 포물선을 그리고 다시 들어온 뒤 원래 길로 돌아온다. 화면 전용 — 저장 · 길 함수는 그대로다.
 *  순수 · three 없음. 시작 자리 · 수면 높이 · 수조 폭만으로 길을 정하고, 시각(초)으로 자리 · 속도를 낸다(같은 입력 = 같은 길).
 *  단계: 잠수(dive) → 솟구침(rise, 등가속 — 수면에서 날아오를 속도에 닿는다) → 공중(air, 포물선) → 다시 들어가 느려짐(sink) → 원래 길로(back) */

export const BREACH_FAMILIES: ReadonlySet<string> = new Set(["orca"]);
export const canBreach = (family: string) => BREACH_FAMILIES.has(family);

export type BreachPlan = {
  /** 전체 길이(초) — 끝나면 원래 길 그대로 */
  total: number;
  /** 수면을 박차고 나가는 때 · 다시 들어오는 때(초) — 물보라를 터뜨린다 */
  exitT: number;
  enterT: number;
  /** 나가는 자리 · 들어오는 자리(가로) — 물보라 자리 */
  exitX: number;
  enterX: number;
  z: number;
  surface: number;
  /** 가장 높이 닿는 몸 가운데 높이 */
  peak: number;
  /** 가로로 가는 쪽(±1) */
  dir: number;
  /** 단계 끝 시각 */
  t: { dive: number; rise: number; air: number; sink: number };
  x0: number; y0: number; z0: number;
  diveY: number; diveX: number;
  vx: number; vUp: number; g: number;
  sinkY: number;
};

export type BreachState = {
  x: number; y: number; z: number;
  /** 몸이 가는 쪽(길이 1) */
  hx: number; hy: number; hz: number;
  /** 원래 길과 섞는 몫(1 = 이 길 그대로, 0 = 원래 길) */
  w: number;
  /** 공중에 있는가 — 꼬리를 멈추고 몸을 비튼다 */
  air: boolean;
  /** 꼬리 박자 배수 */
  beat: number;
  /** 공중 몸 비틀기(rad) */
  roll: number;
  phase: "dive" | "rise" | "air" | "sink" | "back" | "done";
};

const DIVE_S = 0.9, BACK_S = 1.4;

/** start — 지금 자리, surface — 수면의 월드 높이, floor — 그 자리 바닥, halfW — 몸 가운데가 갈 수 있는 가로 끝(±), L — 몸길이 */
export function planBreach(start: { x: number; y: number; z: number; hx: number }, surface: number, floor: number, halfW: number, L: number, zFront: number): BreachPlan {
  const len = Math.max(.3, L);
  // 공중 시간 · 높이 — 몸이 통째로 수면 위로(가운데가 수면 위 몸길이 0.85배)
  const air = 1.3, H = .9 * len;
  const vUp = 4 * H / air, g = 8 * H / (air * air);
  // 솟구칠 깊이 — 수면 아래 몸길이 2배(바닥 위에 머문다)
  const diveY = Math.max(floor + len * .45, Math.min(start.y - len * .3, surface - 2.1 * len));
  const riseD = Math.max(.4, surface - diveY);
  const rise = Math.min(1.8, Math.max(.6, 2 * riseD / vUp));
  const sink = rise * .8;
  // 가로 — 넓은 쪽으로. 솟구침 + 공중 + 가라앉음 동안 같은 빠르기
  const room = (d: number) => d > 0 ? halfW - start.x : start.x + halfW;
  let dir = start.hx >= 0 ? 1 : -1;
  if (room(dir) < room(-dir) * .6) dir = -dir;
  // 공중에서 몸길이 2배를 날아간다(약 60° 로 솟는다). 수조가 좁으면 줄인다
  const want = 2 * len / air, flight = rise + air + sink * .7;
  const vx = Math.min(want, Math.max(0, 2 * halfW - .3 * len) / flight);
  // 잠수하며 솟구칠 자리로 — 날아갈 길이 수조 안에 들어오게(넓은 쪽으로)
  const diveX = clampN(start.x - dir * .4 * len, dir > 0 ? -halfW : -halfW + vx * flight, dir > 0 ? halfW - vx * flight : halfW);
  // 앞쪽으로 — 뒤쪽 위의 조명 덮개를 피하고 카메라에 잘 보이게
  const z = Math.max(start.z, Math.min(zFront, .9));
  // 솟구칠 자리가 멀면 잠수를 길게(몸길이 2.5배/초)
  const t1 = Math.min(2.4, DIVE_S + Math.abs(diveX - start.x) / (2.5 * len)), t2 = t1 + rise, t3 = t2 + air, t4 = t3 + sink;
  const exitX = diveX + dir * vx * rise, enterX = exitX + dir * vx * air;
  return {
    total: t4 + BACK_S, exitT: t2, enterT: t3, exitX, enterX, z, surface, peak: surface + H, dir,
    t: { dive: t1, rise: t2, air: t3, sink: t4 }, x0: start.x, y0: start.y, z0: start.z, diveY, diveX, vx, vUp, g,
    sinkY: Math.max(floor + len * .45, surface - .5 * vUp * sink),
  };
}

const clampN = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const ease = (x: number) => { const v = clampN(x, 0, 1); return v * v * (3 - 2 * v); };

/** 뛰어오르기 t 초의 자리 · 방향 */
export function breachAt(p: BreachPlan, t: number): BreachState {
  const { dive, rise, air, sink } = p.t, d = p.dir;
  const norm = (vx: number, vy: number, vz: number) => { const l = Math.hypot(vx, vy, vz) || 1; return [vx / l, vy / l, vz / l] as const; };
  if (!(t >= 0) || t >= p.total) return { x: p.x0, y: p.y0, z: p.z0, hx: d, hy: 0, hz: 0, w: 0, air: false, beat: 1, roll: 0, phase: "done" };
  if (t < dive) {
    // 잠수 — 시작 자리에서 솟구칠 자리로, 머리를 숙이고
    const k = ease(t / dive), x = p.x0 + (p.diveX - p.x0) * k, y = p.y0 + (p.diveY - p.y0) * k, z = p.z0 + (p.z - p.z0) * k;
    const s = t / dive, [hx, hy, hz] = norm(d * (1 - .6 * s) + 1e-3, -.9 * Math.sin(Math.PI * Math.min(1, s * 1.2)) + 1.4 * s * s, (p.z - p.z0) * .2);
    return { x, y, z, hx, hy, hz, w: Math.min(1, t / .25), air: false, beat: 1.6, roll: 0, phase: "dive" };
  }
  if (t < rise) {
    // 솟구침 — 등가속으로 수면에서 vUp 에 닿는다
    const T = rise - dive, s = t - dive, vy = 2 * (p.surface - p.diveY) / T * (s / T);
    const y = p.diveY + (p.surface - p.diveY) * (s / T) ** 2;
    const x = p.diveX + d * p.vx * s, [hx, hy, hz] = norm(d * p.vx, Math.max(vy, .25 * p.vUp), 0);
    return { x, y, z: p.z, hx, hy, hz, w: 1, air: false, beat: 2.6, roll: 0, phase: "rise" };
  }
  if (t < air) {
    // 공중 — 포물선, 꼬리는 멈추고 몸을 비틀었다 돌아온다
    const s = t - rise, A = air - rise, vy = p.vUp - p.g * s, y = p.surface + p.vUp * s - .5 * p.g * s * s;
    const x = p.exitX + d * p.vx * s, [hx, hy, hz] = norm(d * p.vx, vy, 0);
    return { x, y, z: p.z, hx, hy, hz, w: 1, air: true, beat: 0, roll: d * 1.1 * Math.sin(Math.PI * s / A), phase: "air" };
  }
  if (t < sink) {
    // 다시 들어와 물의 저항으로 느려진다 — 들어온 속도에서 0 으로
    const T = sink - air, s = t - air, k = s / T, vy0 = -p.vUp, vy = vy0 * (1 - k);
    const y = p.surface + vy0 * (s - s * s / (2 * T)), yy = Math.max(p.sinkY, y);
    const x = p.enterX + d * p.vx * (s - s * s / (2 * T) * .6), [hx, hy, hz] = norm(d * p.vx * (1 - .6 * k) + d * .3, vy * .8, 0);
    return { x, y: yy, z: p.z, hx, hy, hz, w: 1, air: false, beat: 1.4, roll: 0, phase: "sink" };
  }
  // 원래 길로 — 섞는 몫이 1 → 0
  const T = sink - air, endX = p.enterX + d * p.vx * (T - T / 2 * .6);
  const k = (t - sink) / (p.total - sink);
  return { x: endX, y: p.sinkY, z: p.z, hx: d, hy: .15, hz: 0, w: 1 - ease(k), air: false, beat: 1.3, roll: 0, phase: "back" };
}
