// 탭 점프 lock.
// [사용자 피드백 2026-08-05]
//   "히어로 터치하면 히어로만 움직이는게 아니고 네모 픽셀 자체가 움직여"
//   "연속 터치한 횟수에 따라서 점프 강도가 더 올라갔으면"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  HOME_HOP_MAX,
  TAP_COMBO_MAX,
  TAP_HOP_MAX_PX,
  TAP_LAND_MS,
  homeHopPx,
  hopHeight,
  hopLift,
  hopMs,
  tapHop,
} from "./petmotion.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
/** 주석을 뺀 **코드만**. 이 저장소는 '왜 그렇게 했는지'를 주석에 길게 남기는 스타일이라,
 *  소스를 통째로 정규식으로 훑으면 설명문이 먼저 잡힌다(이 세션에서만 세 번 오검출했다). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* ── 순수 함수: 연타할수록 강해진다 ─────────────────────────── */

test("★ 연타 수가 늘면 점프가 계속 높아진다 — 단계가 아니라 연속", () => {
  // 예전엔 단계별 고정값이라 같은 단계 안에서는 3번을 눌러도 4번을 눌러도 똑같았다.
  let prev = 0;
  const seen = new Set<number>();
  for (let c = 1; c <= TAP_COMBO_MAX; c++) {
    const h = hopHeight(c);
    assert.ok(h >= prev, `콤보 ${c}: ${h} < 이전 ${prev} — 연타했는데 낮아지면 안 된다`);
    seen.add(h);
    prev = h;
  }
  // '연속'의 증거: 서로 다른 높이가 단계 수(4)보다 훨씬 많아야 한다.
  assert.ok(seen.size >= 8, `높이 종류가 ${seen.size}개뿐 — 단계별 고정값과 다를 게 없다`);
  assert.ok(hopHeight(TAP_COMBO_MAX) >= hopHeight(1) * 3, "만콤보는 첫 탭의 3배 이상은 되어야 체감된다");
});

test("★ 점프가 캔버스 밖으로 나가지 않는다", () => {
  // 논리 캔버스는 108px, 지면 84px, 스프라이트 48px → 머리 위 여유 ≒ 36px.
  assert.ok(TAP_HOP_MAX_PX <= 36, `상한 ${TAP_HOP_MAX_PX}px 이 여유(36px)를 넘는다 — 머리가 잘린다`);
  for (let c = 1; c <= TAP_COMBO_MAX * 2; c++) {
    assert.ok(hopHeight(c) <= TAP_HOP_MAX_PX, `콤보 ${c} 에서 상한 초과`);
  }
});

test("★ 오프셋이 전부 정수다 — 도트가 반픽셀에 앉으면 뭉갠다", () => {
  for (const c of [1, 3, 5, 8, 12]) {
    const dur = hopMs(c);
    for (let e = 0; e <= dur + TAP_LAND_MS; e += 7) {
      const { dx, dy } = tapHop(c, e);
      assert.ok(Number.isInteger(dx) && Number.isInteger(dy), `콤보 ${c} @${e}ms → (${dx}, ${dy})`);
    }
  }
});

test("★ 포물선이다 — 떴다가 반드시 내려온다", () => {
  for (const c of [1, 6, 12]) {
    const dur = hopMs(c);
    assert.equal(tapHop(c, 0).dy, 0, "시작은 지면");
    assert.ok(tapHop(c, dur / 2).dy <= -hopHeight(c) + 1, "중간이 최고점");
    assert.equal(tapHop(c, dur).dy, 0, "끝나면 지면으로 돌아온다");
    assert.equal(tapHop(c, dur + TAP_LAND_MS / 2).dy, 1, "착지 직후엔 1px 가라앉는다");
    assert.deepEqual(tapHop(c, dur + TAP_LAND_MS + 1), { dx: 0, dy: 0 }, "그 뒤엔 완전히 멈춘다");
  }
});

test("범위 밖/이상 입력에서도 조용히 0 을 준다", () => {
  for (const e of [-1, -9999, Number.NaN]) assert.deepEqual(tapHop(5, e), { dx: 0, dy: 0 });
  assert.ok(hopHeight(0) > 0 && hopHeight(-3) > 0, "콤보가 0/음수여도 점프는 한다");
});

test("그림자 축소값(hopLift)이 0~1 을 벗어나지 않는다", () => {
  for (const c of [1, 5, 12]) {
    const dur = hopMs(c);
    for (let e = 0; e <= dur; e += 11) {
      const v = hopLift(c, e);
      assert.ok(v >= 0 && v <= 1, `콤보 ${c} @${e}ms → ${v}`);
    }
  }
});

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

/* ── 배선: 캔버스 씬은 통째로 움직이지 않는다 ───────────────── */

test("★ 섬 픽셀 마을에는 CSS 무대 변형을 걸지 않는다 (네모가 통째로 움직이던 원인)", () => {
  const island = read("components/IslandGame.tsx");
  const i = island.indexOf("<PetTapFx");
  assert.ok(i > 0, "섬이 PetTapFx 를 쓴다");
  const block = island.slice(i, island.indexOf("</PetTapFx>", i));
  assert.ok(block.includes("<HeroV2"), "반응 래퍼 안에는 히어로만 있어야 한다");
  assert.ok(!block.includes("island-village-art"), "배경 전체가 탭 반응 래퍼 안으로 들어오면 안 된다");
});

test("★ PetTapFx 가 stageMotion=false 일 때 자식에 애니 클래스를 안 붙인다", () => {
  const fx = read("components/island/PetTapFx.tsx");
  // 삼항으로 갈라 한쪽 가지에만 tapClass 를 붙인다 — 두 가지 모두에 붙으면 의미가 없다.
  assert.ok(/stageMotion \?/.test(fx), "stageMotion 으로 렌더를 갈라야 한다");
  const off = fx.slice(fx.indexOf("stageMotion ?"));
  const elseArm = off.slice(off.indexOf(") : ("));
  assert.ok(!/tapClass/.test(elseArm), "stageMotion=false 가지에 tapClass 가 남아 있다");
  assert.ok(/R\.shake && stageMotion/.test(fx), "무대 흔들림도 캔버스에선 꺼야 한다");
});

test("★ 캔버스는 스프라이트만 옮긴다 — 배경은 미리 구운 그대로 쓴다", () => {
  const px = read("components/island/PixelPet.tsx");
  assert.ok(/tapHop\(/.test(px), "PixelPet 이 tapHop 으로 오프셋을 받아야 한다");
  // 오프셋은 펫 좌표에만 더한다. 배경(drawImage(bg)) 에 더하면 그림 전체가 움직인다.
  const bgLine = px.split("\n").find((l) => l.includes("ctx.drawImage(bg"));
  assert.ok(bgLine && !/j\.d[xy]/.test(bgLine), `배경 그리기에 점프 오프셋이 섞였다: ${bgLine}`);
  assert.ok(/petX = .*j\.dx/.test(px) && /petY = .*j\.dy/.test(px), "펫 좌표에만 오프셋이 붙어야 한다");
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
