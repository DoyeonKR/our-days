// 섬 지연 정산 '쪼개서 = 한 번에' lock (2026-11-06 게임 리뷰). 수조 tickAqua 와 같은 약속.
// 예전엔 펫 상태가 누가 얼마나 자주 눌렀는지에 따라 달랐다 — 구간 끝에서 배고픔이 0 이면 구간 전체에 행복 −20/일,
// 질병 굴림은 부를 때마다 한 번, 건강은 구간 끝 상태로만 판정했다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DAY_MS, createIsland, settleIsland, type IslandState } from "./island.ts";

const H = 3_600_000;
// 정시가 아닌 시작(10:17) — 옛 저장분의 lastTick 은 아무 시각이다
const T0 = Date.UTC(2026, 3, 15, 1, 17, 23);
const base = (stats: Partial<IslandState["pet"]["stats"]>): IslandState => {
  const s = createIsland("나비", "2025-01-01", T0);
  return { ...s, pet: { ...s.pet, stats: { ...s.pet.stats, ...stats } } };
};
const close = (a: IslandState, b: IslandState, what: string) => {
  for (const k of ["hunger", "happy", "energy", "clean", "health"] as const)
    assert.ok(Math.abs(a.pet.stats[k] - b.pet.stats[k]) < 1e-6, `${what}: ${k} ${a.pet.stats[k]} ≠ ${b.pet.stats[k]}`);
  assert.equal(a.pet.sick, b.pet.sick, `${what}: 아픔`);
  assert.equal(a.pet.neglect, b.pet.neglect, `${what}: 방치 수`);
  assert.equal(a.pet.cq, b.pet.cq, `${what}: 정성`);
  assert.equal(a.rng, b.rng, `${what}: 난수 순서(두 기기가 같은 결과)`);
  assert.equal(a.lastTick, b.lastTick, `${what}: 정산 시각`);
};
const stepwise = (s: IslandState, from: number, to: number, step: number) => {
  let x = s;
  for (let t = from + step; t < to; t += step) x = settleIsland(x, t);
  return settleIsland(x, to);
};

for (const [name, stats] of [
  ["잘 돌본 펫", { hunger: 90, happy: 90, energy: 90, clean: 90, health: 80 }],
  ["배고픔이 도중에 바닥", { hunger: 30, happy: 70, energy: 50, clean: 40, health: 60 }],
  ["거의 방치", { hunger: 5, happy: 10, energy: 8, clean: 15, health: 25 }],
] as const) {
  test(`★ ${name} — 2일을 한 번에 = 1시간마다 = 17분마다 = 하루씩`, () => {
    const s = base(stats);
    const end = T0 + 2 * DAY_MS;
    const once = settleIsland(s, end);
    close(once, stepwise(s, T0, end, H), "1시간마다");
    close(once, stepwise(s, T0, end, 17 * 60_000), "17분마다(정시와 어긋남)");
    close(once, stepwise(s, T0, end, DAY_MS), "하루씩");
  });
}

test("배고픔이 바닥에 닿은 시각부터만 행복이 더 준다(끝 상태로 구간 전체를 벌주지 않는다)", () => {
  // 배고픔 35 → 하루면 정확히 0. 이틀 뒤의 추가 감소는 둘째 날 몫(20)만 — 옛 식은 이틀 전부(40)였다
  const s = base({ hunger: 35, happy: 100, energy: 100, clean: 100, health: 100 });
  const after = settleIsland(s, T0 + 2 * DAY_MS);
  const normal = 100 - 20 * 2; // 행복 기본 감쇠 20/일(퍽 없음)
  assert.ok(Math.abs(after.pet.stats.happy - (normal - 20)) < 1e-6, `행복 ${after.pet.stats.happy}`);
});

test("아주 오래 비워도 정산은 끝난다 — 앞부분은 한 번에, 마지막 14일만 정시마다", () => {
  const s = base({ hunger: 80, happy: 80, energy: 80, clean: 80, health: 80 });
  const t = performance.now();
  const after = settleIsland(s, T0 + 400 * DAY_MS);
  assert.ok(performance.now() - t < 200, "400일 정산이 오래 걸린다");
  assert.equal(after.pet.stats.hunger, 0);
  assert.equal(after.lastTick, T0 + 400 * DAY_MS);
});

test("옛 저장분 — 새 칸 없이도 정산된다 · 시계가 뒤로 가도 되돌리지 않는다", () => {
  const s = base({ hunger: 50 }) as IslandState & { feed?: unknown };
  delete s.feed;
  const old = JSON.parse(JSON.stringify(s)) as IslandState;
  const a = settleIsland(old, T0 + 5 * H);
  assert.ok(a.pet.stats.hunger < 50);
  const back = settleIsland(a, T0 + 2 * H);
  assert.equal(back.lastTick, a.lastTick, "lastTick 단조");
  assert.equal(back.pet.stats.hunger, a.pet.stats.hunger);
});

test("엔진 구조 — 정시 경계 · 정확한 바닥 시각 · 오래 비운 상한이 코드에 있다 [소스 스캔]", () => {
  const src = readFileSync(join(import.meta.dirname, "island.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const body = src.slice(src.indexOf("function tick("), src.indexOf("export function settleIsland"));
  assert.match(body, /Math\.floor\(t \/ HOUR\) \+ 1\) \* HOUR/, "정시 경계(절대 시각)로 쪼개지 않는다");
  assert.match(src, /const TICK_FINE_MS = 14 \* DAY_MS/, "오래 비운 정산 상한");
  assert.match(src, /const starve = /, "배고픔 바닥 시각 계산");
  assert.doesNotMatch(body, /if \(st\.hunger <= 0\) st\.happy = clamp\(st\.happy - 20 \* days/, "옛 '끝 상태로 구간 전체' 식이 돌아왔다");
});
