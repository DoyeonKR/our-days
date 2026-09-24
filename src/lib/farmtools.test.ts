// 농기구 창고(도구 5종 × 3단계) lock. [2026-09-24]
// [사용자: "정원 툴 들을 좀 개선해야되지 않겠어 ? 기능도 늘리고"]
//
// 예전 도구는 한 번 사면 끝인 스위치 둘(스프링클러 · 온실)이었다. 지금은 다섯 도구가 3단계씩 자란다:
// 스프링클러(물 이틀 → 늘 촉촉 → 더 빨리) · 온실(첫 줄 → 두 줄 → 전부) · 비료 살포기(한 번에 → 다섯 칸마다
// 하나 아낌 → 땅심) · 퇴비통(작물 3 → 비료 2, 통이 늘고 빨라짐) · 파종기(자동 다시 심기 → 할인 → 행운 두 배).
// 여기서 잠그는 것 — 옛 저장분 호환 · 단계 사다리와 잠금 이유 · 도구마다 **실제로 바뀌는 것** · 퇴비가 '선택'인지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPOST,
  CROPS,
  TOOLS,
  TUNING,
  buyTool,
  collectCompost,
  compostBins,
  compostCandidates,
  createIsland,
  cropStage,
  expandPlots,
  farmUnlocks,
  fertilizeAll,
  harvest,
  islandTodos,
  plant,
  plotUnderGlass,
  plotWet,
  replantPrice,
  setAutoReplant,
  skillXpFor,
  spreadPreview,
  startCompost,
  toolLevel,
  toolLockReason,
  waterPlot,
  type IslandState,
  type ToolKey,
} from "./island.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T = Date.UTC(2026, 3, 10, 3); // 2026-04-10 12:00 KST — 봄(당근 제철 · 토마토는 아님)
function fresh(skill = 20, coins = 1_000_000): IslandState {
  const s = createIsland("콩", null, T);
  s.coins = coins;
  s.farm.skillXp = skill <= 1 ? 0 : skillXpFor(skill);
  return s;
}
function up(s: IslandState, k: ToolKey, n: number): IslandState {
  let x = s;
  for (let i = 0; i < n; i++) x = buyTool(x, k, T);
  return x;
}
/** 다 자랄 때까지 기다린 시각 */
function ripeAt(s: IslandState, plotId: number, from: number): number {
  for (let t = from; t < from + 30 * DAY; t += HOUR) if (cropStage(s, s.farm.plots[plotId], t).ripe) return t;
  throw new Error("안 자란다");
}

test("옛 저장분 호환 — 스프링클러(boolean)=2단계(늘 촉촉) · 온실=3단계(모든 밭)", () => {
  const s = fresh();
  assert.equal(toolLevel(s, "sprinkler"), 0);
  s.farm.sprinkler = true;
  s.farm.greenhouse = true;
  assert.equal(toolLevel(s, "sprinkler"), 2);
  assert.equal(toolLevel(s, "greenhouse"), 3);
  assert.ok(plotWet(s, s.farm.plots[0], T), "옛 스프링클러인데 밭이 마른다");
  assert.ok(plotUnderGlass(s, 23), "옛 온실인데 온실 밖 칸이 있다");
});

test("단계 사다리 — 농사 레벨 · 코인 · 최고 단계가 잠금 이유가 되고, 잠기면 사지지 않는다", () => {
  const low = fresh(1);
  assert.match(toolLockReason(low, "greenhouse") ?? "", /^농사 Lv\.3 필요/);
  assert.equal(buyTool(low, "greenhouse", T), low, "잠겼는데 사졌다");
  const poor = fresh(20, 10);
  assert.match(toolLockReason(poor, "sprinkler") ?? "", /모자라요/);
  let s = fresh();
  const coins0 = s.coins;
  let spent = 0;
  for (const t of TOOLS) {
    for (let i = 0; i < t.levels.length; i++) {
      s = buyTool(s, t.key, T);
      spent += t.levels[i].price;
      assert.equal(toolLevel(s, t.key), i + 1);
    }
    assert.equal(toolLockReason(s, t.key), "최고 단계예요");
    assert.equal(buyTool(s, t.key, T), s, `${t.name}: 최고 단계 너머로 사진다`);
  }
  assert.equal(s.coins, coins0 - spent);
  // 모든 단계는 설치 순서대로 비싸진다 · 농사 레벨 조건도 올라간다
  for (const t of TOOLS) for (let i = 1; i < t.levels.length; i++) {
    assert.ok(t.levels[i].price > t.levels[i - 1].price, `${t.name} 가격`);
    assert.ok(t.levels[i].minSkill > t.levels[i - 1].minSkill, `${t.name} 레벨 조건`);
  }
});

test("옛 앱과 같은 화면 — 스프링클러 2단계 · 온실 3단계에 닿아야 옛 boolean 이 켜진다", () => {
  let s = up(fresh(), "sprinkler", 1);
  assert.equal(s.farm.sprinkler, false);
  s = up(s, "sprinkler", 1);
  assert.equal(s.farm.sprinkler, true);
  let g = up(fresh(), "greenhouse", 2);
  assert.equal(g.farm.greenhouse, false, "두 줄만 온실인데 옛 앱엔 전부 온실로 보인다");
  g = up(g, "greenhouse", 1);
  assert.equal(g.farm.greenhouse, true);
});

test("스프링클러 — 1단계 물이 이틀 · 3단계는 2단계보다 빨리 자란다", () => {
  const none = plant(fresh(), 0, "carrot", T);
  assert.ok(!plotWet(none, none.farm.plots[0], T + 36 * HOUR), "도구 없이도 물이 이틀 간다");
  const one = plant(up(fresh(), "sprinkler", 1), 0, "carrot", T);
  assert.ok(plotWet(one, one.farm.plots[0], T + 36 * HOUR), "1단계인데 하루 만에 마른다");
  assert.ok(!plotWet(one, one.farm.plots[0], T + 49 * HOUR), "1단계인데 이틀이 지나도 촉촉하다");
  const two = plant(up(fresh(), "sprinkler", 2), 0, "pumpkin", T);
  const three = plant(up(fresh(), "sprinkler", 3), 0, "pumpkin", T);
  const at = T + 10 * HOUR;
  assert.ok(cropStage(three, three.farm.plots[0], at).progress > cropStage(two, two.farm.plots[0], at).progress, "3단계가 더 빠르지 않다");
});

test("온실 — 1단계 첫 줄 · 2단계 두 줄 · 3단계 전부. 온실 칸의 철 지난 작물은 제철 속도로 자란다", () => {
  let s = up(fresh(), "greenhouse", 1);
  s = expandPlots(expandPlots(s)); // 8칸
  for (let i = 0; i < 8; i++) assert.equal(plotUnderGlass(s, i), i < 4, `1단계 ${i}번 칸`);
  const off = CROPS.find((c) => c.season === "summer" && !c.unique && c.growDays >= 1.5)!; // 봄엔 철이 아님
  s = plant(plant(s, 0, off.key, T), 4, off.key, T);
  const at = T + 12 * HOUR;
  assert.ok(cropStage(s, s.farm.plots[0], at).progress > cropStage(s, s.farm.plots[4], at).progress, "온실 칸이 안 빠르다");
  const two = up(s, "greenhouse", 1);
  for (let i = 0; i < 8; i++) assert.equal(plotUnderGlass(two, i), i < 8);
  assert.ok(plotUnderGlass(up(two, "greenhouse", 1), 23));
});

test("비료 살포기 — 모든 밭에 한 단계씩 · 2단계는 다섯 칸마다 하나 공짜 · 3단계(땅심)는 수확해도 안 준다", () => {
  let s = up(fresh(), "spreader", 1);
  s.farm.fert = 10;
  assert.deepEqual(spreadPreview(s), { plots: 4, fert: 4 });
  s = fertilizeAll(s, T);
  assert.ok(s.farm.plots.every((p) => p.fertStack === 1));
  assert.equal(s.farm.fert, 6);
  // 최대 단계 칸은 건너뛴다 · 비료가 없으면 아무 일도 없다
  s.farm.plots[0].fertStack = TUNING.farm.fertStackMax;
  assert.equal(spreadPreview(s).plots, 3);
  s.farm.fert = 0;
  assert.equal(fertilizeAll(s, T), s);

  let two = up(expandPlots(fresh()), "spreader", 2); // 6칸
  two.farm.fert = 10;
  two = fertilizeAll(two, T);
  assert.equal(two.farm.fert, 5, "6칸에 뿌렸는데 다섯째 칸이 공짜가 아니다");

  const harvestKeep = (lv: number) => {
    let x = lv ? up(fresh(), "spreader", lv) : fresh();
    x.farm.plots[0].fertStack = 2;
    x = plant(x, 0, "carrot", T);
    x = harvest(x, 0, ripeAt(x, 0, T), 0);
    return x.farm.plots[0].fertStack ?? 0;
  };
  assert.equal(harvestKeep(0), 1, "보통은 한 단계 준다");
  assert.equal(harvestKeep(3), 2, "땅심인데 비료가 줄었다");
});

test("퇴비통 — 작물 3개 → 시간이 지나면 비료 2개 · 단계 = 통 수 · 전설·생산 재료는 안 받는다", () => {
  let s = up(fresh(), "compost", 1);
  s.farm.barn = { carrot: { qty: 5, star: 2 }, watermelon: { qty: 3, star: 5 }, egg: { qty: 9, star: 3 } };
  const keys = compostCandidates(s).map((c) => c.key);
  assert.deepEqual(keys, ["carrot"], `넣을 수 있는 게 잘못됐다: ${keys}`);
  assert.equal(compostBins(s).length, 1);
  s = startCompost(s, 0, "carrot", T);
  assert.equal(s.farm.barn.carrot.qty, 2);
  assert.equal(startCompost(s, 0, "carrot", T), s, "쓰는 중인 통에 또 넣었다");
  assert.equal(collectCompost(s, 0, T + 5 * HOUR), s, "덜 된 퇴비를 받았다");
  const fert0 = s.farm.fert;
  s = collectCompost(s, 0, T + 6 * HOUR);
  assert.equal(s.farm.fert, fert0 + COMPOST.out);
  assert.equal(compostBins(s)[0].startAt, null);
  assert.equal(startCompost(s, 0, "carrot", T + 7 * HOUR), s, "2개뿐인데 넣었다");

  let three = up(fresh(), "compost", 3);
  assert.equal(compostBins(three).length, 3);
  // 3단계 — 넷 중 하나 꼴로 골드비료(결정적 rng 로 여러 번 돌려 실제로 나오는지)
  let golds = 0;
  three.farm.barn = { carrot: { qty: 300, star: 1 } };
  for (let i = 0; i < 60; i++) {
    const t0 = T + i * 5 * HOUR;
    three = startCompost(three, 0, "carrot", t0);
    const g0 = three.farm.gold;
    three = collectCompost(three, 0, t0 + 4 * HOUR);
    golds += three.farm.gold - g0;
  }
  assert.ok(golds > 5 && golds < 30, `골드비료 ${golds}/60 — 넷 중 하나 꼴이 아니다`);
});

test("퇴비는 '선택'이다 — 싼 작물은 퇴비가, 비싼 작물은 파는 게 낫다", () => {
  const fertValue = COMPOST.out * TUNING.farm.fertilizer;
  const normal = CROPS.filter((c) => !c.unique && !c.legendXp && !c.legendBond && !c.legendHeal);
  const cheapest = normal.reduce((a, b) => (b.sell < a.sell ? b : a));
  const priciest = normal.reduce((a, b) => (b.sell > a.sell ? b : a));
  assert.ok(cheapest.sell * COMPOST.need < fertValue, `${cheapest.name} 3개(${cheapest.sell * 3})가 비료 2개(${fertValue})보다 비싸다 — 퇴비할 이유가 없다`);
  assert.ok(priciest.sell * COMPOST.need > fertValue, `${priciest.name} 3개도 퇴비가 이득 — 전부 퇴비로 가면 선택이 아니다`);
});

test("파종기 — 거둔 칸에 다시 심는다(제철·전설 아님·코인) · 끄면 안 심는다 · 2단계 할인", () => {
  let s = up(fresh(), "seeder", 1);
  s = plant(s, 0, "carrot", T);
  const t1 = ripeAt(s, 0, T);
  s = harvest(s, 0, t1, 0);
  assert.equal(s.farm.plots[0].crop, "carrot", "다시 안 심었다");
  assert.equal(s.farm.plots[0].plantedAt, t1);

  // 철 지난 작물(온실 칸 아님)은 쉰다
  const off = CROPS.find((c) => c.season === "summer" && !c.unique && !c.regrow)!;
  let o = plant(up(fresh(), "seeder", 1), 0, off.key, T);
  o = harvest(o, 0, ripeAt(o, 0, T), 0);
  assert.equal(o.farm.plots[0].crop, null, "철 지난 작물을 다시 심었다");

  // 끄면 안 심는다
  let off2 = setAutoReplant(up(fresh(), "seeder", 1), false);
  off2 = plant(off2, 0, "carrot", T);
  off2 = harvest(off2, 0, ripeAt(off2, 0, T), 0);
  assert.equal(off2.farm.plots[0].crop, null);

  // 2단계 — 다시 심는 씨앗값 25% 할인(1단계는 그대로)
  const carrot = CROPS.find((c) => c.key === "carrot")!;
  assert.equal(replantPrice(up(fresh(), "seeder", 1), carrot), carrot.seed);
  assert.equal(replantPrice(up(fresh(), "seeder", 2), carrot), Math.round(carrot.seed * 0.75));
});

test("파종기 — 전설 작물은 사람이 고른다 · 다시 열리는 작물은 마지막 열매 뒤에만", () => {
  const legend = CROPS.find((c) => c.unique)!;
  let s = up(fresh(), "seeder", 1);
  s = up(s, "greenhouse", 3); // 제철 조건 제거
  s = plant(s, 0, legend.key, T);
  s = harvest(s, 0, ripeAt(s, 0, T), 0);
  assert.equal(s.farm.plots[0].crop, null, "전설을 자동으로 다시 심었다");

  const tree = CROPS.find((c) => c.regrow && c.season === "spring")!;
  let r = plant(up(fresh(), "seeder", 1), 0, tree.key, T);
  const coinsBeforeFirst = r.coins;
  let t = T;
  for (let i = 0; i < tree.regrow!.times; i++) {
    t = ripeAt(r, 0, t);
    r = harvest(r, 0, t, 0);
    assert.equal(r.farm.plots[0].crop, tree.key);
    assert.equal(r.farm.plots[0].cycle, i + 1, "다시 열리는 중에 새로 심었다");
  }
  assert.ok(r.coins > coinsBeforeFirst, "열매를 따는데 돈이 줄었다(씨앗값을 또 냈다)");
  t = ripeAt(r, 0, t);
  r = harvest(r, 0, t, 0);
  assert.equal(r.farm.plots[0].crop, tree.key, "마지막 열매 뒤에 다시 안 심었다");
  assert.equal(r.farm.plots[0].cycle ?? 0, 0, "새로 심은 나무인데 열매 횟수가 이어진다");
});

test("해금 목록 · 지금 할 일 — 도구 단계가 농사 레벨 판에 뜨고, 마른 밭·다 된 퇴비가 할 일이 된다", () => {
  const u = farmUnlocks();
  for (const t of TOOLS) for (const [i, lv] of t.levels.entries()) {
    if (lv.minSkill <= 1) continue;
    assert.ok(u.some((x) => x.level === lv.minSkill && x.label.includes(t.name) && x.label.includes(`${i + 1}단계`)), `${t.name} ${i + 1}단계가 해금 목록에 없다`);
  }
  const slow = CROPS.find((c) => !c.unique && c.growDays >= 2)!;
  let s = plant(fresh(), 0, slow.key, T);
  const dryAt = T + 25 * HOUR;
  const water = islandTodos(s, dryAt).find((x) => x.key === "water");
  assert.ok(water && water.go === "farm", "마른 밭이 할 일에 없다");
  s = waterPlot(s, 0, dryAt);
  assert.ok(!islandTodos(s, dryAt).some((x) => x.key === "water"), "물을 줬는데도 할 일에 남았다");

  let c = up(fresh(), "compost", 1);
  c.farm.barn = { carrot: { qty: 3, star: 1 } };
  c = startCompost(c, 0, "carrot", T);
  assert.ok(!islandTodos(c, T + HOUR).some((x) => x.key === "compost"));
  assert.ok(islandTodos(c, T + 7 * HOUR).some((x) => x.key === "compost" && x.go === "farm"));
  // 모든 할 일은 갈 곳이 있다
  for (const x of islandTodos(c, T + 7 * HOUR)) assert.ok(["pet", "farm", "craft", "decor", "more"].includes(x.go));
});

test("화면 — 농기구 창고가 모든 도구 액션을 부르고, 옛 한 번 사면 끝 버튼은 없다 · 지금 할 일 줄이 탭으로 보낸다", () => {
  const strip = (p: string) =>
    readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const game = strip("components/IslandGame.tsx");
  for (const fn of ["buyTool(x, k,", "fertilizeAll(x,", "startCompost(x,", "collectCompost(x,", "setAutoReplant(x,"]) assert.ok(game.includes(fn), `${fn} 를 부르는 곳이 없다`);
  assert.ok(!/TUNING\.farm\.(sprinkler|greenhouse)/.test(game), "옛 스프링클러·온실 가격 버튼이 남았다");
  assert.ok(game.includes("<ToolShed"), "농기구 창고가 안 그려진다");
  assert.match(game, /islandTodos\(s, now, myUserId\)[\s\S]{0,600}setTab\(t\.go\)/, "지금 할 일 줄이 탭으로 안 보낸다");
  assert.match(game, /plotUnderGlass\(s, i\)/, "온실 칸 표시가 없다");
  const shed = strip("components/island/ToolShed.tsx");
  assert.match(shed, /toolLockReason\(/, "잠금 판정을 화면에서 따로 한다");
});
