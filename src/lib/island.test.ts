import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  DECORS,
  PETS,
  DAY_MS,
  START_COINS,
  FOOD_COST,
  FEED_HUNGER,
  HUNGER_RATE,
  HAPPY_DECAY,
  PLAY_COOLDOWN_MS,
  DAILY_VISIT_BONUS,
  TOGETHER_BONUS,
  WATER_BOOST,
  levelXp,
  plotsUnlocked,
  cropOf,
  decorOf,
  createIsland,
  plant,
  water,
  harvest,
  cropStage,
  tickPet,
  feedPet,
  playPet,
  placeDecor,
  removeDecor,
  claimVisit,
  earnCoins,
  islandWorth,
  kstDate,
} from "./island.ts";

const T0 = 1_700_000_000_000; // 고정 기준 epoch ms
const fresh = () => createIsland("cat", "나비", T0);

test("데이터 무결성 — 작물/펫/데코", () => {
  assert.equal(CROPS.length, 5);
  assert.equal(PETS.length, 6);
  assert.equal(DECORS.length, 8);
  for (const c of CROPS) assert.ok(c.seed > 0 && c.yield > c.seed && c.growMs > 0);
  for (const d of DECORS) assert.ok(d.cost > 0);
});

test("createIsland 초기값", () => {
  const s = fresh();
  assert.equal(s.coins, START_COINS);
  assert.equal(s.level, 1);
  assert.equal(s.pet.species, "cat");
  assert.equal(s.pet.name, "나비");
  assert.equal(s.plots.length, 9);
  assert.ok(s.plots.every((p) => p.crop === null));
  assert.equal(plotsUnlocked(1), 3);
});

test("심기 — 코인 차감, 잠긴 밭/레벨 제한", () => {
  let s = fresh();
  s = plant(s, 0, "tulip", T0);
  assert.equal(s.coins, START_COINS - cropOf("tulip").seed);
  assert.equal(s.plots[0].crop, "tulip");
  assert.equal(s.plots[0].plantedAt, T0);
  // 잠긴 밭(레벨1은 3칸만) — plotId 5 불가
  const before = s;
  s = plant(s, 5, "carrot", T0);
  assert.equal(s, before);
  // 레벨 제한 작물(토마토 minLevel 2)
  s = plant(s, 1, "tomato", T0);
  assert.equal(s, before);
});

test("성장 단계 + 물주기 가속", () => {
  let s = fresh();
  s = plant(s, 0, "tulip", T0); // growMs 2h
  const grow = cropOf("tulip").growMs;
  assert.equal(cropStage(s.plots[0], T0).ripe, false);
  assert.ok(cropStage(s.plots[0], T0 + grow / 2).progress > 0.4);
  assert.equal(cropStage(s.plots[0], T0 + grow).ripe, true);
  // 물주기 — 상대가 주면 성장 단축(WATER_BOOST)
  s = water(s, 0, "partner", T0);
  const eff = grow * (1 - WATER_BOOST);
  assert.equal(cropStage(s.plots[0], T0 + eff).ripe, true);
  // 같은 사람 두 번은 안 됨
  const before = s;
  s = water(s, 0, "partner", T0);
  assert.equal(s, before);
});

test("수확 — 코인/XP 획득, 밭 비움", () => {
  let s = fresh();
  s = plant(s, 0, "carrot", T0);
  const grow = cropOf("carrot").growMs;
  // 아직 덜 자람 → 수확 불가
  const notYet = harvest(s, 0, T0 + grow / 2);
  assert.equal(notYet, s);
  const cashBefore = s.coins;
  s = harvest(s, 0, T0 + grow);
  assert.equal(s.coins, cashBefore + cropOf("carrot").yield);
  assert.equal(s.plots[0].crop, null);
  assert.ok(s.xp > 0);
});

test("섬 레벨업 → 밭 추가 해금", () => {
  let s = fresh();
  s.xp = levelXp(1) - 3; // 임계 직전
  s = plant(s, 0, "tulip", T0);
  s = harvest(s, 0, T0 + cropOf("tulip").growMs); // +4 xp → 레벨업
  assert.equal(s.level, 2);
  assert.equal(plotsUnlocked(2), 4);
});

test("펫 감쇠 — 시간 지나면 배고픔↑ 행복↓", () => {
  const s = fresh();
  const p1 = tickPet(s.pet, T0 + DAY_MS); // 하루 뒤
  assert.ok(Math.abs(p1.hunger - (s.pet.hunger + HUNGER_RATE)) < 0.001);
  assert.ok(Math.abs(p1.happy - (s.pet.happy - HAPPY_DECAY)) < 0.001);
});

test("먹이 — 코인 차감, 배고픔↓ 행복↑", () => {
  let s = fresh();
  s.pet.hunger = 60;
  const cash = s.coins;
  s = feedPet(s, T0);
  assert.equal(s.coins, cash - FOOD_COST);
  assert.ok(s.pet.hunger <= 60 - FEED_HUNGER + 0.001);
  assert.ok(s.pet.xp > 0);
  // 이미 배부르면(hunger 0) 낭비 방지
  s.pet.hunger = 0;
  const before = s;
  s = feedPet(s, T0);
  assert.equal(s, before);
});

test("놀아주기 — 행복↑, 쿨다운", () => {
  let s = fresh();
  s.pet.happy = 30;
  s = playPet(s, T0);
  assert.ok(s.pet.happy > 30);
  // 쿨다운 중 재시도 불가
  const before = s;
  s = playPet(s, T0 + PLAY_COOLDOWN_MS / 2);
  assert.equal(s, before);
  // 쿨다운 후 가능
  s = playPet(s, T0 + PLAY_COOLDOWN_MS + 1);
  assert.notEqual(s, before);
});

test("꾸미기 — 배치/치우기(환급), 칸 점유", () => {
  let s = fresh();
  const cash = s.coins;
  s = placeDecor(s, "flower", 0, 0, T0);
  assert.equal(s.coins, cash - decorOf("flower").cost);
  assert.equal(s.decor.length, 1);
  // 같은 칸 중복 불가
  let before = s;
  s = placeDecor(s, "tree", 0, 0, T0);
  assert.equal(s, before);
  // 치우면 절반 환급
  const id = s.decor[0].id;
  before = s;
  s = removeDecor(s, id);
  assert.equal(s.decor.length, 0);
  assert.ok(s.coins > before.coins);
});

test("출석 + 함께 보너스", () => {
  let s = fresh();
  const base = s.coins;
  s = claimVisit(s, "a", T0);
  assert.equal(s.coins, base + DAILY_VISIT_BONUS);
  // 같은 날 재방문 — 중복 보너스 없음
  let before = s;
  s = claimVisit(s, "a", T0);
  assert.equal(s, before);
  // 상대도 방문 → 상대 출석 + 함께 보너스
  s = claimVisit(s, "b", T0);
  assert.equal(s.coins, base + DAILY_VISIT_BONUS * 2 + TOGETHER_BONUS);
  // 함께 보너스도 하루 1번
  before = s;
  s = claimVisit(s, "b", T0);
  assert.equal(s, before);
});

test("외부 코인 지급 + 자산가치", () => {
  let s = fresh();
  const w0 = islandWorth(s);
  s = earnCoins(s, 50, "게임 승리");
  assert.equal(s.coins, START_COINS + 50);
  assert.ok(islandWorth(s) > w0);
  assert.equal(earnCoins(s, 0, "x"), s); // 0 은 무변화
});

test("kstDate — KST 날짜 문자열", () => {
  // UTC 15:00 = KST 24:00 → 다음날
  assert.equal(kstDate(Date.UTC(2026, 0, 1, 15, 0, 0)), "2026-01-02");
  assert.equal(kstDate(Date.UTC(2026, 0, 1, 2, 0, 0)), "2026-01-01");
});

test("불변성 — 원본 상태 미변경", () => {
  const s0 = fresh();
  const snap = JSON.stringify(s0);
  plant(s0, 0, "tulip", T0);
  feedPet(s0, T0);
  placeDecor(s0, "flower", 1, 1, T0);
  claimVisit(s0, "a", T0);
  assert.equal(JSON.stringify(s0), snap);
});
