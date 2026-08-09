// 몬스터 픽셀 스프라이트 — 32×32.
//
// 왜 32 인가: 펫은 48 이라 히어로가 확실히 커 보여야 한다(내가 주인공이다). 몬스터를 같은
// 크기로 그리면 둘이 대등해 보여 '사냥'이 아니라 '대치'가 된다.
//
// ⚠ 저작 규약은 pixelcrop/pixeldecor 와 동일 — 행은 `r([x,"문자열"])` 런으로만.

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

const W = 32;

function r(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`monster row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

const BLANK = r();
const isBlank = (s: string) => !/[^.]/.test(s);

/** 행 배열 → 32행 스프라이트(바닥 정렬 — 지면에 서야 한다). */
function mk(rows: string[], pal: Palette): Sprite {
  const body = [...rows];
  while (body.length && isBlank(body[body.length - 1])) body.pop();
  if (body.length > 32) throw new Error(`monster sprite: ${body.length}행 (32 초과)`);
  return { w: W, h: 32, pal, rows: [...Array<string>(32 - body.length).fill(BLANK), ...body] };
}

/** 몬스터 팔레트 — 몸(m) + 보조(n) + 눈/이빨. */
function mpal(main: readonly string[], sub: readonly string[]): Palette {
  const M = ramp(main);
  const N = ramp(sub);
  return {
    o: M.o, H: M.H, m: M.b, M: M.B, d: M.d, D: M.D,
    p: N.o, h: N.H, n: N.b, N: N.B, k: N.d, K: N.D,
    e: "#2b2f3d", // 눈동자 먹색
    w: "#fffdf7", // 흰자·이빨
    s: "#fff3b0",
  };
}

const SLIME = [
  r([13, "oooooo"]),
  r([10, "ooHHHHmmoo"]),
  r([8, "oHHHmmmmmmMo"]),
  r([7, "oHHmmmmmmmmMMo"]),
  r([6, "oHmmmmmmmmmmMMMo"]),
  r([5, "omMmmwweeewwmmMMMo"]),
  r([5, "omMMmweeeeewmMMMMo"]),
  r([4, "omMMMmweeeeewmMMMMMo"]),
  r([4, "omMMMMmwwwwwmMMMMMMo"]),
  r([3, "omMMMMMMwwwMMMMMMMMDo"]),
  r([3, "oMMMMMMMMMMMMMMMMMMDo"]),
  r([2, "oMMMMMMMMMMMMMMMMMMMDDo"]),
  r([2, "oMMMMMMMMMMMMMMMMMMMMDo"]),
  r([2, "oDMMMMMMMMMMMMMMMMMMDDo"]),
  r([2, "oDDMMMMMMMMMMMMMMMDDDo"], [24, "o"]),
  r([2, "oDDDDDDDDDDDDDDDDDDDDo"]),
  r([3, "ooooooooooooooooooo"]),
];

const BAT = [
  r([13, "oooooo"]),
  r([11, "ooHmmmmoo"]),
  r([10, "oHmmmmmmMo"]),
  r([1, "oo"], [9, "oHmmmmmmmMo"], [26, "oo"]),
  r([0, "ono"], [8, "omweeewweeewmMo"], [25, "ono"]),
  r([0, "onno"], [7, "omweeewweeewmMMo"], [24, "onno"]),
  r([0, "onnno"], [7, "omMmmmmmmmmmMMo"], [24, "onnno"]),
  r([0, "onnnno"], [7, "omMmwwwwwwwmMMo"], [22, "onnnno"]),
  r([0, "onnnnno"], [8, "oMMMMMMMMMMo"], [21, "onnnnno"]),
  r([1, "onnnnno"], [8, "oMMMMMMMMMMo"], [20, "onnnnno"]),
  r([2, "onnnno"], [9, "oMMMMMMMMo"], [21, "onnnno"]),
  r([3, "onnno"], [10, "oDDDDDDo"], [22, "onnno"]),
  r([4, "onno"], [11, "oDDDDo"], [23, "onno"]),
  r([5, "ono"], [12, "oooo"], [24, "ono"]),
  r([6, "oo"], [24, "oo"]),
];

const MUSH = [
  r([12, "oooooo"]),
  r([9, "ooHHHHHHoo"]),
  r([7, "oHHHHnnHHHHHo"]),
  r([5, "oHHnnnHHHHnnnHHo"]),
  r([4, "oHHHHHnnHHHHnnHHHo"]),
  r([3, "omHHHHHHHHHHHHHHHHmo"]),
  r([3, "ommHHnnHHHHHHnnHHmmo"]),
  r([2, "ommmHHHHHHHHHHHHHmmmo"]),
  r([2, "oMmmmmmmmmmmmmmmmmMMo"]),
  r([3, "ooooooooooooooooooo"]),
  r([8, "onnnnnnnnnno"]),
  r([8, "onnweeewwnno"]),
  r([8, "onnweeewwnno"]),
  r([8, "onnnwwwwnnno"]),
  r([8, "onnnnnnnnnno"]),
  r([8, "onnnnnnnnnno"]),
  r([8, "oKKnnnnnKKno"]),
  r([8, "oooooooooooo"]),
];

const GHOST = [
  r([13, "oooooo"]),
  r([10, "ooHHHHHHoo"]),
  r([8, "oHHHHHHHHHHo"]),
  r([7, "oHHHHHHHHHHHHo"]),
  r([6, "oHHHHHHHHHHHHHHo"]),
  r([6, "oHHpppHHHpppHHHo"]),
  r([5, "oHHHpppHHHpppHHHHo"]),
  r([5, "oHHHpppHHHpppHHHHo"]),
  r([5, "oHHHHHHHHHHHHHHHHo"]),
  r([5, "oHHHHHHpppHHHHHHHo"]),
  r([5, "oHHHHHHpppHHHHHHHo"]),
  r([5, "oHHHHHHHHHHHHHHHHo"]),
  r([5, "omHHHHHHHHHHHHHHmo"]),
  r([5, "ommHHHHHHHHHHHHmmo"]),
  r([5, "ommmHHHHHHHHHHmmmo"]),
  r([5, "ommmmmmmmmmmmmmmmo"]),
  r([5, "omoommoommoommoomo"]),
  r([6, "oo"], [10, "oo"], [14, "oo"], [18, "oo"]),
];

const GOLEM = [
  r([10, "oooooooooooo"]),
  r([9, "oHHHHHHHHHHHHo"]),
  r([8, "oHHmmHHHHmmHHHHo"]),
  r([7, "oHHmmmHHHHmmmHHHHo"]),
  r([6, "oHHHHHHHHHHHHHHHHHHo"]),
  r([6, "oHHweeeHHHHweeeHHHHo"]),
  r([6, "oHHweeeHHHHweeeHHHHo"]),
  r([5, "omHHHHHHHHHHHHHHHHHHmo"]),
  r([5, "omHHHHKKKKKKHHHHHHHHmo"]),
  r([5, "ommHHHHHHHHHHHHHHHHmmo"]),
  r([4, "ommmmHHHHHHHHHHHHHmmmmo"]),
  r([4, "ommmmmHHHHKKHHHHHmmmmmo"]),
  r([4, "oMmmmmmmmmmmmmmmmmmmMMo"]),
  r([4, "oMMmmmmmmmmmmmmmmmmMMMo"]),
  r([4, "oMMMMMMMMMMMMMMMMMMMMMo"]),
  r([4, "oDDDMMMMMMMMMMMMMMMDDDo"]),
  r([4, "ooooooooooooooooooooooo"]),
  r([6, "oDDDDo"], [18, "oDDDDo"]),
  r([6, "oooooo"], [18, "oooooo"]),
];

const DRAGON = [
  r([6, "oo"], [24, "oo"]),
  r([5, "onno"], [23, "onno"]),
  r([5, "onnno"], [22, "onnno"]),
  r([6, "onnno"], [11, "oooooooo"], [22, "onno"]),
  r([6, "onno"], [9, "ooHHHHHHHHoo"], [22, "onno"]),
  r([6, "ono"], [8, "oHHHHHHHHHHHHo"], [23, "ono"]),
  r([3, "oo"], [7, "oHHmmHHHHmmHHHHo"], [24, "oo"]),
  r([2, "onno"], [6, "oHHmmmHHHHmmmHHHHo"], [23, "onno"]),
  r([2, "onnno"], [6, "oHweeeHHHHHweeeHHo"], [23, "onnno"]),
  r([2, "onnno"], [6, "oHweeeHHHHHweeeHHo"], [23, "onnno"]),
  r([2, "onno"], [6, "oHHHHHHHHHHHHHHHHo"], [23, "onno"]),
  r([3, "oo"], [6, "oHHHwwwwwwwwHHHHHo"], [24, "oo"]),
  r([5, "omHHHHHHHHHHHHHHHHmo"]),
  r([5, "ommHHHHHHHHHHHHHHmmo"]),
  r([4, "ommmmHHHHHHHHHHHHmmmmo"]),
  r([4, "oMmmmmmmmmmmmmmmmmmMMo"]),
  r([4, "oMMMMMMMMMMMMMMMMMMMMo"]),
  r([4, "oDDMMMMMMMMMMMMMMMMDDo"]),
  r([4, "ooooooooooooooooooooo"]),
  r([6, "oDDo"], [12, "oDDo"], [18, "oDDo"], [24, "oDDo"]),
  r([6, "oooo"], [12, "oooo"], [18, "oooo"], [24, "oooo"]),
];

type Def = { rows: string[]; main: readonly string[]; sub: readonly string[] };
const M: Record<string, Def> = {
  slime: { rows: SLIME, main: PIXEL_PAL.grass, sub: PIXEL_PAL.leaf },
  bat: { rows: BAT, main: PIXEL_PAL.violet, sub: PIXEL_PAL.night },
  mush: { rows: MUSH, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: PIXEL_PAL.cream },
  ghost: { rows: GHOST, main: PIXEL_PAL.white, sub: PIXEL_PAL.violet },
  golem: { rows: GOLEM, main: PIXEL_PAL.gray, sub: PIXEL_PAL.brown },
  dragon: { rows: DRAGON, main: ["#ff9a72", "#e8552c", "#a02f14"], sub: PIXEL_PAL.gold },
};

const cache = new Map<string, Sprite>();
export function monsterSprite(key: string): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const def = M[key] ?? M.slime;
  const made = mk(def.rows, mpal(def.main, def.sub));
  cache.set(key, made);
  return made;
}

export const ALL_MONSTER_SPRITES: Record<string, Sprite> = Object.fromEntries(
  Object.keys(M).map((k) => [k, monsterSprite(k)]),
);
