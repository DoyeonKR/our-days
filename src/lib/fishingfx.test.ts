import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS, SPOTS } from "./fishing.ts";
import { FX_GRADE_LIGHT, FX_RODS, FX_SPOTS, FishFx, landingPoint, type FxCanvas, type FxPhase } from "./fishingfx.ts";

const root = join(import.meta.dirname, "../..");

/** 캔버스 가짜 — 그리기 호출의 숫자가 전부 유한한지 본다(NaN 하나면 createRadialGradient 는 진짜 브라우저에서 던지고, 나머지는 조용히 안 그려진다) */
function fakeCanvas() {
  const calls = { n: 0, bad: [] as string[] };
  const grad = { addColorStop() {} };
  const check = (name: string, args: unknown[]) => {
    calls.n += 1;
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) calls.bad.push(`${name}(${args.join(",")})`);
  };
  const ctx = new Proxy({}, {
    get(_t, name: string) {
      return (...args: unknown[]) => {
        check(name, args);
        return name.startsWith("create") ? grad : undefined;
      };
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas: FxCanvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, calls };
}

function run(fx: FishFx, ms: number) {
  for (let t = 0; t < ms; t += 16) fx.frame(16);
}

test("표 — 모든 낚싯대 · 낚시터 · 등급에 연출 값이 있다", () => {
  for (const r of RODS) assert.ok(FX_RODS[r.key], r.key);
  for (const s of SPOTS) {
    const look = FX_SPOTS[s.key];
    assert.ok(look, s.key);
    assert.ok(look.horizon > 0.15 && look.horizon < 0.45, `${s.key} 수평선`);
  }
  assert.equal(FX_GRADE_LIGHT.length, 8);
});

test("찌 자리 — 물 위에 떨어지고, 잘 던질수록 멀다", () => {
  for (const b of [0, 0.5, 1]) for (const r of [0, 0.5, 0.99]) {
    const p = landingPoint(b, r);
    assert.ok(p.x > 0.2 && p.x < 0.65);
    for (const s of SPOTS) assert.ok(p.y > FX_SPOTS[s.key].horizon + 0.05, `${s.key} 물 위`);
  }
  assert.ok(landingPoint(1, 0).y < landingPoint(0, 0).y, "멀수록 수평선 쪽");
});

test("한 판을 처음부터 끝까지 돌려도 잘못된 값으로 그리지 않고, 입자가 쌓이지 않는다", () => {
  for (const spot of SPOTS) for (const rod of RODS) {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(360, 450, 3);
    fx.set({ spot: spot.key, rod: rod.key, phase: "ready" });
    run(fx, 200);
    fx.set({ phase: "charge", charge: 0.9 });
    run(fx, 200);
    fx.set({ phase: "wait" });
    fx.cast(landingPoint(1, 0.4), 2000, 0.8, 7, 1);
    run(fx, 900);
    assert.equal(fx.counts().flying, false, "찌가 내려앉았다");
    fx.nibble();
    run(fx, 300);
    fx.set({ phase: "bite" });
    fx.bite(700);
    run(fx, 300);
    fx.hook(true);
    fx.set({ phase: "fight", tension: 0.4, dist: 1, holding: true });
    run(fx, 400);
    for (let i = 0; i < 4; i++) {
      fx.surge();
      fx.set({ tension: 0.95, dist: 0.8 - i * 0.2 });
      run(fx, 1100);
      fx.surgeEnd();
      run(fx, 300);
    }
    fx.set({ phase: "landed", dist: 0 });
    fx.land(7);
    assert.equal(fx.counts().bobOn, false);
    run(fx, 800);
    fx.set({ phase: "scoop" });
    run(fx, 300);
    fx.set({ phase: "result" });
    fx.stored(7);
    run(fx, 3000);
    assert.deepEqual(calls.bad.slice(0, 3), [], `${spot.key} ${rod.key}`);
    assert.equal(fx.counts().drops, 0, "입자는 스스로 사라진다");
    assert.ok(calls.n > 2000, "실제로 그렸다");
  }
});

test("놓치는 다섯 가지 — 모두 그려지고, 끊어지면 찌가 사라진다", () => {
  for (const kind of ["early", "late", "snapped", "slack", "escaped"] as const) {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(320, 400, 1);
    fx.set({ phase: "wait" });
    fx.cast(landingPoint(0.5, 0.2), 1500, 0.3, 2, 0.5);
    run(fx, 900);
    fx.set({ phase: "lost" as FxPhase });
    fx.lost(kind);
    run(fx, 1500);
    assert.deepEqual(calls.bad.slice(0, 3), [], kind);
    assert.equal(fx.counts().bobOn, kind !== "snapped", kind);
    assert.equal(fx.counts().fishOn, false, `${kind} 물고기는 달아났다`);
    fx.reset();
    assert.equal(fx.counts().bobOn, false);
  }
});

test("입자 상한 — 물보라를 몰아쳐도 한도 안에 머문다(폰 프레임)", () => {
  const { canvas } = fakeCanvas();
  const fx = new FishFx(canvas);
  fx.resize(360, 450, 2);
  fx.cast({ x: 0.4, y: 0.5 }, 1000, 1, 7, 1);
  run(fx, 700);
  fx.set({ phase: "fight", tension: 1, dist: 0.5, holding: true });
  for (let i = 0; i < 60; i++) {
    fx.hook(true);
    fx.surge();
    fx.frame(16);
    const n = fx.counts();
    assert.ok(n.drops <= 240 && n.rings <= 40 && n.foam <= 70, JSON.stringify(n));
  }
});

test("캔버스 금기 — 폰에서 무너지는 효과를 쓰지 않고, 시계를 직접 읽지 않는다", () => {
  const src = readFileSync(join(root, "src/lib/fishingfx.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /shadowBlur|\.filter\s*=/);
  assert.doesNotMatch(src, /Date\.now|Math\.random/);
});

test("화면이 연출을 빠짐없이 부른다", () => {
  const src = readFileSync(join(root, "src/components/FishingGame.tsx"), "utf8");
  for (const ev of ["cast(", "nibble(", "bite(", "hook(", "surge(", "surgeEnd(", "lost(", "land(", "stored(", "slipped(", "sold(", "reset("]) assert.ok(src.includes(`.${ev}`), ev);
});
