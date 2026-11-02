// 수조 프레임 lock. [사용자 2026-11-02 "프레임이 조금 떨어지는 것 같아 최대한 프레임을 높여줘"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_FRAME_MS, createPacer, type Pacer } from "./framepace.ts";

function run(p: Pacer, ms: number, seconds: number) {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; t += ms) {
    const r = p.feed(ms);
    if (r !== null) changes.push(r);
  }
  return changes;
}

test("넉넉하면 해상도를 건드리지 않는다", () => {
  const p = createPacer(1.5);
  assert.deepEqual(run(p, 16.7, 60), []);
  assert.equal(p.ratio(), 1.5);
});

test("느리면 해상도를 내리고, 바닥 밑으로는 안 내려간다", () => {
  const p = createPacer(1.5);
  // 해상도를 내릴수록 빨라지는 기기를 흉내 낸다 — 비율이 넉넉히 낮아져야 60 에 닿는다
  for (let i = 0; i < 2000; i++) p.feed(16.7 + (p.ratio() - 0.75) * 20);
  assert.ok(p.ratio() < 1.5, String(p.ratio()));
  assert.ok(p.ratio() >= 0.75);
});

test("저전력 모드처럼 30Hz 로 묶인 화면이면 내렸다가 되돌린다 — 선명도만 잃지 않는다", () => {
  const p = createPacer(1.5);
  run(p, 33.3, 120);
  assert.equal(p.ratio(), 1.5);
});

test("여유가 생기면 천천히 되돌리고, 탭 전환 같은 긴 틈은 세지 않는다", () => {
  const p = createPacer(1.5);
  for (let i = 0; i < 400; i++) p.feed(16.7 + (p.ratio() - 1.1) * 40);
  const low = p.ratio();
  assert.ok(low < 1.5);
  run(p, 16.7, 40);
  assert.ok(p.ratio() > low);
  assert.equal(createPacer(1.5).feed(5000), null);
});

test("기기 배율이 낮아도 바닥이 위로 뒤집히지 않는다", () => {
  const p = createPacer(0.5);
  assert.equal(p.ratio(), 0.75);
});

test("장면 — 초당 30프레임 상한이 없다 · 고성능 GPU 를 달라고 한다 · 다시 그릴 때 물고기를 튀게 하지 않는다", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.doesNotMatch(src, /1000\/30/);
  assert.ok(src.includes("MIN_FRAME_MS"));
  assert.ok(MIN_FRAME_MS < 16.6, "60Hz 프레임을 걸러 내면 안 된다");
  assert.ok(src.includes('powerPreference: "high-performance"'));
  assert.ok(src.includes("pacer.feed("));
  assert.match(src, /if\(topologyChanged\|\|!active\)draw\(0\)/, "돌아가는 중엔 다음 프레임에 맡긴다");
  assert.match(src, /if\(!b\.dynamic&&b\.ready\)continue/, "안 움직이는 묶음을 매 프레임 올리지 않는다");
});
