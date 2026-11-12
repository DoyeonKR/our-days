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

/** 옆을 고른 상태 — 물고기마다 하나(faceSide 의 owner 로 잇는다). side 는 지금 보이는 쪽(±1) */
export type SideState = { side: number };
const SIDES = new WeakMap<object, SideState>();
/** 넘어가기 시작하는 문턱 · 넘어가는 띠 폭(시선과 수직인 성분 |p|, 시선 너머로 잰다) — 문턱 안의 흔들림은 쪽을 안 바꾸고,
 *  띠를 지나는 동안 옆모습이 시선 축을 거쳐 반대쪽으로 이어서 돈다(띠 끝에서 쪽을 확정한다 — 그 자리에서 두 식이 같은 방향이라 끊기지 않는다) */
export const SIDE_HOLD = 0.22, SIDE_BAND = 0.5;
const ease = (u: number) => u * u * (3 - 2 * u);
/** 몸 방향 d 의 수평 성분을 '돌린다' — 시선 v(정규화된 x · z)와 나란한 정도(cos)를 (1 − k)배로 줄이고 그만큼 옆으로 세운다.
 *  성분을 덜기만 하면 카메라를 똑바로 볼 때 옆 성분이 0 이라 그대로 정면이었다(디스커스가 선 하나로 보였다 — 2026-11-11). 길이 · 위아래는 그대로.
 *  2026-11-12 — 옆을 '지금 몸이 어느 쪽으로 기울었나'(p 의 부호)로 골라서, 몸이 시선 축을 지나는 한 프레임에 보이는 방향이 2·acos(1 − k)
 *  (보통 91° · 베타 139° · 두족류 157°) 튀었다 — 물고기마다 분에 1.7~5.8번, 화면의 느린 따라 돌기(초당 2.8)가 그걸 0.5~1초 동안 몸을 안 굽힌 채 빙글 도는 것으로 그렸다.
 *  owner(물고기마다 같은 객체)를 넘기면 쪽을 기억한다: 시선 너머로 SIDE_HOLD 까지는 원래 쪽을 지키고, 그 뒤 SIDE_BAND 동안 옆 성분을 원래 쪽 → 0 → 반대쪽으로
 *  이어서 옮긴다(가운데에서 실제 몸 방향에 가까운 시선 축을 지난다 — 진짜로 돌 때 지나가니 C 자로 굽는 것과 같이 보인다). 넘어가다 되돌아오면 그대로 되돌아온다.
 *  owner 가 없으면 옛 식 그대로(그때그때 p 의 부호) */
export function faceSide(d: { x: number; y: number; z: number }, v: { x: number; z: number }, k: number, owner?: object): void {
  if (k <= 0) return;
  const h = Math.hypot(d.x, d.z);
  if (h < 1e-6) return;
  const kk = Math.min(0.9, k);
  const a = (d.x * v.x + d.z * v.z) / h, p = (d.x * v.z - d.z * v.x) / h; // 시선 쪽 · 옆쪽(w = (v.z, −v.x))
  const a2 = a * (1 - kk), side = Math.sqrt(Math.max(0, 1 - a2 * a2));
  let s: number;
  if (!owner) s = p < 0 ? -1 : 1;
  else {
    let st = SIDES.get(owner);
    if (!st) { st = { side: p < 0 ? -1 : 1 }; SIDES.set(owner, st); }
    const over = -p * st.side - SIDE_HOLD; // 원래 쪽에서 시선 너머로 얼마나 넘어갔나
    if (over >= SIDE_BAND) { st.side = -st.side; s = st.side; }
    else s = over <= 0 ? st.side : st.side * (1 - 2 * ease(over / SIDE_BAND));
  }
  // 옆 성분을 s 배로 — |s| < 1 이면 길이가 줄어 다시 h 로 맞춘다(s = 0 이면 시선 축 방향)
  let x = a2 * v.x + s * side * v.z, z = a2 * v.z - s * side * v.x;
  const l = Math.hypot(x, z);
  if (l < 1e-9) { x = v.x * (a < 0 ? -1 : 1); z = v.z * (a < 0 ? -1 : 1); } else { x /= l; z /= l; }
  d.x = h * x;
  d.z = h * z;
}
/** 테스트 · 진단용 — owner 의 지금 쪽(없으면 undefined) */
export const sideStateOf = (owner: object): SideState | undefined => SIDES.get(owner);

/** 몸이 거의 곧게 위 · 아래를 보면 옆 방향(몸 방향 × 위)이 0 에 가까워 정규화가 흔들리고, 몸이 제멋대로 굴러 리본처럼 비틀렸다(문어가 바위를 오를 때).
 *  기울기를 tan 값 maxTan(기본 1.2 ≈ 50°)까지로 묶는다. 수평 성분이 거의 없으면 시선과 수직인 옆으로 눕힌다 */
export function limitPitch(d: { x: number; y: number; z: number }, v: { x: number; z: number }, maxTan = 1.2): void {
  let h = Math.hypot(d.x, d.z);
  if (h < 1e-3) { d.x = -v.z; d.z = v.x; h = 1; d.y = Math.sign(d.y || 1) * maxTan; }
  else if (Math.abs(d.y) > h * maxTan) d.y = Math.sign(d.y) * h * maxTan;
  const l = Math.hypot(d.x, d.y, d.z);
  d.x /= l; d.y /= l; d.z /= l;
}
