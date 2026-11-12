// 옆모습 보이기 · 기울기 묶기 · 몸 둘레 빛(2026-11-11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SIDE_BAND, SIDE_HOLD, faceSide, limitPitch, sideOnOf, sideStateOf } from "./sideon.ts";

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
  // 물고기마다 쪽을 기억하는 넷째 인자(owner)는 있어도 없어도 된다
  assert.match(scene, /if\(so>0\)\{faceSide\(direction,viewH,so(,[\w.]+)?\);limitPitch\(direction,viewH\);\}/);
  assert.match(scene, /calmSpecular\(inner\);fishShading\(inner\);/);
  assert.match(scene, /Math\.max\(3\.6,focusLen\*3\.4\)/);
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /"#include <emissivemap_fragment>"/);
  assert.match(post, /\|fishShade1/);
});

test("물고기마다 쪽을 기억하면 몸이 시선 축을 지날 때 보이는 방향이 튀지 않는다(옛 식은 한 프레임에 2·acos(1 − k) — 91° · 139° · 157°)", () => {
  const wrap = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
  for (const k of [0.3, 0.65, 0.8]) {
    // 카메라에서 멀어지며(+z 쪽이 아니라 −z = 시선 쪽) 몸 방향이 시선 축을 천천히 가로지른다 — 왼쪽 30° → 오른쪽 30° → 다시 왼쪽
    const owner = {};
    let prev = NaN, prevOld = NaN, maxStep = 0, maxOld = 0;
    for (let i = 0; i <= 2400; i++) {
      const ang = 0.55 * Math.sin((i / 2400) * 2 * Math.PI), d = { x: Math.sin(ang), y: 0, z: -Math.cos(ang) }, o = { ...d };
      faceSide(d, v, k, owner); faceSide(o, v, k);
      const a = Math.atan2(d.x, -d.z), b = Math.atan2(o.x, -o.z);
      assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9, "길이 그대로");
      if (!Number.isNaN(prev)) { maxStep = Math.max(maxStep, Math.abs(wrap(a - prev))); maxOld = Math.max(maxOld, Math.abs(wrap(b - prevOld))); }
      prev = a; prevOld = b;
    }
    assert.ok(maxOld > 1.5, `옛 식은 튄다 ${maxOld.toFixed(2)}`);
    assert.ok(maxStep < 0.05, `k ${k}: 한 걸음 ${maxStep.toFixed(3)} rad`);
  }
  // 문턱 안의 흔들림은 쪽을 안 바꾼다 · 오래 카메라를 똑바로 봐도 옆으로 선다
  const owner = {}, wob = (p: number) => { const d = { x: p, y: 0, z: -Math.sqrt(1 - p * p) }; faceSide(d, v, 0.5, owner); return d; };
  wob(0.3);
  // 처음 쪽의 반대편으로 문턱보다 조금 덜 흔들린다
  for (let i = 0; i < 200; i++) wob(-(SIDE_HOLD - 0.02) * Math.abs(Math.sin(i)));
  const first = sideStateOf(owner)?.side;
  assert.ok(first === 1 || first === -1);
  const head = wob(0);
  assert.ok(Math.abs(head.z) / Math.hypot(head.x, head.z) <= 0.5 + 1e-9, "똑바로 봐도 옆으로");
  // 띠를 다 지나면 반대쪽으로 확정된다
  assert.equal(sideStateOf(owner)?.side, first, "흔들려도 그대로");
  wob(-(SIDE_HOLD + SIDE_BAND + 0.05));
  assert.equal(sideStateOf(owner)?.side, -first!);
});
