// 날씨 픽셀 아이콘 회귀 lock. [2026-08-11]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WEATHER_KINDS, weatherSprite } from "./pixelweather.ts";
import { pixelAt, validateSprite } from "./pixel.ts";

/** #rrggbb → 상대 휘도(0~1 근사). */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

test("날씨 아이콘 — 8종 전부 16×16 규격이고 잉크가 있다", () => {
  assert.equal(WEATHER_KINDS.length, 8);
  for (const k of WEATHER_KINDS) {
    const s = weatherSprite(k);
    assert.deepEqual(validateSprite(s, k), [], `${k} 규격`);
    let ink = 0;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (pixelAt(s, x, y)) ink++;
    assert.ok(ink >= 30, `${k}: 잉크 ${ink}칸 — 아이콘이라기엔 비어 있다`);
  }
});

test("날씨 아이콘 — 실루엣이 서로 다르다(색만 다른 같은 그림 금지)", () => {
  const shapes = WEATHER_KINDS.map((k) => weatherSprite(k).rows.map((r) => r.replace(/[^.]/g, "#")).join("|"));
  // 구름 계열(fog/drizzle/rain/snow/thunder)은 위 9행을 공유하지만 아래 특징이 갈라야 한다
  assert.equal(new Set(shapes).size, WEATHER_KINDS.length, "실루엣이 겹치는 아이콘이 있다");
});

test("날씨 아이콘 — 전부 어두운 외곽선이 있다(흰 카드 위에서 사라지지 않게) [회귀 lock]", () => {
  for (const k of WEATHER_KINDS) {
    const s = weatherSprite(k);
    const dark = Object.values(s.pal).filter((c) => lum(c) < 0.5);
    assert.ok(dark.length >= 1, `${k}: 어두운 톤이 없다 — 라이트 카드에서 통째로 사라진다`);
    // 외곽선 글자가 실제로 찍혀 있는가 (팔레트에만 있고 안 쓰이면 소용없다)
    assert.ok(
      s.rows.some((r) => r.includes("o") || r.includes("O")),
      `${k}: 외곽선이 그려져 있지 않다`,
    );
  }
});

test("partly — 구름 외곽선은 남회색, 해 외곽선은 금색 [회귀 lock]", () => {
  // 실제로 낸 버그: SUN_PAL 을 통째로 스프레드해 그쪽 `o`(금색)가 구름 외곽선까지 덮었다.
  // 해 쪽은 별도 글자 `O` 를 쓴다 — PNG 를 굽고서야 보인 종류라 여기 잠근다.
  const p = weatherSprite("partly");
  assert.equal(p.pal.o, weatherSprite("cloud").pal.o, "구름 외곽선이 구름 아이콘과 같은 색이어야 한다");
  assert.ok(p.pal.O, "해 외곽선 글자 O 가 있어야 한다");
  assert.notEqual(p.pal.O, p.pal.o, "해/구름 외곽선이 같은 색이면 스프레드 사고 재발이다");
});

test("배선 — 날씨 탭이 있고 로그·일기장 뷰는 살아 있다(삭제 아님, 잠시 숨김) [회귀 lock]", () => {
  const here = import.meta.dirname;
  const nav = readFileSync(join(here, "..", "components", "BottomNav.tsx"), "utf8");
  const page = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
  // 날씨 탭 + 뷰 배선
  assert.ok(/k:\s*"weather"/.test(nav), "날씨 탭이 없다");
  assert.ok(page.includes("<WeatherView"), "page 가 WeatherView 를 안 그린다");
  // '잠시'의 계약: 로그·일기장 **뷰 코드**는 남아 있어야 한다. 탭만 뺐다.
  // (완전 삭제로 바꾸는 건 사용자의 별도 결정이다 — §14.1 처럼 한쪽만 지우면 죽은 코드가 남는다)
  assert.ok(page.includes('visited.has("log")'), "로그 뷰가 사라졌다 — 잠시 숨김이 삭제가 됐다");
  assert.ok(page.includes('visited.has("deco")'), "일기장 뷰가 사라졌다 — 잠시 숨김이 삭제가 됐다");
});
