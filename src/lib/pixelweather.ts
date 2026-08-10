/* 날씨 픽셀 아이콘 8종 (24×24). [2026-08-11 날씨 탭]
 *
 * 1차판(16×16)은 사용자 판단이 정확했다 — "눈/비/흐림 다 비슷비슷하잖아".
 * 원인은 둘: (a) 판이 좁아 특징을 그릴 자리가 없었고, (b) **구름 하나를 공유**하고
 * 아래 1px 점만 바꿨다. 점 세 개가 비인지 눈인지는 아무도 못 읽는다.
 *
 * 그래서 이번 판의 규칙 — 조건마다 **실루엣과 구름 색을 함께** 가른다:
 *   · 비    = 어두운 청회색 비구름 + 빗줄기(2px 세로선 여러 가닥)
 *   · 이슬비 = 밝은 구름 + 성긴 짧은 방울(비와 구름 색부터 다르다)
 *   · 눈    = 얼음빛 흰 구름 + **진짜 눈송이**(5×5 ❄ 두 개)
 *   · 흐림  = 구름 **두 겹**(뒤 밝음 + 앞 회색) — 강수 없음이 실루엣으로 보인다
 *   · 안개  = 구름 아랫단이 가로 띠로 풀어진다(바닥 외곽선이 없다)
 *   · 뇌우  = 먹구름 + 큰 번개(판 절반 높이)
 *   · 해/구름해 = 금색 해(광선 8방향), 구름해는 해가 뒤에서 내다본다
 *
 * 저작 규약은 pixelbubble.ts 와 같다 — 행을 문자열로 적되 mk() 가 validateSprite 로
 * 즉시 검사한다(길이 24가 아닌 줄·팔레트에 없는 글자는 import 시점에 throw).
 * 카드 배경(라이트=흰색, 다크=남색) 위라 **모든 아이콘에 어두운 외곽선**(휘도<0.5)을 두른다.
 *
 * 렌더 크기는 24의 정수배만(24/48/72) — PixelSprite 가 반올림하므로 호출부가 지킨다.
 */

import { type Palette, type Sprite, validateSprite } from "./pixel.ts";
import type { WeatherIconKind } from "./weather.ts";

function mk(name: string, pal: Palette, rows: string[]): Sprite {
  const s: Sprite = { w: 24, h: 24, pal, rows };
  const errs = validateSprite(s, name);
  if (errs.length) throw new Error(`${name}: ${errs.join(" / ")}`);
  return s;
}

const E = "........................"; // 빈 행

/* 해 톤 — 외곽선 휘도 < 0.5 유지(흰 카드 위에서 형태가 잡혀야 한다) */
const SUN_PAL = { o: "#a87708", Y: "#ffd75e", H: "#fff3c4", y: "#f2b83a" } as const;

/* 밝은 구름(이슬비·구름해가 쓴다) */
const LIGHT_CLOUD = { o: "#4a4f63", H: "#ffffff", B: "#e6ebf7", d: "#c6cfe4" } as const;

const SPRITES: Record<WeatherIconKind, Sprite> = {
  /* 해 — 광선 8방향 + 좌상단 하이라이트(광원 규약과 동일) */
  sun: mk("sun", { ...SUN_PAL }, [
    E,
    "...........yy...........",
    "...........yy...........",
    "....y..............y....",
    ".....y............y.....",
    ".........oooooo.........",
    ".......ooYYYYYYoo.......",
    "......oYHHYYYYYYYo......",
    "......oYHHYYYYYYYo......",
    ".....oYHHYYYYYYYYYo.....",
    ".yy..oYYYYYYYYYYYYo..yy.",
    ".yy..oYYYYYYYYYYYYo..yy.",
    ".....oYYYYYYYYYYYYo.....",
    ".....oYYYYYYYYYYYYo.....",
    "......oYYYYYYYYYYo......",
    "......oYYYYYYYYYYo......",
    ".......ooYYYYYYoo.......",
    ".........oooooo.........",
    ".....y............y.....",
    "....y..............y....",
    "...........yy...........",
    "...........yy...........",
    E,
    E,
  ]),

  /* 구름해 — 해는 오른쪽 위(별도 외곽선 O = 금색), 구름이 앞.
     ⚠ 해 외곽선은 `O`다. SUN_PAL 을 통째로 스프레드하면 그쪽 `o`가 구름 외곽선까지
     금색으로 덮는다 — 16판에서 실제로 냈고 PNG 를 굽고서야 보인 사고다. */
  partly: mk(
    "partly",
    { ...LIGHT_CLOUD, O: SUN_PAL.o, Y: SUN_PAL.Y, y: SUN_PAL.y },
    [
      "..................y.....",
      "..............OOOO......",
      ".............OYYYYO.....",
      "...........OOYYYYYYOO...",
      "...........OYYYYYYYYO.y.",
      "..........OYYYYYYYYYO...",
      "..........OYYYYYYYYYO...",
      "........oooOYYYYYYYYO...",
      "......ooHHHOOYYYYYYO....",
      ".....oHHHHHHHOOOOOO.....",
      "...ooHHHHHHHHHHoo.......",
      "..oHHHHHHHHHHHHHHo......",
      ".oHHHHHHHHHHHHHHHHoo....",
      ".oHBBBBBBBBBBBBBBBBo....",
      ".oBBBBBBBBBBBBBBBBddo...",
      "..oodBBBBBBBBBBBBddoo...",
      "....ooooooooooooooo.....",
      E,
      E,
      E,
      E,
      E,
      E,
      E,
    ],
  ),

  /* 흐림 — 구름 두 겹. 뒤(밝음)가 오른쪽 위, 앞(회색)이 왼쪽 아래를 덮는다.
     강수가 없다는 게 실루엣만으로 읽혀야 비·눈과 갈린다. */
  cloud: mk(
    "cloud",
    { o: "#4a4f63", H: "#ffffff", B: "#e6ebf7", F: "#c3cadd", G: "#a6afc9" },
    [
      E,
      E,
      "..............oooo......",
      "............ooHHHHoo....",
      "...........oHHHHHHHHo...",
      "..........oHHHHHHHHHHo..",
      "..........oHHHHHHHHHHo..",
      ".......oooHBBBBBBBBBBo..",
      "......ooFFoBBBBBBBBBo...",
      "....ooFFFFFFooooooooo...",
      "...oFFFFFFFFFFoo........",
      "..oFFFFFFFFFFFFFo.......",
      ".oFFFFFFFFFFFFFFFoo.....",
      ".oFFFFFFFFFFFFFFFFFo....",
      ".oFGGFFFFFFFFFFFFGGo....",
      "..ooGGFFFFFFFFFGGGoo....",
      "....ooooooooooooooo.....",
      E,
      E,
      E,
      E,
      E,
      E,
      E,
    ],
  ),

  /* 안개 — 구름 아랫단이 띠로 풀어진다. 바닥 외곽선이 **없다**(녹아내리는 중). */
  fog: mk(
    "fog",
    { o: "#4a4f63", H: "#f4f6fb", B: "#dde3f0", m: "#98a1b8" },
    [
      E,
      E,
      "..........oooo..........",
      "........ooHHHHoo........",
      ".....oooHHHHHHHHoo......",
      "....oHHHHHHHHHHHHHo.....",
      "...oHHHHHHHHHHHHHHHo....",
      "...oHBBBBBBBBBBBBBHo....",
      "....BBBBBBBBBBBBBBB.....",
      E,
      "..mmmmmmmmmmmmmmmmmmm...",
      E,
      "....mmmmmmmmmmmmmmmmmm..",
      E,
      "..mmmmmmmmmmmmmm........",
      E,
      E,
      E,
      E,
      E,
      E,
      E,
      E,
      E,
    ],
  ),

  /* 이슬비 — **작고 밝은** 구름 + 성긴 짧은 방울. 비와는 구름 크기·색부터 다르다.
     (같은 구름을 쓰면 방울 몇 개 차이뿐이라 한 눈에 안 갈린다 — 실루엣 lock 이 잡았다) */
  drizzle: mk("drizzle", { ...LIGHT_CLOUD, r: "#5fb0ff" }, [
    E,
    E,
    E,
    E,
    "...........oooo.........",
    ".........ooHHHHoo.......",
    "......oooHHHHHHHHo......",
    ".....oHHHHHHHHHHHHo.....",
    ".....oHBBBBBBBBBBBo.....",
    ".....oBBBBBBBBBBBdo.....",
    "......oooooooooooo......",
    E,
    ".......r......r.........",
    E,
    E,
    "..........r......r......",
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /* 비 — **어두운 청회색 비구름** + 빗줄기 2px 세로선. 하늘이 무거워야 비다. */
  rain: mk(
    "rain",
    { o: "#3f4a66", H: "#b9c4dd", B: "#93a3c4", d: "#7185ab", r: "#3d9bff" },
    [
      E,
      E,
      "..........oooo..........",
      "........ooHHHHoo........",
      ".....oooHHHHHHHHoo......",
      "....oHHHHHHHHHHHHHo.....",
      "...oHHHBBBBBBBBBBBHo....",
      "...oHBBBBBBBBBBBBBdo....",
      "...oBBBBdddddddddddo....",
      "....ooooooooooooooo.....",
      E,
      "....r....r....r....r....",
      "....r....r....r....r....",
      E,
      "......r....r....r.......",
      "......r....r....r.......",
      E,
      "....r....r....r....r....",
      "....r....r....r....r....",
      E,
      E,
      E,
      E,
      E,
    ],
  ),

  /* 눈 — **얼음빛 흰 구름** + 진짜 눈송이(5×5 ❄ 둘). 점이 아니라 결정이어야 눈이다. */
  snow: mk(
    "snow",
    { o: "#55627f", H: "#f6faff", B: "#dfeafa", d: "#bdd2ee", w: "#8fc3ff" },
    [
      E,
      E,
      "..........oooo..........",
      "........ooHHHHoo........",
      ".....oooHHHHHHHHoo......",
      "....oHHHHHHHHHHHHHo.....",
      "...oHHHHHHHHHHHHHHHo....",
      "...oHBBBBBBBBBBBBBBo....",
      "...oBBBBBBBBBBBBBddo....",
      "....ooooooooooooooo.....",
      E,
      E,
      E,
      "......w.................",
      "....w.w.w...............",
      ".....www.......w........",
      "....w.w.w....w.w.w......",
      "......w.......www.......",
      ".............w.w.w......",
      "...............w........",
      E,
      E,
      E,
      E,
    ],
  ),

  /* 뇌우 — 먹구름 + 판 절반 높이의 번개. 멀리서도 이것만은 헷갈리면 안 된다. */
  thunder: mk(
    "thunder",
    { o: "#2e3450", H: "#a7aec7", B: "#7c86a6", d: "#5b6485", z: "#ffd23e", Z: "#e0a817" },
    [
      E,
      E,
      "..........oooo..........",
      "........ooHHHHoo........",
      ".....oooHHHHHHHHoo......",
      "....oHHHHHHHHHHHHHo.....",
      "...oHHHBBBBBBBBBBBHo....",
      "...oHBBBBBBBBBBBBBdo....",
      "...oBBBddddddddddddo....",
      "....ooooooooooooooo.....",
      "..........zzz...........",
      ".........zzz............",
      "........zzzz............",
      ".........zzzzzZ.........",
      "...........zzz..........",
      "..........zz............",
      ".........zz.............",
      "........z...............",
      E,
      E,
      E,
      E,
      E,
      E,
    ],
  ),
};

export const WEATHER_KINDS = Object.keys(SPRITES) as WeatherIconKind[];

export function weatherSprite(kind: WeatherIconKind): Sprite {
  return SPRITES[kind];
}
