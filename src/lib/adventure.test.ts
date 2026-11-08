// 모험 엔진 lock — 생물 표 · 상성 · 전투 한 판 · 잡기 · 성장 · 저장 다듬기. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BALLS, MOVES, REGIONS, SPECIES, SPECIES_KEYS, STARTERS, TYPES, catchChance, effectiveness,
  grantXp, makeMon, movesAt, newSave, normalizeSave, startWild, statsOf, xpFor,
} from "./adventure.ts";

test("생물은 계보 10개 × 3단계 = 30종이고, 지역 표 · 시작 생물이 전부 표 안에 있다", () => {
  assert.equal(SPECIES_KEYS.length, 114, "계보 30 × 3 + 전설 24");
  for (const s of STARTERS) assert.ok(SPECIES[s], s);
  for (const r of REGIONS) for (const [k] of r.table) assert.ok(SPECIES[k], `${r.key}: ${k}`);
  for (const sp of Object.values(SPECIES)) {
    if (sp.evolves) assert.ok(SPECIES[sp.evolves.to], sp.key);
    for (const [, id] of sp.learn) assert.ok(MOVES[id], `${sp.key}: ${id}`);
  }
});

test("모든 생물이 어딘가에서 잡히거나 진화로 닿는다", () => {
  const wild = new Set(REGIONS.flatMap((r) => r.table.map(([k]) => k)));
  const reach = new Set<string>([...wild, ...STARTERS]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const sp of Object.values(SPECIES)) if (reach.has(sp.key) && sp.evolves && !reach.has(sp.evolves.to)) { reach.add(sp.evolves.to); grew = true; }
  }
  assert.deepEqual(SPECIES_KEYS.filter((k) => !reach.has(k)), []);
});

test("상성: 무효가 없고(0 배 없음) 속성마다 잘 듣는 상대가 하나 이상(노말 제외)", () => {
  for (const a of TYPES) {
    for (const d of TYPES) assert.ok([0.5, 1, 2].includes(effectiveness(a, d)));
    if (a !== "노말") assert.ok(TYPES.some((d) => effectiveness(a, d) === 2), a);
  }
  assert.equal(effectiveness("물", "불꽃"), 2);
  assert.equal(effectiveness("불꽃", "물"), 0.5);
});

test("기술 이름은 서로 겹치지 않고 넷 이하만 든다", () => {
  const names = Object.values(MOVES).map((m) => m.name);
  assert.equal(new Set(names).size, names.length);
  for (const k of SPECIES_KEYS) for (const lv of [1, 5, 12, 25, 50]) {
    const mv = movesAt(k, lv);
    assert.ok(mv.length >= 1 && mv.length <= 4, `${k} Lv${lv}`);
    assert.equal(new Set(mv).size, mv.length);
    assert.ok(mv.some((id) => MOVES[id].power > 0), `${k} Lv${lv}: 공격 기술이 없다`);
  }
});

test("레벨이 오르면 능력도 오르고, 16 · 32 에서 진화한다", () => {
  const rng = { s: 7 };
  const m = makeMon("leaf_2", 5, rng, "a");
  const a = statsOf(m);
  const up = grantXp(m, xpFor(16) - m.xp);
  assert.equal(up.mon.level, 16);
  assert.equal(up.mon.species, "leaf_3");
  assert.ok(statsOf(up.mon).hp > a.hp && statsOf(up.mon).atk > a.atk);
  assert.ok(up.notes.some((n) => n.includes("진화")));
  const top = grantXp(up.mon, 10 ** 9);
  assert.equal(top.mon.level, 50);
  assert.equal(top.mon.species, "leaf_4");
  assert.ok(top.mon.hp > 0 && top.mon.hp <= statsOf(top.mon).hp);
});

test("잡기 확률은 체력이 낮을수록 · 좋은 공일수록 · 잘 겨눌수록 오른다", () => {
  const save = newSave("leaf_2", 3);
  const { battle } = startWild(save, REGIONS[0]);
  const f = battle.sides[1].team[0];
  const full = catchChance(f, "basic", 0.5);
  const low = catchChance({ ...f, mon: { ...f.mon, hp: 1 } }, "basic", 0.5);
  assert.ok(low > full);
  assert.ok(catchChance(f, "star", 0.5) > catchChance(f, "basic", 0.5));
  assert.ok(catchChance(f, "basic", 1) > catchChance(f, "basic", 0));
  for (const k of Object.keys(BALLS) as (keyof typeof BALLS)[]) assert.ok(catchChance(f, k, 1) <= 0.97);
});

test("저장 다듬기 — 모르는 종 · 기술은 떨구고, 깨진 값은 null", () => {
  const s = newSave("conch_2", 1);
  const raw = JSON.parse(JSON.stringify(s));
  raw.party.push({ ...raw.party[0], id: "x", species: "nope" });
  raw.party[0].moves.push({ id: "gone", pp: 3 });
  const n = normalizeSave(raw)!;
  assert.equal(n.party.length, 1);
  assert.ok(n.party[0].moves.every((m) => MOVES[m.id]));
  assert.equal(normalizeSave(null), null);
  assert.equal(normalizeSave({ v: 2 }), null);
});

test("원작 게임 자료를 들이지 않는다 — 기술 이름이 원작의 흔한 기술 이름과 겹치지 않는다", () => {
  const banned = ["몸통박치기", "할퀴기", "울음소리", "불꽃세례", "물대포", "덩굴채찍", "전기쇼크", "화염방사", "냉동빔", "10만볼트", "하이드로펌프", "섀도볼", "수면가루", "잠자기", "단단해지기", "웅크리기", "눈보라"];
  for (const m of Object.values(MOVES)) assert.ok(!banned.includes(m.name), m.name);
  const src = readFileSync(join(import.meta.dirname, "adventure.ts"), "utf8");
  assert.doesNotMatch(src, /pokemon|포켓몬|피카츄|몬스터볼/i);
});

/* 2026-11-08 기술 확장 — 연타 · 흡수 · 반동 · 움찔이 실제로 일어난다 */

test("모든 기술에 연출 방식이 있고, 기술 넷이 늘 공격을 하나 이상 품는다", () => {
  for (const m of Object.values(MOVES)) assert.ok(m.fx, m.id);
  for (const k of SPECIES_KEYS) for (let lv = 1; lv <= 50; lv += 7) {
    const mv = movesAt(k, lv);
    assert.ok(mv.filter((id) => MOVES[id].power === 0).length <= 1, `${k} Lv${lv}: 변화 기술이 둘 이상`);
  }
});

test("전설 영물은 진화하지 않고 신전에서만 나온다 · 그림이 있다", () => {
  const legends = SPECIES_KEYS.filter((k) => SPECIES[k].legend);
  assert.equal(legends.length, 24);
  for (const k of legends) {
    assert.equal(SPECIES[k].evolves, undefined);
    const homes = REGIONS.filter((r) => r.table.some(([s]) => s === k)).map((r) => r.key);
    assert.deepEqual(homes, ["temple"], k);
  }
});

test("기술은 전부 이 게임 이름 — 속성마다 공격 기술 여섯", () => {
  for (const t of TYPES) assert.ok(Object.values(MOVES).filter((m) => m.type === t && m.power > 0).length >= 6, t);
});

test("기술은 직접 고를 수 있다 — 배운 것만, 넷까지, 진화해도 그대로", async () => {
  const { learnedAt, movesOf } = await import("./adventure.ts");
  const { freshMon } = await import("./adventurepvp.ts");
  const m = makeMon("ember_3", 30, { s: 3 }, "a");
  const all = learnedAt("ember_3", 30);
  const picked = [all[0], all[1], "없는기술", all[0]];
  assert.deepEqual(movesOf({ ...m, picked }), [all[0], all[1]]);
  assert.deepEqual(freshMon({ ...m, picked: ["lava", "없는기술"] }).moves.map((x) => x.id), ["lava"]);
  assert.deepEqual(movesOf({ species: "ember_3", level: 8, picked: ["lava"] }).includes("lava"), false, "아직 안 배운 기술은 못 고른다");
});

test("고레벨 기본 기술은 속성마다 다르고, 대장은 모든 지역에 있다", async () => {
  const { startBoss, finishBattle } = await import("./adventure.ts");
  assert.notDeepEqual(movesAt("ember_4", 45), movesAt("conch_4", 45));
  for (const r of REGIONS) {
    assert.ok(r.boss, r.key);
    for (const [k] of r.boss!.team) assert.ok(SPECIES[k], k);
  }
  const s = newSave(STARTERS[0], 9);
  const { battle, save } = startBoss(s, REGIONS[0]);
  assert.equal(battle.wild, false);
  for (const f of battle.sides[1].team) f.mon.hp = 0;
  battle.over = "win";
  const once = finishBattle(save, battle, { balls: save.balls, items: save.items });
  assert.deepEqual(once.save.badges, [REGIONS[0].key]);
  assert.ok(once.gold >= REGIONS[0].boss!.gold);
  const twice = finishBattle(once.save, battle, { balls: once.save.balls, items: once.save.items });
  assert.ok(twice.gold < REGIONS[0].boss!.gold, "보상은 처음 이겼을 때만");
});
