// 탭 점프 lock.
// [사용자 피드백 2026-08-05]
//   "히어로 터치하면 히어로만 움직이는게 아니고 네모 픽셀 자체가 움직여"
//   "연속 터치한 횟수에 따라서 점프 강도가 더 올라갔으면"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HOME_HOP_MAX, TAP_COMBO_MAX, homeHopPx } from "./petmotion.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
/** 주석을 뺀 **코드만**. 이 저장소는 '왜 그렇게 했는지'를 주석에 길게 남기는 스타일이라,
 *  소스를 통째로 정규식으로 훑으면 설명문이 먼저 잡힌다(이 세션에서만 세 번 오검출했다). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* ── 순수 함수: 연타할수록 강해진다 ───────────────────────────
 * (캔버스 무대 전용 점프 tapHop 은 그 무대(PixelPet)와 함께 2026-09-24 지웠다 — 섬도 이제
 *  DOM 히어로(HeroV2)라 홈과 같은 CSS 점프를 쓴다.) */

test("★ 홈 점프도 연타에 비례하되 실측 여유를 넘지 않는다", () => {
  let prev = 0;
  for (let c = 1; c <= TAP_COMBO_MAX; c++) {
    const h = homeHopPx(c);
    assert.ok(h >= prev, `콤보 ${c} 에서 낮아졌다`);
    assert.ok(h <= HOME_HOP_MAX, `${h}px > 상한 ${HOME_HOP_MAX}px — 히어로 무대 실측 여유를 넘는다`);
    prev = h;
  }
  assert.ok(homeHopPx(TAP_COMBO_MAX) > homeHopPx(1), "연타가 의미가 있어야 한다");
});

/* ── 배선: 배경은 통째로 움직이지 않는다 ───────────────────── */

test("★ 섬 픽셀 마을에는 CSS 무대 변형을 걸지 않는다 (네모가 통째로 움직이던 원인)", () => {
  const island = read("components/IslandGame.tsx");
  const i = island.indexOf("<PetTapFx");
  assert.ok(i > 0, "섬이 PetTapFx 를 쓴다");
  const block = island.slice(i, island.indexOf("</PetTapFx>", i));
  assert.ok(block.includes("<HeroV2"), "반응 래퍼 안에는 히어로만 있어야 한다");
  assert.ok(!block.includes("island-village-art"), "배경 전체가 탭 반응 래퍼 안으로 들어오면 안 된다");
});

test("★ 콤보를 state 로 세지 않는다 — 빠른 연타가 stale 값을 읽어 1 에서 멈춘다", () => {
  // 실측: 같은 틱에 10번 클릭했더니 콤보가 계속 1 이었다(전부 combo=0 을 읽어 0+1).
  // 점프 높이가 콤보 비례가 된 지금, 이건 곧 '연타해도 안 커진다'와 같은 말이다.
  for (const f of ["components/island/PetTapFx.tsx", "components/island/PetYard.tsx"]) {
    const s = code(f);
    assert.ok(/comboRef\s*=\s*useRef/.test(s), `${f}: 콤보는 ref 로 세야 한다`);
    assert.ok(!/\bsetCombo\(/.test(s), `${f}: setCombo 로 센 값을 다시 읽으면 stale 이다`);
    assert.ok(/comboRef\.current \+ 1/.test(s), `${f}: 누적은 ref 에서 읽어야 한다`);
  }
});

test("★ 점프 키프레임이 --pet-hop 을 읽는다 (홈이 연타에 반응하려면)", () => {
  const css = read("app/globals.css");
  for (const kf of ["pet-bounce", "pet-blast"]) {
    const b = css.slice(css.indexOf(`@keyframes ${kf}`), css.indexOf("}", css.indexOf(`.animate-${kf}`)));
    assert.ok(/var\(--pet-hop/.test(b), `${kf} 이 고정 px 를 쓴다 — 연타해도 높이가 안 변한다`);
  }
  const yard = read("components/island/PetYard.tsx");
  assert.ok(/--pet-hop/.test(yard) && /homeHopPx\(/.test(yard), "PetYard 가 콤보로 --pet-hop 을 설정해야 한다");
});
