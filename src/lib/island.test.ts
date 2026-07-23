import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  PRODUCTS,
  DECORS,
  DECOR_SETS,
  PET_FORMS,
  ACHIEVEMENTS,
  TUNING,
  DAY_MS,
  createIsland,
  seasonOf,
  petLevel,
  petStage,
  nextEvolution,
  petNow,
  feedPet,
  cleanPet,
  playPet,
  hugPet,
  restPet,
  medicinePet,
  evolve,
  retirePet,
  coopStart,
  coopConfirm,
  plant,
  waterPlot,
  harvest,
  cropStage,
  expandPlots,
  startCraft,
  collectCraft,
  craftReady,
  buyTool,
  buyFertilizer,
  placeDecor,
  removeDecor,
  feedPetWith,
  petPet,
  pettingCoinsNext,
  ambience,
  kstDate,
  islandRating,
  ratingTier,
  farmSkill,
  claimVisit,
  earnCoins,
  giftPartner,
  claimQuest,
  islandSummary,
  cropOf,
} from "./island.ts";

// 봄철 정오(KST) 기준 시각 — 계절 결정적
const T = Date.UTC(2026, 3, 15, 3, 0, 0); // April → spring
const fresh = () => createIsland("나비", "2025-01-01", T);

test("데이터 무결성", () => {
  assert.equal(CROPS.length, 8);
  assert.equal(PRODUCTS.length, 6);
  assert.ok(DECORS.length >= 20);
  assert.equal(DECOR_SETS.length, 5);
  // 진화형: 최종 12형 존재
  const stage4 = Object.values(PET_FORMS).filter((f) => f.stage === 4);
  assert.equal(stage4.length, 12);
  assert.ok(ACHIEVEMENTS.length >= 8);
});

test("계절 판정(KST 월)", () => {
  assert.equal(seasonOf(Date.UTC(2026, 3, 10, 3)), "spring");
  assert.equal(seasonOf(Date.UTC(2026, 6, 10, 3)), "summer");
  assert.equal(seasonOf(Date.UTC(2026, 9, 10, 3)), "autumn");
  assert.equal(seasonOf(Date.UTC(2026, 0, 10, 3)), "winter");
});

test("createIsland 초기값", () => {
  const s = fresh();
  assert.equal(s.coins, TUNING.startCoins);
  assert.equal(s.level, 1);
  assert.equal(s.pet.form, "egg");
  assert.equal(s.farm.plots.length, TUNING.farm.startPlots);
  assert.equal(s.bond.level, 1);
});

test("펫 레벨 — 케어XP 앵커 구간 선형", () => {
  assert.equal(petLevel(0), 1);
  assert.equal(petLevel(200), 5);
  assert.equal(petLevel(1050), 15);
  assert.equal(petLevel(8300), 50);
  assert.ok(petLevel(600) > 5 && petLevel(600) < 15);
});

test("진화 트리 — 분기(케어품질·유대·방치)", () => {
  assert.equal(nextEvolution("egg", 50, 1, 0), "hatchling");
  // stage2 분기
  assert.equal(nextEvolution("hatchling", 80, 1, 0), "sunny");
  assert.equal(nextEvolution("hatchling", 50, 1, 0), "cozy");
  assert.equal(nextEvolution("hatchling", 20, 1, 0), "moody");
  // stage3: sunny→fox(고CQ+유대) / cat
  assert.equal(nextEvolution("sunny", 80, 6, 0), "fox");
  assert.equal(nextEvolution("sunny", 80, 2, 0), "cat"); // 유대 부족
  assert.equal(nextEvolution("cozy", 70, 1, 0), "bear");
  assert.equal(nextEvolution("cozy", 40, 1, 0), "panda");
  // stage4: 하이형 조건(CQ≥80 & neglect≤2)
  assert.equal(nextEvolution("fox", 85, 6, 1), "celestial_fox");
  assert.equal(nextEvolution("fox", 85, 6, 5), "starlight_fox"); // 방치 많음
  assert.equal(nextEvolution("fox", 60, 6, 0), "starlight_fox"); // CQ 부족
  assert.equal(nextEvolution("celestial_fox", 90, 10, 0), null); // 최종형
});

test("펫 감쇠 — 하루 뒤 스탯 하락", () => {
  const s = fresh();
  const a = petNow(s, T);
  const b = petNow(s, T + DAY_MS);
  assert.ok(b.stats.hunger < a.stats.hunger);
  assert.ok(b.stats.happy < a.stats.happy);
});

test("먹이 — 코인 차감·배고픔↑·쿨다운·케어XP", () => {
  let s = fresh();
  s.pet.stats.hunger = 40;
  const cash = s.coins;
  s = feedPet(s, T);
  assert.equal(s.coins, cash - TUNING.pet.action.feed.cost);
  assert.ok(s.pet.stats.hunger > 40);
  assert.ok(s.pet.careXp > 0);
  // 쿨다운 중 재시도 불가
  const before = s;
  s = feedPet(s, T + 1000);
  assert.equal(s, before);
  // 쿨다운 후 가능
  s = feedPet(s, T + 5 * 3600_000);
  assert.notEqual(s, before);
});

test("케어 액션들 동작(청소/놀기/포옹/휴식/약)", () => {
  let s = fresh();
  s.pet.stats = { hunger: 50, happy: 40, energy: 50, clean: 30, health: 40 };
  s = cleanPet(s, T);
  assert.ok(s.pet.stats.clean > 30);
  s = playPet(s, T);
  assert.ok(s.pet.stats.happy > 40);
  s = hugPet(s, T);
  s = restPet(s, T);
  assert.ok(s.pet.stats.energy > 50);
  s.pet.sick = true;
  s = medicinePet(s, T);
  assert.equal(s.pet.sick, false);
});

test("진화 확정 → 형태 변화", () => {
  let s = fresh();
  s.pet.careXp = 210; // level 5+
  s.pet.pendingEvolve = true;
  s = evolve(s, T);
  assert.equal(s.pet.form, "hatchling");
  assert.equal(petStage(s.pet.form), 1);
  assert.ok(s.catalog.includes("hatchling"));
});

test("최종형 은퇴 → 박물관 + 새 알", () => {
  let s = fresh();
  s.pet.form = "royal_cat";
  s = retirePet(s, "두번째", T);
  assert.ok(s.museum.includes("royal_cat"));
  assert.equal(s.pet.form, "egg");
  assert.equal(s.pet.name, "두번째");
});

test("함께 놀기 — 시작/상대 확인 → 유대 XP", () => {
  let s = fresh();
  s = coopStart(s, "a", T);
  assert.equal(s.pending.length, 1);
  // 같은 사람은 확인 불가
  const before = s;
  s = coopConfirm(s, "a", T);
  assert.equal(s, before);
  // 상대 확인 → 완성
  const bondXp0 = s.bond.xp;
  s = coopConfirm(s, "b", T + 1000);
  assert.equal(s.pending.length, 0);
  assert.ok(s.bond.xp > bondXp0);
});

test("정원 — 심기/물주기/수확(품질·코인)", () => {
  let s = fresh();
  s = plant(s, 0, "strawberry", T);
  assert.equal(s.farm.plots[0].crop, "strawberry");
  assert.equal(s.coins, TUNING.startCoins - cropOf("strawberry").seed);
  // 아직 덜 자람
  assert.equal(cropStage(s, s.farm.plots[0], T).ripe, false);
  s = waterPlot(s, 0, T + 1000);
  const cash = s.coins;
  s = harvest(s, 0, T + 3 * DAY_MS);
  assert.ok(s.coins > cash); // 수확 코인
  assert.equal(s.farm.plots[0].crop, null);
  assert.ok(s.farm.barn["strawberry"].qty === 1);
  assert.ok(s.farm.skillXp > 0);
});

test("밭 확장", () => {
  let s = fresh();
  s.coins = 5000;
  const n0 = s.farm.plots.length;
  s = expandPlots(s);
  assert.equal(s.farm.plots.length, n0 + 2);
});

test("가공 — 재료 소모 → 시간 뒤 완성", () => {
  let s = fresh();
  s.level = 6;
  s.farm.barn["strawberry"] = { qty: 3, star: 3 };
  s = startCraft(s, 0, "jam", T);
  assert.equal(s.farm.craft[0].product, "jam");
  assert.ok(!s.farm.barn["strawberry"]); // 재료 소모
  assert.equal(craftReady(s.farm.craft[0], T), false);
  const cash = s.coins;
  s = collectCraft(s, 0, T + DAY_MS);
  assert.ok(s.coins > cash);
  assert.equal(s.farm.craft[0].product, null);
});

test("도구/비료 구매", () => {
  let s = fresh();
  s.coins = 3000;
  s = buyTool(s, "sprinkler", T);
  assert.equal(s.farm.sprinkler, true);
  const f0 = s.farm.fert;
  s = buyFertilizer(s, false);
  assert.equal(s.farm.fert, f0 + 1);
});

test("꾸미기 — 배치/제거 + 세트 완성 → 평점", () => {
  let s = fresh();
  s.coins = 5000;
  s.level = 5;
  const r0 = islandRating(s);
  s = placeDecor(s, "tulip", 0, 0, T);
  assert.ok(islandRating(s) > r0);
  // 같은 칸 중복 불가
  const before = s;
  s = placeDecor(s, "rose", 0, 0, T);
  assert.equal(s, before);
  // 봄 정원 세트 전부 배치 → 세트 완성
  s = placeDecor(s, "rose", 1, 0, T);
  s = placeDecor(s, "sunflower", 2, 0, T);
  s = placeDecor(s, "blossom", 3, 0, T);
  s = placeDecor(s, "butterfly", 4, 0, T);
  assert.ok(s.sets.includes("spring"));
  // 제거하면 세트 해제
  s = removeDecor(s, s.decor[0].id);
  assert.ok(!s.sets.includes("spring"));
});

test("작물로 밥주기 — 창고 소비·포만/행복↑·무료·feed 쿨다운 공유", () => {
  let s = fresh();
  s.pet.stats.hunger = 30;
  s.pet.stats.happy = 40;
  s.farm.barn["strawberry"] = { qty: 2, star: 3 };
  const coins0 = s.coins;
  s = feedPetWith(s, "strawberry", T);
  assert.equal(s.coins, coins0); // 무료(코인 차감 없음)
  assert.equal(s.farm.barn["strawberry"].qty, 1); // 1개 소비
  assert.ok(s.pet.stats.hunger > 30);
  assert.ok(s.pet.stats.happy > 40); // 직접 키운 작물 → 행복 보너스
  assert.ok(s.pet.careXp > 0);
  // feed 쿨다운을 공유 → 코인 먹이(feedPet)도 곧바로는 불가
  const before = s;
  s = feedPet(s, T + 1000);
  assert.equal(s, before);
});

test("작물로 밥주기 — 창고 비면 no-op, 마지막 1개 소비 시 키 삭제", () => {
  let s = fresh();
  const before = s;
  s = feedPetWith(s, "strawberry", T); // 창고에 없음
  assert.equal(s, before); // no-op(원본 반환)
  s = fresh();
  s.farm.barn["carrot"] = { qty: 1, star: 2 };
  s = feedPetWith(s, "carrot", T);
  assert.ok(!s.farm.barn["carrot"]); // 마지막 1개 → 키 제거
});

test("쓰다듬기 보상 — 애정+일일캡 코인, 캡 소진 후 코인 0·다음날 리셋", () => {
  let s = fresh();
  s.pet.stats.happy = 40;
  const cap = TUNING.pet.petting.capDay;
  const coins0 = s.coins;
  // 지금 받을 코인 안내
  assert.equal(pettingCoinsNext(s, T), TUNING.pet.petting.coins);
  s = petPet(s, T);
  assert.equal(s.coins, coins0 + TUNING.pet.petting.coins);
  assert.ok(s.pet.stats.happy > 40);
  assert.equal(s.petCount, 1);
  // 캡까지 반복
  for (let i = 1; i < cap; i++) s = petPet(s, T + i);
  assert.equal(s.petCount, cap);
  assert.equal(pettingCoinsNext(s, T), 0); // 캡 소진
  const coinsAtCap = s.coins;
  s = petPet(s, T + cap); // 캡 초과 — 코인 없이 애정만
  assert.equal(s.coins, coinsAtCap);
  assert.equal(s.petCount, cap);
  // 다음날 리셋
  s = petPet(s, T + DAY_MS);
  assert.equal(s.petCount, 1);
  assert.equal(pettingCoinsNext(s, T + DAY_MS), TUNING.pet.petting.coins);
});

test("쓰다듬기 — 캡 초과 + 행복 만렙이면 no-op(헛된 커밋 방지)", () => {
  let s = fresh();
  s.petDate = kstDate(T);
  s.petCount = TUNING.pet.petting.capDay; // 캡 소진 상태
  s.pet.stats.happy = 100;
  const before = s;
  s = petPet(s, T);
  assert.equal(s, before);
});

test("섬 분위기 — 꾸밀수록 펫 행복 감쇠 완화", () => {
  const bare = fresh();
  assert.equal(ambience(bare), 0); // 데코 없음
  // 데코를 많이 놓은 섬
  let deco = fresh();
  deco.coins = 99999;
  deco.level = 20;
  deco = placeDecor(deco, "tulip", 0, 0, T);
  deco = placeDecor(deco, "rose", 1, 0, T);
  deco = placeDecor(deco, "sunflower", 2, 0, T);
  assert.ok(ambience(deco) > ambience(bare));
  // 같은 초기 행복에서 하루 감쇠 비교 — 분위기 좋은 섬이 덜 줄어듦
  const h0 = 80;
  bare.pet.stats.happy = h0;
  deco.pet.stats.happy = h0;
  const bareAfter = petNow(bare, T + DAY_MS).stats.happy;
  const decoAfter = petNow(deco, T + DAY_MS).stats.happy;
  assert.ok(decoAfter > bareAfter);
});

test("장식 배치 — 펫이 즉시 좋아함(행복 소폭↑)", () => {
  let s = fresh();
  s.coins = 5000;
  s.level = 5;
  s.pet.stats.happy = 50;
  s = placeDecor(s, "tulip", 0, 0, T);
  assert.equal(s.pet.stats.happy, 50 + TUNING.island.decorJoy);
});

test("평점 등급", () => {
  assert.equal(ratingTier(0).key, "bronze");
  assert.equal(ratingTier(600).key, "gold");
  assert.equal(ratingTier(2500).key, "royal");
});

test("출석 + 함께 + 스트릭", () => {
  let s = createIsland("나비", null, T); // D-day 보상 간섭 없이 순수 출석/스트릭만
  const base = s.coins;
  s = claimVisit(s, "a", T);
  // 1일차 = 기본 출석 + 스트릭 cycle[0](최저) — 인덱스 off-by-one 회귀 lock [리뷰 fix]
  assert.equal(s.coins, base + TUNING.visit.daily + TUNING.streak.cycle[0]);
  assert.equal(s.streak.count, 1);
  // 같은 날 재방문 무변화(코인)
  const c1 = s.coins;
  s = claimVisit(s, "a", T + 3600_000);
  assert.equal(s.coins, c1);
  // 상대 방문 → 함께 보너스 + 유대
  s = claimVisit(s, "b", T + 3600_000);
  assert.ok(s.coins > c1);
  assert.equal(s.togetherDate, s.daily["b"]);
});

test("퀘스트 — 진행 → 보상", () => {
  let s = fresh();
  s = claimVisit(s, "a", T); // 퀘스트 생성
  // plant 퀘스트가 있으면 진행
  const plantQ = s.quest.list.find((q) => q.id === "plant");
  if (plantQ) {
    s = plant(s, 0, "strawberry", T);
    s = plant(s, 1, "carrot", T);
    s = plant(s, 2, "strawberry", T);
    const q = s.quest.list.find((x) => x.id === "plant")!;
    assert.ok(q.prog >= q.goal);
    const cash = s.coins;
    s = claimQuest(s, "plant", T);
    assert.ok(s.coins > cash);
  }
  assert.ok(s.quest.list.length === 3);
});

test("D-day 마일스톤 자동 지급", () => {
  // 시작일을 100일 전으로
  const start = new Date(T - 120 * DAY_MS + 9 * 3600_000).toISOString().slice(0, 10);
  let s = createIsland("나비", start, T);
  const cash = s.coins;
  s = claimVisit(s, "a", T);
  assert.ok(s.ddayClaimed.includes(100));
  assert.ok(s.coins > cash + TUNING.visit.daily);
});

test("외부 코인 + 선물(유대)", () => {
  let s = fresh();
  s = earnCoins(s, 100, "게임 승리");
  assert.equal(s.coins, TUNING.startCoins + 100);
  const bx = s.bond.xp;
  s = giftPartner(s, T); // 1회차
  assert.ok(s.bond.xp > bx);
  // 하루 캡(3) — 4회차는 무변화
  const g3 = giftPartner(giftPartner(s, T), T); // 2,3회차
  assert.equal(giftPartner(g3, T), g3);
});

test("농사 스킬 레벨", () => {
  assert.equal(farmSkill(0), 1);
  assert.ok(farmSkill(10000) > 1);
});

test("요약(UI 헤더)", () => {
  const s = fresh();
  const sum = islandSummary(s, T);
  assert.equal(sum.level, 1);
  assert.equal(sum.season, "spring");
  assert.ok(sum.pet.stats.hunger >= 0);
  assert.equal(sum.petForm.emoji, "🥚");
});

test("불변성 — 원본 미변경", () => {
  const s0 = fresh();
  const snap = JSON.stringify(s0);
  feedPet(s0, T);
  plant(s0, 0, "strawberry", T);
  placeDecor({ ...s0, coins: 9999, level: 5 }, "tulip", 0, 0, T);
  claimVisit(s0, "a", T);
  assert.equal(JSON.stringify(s0), snap);
});
