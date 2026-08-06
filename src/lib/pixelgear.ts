// 히어로 장비 픽셀 스프라이트 — 무기 3 · 모자 3 · 망토 3.
//
// [사용자 요청 2026-08-05 "히어로 무기나 치장 아이템"]
// 치장은 **보여야** 치장이다. 스탯만 오르고 그림이 그대로면 그냥 버프 아이템이다.
//
// ⚠ 앵커를 폼별로 손보정하지 않는다. 펫은 12종(알·병아리·중간 6·최종 12)이고 실루엣이
//   제각각이라 좌표를 박으면 어딘가는 반드시 어긋난다. 대신 PixelPet 이 **그 프레임의
//   잉크 바운딩박스**를 재서 모자는 머리 위, 무기는 오른쪽 어깨, 망토는 뒤에 놓는다.
//   그래서 이 파일의 스프라이트는 자기 자신만 그리면 되고, 어디에 놓일지는 몰라도 된다.

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

/** 폭 w 행 — [시작x, 문자들] 런으로만 적는다(점을 손으로 세면 하나 빠져도 안 보인다). */
const mkRow = (w: number) => (...runs: readonly (readonly [number, string])[]): string => {
  const a = new Array<string>(w).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= w) throw new Error(`gear row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
};

/** 장비 팔레트 — 주색(a 계열) + 보조색(b 계열). 색은 PAL 그대로(같은 세계). */
function gearPal(main: readonly string[], sub: readonly string[]): Palette {
  const A = ramp(main);
  const B = ramp(sub);
  return {
    o: A.o, H: A.H, a: A.b, A: A.B, d: A.d, D: A.D,
    p: B.o, h: B.H, b: B.b, B: B.B, k: B.d, K: B.D,
    s: "#fff3b0",
  };
}

type GearSprite = Sprite;
const sprite = (w: number, rows: string[], pal: Palette): GearSprite => ({ w, h: rows.length, pal, rows });

/* ── 무기 (오른쪽 어깨에 세워 든다 · 세로로 길다) ────────────── */

const r6 = mkRow(6);
const STICK: GearSprite = sprite(
  6,
  [
    r6([2, "oo"]),
    r6([2, "aA"]),
    r6([2, "aA"]),
    r6([2, "aA"]),
    r6([1, "oaAo"]),
    r6([2, "aA"]),
    r6([2, "aA"]),
    r6([2, "aA"]),
    r6([2, "dD"]),
    r6([2, "oo"]),
  ],
  gearPal(PIXEL_PAL.brown, PIXEL_PAL.leaf),
);

const r7 = mkRow(7);
const WAND: GearSprite = sprite(
  7,
  [
    r7([3, "s"]),
    r7([2, "shs"]),
    r7([1, "shBhs"]),
    r7([2, "shs"]),
    r7([3, "s"]),
    r7([3, "o"]),
    r7([3, "A"]),
    r7([3, "A"]),
    r7([3, "A"]),
    r7([3, "A"]),
    r7([3, "D"]),
    r7([3, "o"]),
  ],
  gearPal(PIXEL_PAL.brown, PIXEL_PAL.gold),
);

const r9 = mkRow(9);
/** 무등산 수박검 — 전설 무기. 날은 수박 속(붉은 살 + 검은 씨), 손잡이는 껍질(진초록). */
const MELONSWORD: GearSprite = sprite(
  9,
  [
    r9([4, "o"]),
    r9([3, "oHo"]),
    r9([3, "oHo"]),
    r9([2, "oHHHo"]),
    r9([2, "oHkHo"]),
    r9([2, "oHHHo"]),
    r9([2, "oHkHo"]),
    r9([2, "oHHHo"]),
    r9([1, "obbbbbo"]),
    r9([3, "oBo"]),
    r9([3, "aBa"]),
    r9([3, "aBa"]),
    r9([3, "aBa"]),
    r9([3, "oDo"]),
  ],
  // 주색 = 손잡이(껍질 진초록), 보조색 = 날(수박 속 붉은살). H 는 주색 하이라이트라
  // 날을 밝게 하려고 rose 를 주색 자리에 넣지 않고, 아래 오버라이드로 H 만 바꾼다.
  {
    ...gearPal(["#5fbd63", "#1f7233", "#0a3016"], PIXEL_PAL.gold),
    H: "#ff8a94", // 수박 속살
    k: "#2b2f3d", // 씨
  },
);

/* ── 모자 (머리 위 · 가로로 넓다) ─────────────────────────── */

const r16 = mkRow(16);
const STRAW: GearSprite = sprite(
  16,
  [
    r16([5, "oaaaao"]),
    r16([4, "oaAAAAao"]),
    r16([1, "oaaAAAAaaao"], [12, "aao"]),
    r16([0, "oaaaaaaaaaaaaaao"]),
    r16([0, "oDDDDDDDDDDDDDDo"]),
  ],
  gearPal(PIXEL_PAL.sand, PIXEL_PAL.brown),
);

const r12 = mkRow(12);
const RIBBON: GearSprite = sprite(
  12,
  [
    r12([1, "oo"], [8, "oo"]),
    r12([0, "obBo"], [7, "obBo"]),
    r12([0, "obBBo"], [6, "oBBbo"]),
    r12([3, "oBBBBo"]),
    r12([4, "oBBo"]),
    r12([0, "oaaaaaaaaao"]),
  ],
  gearPal(PIXEL_PAL.cream, PIXEL_PAL.rose),
);

const r14 = mkRow(14);
const CROWN: GearSprite = sprite(
  14,
  [
    r14([1, "o"], [6, "o"], [11, "o"]),
    r14([1, "oAo"], [5, "oAo"], [10, "oAo"]),
    r14([1, "oAAAAAAAAAAo"]),
    r14([1, "oAbAbAbAAAAo"]),
    r14([1, "oDDDDDDDDDDo"]),
    r14([1, "oooooooooooo"]),
  ],
  gearPal(PIXEL_PAL.gold, PIXEL_PAL.rose),
);

/* ── 망토 (펫 **뒤**에 그린다 · 어깨에서 아래로 퍼지는 플레어) ─────────────
 * ⚠ 폭이 펫(잉크 최대 46)보다 좁으면 **완전히 가려져 안 보인다** — 첫 판(22~26)이 그랬고,
 *   텍스트 합성으로 겹쳐보고서야 알았다. 56 으로 넓혀 실루엣 밖으로 날개처럼 나오게 한다. */
const r56 = mkRow(56);
const SCARF: GearSprite = sprite(
  56,
  [
    r56([22, "oaaaaaaaaaaao"]),
    r56([20, "oaaaaaaaaaaaaaaao"]),
    r56([17, "oaaaaaaaaaaaaaaaaaaaaao"]),
    r56([14, "oaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([12, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([10, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([8, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([6, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([5, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([4, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([3, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([2, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([1, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([1, "oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao"]),
    r56([2, "o.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa."]),
    r56([4, "o.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.aa.ao"]),
  ],
  gearPal(PIXEL_PAL.rose, PIXEL_PAL.cream),
);

const CLOAK: GearSprite = sprite(
  56,
  [
    r56([22, "oAAAAAAAAAAAo"]),
    r56([20, "oAAAAAAAAAAAAAAAo"]),
    r56([17, "oAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([14, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([12, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([10, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([8, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([6, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([5, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([4, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([3, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([2, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([1, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([1, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([2, "o.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA."]),
    r56([4, "o.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.AA.Ao"]),
  ],
  gearPal(PIXEL_PAL.night, PIXEL_PAL.violet),
);

/** 오로라 망토 — 위는 보라(밤하늘) 아래는 민트(빛). 색 띠가 오로라의 얼굴이다. */
const AURORA: GearSprite = sprite(
  56,
  [
    r56([22, "oBBBBBBBBBBBo"]),
    r56([20, "oBBBBBBBBBBBBBBBo"]),
    r56([17, "oBBBBBBBBBBBBBBBBBBBBBo"]),
    r56([14, "oBBBBBBBBBBBBBBBBBBBBBBBBBBBo"]),
    r56([12, "oBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBo"]),
    r56([10, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([8, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([6, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([5, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([4, "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo"]),
    r56([3, "oHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHo"]),
    r56([2, "oHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHo"]),
    r56([1, "oHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHo"]),
    r56([1, "oHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHo"]),
    r56([2, "o.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH."]),
    r56([4, "o.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.Ho"]),
  ],
  gearPal(PIXEL_PAL.mint, PIXEL_PAL.violet),
);

/** 장비 key → 스프라이트. island.ts 의 GEARS key 와 1:1(테스트가 강제한다). */
export const GEAR_SPRITES: Record<string, GearSprite> = {
  stick: STICK,
  wand: WAND,
  melonsword: MELONSWORD,
  straw: STRAW,
  ribbon: RIBBON,
  crown: CROWN,
  scarf: SCARF,
  cloak: CLOAK,
  aurora: AURORA,
};

export const gearSprite = (key: string): GearSprite | null => GEAR_SPRITES[key] ?? null;
