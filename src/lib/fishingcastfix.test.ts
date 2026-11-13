// 캐스팅 · 레이드 결함 lock (2026-11-13) — 튕김이 돌리기로 읽힘 · 루어 첫 박자 · 키보드 퍼펙트 · 프레임 멈춤 · 두 번째 손가락 · 슈퍼 연출 문턱 · 퍼펙트 찌 위 가장자리 ·
// 레이드 비틀거림 막대 · 움직임 줄이기 충격파 · 장비 시트 최대 거리 · 65m 목표.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAST_BOOST_MAX, FLICK_WINDOW_MS, KEY_FLICK, SPIN_HI, SPIN_LO, castBoost, castCurve, castMaxMeters, castMeters, castRange, castRating, castScore, castTiming,
  fishingOf, startSpin, startTrace, stepSpin, stepSpinFrame, traceMove, traceRelease, traceTick, type CastSpin,
} from "./fishing.ts";
import { lureLanded, lureTune, startLure, stepLure, tapLure } from "./fishingmodes.ts";
import { FishFx, castSup, landingPoint, type FxCanvas } from "./fishingfx.ts";
import { nextGoals } from "./fishinggoals.ts";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const RANGE = castRange(5, 40);

/** 화면과 같은 길로 한 번 던진다 — 60Hz 손가락이 반지름 60px 원을 rps 로 돌리고(시작 각 phase), 33ms 진행 칸이 traceTick 으로 돌리기를 쌓는다.
 *  금빛 신호(castTiming > 0)가 뜬 뒤 react ms 에 위로 speed px/ms 로 flickMs 동안 튕기고 놓는다(traceRelease). hold 를 주면 신호 대신 그 시각에 튕긴다 */
function throwSim(o: { phase: number; react?: number; hold?: number; flickMs?: number; speed?: number; rps?: number; key?: boolean }) {
  const tr = startTrace(0);
  let s: CastSpin = startSpin(), lastTick = 0, nextTick = 33, cueAt = -1, t = 0, x = 0, y = 0;
  const R = 60, rps = o.rps ?? 2.6, step = 1000 / 60;
  const tick = (now: number) => {
    while (now >= nextTick) {
      s = traceTick(tr, s, (nextTick - lastTick) / 1000, nextTick, o.key ? ((nextTick - lastTick) / 1000) * rps * Math.PI * 2 : undefined);
      lastTick = nextTick;
      nextTick += 33;
      if (cueAt < 0 && castTiming(s) > 0) cueAt = lastTick;
    }
  };
  const done = () => (o.hold !== undefined ? t >= o.hold : cueAt >= 0 && t >= cueAt + (o.react ?? 0));
  for (t = 0; !done() && t < 6000; t += step) {
    const a = o.phase + (t / 1000) * rps * Math.PI * 2;
    x = 180 + Math.cos(a) * R;
    y = 400 + Math.sin(a) * R;
    if (!o.key) traceMove(tr, x, y, t);
    tick(t);
  }
  if (!o.key) {
    const t0 = t, fy0 = y;
    for (; t <= t0 + (o.flickMs ?? 90); t += step) {
      traceMove(tr, x, fy0 - (t - t0) * (o.speed ?? 2), t);
      tick(t);
    }
  }
  const { spin, flick } = traceRelease(tr, s, t - step, !!o.key);
  const score = castScore(spin, flick), boost = castBoost(spin, flick);
  return { m: castMeters(score, RANGE, boost), rating: castRating(score, spin.turns, boost), curve: castCurve(spin), boost, score, live: s, spin, flick };
}
const phases = Array.from({ length: 12 }, (_, k) => (k / 12) * Math.PI * 2);

test("같은 솜씨면 원의 어느 자리에서 튕겨도 같다 — 튕김은 돌리기로 세지 않는다(12 자리 · 튕김 90 · 130ms)", () => {
  for (const flickMs of [90, 130]) {
    const r = phases.map((phase) => throwSim({ phase, react: 100, flickMs }));
    const ms = r.map((v) => v.m);
    assert.ok(Math.max(...ms) - Math.min(...ms) <= 2.5, `튕김 ${flickMs}ms 거리 ${Math.min(...ms)}~${Math.max(...ms)}m`);
    assert.equal(new Set(r.map((v) => v.rating)).size, 1, `한마디 ${[...new Set(r.map((v) => v.rating))].join(" / ")}`);
    assert.equal(new Set(r.map((v) => v.curve)).size, 1, `휘는 힘(방향이 뒤집히지 않는다) ${[...new Set(r.map((v) => v.curve))].join(" / ")}`);
    for (const v of r) assert.equal(v.rating, "퍼펙트 바나나킥!", `${flickMs}ms ${v.m}m`);
  }
  // 신호 바로 뒤(0.033초)에 튕겨도 — 꺾임 찾기가 원을 그리던 몫까지 거슬러 올라가 신호 앞 상태를 잡지 않는다
  const quick = phases.map((phase) => throwSim({ phase, react: 33, flickMs: 90 }));
  for (const v of quick) assert.equal(v.rating, "퍼펙트 바나나킥!", `신호 뒤 0.033초 ${v.m}m`);
  // 신호를 보지 않고 같은 시각(2.15초)에 튕겨도 자리와 상관없다
  const fixed = phases.map((phase) => throwSim({ phase, hold: 2150, flickMs: 80 }));
  assert.equal(new Set(fixed.map((v) => v.rating)).size, 1);
  assert.ok(Math.max(...fixed.map((v) => v.m)) - Math.min(...fixed.map((v) => v.m)) <= 2.5);
  // 고치기 전엔 같은 던지기가 57.9m(쭉 뻗었어요) ~ 89.7m(퍼펙트), 휘는 쪽까지 뒤집혔다 — 튕김 창 안의 방향 변화가 돌리기에 들어가서다
});

test("금빛 신호를 보고 튕기면 퍼펙트에 닿는다 — 과열은 튕기기 시작할 때 잰다 · 늦을수록 줄어든다", () => {
  const at = (react: number) => phases.map((phase) => throwSim({ phase, react, flickMs: 90 }));
  for (const v of at(100)) assert.equal(v.rating, "퍼펙트 바나나킥!", `신호 뒤 0.1초 ${v.m}m`);
  const late = at(250);
  for (const v of late) assert.equal(v.rating, "슈퍼 바나나킥!", `신호 뒤 0.25초는 슈퍼 ${v.m}m`);
  assert.ok(Math.max(...late.map((v) => v.boost)) < Math.min(...at(100).map((v) => v.boost)), "늦을수록 덜 멀리");
  // 튕김 창 안의 움직임은 상태에 안 들어간다 — 놓는 순간의 상태(live)는 과열 시간이 더 길다
  const v = throwSim({ phase: 1, react: 100, flickMs: 130 });
  assert.ok((v.spin.heat ?? 0) < (v.live.heat ?? 0), `튕기기 전 ${(v.spin.heat ?? 0).toFixed(3)} < 놓을 때 ${(v.live.heat ?? 0).toFixed(3)}`);
  assert.equal(FLICK_WINDOW_MS, 90);
});

test("키보드도 퍼펙트에 닿는다 — 일부러 누른 키는 끝까지 튕긴 것 · 미리 보기 거리가 같은 값을 쓴다", () => {
  let full = startSpin();
  while (full.energy < 0.995) full = stepSpin(full, 2.6 * Math.PI * 2 / 30, 1 / 30);
  const tr = startTrace(0);
  const k = traceRelease(tr, full, 5000, true);
  assert.equal(k.flick, KEY_FLICK);
  assert.equal(k.spin, full, "키보드는 놓는 순간의 상태(튕김이 없다)");
  assert.ok(castBoost(full, KEY_FLICK) >= 1 + CAST_BOOST_MAX * 0.8, `키보드 최대 ${castBoost(full, KEY_FLICK)}`);
  assert.equal(castRating(castScore(full, KEY_FLICK), full.turns, castBoost(full, KEY_FLICK)), "퍼펙트 바나나킥!");
  const game = src("src/components/FishingGame.tsx");
  assert.ok(!game.includes("FLICK_FULL * 0.9"), "키보드 0.9 배를 걷었다");
  assert.ok(game.includes("castScore(spinLive, KEY_FLICK)") && game.includes("castBoost(spinLive, KEY_FLICK)"), "미리 보기 = 놓을 때의 튕김");
  assert.ok(game.includes("traceRelease(traceRef.current, spinRef.current, deviceClock(), keySpin.current)"));
});

test("프레임이 멈춰도 빠르게 돌린 것으로 읽지 않는다 — 0.2초 멈춤 뒤 빠르기가 녹색 띠 안", () => {
  let s = startSpin();
  for (let i = 0; i < 60; i++) s = stepSpinFrame(s, 2.6 * Math.PI * 2 * 0.033, 0.033);
  const stalled = stepSpinFrame(s, 2.6 * Math.PI * 2 * 0.2, 0.2);
  assert.ok(Math.abs(stalled.rate) >= SPIN_LO && Math.abs(stalled.rate) <= SPIN_HI, `멈춘 뒤 빠르기 ${stalled.rate.toFixed(2)}`);
  assert.ok(stalled.energy >= s.energy, "힘을 잃지 않는다");
  // 고치기 전(시간만 0.1초로 자르고 각도는 그대로) — 빠르기가 띠 밖으로 튀었다
  const old = stepSpin(s, 2.6 * Math.PI * 2 * 0.2, 0.1);
  assert.ok(Math.abs(old.rate) > SPIN_HI, `옛 식 ${old.rate.toFixed(2)}`);
});

test("두 번째 손가락은 던지기에 끼어들지 않는다 — 던지기를 시작한 손가락만 따라가고 그 손가락을 떼야 던진다", () => {
  const game = src("src/components/FishingGame.tsx");
  assert.match(game, /const castPtr = useRef<number \| null>\(null\)/);
  assert.match(game, /return phase === "charge" && castPtr\.current !== null && id !== castPtr\.current;/);
  assert.match(game, /onPointerDown=\{\(e\) => \{[\s\S]{0,200}if \(otherFinger\(e\.pointerId\)\) return;[\s\S]{0,300}castPtr\.current = e\.pointerId;/);
  assert.match(game, /onPointerMove=\{\(e\) => \{\s+if \(otherFinger\(e\.pointerId\)\) return;/);
  assert.match(game, /onPointerUp=\{\(e\) => fingerUp\(e\.pointerId\)\}/);
  // 2026-11-13 — 취소는 cancel 표시를 달고 온다(뜰채 겨누기를 내리치지 않게, fishingvisual.test). 던지기 쪽 규칙은 그대로다
  assert.match(game, /onPointerCancel=\{\(e\) => fingerUp\(e\.pointerId, true\)\}/);
  assert.match(game, /function fingerUp\(id: number, cancel = false\) \{\s+if \(otherFinger\(id\)\) return;/);
});

test("루어 박자는 내려앉은 뒤부터 — 퍼펙트로 오래 날아도 첫 박자를 보지도 못하고 놓치지 않는다 · 나는 동안 탭은 치지 않는다", () => {
  const tune = lureTune(3, { power: 1, line: 1 });
  const fly = 1.44 + 0.16 * 0.94; // 퍼펙트 찌가 나는 시간 + 멈칫
  let l = startLure(7, tune, fly);
  assert.equal(lureLanded(l), false);
  const DT = 1 / 30;
  let t = 0;
  while (t < fly + tune.beat * 1.4 - 0.05) { l = stepLure(l, DT, tune, 3); t += DT; }
  assert.equal(l.beats, 0, "첫 박자가 아직 안 지나갔다");
  assert.ok(lureLanded(l));
  // 첫 박자에 맞춰 치면 맞는다
  while (l.t < l.nextBeat) { l = stepLure(l, DT, tune, 3); }
  assert.notEqual(tapLure(l, tune, 3).grade, "miss");
  // 고치기 전(0 에서 시작) — 나는 동안 첫 박자가 지나가 놓친 것으로 쳤다
  let old = startLure(7, tune);
  for (let tt = 0; tt < fly; tt += DT) old = stepLure(old, DT, tune, 3);
  assert.equal(old.beats, 1, "옛 식은 날아가는 동안 박자 하나를 흘렸다");
  const game = src("src/components/FishingGame.tsx");
  assert.ok(game.includes("startLure(seed, tune, flyMs / 1000)"));
  assert.match(game, /if \(!lureLanded\(cur\)\) return;[^\n]*\n\s+const \{ lure, grade \} = tapLure\(cur, tune, fightLevel\(fish\)\);/);
});

function fakeCanvas(): FxCanvas {
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (_t, name: string) => () => (name.startsWith("create") ? grad : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
  return { width: 0, height: 0, getContext: () => ctx };
}
function castFx(boost: number, curve: number, r = 0.5, reduced = false) {
  const fx = new FishFx(fakeCanvas(), null, reduced);
  fx.resize(360, 640, 2);
  fx.set({ spot: "harbor", rod: "rod_star", phase: "charge", charge: 1 });
  for (let t = 0; t < 300; t += 16) fx.frame(16);
  fx.set({ phase: "wait" });
  const rings0 = fx.counts().rings;
  const ms = fx.cast(landingPoint(1, r), 3000, 0.5, 3, 1, curve, boost);
  const rings = fx.counts().rings - rings0;
  let minY = Infinity, landedAt = -1;
  const pts: { x: number; y: number }[] = [];
  for (let t = 0; t < ms + 600; t += 16) {
    fx.frame(16);
    const c = fx.counts();
    if (c.flying) pts.push({ x: c.bobX, y: c.bobY });
    else if (landedAt < 0) landedAt = t + 16;
  }
  for (const p of pts.slice(Math.floor(pts.length * 0.2))) minY = Math.min(minY, p.y);
  return { ms, rings, minY, landedAt };
}

test("슈퍼 · 퍼펙트 연출은 슈퍼 문턱부터 — 보통 던지기(boost 1.05)엔 멈칫 · 고리가 없다", () => {
  assert.equal(castSup(1), 0);
  assert.equal(castSup(1.05), 0);
  assert.equal(castSup(1.08), 0);
  assert.ok(castSup(1.12) > 0 && castSup(1.25) === 1);
  const plain = castFx(1, 1), weak = castFx(1.05, 1), perfect = castFx(1.25, 1);
  assert.equal(weak.ms, plain.ms, "멈칫 없음 · 더 오래 날지 않음");
  assert.equal(weak.rings, plain.rings, "빛 고리 없음");
  assert.ok(perfect.rings > plain.rings && perfect.ms > plain.ms);
});

test("퍼펙트 찌도 화면 위 가장자리 안 · 돌려주는 시간은 멈칫까지 — 실제로 내려앉는 때와 같다", () => {
  for (const r of [0, 0.5, 0.99]) for (const curve of [1, 0.6, 0, -1]) for (const boost of [1, 1.12, 1.25]) {
    const v = castFx(boost, curve, r);
    assert.ok(v.minY >= 640 * 0.03 - 0.5, `boost ${boost} curve ${curve} r ${r}: 가장 높은 y ${v.minY.toFixed(1)}`);
    assert.ok(Math.abs(v.landedAt - v.ms) <= 40, `boost ${boost}: 돌려준 ${v.ms}ms · 실제 ${v.landedAt}ms`);
  }
  const still = castFx(1.25, 1, 0.5, true);
  assert.ok(Math.abs(still.landedAt - still.ms) <= 40, "움직임 줄이기면 멈칫이 없다");
});

test("레이드 — 상처로 시작하면 비틀거림 막대가 상처 길이에서 줄고 · 움직임 줄이기면 충격파가 남지 않는다", () => {
  const raid = src("src/components/BossRaidGame.tsx");
  assert.ok(raid.includes("const staggerMax = useRef(setup.wound > 0 ? setup.wound : 1);"));
  assert.ok(raid.includes("if (!reduced) setBurst("));
  const css = src("src/styles/games.css");
  const reducedBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".boss-raid-burst { display: none; }")));
  assert.ok(reducedBlock.startsWith("@media (prefers-reduced-motion: reduce)") && reducedBlock.includes(".boss-raid-burst { display: none; }"), "움직임 줄이기 블록 안에서 숨긴다");
});

test("장비 시트 · 낚싯대 목록의 최대 거리는 퍼펙트까지 — 기록이 '최대'를 넘지 않는다 · 던지기 목표는 80m", () => {
  assert.equal(castMaxMeters(5, 40), castMeters(1, castRange(5, 40), 1 + CAST_BOOST_MAX));
  assert.equal(castMaxMeters(5, 40), 90);
  const best = phases.map((phase) => throwSim({ phase, react: 50, flickMs: 90 }).m);
  for (const m of best) assert.ok(m <= castMaxMeters(5, 40), `${m}m`);
  const game = src("src/components/FishingGame.tsx");
  assert.ok(game.includes("캐스팅 최대 {Math.round(castMaxMeters(fs.rod, fs.stats.power))}m"));
  assert.equal(nextGoals({ ...fishingOf({}), goals: ["cast_30", "cast_50"], bestCast: 0 }).find((g) => g.id.startsWith("cast_"))!.id, "cast_65", "65m 는 그대로 — 이미 던지고 안 받은 사람의 보상을 지킨다");
  const goals = nextGoals({ ...fishingOf({}), goals: ["cast_30", "cast_50", "cast_65"], bestCast: 0 }).find((g) => g.id.startsWith("cast_"))!;
  assert.equal(goals.id, "cast_85");
  assert.ok(goals.need > castRange(5, 40) && goals.need <= castMaxMeters(5, 40), "퍼펙트로만 닿는 오랜 목표");
});
