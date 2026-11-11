// 옆모습 보이기 · 기울기 묶기 · 몸 둘레 빛(2026-11-11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faceSide, limitPitch, sideOnOf } from "./sideon.ts";

const v = { x: 0, z: -1 }; // 카메라가 −z 를 본다

test("카메라를 똑바로 보던 몸도 옆으로 선다 · 길이 1 · 위아래 그대로", () => {
  for (const d0 of [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0.3, z: -1 }, { x: 0.01, y: 0, z: 1 }]) {
    const d = { ...d0 }, l0 = Math.hypot(d0.x, d0.y, d0.z);
    faceSide(d, v, 0.5);
    const h = Math.hypot(d.x, d.z), along = Math.abs(d.z) / h;
    assert.ok(along <= 0.5 + 1e-9, `시선과 나란한 정도 ${along}`);
    assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - l0) < 1e-9);
    assert.equal(d.y, d0.y);
  }
  const s = { x: 1, y: 0, z: 0 };
  faceSide(s, v, 0.8);
  assert.deepEqual([Math.round(s.x * 1e9) / 1e9, Math.round(s.z * 1e9) / 1e9], [1, 0], "이미 옆이면 그대로");
  const n = { x: 0, y: 0, z: 1 };
  faceSide(n, v, 0);
  assert.deepEqual(n, { x: 0, y: 0, z: 1 }, "k 0 이면 안 바뀐다");
});

test("판 같은 종은 많이 · 해파리 · 불가사리 · 바닥에 눕는 종은 안 한다", () => {
  assert.ok(sideOnOf("octopus") > sideOnOf("koi"));
  assert.equal(sideOnOf("jellyfish"), 0);
  assert.equal(sideOnOf("starfish"), 0);
  assert.equal(sideOnOf("flounder"), 0);
});

test("곧게 위아래를 봐도 기울기는 약 50° 까지 · 옆 방향이 정해진다", () => {
  const d = { x: 0, y: 1, z: 0 };
  limitPitch(d, v);
  assert.ok(Math.hypot(d.x, d.z) > 0.6);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  const e = { x: 0.2, y: -0.98, z: 0 };
  limitPitch(e, v);
  assert.ok(Math.abs(e.y) / Math.hypot(e.x, e.z) <= 1.2 + 1e-9);
});

test("수조가 쓰는 곳 — 옆모습 · 기울기 · 몸 둘레 빛 · 가까이 따라가기", () => {
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.match(scene, /if\(so>0\)\{faceSide\(direction,viewH,so\);limitPitch\(direction,viewH\);\}/);
  assert.match(scene, /calmSpecular\(inner\);fishShading\(inner\);/);
  assert.match(scene, /Math\.max\(3\.6,focusLen\*3\.4\)/);
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /"#include <emissivemap_fragment>"/);
  assert.match(post, /\|fishShade1/);
});
