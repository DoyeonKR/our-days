// 농사 레벨이 어디서 오르고 무엇을 여는지 — lock. [2026-09-24]
// [사용자: "조리대 농사 레벨 농사 기능이 어디있는지도 안나와 있고"]
//
// 공방(조리대 칸·레시피)·씨앗 가게·전설 무기가 전부 "농사 Lv.N"을 요구하는데, 그 레벨이 정원에서
// 수확으로 오른다는 것도, 오르면 무엇이 열리는지도 어디에도 없었다. 해금 목록은 엔진 표에서 파생하고,
// 레벨을 요구하는 화면마다 정원으로 가는 길을 단다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CRAFT_SLOT_SKILLS,
  CROPS,
  GEARS,
  PRODUCTS,
  TUNING,
  craftSlots,
  createIsland,
  farmLevelProgress,
  farmSkill,
  farmUnlocks,
  skillXpFor,
} from "./island.ts";

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const read = (p: string) => strip(readFileSync(new URL(p, import.meta.url), "utf8"));

test("해금 목록은 엔진 표에서 나온다 — 레시피·씨앗·장비·조리대·★5 가 빠짐없이", () => {
  const u = farmUnlocks();
  const at = (lv: number) => u.filter((x) => x.level === lv).map((x) => x.label).join(" | ");
  for (const lv of CRAFT_SLOT_SKILLS) assert.match(at(lv), /조리대 \d칸/, `Lv.${lv} 조리대`);
  assert.match(at(TUNING.farm.star5MinSkill), /★5/);
  for (const c of CROPS) if (c.minSkill) assert.ok(at(c.minSkill).includes(c.name), `${c.name} 씨앗이 Lv.${c.minSkill} 에`);
  for (const g of GEARS) if (g.minSkill) assert.ok(at(g.minSkill).includes(g.name), `${g.name} 이 Lv.${g.minSkill} 에`);
  for (const p of PRODUCTS) if (p.minSkill > 1) assert.ok(u.some((x) => x.level === p.minSkill && /레시피/.test(x.label)), `${p.name} 레시피 Lv.${p.minSkill}`);
  for (let i = 1; i < u.length; i++) assert.ok(u[i - 1].level <= u[i].level, "레벨 순");
  for (const x of u) assert.ok(x.level >= 2 && x.level <= TUNING.farm.skillMax, `${x.label} 은 오를 수 있는 레벨`);
});

test("조리대 칸은 CRAFT_SLOT_SKILLS 에서만 정해진다", () => {
  const s = createIsland("콩", null, Date.UTC(2026, 8, 24));
  const at = (lv: number) => craftSlots({ ...s, farm: { ...s.farm, skillXp: lv <= 1 ? 0 : skillXpFor(lv) } });
  assert.equal(at(1), 1);
  CRAFT_SLOT_SKILLS.forEach((lv, i) => {
    assert.equal(at(lv - 1), i + 1, `Lv.${lv - 1}`);
    assert.equal(at(lv), i + 2, `Lv.${lv}`);
  });
});

test("진행 막대는 farmSkill 과 같은 문턱을 쓴다", () => {
  for (const xp of [0, 1, 150, skillXpFor(2) - 1, skillXpFor(2), skillXpFor(5) + 10, skillXpFor(13), 10_000_000]) {
    const p = farmLevelProgress(xp);
    assert.equal(p.level, farmSkill(xp), `xp ${xp}`);
    assert.ok(p.pct >= 0 && p.pct <= 1);
    if (p.next == null) assert.equal(p.level, TUNING.farm.skillMax);
    else assert.equal(p.need, skillXpFor(p.next) - xp, `xp ${xp} 남은 경험치`);
  }
  assert.equal(farmLevelProgress(skillXpFor(3)).pct, 0, "막 오른 레벨은 0%에서");
});

test("레벨을 요구하는 화면마다 정원으로 가는 길이 있다", () => {
  const game = read("../components/IslandGame.tsx");
  const farmView = game.slice(game.indexOf('tab === "farm" && ('), game.indexOf('tab === "craft" && ('));
  assert.match(farmView, /<FarmLevel s=\{s\} \/>/, "정원 맨 위 농사 레벨 판");
  assert.match(game, /<RecipeBook\s+onGoFarm=\{\(\) => setTab\("farm"\)\}/, "레시피북 잠금 → 정원");
  assert.match(game, /<GearView\s+onGoFarm=\{\(\) => setTab\("farm"\)\}/, "장비 잠금(농사) → 정원");
  const craftView = game.slice(game.indexOf('tab === "craft" && ('), game.indexOf('tab === "decor" && ('));
  assert.ok((craftView.match(/setTab\("farm"\)/g) ?? []).length >= 3, "공방 머리말 · 조리대 안내 · 레시피북");
  assert.doesNotMatch(craftView, /Lv\.8·14/, "조리대 레벨을 손으로 적지 않는다 — CRAFT_SLOT_SKILLS");
  const book = read("../components/island/Workshop.tsx");
  assert.match(book, /onGoFarm &&[\s\S]{0,200}정원에서 올려요/);
  const gear = read("../components/island/PetPanels.tsx");
  assert.match(gear, /onGoFarm && g\.minSkill != null[\s\S]{0,300}정원에서 올려요/);
  assert.match(read("../components/island/SeedShop.tsx"), /수확하면 올라요/);
});
