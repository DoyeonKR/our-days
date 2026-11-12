// 헤엄 시계 · 해파리 갓 · 보폭(2026-11-12) — anatomy.ts 의 순수 함수만 본다(three 없음)
import { test } from "node:test";
import assert from "node:assert/strict";
import { anatomy, bendProfile, jellyPulse, stepSwim, swimClock } from "./anatomy.ts";

test("해파리 갓 — 지름이 펴짐 대비 18~25% 오므라든다(예전 ±5.5% 는 숨 쉬는지 안 보였다) · 오므릴 때가 펼 때보다 크게 바뀐다", () => {
  const open = jellyPulse(1, "y", { x: 0, y: 0, z: 0 }), shut = jellyPulse(-1, "y", { x: 0, y: 0, z: 0 });
  const squeeze = 1 - shut.x / open.x;
  assert.ok(squeeze >= 0.18 && squeeze <= 0.25, `오므림 ${squeeze.toFixed(3)}`);
  assert.ok(1 - shut.x > (open.x - 1) * 2 && shut.y > open.y, "오므리면 좁고 길어진다 · 쉬는 모양은 편 쪽");
  const g = jellyPulse(-1, "x", { x: 0, y: 0, z: 0 });
  assert.ok(g.x > 1 && g.y < 1 && Math.abs(g.y - g.z) < 1e-9, "GLB 는 x 가 갓 축");
});

test("끄덕임은 물고기마다 다른 위상 · 빠르기로 시작한다(옛 식은 모두 0 에서 같이 끄덕였다)", () => {
  const a = anatomy("koi", "koi"), p = bendProfile("koi");
  const bobs = [1, 2, 3, 4, 5, 6].map((id) => {
    const c = swimClock();
    stepSwim(c, a, p, id * 1.73, 0, {});
    for (let k = 0; k < 90; k++) stepSwim(c, a, p, id * 1.73 + k / 30, 1 / 30, { hover: 1 });
    return Math.sin(c.bob);
  });
  assert.ok(Math.max(...bobs) - Math.min(...bobs) > 1, bobs.map((b) => b.toFixed(2)).join(" "));
});

test("엔진이 effort 를 넘기면(이미 빠르기에 맞춘 박자) stepSwim 이 빠르기로 또 고치지 않는다 · 보폭은 몸 모양을 따른다", () => {
  const a = anatomy("crucian", "crucian"), p = bendProfile("crucian");
  const c = swimClock(); let t = 0;
  stepSwim(c, a, p, 0, 0, {});
  const b0 = c.beat;
  for (let k = 0; k < 60; k++) { t += 0.5 / 30; stepSwim(c, a, p, t, 1 / 30, { speed: 3, effort: 0.5 }); }
  assert.ok(Math.abs(c.beat - b0 - t * a.frequency) < 1e-9, "박자 = 쌓인 time · frequency");
  assert.ok(bendProfile("eel").stride < bendProfile("crucian").stride && bendProfile("crucian").stride < bendProfile("bluefin").stride);
  assert.equal(bendProfile("flounder").stride, 0.5);
});
