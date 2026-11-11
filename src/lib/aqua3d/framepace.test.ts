// 수조 프레임 lock. [사용자 2026-11-02 "프레임이 조금 떨어지는 것 같아 최대한 프레임을 높여줘"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_FRAME_MS, POST_LEVELS, createPacer, framesPerDraw, ratioFloor, type Pacer } from "./framepace.ts";

function run(p: Pacer, ms: number, seconds: number) {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; t += ms) {
    const r = p.feed(ms);
    if (r !== null) changes.push(r);
  }
  return changes;
}

/** scene.ts 의 tick 과 같은 판단 — vsync 마다 rAF 가 오고, MIN_FRAME_MS 를 넘긴 것만 그린다 */
function display(p: Pacer, vsync: number, seconds: number) {
  let previous = 0, last = 0, draws = 0;
  const changes: number[] = [];
  for (let time = vsync; time < seconds * 1000; time += vsync) {
    const raw = last ? time - last : 0; last = time;
    const gap = previous ? time - previous : 0;
    if (!previous || gap >= MIN_FRAME_MS) {
      previous = time; draws++;
      const r = p.feed(gap, raw);
      if (r !== null) changes.push(r);
    } else p.observe(raw);
  }
  return { fps: draws / seconds, changes };
}

test("넉넉하면 해상도를 건드리지 않는다", () => {
  const p = createPacer(1.5);
  assert.deepEqual(run(p, 16.7, 60), []);
  assert.equal(p.ratio(), 1.5);
});

test("느리면 해상도를 내리고, 바닥 밑으로는 안 내려간다", () => {
  const p = createPacer(1.5);
  // 해상도를 내릴수록 빨라지는 기기를 흉내 낸다 — 비율이 넉넉히 낮아져야 60 에 닿는다
  for (let i = 0; i < 2000; i++) p.feed(16.7 + (p.ratio() - 0.75) * 20, 16.7);
  assert.ok(p.ratio() < 1.5, String(p.ratio()));
  assert.ok(p.ratio() >= 0.75);
});

test("저전력 모드처럼 30Hz 로 묶인 화면이면 내렸다가 되돌린다 — 선명도만 잃지 않는다", () => {
  const p = createPacer(1.5);
  run(p, 33.3, 120);
  assert.equal(p.ratio(), 1.5);
});

test("30Hz 로 묶인 화면은 10분 동안 흐려지는 시험을 두 번 넘게 하지 않는다 — 예전엔 31.5초마다 1.5초씩 흐려졌다", () => {
  const p = createPacer(1.5);
  const drops = run(p, 33.3, 600).filter(r => r < 1.5);
  assert.ok(drops.length <= 2, String(drops.length));
});

test("실패한 시험 뒤 쉬는 시간은 두 배씩 늘어난다(5분까지)", () => {
  // 주사율은 60Hz 로 보이는데 GPU 와 상관없이 40ms 에 묶인 기기 — 해상도를 내려도 안 빨라진다
  const p = createPacer(1.5);
  const at: number[] = [];
  let t = 0;
  for (let i = 0; i < 40000; i++) { t += 40; const r = p.feed(40, 16.7); if (r !== null && r < 1.5) at.push(t); }
  assert.ok(at.length >= 3, String(at.length));
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] >= gaps[i - 1] * 1.5 || gaps[i] >= 290000, gaps.join(","));
});

test("90Hz · 120Hz · 144Hz — 각각 90 · 60 · 72fps 로 그리고, 영원히 느린 기기로 보지 않는다", () => {
  for (const [hz, fps] of [[60, 60], [90, 90], [120, 60], [144, 72]] as const) {
    const p = createPacer(1.5);
    const r = display(p, 1000 / hz, 120);
    assert.ok(Math.abs(r.fps - fps) < 1.5, `${hz}Hz → ${r.fps}`);
    assert.deepEqual(r.changes, [], `${hz}Hz 에서 해상도를 바꿨다`);
    assert.equal(p.ratio(), 1.5);
  }
  assert.equal(framesPerDraw(1000 / 120), 2);
  assert.equal(framesPerDraw(1000 / 90), 1);
  assert.equal(framesPerDraw(1000 / 144), 2);
});

test("여유가 생기면 천천히 되돌리고, 탭 전환 같은 긴 틈은 세지 않는다", () => {
  const p = createPacer(1.5);
  for (let i = 0; i < 400; i++) p.feed(16.7 + (p.ratio() - 1.1) * 40, 16.7);
  const low = p.ratio();
  assert.ok(low < 1.5);
  run(p, 16.7, 40);
  assert.ok(p.ratio() > low);
  assert.equal(createPacer(1.5).feed(5000), null);
});

test("기기 배율이 낮아도 바닥이 위로 뒤집히지 않는다 · DPR 2 이상은 CSS 픽셀 1:1 이 바닥", () => {
  const p = createPacer(0.5);
  assert.equal(p.ratio(), 0.75);
  assert.equal(ratioFloor(1), 0.75);
  assert.equal(ratioFloor(2), 1);
  assert.equal(ratioFloor(3), 1);
  const phone = createPacer(1.5, ratioFloor(2));
  for (let i = 0; i < 4000; i++) phone.feed(60, 16.7);
  assert.ok(phone.ratio() >= 1, String(phone.ratio()));
});

test("장면 — 초당 30프레임 상한이 없다 · 고성능 GPU 를 달라고 한다 · 다시 그릴 때 물고기를 튀게 하지 않는다", () => {
  const raw = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /1000\/30/);
  assert.ok(src.includes("MIN_FRAME_MS"));
  assert.ok(MIN_FRAME_MS < 11, "90Hz(11.1ms) 프레임을 걸러 내면 안 된다");
  assert.ok(MIN_FRAME_MS > 8.4, "120Hz 는 격 프레임만 그린다");
  assert.ok(src.includes('powerPreference: "high-performance"'));
  assert.ok(src.includes("pacer.feed(") && src.includes("pacer.observe("));
  assert.ok(src.includes("ratioFloor("));
  // 2026-11-05 — 돌아가는 중엔 update 가 그리지 않는다(바뀐 모양은 다음 프레임에 맡긴다). 예전 lock 은 모양이 바뀌면 바로 draw(0) 해서 모든 물고기 방향이 튀었다
  assert.match(src, /if\(!active\)draw\(0\)/, "돌아가는 중엔 다음 프레임에 맡긴다");
  assert.doesNotMatch(src, /topologyChanged\|\|!active\)draw\(0\)/);
  assert.match(src, /if\(!b\.dynamic&&b\.ready\)continue/, "안 움직이는 묶음을 매 프레임 올리지 않는다");
});

// 2026-11-11 — 해상도가 바닥에 닿은 느린 폰은 거기서 멈췄다. 그 아래 후처리 계단(색 갈라짐 → 빛 번짐 → 장면 그림 0.75배)
test("해상도 바닥에서도 느리면 후처리를 한 칸씩 덜어 내고(해상도는 바닥 그대로), 빨라지면 거기서 멈춘다", () => {
  assert.equal(POST_LEVELS, 3);
  const p = createPacer(1, ratioFloor(2)); // DPR 2 폰 — 해상도는 이미 바닥(1)
  // 계단 하나마다 7ms 씩 빨라지는 폰: 0 → 36ms · 1 → 29 · 2 → 22 · 3 → 15
  const changes: number[] = [];
  for (let i = 0; i < 3000; i++) { const r = p.feed(36 - p.level() * 7, 16.7); if (r !== null) changes.push(r); }
  assert.equal(p.ratio(), 1, "해상도는 바닥 밑으로 안 내려간다");
  assert.ok(p.level() >= 2, String(p.level()));
  assert.ok(p.level() <= POST_LEVELS);
  assert.deepEqual(changes, [], "계단만 바뀔 땐 캔버스 크기(setPixelRatio)를 다시 잡지 않는다");
});

test("해상도를 먼저 내리고, 바닥에 닿은 뒤에야 후처리를 덜어 낸다", () => {
  const p = createPacer(1.5, 1);
  let firstLevelAt = -1, ratioAtFirstLevel = 0;
  for (let i = 0; i < 4000; i++) {
    p.feed(40 - p.level() * 6 - (1.5 - p.ratio()) * 30, 16.7);
    if (p.level() > 0 && firstLevelAt < 0) { firstLevelAt = i; ratioAtFirstLevel = p.ratio(); }
  }
  assert.ok(firstLevelAt > 0, "계단이 한 번은 내려가야 한다");
  assert.equal(ratioAtFirstLevel, 1, "해상도가 바닥에 닿기 전엔 후처리를 건드리지 않는다");
});

test("30Hz 로 묶인 화면(무엇을 덜어도 안 빨라진다)은 후처리를 잃지 않는다 — 시험하고 되돌린다", () => {
  const p = createPacer(1, 1); // 해상도 바닥에서 시작 — 곧장 계단 시험으로 간다
  let worst = 0;
  for (let t = 0; t < 600000; t += 33.3) { p.feed(33.3, 16.7); worst = Math.max(worst, p.level()); }
  assert.equal(p.level(), 0);
  assert.ok(worst <= 1, `한 번에 한 칸만 시험한다(최대 ${worst})`);
});

test("여유가 생기면 거꾸로 — 후처리를 먼저 되찾고, 다 되찾은 뒤에 해상도를 올린다(점점 드물게)", () => {
  const p = createPacer(1.5, 1);
  for (let i = 0; i < 6000; i++) p.feed(45 - p.level() * 6 - (1.5 - p.ratio()) * 30, 16.7);
  assert.ok(p.level() > 0 && p.ratio() === 1, `${p.level()} ${p.ratio()}`);
  let ratioRoseWhileLevel = false, t = 0, last = p.level();
  const levelUps: number[] = [];
  for (let i = 0; i < 30000; i++) {
    t += 16.7; p.feed(16.7, 16.7);
    if (p.ratio() > 1 && p.level() > 0) ratioRoseWhileLevel = true;
    if (p.level() < last) levelUps.push(t);
    last = p.level();
  }
  assert.equal(p.level(), 0);
  assert.equal(p.ratio(), 1.5);
  assert.equal(ratioRoseWhileLevel, false, "후처리를 다 되찾기 전엔 해상도를 안 올린다");
  for (let i = 2; i < levelUps.length; i++) assert.ok(levelUps[i] - levelUps[i - 1] >= levelUps[i - 1] - levelUps[i - 2] - 50, "되찾는 간격은 줄지 않는다(오르내림 반복 방지)");
});

test("장면 — 후처리 계단을 post 에 옮기고 점 입자 크기도 맞춘다", () => {
  const raw = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /if\(pacer\.level\(\)!==postLevel\)\{postLevel=pacer\.level\(\);postNow\.setLevel\(postLevel\);syncPointScale\(\);\}/);
  assert.match(src, /canvas\.height\*postNow\.scale\(\)\/2/);
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /level >= 3 \? 0\.75 : 1/);
  assert.match(post, /split\.value = level < 1 \? 1 : 0/);
  assert.match(post, /const bloom = level < 2/);
});
