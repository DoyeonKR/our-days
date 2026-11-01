// 낚시 lock. [사용자 2026-11-02 "낚시에 성공한 물고기들만 수조에 보관 … 포획 능력치에 따라 확률로 보관 … 낚시 게임을 메인으로"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES, GRADES, TANKS, aquaOf } from "./aquarium.ts";
import {
  DAILY_FISH_COINS, GREEN_HIGH, NETS, RODS, SPOTS, buyNet, buyRod, captureChance, castBonus, coinValue, effectiveStats, fightQuality, fightTune, fishingOf,
  hookWindowMs, rollCatch, sellCatch, spendPoint, startFight, stepFight, storeBlock, tryStore, waitPlan, xpNeed,
  type Fight, type FishCatch,
} from "./fishing.ts";
import { FISHING_IMAGE_KEYS } from "./fishingimages.ts";
import { createIsland, type IslandState } from "./island.ts";

const root = process.cwd();
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, 0), coins });
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
const DAY = "2026-11-02";

/** 사람처럼 하는 자동 플레이 — 차고 나가거나 빨간 칸에 가까우면 떼고, 낮아지면 다시 누른다 */
function play(d: number, power: number, line: number, seed: number, policy?: (f: Fight) => boolean): Fight {
  const tune = fightTune(d, { power, line });
  let f = startFight(seed, tune);
  let hold = true;
  const human = (x: Fight) => {
    if (x.surgeLeft > 0 || x.tension > GREEN_HIGH + 0.05) hold = false;
    else if (x.tension < 0.45) hold = true;
    return hold;
  };
  for (let i = 0; i < 4000 && f.status === "on"; i++) f = stepFight(f, 0.033, (policy ?? human)(f), tune);
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

test("난이도 — 시작 장비로 첫 물고기는 잘 잡히고, 전설 이상은 어렵다 · 좋은 장비면 잡을 수 있다", () => {
  assert.ok(winRate(0, 1, 1) > 0.85, `개울 물고기: ${winRate(0, 1, 1)}`);
  const top = GRADES.length - 1 + 0.5 * 2;
  assert.ok(winRate(top, 1, 1) < 0.4, `시작 장비로 태초: ${winRate(top, 1, 1)}`);
  assert.ok(winRate(top, 65, 65) > 0.45, `최고 장비로 태초: ${winRate(top, 65, 65)}`);
  assert.ok(winRate(4, 20, 20) > winRate(4, 1, 1), "장비가 체감된다");
});

test("한 판 길이 — 첫 물고기는 10초 안팎, 최고 등급도 지루하지 않게", () => {
  const easy = play(0, 1, 1, 3);
  assert.ok(easy.t > 6 && easy.t < 30, `쉬움 ${easy.t}`);
  const hard = play(7, 65, 65, 3);
  assert.ok(hard.t < 60, `어려움 ${hard.t}`);
});

test("같은 입력이면 같은 결과 · 뽑기도 seed 로만", () => {
  assert.deepEqual(play(3, 9, 9, 42), play(3, 9, 9, 42));
  assert.deepEqual(rollCatch(SPOTS[2], 10, 1, 77), rollCatch(SPOTS[2], 10, 1, 77));
  assert.deepEqual(waitPlan(9), waitPlan(9));
  const src = readFileSync(join(root, "src/lib/fishing.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /Math\.random/);
});

test("낚시터 — 모든 계열이 어딘가에서 잡힌다 · 표에 있는 계열만 · 레벨이 오를수록 열린다", () => {
  const pooled = new Set(SPOTS.flatMap((x) => x.pool.map(([k]) => k)));
  for (const f of FAMILIES) assert.ok(pooled.has(f.key), `${f.key} 는 잡을 곳이 없다`);
  for (const k of pooled) assert.ok(FAMILIES.some((f) => f.key === k), k);
  for (let i = 1; i < SPOTS.length; i++) assert.ok(SPOTS[i].minLevel > SPOTS[i - 1].minLevel);
});

test("대개 치어로 잡히고, 다 큰 놈은 드물다 · 행운과 캐스팅이 기울인다", () => {
  const count = (luck: number, cast: number) => {
    let adult = 0, fry = 0;
    for (let i = 0; i < 4000; i++) {
      const c = rollCatch(SPOTS[1], luck, cast, i * 131 + 7);
      if (c.stage === 2) { adult++; assert.ok(c.species); }
      if (c.stage === 0) fry++;
    }
    return { adult, fry };
  };
  const base = count(1, 0);
  assert.ok(base.fry > 2400, "치어가 대부분");
  assert.ok(base.adult < 240 && base.adult > 0, `다 큰 놈: ${base.adult}`);
  assert.ok(count(40, 1).adult > base.adult * 2, "행운이 체감된다");
  assert.deepEqual([castBonus(0.2), castBonus(0.6), castBonus(0.85), castBonus(1)], [0, 0.5, 1, 0.5]);
});

test("입질 창 — 큰 놈일수록 짧지만 누를 수 있는 길이", () => {
  assert.ok(hookWindowMs(0, 1) > hookWindowMs(8, 1));
  assert.ok(hookWindowMs(9, 1) >= 380);
});

test("포획 확률 — 낚시에 성공해도 능력치에 달렸다 · 5~95% · 포획이 높을수록, 등급이 낮을수록 잘 담긴다", () => {
  assert.ok(captureChance(1, 0, 0, false) < 0.75 && captureChance(1, 0, 0, false) > 0.4, "첫 물고기는 반쯤");
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

test("하트 벌이엔 하루 상한 · 다음 날 풀린다 — 낚시는 공짜라 상한이 없으면 하트 경제가 끝난다", () => {
  const big: FishCatch = { family: "astral", stage: 2, species: "genesis_fish", grade: "태초", difficulty: 8 };
  let st = rich(0);
  for (let i = 0; i < 6; i++) {
    const r = sellCatch(st, big, DAY);
    if (r.ok) st = r.state;
  }
  assert.equal(st.coins, DAILY_FISH_COINS);
  const next = sellCatch(st, big, "2026-11-03");
  assert.ok(next.ok && next.coins > 0);
});

test("레벨 · 능력치 — 경험치로 오르고 점수를 나눠 쓴다 · 판을 낼 때마다 스킨처럼 기록이 안 사라진다", () => {
  let st = rich(0);
  assert.equal(spendPoint(st, "catch").ok, false, "점수가 없으면 못 올린다");
  for (let i = 0; i < 8; i++) {
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
  for (const k of [...SPOTS.map((x) => `spot_${x.key}`), ...RODS.map((x) => x.key), ...NETS.map((x) => x.key)]) assert.ok(doc.includes(`| \`${k}\` |`), k);
  for (const k of FISHING_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/fishing", `${k}.webp`)), k);
});

test("솜씨 값은 0~1", () => {
  const f = play(1, 5, 5, 8);
  assert.ok(fightQuality(f) >= 0 && fightQuality(f) <= 1);
});
