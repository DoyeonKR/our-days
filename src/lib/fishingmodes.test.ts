// 낚시 방식 lock. [사용자 2026-11-02 "낚시 게임 방식도 더 여러방면으로 추가 … 난이도도 더 높이고"]
// 봇은 사람을 흉내 낸다(반응 지연 · 오차) — 값이 아니라 '조절해야만 잡힌다' · '장비가 곡선을 민다' · '아무렇게나 하면 안 된다'를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPOTS, poolFor } from "./fishing.ts";
import {
  PLUNGE_S, SCOOP_SHOTS, deepBand, deepTune, lureTune, netRadius, plunge, scoopPos, startDeep, startLure, startScoop, startSway, stepDeep, stepLure, stepScoop, stepSway, swayTune, tapLure,
  type Scoop,
} from "./fishingmodes.ts";

const DT = 0.033;
const noise = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 2 ** 32;
  };
};
const rate = (fn: (seed: number) => boolean, n = 200) => {
  let w = 0;
  for (let i = 0; i < n; i++) if (fn(i * 131 + 3)) w++;
  return w / n;
};

/* 루어 */
function lureRun(d: number, p: number, l: number, seed: number, err: number, spam = false) {
  const tune = lureTune(d, { power: p, line: l });
  let s = startLure(seed, tune);
  const r = noise(seed + 3);
  let aim = err * (r() - 0.5) * 2, tapped = -1, cool = 0;
  for (let i = 0; i < 3000 && s.status === "on"; i++) {
    cool -= DT;
    if (spam ? cool <= 0 : s.t >= s.nextBeat + aim && tapped !== s.nextBeat) {
      tapped = s.nextBeat;
      cool = 0.2;
      s = tapLure(s, tune, d).lure;
      aim = err * (r() - 0.5) * 2;
      if (s.status !== "on") break;
    }
    s = stepLure(s, DT, tune, d);
  }
  return s;
}
test("루어 유인 — 박자에 맞추면 문다 · 마구 누르면 안 문다 · 안 누르면 줄이 다 감긴다 · 등급이 높을수록 어렵다", () => {
  const ok = (d: number, p = 1) => rate((s) => lureRun(d, p, p, s, 0.15).status === "strike");
  assert.ok(ok(0) > 0.65, String(ok(0)));
  assert.ok(ok(8) < ok(0), `등급이 높을수록 어렵다 ${ok(8)}`);
  assert.ok(ok(4, 30) > ok(4), "장비가 체감된다");
  assert.equal(rate((s) => lureRun(0, 1, 1, s, 0, true).status === "strike"), 0, "마구 누르기");
  const tune = lureTune(0, { power: 1, line: 1 });
  let idle = startLure(5, tune);
  for (let i = 0; i < 2000 && idle.status === "on"; i++) idle = stepLure(idle, DT, tune, 0);
  assert.equal(idle.status, "empty");
});

/* 좌우 */
function swayRun(d: number, p: number, l: number, seed: number, policy: "human" | "still" | "same") {
  const tune = swayTune(d, { power: p, line: l });
  let s = startSway(seed, tune);
  const hist = [s];
  let rod = 0;
  for (let i = 0; i < 6000 && s.status === "on"; i++) {
    const seen = hist[Math.max(0, hist.length - 1 - 8)];
    const want = policy === "still" ? 0 : (policy === "same" ? 1 : -1) * Math.sign(seen.fishX || 1) * 0.9;
    rod += Math.max(-DT * 5, Math.min(DT * 5, want - rod));
    s = stepSway(s, DT, rod, tune);
    hist.push(s);
  }
  return s;
}
test("좌우 끌기 — 반대쪽으로 끌어야 잡힌다 · 가만히 있거나 같은 쪽이면 끊어진다 · 장비가 곡선을 민다", () => {
  const ok = (d: number, p = 1) => rate((s) => swayRun(d, p, p, s, "human").status === "landed", 100);
  assert.ok(ok(0) > 0.9);
  assert.ok(ok(4) > 0.6, `예전 기준으로 쉬워졌다 ${ok(4)}`);
  assert.ok(ok(8) <= ok(0));
  assert.equal(swayRun(0, 1, 1, 7, "still").status, "snapped");
  assert.equal(swayRun(0, 1, 1, 7, "same").status, "snapped");
});

/* 뜰채 */
function scoopRun(spotI: number, bait: number, net: number, seed: number, lead: boolean, err: number) {
  let s: Scoop = startScoop(SPOTS[spotI], 5, bait, seed);
  const r = noise(seed + 5);
  const R = netRadius(net);
  let cool = 1.2;
  for (let i = 0; i < 3000 && s.status === "on"; i++) {
    cool -= DT;
    if (cool <= 0) {
      const tgt = s.fish.find((f) => scoopPos(f, s.clock + PLUNGE_S).reach) ?? s.fish[0];
      const p = scoopPos(tgt, s.clock + (lead ? PLUNGE_S : 0));
      s = plunge({ ...s, clock: s.clock + PLUNGE_S }, p.x + (r() - 0.5) * err, p.y + (r() - 0.5) * err, R);
      cool = 1.4;
      continue;
    }
    s = stepScoop(s, DT);
  }
  return s;
}
test("뜰채 — 앞서 노려야 잘 건진다 · 좋은 뜰채는 그물이 넓다 · 세 번 빗나가면 끝 · 깊이 들어간 놈은 못 건진다", () => {
  const ok = (lead: boolean, net: number) => rate((s) => scoopRun(0, 0, net, s, lead, 0.2).status === "caught");
  assert.ok(ok(true, 0) > ok(false, 0), `앞서 ${ok(true, 0)} / 그 자리 ${ok(false, 0)}`);
  assert.ok(ok(true, 0) > 0.6, `첫 뜰채로도 잘 건진다 ${ok(true, 0)}`);
  assert.ok(ok(true, 5) > ok(true, 0));
  let s = startScoop(SPOTS[0], 1, 0, 42);
  for (let i = 0; i < SCOOP_SHOTS; i++) s = plunge(s, -1, -1, 0.05);
  assert.equal(s.status, "out");
  const f = startScoop(SPOTS[0], 1, 0, 9);
  const fish = f.fish[0];
  let deepAt = 0;
  while (scoopPos(fish, deepAt).reach && deepAt < 60) deepAt += 0.05;
  const p = scoopPos(fish, deepAt);
  const only = { ...f, clock: deepAt, fish: [fish] };
  assert.equal(plunge(only, p.x, p.y, 0.1).status === "caught", false, "깊은 놈");
});
test("뜰채 — 수면 물고기는 미끼 상한을 지킨다 · 빗나가면 다 같이 놀라서 빨라진다 · 움직임은 시계만의 함수", () => {
  for (let i = 0; i < 40; i++) {
    const s = startScoop(SPOTS[1], 3, 1, i * 7 + 1);
    for (const f of s.fish) assert.ok(poolFor(SPOTS[1], 2).some(([k]) => k === f.haul.family), f.haul.family);
    for (const f of s.fish) assert.notEqual(f.haul.stage, 2);
  }
  const s = startScoop(SPOTS[0], 1, 0, 3);
  const missed = plunge(s, -1, -1, 0.05);
  assert.ok(missed.startled > 0);
  assert.ok(stepScoop(missed, 0.1).clock > stepScoop(s, 0.1).clock);
  assert.deepEqual(scoopPos(s.fish[0], 2), scoopPos(s.fish[0], 2));
});

/* 심해 */
function deepRun(d: number, p: number, l: number, seed: number, policy: "human" | "fast" | "stop" | "nostop") {
  const tune = deepTune(d, { power: p, line: l });
  let s = startDeep(seed, tune);
  const hist = [s];
  const r = noise(seed + 2);
  let rps = 1.2;
  for (let i = 0; i < 6000 && s.status === "on"; i++) {
    const seen = hist[Math.max(0, hist.length - 1 - 10)];
    const b = deepBand(seen, tune);
    const mid = (b.lo + b.hi) / 2 + (r() - 0.5) * 1.2;
    const want = policy === "fast" ? 3.5 : policy === "stop" ? 0 : policy === "nostop" ? mid : seen.diveLeft > 0 || seen.warnLeft > 0 ? 0 : mid;
    rps += (want - rps) * Math.min(1, DT * 7);
    s = stepDeep(s, DT, Math.max(0, rps), tune);
    hist.push(s);
  }
  return s;
}
test("심해 — 초록 속도를 지키고 파고들 때 멈춰야 잡힌다 · 막 돌리면 끊어지고 · 안 돌리면 빠지고 · 파고들 때 돌리면 끊어진다", () => {
  const ok = (d: number, p = 1) => rate((s) => deepRun(d, p, p, s, "human").status === "landed", 100);
  assert.ok(ok(0) > 0.8);
  assert.ok(ok(8) <= ok(0));
  assert.ok(ok(4, 15) >= ok(4));
  assert.ok(ok(8, 65) > 0.2, `최고 장비 태초: ${ok(8, 65)}`);
  assert.equal(deepRun(0, 1, 1, 3, "fast").status, "snapped");
  assert.notEqual(deepRun(0, 1, 1, 3, "stop").status, "landed");
  assert.ok(rate((s) => deepRun(2, 1, 1, s, "nostop").status === "snapped", 100) > 0.6, "파고들 때 돌리기");
});

test("화면 — 네 방식의 진행 함수를 모두 부른다 · 모든 놓침에 문구가 있다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  for (const k of ["stepFight(", "stepLure(", "tapLure(", "stepSway(", "stepScoop(", "plunge(", "stepDeep("]) assert.ok(src.includes(k), k);
  assert.ok(src.includes("spendBait("), "던질 때 미끼를 쓴다");
  assert.ok(src.includes("haulJunk("), "꽝을 치운다");
  assert.ok(src.includes("junk: true"), "실제 낚시에서 꽝이 켜져 있다");
});
