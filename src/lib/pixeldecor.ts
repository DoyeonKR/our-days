// 데코 22종 픽셀 스프라이트 — 24×24.
//
// 세트별 색 톤을 통일해 섬에 놓았을 때 세트가 눈으로 묶여 보이게 한다(SVG 데코의 규칙 계승):
//   봄 정원=꽃/잎 · 아늑한 집=나무/크림 · 바다=물/모래 · 커플=로즈/골드 · 천상=밤/바이올렛.
// 등급이 높을수록 반짝임(s)·금색(y) 같은 장식을 더한다.
//
// ⚠ 저작 규약은 pixelcrop 과 동일 — 행은 `r([x,"문자열"])` 런으로만 적고, mk() 가 **바닥 정렬**
//    한다. 지면에 놓이는 오브젝트라 바닥이 안 맞으면 섬에 띄엄띄엄 떠 보인다.

import { type Palette, type Sprite, ramp } from "./pixel";
import { PIXEL_PAL } from "./pixelart";

const W = 24;

function r(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`decor row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

const BLANK = r();
const isBlank = (s: string) => !/[^.]/.test(s);

/** 행 배열 → 24행 스프라이트(바닥 정렬 — 빈 행은 위에 채운다). */
function mk(rows: string[], pal: Palette): Sprite {
  const body = [...rows];
  while (body.length && isBlank(body[body.length - 1])) body.pop();
  if (body.length > 24) throw new Error(`decor sprite: ${body.length}행 (24 초과)`);
  return { w: W, h: 24, pal, rows: [...Array<string>(24 - body.length).fill(BLANK), ...body] };
}

/** 데코 팔레트 — 주색(m 계열) + 보조색(n 계열) + 금/반짝. */
function dpal(main: readonly string[], sub: readonly string[]): Palette {
  const M = ramp(main);
  const N = ramp(sub);
  return {
    o: M.o, H: M.H, m: M.b, M: M.B, d: M.d, D: M.D,
    p: N.o, h: N.H, n: N.b, N: N.B, k: N.d, K: N.D,
    y: PIXEL_PAL.gold[1], Y: PIXEL_PAL.gold[2], s: "#fff3b0", w: "#fffdf7",
  };
}

/* ── 봄 정원 ─────────────────────────────────────────────────── */

const TULIP = [
  r([10, "oo"]),
  r([9, "oHmo"]),
  r([8, "oHmmMo"]),
  r([8, "omMmMDo"]),
  r([8, "omMMMDo"]),
  r([9, "oMMDo"]),
  r([10, "onN"]),
  r([7, "phn"], [11, "nN"], [14, "hp"]),
  r([6, "phnn"], [11, "nN"], [13, "nnkp"]),
  r([7, "pkN"], [11, "nN"], [13, "Nkp"]),
  r([10, "onN"]),
  r([10, "onN"]),
  r([9, "opnNp"]),
];

const ROSE = [
  r([10, "oo"]),
  r([8, "oHmmo"]),
  r([7, "oHmoMMo"]),
  r([7, "omoHmMDo"]),
  r([7, "omMmoMDo"]),
  r([7, "omMMMMDo"]),
  r([8, "oMMDDo"]),
  r([10, "onN"]),
  r([7, "phnn"], [12, "nkp"]),
  r([8, "pkN"], [12, "Nkp"]),
  r([10, "onN"]),
  r([10, "onN"]),
  r([9, "opnNp"]),
];

const SUNFLOWER = [
  r([9, "osso"]),
  r([7, "osmmmso"]),
  r([6, "osmHmmmso"]),
  r([5, "osmmyYmmMso"]),
  r([5, "osmmyyYmMso"]),
  r([5, "osmMYYYMMso"]),
  r([6, "osMMMMMso"]),
  r([8, "osMMso"]),
  r([10, "onN"]),
  r([7, "phnn"], [12, "nkp"]),
  r([10, "onN"]),
  r([10, "onN"]),
  r([10, "onN"]),
  r([9, "opnNp"]),
];

const BLOSSOM = [
  r([7, "oo"], [13, "oo"]),
  r([6, "oHmo"], [12, "omMo"]),
  r([6, "omyo"], [12, "oyMo"]),
  r([7, "oo"], [13, "oo"]),
  r([10, "oHmo"]),
  r([10, "omyo"]),
  r([10, "oMMo"]),
  r([8, "phn"], [11, "nN"], [14, "hp"]),
  r([11, "nN"]),
  r([11, "nN"]),
  r([9, "opnNp"]),
];

// 더듬이 → 몸통(k) 을 세로로 관통시킨다. 몸통 없이 날개만 그리면 24px 에서 '보라 얼룩 4개'로
// 읽힌다(1차 시안의 실패 지점).
const BUTTERFLY = [
  r([8, "p"], [15, "p"]),
  r([9, "p"], [14, "p"]),
  r([10, "p"], [13, "p"]),
  r([5, "oo"], [11, "kk"], [17, "oo"]),
  r([4, "oHmo"], [11, "kk"], [16, "omDo"]),
  r([3, "oHmmmo"], [11, "Kk"], [14, "ommMDo"]),
  r([3, "oHmymmo"], [11, "kk"], [13, "ommymMDo"]),
  r([3, "ommmmmo"], [11, "kk"], [13, "ommmmMDo"]),
  r([4, "ommmo"], [11, "Kk"], [14, "ommMo"]),
  r([5, "ooo"], [11, "kk"], [15, "ooo"]),
  r([4, "oHmmo"], [11, "kk"], [14, "ommDo"]),
  r([3, "oHmmmmo"], [11, "Kk"], [13, "ommmMDo"]),
  r([3, "ommmmmo"], [11, "kk"], [13, "ommmMDo"]),
  r([4, "ommmo"], [11, "kk"], [14, "omMo"]),
  r([5, "ooo"], [11, "KK"], [15, "ooo"]),
  r([11, "oo"]),
];

/* ── 아늑한 집 ───────────────────────────────────────────────── */

const SOFA = [
  r([3, "oooo"], [16, "oooo"]),
  r([2, "oHmmMo"], [15, "oMMMDo"]),
  r([2, "omHmMo"], [15, "oMMMDo"]),
  r([2, "omMMo"], [7, "oooooooo"], [15, "oMMDo"]),
  r([2, "omMMo"], [6, "oHmmmmMMo"], [15, "oMMDo"]),
  r([2, "omMMo"], [6, "omHmmmMDo"], [15, "oMMDo"]),
  r([1, "oHmmmmoommmmmmMMoMMMDo"]),
  r([1, "oHmmmmmmmmmmmmmMMMMMDo"]),
  r([1, "ommmmmmmmmmmmmMMMMMMDo"]),
  r([1, "omMMMMMMMMMMMMMMMMDDDo"]),
  r([1, "ooooooooooooooooooooo"]),
  r([2, "oKo"], [18, "oKo"]),
  r([2, "oKo"], [18, "oKo"]),
];

const CHAIR = [
  r([6, "oooooo"]),
  r([5, "oHmmmMo"]),
  r([5, "omHmmMo"]),
  r([5, "ommmMDo"]),
  r([5, "ommmMDo"]),
  r([5, "oMMMDDo"]),
  r([4, "oHmmmmMDo"]),
  r([4, "ommmmmMDo"]),
  r([4, "oMMMMMDDo"]),
  r([4, "oooooooo"]),
  r([5, "oKo"], [10, "oKo"]),
  r([5, "oKo"], [10, "oKo"]),
  r([5, "oKo"], [10, "oKo"]),
];

const CANDLE = [
  r([11, "y"]),
  r([10, "oyo"]),
  r([10, "ysY"]),
  r([10, "ysY"]),
  r([10, "oYo"]),
  r([11, "o"]),
  r([9, "oHmmo"]),
  r([9, "omHmo"]),
  r([9, "ommMo"]),
  r([9, "ommMo"]),
  r([9, "oMMDo"]),
  r([7, "ohnnnnNo"]),
  r([7, "onnnnNKo"]),
  r([7, "oooooooo"]),
];

const FRAME = [
  r([4, "oooooooooooooo"]),
  r([4, "ohnnnnnnnnnnko"]),
  r([4, "onoooooooooNko"]),
  r([4, "onoHmmmmmMoNko"]),
  r([4, "onommHmmmMMoNo"]),
  r([4, "onommmsmMMMoNo"]),
  r([4, "onomMMMMMMDoNo"]),
  r([4, "onoMMMMMMDDoNo"]),
  r([4, "onooooooooooNo"]),
  r([4, "oNNNNNNNNNNNKo"]),
  r([4, "oooooooooooooo"]),
];

const BOOKS = [
  r([5, "oo"], [9, "oo"], [13, "ooo"]),
  r([5, "omo"], [9, "ono"], [13, "oyo"]),
  r([4, "oHmMo"], [8, "ohnNo"], [12, "oyYo"]),
  r([4, "ommMo"], [8, "onnNo"], [12, "oyYo"]),
  r([4, "ommMo"], [8, "onnNo"], [12, "oyYo"]),
  r([4, "ommMo"], [8, "onnNo"], [12, "oyYo"]),
  r([4, "oMMDo"], [8, "oNNKo"], [12, "oYYo"]),
  r([3, "ohnnnnnnnnnnnNo"]),
  r([3, "onnnnnnnnnnnNKo"]),
  r([3, "ooooooooooooooo"]),
];

/* ── 바다 ────────────────────────────────────────────────────── */

const UMBRELLA = [
  r([11, "oo"]),
  r([7, "ooommoooo"]),
  r([5, "oHmmoMMoDDo"]),
  r([3, "oHmmmmoMMMoDDDo"]),
  r([2, "oHmmmmmmoMMMMoDDDo"]),
  r([2, "ooooooooooooooooo"]),
  r([11, "pn"]),
  r([11, "pn"]),
  r([11, "pn"]),
  r([11, "pn"]),
  r([11, "pn"]),
  r([9, "okKNKko"]),
];

const SHELL = [
  r([10, "oo"]),
  r([8, "oHmmo"]),
  r([6, "oHmomomMo"]),
  r([5, "oHmmomomMMo"]),
  r([4, "oHmmmomomMMDo"]),
  r([4, "ommmmomomMMDo"]),
  r([4, "ommmmomomMMDo"]),
  r([4, "oMMMMoMoMMDDo"]),
  r([5, "oooooooooo"]),
];

const CRAB = [
  r([4, "oo"], [17, "oo"]),
  r([3, "omo"], [16, "oMo"]),
  r([3, "omo"], [10, "oo"], [16, "oMo"]),
  r([3, "omo"], [9, "owo"], [12, "owo"], [16, "oMo"]),
  r([3, "ommoooooooooooMMo"]),
  r([3, "ommoHmmwmmwmmMMMo"]),
  r([4, "ooommmmmmmmmMMMoo"]),
  r([4, "ooommmmmmmmmMMMoo"]),
  r([5, "ooMMMMMMMMMDDoo"]),
  r([5, "oooooooooooo"]),
  r([5, "oKo"], [9, "oKo"], [13, "oKo"]),
];

const WAVE = [
  r([13, "ss"]),
  r([8, "s"], [12, "oso"], [18, "s"]),
  r([7, "oo"], [11, "oHmo"], [17, "oo"]),
  r([6, "oHmo"], [10, "oHmmo"], [16, "oHmo"]),
  r([5, "oHmmo"], [9, "oHmmMo"], [15, "oHmmo"]),
  r([4, "oHmmmoommmMMoommmMo"]),
  r([3, "oHmmmmmmmmmMMMmmmMMDo"]),
  r([2, "oHmmmmmmmmmmMMMmmMMMDo"]),
  r([1, "oHmmmmmmmmmmmMMMMMMMMDo"]),
  r([1, "ommmmmmmmmmmmmMMMMMMMDo"]),
  r([1, "oMMMMMMMMMMMMMMMMMDDDDo"]),
  r([1, "oooooooooooooooooooooo"]),
];

/* ── 커플 코너 ───────────────────────────────────────────────── */

const HEARTS = [
  r([4, "oo"], [8, "oo"]),
  r([3, "oHmoMDo"]),
  r([3, "oHmmMDo"]),
  r([4, "oMmMDo"]),
  r([5, "oMDo"], [13, "oo"], [18, "oo"]),
  r([6, "oo"], [12, "oHmmoMMDo"]),
  r([12, "oHmmmMMDo"]),
  r([13, "oHmmMMDo"]),
  r([14, "oMmMDo"]),
  r([15, "oMDo"]),
  r([16, "oo"]),
];

const CHEERS = [
  r([4, "oooo"], [15, "oooo"]),
  r([4, "onmmo"], [14, "onmMo"]),
  r([4, "onmmo"], [14, "onmMo"]),
  r([4, "onMMo"], [14, "onMDo"]),
  r([5, "oMMo"], [15, "oMDo"]),
  r([5, "onno"], [15, "onNo"]),
  r([6, "onno"], [14, "onNo"]),
  r([6, "onno"], [14, "onNo"]),
  r([5, "onnno"], [13, "onNNo"]),
  r([4, "oNNNNo"], [13, "oNNNNo"]),
  r([4, "oooooo"], [13, "oooooo"]),
];

const FERRIS = [
  r([10, "osso"]),
  r([7, "ooommmooo"]),
  r([5, "oHmoyoooyoMo"]),
  r([4, "oHmo"], [9, "oyoyo"], [16, "oMDo"]),
  r([3, "oymo"], [9, "oyyyo"], [16, "oMyo"]),
  r([3, "oomo"], [8, "oyoyoyo"], [16, "oMoo"]),
  r([3, "oymo"], [9, "oyyyo"], [16, "oMyo"]),
  r([4, "oHmo"], [9, "oyoyo"], [16, "oMDo"]),
  r([5, "oMmoyoooyoMDo"]),
  r([7, "oooMMMooo"]),
  r([9, "opnNp"]),
  r([8, "onnNNKo"]),
  r([6, "oKKKKKKKKo"]),
];

const RING = [
  r([11, "ss"]),
  r([10, "osso"]),
  r([9, "oHnNo"]),
  r([9, "onsNo"]),
  r([10, "oyo"]),
  r([7, "ooyYYyoo"]),
  r([5, "oyYo"], [13, "oYyo"]),
  r([4, "oyYo"], [15, "oYyo"]),
  r([4, "oyYo"], [15, "oYyo"]),
  r([5, "oyYo"], [13, "oYyo"]),
  r([6, "ooyYYyoo"]),
  r([8, "oooooo"]),
];

/* ── 천상 ────────────────────────────────────────────────────── */

const MOON = [
  r([9, "oooo"]),
  r([7, "ooHmmMo"]),
  r([6, "oHmmmmMo"], [16, "s"]),
  r([5, "oHmmoooo"], [15, "ss"]),
  r([5, "oHmmo"]),
  r([5, "ommmo"], [17, "s"]),
  r([5, "ommMo"], [16, "sss"]),
  r([5, "oMMDo"], [17, "s"]),
  r([6, "oMMDoooo"]),
  r([7, "ooMMDDo"]),
  r([9, "oooo"]),
];

const STARS = [
  r([11, "s"]),
  r([6, "s"], [11, "y"], [17, "s"]),
  r([5, "so"], [10, "oyo"], [16, "os"]),
  r([4, "oyo"], [8, "ooyYyoo"], [15, "oyo"]),
  r([4, "oYo"], [7, "oyYYYYyo"], [15, "oYo"]),
  r([5, "o"], [8, "oYYYYo"], [16, "o"]),
  r([9, "oyYYyo"]),
  r([8, "oyYooYyo"]),
  r([7, "oyYo"], [14, "oYyo"]),
  r([7, "ooo"], [15, "ooo"]),
];

const COMET = [
  r([15, "oyo"]),
  r([13, "ooyYYyo"]),
  r([9, "s"], [12, "oyYYYYo"]),
  r([6, "so"], [11, "oyYYYYo"]),
  r([3, "sody"], [10, "oyYYYo"]),
  r([2, "sodyy"], [10, "oYYYo"]),
  r([1, "sodyys"], [10, "ooo"]),
  r([2, "soddy"]),
  r([4, "sod"]),
  r([7, "s"]),
];

const PLANET = [
  r([10, "ooo"], [17, "s"]),
  r([8, "ooHmmMoo"]),
  r([7, "oHmmmmMMo"]),
  r([2, "sooooooooooooooooo"]),
  r([1, "oyYyoHmmmmMMDoyYyo"]),
  r([1, "oyYyommmmmMMDDoyYo"]),
  r([1, "ooooooommmMMDoooooo"]),
  r([7, "ommMMMDo"], [19, "s"]),
  r([8, "oMMMDDo"]),
  r([10, "ooo"]),
];

/* ── 레지스트리 ──────────────────────────────────────────────── */

type Def = { rows: string[]; main: readonly string[]; sub: readonly string[] };

const D: Record<string, Def> = {
  // 봄 정원 — 꽃 + 잎
  tulip: { rows: TULIP, main: ["#ff9ec4", "#f0609a", "#b8306a"], sub: PIXEL_PAL.leaf },
  rose: { rows: ROSE, main: ["#ff8a9e", "#e0384f", "#9c1a30"], sub: PIXEL_PAL.leaf },
  sunflower: { rows: SUNFLOWER, main: PIXEL_PAL.gold, sub: PIXEL_PAL.leaf },
  blossom: { rows: BLOSSOM, main: PIXEL_PAL.white, sub: PIXEL_PAL.leaf },
  butterfly: { rows: BUTTERFLY, main: PIXEL_PAL.violet, sub: PIXEL_PAL.charcoal },
  // 아늑한 집 — 나무 + 크림
  sofa: { rows: SOFA, main: ["#c9a0f5", "#9a6fd6", "#6a45a0"], sub: PIXEL_PAL.brown },
  chair: { rows: CHAIR, main: PIXEL_PAL.brown, sub: PIXEL_PAL.brown },
  candle: { rows: CANDLE, main: PIXEL_PAL.cream, sub: PIXEL_PAL.brown },
  frame: { rows: FRAME, main: PIXEL_PAL.water, sub: PIXEL_PAL.gold },
  books: { rows: BOOKS, main: ["#ff9a9a", "#e05a5a", "#9c2f2f"], sub: PIXEL_PAL.water },
  // 바다 — 물 + 모래
  umbrella: { rows: UMBRELLA, main: ["#ff9a9a", "#e85a5a", "#a02f2f"], sub: PIXEL_PAL.sand },
  shell: { rows: SHELL, main: PIXEL_PAL.peach, sub: PIXEL_PAL.sand },
  crab: { rows: CRAB, main: ["#ff9a72", "#e8552c", "#a02f14"], sub: PIXEL_PAL.sand },
  wave: { rows: WAVE, main: PIXEL_PAL.water, sub: PIXEL_PAL.white },
  // 커플 — 로즈 + 골드
  hearts: { rows: HEARTS, main: PIXEL_PAL.rose, sub: PIXEL_PAL.gold },
  cheers: { rows: CHEERS, main: ["#ffd98a", "#f0a83f", "#b8721c"], sub: PIXEL_PAL.water },
  ferris: { rows: FERRIS, main: PIXEL_PAL.rose, sub: PIXEL_PAL.gray },
  ring: { rows: RING, main: PIXEL_PAL.gold, sub: PIXEL_PAL.water },
  // 천상 — 밤 + 바이올렛
  moon: { rows: MOON, main: PIXEL_PAL.cream, sub: PIXEL_PAL.violet },
  stars: { rows: STARS, main: PIXEL_PAL.gold, sub: PIXEL_PAL.violet },
  comet: { rows: COMET, main: PIXEL_PAL.gold, sub: PIXEL_PAL.violet },
  planet: { rows: PLANET, main: PIXEL_PAL.violet, sub: PIXEL_PAL.gold },
};

export function decorSprite(key: string): Sprite {
  const def = D[key] ?? D.tulip;
  return mk(def.rows, dpal(def.main, def.sub));
}

export const ALL_DECOR_SPRITES: Record<string, Sprite> = Object.fromEntries(
  Object.keys(D).map((k) => [k, decorSprite(k)]),
);
