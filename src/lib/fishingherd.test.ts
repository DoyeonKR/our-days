// 뜰채 — 몰아서 건지기(2026-11-14) [사용자: "모든 낚시게임이 다 타이밍 류 낚시게임인데 뜰채 낚시 방법을 개편하고 변경하자"]
// 잠그는 것: 언제 누르나가 아니라 어디로 모나가 결과를 가른다 — 물가 · 구석으로 모는 봇이 쫓기만 하는 봇보다 빨리 · 솜씨 좋게 건지고,
// 누르는 때가 없어 반응이 늦어도 끝까지 따라가면 건진다(오래 걸리고 솜씨가 낮을 뿐). 그물을 세워 두기만 하면 물고기를 못 건진다. 봇은 사람보다 규칙적이다 — 값이 아니라 범위를 잠근다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPOTS } from "./fishing.ts";
import { HERD_AREA, HERD_TIME_S, herdBest, herdPinned, herdTune, startHerd, stepHerd, type Herd } from "./fishingmodes.ts";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const DT = 1 / 30;

type Mode = "corner" | "chase" | "park";
/** 한 판 — corner: 물고기와 가까운 구석을 잇는 줄에서 물고기 바로 뒤(트인 물 쪽)에 그물을 둬 구석으로 민다 · chase: 물고기를 곧장 쫓는다 · park: 그물을 아래 가운데에 세워 둔다 */
function play(spotKey: string, bait: number, eff: number, net: number, seed: number, mode: Mode, lag = 0.15) {
  const spot = SPOTS.find((s) => s.key === spotKey)!;
  const tune = herdTune(net, { power: eff, line: eff });
  let h: Herd = startHerd(spot, 5, bait, seed);
  const hist: Herd[] = [];
  let tgt = h.fish.findIndex((f) => !f.haul.junk);
  if (tgt < 0) tgt = 0;
  while (h.status === "on") {
    hist.push(h);
    const seen = hist[Math.max(0, hist.length - 1 - Math.round(lag / DT))];
    const f = seen.fish[tgt];
    let tx = f.x, ty = f.y;
    if (mode === "park") { tx = 0.5; ty = 0.8; }
    if (mode === "corner") {
      const cx = f.x < 0.5 ? HERD_AREA.x[0] : HERD_AREA.x[1], cy = f.y < 0.66 ? HERD_AREA.y[0] : HERD_AREA.y[1];
      const ux = f.x - cx, uy = (f.y - cy) * 1.25, ul = Math.hypot(ux, uy) || 1;
      tx = f.x + (ux / ul) * 0.1;
      ty = f.y + ((uy / ul) * 0.1) / 1.25;
    }
    h = stepHerd(h, DT, tx, ty, tune);
  }
  return h;
}
const runs = (spot: string, bait: number, eff: number, net: number, mode: Mode, lag = 0.15, n = 120) =>
  Array.from({ length: n }, (_, i) => play(spot, bait, eff, net, i * 131 + 7, mode, lag));
const caughtRate = (hs: Herd[]) => hs.filter((h) => h.status === "caught").length / hs.length;
const fishRate = (hs: Herd[]) => hs.filter((h) => h.status === "caught" && !h.fish[h.caught].haul.junk).length / hs.length;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : Infinity; };
const gotFish = (h: Herd) => h.status === "caught" && !h.fish[h.caught].haul.junk;
const caughtTimes = (hs: Herd[]) => median(hs.filter((h) => h.status === "caught").map((h) => h.t));
/** 물고기(쓰레기 말고)를 건진 판의 시간 · 솜씨 — 쫓다가 쓰레기에 그물이 걸리는 건 몰이 솜씨가 아니다 */
const fishTimes = (hs: Herd[]) => median(hs.filter(gotFish).map((h) => h.t));
const meanQ = (hs: Herd[]) => hs.reduce((a, h) => a + (gotFish(h) ? h.quality : 0), 0) / hs.length;

test("몰면 잘 건진다 — 첫 낚시터 · 시작 장비로도 대부분 · 한 판은 몇 초 걸린다(한 번에 끝나지 않는다)", () => {
  const hs = runs("brook", 0, 0, 0, "corner");
  assert.ok(caughtRate(hs) > 0.85, `건진 비율 ${caughtRate(hs)}`);
  const t = caughtTimes(hs);
  assert.ok(t > 2.5 && t < 16, `한 판 가운데값 ${t.toFixed(1)}초`);
});

test("길이 결과를 가른다 — 구석으로 모는 쪽이 곧장 쫓는 쪽보다 빨리, 더 좋은 솜씨로 건진다", () => {
  for (const [spot, bait] of [["brook", 0], ["harbor", 1], ["ocean", 4], ["abyss", 6]] as const) {
    const corner = runs(spot, bait, 15, 2, "corner"), chase = runs(spot, bait, 15, 2, "chase");
    assert.ok(fishTimes(corner) < fishTimes(chase), `${spot}: 몰기 ${fishTimes(corner).toFixed(1)}초 · 쫓기 ${fishTimes(chase).toFixed(1)}초`);
    assert.ok(meanQ(corner) > meanQ(chase), `${spot}: 솜씨 몰기 ${meanQ(corner).toFixed(2)} · 쫓기 ${meanQ(chase).toFixed(2)}`);
  }
});

test("타이밍 게임이 아니다 — 누르는 때가 없다: 반응이 0.15초든 0.45초든 끝까지 따라가면 건진다(늦을수록 오래 걸릴 뿐) · 귀한 놈은 쫓기만 해선 오래 걸린다", () => {
  for (const [spot, bait] of [["brook", 0], ["harbor", 1], ["ocean", 4]] as const) {
    const fast = fishRate(runs(spot, bait, 15, 2, "chase", 0.15)), slow = fishRate(runs(spot, bait, 15, 2, "chase", 0.45));
    assert.ok(Math.abs(fast - slow) < 0.1 && slow > 0.85, `${spot}: 0.15초 ${fast} · 0.45초 ${slow}`);
  }
  const t = (spot: string, bait: number) => fishTimes(runs(spot, bait, 15, 2, "chase"));
  assert.ok(t("abyss", 6) > t("brook", 0) + 3, "귀할수록 덜 지쳐 쫓기만 하면 오래 걸린다");
});

test("그물을 세워 두기만 하면 물고기를 못 건진다 — 물고기는 다가오는 그물을 피한다", () => {
  const hs = runs("brook", 0, 0, 0, "park");
  assert.ok(fishRate(hs) < 0.1, `세워 둔 그물에 든 물고기 ${fishRate(hs)}`);
});

test("트인 물에선 그물 밑으로 빠져나간다 · 구석에 몰렸거나 지쳤을 때만 붙잡힌다 · 빠져나가면 진행이 되돌아간다", () => {
  const spot = SPOTS.find((s) => s.key === "brook")!;
  const tune = herdTune(0, { power: 0, line: 0 });
  const h0 = startHerd(spot, 5, 0, 3);
  const open: Herd = { ...h0, nx: 0.5, ny: 0.66, fish: [{ ...h0.fish[0], x: 0.5, y: 0.66, vx: 0, vy: 0, stam: 1, dwell: 0 }] };
  assert.equal(herdPinned(open.fish[0]), false);
  const a = stepHerd(open, 0.05, 0.5, 0.66, tune);
  assert.equal(a.fish[0].dwell, 0, "트인 물 · 기운 있는 물고기는 안 붙잡힌다");
  const pinned: Herd = { ...h0, nx: HERD_AREA.x[0] + 0.03, ny: HERD_AREA.y[1] - 0.02, fish: [{ ...h0.fish[0], x: HERD_AREA.x[0], y: HERD_AREA.y[1], vx: 0, vy: 0, stam: 1, dwell: 0 }] };
  const b = stepHerd(pinned, 0.2, HERD_AREA.x[0], HERD_AREA.y[1], tune);
  assert.ok(b.fish[0].dwell > 0, "구석에 몰린 물고기는 붙잡힌다");
  assert.ok(herdBest(b).p > 0 && herdBest(b).p <= 1);
  const away = stepHerd({ ...b, nx: 0.85, ny: 0.5 }, 0.2, 0.85, 0.5, tune);
  assert.ok(away.fish[0].dwell < b.fish[0].dwell, "빠져나가면 되돌아간다");
});

test("귀할수록 빠르고 덜 지친다 · 같은 입력 같은 결과 · 다 큰 놈은 없다 · 시간이 다 되면 흩어진다", () => {
  const spot = SPOTS.find((s) => s.key === "abyss")!;
  for (let i = 0; i < 30; i++) {
    const h = startHerd(spot, 20, 6, i * 17 + 1);
    for (const f of h.fish) assert.notEqual(f.haul.stage, 2);
    const real = h.fish.filter((f) => !f.haul.junk).sort((a, b) => a.haul.difficulty - b.haul.difficulty);
    if (real.length >= 2 && real[0].haul.difficulty < real[real.length - 1].haul.difficulty) {
      assert.ok(real[real.length - 1].flee > real[0].flee && real[real.length - 1].tire < real[0].tire);
    }
  }
  assert.deepEqual(play("harbor", 1, 5, 1, 99, "corner"), play("harbor", 1, 5, 1, 99, "corner"));
  // 33ms 틱이든 한 번에 0.25초든 고정 걸음이라 결과가 같다
  const tune = herdTune(1, { power: 5, line: 5 });
  let x = startHerd(spot, 5, 1, 7), y = startHerd(spot, 5, 1, 7);
  for (let k = 0; k < 30; k++) x = stepHerd(x, 1 / 30, 0.3, 0.7, tune);
  for (let k = 0; k < 4; k++) y = stepHerd(y, 0.25, 0.3, 0.7, tune);
  assert.ok(Math.abs(x.nx - y.nx) < 0.02 && Math.abs(x.t - y.t) < 0.05);
  let idle = startHerd(spot, 5, 1, 7);
  for (let k = 0; k < (HERD_TIME_S + 1) * 4; k++) idle = stepHerd(idle, 0.25, 0.5, 0.8, tune);
  assert.equal(idle.status === "out" || idle.status === "caught", true);
  assert.ok(play("harbor", 1, 5, 1, 99, "corner").quality <= 1);
});

test("화면 — 뜰채는 몰아서 건지기로 돈다 · 피버는 붙잡는 도중에 · 내리치기 · 들어올리기는 없다", () => {
  const g = code("src/components/FishingGame.tsx");
  assert.match(g, /stepHerd\(cur, dt, at\.x, at\.y, tune\)/);
  assert.match(g, /herdTune\(fs\.net, eff\)/, "뜰채 · 힘 · 줄 다루기가 그물에 듣는다");
  assert.match(g, /feverNow\(1 - best\.p,/);
  assert.match(g, /function beginScoop\(\) \{[\s\S]{0,400}planFever\(\);/, "판을 열 때 피버를 정한다");
  assert.match(g, /loseRound\("time"\)/);
  assert.doesNotMatch(g, /setPhase\("lift"\)|netDown\(|stepLift\(/);
  assert.match(g, /if \(method === "scoop"\) \{\s*beginScoop\(\);/, "던지지 않고 바로 판(가라앉기 없음)");
});
