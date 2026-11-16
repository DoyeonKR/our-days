/** 수조 단계별 볼거리(2026-11-11) — 화면(Aquarium3D)도 읽으므로 three 를 부르지 않는 작은 파일에 둔다.
 *  7~9 대수족관은 점점 깊어지고(정어리 떼 8 · 고래 9), 터널은 10단계(해저 터널 수족관), 돔은 11단계(심연 돔 궁전 — 가장 높은 단계) */
export const SHOAL_TIER = 8, WHALE_TIER = 9, TUNNEL_TIER = 10, DOME_TIER = 11;

/** 수조 크기(2026-11-14) [사용자: "수조가 너무 작다 업그레이드 하면 드라마틱하게 넓어져야함"] — 예전엔 단계가 올라도 가로는 그대로(넓히기 1 ~ 1.5배만)
 *  · 높이 10%씩 · 깊이는 7단계부터라, 6단계 수조가 1단계와 거의 같은 방이었다. 이제 단계마다 수조 자체가 커진다 — 가로 1 → 2.5배(6단계) → 2.9배(9단계 위),
 *  앞뒤 · 위아래도 그 일부만큼(바위가 너무 납작하거나 길쭉해지지 않게 세 축이 같이 큰다). 물고기 · 장식은 그대로라 방이 넓어진 만큼 보인다.
 *  저장 · 경제는 안 바뀐다(그리기 공간만). 세로 화면에 다 넣으면 물고기가 점이 되니 카메라는 일부만 담고 옆으로 끌어 둘러본다(scene.ts) */
export const TANK_SIZE = [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.6, 2.7, 2.8, 2.9, 2.9] as const;
export const tankSize = (tier: number) => TANK_SIZE[Math.max(1, Math.min(TANK_SIZE.length, Math.round(tier) || 1)) - 1];
/** 단계 크기를 세 축으로 — x 는 그대로, 높이는 30%, 앞뒤는 60% 만큼(앞뒤는 대수족관의 깊이 배율이 더 크면 그것) */
export const tankAxes = (tier: number, tallBase: number, deepBase: number) => {
  const s = tankSize(tier);
  return { x: s, tall: tallBase * (1 + (s - 1) * 0.3), deep: Math.max(1 + (s - 1) * 0.6, deepBase) };
};
