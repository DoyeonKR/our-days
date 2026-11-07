// 모험 엔진 lock — 생물 표 · 상성 · 전투 한 판 · 잡기 · 성장 · 저장 다듬기. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BALLS, MOVES, REGIONS, SPECIES, SPECIES_KEYS, STARTERS, TYPES, aiPick, catchChance, effectiveness, finishBattle,
  grantXp, makeMon, movesAt, newSave, normalizeSave, playTurn, startWild, statsOf, xpFor, type Battle,
} from "./adventure.ts";

test("생물은 계보 10개 × 3단계 = 30종이고, 지역 표 · 시작 생물이 전부 표 안에 있다", () => {
  assert.equal(SPECIES_KEYS.length, 30);
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

test("같은 입력이면 같은 판이 나온다(나중에 서버가 같은 엔진으로 판정한다)", () => {
  const run = () => {
    let s = newSave("ember_2", 42);
    const st = startWild(s, REGIONS[0]);
    s = st.save;
    let b: Battle = st.battle;
    const log: string[] = [];
    for (let i = 0; i < 40 && !b.over; i++) {
      const r = b.needSwap ? playTurn(b, { kind: "swap", to: b.sides[0].team.findIndex((f) => f.mon.hp > 0) }) : playTurn(b, { kind: "move", i: 0 });
      b = r.battle;
      log.push(...r.events.map((e) => JSON.stringify(e)));
    }
    return log.join("|");
  };
  assert.equal(run(), run());
});

test("수백 판을 돌려도 판이 끝나고 체력이 범위를 안 벗어난다 · 시작 생물이 첫 숲에서 대개 이긴다", () => {
  let wins = 0;
  for (let seed = 1; seed <= 300; seed++) {
    let save = newSave(STARTERS[seed % 3], seed * 977);
    const st = startWild(save, REGIONS[0]);
    save = st.save;
    let b = st.battle;
    let turns = 0;
    while (!b.over && turns < 80) {
      turns++;
      const r = b.needSwap ? playTurn(b, { kind: "swap", to: b.sides[0].team.findIndex((f) => f.mon.hp > 0) }) : playTurn(b, aiPick(b, 0, { s: seed + turns }));
      b = r.battle;
      for (const side of b.sides) for (const f of side.team) assert.ok(f.mon.hp >= 0 && f.mon.hp <= f.stats.hp);
    }
    assert.ok(b.over, `seed ${seed}: 80턴에도 안 끝났다`);
    if (b.over === "win") wins++;
    const out = finishBattle(save, b, { balls: save.balls, items: save.items });
    assert.ok(out.save.party.length >= 1);
  }
  assert.ok(wins / 300 > 0.6, `첫 숲 승률 ${wins / 300}`);
});

test("공으로 잡으면 팀(가득 차면 보관함)과 도감에 들어간다", () => {
  let caught = 0;
  for (let seed = 1; seed <= 80 && !caught; seed++) {
    let save = newSave("leaf_2", seed);
    const st = startWild(save, REGIONS[0]);
    save = st.save;
    let b = st.battle;
    for (let i = 0; i < 8 && !b.over; i++) b = playTurn(b, { kind: "ball", ball: "star", aim: 1 }, { balls: { basic: 9, great: 9, star: 9 }, items: save.items }).battle;
    if (b.over === "caught") {
      caught++;
      const out = finishBattle(save, b, { balls: save.balls, items: save.items });
      assert.equal(out.save.party.length, 2);
      assert.ok(out.save.caught.includes(b.caught!.species));
      assert.equal(out.save.catches, 1);
      assert.notEqual(out.save.party[1].id, "wild");
    }
  }
  assert.ok(caught > 0);
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
function duel(myMove: string, seed: number, foeSpecies = "burr_2", level = 20) {
  const save = newSave("ember_2", seed);
  const st = startWild(save, REGIONS[0]);
  const b = st.battle;
  const rng = { s: seed };
  b.sides[0].team[0].mon = { ...makeMon("ember_3", level, rng, "me"), moves: [{ id: myMove, pp: 30 }] };
  b.sides[0].team[0].stats = statsOf(b.sides[0].team[0].mon);
  b.sides[0].team[0].mon.hp = Math.ceil(b.sides[0].team[0].stats.hp / 2); // 흡수로 되찾을 자리
  b.sides[1].team[0].mon = { ...makeMon(foeSpecies, level + 8, rng, "wild"), moves: [{ id: "bump", pp: 30 }] };
  b.sides[1].team[0].stats = statsOf(b.sides[1].team[0].mon);
  return playTurn(b, { kind: "move", i: 0 });
}

test("연타 기술은 한 턴에 여러 번 맞고, 횟수가 표 범위 안이다", () => {
  let multi = 0;
  for (let s = 1; s <= 60; s++) {
    const hits = duel("emberrain", s).events.filter((e) => e.t === "hit" && e.move === "emberrain");
    if (!hits.length) continue;
    assert.ok(hits.length >= 1 && hits.length <= 4);
    if (hits.length >= 2) multi++;
  }
  assert.ok(multi > 20, `연타가 거의 안 나왔다(${multi})`);
});

test("흡수는 준 피해만큼 되찾고, 반동은 되받는다", () => {
  let drained = 0;
  let recoiled = 0;
  for (let s = 1; s <= 40; s++) {
    const a = duel("sap", s).events;
    if (a.some((e) => e.t === "heal" && e.drain && e.side === 0)) drained++;
    const r = duel("slam", s).events;
    if (r.some((e) => e.t === "hit" && e.recoil && e.side === 0)) recoiled++;
  }
  assert.ok(drained > 0, "흡수가 한 번도 안 됐다");
  assert.ok(recoiled > 0, "반동이 한 번도 안 됐다");
});

test("움찔은 먼저 맞은 쪽만 — 맞은 상대가 그 턴에 못 움직이는 판이 있다", () => {
  let flinched = 0;
  for (let s = 1; s <= 120; s++) {
    const ev = duel("spook", s, "burr_2", 20).events;
    if (ev.some((e) => e.t === "text" && e.s.includes("움찔"))) flinched++;
  }
  assert.ok(flinched > 5, `움찔이 ${flinched}번뿐`);
});

test("모든 기술에 연출 방식이 있고, 기술 넷이 늘 공격을 하나 이상 품는다", () => {
  for (const m of Object.values(MOVES)) assert.ok(m.fx, m.id);
  for (const k of SPECIES_KEYS) for (let lv = 1; lv <= 50; lv += 7) {
    const mv = movesAt(k, lv);
    assert.ok(mv.filter((id) => MOVES[id].power === 0).length <= 1, `${k} Lv${lv}: 변화 기술이 둘 이상`);
  }
});
