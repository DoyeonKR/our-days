// 씬 이펙트용 초소형 스프라이트 — 계절 입자 4종 + 하트.
//
// 왜 필요한가: 홈 씬의 떠다니는 입자와 하트가 **OS 컬러 이모지**였다. 이모지는 기기마다 다른
// 그림이 나오고(애플/삼성/구글이 전부 다르다), 픽셀 씬 안에서 혼자 벡터·그라데이션이라
// 그 하나 때문에 화면 전체의 톤이 깨진다. 8×8 도트로 직접 그린다.
//
// 8×8 인 이유: 화면에서 8~12px 로 떠다니는 장식이라 1배율(8px)이면 충분하고, 더 키우면
// 배경 위에서 시선을 뺏는다.

import { type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

const mk = (rows: string[], pal: Record<string, string>): Sprite => ({ w: 8, h: 8, pal, rows });

/** 봄 — 벚꽃잎 한 장. */
const PETAL = (() => {
  const R = ramp(PIXEL_PAL.rose);
  return mk(
    ["..oo....", ".oHpo...", "oHppPo..", "oppPPDo.", ".oPPDo..", "..oDo...", "........", "........"],
    { o: R.o, H: R.H, p: R.b, P: R.B, D: R.d },
  );
})();

/** 여름 — 반짝이는 빛 알갱이(십자 스파클). */
const SPARK = (() => {
  const G = ramp(PIXEL_PAL.gold);
  return mk(
    ["...y....", "...H....", ".y.H.y..", "..HHH...", "yHHYHHy.", "..HHH...", ".y.Y.y..", "...Y...."],
    { y: G.b, H: G.H, Y: G.B },
  );
})();

/** 가을 — 낙엽(잎맥 포함). */
const LEAF = (() => {
  const B = ramp(["#f5b26b", "#e0803a", "#a3521c"]);
  return mk(
    ["....oo..", "..ooHbo.", ".obHbbBo", "obHbdbBo", "obbdbBDo", ".obdBBDo", "..oDDo..", "...o...."],
    { o: B.o, H: B.H, b: B.b, B: B.B, d: B.d, D: B.D },
  );
})();

/** 겨울 — 눈송이(6방 대칭 근사). */
const SNOW = (() => {
  const W = ramp(PIXEL_PAL.white);
  return mk(
    ["...w....", ".w.w.w..", "..www...", "wwwWwww.", "..www...", ".w.w.w..", "...w....", "........"],
    { w: W.b, W: W.B },
  );
})();

export const FALLER_SPRITE = {
  spring: PETAL,
  summer: SPARK,
  autumn: LEAF,
  winter: SNOW,
} as const;

/** 하트 — 커플 이름 사이·D-day 문구에 쓰는 8×8 도트. */
export const PIXEL_HEART: Sprite = (() => {
  const R = ramp(PIXEL_PAL.rose);
  return mk(
    [".oo..oo.", "oHHroRRo", "oHrrrRDo", "orrrrRDo", ".oRrRDo.", "..oRDo..", "...oo...", "........"],
    { o: R.o, H: R.H, r: R.b, R: R.B, D: R.d },
  );
})();

export const ALL_FX_SPRITES: Record<string, Sprite> = {
  petal: PETAL,
  spark: SPARK,
  leaf: LEAF,
  snow: SNOW,
  heart: PIXEL_HEART,
};
