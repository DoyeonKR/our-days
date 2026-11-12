/** 쫓고 달아나기 · 사냥 장면(2026-11-11) [사용자: "물고기 움직임 AI 도 좀 더 개선하고 물고기가 물고기를 잡아먹는 연출까지"
 *  → "모든 물고기의 이빨이 똑같아서 너무 어색해 … 사냥하는 특성을 고려해서 움직임과 모션을 … 수조 물고기들의 움직임 ai 가 현실성있어야해"]
 *  ① huntPass — 사냥꾼(lib/predation 의 PREDATORS) 곁의 작은 물고기는 달아나고(가까울수록 겁에 질려 꼬리를 빨리 친다 — fear),
 *     사냥꾼은 가까운 먹잇감 쪽으로 천천히 다가간다(살금살금 — fear 가 음수). 길(course) 위에 보정만 더하고 보정은 천천히 따라가서 떨리지 않는다.
 *  ② 사냥 방식(HUNT) — 종마다 실제 사냥 습성과 이빨이 다르다: 상어 · 다랑어는 돌진해 물고 흔들어 뜯고, 가물치 · 쏘가리 · 아귀는 숨어 있다 순식간에 덮치고,
 *     메기 · 농어 · 풍선장어는 입을 크게 벌려 통째로 빨아들이고, 뱀장어 · 갈치 · 아로와나는 몸을 뒤로 당겼다 튕겨 물고 몸을 비틀어 돌리고, 문어는 팔로 감싸 조인다.
 *  화면 전용 — 저장 · 판정과 무관. three 없음 · 할당 없음. */

/** 눈으로 보는 먹잇감 크기 — 화면 몸길이 비율(정산의 PREY_RATIO 는 cm, 화면은 세제곱근으로 누른 길이라 더 너그럽다) */
export const FLEE_RATIO = 0.62;
const MAX_OFF = 0.9;

/** positions(n×3)에 off(n×3, 프레임마다 이어진다)를 더한다. pred[i] = 1 이면 사냥꾼. dt 0 이면 보정만 다시 더한다.
 *  fear(n, 있으면 이어서 갱신) — 먹잇감은 0 평온 ~ 1 겁에 질림(사냥꾼과 가까울수록), 사냥꾼은 0 ~ −1 살금살금(먹잇감에 다가갈수록). 화면이 꼬리 치는 박자에 쓴다.
 *  scare(있으면) — 사냥 장면이 벌어지는 자리(x,y,z)와 반지름 r. 장면의 둘이 아닌 물고기는 크기와 상관없이 그 둘레에서 비켜난다(물고 뜯는 곁으로 큰 다랑어 · 대문어가 지나가며 장면을 가렸다).
 *  busy(n, 있으면) — 사냥 장면의 둘. 다른 사냥꾼이 그 먹이를 노리지 않고(예전엔 곁의 다랑어 · 상어가 장면 속 먹이에 몰려들어 화면을 가렸다) 둘 자신도 보정하지 않는다(장면이 자리를 정한다) */
export function huntPass(positions: Float32Array, lengths: Float32Array, pred: Uint8Array, off: Float32Array, n: number, dt: number, pinned?: Float32Array, fear?: Float32Array, busy?: Uint8Array, scare?: { x: number; y: number; z: number; r: number }): void {
  const k = dt > 0 ? Math.min(1, dt * 1.8) : 0, kf = dt > 0 ? Math.min(1, dt * 3) : 0;
  for (let i = 0; i < n; i++) {
    // 모래에 붙어 사는 물고기(광어 · 불가사리 · 쉬는 거북)는 쫓지도 달아나지도 않는다 — 바닥에서 떠오르면 안 된다
    if (busy && busy[i]) { off[i * 3] = off[i * 3 + 1] = off[i * 3 + 2] = 0; if (fear) fear[i] = 0; continue; }
    if (pinned && pinned[i] > 0.5) {
      // 모래에 붙은 물고기(대문어 · 광어 · 쉬는 거북)는 쫓고 달아나지 않지만, 사냥 장면 곁이면 모래 위로 옆으로만 비켜난다(2026-11-12 — 바닥의 대문어가 장면을 가렸다).
      //   위아래는 늘 0 — 바닥에서 떠오르면 안 된다
      let px = 0, pz = 0;
      if (scare) {
        const x0 = positions[i * 3], z0 = positions[i * 3 + 2], dx = x0 - scare.x, dz = z0 - scare.z, d = Math.hypot(dx, dz);
        if (d < scare.r && d > 1e-3) { const s = ((1 - d / scare.r) * 1.2) / d; px = dx * s; pz = dz * s; }
      }
      const pl = Math.hypot(px, pz); if (pl > MAX_OFF) { px *= MAX_OFF / pl; pz *= MAX_OFF / pl; }
      off[i * 3] += (px - off[i * 3]) * k; off[i * 3 + 1] = 0; off[i * 3 + 2] += (pz - off[i * 3 + 2]) * k;
      positions[i * 3] += off[i * 3]; positions[i * 3 + 2] += off[i * 3 + 2];
      if (fear) fear[i] = 0;
      continue;
    }
    const xi = positions[i * 3], yi = positions[i * 3 + 1], zi = positions[i * 3 + 2], Li = lengths[i];
    let tx = 0, ty = 0, tz = 0, f = 0;
    if (pred[i]) {
      // 가장 가까운 먹잇감 쪽으로 — 몸길이의 몇 배 안에서만, 조금씩
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i || pred[j] || (busy && busy[j]) || lengths[j] > Li * FLEE_RATIO) continue;
        const d = Math.hypot(positions[j * 3] - xi, positions[j * 3 + 1] - yi, positions[j * 3 + 2] - zi);
        if (d < bd) { bd = d; best = j; }
      }
      const R = 2.5 + Li * 2;
      if (best >= 0 && bd < R && bd > 1e-3) {
        const s = Math.min(0.45, (1 - bd / R) * 0.8) / bd;
        tx = (positions[best * 3] - xi) * s; ty = (positions[best * 3 + 1] - yi) * s * 0.5; tz = (positions[best * 3 + 2] - zi) * s;
        f = -(1 - bd / R);
      }
    } else {
      // 나를 먹을 수 있는 사냥꾼에게서 멀어진다 — 가까울수록 세게, 아주 가까우면 확 튄다
      for (let j = 0; j < n; j++) {
        if (j === i || !pred[j] || Li > lengths[j] * FLEE_RATIO) continue;
        const dx = xi - positions[j * 3], dy = yi - positions[j * 3 + 1], dz = zi - positions[j * 3 + 2];
        const d = Math.hypot(dx, dy, dz), R = 1.4 + lengths[j] * 2.4;
        if (d >= R || d < 1e-3) continue;
        const near = 1 - d / R, dart = near > 0.6 ? 1.5 : 1;
        const s = (near * (0.7 + lengths[j] * 0.4) * dart) / d;
        tx += dx * s; ty += dy * s * 0.6; tz += dz * s;
        f = Math.max(f, near);
      }
    }
    if (scare) {
      const dx = xi - scare.x, dy = yi - scare.y, dz = zi - scare.z, d = Math.hypot(dx, dy, dz);
      if (d < scare.r && d > 1e-3) { const near = 1 - d / scare.r, s = (near * 1.6) / d; tx += dx * s; ty += dy * s * 0.5; tz += dz * s; f = Math.max(f, near * 0.8); }
    }
    const tl = Math.hypot(tx, ty, tz);
    if (tl > MAX_OFF) { tx *= MAX_OFF / tl; ty *= MAX_OFF / tl; tz *= MAX_OFF / tl; }
    // 겁에 질리면 빨리 반응한다(놀라 튀기), 가라앉을 땐 천천히
    const kk = f > 0.5 ? Math.min(1, k * 2.2) : k;
    off[i * 3] += (tx - off[i * 3]) * kk;
    off[i * 3 + 1] += (ty - off[i * 3 + 1]) * kk;
    off[i * 3 + 2] += (tz - off[i * 3 + 2]) * kk;
    positions[i * 3] = xi + off[i * 3];
    positions[i * 3 + 1] = yi + off[i * 3 + 1];
    positions[i * 3 + 2] = zi + off[i * 3 + 2];
    if (fear) fear[i] += (f - fear[i]) * kf;
  }
}

/** 겁 · 살금살금 → 꼬리 박자 배율. 겁에 질린 먹잇감은 2배 가까이 빨리 치고, 다가가는 사냥꾼은 느리게(몸을 거의 안 흔들고 미끄러지듯) */
export const tailBeat = (fear: number) => (fear >= 0 ? 1 + fear * 0.9 : 1 + fear * 0.45);

/** 사냥 방식 — charge 돌진해 물고 흔들어 뜯기 · ambush 숨어 있다 덮치기 · gulp 통째로 빨아들이기 · strike 당겼다 튕겨 물고 비틀기 · wrap 팔로 감싸 조이기 */
export type HuntStyle = "charge" | "ambush" | "gulp" | "strike" | "wrap";
/** 이빨 — saw 세모 톱니(상어) · fang 드문드문 큰 송곳니 · needle 가늘고 촘촘한 바늘 · rasp 자잘한 돌기 · none 없음 */
export type Teeth = "saw" | "fang" | "needle" | "rasp" | "none";
/** 턱 — 이빨 종류 · 몸길이당 이빨 수(밀도) · 이빨 길이(벌어진 틈 대비 0~0.6) · 벌리는 각(1 = 약 45°) · 경첩 자리(머리 끝에서 몸길이의 몇 배 뒤 — 클수록 입이 크다) */
export type JawLook = { teeth: Teeth; density: number; height: number; open: number; hinge: number };
export type HuntProfile = { style: HuntStyle; jaw: JawLook };
const J = (teeth: Teeth, density: number, height: number, open: number, hinge: number): JawLook => ({ teeth, density, height, open, hinge });
/** 종(계열)마다 — 실제 사냥 습성에서 골랐다 */
export const HUNT: Readonly<Record<string, HuntProfile>> = {
  great_white: { style: "charge", jaw: J("saw", 44, 0.3, 1, 0.24) },
  hammerhead: { style: "charge", jaw: J("saw", 40, 0.24, 0.85, 0.2) },
  blue_shark: { style: "charge", jaw: J("saw", 48, 0.24, 0.9, 0.22) },
  leopard_shark: { style: "charge", jaw: J("saw", 36, 0.18, 0.75, 0.2) },
  nurse_shark: { style: "gulp", jaw: J("rasp", 70, 0.08, 0.7, 0.16) },
  bluefin: { style: "charge", jaw: J("needle", 52, 0.1, 0.7, 0.2) },
  yellowtail: { style: "charge", jaw: J("needle", 52, 0.1, 0.75, 0.2) },
  snakehead: { style: "ambush", jaw: J("fang", 16, 0.42, 1, 0.26) },
  mandarin_fish: { style: "ambush", jaw: J("fang", 22, 0.32, 1.15, 0.3) },
  perch_kkeokji: { style: "ambush", jaw: J("needle", 30, 0.2, 1.05, 0.28) },
  anglerfish: { style: "ambush", jaw: J("needle", 14, 0.6, 1.25, 0.36) },
  coelacanth: { style: "ambush", jaw: J("fang", 20, 0.28, 0.9, 0.24) },
  catfish: { style: "gulp", jaw: J("rasp", 80, 0.07, 1.1, 0.3) },
  sea_bass: { style: "gulp", jaw: J("rasp", 60, 0.1, 1.2, 0.3) },
  rockfish: { style: "gulp", jaw: J("rasp", 60, 0.1, 1.15, 0.3) },
  gulper_eel: { style: "gulp", jaw: J("none", 0, 0, 1.45, 0.45) },
  arowana: { style: "strike", jaw: J("needle", 36, 0.14, 0.95, 0.22) },
  eel: { style: "strike", jaw: J("needle", 40, 0.18, 0.7, 0.18) },
  hairtail: { style: "strike", jaw: J("fang", 18, 0.48, 0.9, 0.24) },
  octopus: { style: "wrap", jaw: J("none", 0, 0, 0, 0) },
  squid: { style: "wrap", jaw: J("none", 0, 0, 0, 0) },
  giant_squid: { style: "wrap", jaw: J("none", 0, 0, 0, 0) },
  kraken: { style: "wrap", jaw: J("none", 0, 0, 0, 0) },
};
const FALLBACK: HuntProfile = { style: "charge", jaw: J("saw", 40, 0.24, 0.9, 0.24) };
export const huntOf = (family: string): HuntProfile => HUNT[family] ?? FALLBACK;
/** 이빨 종류 → 셰이더 번호 */
export const TEETH_CODE: Readonly<Record<Teeth, number>> = { saw: 0, fang: 1, needle: 2, rasp: 3, none: 4 };

/** 돌진(상어)의 시간표 — 다른 방식은 PLANS 에서 */
export const MEAL_CHASE = 1.4, MEAL_MAUL = 2.4, MEAL_SINK = 2.6, MEAL_END = MEAL_CHASE + MEAL_MAUL + MEAL_SINK;
/** 뜯는 때(물기 시작부터 초) — 돌진 */
export const MEAL_BITES = [0, 0.8, 1.6] as const;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const snap = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);

/** 방식마다 — 다가가기(초) · 그중 마지막 덮침(초, 그 앞은 숨어 기다리거나 몸을 당긴다) · 물고 있기 · 뜯는 때 · 가라앉기(0 = 통째로 삼켜 남는 게 없다) · 흔들기 세기 */
type Plan = { approach: number; burst: number; maul: number; bites: readonly number[]; sink: number; shake: number };
const PLANS: Readonly<Record<HuntStyle, Plan>> = {
  charge: { approach: MEAL_CHASE, burst: 0, maul: MEAL_MAUL, bites: MEAL_BITES, sink: MEAL_SINK, shake: 1 },
  ambush: { approach: 1.9, burst: 0.22, maul: 1.8, bites: [0, 0.9], sink: 2.4, shake: 0.7 },
  gulp: { approach: 2.0, burst: 0, maul: 1.1, bites: [0.5], sink: 0, shake: 0.2 },
  strike: { approach: 1.7, burst: 0.25, maul: 2.2, bites: [0, 1.1], sink: 2.4, shake: 0.3 },
  wrap: { approach: 1.6, burst: 0, maul: 2.4, bites: [0.4, 1.2, 2.0], sink: 2.2, shake: 0.2 },
};
/** 그 방식의 장면이 끝나는 초 */
export const mealEnd = (style: HuntStyle = "charge") => { const p = PLANS[style]; return p.approach + p.maul + Math.max(1.4, p.sink); };
/** 가장 긴 장면 — 소식 카드는 이 뒤에 띄운다 */
export const MEAL_LONGEST = Math.max(...(Object.keys(PLANS) as HuntStyle[]).map(mealEnd));

/** 사냥 장면의 한 순간 — t 는 시작부터 흐른 초.
 *  chase(0~1) 사냥꾼이 먹이에 붙는 정도 · crouch(0~1) 덮치기 전 몸을 뒤로 당긴 정도 · lurk 숨어 기다리는 중(꼬리를 거의 안 친다) · held 물고 있나 ·
 *  shake(−1~1) 머리 흔들기 · roll 몸 비틀기(라디안) · bites 뜯은 수 · swallow(0~1) 통째로 빨려 들어간 정도 · sink 놓은 뒤 가라앉은 정도 ·
 *  back 사냥꾼이 제 길로 돌아간 정도 · jaw(0~1) 입 벌림 */
export function mealPose(t: number, style: HuntStyle = "charge") {
  const p = PLANS[style];
  const lead = p.approach - p.burst;
  const chase = p.burst > 0 ? (t < lead ? 0 : snap((t - lead) / p.burst)) : ease(t / p.approach);
  const lurk = style === "ambush" && t < lead;
  // 튕기기 준비 — S 자로 몸을 당겼다가 덮치며 편다
  const crouch = style === "strike" ? (t < lead ? ease(t / lead) : 1 - snap((t - lead) / p.burst)) : 0;
  const m = t - p.approach, held = m >= 0 && m < p.maul;
  let shake = 0;
  if (held && p.shake > 0) {
    const near = Math.min(...p.bites.map((b) => Math.abs(m - b)));
    shake = Math.sin(m * Math.PI * 9) * (0.55 + 0.45 * Math.max(0, 1 - near * 3)) * (1 - ease((m - p.maul + 0.4) / 0.4)) * p.shake;
  }
  const bites = m < 0 ? 0 : p.bites.filter((b) => m >= b).length;
  // 비틀어 돌기 — 물고 있는 동안 한 바퀴 반 돌았다 제자리로
  const roll = style === "strike" && held ? Math.sin(ease(m / p.maul) * Math.PI) * Math.PI * 1.5 : 0;
  // 통째로 — 입이 열린 채 빨려 들어간다(덮치는 순간 조금 앞부터)
  const swallow = style === "gulp" ? snap((m + 0.2) / 0.6) : 0;
  const r = t - p.approach - p.maul;
  const sink = p.sink > 0 && r > 0 ? ease(r / p.sink) : 0;
  const back = r > 0 ? ease(r / 1.4) : 0;
  // 턱 — 다가가며 크게 벌리고, 무는 순간 콱 닫고, 물고 있는 동안 씹는다(다음 뜯기 앞에서 다시 크게). 빨아들일 땐 활짝 열었다가 다 삼키면 닫고 우물우물
  let jaw = 0;
  if (m < 0) jaw = lurk ? 0.06 : p.burst > 0 ? snap((t - lead + 0.12) / 0.15) : ease((t - (p.approach - 0.6)) / 0.5);
  else if (held) {
    if (style === "gulp") jaw = swallow < 0.97 ? 1 : 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(m * 12));
    else {
      jaw = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(m * 15));
      for (const b of p.bites) {
        if (m >= b - 0.28 && m < b) jaw = Math.max(jaw, ease((m - (b - 0.28)) / 0.2));
        if (m >= b && m < b + 0.09) jaw = 0;
      }
    }
  } else jaw = (style === "gulp" ? 0.1 : 0.3) * (1 - back);
  return { chase, crouch, lurk, held, shake, roll, bites, swallow, bit: m >= 0, sink, back, jaw, done: t >= mealEnd(style) };
}

/** 사냥 장면 카메라(2026-11-12) — 예전엔 먹이 한 마리만 따라가 거리를 먹이 몸길이로 정해서, 작은 먹이(구피)면 카메라가 코앞에 붙어
 *  사냥꾼이 화면 밖에 있거나(매복 · 튕기기는 내내) 앞의 장식 · 다른 물고기에 가려 아무것도 안 보였다.
 *  이제 사냥꾼의 입과 먹이의 가운데를 보고, 둘이 다 들어오는 거리에서, 둘을 잇는 선에 수직인 옆(앞쪽 반구)에서 본다 — 옆모습으로 문다.
 *  a = 사냥꾼 입 · b = 먹이(월드) · angle = 지금 카메라 각(수평, 0 = 앞에서). 돌려주는 angle 은 ±ANGLE_MAX 안 */
export const SHOT_ANGLE_MAX = 0.75;
export function huntShot(ax: number, ay: number, az: number, bx: number, by: number, bz: number, predLen: number, preyLen: number, angle: number) {
  const dx = bx - ax, dz = bz - az, sep = Math.hypot(dx, by - ay, dz), flat = Math.hypot(dx, dz);
  let a = angle;
  if (flat > 1e-3) {
    // 둘을 잇는 선에 수직인 두 방향 중 앞쪽(+z)을 고른다 — 뒤 유리 쪽에선 못 본다
    let px = -dz / flat, pz = dx / flat;
    if (pz < 0) { px = -px; pz = -pz; }
    a = Math.max(-SHOT_ANGLE_MAX, Math.min(SHOT_ANGLE_MAX, Math.atan2(px, pz)));
  }
  const dist = Math.max(3.2, Math.min(14, Math.max(predLen * 1.9 + preyLen, sep * 1.5 + predLen * 0.9)));
  return { x: (ax + bx) / 2, y: (ay + by) / 2, z: (az + bz) / 2, dist, angle: a };
}

/** 장면을 열기 전 모델(GLB)이 다 오기를 기다리는 상한(초) — 임시 모델에 턱을 달면 갈아 끼울 때 턱이 사라졌다 */
export const MEAL_WAIT_MAX = 5;
export const mealReady = (predReady: boolean, preyReady: boolean, waited: number) => (predReady && preyReady) || waited >= MEAL_WAIT_MAX;
/** 덮치는 방향의 위아래 상한(라디안, 약 20°) — 실제 포식어는 거의 수평으로 덮친다(옆에서 보는 사냥 카메라에 옆모습이 보이게).
 *  위아래 몫을 줄여 곱하기만 하면 먹이가 바로 밑일 때 길이를 맞추며 다시 수직이 됐다 — 각으로 묶는다 */
export const ATTACK_PITCH = 0.35;
/** 입 자리 — 몸 가운데에서 몸길이의 몇 배 앞(벌어진 입의 가운데). 예전엔 모두 0.46(코끝)이라 먹이 · 피가 입보다 앞에 떠 있었다.
 *  턱 경첩(jaw.hinge)이 머리 끝에서 뒤로 잰 입 크기라 그 절반쯤 뒤가 입 가운데다. 두족류는 몸 밑(팔 사이) */
export const mouthReach = (family: string) => { const p = huntOf(family); return p.style === "wrap" ? 0.08 : 0.5 - p.jaw.hinge * 0.45; };

/** 시선을 가리는 것 — 물고기는 구(x,y,z,r), 장식 · 바위는 바닥에서 top 까지 세운 기둥(top 이 있으면) */
export type Blocker = { x: number; y: number; z: number; r: number; top?: number };
/** 카메라(c)에서 장면(t)까지의 시선이 얼마나 가리나 — 겹친 깊이의 합(0 = 다 보인다). 장면 바로 앞 15% 는 빼고 잰다(장면 둘 곁은 가려도 괜찮다) */
export function blockedBy(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number, blockers: readonly Blocker[]): number {
  const vx = tx - cx, vy = ty - cy, vz = tz - cz, vv = vx * vx + vy * vy + vz * vz || 1, vh = vx * vx + vz * vz || 1;
  let sum = 0;
  for (const b of blockers) {
    if (b.top === undefined) {
      const s = Math.max(0, Math.min(0.85, ((b.x - cx) * vx + (b.y - cy) * vy + (b.z - cz) * vz) / vv));
      const d = Math.hypot(cx + vx * s - b.x, cy + vy * s - b.y, cz + vz * s - b.z);
      if (d < b.r) sum += (b.r - d) / b.r;
    } else {
      const s = Math.max(0, Math.min(0.85, ((b.x - cx) * vx + (b.z - cz) * vz) / vh));
      const d = Math.hypot(cx + vx * s - b.x, cz + vz * s - b.z), y = cy + vy * s;
      if (d < b.r && y >= b.y && y <= b.top) sum += (b.r - d) / b.r;
    }
  }
  return sum;
}
/** 가리지 않는 자리 고르기 — 옆(base) 둘레 다섯 각 × 올려보는 각 셋(0 · 0.35 · 0.7 라디안 위에서 내려다보기 — 모래 위 먹이 · 숨은 뱀장어는 바닥 장식 너머로) 중 가장 덜 가린 것.
 *  거리는 그대로 두고 위로 기울인다(위로만 올리면 1.3배 멀어져 수조 전체가 보였다).
 *  옆에서 멀수록 · 위로 갈수록 조금 손해. 지금 자리(prev)가 거의 같으면 그대로 둔다(카메라가 이리저리 튀지 않게). elev = 올려보는 각 */
export type ShotPick = { angle: number; elev: number };
export function clearShot(tx: number, ty: number, tz: number, dist: number, lift: number, base: number, prev: ShotPick | null, blockers: readonly Blocker[]): ShotPick {
  const lim = SHOT_ANGLE_MAX + 0.2;
  const score = (p: ShotPick) => { const c = Math.cos(p.elev); return blockedBy(tx + Math.sin(p.angle) * dist * c, ty + lift + Math.sin(p.elev) * dist, tz + Math.cos(p.angle) * dist * c, tx, ty, tz, blockers) + Math.abs(p.angle - base) * 0.15 + p.elev * 0.25; };
  let best: ShotPick = { angle: base, elev: 0 }, bs = Infinity;
  for (const elev of [0, 0.35, 0.7]) for (const d of [0, -0.35, 0.35, -0.7, 0.7]) {
    const p = { angle: Math.max(-lim, Math.min(lim, base + d)), elev }, sc = score(p);
    if (sc < bs - 1e-9) { bs = sc; best = p; }
  }
  // 넘어가는 문턱 0.6 — 곁을 지나는 물고기 하나(최대 1)에 바로 넘어가지 않는다
  if (prev !== null && score(prev) <= bs + 0.6) return prev;
  return best;
}
/** 사냥 장면이 끝났다(수조가 window 에 쏜다) — 잡아먹기 소식 카드가 장면 뒤에 뜨게 */
export const MEAL_END_EVENT = "ourdays:aqua-meal-end";
