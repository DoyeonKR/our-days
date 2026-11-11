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

/** 몸 방향 d 의 수평 성분을 '돌린다' — 시선 v(정규화된 x · z)와 나란한 정도(cos)를 (1 − k)배로 줄이고 그만큼 옆으로 세운다.
 *  성분을 덜기만 하면 카메라를 똑바로 볼 때 옆 성분이 0 이라 그대로 정면이었다(디스커스가 선 하나로 보였다 — 2026-11-11). 길이 · 위아래는 그대로 */
export function faceSide(d: { x: number; y: number; z: number }, v: { x: number; z: number }, k: number): void {
  if (k <= 0) return;
  const h = Math.hypot(d.x, d.z);
  if (h < 1e-6) return;
  const kk = Math.min(0.9, k);
  const a = (d.x * v.x + d.z * v.z) / h, p = (d.x * v.z - d.z * v.x) / h; // 시선 쪽 · 옆쪽(w = (v.z, −v.x))
  const a2 = a * (1 - kk), p2 = (p < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - a2 * a2));
  d.x = h * (a2 * v.x + p2 * v.z);
  d.z = h * (a2 * v.z - p2 * v.x);
}

/** 몸이 거의 곧게 위 · 아래를 보면 옆 방향(몸 방향 × 위)이 0 에 가까워 정규화가 흔들리고, 몸이 제멋대로 굴러 리본처럼 비틀렸다(문어가 바위를 오를 때).
 *  기울기를 tan 값 maxTan(기본 1.2 ≈ 50°)까지로 묶는다. 수평 성분이 거의 없으면 시선과 수직인 옆으로 눕힌다 */
export function limitPitch(d: { x: number; y: number; z: number }, v: { x: number; z: number }, maxTan = 1.2): void {
  let h = Math.hypot(d.x, d.z);
  if (h < 1e-3) { d.x = -v.z; d.z = v.x; h = 1; d.y = Math.sign(d.y || 1) * maxTan; }
  else if (Math.abs(d.y) > h * maxTan) d.y = Math.sign(d.y) * h * maxTan;
  const l = Math.hypot(d.x, d.y, d.z);
  d.x /= l; d.y /= l; d.z /= l;
}
