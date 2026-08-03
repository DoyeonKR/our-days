// 홈 월드 상태 배지 회귀 lock — '할 일 배지'·'안 본 것 기준선'·'달 위상 작도'.
//
// 이 셋은 전부 홈 히어로에서만 보이는데, 화면 검증이 어려운 자리라 순수 로직으로 못박아 둔다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIsland, islandTodos, kstDate, type IslandState } from "./island.ts";
import { countSince } from "./seen.ts";
import { moonLitPath } from "./scenetime.ts";

const T0 = Date.UTC(2026, 7, 4, 3, 0, 0); // 2026-08-04 12:00 KST

function fresh(): IslandState {
  const s = createIsland("콩", null, T0);
  s.coins = 9999;
  return s;
}

/* ── 할 일 배지 ─────────────────────────────────────────────── */

test("갓 만든 섬은 할 일이 없다 — 배지가 상시 켜져 있으면 아무 의미가 없다", () => {
  assert.deepEqual(islandTodos(fresh(), T0), []);
});

test("아픔·진화는 급한 일로 잡힌다", () => {
  const sick = { ...fresh(), pet: { ...fresh().pet, sick: true } };
  const t = islandTodos(sick, T0);
  assert.equal(t.length, 1);
  assert.equal(t[0].key, "sick");
  assert.equal(t[0].urgent, true);

  const evo = { ...fresh(), pet: { ...fresh().pet, pendingEvolve: true } };
  assert.ok(islandTodos(evo, T0).some((x) => x.key === "evolve" && x.urgent));
});

test("배고픔은 급한 일, 심심함·청결은 급하지 않다 — 등급이 다 같으면 우선순위가 죽는다", () => {
  const s = fresh();
  s.pet.stats.hunger = 10;
  s.pet.stats.happy = 10;
  s.pet.stats.clean = 10;
  const t = islandTodos(s, T0);
  const by = Object.fromEntries(t.map((x) => [x.key, x]));
  assert.equal(by.hunger?.urgent, true);
  assert.equal(by.happy?.urgent, false);
  assert.equal(by.clean?.urgent, false);
  // 급한 것이 먼저 온다(첫 항목이 라벨로 노출되므로 순서가 곧 UI다)
  assert.equal(t[0].key, "hunger");
});

test("기력 낮음은 할 일이 아니다 — 자면 회복되는 자연 상태라 넣으면 배지가 상시 켜진다", () => {
  const s = fresh();
  s.pet.stats.energy = 5;
  assert.deepEqual(islandTodos(s, T0), []);
});

test("상대가 건 함께놀기만 잡힌다 — 내가 건 건 내가 기다릴 일이 아니다", () => {
  const s = fresh();
  s.pending = [{ type: "coop", by: "partner", at: T0 }];
  assert.ok(islandTodos(s, T0, "me").some((x) => x.key === "coop"));
  assert.equal(islandTodos(s, T0, "partner").some((x) => x.key === "coop"), false);
  // myUserId 를 모르면 판정하지 않는다(내 것을 상대 것으로 오인하면 배지가 영영 안 꺼진다)
  assert.equal(islandTodos(s, T0).some((x) => x.key === "coop"), false);
});

test("퀘스트 상자는 '오늘 것이 전부 채워졌고 아직 안 열었을 때'만", () => {
  const s = fresh();
  const q = (prog: number, goal: number) => ({ id: "q", label: "l", goal, prog, reward: 1, xp: 1, claimed: false });
  s.quest = { date: kstDate(T0), list: [q(2, 2), q(1, 1)], chest: false };
  assert.ok(islandTodos(s, T0).some((x) => x.key === "chest"));
  // 하나라도 덜 찼으면 아님
  s.quest = { date: kstDate(T0), list: [q(2, 2), q(0, 1)], chest: false };
  assert.equal(islandTodos(s, T0).some((x) => x.key === "chest"), false);
  // 이미 열었으면 아님
  s.quest = { date: kstDate(T0), list: [q(2, 2)], chest: true };
  assert.equal(islandTodos(s, T0).some((x) => x.key === "chest"), false);
  // 어제 퀘스트면 아님(날짜 가드)
  s.quest = { date: "2026-08-03", list: [q(2, 2)], chest: false };
  assert.equal(islandTodos(s, T0).some((x) => x.key === "chest"), false);
});

test("모든 할 일에 라벨·이모지가 있다 — 배지 옆 한 줄로 그대로 나간다", () => {
  const s = fresh();
  s.pet.sick = true;
  s.pet.pendingEvolve = true;
  s.pet.stats.hunger = 1;
  s.pet.stats.happy = 1;
  s.pet.stats.clean = 1;
  const t = islandTodos(s, T0, "me");
  assert.ok(t.length >= 5);
  const keys = new Set<string>();
  for (const x of t) {
    assert.ok(x.label.length > 0, `${x.key} 라벨 없음`);
    assert.ok(x.emoji.length > 0, `${x.key} 이모지 없음`);
    assert.ok(!keys.has(x.key), `중복 key ${x.key}`);
    keys.add(x.key);
  }
});

/* ── 안 본 것 기준선 ─────────────────────────────────────────── */

test("기준선이 없으면 0 — 새 기기 첫 실행에 과거 쿡이 통째로 '새 것'이 되면 안 된다", () => {
  assert.equal(countSince(["2026-08-04T00:00:00Z", "2026-08-03T00:00:00Z"], 0), 0);
});

test("기준선 이후만 센다", () => {
  const base = Date.UTC(2026, 7, 3, 12, 0, 0);
  const list = [
    "2026-08-04T05:00:00Z", // 이후
    "2026-08-03T18:00:00Z", // 이후
    "2026-08-03T06:00:00Z", // 이전
    "not-a-date", // 무시
  ];
  assert.equal(countSince(list, base), 2);
});

/* ── 달 위상 작도 ───────────────────────────────────────────── */

/** 경로에서 종결선 호의 rx 와 sweep 을 뽑는다(두 번째 A 명령). */
function terminator(d: string): { rx: number; sweep: number } {
  const arcs = [...d.matchAll(/A ([\d.]+) ([\d.]+) 0 0 (\d) /g)];
  assert.equal(arcs.length, 2, "호가 두 개여야 한다");
  return { rx: Number(arcs[1][1]), sweep: Number(arcs[1][3]) };
}

test("삭(phase 0) — 종결선이 오른쪽 반원과 겹쳐 밝은 면적 0", () => {
  const t = terminator(moonLitPath(23, 23, 22, 0));
  assert.equal(t.rx, 22); // = r
  assert.equal(t.sweep, 0); // 오른쪽으로 볼록 → 반원과 정확히 겹침
});

test("보름(phase .5) — 종결선이 왼쪽 반원이 되어 원 전체가 밝다", () => {
  const t = terminator(moonLitPath(23, 23, 22, 0.5));
  assert.equal(t.rx, 22);
  assert.equal(t.sweep, 1);
});

test("★ 상현·하현(phase .25/.75)에 달이 사라지지 않는다 [2026-08-04 버그 fix]", () => {
  // 예전 구현은 '같은 반지름 그림자 원을 cos·30 만큼 밀기'라 여기서 오프셋이 0 이 되어
  // 그림자가 달을 통째로 덮었다 — 한 달의 절반은 밤하늘에 달이 없었다.
  for (const p of [0.25, 0.75]) {
    const t = terminator(moonLitPath(23, 23, 22, p));
    assert.ok(Math.abs(t.rx) < 1e-9, `phase ${p}: 종결선이 직선이어야 반달이 된다`);
  }
});

test("위상이 커질수록 밝은 폭이 단조롭게 변한다 — 중간 위상이 튀지 않는다", () => {
  // 초승(0→.25)에서 rx 는 r→0 으로 줄고, 망(.25→.5)에서 0→r 로 늘어난다.
  const rxAt = (p: number) => terminator(moonLitPath(23, 23, 22, p)).rx;
  const wax = [0, 0.1, 0.2, 0.25].map(rxAt);
  for (let i = 1; i < wax.length; i++) assert.ok(wax[i] <= wax[i - 1], "초승 구간 단조 감소");
  const gib = [0.25, 0.35, 0.45, 0.5].map(rxAt);
  for (let i = 1; i < gib.length; i++) assert.ok(gib[i] >= gib[i - 1], "망 구간 단조 증가");
});

test("경로가 항상 닫힌 유효 문자열이다(모든 위상)", () => {
  for (let i = 0; i <= 20; i++) {
    const d = moonLitPath(23, 23, 22, i / 20);
    assert.match(d, /^M [\d.-]+ [\d.-]+ A .+ Z$/, `phase ${i / 20}`);
    assert.ok(!d.includes("NaN"), `phase ${i / 20}: NaN`);
  }
});
