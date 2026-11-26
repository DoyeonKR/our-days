// 쉬는 포유류가 잘 보이게(2026-11-17 [사용자: "포유류는 물 위에서 생활하는데 너무 잘 보이지가 않아 선택을해도 주변 조형물에 가려져"])
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABOVE_ELEV, BEACH_REST_FRONT, OCCLUDE_ALPHA } from "./scene.ts";

const src = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
test("following a body resting above the water looks at its real height and from above", () => {
  // 예전엔 따라가는 높이를 4.6(수면 아래)으로 잘라 모래사장 · 바위 위 몸 아래 물속을 봤다
  // 2026-11-26 — 위로 늘린 수조(tall)에선 해변 윗면이 tallY(5.82) 라 예전 상한(tallY(4.6)+2.4)보다 한참 위였다: 펭귄을 고르면 해변 아래 모래를 봤다.
  //   상한은 수면 + 1.6·tall, 서 있는 펭귄은 몸 가운데(upright · 몸길이 0.38)를 본다
  assert.match(src, /Math\.max\(tallY\(4\.6,tall\),Math\.min\(sel\.root\.position\.y\+\.15\+standUp,tallY\(5\.56,tall\)\+1\.6\*tall\)\)/);
  assert.match(src, /const standUp=\(sel\.course\.upright\?\?0\)\*shownLength\(sel\)\*\.38/);
  const tY = (y: number, t: number) => -5.3 + (y + 5.3) * t;
  for (const t of [1, 1.5, 2.625, 3.6]) assert.ok(tY(5.82, t) + 1.2 < tY(5.56, t) + 1.6 * t, `tall ${t}: 해변 위에 선 몸 가운데까지 따라간다`);
  assert.match(src, /const el=mealK\*mealElev\+aboveK\*ABOVE_ELEV/);
  assert.ok(ABOVE_ELEV > 0.25 && ABOVE_ELEV < 0.8);
});
test("decorations between the camera and the chosen body fade, then restore their own materials", () => {
  assert.match(src, /fadeOccluders\(sel&&!state\.editing&&!photoOn\?sel:undefined,dt\);/);
  assert.match(src, /ud\.fadeOrig=o\.material/);
  assert.match(src, /\(o\.material as T\.Material\|T\.Material\[\]\)=ud\.fadeOrig/);
  assert.ok(OCCLUDE_ALPHA > 0.05 && OCCLUDE_ALPHA < 0.5);
});
test("the beach resting spot sits on the back-right beach (2026-11-18 — the beach no longer reaches the front glass)", () => {
  assert.match(src, /z:3\*deep\*BEACH_REST_FRONT/);
  assert.ok(BEACH_REST_FRONT < -0.2 && BEACH_REST_FRONT > -0.8);
});
