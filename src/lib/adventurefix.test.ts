// 모험 엔진 다듬기 lock(2026-11-09) — 도감 114 · 기술 넷(2+1+1) · 야생 시간 · 상태이상 · 고른 기술 · 보관함 · 광선 · 늦게 닿는 기술 · 끈기 · 함께 쓰러짐. README §14.6 '엔진 다듬기'
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOX_MAX, MOVES, PARTY_MAX, REGIONS, SPECIES, SPECIES_KEYS, boxFull, compactSave, finishBattle, learnedAt, makeMon, movesAt, movesOf,
  newSave, normalizeSave, rollWild, startTrainer, startWild, statsOf, type Battle, type Mon,
} from "./adventure.ts";
import { TPS, WILD_FLEE_TICKS, WILD_TIRE_TICKS, newArena, stepArena, think, wildTired, type AEv, type Arena, type ArenaInput } from "./arena.ts";
import { startDuel } from "./adventurepvp.ts";

const EMPTY = { balls: { basic: 0, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } };
const idle: ArenaInput = { dir: 0 };

/** 기술을 정해 둔 생물 */
function mon(species: string, level: number, moves: string[], id: string, seed = 3): Mon {
  const m = makeMon(species, level, { s: seed }, id);
  return { ...m, moves: moves.map((x) => ({ id: x, pp: 30 })) };
}
/** 내 팀 · 상대 한 마리로 야생 판 — 서로 160 거리, 등장 연출 없이 */
function arena(mine: Mon[], foe: Mon, seed = 5): Arena {
  const s = newSave("leaf_2", seed);
  s.party = mine;
  const b = startWild(s, REGIONS[0], { species: foe.species, level: foe.level }).battle;
  b.sides[1].team[0].mon = foe;
  b.sides[1].team[0].stats = statsOf(foe);
  return place(newArena(b, EMPTY));
}
function place(a: Arena): Arena {
  a.units[0].enter = 0;
  a.units[1].enter = 0;
  a.units[0].x = a.units[0].px = 380;
  a.units[1].x = a.units[1].px = 380;
  a.units[0].y = a.units[0].py = 380;
  a.units[1].y = a.units[1].py = 220;
  return a;
}
function run(a: Arena, ticks: number, mine: (a: Arena) => ArenaInput = () => idle, foe: (a: Arena) => ArenaInput = () => idle): AEv[] {
  const all: AEv[] = [];
  for (let i = 0; i < ticks && !a.b.over; i++) {
    stepArena(a, mine(a), foe(a));
    all.push(...a.ev);
  }
  return all;
}

/* ① 도감 — 실제로 굴린다(adventure.test 의 도달 테스트와 짝) */

test("① 신전의 전설은 드물게 — 만남의 10% 이하(예전 23%) · 그래도 0 은 아니다", () => {
  const temple = REGIONS.find((r) => r.key === "temple")!;
  const rng = { s: 99 };
  let leg = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (SPECIES[rollWild(temple, rng).species].legend) leg++;
  assert.ok(leg / N <= 0.1 && leg / N >= 0.05, `전설 ${((leg / N) * 100).toFixed(1)}%`);
});

test("① 첫 모습만 있던 동굴 · 고원 생물도 앞 지역에서 첫 모습으로 나온다(같은 시드 = 같은 만남)", () => {
  const firsts = ["ember_2", "bat_2", "ghost_2", "moth_2", "peng_2", "rac_2", "mole_2", "unicorn_2", "boar_2", "peaco_2", "ele_2"];
  for (const k of firsts) {
    const homes = REGIONS.filter((r) => r.table.some(([s]) => s === k) && r.levels[0] < 16);
    assert.ok(homes.length, `${k}: 진화 레벨 아래에서 시작하는 지역에 없다`);
  }
  const a = { s: 7 };
  const b = { s: 7 };
  for (let i = 0; i < 50; i++) assert.deepEqual(rollWild(REGIONS[3], a), rollWild(REGIONS[3], b));
});

/* ② 기술 넷 = 자기 속성 둘(노말 셋) + 다른 공격 하나 + 변화 하나 · 야생 시간 */

test("② movesAt — 노말이 아니면 자기 속성 공격은 둘까지 · 다른 속성 공격이 늘 하나 · 노말은 셋 + 변화", () => {
  for (const k of SPECIES_KEYS) for (let lv = 1; lv <= 50; lv++) {
    const sp = SPECIES[k];
    const mv = movesAt(k, lv);
    const atk = mv.filter((id) => MOVES[id].power > 0);
    const own = atk.filter((id) => MOVES[id].type === sp.type);
    if (sp.type === "노말") {
      assert.ok(own.length <= 3, `${k} Lv${lv}`);
      continue;
    }
    const st = learnedAt(k, lv).some((id) => MOVES[id].power === 0) ? 1 : 0;
    // 변화 기술을 아직 못 배웠으면(박쥐 · 둔덕 등은 Lv.5 기술이 공격) 그 칸을 공격으로 채운다 — 그때만 셋까지
    assert.ok(own.length <= 3 - st, `${k} Lv${lv}: 자기 속성 ${own.length}`);
    assert.ok(atk.some((id) => MOVES[id].type !== sp.type), `${k} Lv${lv}: 같은 속성 상대에게 넣을 기술이 없다`);
    assert.equal(mv.filter((id) => MOVES[id].power === 0).length, st, `${k} Lv${lv}: 배운 변화 기술이 있으면 하나`);
  }
  // 순서: 자기 속성 → 다른 공격 → 변화
  assert.deepEqual(movesAt("conch_4", 45), ["whirl", "tide", "slam", "rest"]);
});

test("② 야생은 90초에 지치고(회복 절반) 150초에 달아난다 — 대장 · 대전엔 없다", () => {
  const a = arena([mon("conch_3", 20, ["drop"], "me")], mon("conch_3", 20, ["rest"], "wild"));
  const ev = run(a, WILD_FLEE_TICKS + 10);
  assert.equal(a.b.over, "run");
  assert.equal(a.b.fled, true);
  assert.ok(a.tick <= WILD_FLEE_TICKS + 1);
  assert.ok(ev.some((e) => e.t === "text" && e.s.includes("지쳐 간다")));
  const out = finishBattle(newSave("leaf_2", 1), a.b, EMPTY);
  assert.ok(out.notes.some((n) => n.includes("달아났다")));
  assert.equal(out.gold, 0);
  assert.equal(out.xp, 0);

  // 회복 절반 — 지친 뒤의 쉬어 가기(체력 50%)는 25% 만
  const heal = (at: number) => {
    const h = arena([mon("conch_3", 20, ["drop"], "me")], mon("conch_3", 20, ["rest"], "wild"));
    h.tick = at;
    const f = h.b.sides[1].team[0];
    f.mon.hp = 1;
    const got = run(h, 30, () => idle, () => ({ dir: 0, skill: 0 })).filter((e) => e.t === "heal" && e.side === 1);
    return got.reduce((s, e) => s + (e.t === "heal" ? e.amount : 0), 0) / f.stats.hp;
  };
  assert.ok(Math.abs(heal(0) - 0.5) < 0.02, `처음 ${heal(0)}`);
  assert.ok(Math.abs(heal(WILD_TIRE_TICKS + 1) - 0.25) < 0.02, `지친 뒤 ${heal(WILD_TIRE_TICKS + 1)}`);

  const s = newSave("leaf_2", 2);
  s.party = [mon("conch_3", 30, ["drop"], "me")];
  const t = startTrainer(s, REGIONS[0], { id: "x", name: "x", hello: "", bye: "", team: [["conch_3", 20]], gold: 0 }).battle;
  const ta = place(newArena(t, EMPTY));
  ta.b.sides[1].team[0].mon.moves = [{ id: "rest", pp: 5 }];
  run(ta, WILD_FLEE_TICKS + 30);
  assert.equal(ta.b.over, null, "트레이너전은 시간으로 끝나지 않는다");
  assert.equal(wildTired(ta), false);
});

test("② 같은 속성끼리의 야생 판(호수 · 늪)도 150초 안에 끝난다 — 예전엔 10분까지 늘어졌다", () => {
  for (const key of ["lake", "swamp"]) {
    const r = REGIONS.find((x) => x.key === key)!;
    const pool = r.table.map(([k]) => k);
    for (let i = 0; i < 40; i++) {
      const s = newSave("leaf_2", 3000 + i);
      const lv = Math.round((r.levels[0] + r.levels[1]) / 2);
      s.party = [0, 1, 2].map((j) => {
        let k = pool[(i * 3 + j * 5) % pool.length];
        for (let e = SPECIES[k].evolves; e && lv >= e.at; e = SPECIES[k].evolves) k = e.to;
        return makeMon(k, lv, { s: i * 7 + j }, `m${j}`);
      });
      const a = newArena(startWild(s, r).battle, EMPTY);
      const me = { s: i + 5 };
      while (!a.b.over && a.tick < 400 * TPS) {
        let inp = think(a, 0, me, 0.5);
        if (a.b.needSwap) inp = { dir: 0, swap: a.b.sides[0].team.findIndex((f) => f.mon.hp > 0) };
        stepArena(a, inp);
      }
      assert.ok(a.b.over && a.tick <= WILD_FLEE_TICKS + 2 * TPS, `${key} #${i}: ${(a.tick / TPS).toFixed(0)}초`);
    }
  }
});

/* ③ 상태이상 */

test("③ 판이 끝나면 화상 · 독 · 마비도 풀린다(예전엔 잠듦만)", () => {
  const s = newSave("leaf_2", 4);
  const { battle } = startWild(s, REGIONS[0]);
  battle.sides[0].team[0].mon.status = "burn";
  battle.over = "run";
  assert.equal(finishBattle(s, battle, EMPTY).save.party[0].status, undefined);
  for (const st of ["poison", "para"] as const) {
    const b2 = startWild(s, REGIONS[0]).battle;
    b2.sides[0].team[0].mon.status = st;
    b2.over = "win";
    b2.sides[1].team[0].mon.hp = 0;
    assert.equal(finishBattle(s, b2, EMPTY).save.party[0].status, undefined, st);
  }
});

test("③ 교체해도 상태이상 시간은 이어서 센다 — 들어갔다 나와도 처음부터가 아니다", () => {
  const a = arena([mon("leaf_3", 20, ["leafy"], "a"), mon("leaf_3", 20, ["leafy"], "b")], mon("burr_3", 20, ["growl"], "wild"));
  a.b.sides[0].team[0].mon.status = "poison";
  a.units[0].statusT = 100;
  run(a, 10);
  const left = a.units[0].statusT;
  assert.ok(left < 100 && left > 80);
  run(a, 1, () => ({ dir: 0, swap: 1 }));
  assert.equal(a.b.sides[0].active, 1);
  run(a, 6 * TPS);
  run(a, 1, () => ({ dir: 0, swap: 0 }));
  assert.equal(a.b.sides[0].active, 0);
  // 나온 그 틱에 한 번 줄어든다
  assert.equal(a.units[0].statusT, left - 1, "들어가 있는 동안은 멈추고, 나오면 남은 시간부터");
});

/* ④ 고른 기술 */

test("④ 하나만 골라도 빈 칸은 레벨 기술로 채운다 · 배운 게 둘뿐이면 둘", () => {
  const m = makeMon("ember_3", 30, { s: 1 }, "x");
  const got = movesOf({ ...m, picked: ["spark"] });
  assert.equal(got[0], "spark");
  assert.equal(got.length, 4);
  assert.equal(new Set(got).size, 4);
  assert.deepEqual(movesOf({ species: "ember_2", level: 1, picked: ["bump"] }), ["bump", "spark"]);
  assert.deepEqual(movesOf({ species: "ember_3", level: 30 }), movesAt("ember_3", 30));
});

/* ⑤ 보관함 */

test("⑤ 보관함은 BOX_MAX 까지 — 넘으면 새로 잡은 생물을 놓아주고 골드(도감엔 남는다)", () => {
  const s = newSave("leaf_2", 5);
  s.party = Array.from({ length: PARTY_MAX }, (_, i) => makeMon("leaf_2", 5, { s: i }, `p${i}`));
  s.box = Array.from({ length: BOX_MAX }, (_, i) => makeMon("beetle_2", 5, { s: i }, `b${i}`));
  assert.ok(boxFull(s));
  const { battle, save } = startWild(s, REGIONS[0], { species: "puff_2", level: 4 });
  battle.over = "caught";
  battle.caught = { ...battle.sides[1].team[0].mon };
  const out = finishBattle(save, battle, EMPTY);
  assert.equal(out.save.box.length, BOX_MAX);
  assert.equal(out.save.party.length, PARTY_MAX);
  assert.ok(out.save.caught.includes("puff_2"));
  assert.equal(out.gold, 40);
  assert.ok(out.notes.some((n) => n.includes("놓아주었다")));
  assert.equal(out.save.gold, save.gold + 40);
});

test("⑤ compactSave — 보관함의 기술 칸을 비워 저장이 줄고, normalizeSave 가 같은 기술로 되살린다", () => {
  const s = newSave("leaf_2", 6);
  s.box = Array.from({ length: 200 }, (_, i) => ({ ...makeMon(SPECIES_KEYS[i % 90], 10 + (i % 40), { s: i }, `b${i}`), picked: i % 3 ? undefined : [learnedAt(SPECIES_KEYS[i % 90], 10 + (i % 40))[0]] }));
  const full = JSON.stringify(s);
  const small = JSON.stringify(compactSave(s));
  assert.ok(small.length < full.length * 0.6, `${small.length} / ${full.length}`);
  assert.ok(s.box[0].moves.length > 0, "메모리의 저장은 그대로");
  const back = normalizeSave(JSON.parse(small))!;
  assert.deepEqual(back.box.map((m) => m.moves.map((x) => x.id)), s.box.map((m) => movesOf(m)));
  // 비운 채로 팀에 넣어도 빈 기술로 싸우지 않는다
  const t = { ...s, party: [{ ...s.box[5], moves: [] }] };
  assert.ok(startWild(t, REGIONS[0]).battle.sides[0].team[0].mon.moves.length > 0);
});

/* ⑥ 광선 */

test("⑥ 회피하거나 쓰러져 교체하면 내가 켠 광선이 꺼진다(예전엔 발만 풀리고 광선은 계속 맞혔다)", () => {
  for (const how of ["dodge", "faint"] as const) {
    const a = arena([mon("puff_4", 40, ["rainbow"], "a"), mon("leaf_3", 20, ["leafy"], "b")], mon("burr_3", 40, ["growl"], "wild"));
    run(a, 1, () => ({ dir: 0, skill: 0 }));
    let n = 0;
    while (!a.beams.some((b) => b.side === 0) && n++ < 40) run(a, 1);
    assert.ok(a.beams.some((b) => b.side === 0), "광선이 켜졌다");
    if (how === "faint") a.b.sides[0].team[0].mon.hp = 0;
    run(a, 1, () => (how === "dodge" ? { dir: 3, dodge: true } : idle));
    assert.equal(a.beams.filter((b) => b.side === 0).length, 0, how);
    assert.equal(a.units[0].lock, 0);
    if (how === "faint") {
      assert.equal(a.b.needSwap, true);
      run(a, 1, () => ({ dir: 0, swap: 1 }));
      assert.equal(a.b.sides[0].active, 1);
    }
  }
});

/* ⑦ 늦게 닿는 기술 */

test("⑦ 낙하는 쏠 때의 생물로 셈한다 — 쏘고 약한 생물로 바꿔도 피해가 같다", () => {
  const hitOf = (swap: boolean) => {
    const a = arena([mon("snow_4", 50, ["glacier"], "a"), mon("leaf_2", 3, ["leafy"], "b")], mon("burr_4", 50, ["growl"], "wild"));
    run(a, 1, () => ({ dir: 0, skill: 0 }));
    let n = 0;
    while (!a.zones.some((z) => z.side === 0) && n++ < 40) run(a, 1);
    assert.ok(a.zones.some((z) => z.side === 0), "낙하 원이 깔렸다");
    if (swap) run(a, 1, () => ({ dir: 0, swap: 1 }));
    const ev = run(a, 60);
    return ev.filter((e) => e.t === "hit" && e.side === 1 && !e.dot && !e.recoil).map((e) => (e.t === "hit" ? e.dmg : 0));
  };
  const stay = hitOf(false);
  const swapped = hitOf(true);
  assert.ok(stay.length && stay[0] > 5, `맞았다 ${stay}`);
  assert.deepEqual(swapped, stay);
});

/* ⑧ 끈기 */

test("⑧ 끈기는 생물마다 판에 한 번 — 들어갔다 나와도 되살아나지 않는다", () => {
  const s = newSave("leaf_2", 8);
  s.party = [mon("ember_4", 45, ["flametail"], "me")];
  const b = startTrainer(s, REGIONS[0], { id: "x", name: "x", hello: "", bye: "", team: [["burr_3", 20], ["burr_3", 20]], gold: 0 }).battle;
  const a = place(newArena(b, EMPTY));
  const foe = a.b.sides[1].team[0];
  const strike = (until: () => boolean) => {
    for (let i = 0; i < 200 && !until(); i++) {
      a.units[0].x = a.units[1].x;
      a.units[0].y = a.units[1].y + 60;
      a.units[0].cd = [0, 0, 0, 0];
      stepArena(a, { dir: 0, skill: 0 }, idle);
    }
  };
  foe.mon.hp = 3;
  strike(() => foe.mon.hp <= 1);
  assert.equal(foe.mon.hp, 1, "한 번 버텼다");
  assert.equal(a.held[1][0], true);
  for (let i = 0; i < 40 && a.b.sides[1].active !== 1; i++) stepArena(a, idle, { dir: 0, swap: 1 });
  assert.equal(a.b.sides[1].active, 1);
  const sideOf = () => a.b.sides[1].active;
  for (let i = 0; i < 8 * TPS && sideOf() !== 0; i++) stepArena(a, idle, { dir: 0, swap: 0 });
  assert.equal(a.b.sides[1].active, 0);
  foe.mon.hp = 3;
  a.units[1].enter = 0;
  strike(() => foe.mon.hp <= 0 || foe.mon.hp === 1);
  assert.equal(foe.mon.hp, 0, "두 번째는 버티지 못한다");
});

/* ⑨ 함께 쓰러짐 */

test("⑨ 마지막 둘이 같은 틱에 쓰러지면 진 것 — 야생 · 대전 모두(예전엔 늘 내 승리)", () => {
  const both = (b: Battle) => {
    const a = newArena(b, b.wild ? EMPTY : null);
    for (const side of [0, 1] as const) {
      const f = a.b.sides[side].team[0];
      f.mon.hp = 1;
      f.mon.status = "poison";
      a.units[side].statusT = 300;
      a.units[side].dotT = 1;
    }
    run(a, 3);
    return a.b.over;
  };
  const s = newSave("leaf_2", 9);
  assert.equal(both(startWild(s, REGIONS[0]).battle), "lose");
  const m1 = makeMon("leaf_3", 20, { s: 1 }, "x");
  const m2 = makeMon("ember_3", 20, { s: 2 }, "y");
  assert.equal(both(startDuel([m1], [m2], 77, ["나", "너"])), "lose");
});

test("보관함 덜어 쓰기 — 저장소가 이 기기 사본 · 서버 저장 둘 다 compactSave 로 보낸다 · 가득 차면 던지기 전에 알린다", () => {
  const store = readFileSync("src/lib/adventurestore.ts", "utf8");
  assert.match(store, /JSON\.stringify\(\{ save: compactSave\(s\.save\), version: s\.version, dirty \}\)/);
  assert.match(store, /p_state: compactSave\(body\)/);
  const tab = readFileSync("src/components/adventure/AdventureTab.tsx", "utf8");
  assert.equal((tab.match(/startWild\([^)]*\);\s*warnBoxFull\(\);/g) ?? []).length, 2);
  assert.match(tab, /b\.fled \? `\$\{josa\(wild, "이\/가"\)\} 지쳐서 달아났다`/);
});
