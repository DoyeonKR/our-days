/** 쫓고 달아나기(2026-11-11) [사용자: "물고기 움직임 AI 도 좀 더 개선하고 물고기가 물고기를 잡아먹는 연출까지"]
 *  사냥꾼(lib/predation 의 PREDATORS) 곁의 작은 물고기는 달아나고, 사냥꾼은 가까운 먹잇감 쪽으로 천천히 다가간다.
 *  길(course)은 그대로 두고 그 위에 '비켜 가기' 보정만 더한다 — 보정은 천천히 따라가서 떨리지 않는다(겹침 밀기 separate 와 같은 방식).
 *  화면 전용 — 저장 · 판정과 무관. three 없음 · 할당 없음. */

/** 눈으로 보는 먹잇감 크기 — 화면 몸길이 비율(정산의 PREY_RATIO 는 cm, 화면은 세제곱근으로 누른 길이라 더 너그럽다) */
export const FLEE_RATIO = 0.62;
const MAX_OFF = 0.9;

/** positions(n×3)에 off(n×3, 프레임마다 이어진다)를 더한다. pred[i] = 1 이면 사냥꾼. dt 0 이면 보정만 다시 더한다 */
export function huntPass(positions: Float32Array, lengths: Float32Array, pred: Uint8Array, off: Float32Array, n: number, dt: number, pinned?: Float32Array): void {
  const k = dt > 0 ? Math.min(1, dt * 1.8) : 0;
  for (let i = 0; i < n; i++) {
    // 모래에 붙어 사는 물고기(광어 · 불가사리 · 쉬는 거북)는 쫓지도 달아나지도 않는다 — 바닥에서 떠오르면 안 된다
    if (pinned && pinned[i] > 0.5) { off[i * 3] = off[i * 3 + 1] = off[i * 3 + 2] = 0; continue; }
    const xi = positions[i * 3], yi = positions[i * 3 + 1], zi = positions[i * 3 + 2], Li = lengths[i];
    let tx = 0, ty = 0, tz = 0;
    if (pred[i]) {
      // 가장 가까운 먹잇감 쪽으로 — 몸길이의 몇 배 안에서만, 조금씩
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i || pred[j] || lengths[j] > Li * FLEE_RATIO) continue;
        const d = Math.hypot(positions[j * 3] - xi, positions[j * 3 + 1] - yi, positions[j * 3 + 2] - zi);
        if (d < bd) { bd = d; best = j; }
      }
      const R = 2.5 + Li * 2;
      if (best >= 0 && bd < R && bd > 1e-3) {
        const s = Math.min(0.45, (1 - bd / R) * 0.8) / bd;
        tx = (positions[best * 3] - xi) * s; ty = (positions[best * 3 + 1] - yi) * s * 0.5; tz = (positions[best * 3 + 2] - zi) * s;
      }
    } else {
      // 나를 먹을 수 있는 사냥꾼에게서 멀어진다 — 가까울수록 세게
      for (let j = 0; j < n; j++) {
        if (j === i || !pred[j] || Li > lengths[j] * FLEE_RATIO) continue;
        const dx = xi - positions[j * 3], dy = yi - positions[j * 3 + 1], dz = zi - positions[j * 3 + 2];
        const d = Math.hypot(dx, dy, dz), R = 1.4 + lengths[j] * 2.4;
        if (d >= R || d < 1e-3) continue;
        const s = ((1 - d / R) * (0.7 + lengths[j] * 0.4)) / d;
        tx += dx * s; ty += dy * s * 0.6; tz += dz * s;
      }
    }
    const tl = Math.hypot(tx, ty, tz);
    if (tl > MAX_OFF) { tx *= MAX_OFF / tl; ty *= MAX_OFF / tl; tz *= MAX_OFF / tl; }
    off[i * 3] += (tx - off[i * 3]) * k;
    off[i * 3 + 1] += (ty - off[i * 3 + 1]) * k;
    off[i * 3 + 2] += (tz - off[i * 3 + 2]) * k;
    positions[i * 3] = xi + off[i * 3];
    positions[i * 3 + 1] = yi + off[i * 3 + 1];
    positions[i * 3 + 2] = zi + off[i * 3 + 2];
  }
}

/** 사냥 장면의 시간표(초) — 쫓기 → 물고 흔들기(세 번 뜯는다) → 놓으면 뒤집혀 가라앉기 → 끝
 *  [사용자: "더 잔인하게 … 잡아먹을때 입으로 뜯고 흔들면서 꼬리도 같이 흔들리고"] — 물고 있는 동안 사냥꾼은 머리를 좌우로 세차게 흔들고,
 *  입에 물린 먹이는 반대로 휘둘리며 꼬리를 퍼덕인다. 뜯을 때마다 피가 터지고 살점이 흩어지며 먹이가 짧아진다 */
export const MEAL_CHASE = 1.4, MEAL_MAUL = 2.4, MEAL_SINK = 2.6, MEAL_END = MEAL_CHASE + MEAL_MAUL + MEAL_SINK;
/** 뜯는 때(물기 시작부터 초) */
export const MEAL_BITES = [0, 0.8, 1.6] as const;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 사냥 장면의 한 순간 — t 는 시작부터 흐른 초.
 *  chase(0~1) 사냥꾼이 먹이에 붙는 정도 · held 물고 있나 · shake(−1~1) 머리 흔들기 · bites 지금까지 뜯은 수 · sink 놓은 뒤 가라앉은 정도 · back 사냥꾼이 제 길로 돌아간 정도 */
export function mealPose(t: number) {
  const chase = ease(t / MEAL_CHASE);
  const m = t - MEAL_CHASE, held = m >= 0 && m < MEAL_MAUL;
  // 흔들기 — 초당 4.5번, 뜯는 순간마다 세게 · 끝 무렵 잦아든다
  let shake = 0;
  if (held) {
    const near = Math.min(...MEAL_BITES.map((b) => Math.abs(m - b)));
    shake = Math.sin(m * Math.PI * 9) * (0.55 + 0.45 * Math.max(0, 1 - near * 3)) * (1 - ease((m - MEAL_MAUL + 0.4) / 0.4));
  }
  const bites = m < 0 ? 0 : MEAL_BITES.filter((b) => m >= b).length;
  const r = t - MEAL_CHASE - MEAL_MAUL;
  const sink = r > 0 ? ease(r / MEAL_SINK) : 0;
  const back = r > 0 ? ease(r / 1.4) : 0;
  // 턱 — 다가가며 크게 벌리고, 뜯는 순간 콱 닫고, 물고 있는 동안 우물우물 씹는다(다음 뜯기 앞에서 다시 크게)
  let jaw = 0;
  if (m < 0) jaw = ease((t - (MEAL_CHASE - 0.6)) / 0.5);
  else if (held) {
    jaw = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(m * 15));
    for (const b of MEAL_BITES) {
      if (m >= b - 0.28 && m < b) jaw = Math.max(jaw, ease((m - (b - 0.28)) / 0.2));
      if (m >= b && m < b + 0.09) jaw = 0;
    }
  } else jaw = 0.3 * (1 - back);
  return { chase, held, shake, bites, bit: m >= 0, sink, back, jaw, done: t >= MEAL_END };
}
