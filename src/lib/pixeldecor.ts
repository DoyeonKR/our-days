// 데코 22종 픽셀 스프라이트 — 24×24.
//
// 세트별 색 톤을 통일해 섬에 놓았을 때 세트가 눈으로 묶여 보이게 한다(SVG 데코의 규칙 계승):
//   봄 정원=꽃/잎 · 아늑한 집=나무/크림 · 바다=물/모래 · 커플=로즈/골드 · 천상=밤/바이올렛.
// 등급이 높을수록 반짝임(s)·금색(y) 같은 장식을 더한다.
//
// ⚠ 저작 규약은 pixelcrop 과 동일 — 행은 `r([x,"문자열"])` 런으로만 적고, mk() 가 **바닥 정렬**
//    한다. 지면에 놓이는 오브젝트라 바닥이 안 맞으면 섬에 띄엄띄엄 떠 보인다.

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

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


/* ── 숲속 (2026-08-05 추가) — 나무/이끼 톤 ─────────────────── */

const PINE = [
  r([11, "m"]),
  r([10, "omo"]),
  r([10, "mMm"]),
  r([9, "omMmo"]),
  r([9, "mMMMm"]),
  r([8, "omMMMmo"]),
  r([8, "mMMMMMm"]),
  r([7, "omMMMMMmo"]),
  r([7, "mMMMMMMMm"]),
  r([6, "omMMMMMMMmo"]),
  r([6, "oDDDDDDDDDo"]),
  r([10, "pnNp"]),
  r([10, "pnNp"]),
  r([9, "oppppo"]),
];

const STUMP = [
  r([6, "oppppppppppo"]),
  r([5, "opnnnnnnnnnnpo"]),
  r([5, "opnhHHHHHHnnpo"]),
  r([5, "opnnnnnnnnnnpo"]),
  r([6, "oNNNNNNNNNNo"]),
  r([6, "oNKKKKKKKKNo"]),
  r([6, "oNKKKKKKKKNo"]),
  r([6, "oooooooooooo"]),
];

const MUSHHOUSE = [
  r([10, "ss"]),
  r([7, "oommmmoo"]),
  r([5, "omMwMMMMwMMo"]),
  r([4, "omMMMwMMMMMMMo"]),
  r([4, "oMMMMMMMMMMMMo"]),
  r([4, "oDDDDDDDDDDDDo"]),
  r([8, "onnnnnno"]),
  r([8, "onwwNNno"]),
  r([8, "onwwNNno"]),
  r([8, "onNNNNno"]),
  r([8, "opppppppo"]),
];

const CAMPFIRE = [
  r([11, "s"]),
  r([10, "ysy"]),
  r([9, "oysyo"]),
  r([9, "yssHy"]),
  r([8, "oyssHHyo"]),
  r([8, "oyHHHHyo"]),
  r([8, "ooyyyyoo"]),
  r([5, "opnNnnNnnpo"]),
  r([4, "opnnNnnnNnnnpo"]),
  r([4, "oppppppppppppo"]),
];

const DEER = [
  r([7, "o"], [15, "o"]),
  r([6, "onmo"], [14, "omno"]),
  r([7, "omo"], [14, "omo"]),
  r([8, "omo"], [13, "omo"]),
  r([9, "ommmmo"]),
  r([9, "omHHmo"]),
  r([9, "omwmwo"]),
  r([9, "ommmmo"]),
  r([6, "ommMMMMMMmo"]),
  r([5, "omMMMsMMMMMmo"]),
  r([5, "omMMMMMMsMMmo"]),
  r([5, "oDDDDDDDDDDDo"]),
  r([6, "oMo"], [9, "oMo"], [13, "oMo"], [16, "oMo"]),
  r([6, "oDo"], [9, "oDo"], [13, "oDo"], [16, "oDo"]),
  r([6, "opo"], [9, "opo"], [13, "opo"], [16, "opo"]),
];

/* ── 랜드마크 (2026-08-05) — 크고 비싼 대형 오브젝트 ────────── */

const FOUNTAIN = [
  r([11, "nn"]),
  r([9, "onnnno"]),
  r([8, "onnwwnno"]),
  r([9, "onnnno"]),
  r([10, "oHHo"]),
  r([10, "omMo"]),
  r([7, "ommMMMMmo"]),
  r([6, "onnnnnnnnnno"]),
  r([4, "ommMMMMMMMMMMmmo"]),
  r([3, "omMMMMMMMMMMMMMMmo"]),
  r([3, "oDDDDDDDDDDDDDDDDo"]),
  r([3, "oooooooooooooooooo"]),
];

const LIGHTHOUSE = [
  r([11, "ss"]),
  r([9, "oyssyo"]),
  r([9, "oyYYyo"]),
  r([9, "ommmmo"]),
  r([8, "onnnnnno"]),
  r([9, "omMMmo"]),
  r([9, "oDDDDo"]),
  r([9, "onnnno"]),
  r([8, "omMMMMmo"]),
  r([8, "oDDDDDDo"]),
  r([8, "onnnnnno"]),
  r([7, "omMMMMMMmo"]),
  r([7, "oDDDDDDDDo"]),
  r([6, "onnnnnnnnnno"]),
  r([5, "opppppppppppppo"]),
];

const HOTSPRING = [
  r([8, "w"], [12, "w"], [16, "w"]),
  r([7, "ww"], [11, "ww"], [15, "ww"]),
  r([8, "w"], [12, "w"], [16, "w"]),
  r([5, "opppppppppppppo"]),
  r([4, "opnNNNNNNNNNNNNpo"]),
  r([4, "opNhhhhhhhhhhhNpo"]),
  r([4, "opNhwwHHHHwwhNpo"]),
  r([4, "opNhHHHHHHHHhNpo"]),
  r([4, "opNhhwwHHwwhhNpo"]),
  r([4, "opNNhhhhhhhhNNpo"]),
  r([4, "oppNNNNNNNNNNppo"]),
  r([4, "ooppppppppppppoo"]),
];

const BRIDGE = [
  r([9, "ooooooo"]),
  r([7, "ommmmmmmmmo"]),
  r([5, "omMMMMMMMMMMMmo"]),
  r([3, "onnnnnnnnnnnnnnnnno"]),
  r([3, "oNNNNNNNNNNNNNNNNNo"]),
  r([3, "ohhhhhhhhhhhhhhhhho"]),
  r([3, "oyyyyyyyyyyyyyyyyyo"]),
  r([3, "opppppppppppppppppo"]),
  r([4, "opKo"], [17, "oKpo"]),
  r([4, "opKo"], [17, "oKpo"]),
  r([4, "oooo"], [17, "oooo"]),
];

const CASTLE = [
  r([4, "s"], [11, "s"], [18, "s"]),
  r([3, "oyo"], [10, "oyo"], [17, "oyo"]),
  r([3, "omo"], [10, "omo"], [17, "omo"]),
  r([2, "ommmo"], [9, "ommmo"], [16, "ommmo"]),
  r([2, "omMMo"], [9, "omMMo"], [16, "omMMo"]),
  r([2, "oMMDo"], [9, "oMMDo"], [16, "oMMDo"]),
  r([1, "omomomomomomomomomomo"]),
  r([1, "omMMMMMMMMMMMMMMMMMMo"]),
  r([1, "omMMMMMwwMMwwMMMMMMMo"]),
  r([1, "omMMMMMwwMMwwMMMMMMMo"]),
  r([1, "omMMMMMMMMMMMMMMMMMMo"]),
  r([1, "omMMMnnnnnnnnMMMMMMMo"]),
  r([1, "omMMMnNNNNNNnMMMMMMMo"]),
  r([1, "omMMMnNyyyyNnMMMMMMMo"]),
  r([1, "oDDDDnNNNNNNnDDDDDDDo"]),
  r([1, "ooooooooooooooooooooo"]),
];


/* ── 장식 26종 확장(2026-09-23) ─────────────────────────────────
 * [사용자 요청 "꾸미기도 … 형태를 엄청 많이 추가"] 농장·한옥·카페·겨울·놀이공원 다섯 세트.
 * 농장의 벌통·닭장·젖소는 **생산 장식**이다(꿀·달걀·우유 — 공방 재료). 실루엣으로 갈리게
 * 그렸다(pixeldecor.test '실루엣이 서로 다르다'). 도형 초안 → PNG 확인 → r() 런으로 옮겼다. */

/** 벌통 — 짚으로 엮은 둥근 벌통(가로 띠) + 문 구멍 + 날아다니는 벌. 꿀을 만든다. */
const BEEHIVE = [
  r([3, "k"], [5, "k"]),
  r([3, "yky"]),
  r([4, "y"]),
  r([9, "oooooo"]),
  r([7, "ooHmmmMoo"]),
  r([6, "oHmmmmmmMDo"]),
  r([6, "odddddddddDo"]),
  r([5, "oHmmmmmmmmMDo"]),
  r([5, "oddddddddddddo"]),
  r([4, "oHmmmmmmmmmmmDo"]),
  r([4, "oddddddpppddddDo"]),
  r([3, "oHmmmmmpKKpmmmmDo"]),
  r([3, "omMMMMMpKKpMMMMDo"]),
  r([2, "ooooooooooooooooooo"]),
  r([2, "pnnNNNNNNNNNNNNNNNNp"]),
  r([2, "pkkkkkkkkkkkkkkkkkkp"]),
  r([3, "pp"], [19, "pp"]),
];

/** 닭장 — 빨간 지붕 나무 닭장 + 앞마당의 흰 닭. 달걀을 만든다. */
const HENHOUSE = [
  r([11, "oo"]),
  r([10, "oHmo"]),
  r([9, "oHmmMo"]),
  r([8, "oHmmmmMo"]),
  r([7, "oHmmmmmmMo"]),
  r([6, "oHmmmmmmmmMo"]),
  r([5, "oHmmmmmmmmmmMo"]),
  r([4, "oooooooooooooooo"]),
  r([4, "pnnnnnnnnnnnnnp"]),
  r([4, "pnNNNpppppNNNNp"]),
  r([4, "pnNNNpKKKpNNNNp"]),
  r([4, "pnNNNpKKKpNNNNp"]),
  r([4, "ww"], [7, "pnNNNpKKKpNNNNp"]),
  r([3, "wwwwpnNNNpKKKpNNNNp"]),
  r([3, "wHwwpkkkkkkkkkkkkkp"]),
  r([4, "wwkp"], [21, "p"]),
  r([4, "yy"], [7, "p"], [21, "p"]),
];

/** 젖소 — 흰 몸에 검은 얼룩. 동물이라 건물보다 실루엣이 곧 이름이다. 우유를 만든다. */
const COWSHED = [
  r([3, "pp"], [8, "pp"]),
  r([3, "pwwwwwwp"]),
  r([2, "pwwKwwKwp"]),
  r([2, "pwwwwwwwp"]),
  r([3, "pnnnnnpooooooooooo"]),
  r([4, "pnKnpoHmmmmmmmmmmo"]),
  r([5, "pppoHmmmKKmmmmmmmo"]),
  r([7, "oHmmmmKKKmmmmmmmo"]),
  r([7, "ommmmmmmmmmmmKKmo"]),
  r([7, "omMmmmmmmmmmKKKmo"]),
  r([7, "oMMMMMMMMMMMMMMDo"]),
  r([8, "oDDoooooooooDDo"]),
  r([8, "oMooMo"], [16, "oMooMo"]),
  r([8, "oMooMo"], [16, "oMooMo"]),
  r([8, "kkkkkk"], [16, "kkkkkk"]),
];

/** 건초더미 — 금빛 둔덕 + 짚 결(d). */
const HAYSTACK = [
  r([9, "oooooo"]),
  r([7, "ooHmmmMoo"]),
  r([6, "oHmdmmmdmDo"]),
  r([5, "oHmmmdmmmdmDo"]),
  r([5, "oHmdmmmmdmmmDo"]),
  r([4, "omdmmmdmmmdmmDo"]),
  r([4, "oHmmmdmmmmdmmdMo"]),
  r([3, "omdmmmmdmmmmdmMDo"]),
  r([3, "omMMdMMMMdMMMdMMDo"]),
  r([2, "oMMMMMMdMMMMMMMMDDo"]),
  r([1, "ooooooooooooooooooooo"]),
  r([1, "pnnnnnnnnnnnnnnnnnnnp"]),
];

/** 풍차 — 흰 날개 넷 + 붉은 탑. */
const WINDMILL = [
  r([2, "ww"], [18, "ww"]),
  r([3, "www"], [16, "www"]),
  r([4, "www"], [14, "www"]),
  r([5, "www"], [12, "www"]),
  r([6, "wwwoowww"]),
  r([8, "oyYo"]),
  r([6, "wwwoowww"]),
  r([5, "www"], [12, "www"]),
  r([4, "www"], [9, "oHmMowww"]),
  r([3, "www"], [9, "oHmMo"], [16, "www"]),
  r([2, "ww"], [8, "oHmmMDo"], [18, "ww"]),
  r([8, "oHmmMDo"]),
  r([7, "oHmmmMDDo"]),
  r([7, "oHmpppMDo"]),
  r([7, "oHmpKpMDo"]),
  r([6, "oHmmpKpMDDo"]),
  r([6, "oooooooooo"]),
  r([5, "pnnnnnnnnnnnp"]),
];

/** 허수아비 — 밀짚모자 + 푸른 셔츠 + 십자 팔. */
const SCARECROW = [
  r([10, "yyyy"]),
  r([9, "yYYYYy"]),
  r([8, "yyyyyyyy"]),
  r([9, "oHmmMo"]),
  r([9, "omKKmo"]),
  r([9, "omMMmo"]),
  r([5, "pppphnnnnNpppp"]),
  r([4, "phnnnnnnnnnnnNp"]),
  r([5, "pppphnnnnNpppp"]),
  r([8, "phnnnnNp"]),
  r([8, "phnnnnNp"]),
  r([8, "pppppppp"]),
  r([11, "kk"]),
  r([11, "kk"]),
  r([11, "kk"]),
  r([10, "kKKk"]),
];

/** 장독대 — 크고 작은 옹기 둘 + 돌 받침. */
const JANGDOK = [
  r([6, "oooo"]),
  r([5, "oHmmMo"], [13, "oooooo"]),
  r([5, "oommmo"], [12, "oHmmmmMo"]),
  r([4, "oHmmmmMooooooooo"]),
  r([4, "omddddmoHmmmmmmMo"]),
  r([4, "omMMMMDomddddddmo"]),
  r([4, "oooooooomMMMMMMDo"]),
  r([11, "oMMMMMMMDo"]),
  r([12, "oooooooo"]),
  r([2, "pnnNNNNNNNNNNNNNNNNp"]),
  r([1, "phnnnNNNNNNNNNNNNNNNNp"]),
  r([1, "pkkkkkkkkkkkkkkkkkkkkp"]),
];

/** 정자 — 끝이 들린 기와지붕 + 붉은 기둥. */
const PAVILION = [
  r([1, "oo"], [21, "oo"]),
  r([1, "oHoo"], [19, "ooDo"]),
  r([2, "oHmmoooooooooooommDo"]),
  r([3, "oHmmmmmmmmmmmmmmmDo"]),
  r([2, "oooooooooooooooooooo"]),
  r([3, "pp"], [11, "yy"], [19, "pp"]),
  r([3, "pNp"], [18, "pNp"]),
  r([3, "pNp"], [18, "pNp"]),
  r([3, "pNp"], [18, "pNp"]),
  r([3, "pNp"], [18, "pNp"]),
  r([3, "pNp"], [18, "pNp"]),
  r([2, "kkkkkkkkkkkkkkkkkkkk"]),
  r([2, "KwwwwwwwwwwwwwwwwwwK"]),
  r([2, "kkkkkkkkkkkkkkkkkkkk"]),
];

/** 청사초롱 — 장대 끝에 매단 홍청 초롱. */
const LANTERN = [
  r([8, "kkkkkkkk"]),
  r([8, "k"]),
  r([7, "kk"]),
  r([6, "pnnp"]),
  r([5, "oHmmMo"]),
  r([5, "omyyMo"]),
  r([5, "omyyMo"]),
  r([5, "oHmmMo"]),
  r([5, "pnnnnp"]),
  r([6, "pNNp"]),
  r([7, "y"]),
  r([7, "yy"]),
  r([12, "k"]),
  r([12, "k"]),
  r([12, "k"]),
  r([12, "k"]),
  r([12, "k"]),
  r([11, "kKk"]),
  r([10, "kkKkk"]),
];

/** 돌담 — 쌓은 돌 + 위에 얹은 기와. */
const STONEWALL = [
  r([1, "kkkkkkkkkkkkkkkkkkkkkk"]),
  r([1, "kKKkKKkKKkKKkKKkKKkKKk"]),
  r([1, "kkkkkkkkkkkkkkkkkkkkkk"]),
  r([1, "oHmMoHmmMoHmMoHmmMoHmo"]),
  r([1, "omDdommDdommdoHmDdommo"]),
  r([1, "oooooooooooooooooooooo"]),
  r([1, "oHmmMoHmMoHmmmMoHmMoMo"]),
  r([1, "ommDdommdommDdoomDdoDo"]),
  r([1, "oooooooooooooooooooooo"]),
  r([1, "pnnnnnnnnnnnnnnnnnnnnp"]),
];

/** 연못 — 물 위 연잎(k) + 분홍 연꽃. */
const LOTUS = [
  r([8, "hh"]),
  r([7, "hhhh"], [15, "hh"]),
  r([7, "hNNh"], [14, "hhhh"]),
  r([8, "hh"], [14, "hNNh"]),
  r([6, "kkkkk"], [15, "hh"]),
  r([3, "oooooooooooooooooo"]),
  r([2, "oHmmmkkkmmmmmmkkkmo"]),
  r([1, "oHmmmmkkkkmmmmmkkkmmDo"]),
  r([1, "omMmmmmmmmmmMMmmmmmmDo"]),
  r([1, "omMMmmmmMMmmmmmmMMmmDo"]),
  r([1, "oDMMMMMMMMMMMMMMMMMDDo"]),
  r([1, "ooooooooooooooooooooo"]),
];

/** 카페 테이블 — 둥근 탁자 + 찻잔 둘. */
const CAFETABLE = [
  r([4, "ww"], [16, "ww"]),
  r([3, "wHww"], [15, "wwHw"]),
  r([4, "ww"], [16, "ww"]),
  r([4, "oooooooooooooooo"]),
  r([3, "oHmmmmmmmmmmmmmmMo"]),
  r([3, "oommmmmmmmmmmmmmoo"]),
  r([4, "oooooooooooooooo"]),
  r([11, "pp"]),
  r([10, "pNNp"]),
  r([11, "pp"]),
  r([11, "pp"]),
  r([11, "pp"]),
  r([10, "pNNp"]),
  r([8, "pNNNNNNp"]),
];

/** 커피 수레 — 줄무늬 차양 + 바퀴. */
const COFFEECART = [
  r([3, "oooooooooooooooooo"]),
  r([3, "owwMMwwMMwwMMwwMMo"]),
  r([3, "oMMwwMMwwMMwwMMwwo"]),
  r([3, "oooooooooooooooooo"]),
  r([4, "pp"], [18, "pp"]),
  r([4, "pp"], [18, "pp"]),
  r([4, "pp"], [9, "ww"], [18, "pp"]),
  r([4, "pp"], [8, "wHww"], [13, "yy"], [18, "pp"]),
  r([3, "pnnnnnnnnnnnnnnnnnp"]),
  r([3, "phnnnnNNNNNNNNNNNNp"]),
  r([3, "pnNNNNNNNNNNNNNNNNp"]),
  r([3, "pppppppppppppppppp"]),
  r([4, "kkk"], [16, "kkk"]),
  r([3, "kKwKk"], [15, "kKwKk"]),
  r([4, "kkk"], [16, "kkk"]),
];

/** 화분 — 토분에 심은 큰 잎. */
const PLANTPOT = [
  r([5, "oo"], [15, "oo"]),
  r([4, "oHmo"], [14, "oHmo"]),
  r([4, "omMmooo"], [13, "omMmo"]),
  r([5, "omMoHmoomMmo"]),
  r([6, "omMmoHmMmomMmo"]),
  r([7, "omMmHmmMmMmo"]),
  r([8, "ommMMmmMmo"]),
  r([9, "omMMMMmo"]),
  r([10, "odDDdo"]),
  r([7, "pppppppppp"]),
  r([7, "phnnnnnnNp"]),
  r([7, "phnnnnnNNp"]),
  r([7, "pnnnnnNNp"]),
  r([8, "pnNNNNNp"]),
  r([9, "pppppp"]),
];

/** 메뉴 칠판 — A자 칠판 + 흰 분필 글씨. */
const MENUBOARD = [
  r([10, "pppp"]),
  r([6, "pnnnnnnnnnnp"]),
  r([5, "pnKKKKKKKKKKnp"]),
  r([5, "pnKwwKwKwwwKnp"]),
  r([5, "pnKKKKKKKKKKnp"]),
  r([5, "pnKwwwKwwKKKnp"]),
  r([5, "pnKKKKKKKKKKnp"]),
  r([5, "pnKwKwwwKwwKnp"]),
  r([5, "pnKKKKKKKKKKnp"]),
  r([5, "pnnnnnnnnnnnnp"]),
  r([5, "pp"], [17, "pp"]),
  r([4, "pp"], [18, "pp"]),
  r([3, "pp"], [19, "pp"]),
];

/** 전구 줄 — 두 기둥 사이 색색 전구. */
const STRINGLIGHTS = [
  r([2, "pp"], [20, "pp"]),
  r([2, "pNkk"], [18, "kkNp"]),
  r([2, "pN"], [6, "kk"], [16, "kk"], [20, "Np"]),
  r([2, "pN"], [5, "y"], [8, "kkk"], [13, "kkk"], [20, "Np"]),
  r([2, "pNyY"], [8, "m"], [11, "kkk"], [16, "w"], [20, "Np"]),
  r([2, "pN"], [8, "M"], [12, "s"], [15, "wH"], [18, "h"], [20, "Np"]),
  r([2, "pN"], [12, "y"], [18, "N"], [20, "Np"]),
  r([2, "pN"], [20, "Np"]),
  r([2, "pN"], [20, "Np"]),
  r([2, "pN"], [20, "Np"]),
  r([2, "pN"], [20, "Np"]),
  r([2, "pN"], [20, "Np"]),
  r([1, "pkkp"], [19, "pkkp"]),
];

/** 눈사람 — 세 덩이 + 모자 + 목도리. */
const SNOWMAN = [
  r([10, "kkkk"]),
  r([10, "kkkk"]),
  r([9, "kKKKKk"]),
  r([9, "oHwwwo"]),
  r([8, "owkwkwo"]),
  r([8, "owwywwo"]),
  r([8, "oHwwwwwo"]),
  r([7, "pnnnnnnnnp"]),
  r([7, "phNNpNNNp"]),
  r([6, "oHwwwwwwwwo"]),
  r([6, "oHwwkwwwwwwo"]),
  r([5, "owwwwwkwwwwwo"]),
  r([5, "owwwwwwwwwwwwo"]),
  r([4, "oHwwwwwwwwwwwwwo"]),
  r([4, "owwwwwwwwwwwwwwo"]),
  r([4, "ommmmmmmmmmmmmmo"]),
  r([4, "oooooooooooooooo"]),
];

/** 크리스마스트리 — 층층 삼각 + 별·장식. 숲속 소나무와 실루엣이 갈리게 층을 넣었다. */
const XMASTREE = [
  r([11, "y"]),
  r([10, "yyy"]),
  r([11, "y"]),
  r([11, "oo"]),
  r([10, "oHmo"]),
  r([9, "oHmmMo"]),
  r([8, "ommhmMo"]),
  r([8, "oHmmmmMo"]),
  r([7, "ommmmmhmMo"]),
  r([6, "oHmmhmmmmMDo"]),
  r([6, "oooooooooooo"]),
  r([5, "oHmmmmmmmmmMo"]),
  r([4, "ommhmmmmmhmmMDo"]),
  r([4, "oHmmmmmyymmmmMDo"]),
  r([3, "oommmhmmmmmhmmMDo"]),
  r([3, "oooooooooooooooooo"]),
  r([10, "pnNp"]),
  r([10, "pnNp"]),
  r([8, "KKKKKKKK"]),
];

/** 썰매 — 빨간 좌판 + 나무 날. */
const SLED = [
  r([3, "oooooooooooooooo"]),
  r([3, "oHmmmmmmmmmmmmmMo"]),
  r([3, "omMMMMMMMMMMMMMMDo"]),
  r([3, "oooooooooooooooooo"]),
  r([4, "pp"], [9, "pp"], [15, "pp"]),
  r([4, "pp"], [9, "pp"], [15, "pp"]),
  r([1, "pppppppppppppppppppp"]),
  r([1, "phhnnnnnnnnnnnnnnnnnNp"]),
  r([2, "ppppppppppppppppppppp"]),
];

/** 이글루 — 얼음 벽돌 돔 + 입구. */
const IGLOO = [
  r([8, "oooooooo"]),
  r([6, "ooHwwwwwwMoo"]),
  r([5, "oHwwwmwwwmwwMo"]),
  r([4, "oHwwwwwwwwwwwwMo"]),
  r([3, "ommmmmmmmmmmmmmmmo"]),
  r([2, "oHwwmwwwwmwwwwmwwMo"]),
  r([2, "oHwwwwwwwwwwwwwwwwMo"]),
  r([1, "ommmmmmmmmmmmmmmmmmmo"]),
  r([1, "oHwwmwwwkkkkkwwmwwwMo"]),
  r([1, "oHwwwwwkKKKKKkwwwwwMo"]),
  r([1, "ommmmmmkKKKKKkmmmmmMo"]),
  r([1, "ooooooooooooooooooooo"]),
];

/** 선물 상자 — 크고 작은 상자 둘 + 금 리본. */
const GIFTBOX = [
  r([12, "yy"], [15, "yy"]),
  r([11, "yY"], [14, "yyyYy"]),
  r([9, "ooooooyyoooooo"]),
  r([9, "oHmmmmyymmmmMo"]),
  r([9, "oyyyyyyyyyyyyo"]),
  r([9, "omMMMMyyMMMMDo"]),
  r([3, "ppyp"], [9, "oMMMMMyyMMMMDo"]),
  r([2, "pphyyp"], [9, "oooooooooooooo"]),
  r([2, "pppyyppppppppppppp"]),
  r([2, "phnnyyNNNNNNNyyNNNp"]),
  r([2, "pyyyyyyyyyyyyyyyyyp"]),
  r([2, "pnNNyyNNNNNNNyyNNNp"]),
  r([2, "pnNNyyNNNNNNNyyNNNp"]),
  r([2, "ppppppppppppppppppp"]),
];

/** 회전목마 — 줄무늬 지붕 + 기둥 + 목마. */
const CAROUSEL = [
  r([11, "yy"]),
  r([10, "oooo"]),
  r([9, "oHmmMo"]),
  r([7, "oHmmwwmmMo"]),
  r([5, "oHmmwwmmwwmmMo"]),
  r([3, "oHmmwwmmwwmmwwmmMo"]),
  r([2, "oooooooooooooooooooo"]),
  r([2, "ysysysysysysysysysys"]),
  r([3, "y"], [8, "y"], [15, "y"], [20, "y"]),
  r([2, "hhh"], [8, "y"], [14, "hhh"], [20, "y"]),
  r([2, "hhhh"], [7, "hhh"], [14, "hhhh"], [19, "hhh"]),
  r([2, "kyk"], [7, "kyk"], [14, "kyk"], [19, "kyk"]),
  r([3, "y"], [8, "y"], [15, "y"], [20, "y"]),
  r([2, "pppppppppppppppppppp"]),
  r([2, "phnnnnnnnnnnnnnnnnNp"]),
  r([2, "pppppppppppppppppppp"]),
];

/** 풍선 — 분홍·노랑·파랑 셋이 줄로 모여 추에 묶였다. */
const BALLOONS = [
  r([4, "oooo"], [15, "pppp"]),
  r([3, "oHmmMoyyyy"], [14, "phnnNp"]),
  r([3, "oHmmMyHyyYypnnNNKp"]),
  r([3, "omMMMyyyyYYpnNNNKp"]),
  r([4, "oMMDyyyYYy"], [15, "pNNKp"]),
  r([5, "oDo"], [9, "yYYy"], [16, "pKp"]),
  r([6, "D"], [10, "YY"], [17, "p"]),
  r([7, "D"], [11, "D"], [16, "p"]),
  r([8, "D"], [11, "D"], [15, "p"]),
  r([9, "D"], [11, "D"], [14, "p"]),
  r([10, "DDDp"]),
  r([11, "Dp"]),
  r([11, "Dp"]),
  r([10, "kKKk"]),
  r([9, "kKKKKk"]),
];

/** 솜사탕 가게 — 줄무늬 차양 + 막대 솜사탕. */
const COTTONCANDY = [
  r([6, "hh"], [11, "hh"], [16, "hh"]),
  r([5, "hwwh"], [10, "hHHh"], [15, "hwwh"]),
  r([5, "hwwh"], [10, "hHHh"], [15, "hwwh"]),
  r([6, "hk"], [11, "hk"], [16, "hk"]),
  r([7, "k"], [12, "k"], [17, "k"]),
  r([4, "oooooooooooooooo"]),
  r([3, "owwmmwwmmwwmmwwmmo"]),
  r([3, "oooooooooooooooooo"]),
  r([4, "pp"], [18, "pp"]),
  r([4, "pNnnnnnnnnnnnnnp"]),
  r([4, "pNnnnyyyyyynnnnp"]),
  r([4, "pNnnnnnnnnnnnnnp"]),
  r([4, "pppppppppppppppp"]),
  r([5, "kk"], [16, "kk"]),
];

/** 서커스 텐트 — 빨강·흰 줄무늬 큰 천막 + 깃발. */
const CIRCUSTENT = [
  r([11, "y"]),
  r([11, "yy"]),
  r([11, "k"]),
  r([11, "oo"]),
  r([10, "oHwo"]),
  r([9, "oHwmmo"]),
  r([7, "oHwwmmwwo"]),
  r([6, "oHwwmmwwmmo"]),
  r([5, "oHwwmmwwmmwwo"]),
  r([4, "oHwwmmwwmmwwmmo"]),
  r([3, "oHwwmmwwmmwwmmwwo"]),
  r([2, "oHwwmmwwmmwwmmwwmmo"]),
  r([2, "oooooooooooooooooooo"]),
  r([2, "omwwmmwwkkkkwwmmwwmo"]),
  r([2, "omwwmmwwkKKkwwmmwwmo"]),
  r([2, "omwwmmwwkKKkwwmmwwmo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 꼬마 기차 — 파란 기관차 + 연기. */
const MINITRAIN = [
  r([4, "ww"], [8, "w"]),
  r([3, "wwww"], [8, "ww"]),
  r([4, "ww"]),
  r([4, "oo"], [11, "ooooooo"]),
  r([4, "oMo"], [11, "oHmmmmo"]),
  r([4, "oMo"], [11, "omwwwMo"]),
  r([3, "oooooooooooooooo"]),
  r([3, "oHmmmmmmmmmmmmmMo"]),
  r([3, "omyyyymmmmmmmmmDo"]),
  r([3, "omMMMMMMMMMMMMMDo"]),
  r([2, "oooooooooooooooooo"]),
  r([4, "pNNp"], [9, "pNNp"], [15, "pNNp"]),
  r([4, "pKKp"], [9, "pKKp"], [15, "pKKp"]),
  r([1, "kkkkkkkkkkkkkkkkkkkkk"]),
];

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
  // 숲속 — 나무 + 이끼
  pine: { rows: PINE, main: PIXEL_PAL.leaf, sub: PIXEL_PAL.brown },
  stump: { rows: STUMP, main: PIXEL_PAL.brown, sub: PIXEL_PAL.brown },
  mushhouse: { rows: MUSHHOUSE, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: PIXEL_PAL.cream },
  campfire: { rows: CAMPFIRE, main: PIXEL_PAL.gold, sub: PIXEL_PAL.brown },
  deer: { rows: DEER, main: ["#e8c08a", "#c08b4a", "#8a5a28"], sub: PIXEL_PAL.brown },
  // 랜드마크 — 크고 비싼 대형 오브젝트
  fountain: { rows: FOUNTAIN, main: PIXEL_PAL.gray, sub: PIXEL_PAL.water },
  lighthouse: { rows: LIGHTHOUSE, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: PIXEL_PAL.white },
  hotspring: { rows: HOTSPRING, main: PIXEL_PAL.water, sub: PIXEL_PAL.gray },
  bridge: { rows: BRIDGE, main: PIXEL_PAL.violet, sub: PIXEL_PAL.water },
  castle: { rows: CASTLE, main: PIXEL_PAL.gray, sub: PIXEL_PAL.water },
  // ── 2026-09-23 확장 26종 ──
  beehive: { rows: BEEHIVE, main: ["#f2dc9a", "#dcb55c", "#a8823a"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  henhouse: { rows: HENHOUSE, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  cowshed: { rows: COWSHED, main: ["#ffffff", "#f2f4fb", "#d5daea"], sub: ["#5a6072", "#414657", "#2b2f3d"] },
  haystack: { rows: HAYSTACK, main: ["#ffe08a", "#ffc93f", "#e0a02e"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  windmill: { rows: WINDMILL, main: ["#fff3d9", "#ffe1ad", "#e8bd7e"], sub: ["#ff9a9a", "#e0454f", "#9c1a2a"] },
  scarecrow: { rows: SCARECROW, main: ["#fff3d9", "#ffe1ad", "#e8bd7e"], sub: ["#8fb8ff", "#4f7fe0", "#2b4f9e"] },
  jangdok: { rows: JANGDOK, main: ["#c99a6e", "#a3764f", "#775435"], sub: ["#e6e9f2", "#c3c9da", "#949cb3"] },
  pavilion: { rows: PAVILION, main: ["#5a6072", "#414657", "#2b2f3d"], sub: ["#ff9a9a", "#e0454f", "#9c1a2a"] },
  lantern: { rows: LANTERN, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#5a78c8", "#34509e", "#1f3372"] },
  stonewall: { rows: STONEWALL, main: ["#e6e9f2", "#c3c9da", "#949cb3"], sub: ["#5a6072", "#414657", "#2b2f3d"] },
  lotus: { rows: LOTUS, main: ["#7fd8f0", "#46b6dd", "#2b87b3"], sub: ["#ffb3cd", "#ff7fae", "#e05287"] },
  cafetable: { rows: CAFETABLE, main: ["#ffffff", "#f2f4fb", "#d5daea"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  coffeecart: { rows: COFFEECART, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  plantpot: { rows: PLANTPOT, main: ["#6fd08a", "#3a9a5a", "#1f6a3a"], sub: ["#f0a47a", "#cf6f45", "#95472a"] },
  menuboard: { rows: MENUBOARD, main: ["#ffffff", "#f2f4fb", "#d5daea"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  stringlights: { rows: STRINGLIGHTS, main: ["#ffb3cd", "#ff7fae", "#e05287"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  snowman: { rows: SNOWMAN, main: ["#bfe6ff", "#8fcaf0", "#5e9ccc"], sub: ["#ff9a9a", "#e0454f", "#9c1a2a"] },
  xmastree: { rows: XMASTREE, main: ["#6fd08a", "#3a9a5a", "#1f6a3a"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  sled: { rows: SLED, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#c99a6e", "#a3764f", "#775435"] },
  igloo: { rows: IGLOO, main: ["#bfe6ff", "#8fcaf0", "#5e9ccc"], sub: ["#5a6072", "#414657", "#2b2f3d"] },
  giftbox: { rows: GIFTBOX, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#6fd08a", "#3a9a5a", "#1f6a3a"] },
  carousel: { rows: CAROUSEL, main: ["#ffb3cd", "#ff7fae", "#e05287"], sub: ["#ffe08a", "#ffc93f", "#e0a02e"] },
  balloons: { rows: BALLOONS, main: ["#ffb3cd", "#ff7fae", "#e05287"], sub: ["#7fd8f0", "#46b6dd", "#2b87b3"] },
  cottoncandy: { rows: COTTONCANDY, main: ["#ffb3cd", "#ff7fae", "#e05287"], sub: ["#fff3d9", "#ffe1ad", "#e8bd7e"] },
  circustent: { rows: CIRCUSTENT, main: ["#ff9a9a", "#e0454f", "#9c1a2a"], sub: ["#5a6072", "#414657", "#2b2f3d"] },
  minitrain: { rows: MINITRAIN, main: ["#8fb8ff", "#4f7fe0", "#2b4f9e"], sub: ["#5a6072", "#414657", "#2b2f3d"] },
};

/** 스프라이트 캐시 — 객체 identity 안정화(이유는 pixelcrop.ts 의 cropCache 주석 참조).
 *  호출부가 JSX 안에서 매번 새 객체를 만들면 캔버스가 통째로 재할당·재도색된다.
 *  스프라이트는 불변이라 공유해도 안전하다. */
const decorCache = new Map<string, Sprite>();

export function decorSprite(key: string): Sprite {
  const hit = decorCache.get(key);
  if (hit) return hit;
  const made = build_decorSprite(key);
  decorCache.set(key, made);
  return made;
}

function build_decorSprite(key: string): Sprite {
  const def = D[key] ?? D.tulip;
  return mk(def.rows, dpal(def.main, def.sub));
}

export const ALL_DECOR_SPRITES: Record<string, Sprite> = Object.fromEntries(
  Object.keys(D).map((k) => [k, decorSprite(k)]),
);
