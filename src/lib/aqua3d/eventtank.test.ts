// 계절 수조 행사의 3D 쪽(2026-11-18) — README §14.4.6 '안 한 것' 두 가지:
//  1) 계절 헤엄 빠르기 — 여름 활발 · 겨울 느림. 물고기 길은 따로 쌓는 물고기 시계(fishT += dt × 빠르기)로 계산한다
//  2) 행사 손님 물고기 — 지금 행사의 손님이 시간표대로 잠깐 3D 수조에 들른다(저장 · 정산 · 물고기 목록과 무관)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AQUA_EVENTS, EVENT_FROM, SWIM_PACE_AMP, VISITS_PER_HOUR, VISIT_MAX_S, VISIT_MIN_S, kstMidnight, swimPaceAt, visitSlot, visitWeight, visitWindow, visitorFor } from "../aquaevent.ts";
import { FISH_BASE_CM, familyOf } from "../aquarium.ts";
import { isPredator } from "../predation.ts";
import { FISH_GLB } from "./glb.ts";
import { isFishModelApproved } from "./quality.ts";
import { habitKey, habitOf, type Course } from "./habits.ts";
import { WORLD, fishLength, schoolsOf, tallY, tankTall, wideScale } from "./world.ts";
import { tankAxes } from "./tiers.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { hasBeach, rockObstacles, shoreLocal, substrateHeight } from "./habitat.ts";
import { tankDeep } from "./tunnel.ts";

const HOUR = 3_600_000;
/** KST 'YYYY-MM-DD' 정오 */
const noon = (day: string) => kstMidnight(day) + 12 * HOUR;
const adult = (f: string) => fishLength(FISH_BASE_CM[f] ?? 20, f);

// ── 1) 계절 헤엄 빠르기 ──

test("swim pace follows the real calendar: lively summer, slow winter, spring and autumn unchanged", () => {
  const p = (d: string) => swimPaceAt(noon(d));
  assert.ok(Math.abs(p("2027-07-16") - (1 + SWIM_PACE_AMP)) < 0.002, `한여름 ${p("2027-07-16")}`);
  assert.ok(Math.abs(p("2027-01-15") - (1 - SWIM_PACE_AMP)) < 0.002, `한겨울 ${p("2027-01-15")}`);
  for (const d of ["2027-03-10", "2027-04-16", "2027-05-25", "2027-09-10", "2027-10-15", "2026-11-18", "2027-11-25"]) assert.equal(p(d), 1, `${d} 봄 · 가을은 그대로`);
  for (const d of ["2027-07-01", "2027-07-31", "2027-08-10"]) assert.ok(p(d) > 1.05, `${d} 여름 ${p(d)}`);
  for (const d of ["2026-12-25", "2027-01-31", "2027-02-10"]) assert.ok(p(d) < 0.95, `${d} 겨울 ${p(d)}`);
  // 폭은 ±12 ~ 15% 안
  assert.ok(SWIM_PACE_AMP >= 0.12 && SWIM_PACE_AMP <= 0.15);
  // 출시일(행사 시작) 전 시각은 예전 그대로 — 1970 년 시각을 쓰는 기존 테스트 · 옛 저장이 그대로다
  assert.equal(swimPaceAt(noon("2026-08-01")), 1);
  assert.equal(swimPaceAt(0), 1);
  assert.ok(EVENT_FROM <= "2026-11-18");
});

test("swim pace changes smoothly — no step at midnight or new year, under 1% a day", () => {
  let worstHour = 0, worstDay = 0, lo = 9, hi = 0;
  const from = kstMidnight("2026-12-01"), to = kstMidnight("2028-01-10");
  for (let t = from; t < to; t += HOUR) {
    const a = swimPaceAt(t), b = swimPaceAt(t + HOUR), c = swimPaceAt(t + 24 * HOUR);
    worstHour = Math.max(worstHour, Math.abs(b - a)); worstDay = Math.max(worstDay, Math.abs(c - a));
    lo = Math.min(lo, a); hi = Math.max(hi, a);
  }
  assert.ok(worstHour < 0.0005, `한 시간 최대 변화 ${worstHour}`);
  assert.ok(worstDay < 0.01, `하루 최대 변화 ${worstDay}`);
  assert.ok(lo >= 1 - SWIM_PACE_AMP - 1e-9 && hi <= 1 + SWIM_PACE_AMP + 1e-9, `범위 ${lo} ~ ${hi}`);
});

/** 화면의 물고기 시계를 흉내 낸다 — fishT += dt × pace(t) 를 stepFish 에 넘긴다(scene.draw 와 같은 순서) */
function swim(families: string[], seconds: number, pace: (t: number) => number, opts: { hz?: number; feedAt?: number; absolute?: boolean } = {}) {
  const hz = opts.hz ?? 30, wide = wideScale(0), tall = tankTall(1), deep = tankDeep(1);
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, 1) - WORLD.floor) * tall;
  const obstacles = rockObstacles(1, wide, deep);
  const fish = families.map((family, i) => ({ id: 100 + i * 7, family, length: adult(family) }));
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0 };
  const frames: { t: number; pos: Float32Array; feed: number[]; v: number[] }[] = [];
  let fishT = 0;
  const shift = { t: 0, x: 0.5 };
  for (let k = 0; k <= seconds * hz; k++) {
    const t = k / hz, dt = k ? 1 / hz : 0;
    fishT += dt * pace(t);
    // 먹이 — 길의 먹이 시각은 '물고기 시계 − 먹이 준 뒤 실제 초'(scene 의 fishFeed 와 같은 식)
    const feed = opts.feedAt !== undefined && t >= opts.feedAt ? (shift.t = fishT - (t - opts.feedAt), shift) : null;
    stepFish(bodies, schools, (id) => byId.get(id)?.length, opts.absolute ? t * pace(t) : fishT, dt, { wide, tall, deep, heightAt, obstacles, feed, hall: null }, b);
    frames.push({ t, pos: b.positions.slice(0, n * 3), feed: b.courses.slice(0, n).map((c) => c.feed ?? 0), v: bodies.map(([, m]) => m.swim?.v ?? 0) });
  }
  return { frames, lengths: fish.map((f) => f.length) };
}
const FAMS = ["guppy", "tetra", "goldfish", "sea_bream", "catfish", "koi"];
/** 프레임 사이 가장 큰 움직임(몸길이/초) — from ~ to 초 사이 */
function worstJump(r: ReturnType<typeof swim>, from: number, to: number) {
  let worst = 0;
  for (let k = 1; k < r.frames.length; k++) {
    const a = r.frames[k - 1], b = r.frames[k];
    if (b.t < from || b.t > to) continue;
    for (let i = 0; i < r.lengths.length; i++) worst = Math.max(worst, Math.hypot(b.pos[i * 3] - a.pos[i * 3], b.pos[i * 3 + 1] - a.pos[i * 3 + 1], b.pos[i * 3 + 2] - a.pos[i * 3 + 2]) / (b.t - a.t) / r.lengths[i]);
  }
  return worst;
}

test("positions stay continuous when the pace factor changes (fish clock integrates dt × pace)", () => {
  // 겨울 빠르기로 20초 → 여름 빠르기로 바뀐다(실제로는 몇 달에 걸치지만 가장 나쁜 경우로 한 프레임에 바꾼다)
  const step = (t: number) => (t < 20 ? 1 - SWIM_PACE_AMP : 1 + SWIM_PACE_AMP);
  const ok = swim(FAMS, 30, step), bad = swim(FAMS, 30, step, { absolute: true });
  const around = worstJump(ok, 19.9, 20.2), before = worstJump(ok, 2, 19.8);
  assert.ok(around <= before * 1.3 + 0.2, `바뀌는 순간 ${around.toFixed(2)} L/s · 평소 최고 ${before.toFixed(2)} L/s`);
  // elapsed × 빠르기(절대 시각에 곱하기)였다면 바뀌는 순간 길이 다른 시각으로 통째로 뛴다 — 이 차이를 막으려고 따로 쌓는다
  const jump = worstJump(bad, 19.9, 20.2);
  assert.ok(jump > around * 4, `곱하기 방식 ${jump.toFixed(1)} L/s · 쌓기 방식 ${around.toFixed(2)} L/s`);
});

test("a constant pace is just a slower or faster clock: same input = same position, and the tail beat follows speed", () => {
  const k = 1 - SWIM_PACE_AMP;
  const a = swim(FAMS, 12, () => k), b = swim(FAMS, 12, () => k);
  assert.deepEqual(a.frames.at(-1)!.pos, b.frames.at(-1)!.pos, "같은 입력 = 같은 자리");
  // 물고기 시계 = k × 실제 시각 — 시각 k·t 의 길 자리와 같다(겹침 밀기 · 밀어내기 보정만 프레임마다 이어 가므로 몸길이 0.05 안)
  const slow = swim(["guppy"], 12, () => k), ref = swim(["guppy"], 12 * k + 1, () => 1);
  const at = (r: ReturnType<typeof swim>, t: number) => r.frames.reduce((best, f) => (Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best));
  for (const t of [3, 6, 9, 12]) {
    const p = at(slow, t).pos, q = at(ref, t * k).pos;
    assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < adult("guppy") * 0.05, `t=${t}`);
  }
  // 꼬리 박자는 잰 빠르기(swim.v)에서 나온다 — 여름이 겨울보다 빠르기 비(1.13/0.87 ≈ 1.30)만큼 빠르다
  const mean = (r: ReturnType<typeof swim>) => { let s = 0, c = 0; for (const f of r.frames.slice(60)) for (const v of f.v) { s += v; c++; } return s / c; };
  const ratio = mean(swim(FAMS, 40, () => 1 + SWIM_PACE_AMP)) / mean(swim(FAMS, 40, () => 1 - SWIM_PACE_AMP));
  assert.ok(ratio > 1.15 && ratio < 1.45, `여름/겨울 잰 빠르기 ${ratio.toFixed(3)}`);
});

test("feeding lines up with the real-time pellets at any pace (the course feed clock is real seconds)", () => {
  for (const k of [1 - SWIM_PACE_AMP, 1, 1 + SWIM_PACE_AMP]) {
    const r = swim(["guppy", "goldfish"], 30, () => k, { feedAt: 5 });
    const fed = (t: number) => Math.max(...r.frames.find((f) => Math.abs(f.t - t) < 1e-6)!.feed);
    assert.equal(fed(4.9), 0, `${k} 먹이 전`);
    assert.ok(fed(5 + 3) > 0.3, `${k} 3초 뒤엔 먹이에 모였다 ${fed(8)}`);
    // FEED_END(16초, 실제 초) 뒤엔 끝났다 — 빠르기와 상관없이 같은 실제 초
    assert.equal(fed(5 + 16.5), 0, `${k} 16초 뒤엔 끝`);
  }
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /const fishFeed=motion\.feed\?\(feedShift\.t=fishT-\(elapsed-motion\.feed\.t\),feedShift\.x=motion\.feed\.x,feedShift\):null;/);
  // 알갱이는 실제 시계 그대로
  assert.match(scene, /food\.step\(elapsed,dt,motion,reduced\.matches\)/);
});

test("hunts, replays and startles stay on the tank clock and read this frame's positions (any fish clock lines up)", () => {
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  // 물고기 시계는 멈춘 그리기(dt 0)에선 서 있고, 길만 그것으로 계산한다
  assert.match(scene, /if\(dt>0\)\{if\(paceAt<0\|\|elapsed-paceAt>=30\)\{paceAt=elapsed;pace=paceDev>0\?paceDev:swimPaceAt\(gameClock\(\)\);\}fishT\+=dt\*pace;\}/);
  assert.match(scene, /stepFish\(swimmers,schools,id=>swimmers\.get\(id\)\?\.length,fishT,dt,/);
  // 사냥 장면은 수조 시계(elapsed)로 자세를 내고, 자리는 이번 프레임 길이 낸 motion.positions 에서 받는다
  assert.match(scene, /mealPose\(elapsed-meal\.t0,meal\.style\)/);
  assert.match(scene, /const P=motion\.positions,H=motion\.heading,calm=reduced\.matches;/);
  assert.match(scene, /const t=elapsed-st\.t0;/, "놀람도 수조 시계");
  assert.equal((scene.match(/stepFish\(/g) ?? []).length, 1, "길을 계산하는 곳은 한 곳");
});

// ── 2) 행사 손님 물고기 ──

test("every season has a fitting guest fish that the 3D tank can draw and that is harmless", () => {
  const want: Record<string, string> = { spring: "bitterling", rainy: "loach", summer: "sweetfish", autumn: "saury", winter: "smelt" };
  for (const e of AQUA_EVENTS) {
    if (e.kind === "holiday") { assert.equal(e.visitor, undefined, `${e.key} 명절은 손님 물고기 없음`); continue; }
    const key = e.visitor!;
    assert.equal(key, want[e.key], e.key);
    assert.ok(FISH_GLB.has(key), `${key} 제작 모델`);
    assert.ok(isFishModelApproved(key), `${key} 승인된 모델`);
    const fam = familyOf(key)!;
    assert.ok(fam && fam.finals.some((f) => f.key === key), `${key} 계열 · 최종 key`);
    assert.equal(fam.minTank, 1, `${key} 1단계 수조에도 맞는 크기`);
    assert.ok((FISH_BASE_CM[key] ?? 99) <= 30, `${key} 작은 몸`);
    assert.equal(isPredator(key), false, `${key} 사냥꾼 아님`);
    const h = habitOf(habitKey(key, key));
    assert.ok(!h.den && !h.haul && !h.lap, `${key} 굴 · 쉼터 · 고리 습성 없음`);
  }
  assert.equal(visitorFor(["autumn"]), "saury");
  assert.equal(visitorFor(["winter", "xmas"]), "smelt");
  assert.equal(visitorFor(["xmas"]), null);
  assert.equal(visitorFor([]), null);
});

test("visit schedule is deterministic from time + seed: three 20-40 s visits per hour, inside their slot", () => {
  const h0 = Math.floor((noon("2026-11-18") + 9 * HOUR) / HOUR);
  for (let h = h0; h < h0 + 48; h++) {
    for (let i = 0; i < VISITS_PER_HOUR; i++) {
      const v = visitSlot(h, i, "couple-a"), w = visitSlot(h, i, "couple-a");
      assert.deepEqual(v, w, "같은 입력 = 같은 시간표");
      const dur = (v.end - v.start) / 1000;
      assert.ok(dur >= VISIT_MIN_S && dur <= VISIT_MAX_S, `길이 ${dur}`);
      const slot0 = h * HOUR - 9 * HOUR + (i * HOUR) / VISITS_PER_HOUR, slot1 = slot0 + HOUR / VISITS_PER_HOUR;
      assert.ok(v.start >= slot0 + 30_000 && v.end <= slot1 - 30_000, "칸 안(앞뒤 30초 여유) — 시간 · 날짜를 넘지 않는다");
      assert.deepEqual(visitWindow(v.start, "couple-a"), v);
      assert.deepEqual(visitWindow(v.end - 1, "couple-a"), v);
      assert.equal(visitWindow(v.end, "couple-a"), null);
      assert.equal(visitWindow(v.start - 1, "couple-a"), null);
    }
  }
  // 1초마다 훑으면 한 시간에 들른 시간은 1 ~ 2분
  let on = 0;
  const t0 = (h0 + 3) * HOUR - 9 * HOUR;
  for (let t = t0; t < t0 + HOUR; t += 1000) if (visitWindow(t, "couple-a")) on++;
  assert.ok(on >= VISITS_PER_HOUR * VISIT_MIN_S && on <= VISITS_PER_HOUR * (VISIT_MAX_S + 1), `한 시간 ${on}초`);
  // seed 가 다르면 시간표가 다르다(다른 커플)
  let diff = 0;
  for (let i = 0; i < 30; i++) if (visitSlot(h0 + i, 0, "couple-a").start !== visitSlot(h0 + i, 0, "couple-b").start) diff++;
  assert.ok(diff > 20, `다른 seed ${diff}/30`);
});

test("visit weight rises in, holds, and swims out smoothly", () => {
  const dur = 30;
  assert.equal(visitWeight(0, dur).w, 0);
  assert.equal(visitWeight(dur, dur).w, 0);
  assert.equal(visitWeight(15, dur).w, 1);
  let prev = 0;
  for (let u = 0.01; u < dur; u += 0.01) {
    const v = visitWeight(u, dur), h = 1e-4, num = (visitWeight(u + h, dur).w - visitWeight(u - h, dur).w) / (2 * h);
    assert.ok(Math.abs(v.w - prev) < 0.01, `u=${u.toFixed(2)} 이어진다`);
    if (u > 0.01 && Math.abs(u - 5) > 0.02 && Math.abs(u - 25) > 0.02) assert.ok(Math.abs(num - v.dw) < 1e-3, `u=${u.toFixed(2)} dw`);
    prev = v.w;
  }
});

/** 모래사장 수조(8단계)에 고래상어 · 작은 물고기 · 손님을 두고 한 번 들르는 동안 돌린다 */
function visit(tier: number, opts: { whale?: boolean; feedAt?: number; guest?: boolean; seconds?: number } = {}) {
  const ax = tankAxes(tier, tankTall(tier), tankDeep(tier)), wide = wideScale(0) * ax.x, tall = ax.tall, deep = ax.deep, beach = hasBeach(tier);
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, Math.min(tier, 6), beach) - WORLD.floor) * tall;
  const shore = beach ? (y: number, z = 0) => shoreLocal(WORLD.floor + (y - WORLD.floor) / tall, z / deep, beach) * wide : undefined;
  const obstacles = rockObstacles(tier, wide, deep);
  const fams = [...(opts.whale ? ["whale_shark"] : []), "guppy", "tetra", "goldfish"];
  const fish = fams.map((family, i) => ({ id: 100 + i * 7, family, length: adult(family) }));
  const schools = schoolsOf(fish), byId = new Map<number, { length: number }>(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const GUEST = -3_000_000, gL = adult("saury"), dur = 30;
  const guest: StepFish = { family: "saury", key: "saury", length: gL, phase: 0, course: {} as Course, visit: { w: 0, dw: 0 } };
  if (opts.guest !== false) { bodies.push([GUEST, guest]); byId.set(GUEST, { length: gL }); }
  const n = bodies.length, gi = bodies.findIndex(([id]) => id === GUEST);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0, ...(shore ? { shore } : {}) };
  const out: { u: number; w: number; x: number; y: number; z: number; feed: number; lim: number }[] = [];
  const hz = 30, feed = { t: 0, x: 0 };
  for (let k = 0; k <= (opts.seconds ?? dur) * hz; k++) {
    const u = k / hz;
    if (gi >= 0) { const v = visitWeight(u, dur); guest.visit!.w = v.w; guest.visit!.dw = v.dw; }
    const f = opts.feedAt !== undefined && u >= opts.feedAt ? (feed.t = opts.feedAt, feed) : null;
    stepFish(bodies, schools, (id) => byId.get(id)?.length, u, k ? 1 / hz : 0, { wide, tall, deep, heightAt, obstacles, feed: f, hall: null }, b);
    if (gi >= 0) {
      const x = b.positions[gi * 3], y = b.positions[gi * 3 + 1], z = b.positions[gi * 3 + 2];
      out.push({ u, w: guest.visit!.w, x, y, z, feed: b.courses[gi].feed ?? 0, lim: shore ? shore(y - gL * 0.2, z) - gL * 0.45 : 5 * wide });
    }
  }
  return { out, wide, deep, tall, gL, last: b.positions.slice(0, n * 3), n };
}

test("the guest swims in from outside the left glass, stays inside the water (beach shore too), and swims out", () => {
  for (const tier of [1, 8, 10]) {
    const r = visit(tier);
    const left = -5 * r.wide;
    assert.ok(r.out[0].x < left, `${tier}단계 처음엔 왼쪽 유리 밖 ${r.out[0].x.toFixed(2)}`);
    assert.ok(r.out.at(-1)!.x < left, `${tier}단계 끝엔 다시 유리 밖`);
    let worst = 0;
    for (let k = 1; k < r.out.length; k++) {
      const a = r.out[k - 1], b = r.out[k];
      worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 30 / r.gL);
      if (b.w >= 1) {
        assert.ok(b.x > left && b.x <= b.lim + 1e-3, `${tier}단계 머무는 동안 물 안 x=${b.x.toFixed(2)} 물가 ${b.lim.toFixed(2)}`);
        assert.ok(Math.abs(b.z) < 3 * r.deep, `${tier}단계 앞뒤 유리 안`);
        assert.ok(b.y > WORLD.floor && b.y < tallY(5.56, r.tall), `${tier}단계 수면 아래 y=${b.y.toFixed(2)}`);
      }
    }
    assert.ok(worst < 6, `${tier}단계 들고 나는 빠르기 최고 ${worst.toFixed(2)} L/s(순간 이동 없음)`);
  }
});

test("the guest is not a tank fish: no feeding, no whale-shark escort, no prey, not selectable", () => {
  // 먹이를 줘도 안 모인다(course.feed 0 — 먹이 알갱이도 안 먹는다) · 자리도 먹이 없을 때와 같다
  const fed = visit(1, { feedAt: 8 }), plain = visit(1);
  assert.ok(fed.out.every((o) => o.feed === 0), "손님은 먹이에 안 모인다");
  const at = (r: typeof fed, u: number) => r.out.find((o) => Math.abs(o.u - u) < 1e-6)!;
  for (const u of [10, 14, 18]) assert.ok(Math.hypot(at(fed, u).x - at(plain, u).x, at(fed, u).z - at(plain, u).z) < 0.35, `u=${u} 먹이와 상관없는 길`);
  // 고래상어가 있어도 따라가지 않는다 — 자리가 고래상어 없는 수조와 거의 같다(겹침 밀기 · 밀어내기에도 안 밀린다)
  const whale = visit(10, { whale: true }), none = visit(10);
  let far = 0;
  for (let k = 0; k < whale.out.length; k += 15) far = Math.max(far, Math.hypot(whale.out[k].x - none.out[k].x, whale.out[k].y - none.out[k].y, whale.out[k].z - none.out[k].z));
  assert.ok(far < 0.05, `고래상어 곁에서도 제 길 ${far.toFixed(3)}`);
  const step = readFileSync(new URL("./fishstep.ts", import.meta.url), "utf8");
  assert.match(step, /if \(m\.visit\) continue;\n {4}ESCORT\.push\(k\);/, "고래상어 무리에서 뺀다");
  assert.match(step, /opts\.feed = m\.visit \? null : w\.feed;/);
  assert.match(step, /M\[k\] = st\.den \|\| fishes\[k\]\.visit \? 0 :/, "밀어내기에 안 밀린다");
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  // 사냥꾼 표시 0 · 쫓고 쫓기기에서 빠진다(busy) · 눌러도 안 고른다 · 놀라지 않는다
  assert.match(scene, /motion\.preds\[j\+\+\]=isPredator\(m\.family\)&&!m\.visit\?1:0;/);
  assert.match(scene, /if\(guest\)\{let j=0;for\(const id of swimmers\.keys\(\)\)\{if\(id===GUEST_ID\)motion\.busy\[j\]=1;j\+\+;\}\}/);
  assert.match(scene, /if\(o\?\.userData\.guest\)return;/);
  // type 은 "fish" 그대로 — 묶음 그리기(moves)가 손님 몸을 정적 장식처럼 묶지 않게
  assert.match(scene, /m\.root\.userData=\{type:"fish",id:GUEST_ID,guest:true\}/);
  // 몸 크기는 실제 자리(왼쪽 유리에서 얼마나 안쪽인가)로 — 보이는 동안만
  assert.match(scene, /if\(m\.visit&&m\.root\.visible\)m\.root\.scale\.setScalar\(m\.scale\*guestSize\(x,m\.length\)\);/);
  assert.match(scene, /for\(const\[id,m\]of swimmers\)\{if\(m\.visit\)continue;projected\.copy/);
  assert.match(scene, /if\(m\.visit\)return;/);
  // 저장 · 물고기 목록과 무관 — 음수 id(update 는 0 이상만 지운다), 움직임 줄이기면 오지 않는다, 개발 훅은 배포 빌드에 없다
  assert.match(scene, /const GUEST_ID=-3_000_000/);
  assert.match(scene, /if\(dt<=0\|\|reduced\.matches\|\|meal\|\|elapsed-guestCheck<1\)return;/, "움직임 줄이기 · 사냥 장면 중엔 새로 안 온다");
  assert.match(scene, /if\(process\.env\.NODE_ENV!=="production"\)\{\(host as HTMLElement&\{__aquaGuest\?/);
  // 화면이 게임 시각 · 커플 seed 를 넘긴다(두 폰이 같은 시간표)
  const ui = readFileSync(new URL("../../components/AquariumGame.tsx", import.meta.url), "utf8");
  assert.match(ui, /season: \{ keys: events\.map\(\(e\) => e\.def\.key\), tints, clock: gameNow, seed: coupleId \?\? "" \}/);
});
