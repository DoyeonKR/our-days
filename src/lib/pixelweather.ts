/* 날씨 픽셀 아이콘 8종 (16×16). [2026-08-11 날씨 탭]
 *
 * 이모지를 안 쓰는 이유: 이 앱은 UI 크롬 이모지를 전면 걷어냈고(icons.ts), 날씨 아이콘은
 * 탭 화면의 주인공이라 픽셀 정체성을 따라야 한다. 이모지는 기기마다 생김새도 다르다.
 *
 * 저작 규약은 pixelbubble.ts 와 같다 — 행을 문자열로 적되 mk() 가 validateSprite 로
 * 즉시 검사한다(길이가 16이 아닌 줄·팔레트에 없는 글자는 import 시점에 throw).
 * 카드 배경(라이트=흰색, 다크=남색) 위에 놓이므로 **모든 아이콘에 어두운 외곽선**을 두른다
 * — 흰 구름이 흰 카드 위에서 사라지지 않는 유일한 방법이다.
 *
 * 글자: o 외곽선 · H 구름 밝음 · B 구름 기본 · Y 해 중심 · y 햇살 ·
 *       r 빗방울 · w 눈송이 · m 안개띠 · z 번개
 */

import { type Palette, type Sprite, validateSprite } from "./pixel.ts";
import type { WeatherIconKind } from "./weather.ts";

function mk(name: string, pal: Palette, rows: string[]): Sprite {
  const s: Sprite = { w: 16, h: 16, pal, rows };
  const errs = validateSprite(s, name);
  if (errs.length) throw new Error(`${name}: ${errs.join(" / ")}`);
  return s;
}

/* 공용 톤 — 아이콘끼리 색이 놀지 않게 한 벌로 통일 */
const CLOUD_PAL = {
  o: "#4a4f63", // 외곽선(흰 카드 위 대비의 책임자)
  H: "#ffffff",
  B: "#dfe4f2",
} as const;
const SUN_PAL = {
  // ⚠ 외곽선 휘도 < 0.5 유지 — 금색이라도 흰 카드 위에서 형태가 잡혀야 한다
  o: "#a87708",
  Y: "#ffd75e",
  y: "#f2b83a",
} as const;

/** 구름 몸통(0~8행) — 비/눈/뇌우/안개가 공유한다. 아래 7행에 각자의 특징이 붙는다. */
const CLOUD_TOP = [
  "................",
  "......oooo......",
  ".....oHHHHo.....",
  "...ooHHHHHHo....",
  "..oHHHHHHHHHoo..",
  ".oHHHHHHHHHHHHo.",
  ".oBBBBBBBBBBBBo.",
  ".oBBBBBBBBBBBBo.",
  "..oooooooooooo..",
];
const BLANK = "................";

const SPRITES: Record<WeatherIconKind, Sprite> = {
  sun: mk("sun", { ...SUN_PAL }, [
    BLANK,
    "......yy........",
    "......yy........",
    "...y........y...",
    "......oooo......",
    ".....oYYYYo.....",
    "....oYYYYYYo....",
    "yy..oYYYYYYo..yy",
    "yy..oYYYYYYo..yy",
    "....oYYYYYYo....",
    ".....oYYYYo.....",
    "......oooo......",
    "...y........y...",
    "......yy........",
    "......yy........",
    BLANK,
  ]),

  /* 해가 구름 뒤에서 내다본다 — 해는 오른쪽 위, 구름이 앞.
     ⚠ 해 외곽선은 `O`(금색)다. SUN_PAL 을 통째로 스프레드하면 그쪽 `o` 가 구름
     외곽선(남회색)까지 금색으로 덮는다 — 실제로 그랬고 PNG 를 굽고서야 보였다. */
  partly: mk("partly", { ...CLOUD_PAL, O: SUN_PAL.o, Y: SUN_PAL.Y, y: SUN_PAL.y }, [
    "..........yy....",
    "..........OOOO..",
    ".........OYYYYO.",
    ".........OYYYYO.",
    "....ooooooYYYYO.",
    "...oHHHHHHOOOO..",
    "..oHHHHHHHHHHo..",
    ".oHHHHHHHHHHHHo.",
    ".oBBBBBBBBBBBBo.",
    ".oBBBBBBBBBBBBo.",
    "..oooooooooooo..",
    BLANK,
    BLANK,
    BLANK,
    BLANK,
    BLANK,
  ]),

  cloud: mk("cloud", { ...CLOUD_PAL }, [
    BLANK,
    BLANK,
    ...CLOUD_TOP.slice(1),
    BLANK,
    BLANK,
    BLANK,
    BLANK,
    BLANK,
    BLANK,
  ]),

  fog: mk("fog", { ...CLOUD_PAL, m: "#9aa2b8" }, [
    ...CLOUD_TOP,
    BLANK,
    "..mmmm..mmmm....",
    BLANK,
    "....mmmm..mmm...",
    BLANK,
    BLANK,
    BLANK,
  ]),

  drizzle: mk("drizzle", { ...CLOUD_PAL, r: "#4aa8ff" }, [
    ...CLOUD_TOP,
    BLANK,
    "....r......r....",
    BLANK,
    "......r.....r...",
    BLANK,
    BLANK,
    BLANK,
  ]),

  rain: mk("rain", { ...CLOUD_PAL, r: "#4aa8ff" }, [
    ...CLOUD_TOP,
    BLANK,
    "...r....r....r..",
    "...r....r....r..",
    BLANK,
    ".....r....r.....",
    ".....r....r.....",
    BLANK,
  ]),

  snow: mk("snow", { ...CLOUD_PAL, w: "#7fb7ff" }, [
    ...CLOUD_TOP,
    BLANK,
    "...w....w....w..",
    BLANK,
    ".....w....w.....",
    BLANK,
    "...w....w....w..",
    BLANK,
  ]),

  thunder: mk("thunder", { ...CLOUD_PAL, z: "#ffd75e", o: "#4a4f63" }, [
    ...CLOUD_TOP,
    ".......zz.......",
    "......zz........",
    ".....zzzz.......",
    ".......zz.......",
    "......zz........",
    ".....zz.........",
    BLANK,
  ]),
};

export const WEATHER_KINDS = Object.keys(SPRITES) as WeatherIconKind[];

export function weatherSprite(kind: WeatherIconKind): Sprite {
  return SPRITES[kind];
}
