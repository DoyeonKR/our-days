// 섬 · 합치기 · 저장 길 리뷰 lock (2026-11-11) — 리뷰어 재현 스크립트(bench b~g)를 회귀 테스트로 옮겼다.
//   1. 작물이 자정 · 계절 경계 · 물 마름에 되돌아간다 → 구간 적분(단조)
//   2. 자정을 넘겨 열어 둔 섬 — 퀘스트 진행이 어제 것으로 간다
//   3. 응답을 잃은 저장 → 액션이 두 번 들어간다 → 저장 표식(_saves) · 농기구 목표 단계
//   4. 합치기 정산 두 번
//   6. 시계가 앞선 폰 → 상대 돌봄 47시간 잠김
//   8. 502 · 503 · HTML · 코드 없는 오류가 '그 밖'으로 떨어져 초안을 버린다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as I from "./island.ts";
// ⚠ 네임스페이스 import — 고치기 전 코드(새 함수가 없다)에서도 파일이 열려 테스트마다 따로 실패한다(엔진 동작은 단언에서)
import * as M from "./merge.ts";
import * as Y from "./islandsync.ts";
import type { PendingDraft } from "./islandsync.ts";

const H = 3_600_000;
const code = (p: string) =>
  readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** 비 오는 날 자동 급수가 끼지 않는 시각을 고른다(물기 구간을 시험이 정한다) */
function dryDay(s: I.IslandState, from: number): number {
  for (let t = from; ; t += I.DAY_MS) if (I.weatherOf(s, t) !== "rain" && I.weatherOf(s, t + I.DAY_MS) !== "rain" && I.weatherOf(s, t + 2 * I.DAY_MS) !== "rain") return t;
}
const pumpkin = I.CROPS.find((c) => c.key === "pumpkin")!;

test("★ 1. 작물 — 물이 마르는 순간 되돌아가지 않는다(bench c: 0.60 → 0.40 이었다)", () => {
  const probe = I.createIsland("p", null, Date.parse("2026-11-03T01:00:00Z"));
  const t0 = dryDay(probe, Date.parse("2026-11-03T01:00:00Z"));
  let s = { ...I.createIsland("p", null, t0), coins: 1e6 };
  s = I.plant(s, 0, pumpkin.key, t0);
  const at = (h: number) => I.cropStage(s, s.farm.plots[0], t0 + h * H).progress;
  assert.ok(Math.abs(at(10) - 0.25) < 1e-9, "촉촉한 동안은 옛 식과 같은 속도(물 1.5배)");
  assert.ok(at(24.1) >= at(23.9), `물이 말라도 진행이 줄지 않는다 (${at(23.9).toFixed(3)} → ${at(24.1).toFixed(3)})`);
  let prev = 0;
  for (let h = 0; h <= 80; h += 0.25) {
    const p = at(h);
    assert.ok(p >= prev - 1e-12, `${h}h 에서 되돌아감 ${prev} → ${p}`);
    prev = p;
  }
  // 물을 주면 진행이 줄지 않는다(구간이 늘기만)
  const before = at(30);
  const w = I.waterPlot(s, 0, t0 + 30 * H);
  assert.ok(I.cropStage(w, w.farm.plots[0], t0 + 30 * H).progress >= before);
  assert.ok(I.cropStage(w, w.farm.plots[0], t0 + 40 * H).progress > I.cropStage(s, s.farm.plots[0], t0 + 40 * H).progress, "다시 준 물은 그 뒤를 빠르게");
});

test("★ 1. 작물 — 12-01 00:00 KST 계절 경계에서 익은 가을 작물이 되돌아가지 않는다(bench c: 1.00 → 0.53 이었다)", () => {
  const t1 = Date.parse("2026-11-28T00:00:00Z");
  let s = { ...I.createIsland("p", null, t1), coins: 1e6 };
  s = I.plant(s, 0, pumpkin.key, t1);
  const st = (iso: string) => I.cropStage(s, s.farm.plots[0], Date.parse(iso));
  assert.equal(st("2026-11-30T14:00:00Z").ripe, true);
  assert.equal(I.seasonOf(Date.parse("2026-11-30T15:30:00Z")), "winter");
  assert.equal(st("2026-11-30T15:30:00Z").ripe, true, "겨울이 되어도 익은 채");
  // 경계를 가로지르는 덜 익은 작물도 단조 — 경계 뒤로는 제철 아닌 속도(절반)로만 느려진다
  const t2 = Date.parse("2026-11-29T12:00:00Z");
  let g = { ...I.createIsland("p", null, t2), coins: 1e6 };
  g = I.plant(g, 0, pumpkin.key, t2);
  let prev = 0;
  for (let t = t2; t < t2 + 6 * I.DAY_MS; t += 15 * 60_000) {
    const p = I.cropStage(g, g.farm.plots[0], t).progress;
    assert.ok(p >= prev - 1e-12, `${new Date(t).toISOString()} 되돌아감`);
    prev = p;
  }
  // 반대로 — 제철이 아닐 때 심은 작물은 제철이 와도 지난 시간까지 제철로 쳐 주지 않는다(겨울 작물을 11월에 심음)
  const winterCrop = I.CROPS.find((c) => c.season === "winter" && !c.minSkill && !c.unique && !c.regrow)!;
  let w = { ...I.createIsland("p", null, t2), coins: 1e6 };
  w = I.plant(w, 0, winterCrop.key, t2);
  const edge = Date.parse("2026-11-30T15:00:00Z");
  const a = I.cropStage(w, w.farm.plots[0], edge - 60_000).progress;
  const b = I.cropStage(w, w.farm.plots[0], edge + 60_000).progress;
  assert.ok(b - a < 0.01, `경계에서 한꺼번에 뛰지 않는다 (${a.toFixed(3)} → ${b.toFixed(3)})`);
});

/** 다음 날 퀘스트에 id 가 들어 있는 KST 날짜(23:00)를 고른다 */
function eveWith(id: string): number {
  for (let t = Date.parse("2026-11-10T14:00:00Z"); ; t += I.DAY_MS) {
    const probe = I.claimVisit(I.createIsland("p", null, t), "u", t + 2 * H, null);
    if (probe.quest.list.some((q) => q.id === id) && I.weatherOf(probe, t + 2 * H) !== "rain") return t;
  }
}

test("★ 2. 자정을 넘겨 열어 둔 섬 — 진행은 오늘 퀘스트로(bench c · d: 어제 퀘스트에 쌓여 받지도 못했다)", () => {
  const eve = eveWith("water"); // 23:00 KST
  let q = { ...I.claimVisit(I.createIsland("p", null, eve), "u", eve, null), coins: 1e6 };
  const yesterday = q.quest.date;
  const after = eve + 2 * H; // 다음 날 01:00 KST — 다시 방문 처리 없이
  for (let i = 0; i < 4; i++) q = I.waterPlot(I.plant(q, i, pumpkin.key, after), i, after);
  assert.notEqual(q.quest.date, yesterday);
  assert.equal(q.quest.date, I.kstDate(after));
  const water = q.quest.list.find((x) => x.id === "water")!;
  assert.equal(water.prog, water.goal, "물주기 4번이 오늘 퀘스트에 들어간다");
  const c = I.claimQuest(q, "water", after);
  assert.notEqual(c, q, "받을 수 있다");
  // 돌봄 퀘스트(addCareXp 안의 진행)도 같은 길
  const careEve = eveWith("care");
  const p = { ...I.claimVisit(I.createIsland("p", null, careEve), "u", careEve, null), coins: 1e6 };
  const fed = I.feedPet(p, careEve + 2 * H);
  assert.equal(fed.quest.date, I.kstDate(careEve + 2 * H));
  assert.equal(fed.quest.list.find((x) => x.id === "care")?.prog, 1);
});

test("★ 2. 화면 — 자정을 넘기면 다시 방문 처리 · 숨은 동안 시계 멈춤 [소스 스캔]", () => {
  const g = code("components/IslandGame.tsx");
  assert.match(g, /const visitDayRef = useRef<string \| null>\(null\)/);
  assert.match(g, /const day = kstDate\(t\);\s*if \(visitDayRef\.current === day\) return;/, "방문을 날짜로 가르지 않는다(한 번만 돈다)");
  assert.match(g, /\}, \[row, myUserId, now\]\);/, "날짜 확인이 시계를 따라 돌지 않는다");
  assert.doesNotMatch(g, /visitedRef/, "한 번만 도는 방문 가드가 남았다");
  const clock = g.slice(g.indexOf("const iv = setInterval("), g.indexOf("const iv = setInterval(") + 400);
  assert.match(clock, /if \(!hidden\(\)\) setNow\(gameNow\(\)\)/, "숨은 동안에도 3초마다 화면 전체를 다시 그린다");
  assert.match(g, /addEventListener\("visibilitychange", onVis\)/, "다시 보일 때 시계를 바로 맞추지 않는다");
  assert.match(g, /s\.quest\.date === kstDate\(now\) \? s\.quest\.list : \[\]/, "어제 퀘스트를 오늘 것처럼 보여 준다");
});

test("★ 3. 응답을 잃은 저장 — 표식이 있으면 그 몫은 다시 놓지 않는다(bench b: 비료 1→2→3 · 스프링클러 0→1→2)", () => {
  const now = Date.parse("2026-11-11T03:00:00Z");
  let base = I.createIsland("p", "2025-01-01", now - 30 * I.DAY_MS);
  base = { ...base, coins: 10_000_000, level: 40, farm: { ...base.farm, skillXp: 1e7 } };
  const target = I.toolLevel(base, "sprinkler") + 1;
  const ops = [(x: I.IslandState) => I.buyFertilizer(x, false), (x: I.IslandState) => I.buyTool(x, "sprinkler", now, target), (x: I.IslandState) => I.expandPlots(x, base.farm.plots.length + 2)];
  let committed = base;
  for (const op of ops) committed = op(committed);
  const mark = Y.newSaveMark();
  const server = Y.withSaveMark(committed, mark); // 서버에 들어간 상태(응답만 잃었다)
  const attempts = [{ mark, n: ops.length }];
  assert.equal(Y.committedOps(server, attempts), 3);
  const r = Y.opsToReplay(server, attempts, ops);
  assert.equal(r.ops.length, 0, "들어간 시도의 액션은 다시 놓지 않는다");
  const after = Y.replayOps(server, r.ops).state;
  assert.equal(after.farm.fert, committed.farm.fert, "비료를 또 사지 않는다");
  assert.equal(after.coins, committed.coins, "하트가 또 빠지지 않는다");
  // 그 뒤에 쌓인 액션은 남는다
  const more = [...ops, (x: I.IslandState) => I.buyFertilizer(x, false)];
  assert.equal(Y.opsToReplay(server, attempts, more).ops.length, 1);
  // 들어가지 않은 시도(표식 없음)는 전부 다시 놓는다
  assert.equal(Y.opsToReplay(committed, [{ mark: Y.newSaveMark(), n: 3 }], ops).ops.length, 3);
  // 표식을 몰라도(다른 앱 · 다시 받기 실패 뒤 다시 누름) 농기구 · 밭 넓히기는 목표 단계라 다시 놓아도 한 번만
  const replay = Y.replayOps(committed, ops);
  assert.equal(I.toolLevel(replay.state, "sprinkler"), target, "다음 단계를 또 사지 않는다");
  assert.equal(replay.state.farm.plots.length, committed.farm.plots.length, "밭을 또 넓히지 않는다");
});

test("★ 3. 저장 표식 링 — 최상위 칸 · 상한 · 모든 쓰는 길이 흘려보낸다", () => {
  let s: I.IslandState = I.createIsland("p", null, Date.parse("2026-11-11T03:00:00Z"));
  const first = Y.newSaveMark();
  s = Y.withSaveMark(s, first);
  for (let i = 0; i < Y.SAVE_MARKS + 5; i++) s = Y.withSaveMark(s, Y.newSaveMark());
  assert.equal(s._saves?.length, Y.SAVE_MARKS);
  assert.equal(Y.hasSaveMark(s, first), false, "오래된 표식은 밀려난다");
  const m = Y.newSaveMark();
  const marked = Y.withSaveMark(s, m);
  // 엔진(clone) · 합치기 정산 · 시계 정리가 표식을 지우지 않는다(옛 앱도 ...s 로 흘린다 — b21e977 의 최상위 칸과 같은 자리)
  assert.ok(Y.hasSaveMark(I.feedPet(marked, Date.parse("2026-11-11T09:00:00Z")), m));
  assert.ok(Y.hasSaveMark(M.settleGame(marked, "u", 3000, 8, "2026-11-11").state, m));
  assert.ok(Y.hasSaveMark(I.rebaseFuture({ ...marked, pet: { ...marked.pet, cd: { feed: Date.parse("2026-11-20T00:00:00Z") } } }, Date.parse("2026-11-11T09:00:00Z")), m));
  // 저장 길은 한 곳(saveIsland)에서 표식을 붙이고, 화면 · 낚시는 표식을 먼저 만들어 넘긴다
  const couple = code("lib/couple.ts");
  assert.match(couple, /const marked = withSaveMark\(state, mark\);/);
  const fish = code("components/FishingGame.tsx");
  assert.match(fish, /saveIsland\(coupleId, r\.version, res\.state, mark\)/, "낚시가 표식 없이 저장한다");
  assert.match(fish, /if \(lost && Array\.isArray\(marks\) && marks\.includes\(lost\.mark\)\)[\s\S]{0,120}return lost\.res;/, "들어간 저장을 또 make 로 돌린다");
  const g = code("components/IslandGame.tsx");
  assert.match(g, /saveIsland\(coupleId, cur\.version, next, mark\)/);
  assert.match(g, /if \(attemptsRef\.current\.length\) \{[\s\S]{0,200}refreshIsland\(coupleId\)/, "응답을 잃은 뒤 다시 보내기 전에 확인하지 않는다");
  assert.match(g, /buyTool\(x, k, t, target\)/, "농기구를 목표 단계 없이 산다");
});

test("★ 4. 합치기 — 같은 판을 두 번 정산하지 않는다(bench f: 두 번째에 하트 60 을 또 줬다)", () => {
  const now = Date.parse("2026-11-11T03:00:00Z");
  const s = I.createIsland("p", null, now);
  const a = M.settleGame(s, "u", 3000, 8, "2026-11-11", 123);
  const b = M.settleGame(a.state, "u", 3000, 8, "2026-11-11", 123);
  assert.ok(a.coins > 0);
  assert.equal(b.dup, true);
  assert.equal(b.coins, 0);
  assert.equal(b.state, a.state, "아무것도 안 바꾼다(저장도 안 한다)");
  assert.ok(M.settleGame(a.state, "u", 3000, 8, "2026-11-11", 124).coins > 0, "다른 판은 그대로 받는다");
  // 기기 기록에 표시를 바로 쓴다 — 지금 판은 그대로, 그 판만
  const raw = JSON.stringify({ game: { score: 1 }, finished: { id: 1, settled: false, ranked: false }, backlog: [{ id: 2, settled: false, ranked: true }] });
  const next = JSON.parse(M.markStoredFinished(raw, 2, "settled")!);
  assert.equal(next.backlog[0].settled, true);
  assert.equal(next.finished.settled, false);
  assert.deepEqual(next.game, { score: 1 });
  assert.equal(M.markStoredFinished(raw, 9, "settled"), null, "없는 판이면 쓰지 않는다");
  const mg = code("components/MergeGame.tsx");
  const done = mg.slice(mg.indexOf("const markDone = "), mg.indexOf("const pendingSettle"));
  assert.match(done, /localStorage\.setItem\(storeKey\(scope\), next\)[\s\S]*setSaved\(/, "표시를 화면 상태(effect)로만 남긴다");
  assert.match(mg, /settleGame\(row\.state, who, g\.score, g\.top, today, f\.id\)/, "섬 정산에 판 id 를 안 넘긴다");
  assert.match(mg, /if \(r\.dup\) return "ok";/);
});

test("★ 5. 못 보낸 초안 — 다시 열면 보낸다 · 들어갔으면 지운다 · 바뀌었으면 안내", () => {
  const s = I.createIsland("p", null, Date.parse("2026-11-11T03:00:00Z"));
  const m = Y.newSaveMark();
  const p: PendingDraft<I.IslandState> = { v: 7, state: s, attempts: [{ mark: m, n: 2 }], ops: 2, at: 0 };
  assert.equal(Y.pendingDecision(p, { version: 7, state: s }), "send");
  assert.equal(Y.pendingDecision(p, { version: 8, state: Y.withSaveMark(s, m) }), "committed");
  assert.equal(Y.pendingDecision({ ...p, ops: 3 }, { version: 8, state: Y.withSaveMark(s, m) }), "conflict", "보낸 뒤에 더 한 일은 올리지 못했다");
  assert.equal(Y.pendingDecision(p, { version: 8, state: s }), "conflict");
  const g = code("components/IslandGame.tsx");
  assert.match(g, /writePending\(pendingKey, d && cur \? \{ v: cur\.version, state: d/, "초안을 기기에 남기지 않는다");
  assert.match(g, /opsRef\.current = \[\(st\) => \(st === base \? p\.state : st\)\]/, "되살린 초안이 충돌 뒤 상대 변경을 덮을 수 있다");
  // 닫힌 화면이 아직 같은 초안을 보내는 중이면 물러나게 하고, 그 시도의 표식을 넘겨받는다(둘이 들고 있으면 두 번 들어간다)
  assert.match(g, /draftOwners\.get\(pendingKey\)\?\.\(\);/);
  // 2026-11-11 2차: 초안 전부를 보낸 시도만 n: 1 로, 일부만 보낸 시도는 따로(restoredAttempts) — reviewfix1111.test
  assert.match(g, /const \{ full, partial \} = restoredAttempts\(p\);\s+attemptsRef\.current = full;/);
  assert.match(g, /if \(pendingKey\) draftOwners\.set\(pendingKey, standDown\)/, "닫힌 화면이 주인으로 남지 않는다");
});

test("★ 6. 시계가 이틀 빠른 폰 — 상대 돌봄이 47시간 잠기지 않는다(bench e)", () => {
  const now = Date.parse("2026-11-11T03:00:00Z");
  const s = { ...I.createIsland("p", null, now - 10 * H), coins: 1e5 };
  const a = I.feedPet(s, now + 2 * I.DAY_MS); // A 기기
  assert.ok(I.careStatus(a, "feed", now + 5 * H).cdLeftMs > 40 * H, "(정리 전) 가짜 시각이 47시간을 잠근다");
  const fixed = I.rebaseFuture(a, now + 5 * H); // B(서버 시각과 견준 화면)가 얹는 정리
  assert.ok(I.careStatus(fixed, "feed", now + 5 * H).cdLeftMs <= 4 * H, "쿨다운이 지금부터 한 번만");
  assert.notEqual(I.feedPet(fixed, now + 9 * H + 1), fixed, "4시간 뒤 밥을 줄 수 있다");
  assert.equal(I.rebaseFuture(fixed, now + 5 * H), fixed, "고칠 게 없으면 같은 참조(no-op)");
  assert.equal(fixed.lastTick, a.lastTick, "lastTick 은 깎지 않는다(감쇠를 두 번 먹이지 않게)");
  // 앞선 폰이 심은 작물 — 정리하면 지금부터 자란다
  const planted = I.plant(a, 0, pumpkin.key, now + 2 * I.DAY_MS);
  assert.equal(I.cropStage(planted, planted.farm.plots[0], now + 30 * H).progress, 0, "(정리 전) 이틀 동안 안 자란다");
  const re = I.rebaseFuture(planted, now + 5 * H);
  assert.ok(I.cropStage(re, re.farm.plots[0], now + 30 * H).progress > 0.3);
  // 조금 어긋난 시계(10분 안쪽)는 건드리지 않는다
  const near = I.feedPet(s, now + 5 * 60_000);
  assert.equal(I.rebaseFuture(near, now), near);
});

test("★ 6. 서버 시각 — 저장 응답의 updated_at 으로 기기 시계 어긋남을 잰다", () => {
  const real = Date.parse("2026-11-11T03:00:00.000Z");
  const skew = 2 * I.DAY_MS;
  // 이틀 빠른 기기: 보낸 시각 · 받은 시각이 서버보다 이틀 뒤
  const off = Y.clockSample("2026-11-11 03:00:00.123456+00", real + skew - 100, real + skew + 100);
  assert.ok(off !== null && Math.abs(off + skew - 123) < 5, `어긋남 ${off}`);
  assert.equal(Y.clockSample("2026-11-11T03:00:01Z", real, real + 400), 0, "몇 초 안쪽은 0(흔들리지 않게)");
  assert.equal(Y.clockSample("2026-11-11T03:00:01Z", real, real + 60_000), null, "왕복이 너무 길면 버린다");
  assert.equal(Y.clockSample(undefined, real, real), null);
  // 남의 시각을 깎는 일은 **이번 실행에서 잰 뒤**에만 — 기기에 남은 값은 그 뒤 시계를 고쳤으면 틀린다
  Y.resetServerClock();
  assert.equal(Y.clockKnown(), false);
  Y.noteServerClock("2026-11-11T03:00:00.000Z", real - 100, real + 100);
  assert.equal(Y.clockKnown(), true);
  Y.resetServerClock();
  const couple = code("lib/couple.ts");
  assert.match(couple, /noteServerClock\(\(data as \{ updated_at\?: unknown \} \| null\)\?\.updated_at, sentAt, Date\.now\(\)\)/);
  const g = code("components/IslandGame.tsx");
  assert.doesNotMatch(g, /Date\.now\(\)/, "섬 화면이 기기 시계를 그대로 쓴다");
  assert.match(g, /if \(!row \|\| !clockKnown\(\)\) return;[\s\S]{0,200}rebaseFuture\(x, t\)/, "미래 시각 정리가 서버 시각을 잰 뒤에만 돌지 않는다");
});

test("★ 7. 저장 중에 숨으면 — 끝나는 즉시 다음 저장(타이머 없이) · pagehide 에도 [소스 스캔]", () => {
  const g = code("components/IslandGame.tsx");
  const flush = g.slice(g.indexOf("const flush = useCallback("), g.indexOf("flushRef.current = flush"));
  assert.match(flush, /finally \{[\s\S]*document\.visibilityState === "hidden"[\s\S]*Promise\.resolve\(\)\.then\(\(\) => flushRef\.current\?\.\(\)\)/, "숨은 채 끝난 저장 뒤 450ms 타이머에 맡긴다(iOS 가 멈춘다)");
  assert.match(g, /window\.addEventListener\("pagehide", leave\)/);
  // 바로 다시 보내기는 저장이 끝나고 보낼 게 남았을 때만 — 실패 · 포기 뒤엔 쉬지 않고 돌았다
  assert.match(flush, /else if \(again && !abandonedRef\.current/);
  assert.match(flush, /if \(attemptsRef\.current\.length\) retryLater\(\);/, "같은 버전의 충돌을 쉬지 않고 다시 보낸다");
  const leave = g.slice(g.indexOf("const leave = () => {"), g.indexOf("const onHide = () => {"));
  assert.ok(leave.indexOf("persistPending()") >= 0 && leave.indexOf("persistPending()") < leave.indexOf("void flush()"), "내보내기 전에 기기에 먼저 남긴다");
});

test("★ 8. 오류 가르기 — 502 · 503 · HTML · 코드 없음은 다시 보낸다(bench f: 전부 '그 밖'으로 초안을 버렸다)", () => {
  assert.equal(Y.saveErrorKind({ message: "<html><body>502 Bad Gateway</body></html>", code: "" }), "network");
  assert.equal(Y.saveErrorKind({ message: "Service Unavailable", code: "PGRST002" }), "network");
  assert.equal(Y.saveErrorKind({ message: "oops", code: "", status: 503 }), "network");
  assert.equal(Y.saveErrorKind({ message: "something odd" }), "network", "코드 없는 오류");
  assert.equal(Y.saveErrorKind({ message: "JWT expired", code: "PGRST301" }), "network", "토큰은 클라이언트가 새로 받는다");
  assert.equal(Y.saveErrorKind({ message: "bad state", code: "PT422" }), "other");
  assert.equal(Y.saveErrorKind(new Error("연동이 설정되지 않았어요.")), "other", "앱 설정 문제는 다시 보내도 같다");
  assert.equal(Y.saveErrorKind({ message: "stale", code: "PT409", status: 409 }), "conflict");
  assert.match(code("lib/couple.ts"), /throw Object\.assign\(error, \{ status \}\)/, "HTTP 상태를 오류에 안 붙인다");
});

test("PetPixel — 모습을 한 번만 굽고, 바뀔 때만 그리고, 화면 밖 · 숨은 탭에선 멈춘다 [소스 스캔]", () => {
  const p = code("components/island/PetPixel.tsx");
  assert.match(p, /if \(key === lastKey\) return;/, "모습이 같아도 매 프레임 다시 찍는다");
  assert.match(p, /ctx\.drawImage\(img, 0, 0, c\.width, c\.height\)/, "구운 모습을 쓰지 않는다");
  assert.match(p, /paint\(g, walk, lift, 1\)/, "기기 해상도로 굽는다(메모리 px² 배)");
  assert.match(p, /if \(!animated\) return null;/, "움직이지 않는 펫도 굽는다");
  assert.match(p, /new IntersectionObserver\(/, "화면 밖에서도 돈다");
  assert.match(p, /addEventListener\("visibilitychange", sync\)/, "숨은 탭에서도 돈다");
  assert.match(p, /\}, \[form, size, asleep, active, shadow, bob, face, tintLight, tintT, tintMul\]\);/, "tint 객체가 바뀔 때마다 다시 굽는다");
  assert.match(p, /draw\(performance\.now\(\)\);\s*if \(reduced \|\| !active\) return;/, "첫 모습을 동기로 그리지 않는다");
});
