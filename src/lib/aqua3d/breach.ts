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

/* ── 포유류 재주(2026-11-15) [사용자: "2순위 5번만 진행해" — 범고래 말고 다른 포유류도 누르면 그 종다운 동작] ──
 *  · hop(물개 · 큰바다사자 · 독도 강치) — 수면 위로 작게 세 번 연달아 뛰기(포퍼싱, 바다사자류가 빨리 헤엄칠 때 실제로 한다)
 *  · spyhop(점박이물범) — 수면 아래에서 몸을 세워 머리만 물 밖으로 내밀고 두리번거린다
 *  · float(해달) — 수면에 배를 위로 하고 누워 가슴 위에서 조개를 톡톡 깬다(작은 물방울)
 *  · twirl(수달) — 물속에서 두 바퀴 빙글 돌며 쏜살같이 앞으로(거품 줄)
 *  · breach(범고래) — 위의 planBreach 그대로
 *  모두 같은 틀(TrickPlan)이다: 시각 → 자리 · 몸 방향 · 원래 길과 섞는 몫, 그리고 물보라를 터뜨릴 때 목록. 순수 · 같은 입력 = 같은 길. */
export type TrickKind = "breach" | "hop" | "spyhop" | "float" | "twirl";
const TRICK_OF: Record<string, TrickKind> = {
  orca: "breach", humpback_whale: "breach", minke_whale: "breach", gray_whale: "spyhop", sperm_whale: "spyhop", fur_seal: "hop", emperor_penguin: "hop", gentoo_penguin: "hop", chinstrap_penguin: "hop", adelie_penguin: "hop", walrus: "spyhop", steller_sea_lion: "hop", japanese_sea_lion: "hop", spotted_seal: "spyhop", sea_otter: "float", otter: "twirl",
};
export const trickOf = (family: string): TrickKind | null => TRICK_OF[family] ?? null;
export type TrickSplash = { t: number; x: number; z: number; enter: boolean; scale: number; amount: number };
export type TrickState = Omit<BreachState, "phase"> & { phase: string; trail: boolean };
export type TrickPlan = { kind: TrickKind; total: number; surface: number; peak: number; splashes: TrickSplash[]; at: (t: number) => TrickState };

const BACK = 1.4;
const unit = (x: number, y: number, z: number) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l] as const; };
const finished = (x: number, y: number, z: number, d: number): TrickState => ({ x, y, z, hx: d, hy: 0, hz: 0, w: 0, air: false, beat: 1, roll: 0, phase: "done", trail: false });

/** 재주 계획 — 몸 가운데는 늘 수조 가로 안(끝에서 원래 길로 돌아가며 조금 더 가던 것이 벽을 넘었다) */
/** 재주 빠르기(2026-11-18 [사용자: "포유류들도 터치했을때 움직임이 너무 빨라 실제 동물과 비슷하게"]) — 시간을 늘인다(1 = 예전).
 *  물범 · 물개류 · 수달은 1.6배 천천히, 큰 고래는 몸만큼 더 천천히(큰 몸은 물을 밀어내는 데 오래 걸린다). 범고래는 예전 그대로 */
export const trickSlow = (family: string) => family === "orca" ? 1 : /whale$/.test(family) ? 1.7 : 1.6;
export function planTrick(kind: TrickKind, start: { x: number; y: number; z: number; hx: number }, surface: number, floor: number, halfW: number, L: number, zFront: number, slow = 1): TrickPlan {
  const p = planTrickRaw(kind, start, surface, floor, halfW, L, zFront), raw = p.at, k = Math.max(1, slow);
  return { ...p, total: p.total * k, splashes: p.splashes.map((s) => ({ ...s, t: s.t * k })), at: (t) => { const s = raw(t / k); s.x = clampN(s.x, -halfW, halfW); return s; } };
}
function planTrickRaw(kind: TrickKind, start: { x: number; y: number; z: number; hx: number }, surface: number, floor: number, halfW: number, L: number, zFront: number): TrickPlan {
  const len = Math.max(.3, L), lo = floor + len * .45;
  if (kind === "breach") {
    const p = planBreach(start, surface, floor, halfW, L, zFront);
    return {
      kind, total: p.total, surface, peak: p.peak,
      splashes: [{ t: p.exitT, x: p.exitX, z: p.z, enter: false, scale: 1, amount: 1 }, { t: p.enterT, x: p.enterX, z: p.z, enter: true, scale: 1, amount: 1 }],
      at: (t) => { const b = breachAt(p, t); return { ...b, trail: b.phase === "rise" || b.phase === "sink" }; },
    };
  }
  // 가로로 갈 쪽 — 넓은 쪽(가는 쪽이 좁으면 돌아선다)
  const room = (dd: number) => dd > 0 ? halfW - start.x : start.x + halfW;
  let d = start.hx >= 0 ? 1 : -1;
  if (room(d) < room(-d) * .6) d = -d;
  const z = Math.max(start.z, Math.min(zFront, .9));
  if (kind === "hop") {
    // 세 번 뛴다 — 한 번에 공중 .7초 · 높이 몸길이 .45, 사이 물속 .45초 · 깊이 .3
    // 2026-11-20 [사용자: "포유류 … 선택했을 때의 상호작용도"] — 예전엔 뛸 자리(세 번 뛸 만큼 넓은 쪽 끝)로 먼저 옮겨 가느라 수조 절반을 3초 안에 가로질렀다.
    //   이제 지금 자리에서 넓은 쪽으로 뛰고, 자리가 모자라면 덜 뛴다(1 ~ 3번). 수면까지 오르는 시간은 깊이만큼(몸길이 1.4배/초)
    const A = .7, U = .45, H = .45 * len, D = .3 * len, per = A + U, vx = 1.5 * len / per;
    const n = Math.max(1, Math.min(3, Math.floor(Math.max(0, room(d) - len * .5) / (vx * per))));
    const xa = clampN(start.x, -halfW, halfW);
    const T0 = Math.min(4, .9 + Math.abs(surface - start.y) / (1.4 * len)), Tend = T0 + n * per, total = Tend + BACK;
    const splashes: TrickSplash[] = [];
    for (let i = 0; i < n; i++) {
      const t = T0 + i * per;
      splashes.push({ t, x: xa + d * vx * i * per, z, enter: false, scale: .6, amount: .55 });
      splashes.push({ t: t + A, x: xa + d * vx * (i * per + A), z, enter: true, scale: .6, amount: .5 });
    }
    const endX = xa + d * vx * n * per, endY = surface - .25 * len;
    return {
      kind, total, surface, peak: surface + H, splashes, at: (t) => {
        if (!(t >= 0) || t >= total) return finished(start.x, start.y, start.z, d);
        if (t < T0) {
          // 수면 바로 아래로 다가가며 빨라진다(수면에서 첫 뜀으로 이어진다)
          const u = t / T0, k = ease(u), x = start.x + (xa - start.x) * k, y = start.y + (surface - start.y) * u * u, zz = start.z + (z - start.z) * k;
          const [hx, hy, hz] = unit(d * (.4 + u), Math.max(-.6, Math.min(.9, (surface - start.y) * u / len)), 0);
          return { x, y, z: zz, hx, hy, hz, w: Math.min(1, t / .25), air: false, beat: 1.8, roll: 0, phase: "dive", trail: u > .5 };
        }
        if (t < Tend) {
          const s = t - T0, i = Math.floor(s / per), r = s - i * per, x = xa + d * vx * s;
          if (r < A) { const q = r / A, y = surface + 4 * H * q * (1 - q), vy = 4 * H * (1 - 2 * q) / A, [hx, hy, hz] = unit(d * vx, vy, 0); return { x, y, z, hx, hy, hz, w: 1, air: true, beat: 0, roll: 0, phase: "air", trail: false }; }
          const q = (r - A) / U, y = surface - 4 * D * q * (1 - q), vy = -4 * D * (1 - 2 * q) / U, [hx, hy, hz] = unit(d * vx, vy, 0);
          return { x, y, z, hx, hy, hz, w: 1, air: false, beat: 2.4, roll: 0, phase: "rise", trail: true };
        }
        const k = (t - Tend) / BACK, y = surface + (endY - surface) * ease(Math.min(1, k * 2));
        return { x: endX + d * vx * .4 * ease(k), y, z, hx: d, hy: -.2 * (1 - k), hz: 0, w: 1 - ease(k), air: false, beat: 1.3, roll: 0, phase: "back", trail: k < .3 };
      },
    };
  }
  if (kind === "spyhop") {
    // 몸을 세워 머리를 물 밖으로 — 몸 가운데가 수면 위 몸길이 .12(머리 · 어깨가 나온다)
    const x = clampN(start.x + d * .4 * len, -halfW, halfW), under = Math.max(lo, surface - .7 * len), up = surface + .12 * len;
    const T0 = Math.min(4, 1.1 + Math.abs(under - start.y) / (1.4 * len)), T1 = T0 + .8, T2 = T1 + 2.2, T3 = T2 + .9, total = T3 + BACK;
    const upright = (k: number) => unit(d * (1 - .78 * k), .25 + .72 * k, 0);
    return {
      kind, total, surface, peak: up + .4 * len,
      splashes: [{ t: T0 + .55, x, z, enter: false, scale: .4, amount: .35 }, { t: T2 + .3, x, z, enter: true, scale: .4, amount: .35 }],
      at: (t) => {
        if (!(t >= 0) || t >= total) return finished(start.x, start.y, start.z, d);
        if (t < T0) { const k = ease(t / T0), [hx, hy, hz] = upright(k * .2); return { x: start.x + (x - start.x) * k, y: start.y + (under - start.y) * k, z: start.z + (z - start.z) * k, hx, hy, hz, w: Math.min(1, t / .25), air: false, beat: 1.4, roll: 0, phase: "dive", trail: false }; }
        if (t < T1) { const k = ease((t - T0) / (T1 - T0)), [hx, hy, hz] = upright(.2 + .8 * k); return { x, y: under + (up - under) * k, z, hx, hy, hz, w: 1, air: false, beat: 1.6, roll: 0, phase: "rise", trail: true }; }
        if (t < T2) {
          // 떠 있으며 두리번 — 머리를 좌우로(옆 z 로 조금) · 숨 쉬듯 오르내린다
          const s = t - T1, [hx, hy] = upright(1), look = Math.sin(s * 2.4) * .35, [ux, uy, uz] = unit(hx, hy, look);
          return { x, y: up + Math.sin(s * 5.2) * .035 * len, z, hx: ux, hy: uy, hz: uz, w: 1, air: true, beat: .3, roll: 0, phase: "air", trail: false };
        }
        if (t < T3) { const k = ease((t - T2) / (T3 - T2)), [hx, hy, hz] = upright(1 - k); return { x: x + d * .3 * len * k, y: up + (under - up) * k, z, hx, hy: hy - .5 * k, hz, w: 1, air: false, beat: 1.2, roll: 0, phase: "sink", trail: true }; }
        const k = (t - T3) / BACK;
        return { x: x + d * .3 * len, y: under, z, hx: d, hy: 0, hz: 0, w: 1 - ease(k), air: false, beat: 1.2, roll: 0, phase: "back", trail: false };
      },
    };
  }
  if (kind === "float") {
    // 수면에 누워(배를 위로) 가슴을 톡톡 — 몸 가운데가 수면 바로 아래, 천천히 떠 간다
    const x = clampN(start.x + d * .3 * len, -halfW + len, halfW - len), at0 = surface - .08 * len, under = Math.max(lo, surface - .9 * len);
    const T0 = Math.min(4, 1.3 + Math.abs(at0 - start.y) / (1.4 * len)), T1 = T0 + .6, T2 = T1 + 3.2, T3 = T2 + .6, T4 = T3 + .8, total = T4 + BACK, drift = .05 * len;
    const splashes: TrickSplash[] = [{ t: T0, x, z, enter: false, scale: .35, amount: .25 }];
    for (let i = 0; i < 5; i++) { const t = T1 + .3 + i * .55; splashes.push({ t, x: x + d * (.15 * len + drift * (t - T0)), z, enter: false, scale: .22, amount: .2 }); }
    const ex = x + d * drift * (T3 - T0);
    return {
      kind, total, surface, peak: surface + .3 * len, splashes, at: (t) => {
        if (!(t >= 0) || t >= total) return finished(start.x, start.y, start.z, d);
        if (t < T0) { const k = ease(t / T0), [hx, hy, hz] = unit(d, .5 * (1 - k), 0); return { x: start.x + (x - start.x) * k, y: start.y + (at0 - start.y) * k, z: start.z + (z - start.z) * k, hx, hy, hz, w: Math.min(1, t / .25), air: false, beat: 1.5, roll: 0, phase: "rise", trail: true }; }
        const dx = x + d * drift * (Math.min(t, T3) - T0);
        if (t < T1) { const k = ease((t - T0) / (T1 - T0)); return { x: dx, y: at0, z, hx: d, hy: 0, hz: 0, w: 1, air: false, beat: .4, roll: d * Math.PI * k, phase: "air", trail: false }; }
        if (t < T2) {
          // 톡톡 — 0.55초마다 가슴 쪽이 살짝 들렸다 내려온다
          const s = t - T1, tap = Math.max(0, Math.sin(s / .55 * Math.PI * 2)) ** 3;
          return { x: dx, y: at0 + tap * .03 * len, z, hx: d, hy: .12 * tap, hz: 0, w: 1, air: true, beat: 0, roll: d * Math.PI, phase: "air", trail: false };
        }
        if (t < T3) { const k = ease((t - T2) / (T3 - T2)); return { x: dx, y: at0, z, hx: d, hy: 0, hz: 0, w: 1, air: false, beat: .5, roll: d * Math.PI * (1 - k), phase: "air", trail: false }; }
        if (t < T4) { const k = ease((t - T3) / (T4 - T3)), [hx, hy, hz] = unit(d, -.6 * (1 - k * .5), 0); return { x: ex + d * .4 * len * k, y: at0 + (under - at0) * k, z, hx, hy, hz, w: 1, air: false, beat: 1.6, roll: 0, phase: "sink", trail: true }; }
        const k = (t - T4) / BACK;
        return { x: ex + d * .4 * len, y: under, z, hx: d, hy: 0, hz: 0, w: 1 - ease(k), air: false, beat: 1.3, roll: 0, phase: "back", trail: false };
      },
    };
  }
  // twirl — 물속에서 두 바퀴 빙글 돌며 앞으로(몸길이 1.8 · 살짝 위로 솟았다 내려온다)
  const T0 = .35, T1 = T0 + 1.5, total = T1 + BACK, x0 = start.x;
  const top = Math.min(surface - .6 * len, Math.max(lo, start.y + .5 * len)), xEnd = clampN(x0 + d * 1.8 * len, -halfW, halfW);
  return {
    kind, total, surface, peak: top, splashes: [], at: (t) => {
      if (!(t >= 0) || t >= total) return finished(start.x, start.y, start.z, d);
      if (t < T0) return { x: x0, y: start.y, z: start.z, hx: d, hy: 0, hz: 0, w: Math.min(1, t / T0 * 1.5), air: false, beat: 2.2, roll: 0, phase: "dive", trail: false };
      if (t < T1) {
        const u = (t - T0) / (T1 - T0), k = ease(u), x = x0 + (xEnd - x0) * k, y = start.y + (top - start.y) * Math.sin(Math.PI * u);
        const vx = (xEnd - x0) * 6 * u * (1 - u), vy = (top - start.y) * Math.PI * Math.cos(Math.PI * u), [hx, hy, hz] = unit(Math.abs(vx) > 1e-3 ? vx : d * .1, vy * .5, 0);
        return { x, y, z: start.z, hx, hy, hz, w: 1, air: false, beat: 2.8, roll: d * Math.PI * 4 * k, phase: "rise", trail: true };
      }
      const k = (t - T1) / BACK;
      return { x: xEnd, y: start.y, z: start.z, hx: d, hy: 0, hz: 0, w: 1 - ease(k), air: false, beat: 1.4, roll: 0, phase: "back", trail: false };
    },
  };
}
