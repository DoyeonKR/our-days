// 모험 실시간 전투 lock — 결정성 · 판이 끝남 · 회피 무적 · 광선은 굳은 방향 · 맞으면 끊김 · 재사용 대기 · 잡기 · 대전 기록 재생. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS, STARTERS, finishBattle, makeMon, newSave, startWild, statsOf, type Battle } from "./adventure.ts";
import {
  DUEL_TICKS, TPS, dirOf, duelInput, newArena, record, replayDuel, ringAim, skillOf, stepArena, think, validLog,
  type AEv, type Arena, type ArenaInput, type LogEntry,
} from "./arena.ts";
import { botTeam, pickTeam, startDuel } from "./adventurepvp.ts";

const EMPTY = { balls: { basic: 0, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } };

function wild(seed: number, starter = "leaf_2") {
  const save = newSave(starter, seed);
  const st = startWild(save, REGIONS[0]);
  return { save: st.save, a: newArena(st.battle, EMPTY) };
}

/** 한 마리씩 기술을 정해 둔 판 — 나는 me, 상대는 foe 기술만 */
function setup(me: string[], foe: string[], seed = 5): Arena {
  const { a } = wild(seed);
  const rng = { s: seed };
  const put = (side: 0 | 1, species: string, moves: string[]) => {
    const f = a.b.sides[side].team[0];
    f.mon = { ...makeMon(species, 20, rng, side ? "wild" : "me"), moves: moves.map((id) => ({ id, pp: 30 })) };
    f.stats = statsOf(f.mon);
    f.mon.hp = f.stats.hp;
  };
  put(0, "ember_3", me);
  put(1, "burr_3", foe);
  a.units[0].enter = 0;
  a.units[1].enter = 0;
  // 서로 160 거리 — 돌진이 닿고 탄이 시전 안에 도착한다
  a.units[0].y = a.units[0].py = 380;
  a.units[1].y = a.units[1].py = 220;
  return a;
}

const idle: ArenaInput = { dir: 0 };
function run(a: Arena, ticks: number, mine: (a: Arena) => ArenaInput = () => idle, foe: (a: Arena) => ArenaInput = () => idle): AEv[] {
  const all: AEv[] = [];
  for (let i = 0; i < ticks && !a.b.over; i++) {
    stepArena(a, mine(a), foe(a));
    all.push(...a.ev);
  }
  return all;
}

test("같은 시작 판 + 같은 입력 = 같은 판(서버가 다시 돌려 판정한다)", () => {
  const go = () => {
    const { a } = wild(42, "ember_2");
    const out: string[] = [];
    const rng = { s: 9 };
    while (!a.b.over && a.tick < 90 * TPS) {
      stepArena(a, think(a, 0, rng, true));
      out.push(JSON.stringify(a.ev));
    }
    return out.join("|");
  };
  assert.equal(go(), go());
});

test("엔진은 삼각함수 · 난수 · 시계를 안 쓴다(기기 · 서버마다 끝자리가 갈리면 판정이 어긋난다)", () => {
  const src = readFileSync(join(import.meta.dirname, "arena.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /Math\.(sin|cos|tan|atan|atan2|exp|log|random|hypot)\b|Date\.|performance\./);
});

test("수백 판 — 3분 안에 끝나고 체력이 범위 안 · 시작 생물이 첫 숲에서 대개 이긴다 · 저장까지", () => {
  let wins = 0;
  let ticks = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { save, a } = wild(seed * 977, STARTERS[seed % 3]);
    const rng = { s: seed };
    while (!a.b.over && a.tick < 180 * TPS) {
      stepArena(a, think(a, 0, rng, false));
      for (const s of a.b.sides) for (const f of s.team) assert.ok(f.mon.hp >= 0 && f.mon.hp <= f.stats.hp);
    }
    assert.ok(a.b.over, `seed ${seed}: 3분에도 안 끝났다`);
    if (a.b.over === "win") wins++;
    ticks += a.tick;
    const out = finishBattle(save, a.b, a.bag!);
    assert.ok(out.save.party.length >= 1);
  }
  assert.ok(wins / 200 > 0.6, `첫 숲 승률 ${wins / 200}`);
  const avg = ticks / 200 / TPS;
  assert.ok(avg > 5 && avg < 40, `한 판 평균 ${avg.toFixed(1)}초`);
});

test("회피 — 무적 동안은 탄이 지나가고(빗나감) 체력이 그대로", () => {
  const a = setup(["spark"], ["drop"]);
  const hp = a.b.sides[0].team[0].mon.hp;
  stepArena(a, idle, { dir: 0, skill: 0 });
  a.units[0].iframe = 60;
  const ev = run(a, 50);
  assert.ok(ev.some((e) => e.t === "miss" && e.side === 0));
  assert.equal(a.b.sides[0].team[0].mon.hp, hp);
});

test("광선은 시전을 시작할 때 방향이 굳는다 — 옆으로 비키면 안 맞고, 서 있으면 맞는다", () => {
  const stay = setup(["spark"], ["bolt"]);
  const hp0 = stay.b.sides[0].team[0].mon.hp;
  stepArena(stay, idle, { dir: 0, skill: 0 });
  run(stay, 20);
  assert.ok(stay.b.sides[0].team[0].mon.hp < hp0, "서 있었는데 안 맞았다");

  const side = setup(["spark"], ["bolt"]);
  const hp1 = side.b.sides[0].team[0].mon.hp;
  stepArena(side, idle, { dir: 0, skill: 0 });
  run(side, 20, () => ({ dir: dirOf(1, 0) }));
  assert.equal(side.b.sides[0].team[0].mon.hp, hp1, "옆으로 비켰는데 맞았다");
});

test("맞으면 시전이 끊긴다 · 재사용 대기 동안 같은 기술을 못 쓴다", () => {
  const a = setup(["bolt"], ["spark"]);
  stepArena(a, { dir: 0, skill: 0 }, { dir: 0, skill: 0 });
  assert.ok(a.units[0].cast, "광선 시전 시작");
  const ev = run(a, 14);
  assert.ok(ev.some((e) => e.t === "interrupt" && e.side === 0), "맞았는데 안 끊겼다");

  const b = setup(["spark"], ["shell"]);
  stepArena(b, { dir: 0, skill: 0 });
  run(b, skillOf("spark").windup + 1);
  assert.ok(b.units[0].cd[0] > 0);
  const casts = run(b, 10, () => ({ dir: 0, skill: 0 })).filter((e) => e.t === "cast" && e.side === 0);
  assert.equal(casts.length, 0, "재사용 대기 중에 다시 썼다");
  assert.ok(skillOf("lava").cd > skillOf("spark").cd, "센 기술일수록 오래 기다린다");
});

test("연타 · 흡수 · 반동 · 상태이상이 실시간에서도 듣는다", () => {
  let multi = 0;
  let drained = 0;
  let recoiled = 0;
  let slept = 0;
  for (let s = 1; s <= 30; s++) {
    const m = setup(["icicle"], ["shell"], s);
    const ev = run(m, 40, (a) => (a.tick === 0 ? { dir: 0, skill: 0 } : idle));
    if (ev.filter((e) => e.t === "hit" && e.move === "icicle").length >= 2) multi++;
    const d = setup(["sap"], ["shell"], s);
    d.b.sides[0].team[0].mon.hp = 5;
    if (run(d, 40, (a) => (a.tick === 0 ? { dir: 0, skill: 0 } : idle)).some((e) => e.t === "heal" && e.drain)) drained++;
    const r = setup(["slam"], ["shell"], s);
    if (run(r, 40, (a) => (a.tick === 0 ? { dir: 0, skill: 0 } : idle)).some((e) => e.t === "hit" && e.recoil)) recoiled++;
    const z = setup(["lullaby"], ["shell"], s);
    if (run(z, 30, (a) => (a.tick === 0 ? { dir: 0, skill: 0 } : idle)).some((e) => e.t === "status" && e.status === "sleep" && e.on)) slept++;
  }
  assert.ok(multi > 10, `연타 ${multi}`);
  assert.ok(drained > 10, `흡수 ${drained}`);
  assert.ok(recoiled > 10, `반동 ${recoiled}`);
  assert.ok(slept > 10, `잠듦 ${slept}`);
});

test("잠듦은 시간이 지나거나 맞으면 깬다", () => {
  const a = setup(["spark"], ["shell"]);
  const f = a.b.sides[1].team[0];
  f.mon.status = "sleep";
  a.units[1].stun = 75;
  a.units[1].statusT = 75;
  const ev = run(a, 40, (x) => (x.tick === 0 ? { dir: 0, skill: 0 } : idle));
  assert.ok(ev.some((e) => e.t === "status" && e.side === 1 && e.status === "sleep" && !e.on), "맞았는데 안 깼다");
  assert.equal(f.mon.status, undefined);
});

test("공 — 고리가 작을 때 던지면 잘 잡히고, 잡으면 팀과 도감에 들어간다", () => {
  let caught = 0;
  for (let seed = 1; seed <= 40 && !caught; seed++) {
    const { save, a } = wild(seed);
    a.bag = { balls: { basic: 0, great: 0, star: 20 }, items: { ...EMPTY.items } };
    a.units[0].enter = 0;
    a.units[1].enter = 0;
    for (let i = 0; i < 600 && !a.b.over; i++) {
      const good = ringAim(a.tick + 1) > 0.9 && !a.throwing && !a.capture;
      stepArena(a, good ? { dir: 0, ball: "star" } : idle, { dir: 0 });
    }
    if (a.b.over === "caught") {
      caught++;
      const out = finishBattle(save, a.b, a.bag);
      assert.equal(out.save.party.length, 2);
      assert.ok(out.save.caught.includes(a.b.caught!.species));
      assert.ok(out.save.balls.star < 20, "던진 공이 줄었다");
    }
  }
  assert.ok(caught > 0);
});

test("★ 대전 — 입력 기록만으로 서버가 같은 결과를 다시 만든다(쓰러져 고르는 멈춤 포함)", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const save = newSave("leaf_2", seed);
    const mine = pickTeam({ ...save, party: [save.party[0], { ...save.party[0], id: "m2", species: "conch_2" }, { ...save.party[0], id: "m3", species: "volt_2" }] }, ["m1", "m2", "m3"]);
    const start: Battle = startDuel(mine, botTeam(8, seed, "2026-11-08").team, seed * 31, ["나", "상대"]);
    const keep = JSON.parse(JSON.stringify(start)) as Battle;
    const a = newArena(start, null);
    const log: LogEntry[] = [];
    let dir = 0;
    const rng = { s: seed };
    let froze = false;
    while (!a.b.over && a.tick < DUEL_TICKS) {
      let inp = think(a, 0, rng, true);
      if (a.b.needSwap) {
        froze = true;
        inp = { dir: 3, swap: a.b.sides[0].team.findIndex((f) => f.mon.hp > 0) };
      }
      inp = duelInput(inp);
      dir = record(log, dir, a.tick, inp);
      stepArena(a, inp);
    }
    assert.ok(validLog(log));
    const r = replayDuel(keep, log);
    assert.equal(r.b.over, a.b.over, `seed ${seed}`);
    assert.equal(r.tick, a.tick);
    assert.deepEqual(r.b.sides.map((s) => s.team.map((f) => f.mon.hp)), a.b.sides.map((s) => s.team.map((f) => f.mon.hp)));
    if (seed === 6) assert.ok(froze || a.b.over === "win", "쓰러져 고르는 길을 한 번은 지나야 한다");
  }
});

test("대전 입력은 이동 · 기술 · 회피 · 교체뿐 · 깨진 기록은 거른다", () => {
  assert.deepEqual(duelInput({ dir: 3, ball: "star", run: true, item: "potion" }), { dir: 3 });
  assert.deepEqual(duelInput({ dir: 9, skill: 7 }), { dir: 0 });
  assert.equal(validLog([[0, 1, 1, 0], [5, 2, 0, 0]]), true);
  assert.equal(validLog([[5, 1, 0, 0], [2, 1, 0, 0]]), false, "틱이 거꾸로");
  assert.equal(validLog([[0, 1, 9, 0]]), false);
  assert.equal(validLog("x"), false);
  // 기록이 중간에 끊기면 끝나지 않는다 — 서버는 진 것으로 친다
  const save = newSave("ember_2", 3);
  const b = startDuel(pickTeam(save, ["m1"]), botTeam(6, 0, "2026-11-08").team, 5, ["나", "상대"]);
  const r = replayDuel(b, []);
  assert.ok(r.b.over === "lose" || r.b.over === "win" || r.tick === DUEL_TICKS);
});

test("8방향 — 막대 · 화살표를 같은 방향으로", () => {
  assert.equal(dirOf(0, 0), 0);
  assert.equal(dirOf(0, -1), 1);
  assert.equal(dirOf(1, -1), 2);
  assert.equal(dirOf(1, 0), 3);
  assert.equal(dirOf(-1, -1), 8);
  assert.equal(dirOf(0.9, 0.2), 3);
});
