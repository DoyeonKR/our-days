/* 모험 필드 · 진행 — 지도에 막다른 곳이 없는지, 대장 · 상자 · 각성 규칙 (2026-11-08). README §14.6 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshMon } from "./adventurepvp.ts";
import { CHARMS, cycleCharm, REGIONS, SPECIES, TOWER_MAX, claimMission, dailyOf, finishBattle, isDuel, startTower, startTrainer, statsOf, claimDex, DEX_REWARDS, SPECIES_KEYS, towerTeam, trainersOf, makeMon, newSave, normalizeSave, openChest, regionOpen, releaseMon, startBoss, startWild, nextGoal, type AdvSave } from "./adventure.ts";
import { FIELD_H, FIELD_W, afterBattle, buildField, nearestThing, newField, stepField } from "./adventurefield.ts";
import { AWAKE_TICKS, CHARGE_MAX, DUEL_TICKS, duelInput, newArena, stepArena, validLog } from "./arena.ts";

const EMPTY = { balls: { basic: 5, great: 0, star: 0 }, items: { potion: 2, bigpotion: 0, cure: 0 } };

function reach(region: (typeof REGIONS)[number]) {
  const map = buildField(region);
  const CELL = 24;
  const W = Math.ceil(FIELD_W / CELL);
  const H = Math.ceil(FIELD_H / CELL);
  const open = (cx: number, cy: number) => {
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    if (x < 30 || y < 62 || x > FIELD_W - 30 || y > FIELD_H - 30) return false;
    return [...map.rocks, ...map.pools].every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + 14);
  };
  const seen = new Set<number>();
  const q: [number, number][] = [[Math.floor(map.start.x / CELL), Math.floor(map.start.y / CELL)]];
  seen.add(q[0][1] * W + q[0][0]);
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx) || !open(nx, ny)) continue;
      seen.add(ny * W + nx);
      q.push([nx, ny]);
    }
  }
  const near = (p: { x: number; y: number }) => {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (seen.has((Math.floor(p.y / CELL) + dy) * W + Math.floor(p.x / CELL) + dx)) return true;
    }
    return false;
  };
  return { map, near };
}

test("지역마다 대장 · 샘 · 상자에 걸어서 닿는다", () => {
  for (const r of REGIONS) {
    const { map, near } = reach(r);
    assert.ok(near(map.gate), `${r.key} 대장`);
    assert.ok(near(map.spring), `${r.key} 샘`);
    for (const c of map.chests) assert.ok(near(c), `${r.key} 상자`);
    assert.ok(map.grass.length >= 5, `${r.key} 수풀 ${map.grass.length}`);
  }
});

test("같은 지역의 지도는 언제나 같다", () => {
  assert.deepEqual(buildField(REGIONS[3]), buildField(REGIONS[3]));
});

test("수풀에 생물이 돌아다니고 닿으면 만난다 · 이기면 사라지고 도망치면 잠깐 안 건드린다", () => {
  const r = REGIONS[0];
  const s = newField(r, 7);
  assert.ok(s.mons.length >= 5);
  s.safe = 0;
  const target = s.mons[0];
  s.x = target.x;
  s.y = target.y;
  const met = stepField(s, r, 0, true);
  assert.ok(met);
  afterBattle(s, met!.id, "run");
  assert.ok(s.mons.find((m) => m.id === met!.id)!.cool > 0);
  assert.equal(stepField(s, r, 0, true), null, "전투 직후엔 무적");
  afterBattle(s, met!.id, "win");
  assert.equal(s.mons.find((m) => m.id === met!.id), undefined);
});

test("팀이 모두 지치면 생물이 닿아도 전투가 열리지 않는다", () => {
  const r = REGIONS[0];
  const s = newField(r, 3);
  s.safe = 0;
  s.x = s.mons[0].x;
  s.y = s.mons[0].y;
  assert.equal(stepField(s, r, 0, false), null);
});

test("지면 시작점으로 돌아가고, 가까이 가면 조사할 것이 잡힌다", () => {
  const r = REGIONS[1];
  const s = newField(r, 3);
  s.x = 100;
  s.y = 100;
  afterBattle(s, 999, "lose");
  assert.equal(s.x, s.map.start.x);
  s.x = s.map.gate.x;
  s.y = s.map.gate.y + 40;
  assert.equal(nearestThing(s)?.kind, "boss");
  s.x = s.map.spring.x;
  s.y = s.map.spring.y;
  assert.equal(nearestThing(s)?.kind, "spring");
});

test("앞 지역 대장을 이기면 다음 지역이 열린다 · 레벨로도 넘어갈 수 있다", () => {
  const s = newSave("ember_2", 1);
  assert.ok(regionOpen(s, REGIONS[0]));
  assert.equal(regionOpen(s, REGIONS[1]), false, "시작 레벨(5)로 둘째 지역이 열리면 안 된다");
  assert.ok(regionOpen({ ...s, badges: ["meadow"] }, REGIONS[1]));
  const strong = { ...s, party: [makeMon("ember_2", 40, { s: 1 }, "x")] };
  assert.ok(regionOpen(strong, REGIONS[3]), "레벨이 충분하면 막히지 않는다");
  assert.ok(nextGoal(s).text.length > 0);
});

test("상자는 하루 한 번 · 날짜가 바뀌면 다시 열린다 · 저장에 남는다", () => {
  const s = newSave("ember_2", 1);
  const a = openChest(s, REGIONS[2], 0, "2026-11-08")!;
  assert.ok(a.save.gold > s.gold);
  assert.ok(a.save.balls.great > s.balls.great);
  assert.equal(openChest(a.save, REGIONS[2], 0, "2026-11-08"), null);
  assert.ok(openChest(a.save, REGIONS[2], 1, "2026-11-08"), "다른 상자");
  assert.ok(openChest(a.save, REGIONS[2], 0, "2026-11-09"), "다음 날");
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(a.save)))!.field, a.save.field);
});

test("놓아주기는 보관함에서만, 골드를 준다", () => {
  const s = newSave("ember_2", 1);
  const m = makeMon("leaf_2", 9, { s: 2 }, "b1");
  const out = releaseMon({ ...s, box: [m] }, "b1");
  assert.equal(out.box.length, 0);
  assert.equal(out.gold, s.gold + 90);
  assert.equal(releaseMon(s, s.party[0].id), s, "팀은 놓아줄 수 없다");
});

function bossArena(save: AdvSave) {
  return newArena(startBoss(save, REGIONS[0]).battle, EMPTY);
}

test("대장전 — 시간 제한 없음 · 약은 쓰고 공 · 도망은 안 된다", () => {
  const s = newSave("ember_2", 1);
  const a = bossArena(s);
  assert.equal(a.limit, 0);
  assert.ok(a.bag);
  a.units[0].enter = 0;
  stepArena(a, { dir: 0, ball: "basic" });
  assert.equal(a.throwing, null);
  stepArena(a, { dir: 0, run: true });
  assert.equal(a.units[0].channel, null);
  // 대전은 그대로
  const duel = startWild(s, REGIONS[0]).battle;
  duel.wild = false;
  assert.equal(newArena(duel, EMPTY).limit, DUEL_TICKS);
  assert.equal(newArena(duel, EMPTY).bag, null);
});

test("대장은 체력이 절반 아래로 내려가면 한 번 분노한다", () => {
  const s = newSave("ember_2", 1);
  s.party = [makeMon("ember_2", 9, { s: 9 }, "p")];
  const a = bossArena(s);
  a.b.sides[1].team.forEach((f) => (f.mon.hp = Math.floor(f.stats.hp * 0.55)));
  let on = false;
  for (let i = 0; i < 30 * 40 && !a.b.over && !on; i++) {
    const u = a.units[0];
    const o = a.units[1];
    u.x = o.x;
    u.y = o.y + 70;
    stepArena(a, { dir: 0, skill: i % 4 });
    if (a.ev.some((e) => e.t === "enrage")) on = true;
  }
  assert.ok(on);
  assert.ok(a.units[1].enraged);
});

test("각성 — 게이지가 차야 쓰고, 쓰면 비고, 8초 동안 재사용이 빨리 돈다", () => {
  const s = newSave("ember_2", 1);
  const a = newArena(startWild(s, REGIONS[0]).battle, EMPTY);
  for (let i = 0; i < 30; i++) stepArena(a, { dir: 0 });
  stepArena(a, { dir: 0, awaken: true });
  assert.equal(a.units[0].awake, 0, "게이지가 없으면 안 된다");
  a.charge[0] = CHARGE_MAX;
  a.units[0].cd = [30, 30, 30, 30];
  stepArena(a, { dir: 0, awaken: true });
  assert.equal(a.charge[0], 0);
  assert.ok(a.units[0].awake > AWAKE_TICKS - 3);
  const before = a.units[0].cd[0];
  stepArena(a, { dir: 0 });
  assert.equal(a.units[0].cd[0], before - 2);
});

test("온라인 대전엔 각성이 없다 — 서버 판정(v6)과 기록 형식이 같아야 한다", () => {
  assert.equal(duelInput({ dir: 3, awaken: true }).awaken, undefined);
  assert.equal(validLog([[5, 1, 4, 0]]), false);
  const b = startWild(newSave("ember_2", 1), REGIONS[0]).battle;
  b.wild = false;
  const a = newArena(b, null);
  a.charge[0] = CHARGE_MAX;
  for (let i = 0; i < 25; i++) stepArena(a, { dir: 0, awaken: true });
  assert.equal(a.units[0].awake, 0);
});

test("움직이는 상대에게도 공이 제법 맞는다", () => {
  let thrown = 0;
  let hit = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const a = newArena(startWild(newSave("ember_2", seed * 41), REGIONS[0]).battle, { ...EMPTY, balls: { basic: 99, great: 0, star: 0 } });
    for (let i = 0; i < 300 && !a.b.over; i++) {
      const inp: { dir: number; ball?: "basic" } = { dir: 0 };
      if (i % 40 === 20 && !a.throwing && !a.capture) {
        inp.ball = "basic";
        thrown++;
      }
      stepArena(a, inp);
      if (a.ev.some((e) => e.t === "capture")) hit++;
    }
  }
  assert.ok(hit / thrown > 0.4, `${hit}/${thrown}`);
});

test("전투 화면에 판의 시드를 key 로 쓰지 않는다(시드는 틱마다 바뀐다 — 쓰면 판이 다시 만들어진다)", () => {
  const src = readFileSync(new URL("../components/adventure/AdventureTab.tsx", import.meta.url), "utf8");
  assert.ok(!/<BattleView\s+key=/.test(src));
});

test("트레이너 — 지역마다 둘 · 이기면 한 번만 보상 · 판은 대전이 아니다", () => {
  for (const r of REGIONS) {
    const ts = trainersOf(r);
    assert.equal(ts.length, 2, r.key);
    const { map, near } = reach(r);
    for (const p of map.trainers) assert.ok(near(p), r.key + " 트레이너");
  }
  const s = newSave("ember_2", 1);
  const t = trainersOf(REGIONS[0])[0];
  const b = startTrainer(s, REGIONS[0], t).battle;
  assert.equal(isDuel(b), false);
  assert.equal(newArena(b, EMPTY).limit, 0);
  b.over = "win";
  b.sides[1].team.forEach((f) => (f.mon.hp = 0));
  const once = finishBattle(s, b, EMPTY).save;
  assert.ok(once.trainers!.includes(t.id));
  const twice = finishBattle(once, b, EMPTY).save;
  assert.ok(twice.gold - once.gold < t.gold);
});

test("도전의 탑 — 위로 갈수록 강하고, 처음 깬 층만 보상", () => {
  assert.ok(towerTeam(30)[0][1] > towerTeam(5)[0][1]);
  assert.equal(SPECIES[towerTeam(10)[2][0]].legend, true);
  for (let f = 1; f <= TOWER_MAX; f++) assert.equal(towerTeam(f).every(([k, lv]) => !!SPECIES[k] && lv <= 50), true);
  const s = newSave("ember_2", 1);
  s.party[0].hp = 1;
  const b = startTower(s, 1).battle;
  assert.equal(b.sides[0].team[0].mon.hp, b.sides[0].team[0].stats.hp, "회복하고 오른다");
  b.over = "win";
  const once = finishBattle(s, b, EMPTY).save;
  assert.equal(once.tower, 1);
  assert.equal(finishBattle(once, b, EMPTY).notes.some((n) => n.includes("돌파")), false);
});

test("오늘의 임무 — 하루 단위로 세고, 다 채워야 한 번 받는다", () => {
  let s = newSave("ember_2", 1);
  const day = "2026-11-08";
  assert.equal(claimMission(s, 1, day), null);
  for (let i = 0; i < 2; i++) {
    const b = startWild(s, REGIONS[0]).battle;
    b.over = "caught";
    b.caught = b.sides[1].team[0].mon;
    s = finishBattle(s, b, EMPTY, day).save;
  }
  assert.equal(dailyOf(s, day).catch, 2);
  const got = claimMission(s, 1, day)!;
  assert.ok(got.gold > s.gold);
  assert.equal(claimMission(got, 1, day), null);
  assert.equal(dailyOf(got, "2026-11-09").catch, 0);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(got)))!.daily, got.daily);
});

test("대장 패턴 — 대장전에서만 예고 원을 깔고, 대전 · 야생엔 없다", () => {
  const s = newSave("ember_2", 1);
  s.party = [makeMon("ember_3", 30, { s: 2 }, "p")];
  const a = newArena(startBoss(s, REGIONS[0]).battle, EMPTY);
  a.sig.t = 1;
  a.units[1].enter = 0;
  const n0 = a.zones.length;
  stepArena(a, { dir: 0 });
  assert.ok(a.zones.length > n0 + 5, "원이 여러 개");
  assert.ok(a.zones.every((z) => z.t > 15 || z.side === 0), "맞기 전에 볼 시간이 있다");
  const w = newArena(startWild(s, REGIONS[0]).battle, EMPTY);
  w.sig.t = 1;
  w.units[1].enter = 0;
  stepArena(w, { dir: 0 });
  assert.equal(w.zones.length, 0, "야생엔 패턴이 없다");
  const d = startWild(s, REGIONS[0]).battle;
  d.wild = false;
  const pvp = newArena(d, null);
  pvp.sig.t = 1;
  pvp.units[1].enter = 0;
  stepArena(pvp, { dir: 0 });
  assert.equal(pvp.zones.length, 0);
});

test("장신구 — 가진 수만큼만 끼우고 능력이 오르며, 대전 팀엔 안 들어간다", () => {
  let s = newSave("ember_2", 1);
  s.party.push(makeMon("leaf_2", 5, { s: 2 }, "m9"));
  assert.ok(CHARMS.power);
  assert.equal(cycleCharm(s, "m1").party[0].charm, undefined, "없으면 못 낀다");
  s = { ...s, charms: { power: 1 } };
  s = cycleCharm(s, "m1");
  assert.equal(s.party[0].charm, "power");
  assert.equal(cycleCharm(s, "m9").party[1].charm, undefined, "하나뿐이면 한 마리만");
  const f = startWild(s, REGIONS[0]).battle.sides[0].team[0];
  assert.ok(f.stats.atk > statsOf(s.party[0]).atk);
  assert.equal(freshMon(s.party[0]).charm, undefined);
  assert.equal(normalizeSave(JSON.parse(JSON.stringify(s)))!.party[0].charm, "power");
  assert.equal(cycleCharm(s, "m1").party[0].charm, undefined, "한 바퀴 돌면 뺀다");
});

function faced(attacker: string, defender: string, seed = 3) {
  const s = newSave("ember_2", seed);
  s.party = [makeMon(attacker, 20, { s: seed }, "p")];
  const b = startWild(s, REGIONS[0], { species: defender, level: 20 }).battle;
  const a = newArena(b, EMPTY);
  a.units[0].enter = 0;
  a.units[1].enter = 0;
  a.units[0].x = 380; a.units[0].y = 500;
  a.units[1].x = 380; a.units[1].y = 400;
  return a;
}

test("특성 — 노말은 쓰러질 공격을 한 번 버티고, 풀은 차오르며, 온라인 대전엔 없다", () => {
  const a = faced("ember_2", "burr_2");
  const foe = a.b.sides[1].team[0];
  foe.mon.hp = 3;
  a.units[0].cd = [0, 0, 0, 0];
  for (let i = 0; i < 90 && foe.mon.hp > 1; i++) {
    a.units[0].x = a.units[1].x; a.units[0].y = a.units[1].y + 60;
    stepArena(a, { dir: 0, skill: i % 4 }, { dir: 0 });
  }
  assert.equal(a.units[1].held, true);
  assert.equal(foe.mon.hp, 1);
  const g = faced("leaf_2", "burr_2");
  const me = g.b.sides[0].team[0];
  me.mon.hp = 10;
  g.tick = 239;
  stepArena(g, { dir: 0 }, { dir: 0 });
  assert.ok(me.mon.hp > 10);
  const d = faced("leaf_2", "burr_2");
  d.b.wild = false;
  d.mode = "duel";
  d.b.sides[0].team[0].mon.hp = 10;
  d.tick = 239;
  stepArena(d, { dir: 0 }, { dir: 0 });
  assert.equal(d.b.sides[0].team[0].mon.hp, 10);
});

test("도감 보상 — 채운 만큼만, 한 번만", () => {
  let s = newSave("ember_2", 1);
  assert.equal(claimDex(s, 5), null);
  s = { ...s, caught: SPECIES_KEYS.slice(0, 5) };
  const got = claimDex(s, 5)!;
  assert.equal(got.gold, s.gold + 300);
  assert.equal(claimDex(got, 5), null);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(got)))!.dexClaimed, [5]);
  assert.equal(DEX_REWARDS[DEX_REWARDS.length - 1].need, SPECIES_KEYS.length, "마지막 보상은 도감 완성");
});
