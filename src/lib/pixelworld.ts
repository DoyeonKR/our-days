// 홈 월드 소품 픽셀 스프라이트 — 32×32.
//
// 왜 32 인가: 이 소품들은 30~64 CSS px 로 쓰인다(NestEgg 30 · PhotoCard/Signpost/Mailbox 38
// · HomeWorld 의 Mailbox 56 · Signpost 62 · RowBoat 64 · BenchBook 60).
// 32 면 1배율 32px · 2배율 64px 로 두 구간을 정수배로 덮는다(정수배 = 도트가 안 뭉개지는 조건).
//
// ⚠ 저작 규약은 pixelcrop/pixeldecor 와 동일 — 행은 `r([x,"문자열"])` 런으로만 적고,
//    mk() 가 바닥 정렬한다(지면에 놓이는 오브젝트라 바닥이 어긋나면 씬에서 떠 보인다).

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

const W = 32;

function r(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`world row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

const BLANK = r();
const isBlank = (s: string) => !/[^.]/.test(s);

function mk(rows: string[], pal: Palette): Sprite {
  const body = [...rows];
  while (body.length && isBlank(body[body.length - 1])) body.pop();
  if (body.length > 32) throw new Error(`world sprite: ${body.length}행 (32 초과)`);
  return { w: W, h: 32, pal, rows: [...Array<string>(32 - body.length).fill(BLANK), ...body] };
}

/** 소품 팔레트 — 주색(m) + 보조색(n) + 금속/금(y) + 종이(w). */
function wpal(main: readonly string[], sub: readonly string[]): Palette {
  const M = ramp(main);
  const N = ramp(sub);
  return {
    o: M.o, H: M.H, m: M.b, M: M.B, d: M.d, D: M.D,
    p: N.o, h: N.H, n: N.b, N: N.B, k: N.d, K: N.D,
    y: PIXEL_PAL.gold[1], Y: PIXEL_PAL.gold[2],
    w: "#fffdf7", W: "#d5daea", s: "#fff3b0",
  };
}

/** 우편함 — 깃발 올라간 빨간 함 + 나무 기둥. */
const MAILBOX: string[] = [
  r([25, "oo"]),
  r([24, "oyyo"]),
  r([24, "oyyo"]),
  r([24, "oYYo"]),
  r([25, "po"]),
  r([7, "oooooooooooooooo"], [25, "p"]),
  r([6, "oHmmmmmmmmmmmmMDo"], [25, "p"]),
  r([5, "oHmmmmmmmmmmmmmMDo"], [25, "p"]),
  r([5, "oHmmoooooooooommMDo"]),
  r([5, "oHmmoWWWWWWWWommMDo"]),
  r([5, "oHmmoooooooooommMDo"]),
  r([5, "ommmmmmmmmmmmmmMMDo"]),
  r([5, "ommmmmmmmmmmmmmMMDo"]),
  r([5, "oMMMMMMMMMMMMMMDDDo"]),
  r([5, "ooooooooooooooooooo"]),
  r([12, "phnNko"]),
  r([12, "phnNko"]),
  r([12, "phnNko"]),
  r([12, "phnNko"]),
  r([12, "phnNko"]),
  r([12, "phnNko"]),
  r([11, "pphnNkoo"]),
  r([10, "ppkkkkkkoo"]),
];

/** 이정표 — 기둥에 **화살표 팻말** 두 장(위는 오른쪽, 아래는 왼쪽).
 *  1차 시안은 그냥 직사각 널판이라 이정표로 안 읽혔다 → 끝을 뾰족하게 깎는다. */
const SIGNPOST: string[] = [
  r([13, "oooo"]),
  r([3, "oooooooooooooo"]),
  r([2, "ohnnnnnnnnnnnnno"]),
  r([2, "ohnnnnnnnnnnnnnno"]),
  r([2, "opnnnnnnnnnnnnnnno"]),
  r([2, "opNNNNNNNNNNNNNNo"]),
  r([2, "opNNNNNNNNNNNNo"]),
  r([3, "oooooooooooo"]),
  r([13, "phnN"]),
  r([16, "oooooooooooo"]),
  r([14, "oNNNNNNNNNNNNNo"]),
  r([12, "oNNNNNNNNNNNNNNNo"]),
  r([11, "onnnnnnnnnnnnnnnnho"]),
  r([12, "onnnnnnnnnnnnnnhKo"]),
  r([13, "onnnnnnnnnnnnhKo"]),
  r([16, "ooooooooooo"]),
  r([13, "phnN"]),
  r([13, "phnN"]),
  r([13, "phnN"]),
  r([12, "pphnNk"]),
  r([11, "ppkkkkko"]),
];

/** 나룻배 — 물 위에 뜬 작은 배 + 노. */
const ROWBOAT: string[] = [
  // 노는 나무색(m/M) — 물색으로 칠하면 물보라처럼 보인다
  r([6, "o"], [24, "o"]),
  r([7, "mo"], [23, "oM"]),
  r([8, "mo"], [22, "oM"]),
  r([9, "mo"], [21, "oM"]),
  r([3, "oooooooooooooooooooooooooo"]),
  r([2, "oHmmmmmmmmmmmmmmmmmmmmmmMDo"]),
  r([2, "oHmmoooooooooooooooooommMDo"]),
  r([2, "ommoWWWWWWWWWWWWWWWWoomMDo"]),
  r([3, "ommoWWWWWWWWWWWWWWWWommDo"]),
  r([3, "oMmmoooooooooooooooommMDo"]),
  r([4, "oMMmmmmmmmmmmmmmmmmMMDo"]),
  r([5, "oMMMMMMMMMMMMMMMMMDDo"]),
  r([6, "ooMMMMMMMMMMMMMMDoo"]),
  r([8, "ooooooooooooooo"]),
  r([2, "hnnhnnhnnhnnhnnhnnhnnhnnhnnh"]),
  r([2, "nkknkknkknkknkknkknkknkknkkn"]),
];

/** 벤치와 책 — 공원 벤치 위에 펼쳐진 책. */
const BENCHBOOK: string[] = [
  r([10, "ooooo"], [17, "ooooo"]),
  r([9, "owwwwo"], [16, "owwwwo"]),
  r([8, "owwwwwWoWwwwwwo"]),
  r([8, "oWWWWWoWWWWWWo"]),
  r([7, "oooooooooooooooo"]),
  r([3, "oooooooooooooooooooooooo"]),
  r([2, "ohnnnnnnnnnnnnnnnnnnnnNo"]),
  r([2, "opnnnnnnnnnnnnnnnnnnnNKo"]),
  r([2, "opNNNNNNNNNNNNNNNNNNNKKo"]),
  r([2, "oooooooooooooooooooooooo"]),
  r([3, "pnN"], [22, "pnN"]),
  r([3, "pnN"], [22, "pnN"]),
  r([2, "oooooooooooooooooooooooo"]),
  r([2, "ohnnnnnnnnnnnnnnnnnnnnNo"]),
  r([2, "opNNNNNNNNNNNNNNNNNNNKKo"]),
  r([2, "oooooooooooooooooooooooo"]),
  r([3, "pnN"], [22, "pnN"]),
  r([3, "pnN"], [22, "pnN"]),
  r([3, "pnN"], [22, "pnN"]),
  r([2, "pkkko"], [21, "pkkko"]),
];

/** 둥지와 알 — 나뭇가지 둥지에 알 하나. */
const NESTEGG: string[] = [
  r([12, "oooooo"]),
  r([10, "ooHmmmmMDoo"]),
  r([9, "oHHmmmmmmMMDo"]),
  r([9, "oHmmmmmmmmMMDo"]),
  r([9, "oHmmmmmmmmMMDo"]),
  r([9, "ommmmmmmmmMMDo"]),
  r([9, "ommmmmmmmmMMDo"]),
  r([10, "oMmmmmmmMMDo"]),
  r([4, "oooooooooooooooooooooooo"]),
  r([3, "ohnnknnhnnknnhnnknnhnnkno"]),
  r([2, "opnknnhnnknnhnnknnhnnknnKo"]),
  r([2, "opknnhnnknnhnnknnhnnknnhKo"]),
  r([3, "opKKnnknnhnnknnhnnknnKKo"]),
  r([4, "oopKKKKKKKKKKKKKKKKKoo"]),
  r([6, "oooooooooooooooo"]),
];

/** 폴라로이드 — 사진 카드(테이프로 붙인). */
const PHOTOCARD: string[] = [
  r([12, "syys"]),
  r([4, "oooooooooooooooooooooooo"]),
  r([4, "owwwwwwwwwwwwwwwwwwwwwWo"]),
  r([4, "owooooooooooooooooooowWo"]),
  r([4, "owoHmmmmmmmmmmmmMMDDowWo"]),
  r([4, "owoHmmmmmsmmmmmmMMDDowWo"]),
  r([4, "owommmmmmmmmmmmmMMDDowWo"]),
  r([4, "owommmmmmmmmmmMMMDDDowWo"]),
  r([4, "owomnnmmmmmmMMMMDDDDowWo"]),
  r([4, "owonnnnmmmMMMMDDDDDDowWo"]),
  r([4, "owonnnnnnMMMDDDDDDDDowWo"]),
  r([4, "owooooooooooooooooooowWo"]),
  r([4, "owwwwwwwwwwwwwwwwwwwwwWo"]),
  r([4, "owwwwwwwwwwwwwwwwwwwwwWo"]),
  r([4, "oWWWWWWWWWWWWWWWWWWWWWWo"]),
  r([4, "oooooooooooooooooooooooo"]),
];

/** 러브레터 — 하트 실링 봉투. */
const LOVELETTER: string[] = [
  r([3, "oooooooooooooooooooooooooo"]),
  r([2, "owwwwwwwwwwwwwwwwwwwwwwwwWo"]),
  r([2, "owWwwwwwwwwwwwwwwwwwwwwWwWo"]),
  r([2, "owwWwwwwwwwwwwwwwwwwwWwwwWo"]),
  r([2, "owwwWwwwwwwwwwwwwwwWwwwwwWo"]),
  r([2, "owwwwWwwwwwwwwwwwWwwwwwwwWo"]),
  r([2, "owwwwwWwwwoooowWwwwwwwwwwWo"]),
  r([2, "owwwwwwWwoHmmoWwwwwwwwwwwWo"]),
  r([2, "owwwwwwwWoHmmmoWwwwwwwwwwWo"]),
  r([2, "owwwwwwwwoommmmoWwwwwwwwWWo"]),
  r([2, "owwwwwwwwwomMMoWWwwwwwwWWWo"]),
  r([2, "owwwwwwwwwwoMoWWWwwwwwWWWWo"]),
  r([2, "owwwwwwwwwwwooWWWWWwWWWWWWo"]),
  r([2, "oWWWWWWWWWWWWWWWWWWWWWWWWWo"]),
  r([2, "ooooooooooooooooooooooooooo"]),
];

const P: Record<string, { rows: string[]; main: readonly string[]; sub: readonly string[] }> = {
  mailbox: { rows: MAILBOX, main: ["#ff9a9a", "#e05252", "#992f2f"], sub: PIXEL_PAL.brown },
  signpost: { rows: SIGNPOST, main: PIXEL_PAL.brown, sub: PIXEL_PAL.brown },
  rowboat: { rows: ROWBOAT, main: PIXEL_PAL.brown, sub: PIXEL_PAL.water },
  benchbook: { rows: BENCHBOOK, main: PIXEL_PAL.cream, sub: PIXEL_PAL.brown },
  nestegg: { rows: NESTEGG, main: PIXEL_PAL.cream, sub: PIXEL_PAL.brown },
  photocard: { rows: PHOTOCARD, main: PIXEL_PAL.water, sub: PIXEL_PAL.leaf },
  loveletter: { rows: LOVELETTER, main: PIXEL_PAL.rose, sub: PIXEL_PAL.gray },
};

export type WorldPropKey = keyof typeof P;

export function worldSprite(key: string): Sprite {
  const d = P[key] ?? P.signpost;
  return mk(d.rows, wpal(d.main, d.sub));
}

export const ALL_WORLD_SPRITES: Record<string, Sprite> = Object.fromEntries(
  Object.keys(P).map((k) => [k, worldSprite(k)]),
);
