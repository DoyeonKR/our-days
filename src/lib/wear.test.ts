// 장비 착용 lock — "쓰고/들고 있는 것처럼 보이는가".
//
// [사용자 리포트 2026-08-07 "직접 착용한 장비들이 너무 애매해.
//  칼은 들고있지도 않고 모자도 쓰고있는게 아니고"]
//
// 1차판은 앵커를 **잉크 바운딩박스 바깥**에 뒀다 — 모자는 박스 위, 무기는 박스 오른쪽.
// 숫자로는 "머리 위/몸 옆"이 맞는데 화면에선 **떠 있었다**. 착용은 겹쳐야 착용이다.
//
// 그래서 이 테스트는 좌표가 아니라 **겹침 칸 수**를 잰다 — 눈으로 보는 것과 같은 기준이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gearAnchors, pixelAt, type Sprite } from "./pixel.ts";
import { petSprites } from "./pixelart.ts";
import { gearSprite } from "./pixelgear.ts";
import { GEARS } from "./island.ts";

/** 앱에 실제로 존재하는 폼 전부(알·병아리·중간 6·최종 대표 4). */
const FORMS = [
  "egg", "hatchling", "fox", "cat", "bear", "panda", "owl", "wolf",
  "celestial_fox", "royal_cat", "guardian_bear", "lunar_wolf",
];

/** 장비 픽셀 중 펫 픽셀과 **같은 칸**에 오는 수. 이게 0 이면 허공에 떠 있는 것이다. */
function overlap(pet: Sprite, gear: Sprite, ox: number, oy: number): number {
  let n = 0;
  for (let y = 0; y < gear.h; y++)
    for (let x = 0; x < gear.w; x++) {
      if (!pixelAt(gear, x, y)) continue;
      const px = ox + x;
      const py = oy + y;
      if (px < 0 || px >= pet.w || py < 0 || py >= pet.h) continue;
      if (pixelAt(pet, px, py)) n++;
    }
  return n;
}

/** PixelPet/HuntStage 가 쓰는 것과 **같은 배치 수식**. 여기가 갈리면 테스트가 거짓말을 한다. */
const hatPos = (a: ReturnType<typeof gearAnchors>, g: Sprite) => ({
  x: a.head.x - Math.floor(g.w / 2),
  y: a.head.y - g.h,
});
const weaponPos = (a: ReturnType<typeof gearAnchors>, g: Sprite) => ({
  x: a.hand.x - Math.floor(g.w / 2),
  y: a.hand.y - Math.round(g.h * 0.75),
});

test("★ 모자가 모든 폼에서 머리에 얹힌다 — 귀 위 허공에 뜨면 안 된다", () => {
  const hats = GEARS.filter((g) => g.slot === "hat");
  for (const form of FORMS) {
    const pet = petSprites(form)[0];
    const a = gearAnchors(pet);
    assert.ok(a.ok, `${form}: 앵커 산출 실패`);
    for (const h of hats) {
      const g = gearSprite(h.key)!;
      const { x, y } = hatPos(a, g);
      const n = overlap(pet, g, x, y);
      assert.ok(n >= 4, `${form} × ${h.name}: 머리 겹침 ${n}칸 — 쓴 게 아니라 떠 있다`);
      assert.ok(y + g.h > 0, `${form} × ${h.name}: 모자가 스프라이트 밖(y=${y})`);
    }
  }
});

test("★ 무기가 모든 폼에서 몸에 걸쳐 쥐어진다 — 옆에 세워둔 것처럼 보이면 안 된다", () => {
  const weapons = GEARS.filter((g) => g.slot === "weapon");
  for (const form of FORMS) {
    const pet = petSprites(form)[0];
    const a = gearAnchors(pet);
    for (const w of weapons) {
      const g = gearSprite(w.key)!;
      const { x, y } = weaponPos(a, g);
      const n = overlap(pet, g, x, y);
      assert.ok(n >= 4, `${form} × ${w.name}: 몸 겹침 ${n}칸 — 쥔 게 아니라 옆에 있다`);
    }
  }
});

test("★ 정수리는 **연속 잉크**로 잡는다 — 귀 두 개의 바깥 거리를 두개골로 착각하면 안 된다", () => {
  // 이게 1차판이 틀린 지점이다. 귀 달린 종(여우·고양이·늑대…)에서만 터졌다.
  for (const form of ["fox", "cat", "wolf", "owl"]) {
    const pet = petSprites(form)[0];
    const a = gearAnchors(pet);
    // 정수리 행에는 **끊기지 않은** 넓은 잉크가 있어야 한다(귀 조각이 아니라 얼굴)
    let run = 0;
    let best = 0;
    for (let x = 0; x < pet.w; x++) {
      run = pixelAt(pet, x, a.head.y - 2) ? run + 1 : 0;
      if (run > best) best = run;
    }
    assert.ok(best >= 10, `${form}: 정수리 행의 연속 잉크가 ${best}칸 — 귀 사이 빈 곳을 잡았다`);
  }
});

test("정수리·손이 몸 안쪽 좌표다 — 밖으로 나가면 배치가 통째로 어긋난다", () => {
  for (const form of FORMS) {
    const pet = petSprites(form)[0];
    const a = gearAnchors(pet);
    for (const [name, pt] of [["정수리", a.head], ["손", a.hand], ["등", a.back]] as const) {
      assert.ok(pt.x >= 0 && pt.x < pet.w, `${form} ${name} x=${pt.x} 범위 밖`);
      assert.ok(pt.y >= 0 && pt.y < pet.h, `${form} ${name} y=${pt.y} 범위 밖`);
    }
    assert.ok(a.hand.y > a.head.y, `${form}: 손이 머리보다 위에 있다`);
  }
});

test("잉크가 없는 스프라이트에서도 안 터진다", () => {
  const empty: Sprite = { w: 8, h: 8, pal: {}, rows: Array(8).fill("........") };
  const a = gearAnchors(empty);
  assert.equal(a.ok, false, "호출부가 장비를 건너뛸 수 있게 false 를 준다");
});

test("★ 두 화면이 같은 배치 수식을 쓴다 — 섬과 사냥에서 다르게 보이면 안 된다", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pet = readFileSync(join(here, "../components/island/PixelPet.tsx"), "utf8");
  const hunt = readFileSync(join(here, "../components/island/HuntStage.tsx"), "utf8");
  for (const [name, src] of [["PixelPet", pet], ["HuntStage", hunt]] as const) {
    assert.ok(/gearAnchors\(/.test(src), `${name} 이 gearAnchors 를 쓰지 않는다`);
    assert.ok(!/inkBox\(/.test(src), `${name} 에 옛 inkBox 배치가 남아 있다`);
  }
  // 무기 세로 기준(손잡이 75%)이 두 화면에서 같아야 한다
  const ratio = (src: string) => /Math\.round\((?:wpn|weapon)\.h \* (0\.\d+)\)/.exec(src)?.[1];
  assert.equal(ratio(pet), ratio(hunt), "무기 손잡이 기준이 두 화면에서 다르다");
});
