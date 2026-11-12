/** 옆모습 보이기(2026-11-11) [사용자: "수조와 모델링 특히 모델 들을 너가 퀄리티 올려볼 수 없어 ?"]
 *  모델은 그림의 윤곽을 따라 지은 몸이라 옆에서는 그림 그대로지만, 머리 · 꼬리 쪽에서 보면 얇은 판이다. 문어 · 오징어 팔과 베타의 큰 지느러미는
 *  비스듬히 보면 구겨진 리본처럼 보였다. 그래서 몸이 향하는 방향에서 '카메라를 향한 성분'을 조금 덜어 옆모습이 카메라 쪽을 보게 한다
 *  (수조 게임에서 흔히 쓰는 눈속임 — 길은 그대로, 몸만 덜 돌아선다). 판 같은 종은 많이, 나머지는 살짝. 해파리 · 불가사리 · 바닥에 눕는 종은 안 한다. */
export const SIDE_ON: Readonly<Record<string, number>> = {
  octopus: 0.8, squid: 0.8, giant_squid: 0.8, kraken: 0.8,
  betta: 0.65, angel: 0.55, discus: 0.5, manta: 0.15, ray: 0.1,
  jellyfish: 0, starfish: 0, flounder: 0, sea_turtle: 0.2,
};
export const SIDE_ON_DEFAULT = 0.3;
export const sideOnOf = (family: string) => SIDE_ON[family] ?? SIDE_ON_DEFAULT;
// 프레임마다 물고기마다 불린다 — Math.hypot 대신 제곱근(쓰레기 · 시간이 덜 든다, habits.hyp2 와 같은 이유)
const hyp2 = (a: number, b: number) => Math.sqrt(a * a + b * b);
const hyp3 = (a: number, b: number, c: number) => Math.sqrt(a * a + b * b + c * c);

/** 옆을 고른 상태 — 물고기마다 하나(faceSide 의 owner 로 잇는다). side 는 지금 보이는 쪽(±1), turn 은 반대쪽으로 넘어간 정도(0 = 안 넘어감 · 0 ~ 1 넘어가는 중) */
export type SideState = { side: number; turn: number };
const SIDES = new WeakMap<object, SideState>();
/** 넘어가기 시작하는 문턱(시선과 수직인 성분 |p|, 시선 너머로 잰다) — 문턱 안의 흔들림은 쪽을 안 바꾼다 */
export const SIDE_HOLD = 0.22;
/** 한 번 넘어가기 시작하면 이 시간(초)에 끝낸다 — 프레임 빠르기와 상관없다 */
export const SIDE_SWITCH_S = 0.3;
const ease = (u: number) => u * u * (3 - 2 * u);
/** 몸 방향 d 의 수평 성분을 '돌린다' — 시선 v(정규화된 x · z)와 나란한 정도(cos)를 (1 − k)배로 줄이고 그만큼 옆으로 세운다.
 *  성분을 덜기만 하면 카메라를 똑바로 볼 때 옆 성분이 0 이라 그대로 정면이었다(디스커스가 선 하나로 보였다 — 2026-11-11). 길이 · 위아래는 그대로.
 *  2026-11-12 — 옆을 '지금 몸이 어느 쪽으로 기울었나'(p 의 부호)로 골라서, 몸이 시선 축을 지나는 한 프레임에 보이는 방향이 2·acos(1 − k)
 *  (보통 91° · 베타 139° · 두족류 157°) 튀었다. owner(물고기마다 같은 객체)를 넘기면 쪽을 기억한다: 시선 너머로 SIDE_HOLD 까지는 원래 쪽을 지키고,
 *  넘어서면 옆 성분을 원래 쪽 → 0 → 반대쪽으로 이어서 옮긴다(가운데에서 시선 축을 지난다 — 진짜로 돌 때 지나가니 C 자로 굽는 것과 같이 보인다).
 *  같은 날 다시 — 넘어가는 정도를 '시선 너머로 얼마나 넘어갔나'(띠 0.5)로 정했더니, 카메라 쪽으로 곧장 헤엄치는 동안(p ≈ 0) 띠 가운데에 멈춰
 *  머리 · 꼬리 쪽 얇은 판(정면)을 0.5 ~ 1.4초 보였다. 이제 한 번 문턱을 넘으면 SIDE_SWITCH_S(0.3초)에 시간으로 끝낸다(dt 는 이번 프레임 초 —
 *  안 주면 1/60, 0 이면 멈춘 그리기라 안 넘어간다). 넘어가는 도중 몸이 원래 쪽으로 문턱만큼 분명히 돌아오면 같은 빠르기로 되돌아간다.
 *  owner 가 없으면 옛 식 그대로(그때그때 p 의 부호) */
export function faceSide(d: { x: number; y: number; z: number }, v: { x: number; z: number }, k: number, owner?: object, dt = 1 / 60): void {
  if (k <= 0) return;
  const h = hyp2(d.x, d.z);
  if (h < 1e-6) return;
  const kk = Math.min(0.9, k);
  const a = (d.x * v.x + d.z * v.z) / h, p = (d.x * v.z - d.z * v.x) / h; // 시선 쪽 · 옆쪽(w = (v.z, −v.x))
  const a2 = a * (1 - kk), side = Math.sqrt(Math.max(0, 1 - a2 * a2));
  let s: number;
  if (!owner) s = p < 0 ? -1 : 1;
  else {
    let st = SIDES.get(owner);
    if (!st) { st = { side: p < 0 ? -1 : 1, turn: 0 }; SIDES.set(owner, st); }
    const over = -p * st.side - SIDE_HOLD; // 원래 쪽에서 시선 너머로 얼마나 넘어갔나
    if (st.turn > 0 || over > 0) {
      // 넘어가는 중 — 원래 쪽으로 문턱만큼 돌아왔으면(p·side > SIDE_HOLD) 되돌리고, 아니면 끝까지 간다(한 프레임 최대 0.1초 몫)
      const step = Math.min(0.1, Math.max(0, dt)) / SIDE_SWITCH_S;
      st.turn += p * st.side > SIDE_HOLD ? -step : step;
      if (st.turn >= 1) { st.side = -st.side; st.turn = 0; s = st.side; }
      else if (st.turn <= 0) { st.turn = 0; s = st.side; }
      else s = st.side * (1 - 2 * ease(st.turn)); // 각의 몫(1 → −1)
    } else s = st.side;
  }
  // 보이는 방향 — 시선 축(몸이 가는 쪽의 시선 성분 부호)에서 옆으로 기운 각 ψ. s = ±1 이면 옆 성분 ±side 그대로, 넘어가는 동안은 각을 고르게 옮긴다
  // (옆 성분을 곱으로 줄이면 시선 축 근처에서 한 프레임에 0.4 rad 넘게 돌았다)
  let ca = a2, sa = s * side; // 넘어가지 않을 땐(s = ±1) 그대로
  if (s !== 1 && s !== -1) { const psi = Math.atan2(side, Math.abs(a2)) * s; ca = (a2 < 0 ? -1 : 1) * Math.cos(psi); sa = Math.sin(psi); }
  d.x = h * (ca * v.x + sa * v.z);
  d.z = h * (ca * v.z - sa * v.x);
}
/** 테스트 · 진단용 — owner 의 지금 쪽(없으면 undefined) */
export const sideStateOf = (owner: object): SideState | undefined => SIDES.get(owner);

/** 몸이 거의 곧게 위 · 아래를 보면 옆 방향(몸 방향 × 위)이 0 에 가까워 정규화가 흔들리고, 몸이 제멋대로 굴러 리본처럼 비틀렸다(문어가 바위를 오를 때).
 *  기울기를 tan 값 maxTan(기본 1.2 ≈ 50°)까지로 묶는다. 수평 성분이 거의 없으면 시선과 수직인 옆으로 눕힌다 */
export function limitPitch(d: { x: number; y: number; z: number }, v: { x: number; z: number }, maxTan = 1.2): void {
  let h = hyp2(d.x, d.z);
  if (h < 1e-3) { d.x = -v.z; d.z = v.x; h = 1; d.y = Math.sign(d.y || 1) * maxTan; }
  else if (Math.abs(d.y) > h * maxTan) d.y = Math.sign(d.y) * h * maxTan;
  const l = hyp3(d.x, d.y, d.z);
  d.x /= l; d.y /= l; d.z /= l;
}
