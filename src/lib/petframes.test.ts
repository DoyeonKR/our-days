// 펫 걷기 프레임 회귀 lock. [2026-08-09 — 2프레임 → 6프레임]
//
// 이 성질들을 지키는 테스트가 **하나도 없었다**. 기존 검사(pixelart/wear/gear)는 전부
// `petSprites(form)[0]` 한 장만 봐서, 프레임을 6장으로 늘리면 검사 범위가 1/2 에서
// 1/6 로 줄어든 채 전부 통과한다. 늘린 만큼 눈이 필요하다.
//
// 잠그는 것 넷:
//  1. 프레임이 실제로 서로 다른가 — feet 가 boolean 이던 시절, 배열만 6칸으로 늘리면
//     똑같은 그림 3쌍이 나온다. 타이머만 6단계로 돌고 그림은 두 장이라 걷기가 뚝뚝 끊긴다.
//  2. 다리 실루엣이 안 끊기는가 — L·R·gap 은 한 묶음이다. 벌어짐만 바꾸고 gap 폭을
//     안 맞추면 두 다리 사이에 투명 구멍이 뚫린 채 렌더된다. row()/paint() 는 길이만 보지
//     연속성은 아무도 안 본다.
//  3. 얼굴 크롭 창(0~29행)이 프레임 간 동일한가 — PetPixel 의 face 모드가 고정 좌표로
//     자른다. 이 구역이 흔들리면 얼굴 아이콘이 프레임마다 정수리가 잘린다.
//  4. 장비 앵커가 프레임 간 동일한가 — PixelPet 은 **매 프레임** gearAnchors 를 다시 뽑는다.
//     정수리 판정이 그 프레임의 최대 연속 잉크에 상대적이라, 다리를 크게 벌린 프레임에서만
//     임계값이 달라지면 모자가 한 사이클에 한 번 머리에 잠겼다 나온다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { petSprites } from "./pixelart.ts";
import { GAIT_FRAMES } from "./pixelpet48.ts";
import { gearAnchors, pixelAt } from "./pixel.ts";

const SPECIES = ["fox", "cat", "bear", "panda", "owl", "wolf"];
const WALKERS = [...SPECIES, "hatchling", "celestial_fox", "royal_cat", "lunar_wolf"];

test("걷기 프레임 — 종별로 6장이고 서로 다르다 [회귀 lock]", () => {
  assert.ok(GAIT_FRAMES >= 4 && GAIT_FRAMES <= 6, `걸음 단계 ${GAIT_FRAMES} — 요구는 4~6`);
  for (const form of WALKERS) {
    const fr = petSprites(form);
    assert.equal(fr.length, GAIT_FRAMES, `${form}: 프레임 ${fr.length}`);
    // 인접 프레임이 같으면 그 프레임은 없는 것과 같다(타이머만 돌고 그림은 멈춘다)
    for (let i = 0; i < fr.length; i++) {
      const next = fr[(i + 1) % fr.length];
      assert.notDeepEqual(fr[i].rows, next.rows, `${form}: ${i}↔${(i + 1) % fr.length} 프레임이 동일`);
    }
    // 전부 48×48 — PetPixel 이 0번 프레임의 w/h 로 캔버스를 잡고 바닥을 맞춘다
    for (const [i, s] of fr.entries()) {
      assert.equal(s.w, 48, `${form} ${i}: 폭`);
      assert.equal(s.h, 48, `${form} ${i}: 높이`);
      assert.ok(/[^.]/.test(s.rows[47]), `${form} ${i}: 마지막 행이 비어 캐릭터가 뜬다`);
    }
  }
});

test("걷기 프레임 — 다리 사이 실루엣이 끊기지 않는다 [회귀 lock]", () => {
  for (const form of SPECIES) {
    for (const [i, s] of petSprites(form).entries()) {
      // 엉덩이 선(44행): 왼다리 시작부터 오른다리 끝까지 잉크가 연속이어야 한다.
      const row = 44;
      const xs: number[] = [];
      for (let x = 0; x < s.w; x++) if (pixelAt(s, x, row)) xs.push(x);
      assert.ok(xs.length, `${form} ${i}: 44행에 다리가 없다`);
      const lo = xs[0];
      const hi = xs[xs.length - 1];
      for (let x = lo; x <= hi; x++) {
        assert.ok(pixelAt(s, x, row), `${form} ${i}: 44행 x=${x} 에 구멍 — L·R 과 gap 폭이 안 맞는다`);
      }
    }
  }
});

test("걷기 프레임 — 얼굴 크롭 창(0~29행)이 프레임 간 동일하다 [회귀 lock]", () => {
  // PetPixel 의 FACE = { x: 6, y: 0, w: 36, h: 30 } 고정 좌표와 짝이다.
  // ⚠ **행 전체가 아니라 창 안(x 6~41)만** 본다. 최종형 오라 반짝임은 x=1·3·44·46 이라
  //   창 밖이고, 행 전체를 비교하면 정상인 반짝임까지 위반으로 잡힌다(실제로 그랬다).
  const FACE = { x: 6, y: 0, w: 36, h: 30 };
  for (const form of WALKERS) {
    const fr = petSprites(form);
    const win = (i: number) =>
      fr[i].rows.slice(FACE.y, FACE.y + FACE.h).map((r) => r.slice(FACE.x, FACE.x + FACE.w)).join("|");
    for (let i = 1; i < fr.length; i++) {
      assert.equal(win(i), win(0), `${form}: ${i}번 프레임의 얼굴 구역이 0번과 다르다`);
    }
  }
});

test("걷기 프레임 — 장비 앵커가 프레임 간 흔들리지 않는다 [회귀 lock]", () => {
  for (const form of SPECIES) {
    const fr = petSprites(form);
    const a0 = gearAnchors(fr[0]);
    for (let i = 1; i < fr.length; i++) {
      const a = gearAnchors(fr[i]);
      assert.deepEqual(
        { head: a.head, hand: a.hand, back: a.back },
        { head: a0.head, hand: a0.hand, back: a0.back },
        `${form}: ${i}번 프레임에서 앵커가 달라진다 — 모자·무기가 한 사이클에 한 번 튄다`,
      );
    }
  }
});

test("걷기 프레임 — 렌더러가 프레임 수를 상수로 들고 있지 않다 [회귀 lock]", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const here = join(import.meta.dirname, "..", "components", "island");
  for (const f of ["PixelPet.tsx", "PetPixel.tsx"]) {
    const raw = readFileSync(join(here, f), "utf8");
    // ⚠ 주석을 먼저 벗긴다 — 이 저장소는 '왜 그렇게 했는지'를 주석에 길게 남긴다.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // 걷기 프레임 선택에 2 가 박히면 3~6번 프레임이 화면에 한 번도 안 나온다.
    // (640ms 짜리 `frameAt(t, 2, 640)` 은 숨쉬기 1px 이라 예외 — 그건 프레임 수가 아니다.)
    for (const m of src.matchAll(/frameAt\(\s*t\s*,\s*2\s*,\s*(\d+)/g)) {
      assert.equal(m[1], "640", `${f}: frameAt(t, 2, ${m[1]}) — 프레임 수가 상수로 박혔다`);
    }
    assert.ok(/frameAt\(\s*t\s*,\s*\w+\.length/.test(src), `${f}: 프레임 수를 배열에서 읽어야 한다`);
  }
});
