import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS, SPOTS } from "./fishing.ts";
import { FX_GRADE_LIGHT, FX_ROD_ART, FX_RODS, FX_SPOTS, FX_WEATHER_MAX, FishFx, landingPoint, type FxCanvas, type FxPhase } from "./fishingfx.ts";
import { appCss } from "./cssfiles.ts";

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
  for (const r of RODS) {
    assert.ok(FX_RODS[r.key], r.key);
    const a = FX_ROD_ART[r.key];
    assert.ok(a, `${r.key} 그림 치수`);
    assert.ok(Math.hypot(a.tip[0] - a.butt[0], a.tip[1] - a.butt[1]) > 450, `${r.key} 낚싯대 길이`);
    for (const p of [a.butt, a.tip, a.reel]) assert.ok(p[0] >= 0 && p[0] <= 512 && p[1] >= 0 && p[1] <= 512);
  }
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
    // 낚시터 · 낚싯대마다 번갈아 크게 휘어 던진다(바나나킥 길 · 꼬리 · 불똥 · 물보라도 같은 검사를 받게)
    const flyMs = fx.cast(landingPoint(1, 0.4), 2000, 0.8, 7, 1, (SPOTS.indexOf(spot) + RODS.indexOf(rod)) % 2 ? 1 : -1);
    assert.ok(flyMs > 500 && flyMs < 1100, `나는 시간 ${flyMs}ms`);
    run(fx, 1100);
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

test("낚싯대 그림 — 그림이 있으면 그걸 그리고(휘어도), 낚싯대마다 다른 그림을 쓴다 · 없으면 직접 그린 낚싯대", () => {
  const { canvas } = fakeCanvas();
  const fx = new FishFx(canvas);
  fx.resize(360, 450, 1);
  fx.set({ phase: "ready", rod: "rod_carbon" });
  assert.equal(fx.rodDrawnFromArt(), false, "그림 전");
  run(fx, 100);
  for (const r of RODS) fx.useRodSprite(r.key, { src: {} as CanvasImageSource, w: 300, h: 560, reelX: -30, reelK: 0.3 });
  for (const r of RODS) {
    fx.set({ rod: r.key });
    assert.equal(fx.rodDrawnFromArt(), true, r.key);
    fx.set({ phase: "fight", tension: 0.9, dist: 0.5, holding: true });
    run(fx, 100);
  }
  const src = readFileSync(join(root, "src/lib/fishingfx.ts"), "utf8");
  assert.ok(src.includes("this.drawRodArt("), "실제로 부른다");
  const game = readFileSync(join(root, "src/components/FishingGame.tsx"), "utf8");
  assert.ok(game.includes("fx.art("), "화면이 그림 주소를 넘긴다");
  assert.ok(game.includes("RODS[cur.rod]?.key"), "산 낚싯대를 넘긴다");
});

test("새 방식 연출 — 루어 · 뜰채 · 심해 · 꽝을 끝까지 돌려도 잘못된 값이 없다", () => {
  for (const spot of SPOTS) {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(360, 450, 2);
    fx.set({ spot: spot.key, method: "lure", phase: "ready" });
    run(fx, 100);
    fx.set({ phase: "lure", beat: 0.5, interest: 0.5, line: 0.6 });
    fx.cast(landingPoint(1, 0.3), 2000, 0.4, 3, 1);
    run(fx, 800);
    for (const g of ["great", "good", "miss"] as const) { fx.twitch(g); run(fx, 200); }
    fx.strike();
    fx.set({ phase: "fight", rodX: -0.8, fishX: 0.9, tension: 0.5, dist: 0.6 });
    fx.warn("surge");
    run(fx, 500);
    fx.set({ phase: "landed" });
    fx.land(3);
    fx.junked();
    run(fx, 1500);
    fx.reset();
    fx.set({ method: "scoop", phase: "aim" });
    fx.setShoal([{ id: 0, x: 0.4, y: 0.6, h: 1, z: 0.8, reach: true, size: 0.5, grade: 7, junk: false }, { id: 1, x: 0.6, y: 0.7, h: 2, z: 0.1, reach: false, size: 0.3, grade: 0, junk: true }]);
    fx.plunge(0.4, 0.6, 0.08, 0.34);
    run(fx, 340);
    fx.netLand(false, 0);
    run(fx, 600);
    fx.plunge(0.4, 0.6, 0.08, 0.34);
    run(fx, 340);
    fx.netLand(true, 5);
    run(fx, 1000);
    fx.reset();
    fx.set({ method: "deep", phase: "wait" });
    fx.cast(landingPoint(0.5, 0.3), 1200, 0.5, 5, 0.5);
    run(fx, 800);
    fx.set({ phase: "fight", dist: 1, tension: 0.4, spin: 1.4 });
    fx.warn("dive");
    fx.surge("surge");
    run(fx, 1200);
    fx.surgeEnd();
    assert.deepEqual(calls.bad.slice(0, 3), [], spot.key);
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
  for (const ev of ["cast(", "nibble(", "bite(", "hook(", "warn(", "surge(", "surgeEnd(", "lost(", "land(", "stored(", "slipped(", "sold(", "reset(", "twitch(", "strike(", "setShoal(", "plunge(", "netLand(", "junked("]) assert.ok(src.includes(`.${ev}`), ev);
});

test("비 · 눈 — 값이 멀쩡하고 입자 수가 상한 안이고, 맑으면 입자가 없다", () => {
  const { canvas, calls } = fakeCanvas();
  const fx = new FishFx(canvas);
  fx.resize(360, 560, 2);
  for (const wx of ["rain", "snow", null] as const) {
    fx.weather(wx);
    for (let i = 0; i < 400; i++) fx.frame(16);
    const inner = fx as unknown as { fall: unknown[]; ripples: unknown[] };
    assert.ok(inner.fall.length <= (wx ? FX_WEATHER_MAX[wx] : 0), String(wx));
    assert.ok(inner.ripples.length <= FX_WEATHER_MAX.splash);
    if (wx === "rain") assert.ok(inner.ripples.length > 0, "비는 수면에 파문을 남긴다");
    if (!wx) assert.equal(inner.fall.length, 0);
  }
  assert.deepEqual(calls.bad, []);
});

test("낚시 준비 — 낚시터 · 미끼는 옆으로 밀지 않아도 전부 보인다 · 가로 스크롤러는 pan-x 를 허용한다", () => {
  const css = appCss();
  for (const name of [".fish-spots", ".fish-baits"]) {
    const rule = css.match(new RegExp(name.replace(".", "\\.") + " \\{[^}]*\\}"))![0];
    assert.match(rule, /display: grid/, name);
    assert.doesNotMatch(rule, /overflow-x/, name);
  }
  for (const m of css.matchAll(/[^{}]*\{[^}]*overflow-x: auto[^}]*\}/g)) assert.match(m[0], /touch-action: pan-x/, m[0].slice(0, 60));
  const game = readFileSync("src/components/FishingGame.tsx", "utf8");
  assert.ok(game.includes("fx?.weather("), "날씨가 연출에 전해진다");
  assert.doesNotMatch(css, /@keyframes fish-rain/);
});

test("바나나킥 길 — 정확히 떨어질 자리에 닿고 · 휜 쪽으로 불룩 · 끝에서 꺾여 들어오고 · 불똥 · 물보라는 휜 만큼", () => {
  const fly = (curve: number, reduced = false) => {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas, null, reduced);
    fx.resize(360, 640, 2);
    fx.set({ spot: "brook", rod: "rod_bamboo", phase: "charge", charge: 1 });
    run(fx, 300);
    fx.set({ phase: "wait" });
    const land = landingPoint(1, 0.5);
    fx.cast(land, 3000, 0.5, 3, 1, curve);
    const path: { x: number; y: number }[] = [];
    let maxDrops = 0;
    for (let t = 0; t < 1400; t += 16) {
      fx.frame(16);
      const c = fx.counts();
      maxDrops = Math.max(maxDrops, c.drops);
      if (c.flying) path.push({ x: c.bobX, y: c.bobY });
    }
    const end = fx.counts();
    return { path, end, land: { x: land.x * 360, y: land.y * 640 }, maxDrops, bad: calls.bad };
  };
  const straight = fly(0), right = fly(1), left = fly(-1), still = fly(1, true);
  for (const r of [straight, right, left, still]) {
    assert.equal(r.bad.length, 0, r.bad.slice(0, 3).join(" "));
    assert.equal(r.end.flying, false, "내려앉았다");
    assert.ok(Math.hypot(r.end.bobX - r.land.x, r.end.bobY - r.land.y) < 1, "떨어질 자리는 휘어도 그대로 — 입질 자리 · 알림이 같은 점을 본다");
  }
  // 곧게 던진 같은 힘의 길과 프레임마다 견준 어긋남(던지는 선에 수직으로 휜다 — 가로 · 세로 둘 다 본다)
  // 휜 공은 조금 더 오래 나니 프레임이 아니라 나는 시간의 같은 비율끼리 견준다
  const at = (r: ReturnType<typeof fly>, f: number) => r.path[Math.round(f * (r.path.length - 1))];
  const diff = (r: ReturnType<typeof fly>) => Array.from({ length: 41 }, (_, i) => { const a = at(r, i / 40), b = at(straight, i / 40); return { x: a.x - b.x, y: a.y - b.y }; });
  const dr = diff(right), dl = diff(left), n = Math.min(dr.length, dl.length);
  const mag = dr.map((d) => Math.hypot(d.x, d.y)), peak = Math.max(...mag);
  assert.ok(peak > 60, `크게 휜다 (${peak.toFixed(1)}px)`);
  const lp = Math.max(...dl.map((d) => Math.hypot(d.x, d.y)));
  assert.ok(lp > 60 && Math.min(lp, peak) / Math.max(lp, peak) > 0.5, `양쪽 다 화면 안에서 크게 휜다 (${peak.toFixed(1)} · ${lp.toFixed(1)})`);
  const m = Math.round(n * 0.6);
  assert.ok(dr[m].y < -40 && dr[m].x < 30, "한쪽은 하늘 쪽으로 높이 — 낚싯대 쪽(오른쪽 아래)으로 가지 않는다");
  assert.ok(dl[m].x < -40, "다른 쪽은 왼쪽 물 위로 넓게");
    // 시간 74% = 앞으로 간 거리 약 90%(공기에 걸려 느려진다) — 거의 다 왔는데 아직 크게 벗어나 있다 = 끝에서 꺾여 들어온다
  assert.ok(mag[Math.floor(mag.length * 0.74)] > peak * 0.6, "끝에서 꺾여 들어온다");
  // 휘어 나간 자리가 화면 밖으로 안 나간다(낚싯대 끝 — 출발점은 이 가짜 화면에선 오른쪽 가장자리 밖이라 앞 20% 는 뺀다)
  for (const r of [right, left]) for (const p of r.path.slice(Math.floor(r.path.length * 0.2))) assert.ok(p.x > 0 && p.x < 360 && p.y > 0 && p.y < 640, `화면 밖으로 안 나간다 (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  assert.ok(right.maxDrops > straight.maxDrops, "휜 공은 불똥 · 옆 물보라가 더 많다");
  assert.ok(still.maxDrops < right.maxDrops, "움직임 줄이기면 불똥이 없다");
  assert.ok(right.maxDrops <= 240, "입자 상한");
});

test("바나나킥 — 루어 · 심해 · 떨어지는 자리 양 끝에서도 화면 안 · 잘못된 값 없이 내려앉는다", () => {
  for (const method of ["float", "lure", "deep"] as const) for (const r of [0, 0.99]) for (const curve of [-1, -0.6, 0.6, 1]) {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(360, 640, 2);
    fx.set({ spot: "harbor", rod: "rod_star", method, phase: "charge", charge: 1 });
    run(fx, 300);
    fx.set({ phase: "wait" });
    const land = landingPoint(1, r);
    const ms = fx.cast(land, 3000, 0.5, 3, 1, curve);
    const pts: { x: number; y: number }[] = [];
    for (let t = 0; t < ms + 200; t += 16) {
      fx.frame(16);
      const c = fx.counts();
      if (c.flying) pts.push({ x: c.bobX, y: c.bobY });
    }
    const end = fx.counts();
    assert.equal(calls.bad.length, 0, `${method} ${r} ${curve}: ${calls.bad.slice(0, 2).join(" ")}`);
    assert.equal(end.flying, false);
    assert.ok(Math.hypot(end.bobX - land.x * 360, end.bobY - land.y * 640) < 1, `${method} 떨어질 자리 그대로`);
    for (const p of pts.slice(Math.floor(pts.length * 0.2))) assert.ok(p.x > 0 && p.x < 360 && p.y > 0 && p.y < 640, `${method} ${r} ${curve}: (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
});
