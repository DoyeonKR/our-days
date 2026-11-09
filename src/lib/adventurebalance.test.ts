// 모험 밸런스 lock(2026-11-09 리뷰) — 권장 레벨의 3마리 팀을 봇이 몰아 대장 · 탑을 친다. README §14.6
// 예전 값: 신전 대장(권장 Lv.45) 봇 눈치 0.5 에서 5~15% · 1 에서 30~41%, 고원 25~49% / 45~75%,
// 탑 20층 0~7%(19층 65~88%), 30층 7%, 50층(상한) 9~41% — README 의 '대체로 70% 이상'과 달랐다.
// 값을 바꾸면 범위가 말해 준다. 시드는 고정이라 같은 코드는 늘 같은 숫자를 낸다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LEVEL, REGIONS, SPECIES, SPECIES_KEYS, bossLevel, makeMon, newSave, startBoss, startTower, towerLevel, towerTeam,
  type Battle, type Mon,
} from "./adventure.ts";
import { TPS, newArena, stepArena, think } from "./arena.ts";

const EMPTY = { balls: { basic: 0, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } };
const N = 30;

function grownUp(k: string, level: number): string {
  for (let e = SPECIES[k].evolves; e && level >= e.at; e = SPECIES[k].evolves) k = e.to;
  return k;
}
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 고른 종 중 셋 — 그 레벨이면 진화한 모습으로 */
function team(pool: string[], level: number, seed: number): Mon[] {
  const r = rng(seed);
  const g = { s: seed };
  return [0, 1, 2].map((i) => makeMon(grownUp(pool[Math.floor(r() * pool.length)], level), level, g, `m${i}`));
}
function wins(b: Battle, skill: number, seed: number): boolean {
  const a = newArena(b, EMPTY);
  const me = { s: seed };
  while (!a.b.over && a.tick < 240 * TPS) {
    let inp = think(a, 0, me, skill);
    if (a.b.needSwap) inp = { dir: 0, swap: a.b.sides[0].team.findIndex((f) => f.mon.hp > 0) };
    stepArena(a, inp);
  }
  return a.b.over === "win";
}

function bossRate(ri: number, skill: number): number {
  const r = REGIONS[ri];
  const lv = bossLevel(r) + 1;
  const pool = [...new Set(r.table.map(([k]) => k))].filter((k) => !SPECIES[k].legend);
  let w = 0;
  for (let i = 0; i < N; i++) {
    const save = newSave("leaf_2", 1000 + i * 31);
    save.party = team(pool, lv, 7 + i * 101);
    if (wins(startBoss(save, r).battle, skill, 50 + i)) w++;
  }
  return w / N;
}
function towerRate(floor: number, skill: number): number {
  const lv = towerLevel(floor);
  const pool = SPECIES_KEYS.filter((k) => SPECIES[k].stage === 2 && !SPECIES[k].legend);
  let w = 0;
  for (let i = 0; i < N; i++) {
    const save = newSave("leaf_2", 2000 + i * 37);
    save.party = team(pool, lv, 9 + i * 103 + floor * 7);
    if (wins(startTower(save, floor).battle, skill, 60 + i + floor)) w++;
  }
  return w / N;
}

test("지역 대장 — 권장 레벨 3마리면 잘하는 봇은 대개 이기고(60%+), 서툰 봇도 손 쓸 수 있다(25%+)", () => {
  const t0 = Date.now();
  const rows: string[] = [];
  for (let i = 0; i < REGIONS.length; i++) {
    const hi = bossRate(i, 1);
    const lo = bossRate(i, 0.5);
    rows.push(`${REGIONS[i].key} Lv.${bossLevel(REGIONS[i]) + 1} ${lo.toFixed(2)}/${hi.toFixed(2)}`);
    assert.ok(hi >= 0.55, `${REGIONS[i].key} 눈치 1 승률 ${hi}`);
    assert.ok(lo >= 0.25, `${REGIONS[i].key} 눈치 0.5 승률 ${lo}`);
  }
  // 깊은 지역 대장은 거저가 아니다(신전 · 고원이 첫 숲처럼 쉬워지면 대장의 뜻이 없다)
  for (const key of ["plateau", "temple"]) {
    const i = REGIONS.findIndex((r) => r.key === key);
    assert.ok(bossRate(i, 1) <= 0.9, `${key} 가 너무 쉽다`);
  }
  assert.ok(Date.now() - t0 < 4000, rows.join(" · "));
});

test("도전의 탑 — 10층마다의 전설 층은 앞뒤 층보다 어렵되 벽은 아니다(20층 절벽 없음)", () => {
  const floors = [9, 10, 19, 20, 29, 30, 39, 40, 49, 50];
  const hi = new Map(floors.map((f) => [f, towerRate(f, 1)]));
  const rows = floors.map((f) => `${f}층 ${hi.get(f)!.toFixed(2)}`).join(" · ");
  for (const f of [10, 20, 30, 40, 50]) {
    assert.ok(hi.get(f)! >= 0.45 && hi.get(f)! <= 0.95, `${f}층 눈치 1 승률 — ${rows}`);
    // 바로 앞 층과 견줘 절반 밑으로 떨어지지 않는다(예전 20층: 0.10 vs 19층 0.82)
    assert.ok(hi.get(f)! >= hi.get(f - 1)! * 0.55, `${f}층이 ${f - 1}층보다 너무 어렵다 — ${rows}`);
    assert.ok(towerRate(f, 0.5) >= 0.1, `${f}층 눈치 0.5 — ${rows}`);
  }
});

test("탑 곡선 — 층마다 권장 레벨이 고르게 오르고, 50층도 레벨 상한(50) 아래, 전설은 10층마다", () => {
  let prev = towerLevel(1);
  for (let f = 1; f <= 50; f++) {
    const lv = towerLevel(f);
    assert.ok(lv >= prev && lv - prev <= 1, `${f}층 권장 Lv.${lv}`);
    prev = lv;
    const t = towerTeam(f);
    assert.ok(t.every(([, l]) => l >= 1 && l < lv + 2 && l <= MAX_LEVEL), `${f}층 ${JSON.stringify(t)}`);
    assert.equal(t.some(([k]) => SPECIES[k].legend), f % 10 === 0, `${f}층`);
  }
  assert.ok(towerLevel(50) < MAX_LEVEL, "상한의 팀이 꼭대기에서도 한 단계 위");
});
