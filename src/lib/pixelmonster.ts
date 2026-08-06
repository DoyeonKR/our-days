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
  r([12, "oooo"]),
  r([10, "oHHmmoo"]),
  r([9, "oHmmmmMo"]),
  r([8, "oHmmmmmMMo"]),
  r([7, "omMmweewMMMo"]),
  r([7, "omMMweeewMMo"]),
  r([6, "omMMMMwwMMMMMo"]),
  r([6, "oMMMMMMMMMMMDo"]),
  r([5, "oMMMMMMMMMMMMDo"]),
  r([5, "oDDDDDDDDDDDDDo"]),
  r([5, "oooooooooooooo"]),
];

const BAT = [
  r([14, "oo"]),
  r([13, "omMo"]),
  r([3, "oo"], [12, "ommmo"], [26, "oo"]),
  r([2, "onno"], [11, "ommMmmo"], [25, "onno"]),
  r([1, "onNNno"], [10, "omweewmo"], [24, "onNNno"]),
  r([1, "onNNNNno"], [10, "omweewmo"], [22, "onNNNNno"]),
  r([1, "onNNNNNNo"], [10, "omMwwMmo"], [21, "onNNNNNNo"]),
  r([2, "oNNNNNNo"], [10, "omMMMMmo"], [21, "oNNNNNNo"]),
  r([3, "oNNNNo"], [11, "oMMMMo"], [22, "oNNNNo"]),
  r([4, "oooo"], [12, "oDDo"], [23, "oooo"]),
  r([12, "oooo"]),
];

const MUSH = [
  r([13, "ss"]),
  r([8, "ooommmooo"]),
  r([5, "omMwMMMMMwMMo"]),
  r([4, "omMMMwMMMwMMMMo"]),
  r([3, "oMMwMMMMMMMMwMMo"]),
  r([3, "oDDDDDDDDDDDDDDo"]),
  r([9, "onnnnnno"]),
  r([9, "oneeeeno"]),
  r([9, "onwewenno"]),
  r([9, "onNNNNno"]),
  r([8, "opppppppo"]),
];

const GHOST = [
  r([11, "oooooo"]),
  r([9, "oHHmmmmmo"]),
  r([8, "oHmmmmmmMo"]),
  r([8, "omweemweemo"]),
  r([8, "omweemweemo"]),
  r([8, "ommmmmmmmmo"]),
  r([8, "ommmwwwmmmo"]),
  r([8, "oMMMMMMMMMo"]),
  r([8, "oMMMMMMMMMo"]),
  r([8, "oMoMoMoMoMo"]),
  r([8, "oDoDoDoDoDo"]),
];

const GOLEM = [
  r([10, "oooooooo"]),
  r([9, "oHmmmmmmo"]),
  r([8, "oHmmmmmmmMo"]),
  r([8, "omweemweemo"]),
  r([8, "ommmmmmmmmo"]),
  r([6, "ooMMMMMMMMMMMoo"]),
  r([5, "oMMMMMMMMMMMMMMo"]),
  r([5, "oMMdMMMMMMMdMMMo"]),
  r([5, "oMMMMMMMMMMMMMMo"]),
  r([5, "oDDDDDDDDDDDDDDo"]),
  r([6, "oDDo"], [16, "oDDo"]),
  r([6, "oooo"], [16, "oooo"]),
];

const DRAGON = [
  r([6, "oo"], [24, "oo"]),
  r([5, "onno"], [23, "onno"]),
  r([4, "onNNo"], [12, "oooooo"], [22, "onNNo"]),
  r([4, "onNNNo"], [10, "oHmmmmmmo"], [21, "oNNNno"]),
  r([4, "onNNNNo"], [9, "oHmmmmmmmMo"], [20, "oNNNNno"]),
  r([4, "onNNNNNo"], [9, "omweemweemo"], [19, "oNNNNNno"]),
  r([5, "oNNNNNo"], [9, "ommwwwwwmmo"], [19, "oNNNNNo"]),
  r([6, "oNNNo"], [8, "ommMwMwMwMmmo"], [20, "oNNNo"]),
  r([7, "ooo"], [7, "oMMMMMMMMMMMMMMo"], [22, "ooo"]),
  r([6, "oMMMMMMMMMMMMMMMMo"]),
  r([6, "oMMdMMMMMMMMMMdMMo"]),
  r([6, "oDDDDDDDDDDDDDDDDo"]),
  r([8, "oDDo"], [18, "oDDo"]),
  r([8, "oooo"], [18, "oooo"]),
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
