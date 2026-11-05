// 낚시 lock. [사용자 2026-11-02 "낚시에 성공한 물고기들만 수조에 보관 … 포획 능력치에 따라 확률로 보관 … 낚시 게임을 메인으로"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES, GRADES, TANKS, aquaOf, speciesOf } from "./aquarium.ts";
import { TIMED_FISH } from "./fishingworld.ts";
import {
  BAITS, FREE_WORMS, GREEN_HIGH, JUNKS, METHODS, NETS, RODS, SPOTS, baitStock, buyBait, buyNet, buyRod, captureChance, castBlock, coinValue, effectiveStats, fightQuality, fightTune, fishingOf,
  haulJunk, hookWindowMs, junkChance, junksAt, poolFor, rollCatch, sellCatch, spendBait, spendPoint, spotMinBait, startFight, stepFight, storeBlock, tryStore, waitPlan, xpNeed,
  type Fight, type FishCatch,
} from "./fishing.ts";
import { FISHING_IMAGE_KEYS } from "./fishingimages.ts";
import { createIsland, type IslandState } from "./island.ts";

const root = process.cwd();
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, 0), coins });
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
const DAY = "2026-11-02";

/** 사람처럼 하는 자동 플레이 — 0.28초 늦게 보고, 차고 나가면 떼고, 빨간 칸 전에 뗀다 */
function play(d: number, power: number, line: number, seed: number, policy?: (f: Fight) => boolean): Fight {
  const tune = fightTune(d, { power, line }, "guppy");
  let f = startFight(seed, tune);
  let hold = true;
  const seen: Fight[] = [];
  let noise = seed >>> 0;
  const human = () => {
    const x = seen[Math.max(0, seen.length - 9)];
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const err = (noise / 2 ** 32 - 0.5) * 0.15;
    const ev = x.surgeLeft > 0 || x.warnLeft > 0 ? x.event : null;
    if (ev === "surge") hold = false;
    else if (ev === "jump") hold = true;
    else if (x.tension > GREEN_HIGH - 0.06 + err) hold = false;
    else if (x.tension < 0.45 + err) hold = true;
    return hold;
  };
  for (let i = 0; i < 4000 && f.status === "on"; i++) {
    seen.push(f);
    f = stepFight(f, 0.033, policy ? policy(f) : human(), tune);
  }
  return f;
}
const winRate = (d: number, power: number, line: number, n = 200) => {
  let w = 0;
  for (let i = 0; i < n; i++) if (play(d, power, line, i * 97 + 1).status === "landed") w++;
  return w / n;
};

test("힘겨루기 — 계속 누르면 줄이 끊어지고, 아예 안 누르면 바늘이 빠진다, 조절해야 잡힌다", () => {
  assert.equal(play(0, 1, 1, 5, () => true).status, "snapped");
  assert.equal(play(0, 1, 1, 5, () => false).status, "slack");
  assert.equal(play(0, 1, 1, 5).status, "landed");
});

test("난이도 — 예전 기준으로 되돌렸다[사용자: 너무 어려워졌어] · 시작 장비로 흔함 · 보통은 잘 잡히고, 전설 이상은 어렵다 · 좋은 장비면 잡을 수 있다", () => {
  assert.ok(winRate(0, 1, 1) > 0.9, `흔함 ${winRate(0, 1, 1)}`);
  assert.ok(winRate(1, 1, 1) > 0.8, `보통 ${winRate(1, 1, 1)}`);
  const top = GRADES.length - 1 + 0.5 * 2;
  assert.ok(winRate(top, 1, 1) < 0.4, `시작 장비로 태초: ${winRate(top, 1, 1)}`);
  assert.ok(winRate(top, 65, 65) > 0.45, `최고 장비로 태초: ${winRate(top, 65, 65)}`);
  assert.ok(winRate(4, 20, 20) >= winRate(4, 1, 1), "장비가 체감된다");
});

test("변형은 조금만 — 예고 뒤에 차고 나가고, 뛰어오를 때 감으면 더 빠르지만 떼도 놓치지 않는다", () => {
  const tune = fightTune(3, { power: 1, line: 1 });
  let s: Fight = { ...startFight(1, tune), event: "surge", surgeLeft: 1, tension: 0.6 };
  for (let i = 0; i < 40 && s.status === "on"; i++) s = stepFight(s, 0.033, true, tune);
  assert.equal(s.status, "snapped", "차고 나갈 때 쥐고 있으면 끊어진다");
  const at: Fight = { ...startFight(1, tune), event: "jump", surgeLeft: 0.8, tension: 0.5 };
  let off = at, on = at;
  for (let i = 0; i < 24; i++) { off = stepFight(off, 0.033, false, tune); on = stepFight(on, 0.033, true, tune); }
  assert.equal(off.status, "on", "뛰어오를 때 떼도 안 놓친다");
  assert.ok(on.dist < off.dist, "감으면 더 들어온다");
  assert.ok(tune.warn > 0.2, "예고가 있다");
});

test("한 판 길이 — 첫 물고기는 10초 안팎, 최고 등급도 지루하지 않게", () => {
  const easy = play(0, 1, 1, 3);
  assert.ok(easy.t > 6 && easy.t < 40, `쉬움 ${easy.t}`);
  const hard = play(7, 65, 65, 3);
  assert.ok(hard.t < 60, `어려움 ${hard.t}`);
});

test("같은 입력이면 같은 결과 · 뽑기도 seed 로만", () => {
  assert.deepEqual(play(3, 9, 9, 42), play(3, 9, 9, 42));
  assert.deepEqual(rollCatch(SPOTS.find((x) => x.key === "seomjin")!, 10, 1, 77), rollCatch(SPOTS.find((x) => x.key === "seomjin")!, 10, 1, 77));
  assert.deepEqual(waitPlan(9), waitPlan(9));
  const src = readFileSync(join(root, "src/lib/fishing.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /Math\.random/);
});

test("낚시터 — 모든 계열이 어딘가에서 잡힌다 · 표에 있는 계열만 · 레벨이 오를수록 열린다", () => {
  const pooled = new Set(SPOTS.flatMap((x) => x.pool.map(([k]) => k)));
  const guests = new Set(TIMED_FISH.map((t) => FAMILIES.find((f) => f.finals.some((x) => x.key === t.species))?.key));
  for (const f of FAMILIES) assert.ok(pooled.has(f.key) || guests.has(f.key), `${f.key} 는 잡을 곳이 없다`);
  for (const k of pooled) assert.ok(FAMILIES.some((f) => f.key === k), k);
  for (let i = 1; i < SPOTS.length; i++) assert.ok(SPOTS[i].minLevel > SPOTS[i - 1].minLevel);
});

test("대개 치어로 잡히고, 다 큰 놈은 드물다 · 행운과 캐스팅이 기울인다", () => {
  const count = (luck: number, cast: number) => {
    let adult = 0, fry = 0;
    for (let i = 0; i < 4000; i++) {
      const c = rollCatch(SPOTS.find((x) => x.key === "pond")!, luck, cast, i * 131 + 7);
      if (c.stage === 2) { adult++; assert.ok(c.species); }
      if (c.stage === 0) fry++;
    }
    return { adult, fry };
  };
  const base = count(1, 0);
  assert.ok(base.fry > 2400, "치어가 대부분");
  assert.ok(base.adult < 480 && base.adult > 0, `다 큰 놈: ${base.adult}`);
  assert.ok(count(40, 1).adult > base.adult * 2, "행운이 체감된다");
});

test("입질 창 — 큰 놈일수록 짧지만 누를 수 있는 길이", () => {
  assert.ok(hookWindowMs(0, 1) > hookWindowMs(8, 1));
  assert.ok(hookWindowMs(9, 1) >= 380);
});

test("포획 확률 — 낚시에 성공해도 능력치에 달렸다 · 5~95% · 포획이 높을수록, 등급이 낮을수록 잘 담긴다", () => {
  assert.ok(captureChance(1, 0, 0, false) < 0.75 && captureChance(1, 0, 0, false) > 0.5, "첫 물고기는 반 넘게");
  assert.equal(captureChance(1, 8, 0, false), 0.05, "시작 뜰채로 태초는 거의 불가능");
  assert.ok(captureChance(70, 8, 1, true) > 0.5, "최고 능력치면 해볼 만하다");
  assert.ok(captureChance(30, 3, 0, false) > captureChance(10, 3, 0, false));
  assert.ok(captureChance(10, 3, 1, true) > captureChance(10, 3, 0, false), "솜씨도 조금 듣는다");
  assert.ok(captureChance(999, 0, 1, true) <= 0.95);
});

test("보관 — 확률을 넘으면 수조로, 못 넘으면 빠져나가고 하트 절반 · 팔면 하트 전부", () => {
  const won = tryStore(rich(0), guppy, 0.5, 0.49, 1000, DAY);
  assert.ok(won.ok && won.outcome === "stored");
  if (!won.ok) return;
  assert.equal(aquaOf(won.state).fish.length, 1);
  assert.equal(aquaOf(won.state).fish[0].family, "guppy");
  assert.equal(won.state.coins, 0);
  assert.equal(fishingOf(won.state).stored, 1);
  const lost = tryStore(rich(0), guppy, 0.5, 0.5, 1000, DAY);
  assert.ok(lost.ok && lost.outcome === "slipped");
  if (!lost.ok) return;
  assert.equal(aquaOf(lost.state).fish.length, 0);
  assert.equal(lost.state.coins, Math.round(coinValue(0) / 2));
  const sold = sellCatch(rich(0), guppy, DAY);
  assert.ok(sold.ok);
  if (sold.ok) assert.equal(sold.state.coins, coinValue(0));
});

test("다 큰 물고기를 담으면 바로 도감에 오른다 · 어린 물고기는 그만큼 자란 채로", () => {
  const adult: FishCatch = { family: "guppy", stage: 2, species: "tuxedo_guppy", grade: "보통", difficulty: 2 };
  const r = tryStore(rich(0), adult, 1, 0, 5, DAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  const a = aquaOf(r.state);
  assert.equal(a.fish[0].stage, 2);
  assert.ok(a.dex.includes("tuxedo_guppy"));
  const j = tryStore(rich(0), { family: "guppy", stage: 1, grade: "흔함", difficulty: 0.5 }, 1, 0, 5, DAY);
  assert.ok(j.ok && aquaOf(j.state).fish[0].growH > 0);
});

test("수조가 가득 찼거나 수조가 작으면 담을 수 없다(이유를 말한다) — 팔기는 된다 · 수조를 넓히면 담긴다", () => {
  let st = rich(0);
  for (let i = 0; i < TANKS[0].fish; i++) {
    const r = tryStore(st, guppy, 1, 0, 1, DAY);
    assert.ok(r.ok);
    if (r.ok) st = r.state;
  }
  assert.match(storeBlock(st, guppy) ?? "", /가득/);
  assert.equal(tryStore(st, guppy, 1, 0, 1, DAY).ok, false);
  assert.ok(sellCatch(st, guppy, DAY).ok);
  assert.match(storeBlock(rich(0), { family: "astral" }) ?? "", /용궁 수조/);
});

test("하트 벌이엔 하루 상한이 없다 — 판 만큼 다 받는다", () => {
  const big: FishCatch = { family: "astral", stage: 2, species: "genesis_fish", grade: "태초", difficulty: 8 };
  let st = rich(0);
  for (let i = 0; i < 6; i++) {
    const r = sellCatch(st, big, DAY);
    if (r.ok) st = r.state;
  }
  assert.equal(st.coins, coinValue(big.difficulty) * 6);
});

test("레벨 · 능력치 — 경험치로 오르고 점수를 나눠 쓴다 · 판을 낼 때마다 스킨처럼 기록이 안 사라진다", () => {
  let st = rich(0);
  assert.equal(spendPoint(st, "catch").ok, false, "점수가 없으면 못 올린다");
  // 2026-11-05 레벨 곡선을 바꿔 첫 레벨은 첫 낚시터에서 스무 번쯤 — 치어 구피(경험치 10) 스물다섯 마리면 넘는다
  for (let i = 0; i < 25; i++) {
    const r = sellCatch(st, guppy, DAY);
    if (r.ok) st = r.state;
  }
  const f = fishingOf(st);
  assert.ok(f.level >= 2 && f.points >= 2, `레벨 ${f.level}`);
  assert.ok(f.xp < xpNeed(f.level));
  const up = spendPoint(st, "catch");
  assert.ok(up.ok);
  if (up.ok) assert.equal(fishingOf(up.state).stats.catch, 2);
});

test("장비 — 하트로 한 단계씩 · 능력치에 더해진다 · 값은 오르기만", () => {
  assert.equal(buyRod(rich(RODS[1].price - 1)).ok, false);
  const r = buyRod(rich(RODS[1].price));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.coins, 0);
  assert.equal(effectiveStats(fishingOf(r.state)).power, 1 + RODS[1].power);
  const n = buyNet(rich(NETS[1].price));
  assert.ok(n.ok && effectiveStats(fishingOf(n.state)).catch === 1 + NETS[1].catch);
  for (const list of [RODS, NETS]) for (let i = 1; i < list.length; i++) assert.ok(list[i].price > list[i - 1].price);
  assert.deepEqual(fishingOf({ fishing: undefined }).stats, { catch: 1, power: 1, line: 1, luck: 1 }, "옛 저장분도 돈다");
});

test("수조엔 낚시로만 들어온다 — 치어 가게가 돌아오면 안 된다 · 게임 탭 첫 카드는 낚시", () => {
  const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code("src/lib/aquarium.ts"), /buyFry/);
  assert.doesNotMatch(code("src/components/AquariumGame.tsx"), /치어 가게/);
  const arcade = code("src/components/GameArcade.tsx");
  assert.ok(arcade.indexOf("game-mode-fish") < arcade.indexOf("game-mode-island"), "낚시가 메인(맨 위)");
  assert.ok(arcade.includes("<FishingGame"));
  const shop = code("src/components/FishingGame.tsx");
  assert.ok(shop.includes("tryStore(") && shop.includes("captureChance("), "화면이 엔진 판정을 쓴다");
});

test("그림 문서 · 파일 — 표의 낚시터 · 장비가 빠짐없이 있다", () => {
  const doc = readFileSync(join(root, "design/FISHING-ART.md"), "utf8");
  for (const k of [...SPOTS.map((x) => `spot_${x.key}`), ...RODS.map((x) => x.key), ...NETS.map((x) => x.key), ...BAITS.map((x) => x.key), ...JUNKS.map((x) => x.key)]) assert.ok(doc.includes(`| \`${k}\` |`), k);
  for (const k of FISHING_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/fishing", `${k}.webp`)), k);
});

test("미끼 — 높을수록 횟수 · 값 · 상한이 모두 오른다 · 상한을 넘는 물고기는 절대 안 문다", () => {
  for (let i = 1; i < BAITS.length; i++) {
    assert.ok(BAITS[i].uses > BAITS[i - 1].uses, "횟수");
    assert.ok(BAITS[i].price > BAITS[i - 1].price, "값");
    assert.equal(BAITS[i].maxGrade, BAITS[i - 1].maxGrade + 1, "상한");
  }
  assert.equal(BAITS[BAITS.length - 1].maxGrade, GRADES.length - 1, "맨 위 미끼는 태초까지");
  for (const spot of SPOTS) for (let b = 0; b < BAITS.length; b++) {
    if (!poolFor(spot, BAITS[b].maxGrade).length) continue;
    for (let i = 0; i < 400; i++) {
      const c = rollCatch(spot, 40, 1, i * 37 + 1, { bait: b, method: "lure" });
      assert.ok(GRADES.indexOf(c.grade) <= BAITS[b].maxGrade, `${spot.key} ${BAITS[b].key} → ${c.grade}`);
    }
  }
});

test("미끼가 좋을수록 잡히는 등급의 평균이 오른다 — 같은 낚시터 · 같은 행운에서", () => {
  const avg = (spot: (typeof SPOTS)[number], b: number) => {
    let n = 0;
    for (let i = 0; i < 3000; i++) n += GRADES.indexOf(rollCatch(spot, 5, 0.5, i * 53 + 9, { bait: b }).grade);
    return n / 3000;
  };
  for (const spot of [SPOTS.find((x) => x.key === "brook")!, SPOTS.find((x) => x.key === "pond")!, SPOTS.find((x) => x.key === "seomjin")!]) {
    const first = BAITS.findIndex((b) => poolFor(spot, b.maxGrade).length > 0);
    assert.ok(avg(spot, BAITS.length - 1) > avg(spot, first) + 0.02, spot.key);
    for (let b = first + 1; b < BAITS.length; b++) assert.ok(avg(spot, b) >= avg(spot, b - 1) - 0.02, `${spot.key} ${b}`);
  }
});

test("모든 낚시터가 어떤 미끼로든 낚인다 · 지렁이로 시작 낚시터가 된다 · 태초 등급은 맨 위 미끼로만", () => {
  for (const spot of SPOTS) assert.ok(poolFor(spot, spotMinBait(spot).maxGrade).length > 0, spot.key);
  assert.equal(spotMinBait(SPOTS.find((x) => x.key === "brook")!).key, BAITS[0].key);
  const top = (b: number) => {
    let hit = 0;
    for (let i = 0; i < 6000; i++) if (rollCatch(SPOTS.find((s) => s.key === "palace")!, 40, 1, i * 3 + 1, { bait: b, method: "lure" }).grade === "태초") hit++;
    return hit;
  };
  assert.equal(top(BAITS.length - 2), 0);
  assert.ok(top(BAITS.length - 1) > 0);
});

test("미끼 쓰기 — 던지면 줄고, 없으면 못 던지고, 지렁이는 다음 날 채워지고, 심해는 2개", () => {
  const st = rich(0);
  assert.equal(baitStock(fishingOf(st), BAITS[0].key, DAY), FREE_WORMS, "처음 온 날 지렁이");
  const one = spendBait(st, SPOTS.find((x) => x.key === "brook")!, "float", BAITS[0].key, DAY);
  assert.ok(one.ok);
  if (!one.ok) return;
  assert.equal(baitStock(fishingOf(one.state), BAITS[0].key, DAY), FREE_WORMS - 1);
  assert.equal(baitStock(fishingOf(one.state), BAITS[0].key, "2026-11-03"), FREE_WORMS, "다음 날");
  assert.match(castBlock(fishingOf(st), SPOTS.find((x) => x.key === "brook")!, "float", BAITS[1].key, DAY) ?? "", /떨어졌/);
  assert.match(castBlock(fishingOf(st), SPOTS.find((x) => x.key === "reef")!, "float", BAITS[0].key, DAY) ?? "", /부터 물어요/);
  assert.match(castBlock(fishingOf(st), SPOTS.find((x) => x.key === "brook")!, "deep", BAITS[0].key, DAY) ?? "", /Lv/);
  const lv = { ...fishingOf(st), level: 9, baits: { [BAITS[1].key]: 1 }, wormDay: DAY };
  assert.match(castBlock(lv, SPOTS.find((x) => x.key === "brook")!, "deep", BAITS[1].key, DAY) ?? "", /2개/);
  const deep = spendBait({ ...st, fishing: { ...lv, baits: { [BAITS[1].key]: 5 } } }, SPOTS.find((x) => x.key === "brook")!, "deep", BAITS[1].key, DAY);
  assert.ok(deep.ok && fishingOf(deep.state).baits[BAITS[1].key] === 3);
});

test("미끼 사기 — 하트만큼 · 묶음 횟수만큼 · 사면서 오늘 지렁이가 사라지지 않는다", () => {
  assert.equal(buyBait(rich(BAITS[2].price - 1), BAITS[2].key, DAY).ok, false);
  const r = buyBait(rich(BAITS[2].price), BAITS[2].key, DAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.coins, 0);
  assert.equal(baitStock(fishingOf(r.state), BAITS[2].key, DAY), BAITS[2].uses);
  assert.equal(baitStock(fishingOf(r.state), BAITS[0].key, DAY), FREE_WORMS);
});

test("방식 — 넷이고 잠금이 도달 가능한 레벨이다 · 루어는 다 큰 물고기 · 뜰채는 수면(다 큰 놈 없음) · 심해는 귀한 쪽", () => {
  assert.equal(METHODS.length, 4);
  for (const m of METHODS) assert.ok(m.minLevel <= 5, m.key);
  const stats = (method: "float" | "lure" | "scoop" | "deep") => {
    let adult = 0, rare = 0;
    for (let i = 0; i < 5000; i++) {
      const c = rollCatch(SPOTS.find((x) => x.key === "seomjin")!, 5, 0.5, i * 71 + 3, { bait: 6, method });
      if (c.stage === 2) adult++;
      if (c.family !== SPOTS.find((x) => x.key === "seomjin")!.pool[0][0]) rare++;
    }
    return { adult, rare };
  };
  const f = stats("float");
  assert.ok(stats("lure").adult > f.adult * 1.8);
  assert.equal(stats("scoop").adult, 0);
  assert.ok(stats("deep").rare > f.rare * 1.05);
  assert.ok(captureChance(10, 2, 0.5, false, "scoop") > captureChance(10, 2, 0.5, false, "float"));
});

test("꽝 — 가끔 걸린다(6~20%) · 종류가 많다 · 낚시터마다 거기서만 나오는 게 있다 · 다른 낚시터의 건 안 나온다", () => {
  assert.ok(JUNKS.length >= 12);
  assert.equal(new Set(JUNKS.map((j) => j.key)).size, JUNKS.length);
  for (const spot of SPOTS) {
    assert.ok(JUNKS.some((j) => j.spot === spot.key), `${spot.key} 전용 쓰레기`);
    let junk = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const c = rollCatch(spot, 1, 0.5, i * 89 + 5, { bait: 6, junk: true });
      if (c.junk) {
        junk++;
        seen.add(c.junk);
        assert.ok(junksAt(spot.key).some((j) => j.key === c.junk), c.junk);
      }
    }
    const rate = junk / 4000;
    assert.ok(rate > 0.06 && rate < 0.2, `${spot.key}: ${rate}`);
    assert.ok(seen.size >= 7, `${spot.key} 종류 ${seen.size}`);
  }
  assert.ok(junkChance(40) < junkChance(1), "행운이 줄인다");
  assert.ok(junkChance(1, "deep") > junkChance(1, "float"), "깊을수록 많다");
  assert.equal(rollCatch(SPOTS.find((x) => x.key === "brook")!, 1, 0, 11).junk, undefined, "옵션 없으면 물고기만");
});

test("꽝이 나와도 물고기 뽑기는 그대로 · 끌어올리기 전엔 물고기와 구분 안 된다 — 난이도 · 그림자 재료가 같다", () => {
  for (let i = 0; i < 2000; i++) {
    const a = rollCatch(SPOTS.find((x) => x.key === "pond")!, 3, 0.5, i * 41 + 1, { bait: 3 });
    const b = rollCatch(SPOTS.find((x) => x.key === "pond")!, 3, 0.5, i * 41 + 1, { bait: 3, junk: true });
    assert.equal(b.family, a.family);
    assert.equal(b.difficulty, a.difficulty);
  }
});

test("쓰레기 치우기 — 수집함에 쌓이고 처음이면 알려 준다 · 하트는 조금 · 수조에도 시장에도 못 간다", () => {
  const can: FishCatch = { ...guppy, junk: "junk_can" };
  const a = haulJunk(rich(0), can, DAY);
  assert.ok(a.ok && a.firstJunk === true && a.outcome === "junk");
  if (!a.ok) return;
  assert.equal(fishingOf(a.state).junk.junk_can, 1);
  assert.ok(a.state.coins > 0 && a.state.coins < coinValue(1));
  const b = haulJunk(a.state, can, DAY);
  assert.ok(b.ok && !b.firstJunk && fishingOf(b.state).junk.junk_can === 2);
  assert.equal(tryStore(rich(0), can, 1, 0, 1, DAY).ok, false);
  assert.equal(sellCatch(rich(0), can, DAY).ok, false);
  assert.equal(haulJunk(rich(0), guppy, DAY).ok, false);
  assert.ok(JUNKS.every((j) => j.coins <= 20), "꽝으로 돈을 벌면 안 된다");
});

test("옛 저장분(미끼 · 수집함 칸 없음)도 돈다", () => {
  const old = { level: 7, xp: 1, points: 0, stats: { catch: 2, power: 2, line: 2, luck: 2 }, rod: 1, net: 1, day: "", dayCoins: 0, landed: 5, stored: 2 } as unknown as IslandState["fishing"];
  const f = fishingOf({ fishing: old });
  assert.deepEqual(f.baits, {});
  assert.deepEqual(f.junk, {});
  assert.equal(baitStock(f, BAITS[0].key, DAY), FREE_WORMS);
  assert.ok(speciesOf("cobra_guppy"));
});

test("솜씨 값은 0~1", () => {
  const f = play(1, 5, 5, 8);
  assert.ok(fightQuality(f) >= 0 && fightQuality(f) <= 1);
});
