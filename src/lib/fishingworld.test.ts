// 2026-11-03 낚시 네 기능 — 크기 기록 · 때 손님 · 주인 · 주간 원정. 그리고 같이 고친 버그 잠금.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_FORMS, ALL_SPECIES, FAMILIES, aquaOf, familyOf, fishName, speciesOf } from "./aquarium.ts";
import { BAITS, RODS, SPOTS, poolFor, catchArt, coinValue, recordCoins, bossCatch, bossLost, bossOpen, bossTune, bossWon, currentSpot, effectiveStats, expedFor, fishingOf, rollCatch, sellCatch, startFight, stepFight, storeBlock, tryStore } from "./fishing.ts";
import { BOSSES, BOSS_RETURN_DAYS, BOSS_TRIES, TIMED_CHANCE, TIMED_FISH, bossBlock, bossHp, bossHurt, bossLeft, bossStarted, expedAdd, fishTimeOf, fishWxOf, kgOf, newExpedition, noteSize, rollCm, timedMatches, weekOf, type FishMoment } from "./fishingworld.ts";
import { createIsland, type IslandState } from "./island.ts";
import { fishLength } from "./aqua3d/world.ts";
import { FEVER_PITY, rollFever } from "./fishingfever.ts";
import { FISH_GLB } from "./aqua3d/glb.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const T0 = Date.UTC(2026, 10, 3, 3);
const TODAY = "2026-11-03";
const island = () => createIsland("a", null, T0) as IslandState;

test("크기 — 같은 물고기도 길이가 다르고, 대물은 드물다 · 다 큰 물고기가 치어보다 크다", () => {
  const all: number[] = [];
  for (let i = 0; i < 4000; i++) all.push(rollCatch(SPOTS[0], 5, 0.4, i * 53 + 7, { bait: 0 }).cm ?? 0);
  assert.ok(new Set(all).size > 20, "길이가 고르게 갈린다");
  assert.ok(all.every((x) => x > 0));
  let big = 0;
  for (let i = 0; i < 4000; i++) if (rollCm("koi", 2, 5, 0.4, (i * 0.618) % 1, (i * 0.414) % 1) > 65 * 1.3) big++;
  assert.ok(big / 4000 < 0.12 && big > 0, `대물 ${big / 40}%`);
  assert.ok(rollCm("koi", 2, 0, 0, 0.5, 0.5) > rollCm("koi", 0, 0, 0, 0.5, 0.5));
  for (const f of FAMILIES.map((x) => x.key)) assert.ok(rollCm(f, 2, 0, 0, 0.5, 0.5) !== rollCm("__없음", 2, 0, 0, 0.5, 0.5) || f === "__없음", `${f} 길이 표 빠짐`);
});
test("크기 — 길이를 더해도 물고기 뽑기 순서는 그대로다 · 쓰레기엔 길이가 없다", () => {
  const a = rollCatch(SPOTS[1], 5, 0.4, 991, { bait: 2 });
  const { cm: _cm, ...rest } = a;
  assert.ok(_cm);
  assert.equal(rest.family, rollCatch(SPOTS[1], 5, 0.4, 991, { bait: 2, junk: false }).family);
  for (let i = 0; i < 300; i++) {
    const c = rollCatch(SPOTS[0], 1, 0.4, i * 11, { bait: 0, junk: true });
    if (c.junk) assert.equal(c.cm, undefined);
  }
});
test("크기 기록 — 첫 기록은 소식이 아니다 · 내 기록 경신 · 상대를 넘는 순간이 제일 큰 소식", () => {
  let r = noteSize({}, "koi", "a", 30);
  assert.equal(r.note, null);
  r = noteSize(r.book, "koi", "a", 40);
  assert.equal(r.note, "mine");
  assert.equal(noteSize(r.book, "koi", "a", 35).note, null);
  r = noteSize(r.book, "koi", "b", 20);
  assert.equal(r.note, null);
  assert.equal(noteSize(r.book, "koi", "b", 50).note, "top");
  assert.equal(r.book.koi.a, 40);
});
test("크기 기록 — 끌어올린 판이 사람별로 남는다", () => {
  const c = { ...rollCatch(SPOTS[0], 5, 0.4, 5, { bait: 0 }), cm: 12.3 };
  const r = sellCatch(island(), c, TODAY, { who: "u1", couple: true });
  assert.ok(r.ok);
  if (r.ok) assert.equal(fishingOf(r.state).sizes[catchArt(c)].u1, 12.3);
});

test("때 — KST 로 나누고, 날씨 그림을 낚시 날씨로 옮긴다", () => {
  assert.equal(fishTimeOf(Date.UTC(2026, 10, 3, 22)), "dawn"); // KST 07시
  assert.equal(fishTimeOf(Date.UTC(2026, 10, 3, 3)), "day"); // KST 12시
  assert.equal(fishTimeOf(Date.UTC(2026, 10, 3, 9)), "dusk"); // KST 18시
  assert.equal(fishTimeOf(Date.UTC(2026, 10, 3, 14)), "night"); // KST 23시
  assert.equal(fishWxOf("thunder"), "rain");
  assert.equal(fishWxOf("snow"), "snow");
  assert.equal(fishWxOf("sun"), "clear");
  assert.equal(fishWxOf("cloud"), null);
  assert.equal(fishWxOf(null), null);
});
test("때 손님 — 그 낚시터 계열의 품종이고, 그림 없는 새 물고기가 아니다 · 낚시터마다 있다", () => {
  for (const t of TIMED_FISH) {
    const spot = SPOTS.find((x) => x.key === t.spot);
    assert.ok(spot, t.spot);
    const onlyThen = ["sweetfish", "catfish", "jellyfish"].includes(t.species);
    assert.ok(onlyThen || spot!.pool.some(([k]) => familyOf(k)?.finals.some((x) => x.key === t.species)), `${t.species} 는 ${t.spot} 에 없다`);
    assert.ok(!onlyThen || !spot!.pool.some(([k]) => k === t.species), "이때만 오는 물고기는 pool 에 없다");
    assert.ok(speciesOf(t.species), t.species);
    assert.ok(t.time || t.wx);
  }
  for (const s of SPOTS) assert.ok(TIMED_FISH.some((t) => t.spot === s.key), s.key);
});
test("때 손님 — 때가 맞으면 약 10% 오고, 안 맞으면 다 큰 모습으로 절대 안 온다 · 미끼 상한을 넘지 않는다", () => {
  const spot = SPOTS.find((x) => x.key === "starsea")!;
  const night: FishMoment = { time: "night", wx: null }, day: FishMoment = { time: "day", wx: null };
  let hit = 0, leak = 0;
  for (let i = 0; i < 6000; i++) {
    if (rollCatch(spot, 5, 0.4, i * 41 + 3, { bait: 6, when: night }).species === "moon_jelly") hit++;
    if (rollCatch(spot, 40, 1, i * 41 + 3, { bait: 6, when: day, method: "lure" }).species === "moon_jelly") leak++;
  }
  assert.ok(Math.abs(hit / 6000 - TIMED_CHANCE) < 0.03, `${hit / 60}%`);
  assert.equal(leak, 0);
  const brook = SPOTS[0];
  for (let i = 0; i < 3000; i++) assert.notEqual(rollCatch(brook, 5, 0.4, i * 7, { bait: 0, when: { time: "dawn", wx: null } }).species, "diamond_tetra", "지렁이로는 희귀가 안 문다");
  assert.ok(timedMatches({ wx: "rain" }, { time: "day", wx: "rain" }));
  assert.ok(!timedMatches({ wx: "rain" }, { time: "day", wx: null }), "날씨를 모르면 날씨 손님은 안 온다");
});

test("은어 · 메기 · 해파리 — 그때만 오고, 치어부터 다 큰 모습까지 잡히고, 다른 때엔 안 온다 · 그 낚시터 · 미끼 규칙을 따른다", () => {
  const roll = (spot: string, bait: number, when: FishMoment, n = 6000) => {
    const out = { fry: 0, juv: 0, adult: 0 };
    for (let i = 0; i < n; i++) {
      const c = rollCatch(SPOTS.find((x) => x.key === spot)!, 5, 0.4, i * 71 + 5, { bait, when });
      if (["sweetfish", "catfish", "jellyfish"].includes(c.family)) out[c.stage === 0 ? "fry" : c.stage === 1 ? "juv" : "adult"]++;
    }
    return out;
  };
  const rain = roll("pond", 2, { time: "day", wx: "rain" });
  assert.ok(rain.fry > rain.juv && rain.juv > rain.adult && rain.adult > 0, JSON.stringify(rain));
  assert.equal(roll("pond", 6, { time: "day", wx: "clear" }).fry, 0, "비가 안 오면 메기 없음");
  assert.equal(roll("pond", 0, { time: "day", wx: "rain" }).fry, 0, "지렁이로는 고급이 안 문다");
  assert.ok(roll("brook", 1, { time: "dawn", wx: null }).fry > 0);
  assert.equal(roll("brook", 1, { time: "day", wx: null }).fry, 0);
  assert.ok(roll("reef", 3, { time: "night", wx: null }).fry > 0);
  assert.equal(roll("reef", 3, { time: "dusk", wx: null }).fry, 0);
  const c = rollCatch(SPOTS[0], 5, 0.4, 1); // 때를 안 주는 옛 호출에선 안 나온다
  assert.notEqual(c.family, "sweetfish");
});

test("주인 — 낚시터마다 하나 · 품종이 그 계열이다 · 뒤로 갈수록 세다", () => {
  assert.deepEqual(BOSSES.map((b) => b.spot), SPOTS.map((s) => s.key));
  for (const b of BOSSES) {
    assert.ok(familyOf(b.family)?.finals.some((x) => x.key === b.species), b.key);
    assert.ok(b.level >= (SPOTS.find((s) => s.key === b.spot)?.minLevel ?? 0));
  }
  for (let i = 1; i < BOSSES.length; i++) assert.ok(BOSSES[i].difficulty > BOSSES[i - 1].difficulty);
});
test("주인 — 줄이 끊겨도 깎은 만큼 남고, 쉬면 조금만 되찾고, 도망쳐 멀어져도 체력이 차지 않는다", () => {
  let r = bossStarted(undefined, "a", TODAY);
  assert.equal(r.hp, 1);
  r = bossHurt(r, 0.7, TODAY);
  assert.equal(r.hp, 0.7);
  assert.equal(bossHurt(r, 1.2, TODAY).hp, 0.7, "멀어져도 그대로");
  assert.equal(bossLeft(0.7, 0.2, 1.3), 0.7, "멀어진 만큼 되찾지 않는다");
  assert.ok(Math.abs(bossLeft(0.7, 0.2, 0.5) - 0.6) < 1e-9);
  assert.ok(Math.abs(bossLeft(0.7, 0.2, 0) - 0.5) < 1e-9, "다 끌어와도 한 조각만");
  assert.ok(Math.abs(bossHp(r, "2026-11-05") - 0.78) < 1e-9);
  assert.equal(bossHp(r, TODAY), 0.7);
  assert.ok(bossHurt(r, 0, TODAY).hp > 0, "마지막은 끌어올려야 한다");
});
test("주인 — 한 사람이 하루 세 번 · 상대는 따로 센다 · 다음 날 다시 · 잡으면 쉬었다 온다", () => {
  const b = BOSSES[0];
  let s = island();
  s = { ...s, fishing: { ...fishingOf(s), level: 10 } };
  for (let i = 0; i < BOSS_TRIES; i++) {
    const got = bossOpen(s, b.key, "a", TODAY);
    assert.ok(got.ok);
    if (got.ok) s = got.state;
  }
  assert.equal(bossOpen(s, b.key, "a", TODAY).ok, false);
  assert.equal(bossOpen(s, b.key, "b", TODAY).ok, true, "상대는 따로");
  assert.equal(bossOpen(s, b.key, "a", "2026-11-04").ok, true);
  const before = s.coins;
  const w = bossWon(s, b.key, "a", TODAY);
  assert.ok(w.ok);
  if (w.ok) {
    assert.equal(w.state.coins, before + b.coins);
    const r = fishingOf(w.state).bosses[b.key];
    assert.equal(r.caught, 1);
    assert.equal(r.hp, 1);
    assert.match(bossBlock(b, r, 10, "z", TODAY) ?? "", new RegExp(`${BOSS_RETURN_DAYS}일 뒤`));
    assert.equal(bossBlock(b, r, 10, "z", "2026-11-10"), null);
    const again = bossWon(w.state, b.key, "a", "2026-11-10");
    if (again.ok) assert.equal(again.state.coins, w.state.coins + Math.round(b.coins / 2), "두 번째부턴 절반");
  }
  assert.ok(bossBlock(b, undefined, 1, "a", TODAY));
  assert.equal(bossLost(island(), b.key, 0.5, TODAY).ok, false);
});
test("주인 — 왕관을 쓰고 수조에 들어온다 · 수조 단계가 낮아도 담긴다 · 이름에 드러난다", () => {
  const b = BOSSES[BOSSES.length - 1], c = bossCatch(b), s = island();
  assert.equal(storeBlock(s, c), null, "작은 수조여도 담긴다");
  const r = tryStore(s, c, 1, 0, T0, TODAY);
  assert.ok(r.ok);
  if (r.ok) {
    const f = aquaOf(r.state).fish[0];
    assert.equal(f.crown, b.name);
    assert.match(fishName(f), new RegExp(b.name));
    assert.ok(aquaOf(r.state).dex.includes(b.species), "도감에 오른다");
  }
});

/** 사람 흉내 — 0.28초 늦게 보고, 장력 0.7 이면 떼고 0.45 밑이면 누른다 · 차고 나가면 뗀다 */
function humanFight(key: string, seed: number, stats: { power: number; line: number }) {
  const b = BOSSES.find((x) => x.key === key)!;
  const tune = bossTune(b, stats);
  let f = startFight(seed, tune);
  let hold = true, delay = 0;
  const dt = 1 / 30;
  while (f.status === "on") {
    delay -= dt;
    if (delay <= 0) {
      delay = 0.28;
      const danger = f.surgeLeft > 0 && f.event === "surge";
      hold = !danger && (hold ? f.tension < 0.7 : f.tension < 0.45);
    }
    f = stepFight(f, dt, hold, tune);
  }
  return f;
}
test("주인 — 그 낚시터 수준의 장비로 며칠에 걸려 잡히고, 한 판에 끝나지 않는다", () => {
  const GEAR: Record<string, [number, number]> = { dolsoe: [0, 3], hongryeon: [1, 6], geurimja: [2, 10], baetmeori: [2, 12], sanho: [2, 14], geomeun: [3, 16], munji: [4, 18], byeol: [5, 20] };
  for (const b of BOSSES) {
    const [rod, pts] = GEAR[b.key];
    const stats = effectiveStats({ stats: { catch: 1, power: 1 + pts, line: 1 + pts, luck: 1 }, rod, net: 0 });
    let total = 0;
    const RUNS = 30;
    let oneShot = 0;
    for (let run = 0; run < RUNS; run++) {
      let hp = 1, fights = 0;
      while (hp > 0 && fights < 60) {
        fights++;
        const f = humanFight(b.key, run * 1009 + fights * 37, stats);
        if (f.status === "landed" && bossLeft(hp, b.chunk, 0) <= 0) break;
        hp = Math.max(0.03, bossLeft(hp, b.chunk, f.dist));
      }
      total += fights;
      if (fights === 1) oneShot++;
    }
    const avg = total / RUNS;
    console.log(`  ${b.key} 평균 ${avg.toFixed(1)}판`);
    assert.ok(avg >= 5 && avg <= 24, `${b.key}: 평균 ${avg.toFixed(1)}판 (RODS ${RODS[rod].name})`);
    assert.equal(oneShot, 0, `${b.key}: 한 판에 ${oneShot}번`);
  }
});

test("원정 — 주가 월요일로 묶이고, 주가 바뀌면 새로 시작한다 · 주 중간엔 목표가 안 도망간다", () => {
  assert.equal(weekOf("2026-11-03"), "2026-11-02");
  assert.equal(weekOf("2026-11-08"), "2026-11-02");
  assert.equal(weekOf("2026-11-09"), "2026-11-09");
  const e = expedFor({ level: 1, exped: null }, TODAY, true);
  assert.equal(expedFor({ level: 40, exped: e }, "2026-11-05", true), e);
  assert.notEqual(expedFor({ level: 40, exped: e }, "2026-11-09", true).week, e.week);
});
test("원정 — 둘이 합쳐 채운다 · 다 채운 순간 한 번만 들어온다 · 둘 다 낚으면 마지막 보너스가 1.5배", () => {
  const play = (whos: string[]) => {
    let e = newExpedition("2026-11-02", 1, true, 0.001), coins = 0, big = 0;
    for (let i = 0; i < 60; i++) {
      const r = expedAdd(e, whos[i % whos.length], 0.01, `k${i % 8}`);
      e = r.e;
      coins += r.coins;
      big = Math.max(big, r.coins);
    }
    return { e, coins };
  };
  const both = play(["a", "b"]), solo = play(["a"]);
  assert.equal(both.e.done.length, 3);
  assert.ok(both.coins > solo.coins, "같이 간 맛");
  const again = expedAdd(both.e, "a", 1, "x");
  assert.equal(again.coins, 0, "다 채운 뒤엔 더 안 들어온다");
  assert.equal(both.e.by.a + both.e.by.b, 60);
});
test("원정 — 낚으면 게이지가 오르고, 쓰레기는 안 친다 · 하트는 낚시 하루 한도 밖이다", () => {
  let s = island();
  const f0 = fishingOf(s);
  s = { ...s, fishing: { ...f0, day: TODAY, dayCoins: 1500, exped: { ...newExpedition(weekOf(TODAY), 1, true, 0.001), count: 49 } } };
  const c = { ...rollCatch(SPOTS[0], 5, 0.4, 5, { bait: 0 }), cm: 5 };
  const r = sellCatch(s, c, TODAY, { who: "a", couple: true });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.exped?.includes("count"), true);
    assert.equal(r.coins, 0, "낚시 한도는 다 찼다");
    assert.ok(r.state.coins > s.coins, "원정 하트는 들어온다");
    assert.equal(fishingOf(r.state).exped?.by.a, 1);
  }
});
test("원정 — 지금 낚시터로 한 주에 채울 만한 무게다", () => {
  for (const level of [1, 3, 7, 12, 18, 25, 32]) {
    const open = SPOTS.filter((x) => x.minLevel <= level);
    const spot = open[Math.max(0, open.length - 2)];
    const e = expedFor({ level, exped: null }, TODAY, true);
    let kg = 0;
    for (let i = 0; i < e.need.count; i++) kg += kgOf(rollCatch(spot, 5, 0.4, i * 131 + 9, { bait: BAITS.findIndex((b) => poolFor(spot, b.maxGrade).length > 0) }).cm ?? 0);
    assert.ok(kg >= e.need.kg, `Lv.${level}: ${kg.toFixed(2)} < ${e.need.kg}`);
    assert.ok(kg < e.need.kg * 60, `Lv.${level}: 너무 쉽다 ${kg.toFixed(2)} / ${e.need.kg}`);
  }
});

test("버그 — 낚시터는 한 함수가 정하고, 연출도 그걸 본다", () => {
  const f = fishingOf({ fishing: { level: 12 } as never });
  assert.equal(currentSpot(f, "brook", TODAY).key, "brook");
  assert.equal(currentSpot(f, "starsea", TODAY).key, currentSpot(f, null, TODAY).key, "못 가는 곳을 골라 두면 기본값");
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /place = currentSpot\(cur, spotPick/);
  assert.match(src, /const spot = currentSpot\(fs, spotPick, today\)/);
  assert.match(src, /setSpotPick\(spot\.key\);/);
});
test("버그 — 판의 저장은 줄을 선다 · 확인창 동안 판이 멈춘다 · 쓰레기엔 피버가 없다 · 카드 버튼의 Enter 를 삼키지 않는다", () => {
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /spendBait\(s, sp, m, key, kstDate\(t\), castM\), true\)/);
  assert.match(src, /haulJunk\(s, c, kstDate\(t\)\), true\)/);
  assert.match(src, /if \(pausedRef\.current\) return;/);
  assert.match(src, /if \(pausedRef\.current\) timers\.current\.push/);
  assert.match(src, /if \(fishRef\.current\?\.junk\) return false;\s+const dry/, "쓰레기엔 피버가 없다 — 모든 방식이 feverRoll 한 곳을 지난다");
  assert.equal(src.split("rollFever(").length - 1, 1, "뽑기는 한 곳");
  assert.match(src, /e\.target !== e\.currentTarget/);
  assert.match(src, /setInterval\(\(\) => setToday\(kstDate\(clock\(\)\)\), 60_000\)/);
  assert.doesNotMatch(src, /confirmDialog\(\{/, "확인창은 ask 로만 — 판을 멈춘다");
});

test("크기 혜택 — 내 기록을 넘기면 하트와 경험치 1.5배 · 첫 기록엔 없다 · 하루 한도 밖 · 주인은 기록이 아니다", () => {
  const fish = (cm: number) => ({ ...rollCatch(SPOTS[0], 5, 0.4, 5, { bait: 0 }), cm });
  const by = { who: "a", couple: false };
  const first = sellCatch(island(), fish(5), TODAY, by);
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.equal(first.sizeCoins, 0);
  const full = { ...first.state, fishing: { ...fishingOf(first.state), day: TODAY, dayCoins: 1500 } };
  const bigger = sellCatch(full, fish(6), TODAY, by);
  assert.ok(bigger.ok);
  if (!bigger.ok) return;
  const c = fish(6);
  assert.equal(bigger.sizeCoins, recordCoins(c.difficulty));
  assert.ok(bigger.state.coins >= full.coins + recordCoins(c.difficulty), "한도가 차도 기록 하트는 들어온다");
  const smaller = sellCatch(bigger.state, fish(5.5), TODAY, by);
  if (smaller.ok) assert.equal(smaller.sizeCoins, 0);
  const b = sellCatch(island(), bossCatch(BOSSES[0]), TODAY, by);
  if (b.ok) assert.deepEqual(fishingOf(b.state).sizes, {});
});
test("판매가 — 가장 싼 물고기도 미끼값의 두 배 넘게 받는다", () => {
  for (let i = 0; i < BAITS.length; i++) assert.ok(coinValue(Math.max(0, BAITS[i].maxGrade - 1)) >= (BAITS[i].price / BAITS[i].uses) * (i < 2 ? 2 : 0.9), BAITS[i].key);
});
test("소리는 전부 지웠다 · 커플 순위는 화면에 없다 · 크기 순위는 종류별 · 방문자 수는 서버가 가린다", () => {
  for (const f of ["src/components/FishingGame.tsx", "src/components/FishFever.tsx", "src/components/MergeGame.tsx", "src/components/AquariumGame.tsx", "src/components/GameHead.tsx"]) assert.doesNotMatch(code(f), /gamesound|sfx\(|SoundToggle/, f);
  const rank = code("src/components/FishRank.tsx");
  assert.doesNotMatch(rank, /setScope|커플/);
  assert.match(rank, /getFishSizeBoard\(family\)/);
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261103010000_daily_visits.sql"), "utf8");
  assert.match(sql, /revoke all on function public\.today_visitors\(\) from public, anon/);
  assert.doesNotMatch(sql + code("src/components/HomeWorld.tsx") + code("src/lib/visits.ts"), /naver\.com/, "공개 레포에 이메일을 적지 않는다");
});
test("결과 카드 — 두 버튼이 떨어져 있고 터치 면이 안 겹친다 · 누른 쪽이 밝아진다", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  assert.match(css, /\.fish-choice \.tap::after \{ display: none; \}/);
  assert.match(css, /\.fish-choice \{[^}]*gap: 14px/);
  assert.match(code("src/components/FishingGame.tsx"), /picked-\$\{picked\}/);
});

test("몸집 — 실제로 큰 물고기가 크고, 자랄수록 커지고, 수조를 넘지 않는다", () => {
  const big = familyOf("whale_shark")!.size, small = familyOf("guppy")!.size;
  assert.ok(fishLength(big, 2) >= fishLength(small, 2) * 3.5, "고래상어는 구피의 3.5배 이상");
  assert.ok(fishLength(big, 2) <= 5.2, "수조 폭의 절반 안");
  for (const f of SPOTS.flatMap((s) => s.pool.map(([k]) => familyOf(k)!))) {
    assert.ok(fishLength(f.size, 0) < fishLength(f.size, 1) && fishLength(f.size, 1) < fishLength(f.size, 2), f.key);
    assert.ok(fishLength(f.size, 2, true) > fishLength(f.size, 2), "주인은 더 크다");
    assert.ok(fishLength(f.size, 0) >= 0.4, `${f.key} 치어를 집을 수 있어야 한다`);
  }
  assert.ok(fishLength(familyOf("koi")!.size, 2) > fishLength(familyOf("goldfish")!.size, 2));
  assert.match(code("src/lib/aqua3d/scene.ts"), /length=fishLength\(/);
});

test("모든 어종 — 69종이 도감에 있고, 낚시터에서 실제로 잡히고, 상어 · 횟감이 빠지지 않는다", () => {
  assert.equal(ALL_SPECIES.length, 69);
  for (const k of ["nurse_shark", "leopard_shark", "blue_shark", "hammerhead", "great_white", "megamouth", "flounder", "rockfish", "sea_bream", "sea_bass", "salmon", "yellowtail", "croaker", "striped_jack"]) {
    assert.ok(speciesOf(k), k);
    assert.ok(SPOTS.some((s) => s.pool.some(([f]) => f === k)), k);
  }
  const seen = new Set<string>();
  for (const spot of SPOTS) for (let i = 0; i < 12000; i++) seen.add(rollCatch(spot, 20, 0.6, i * 97 + 3, { bait: BAITS.length - 1 }).family);
  for (const s of SPOTS) for (const [k] of s.pool) assert.ok(seen.has(k), `${k} 가 안 잡힌다`);
  assert.doesNotMatch(code("src/components/FishRank.tsx"), /SPOTS/);
});

test("모델 하나 = 물고기 하나 — 135폼이 도감에 있고, 낚시로 전부 만날 수 있다", () => {
  assert.equal(ALL_FORMS.length, 135);
  assert.equal(new Set(ALL_FORMS.map((x) => x.key)).size, 135);
  for (const f of ALL_FORMS) if (f.family !== "sea_turtle") assert.ok(FISH_GLB.has(f.key), f.key);
  const seen = new Set<string>();
  const times = ["dawn", "day", "dusk", "night"] as const, wxs = ["rain", "snow", "clear", null] as const;
  for (const spot of SPOTS) for (const time of times) for (const wx of wxs) for (let i = 0; i < 2500; i++) {
    seen.add(catchArt(rollCatch(spot, 40, 1, i * 113 + 7, { bait: BAITS.length - 1, method: "lure", when: { time, wx } })));
    seen.add(catchArt(rollCatch(spot, 1, 0.4, i * 113 + 7, { bait: BAITS.length - 1, when: { time, wx } })));
  }
  const missing = ALL_FORMS.filter((x) => !seen.has(x.key)).map((x) => x.key);
  assert.deepEqual(missing, [], "낚시로 못 만나는 모습");
});
test("다 큰 모습이 예전보다 자주 온다 · 첫 낚시터부터 네 계열 — 그래도 치어가 가장 많다", () => {
  let adult = 0, fry = 0;
  const fams = new Set<string>();
  for (let i = 0; i < 6000; i++) {
    const c = rollCatch(SPOTS[0], 1, 0.4, i * 89 + 3, { bait: 0 });
    fams.add(c.family);
    if (c.stage === 2) adult++;
    if (c.stage === 0) fry++;
  }
  assert.ok(adult / 6000 > 0.05 && adult / 6000 < 0.14, String(adult / 6000));
  assert.ok(fry > adult * 4);
  assert.equal(fams.size, 4);
});
test("피버 — 오래 안 나오면 꼭 나온다 · 평소엔 3%", () => {
  assert.equal(rollFever(0.5, FEVER_PITY - 1), false);
  assert.equal(rollFever(0.5, FEVER_PITY), true);
  assert.equal(rollFever(0.02), true);
  assert.equal(rollFever(0.04), false);
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /logDebug\("fever_start"/);
});
test("미끼 — 낚시 화면이 실제 미끼 그림을 쓴다", () => {
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /fish-loadout-icon"><BaitIcon k=\{bait\.key\}/);
  assert.match(src, /bait: currentBait\(/);
  assert.match(code("src/lib/fishingfx.ts"), /this\.drawBait\(c, this\.hang\.x/);
});
