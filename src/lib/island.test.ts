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
  isAsleep,
  wakePet,
  medicinePet,
  evolve,
  retirePet,
  coopStart,
  coopConfirm,
  plant,
  waterPlot,
  harvest,
  fertilize,
  fertQuality,
  qualityPreview,
  weatherOf,
  craftSlots,
  skillXpFor,
  cropStage,
  expandPlots,
  startCraft,
  collectCraft,
  craftReady,
  buyTool,
  buyFertilizer,
  placeDecor,
  moveDecor,
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
  evolutionPreview,
  harvestAllReady,
} from "./island.ts";

// 봄철 정오(KST) 기준 시각 — 계절 결정적
const T = Date.UTC(2026, 3, 15, 3, 0, 0); // April → spring
const fresh = () => createIsland("나비", "2025-01-01", T);

test("데이터 무결성", () => {
  assert.equal(CROPS.length, 8);
  assert.equal(PRODUCTS.length, 8); // 야채수프·샐러드 추가(2026-07-27 공방 재개방)
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

test("함께 놀기 플레이 세션 — 점수 합산 보너스 [회귀 lock 2026-07-28]", () => {
  // 사용자: "지금은 그냥 터치하면 끝" → 양쪽 플레이 점수 합(combined)에 비례해 유대/행복
  // 보너스가 스케일. 계약: ① score 미전달(옛 클라/옛 저장본) = 기존 base 보상 그대로(하위호환)
  // ② 합산이 scoreForMax 면 보너스 만점 ③ 과대 점수는 캡(경제 보호).
  const a = TUNING.pet.coop;
  // ① 하위호환 — score 없이 완성하면 base bondXp 정확히
  let s0 = fresh();
  const base0 = s0.bond.xp;
  s0 = coopStart(s0, "a", T);
  s0 = coopConfirm(s0, "b", T + 1000);
  const baseGain = s0.bond.xp - base0;
  assert.equal(baseGain, a.bondXp, "score 미전달 = 기존 보상 그대로(보너스 0)");
  // ② 만점 합산 — bonusBondMax 까지 정확히 가산
  let s1 = fresh();
  const b1 = s1.bond.xp;
  s1 = coopStart(s1, "a", T, a.scoreForMax / 2);
  assert.equal(s1.pending[0].score, a.scoreForMax / 2, "걸어둔 점수가 pending 에 저장");
  s1 = coopConfirm(s1, "b", T + 1000, a.scoreForMax / 2);
  assert.equal(s1.bond.xp - b1, a.bondXp + a.bonusBondMax, "합=scoreForMax → 보너스 만점");
  // ③ 과대 점수 캡 — 만점 초과 불가 + 저장 점수도 99 캡
  let s2 = fresh();
  const b2 = s2.bond.xp;
  s2 = coopStart(s2, "a", T, 99999);
  assert.ok((s2.pending[0].score ?? 0) <= 99, "저장 점수 캡");
  s2 = coopConfirm(s2, "b", T + 1000, 99999);
  assert.equal(s2.bond.xp - b2, a.bondXp + a.bonusBondMax, "아무리 커도 보너스는 상한 캡");
  // 로그에 합산 점수 노출(둘의 호흡)
  assert.ok(s1.log.some((l) => l.includes("둘의 호흡")), "완성 로그에 합산 점수");
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

test("가공 — 재료 소모 → 시간 뒤 완성 (게이트=농사 스킬)", () => {
  let s = fresh();
  s.farm.skillXp = 300; // 농사 Lv.2 — 잼 minSkill 2 충족(섬 레벨 게이트는 폐지됨)
  s.farm.barn["strawberry"] = { qty: 2, star: 3 };
  s = startCraft(s, 0, "jam", T);
  assert.equal(s.farm.craft[0].product, "jam");
  assert.ok(!s.farm.barn["strawberry"]); // 재료 소모(잼 = 딸기 2)
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

/* ── 2026-07-27 정원 재설계 회귀 lock ─────────────────────────── */

test("비료 — 누적(18/12/8)·상한 3·골드 별도·빈 밭 미리 갈기", () => {
  let s = fresh();
  s.farm.fert = 5;
  s.farm.gold = 1;
  // 빈 밭에도 미리 갈아둘 수 있다(구버전: !plot.crop 가드가 막던 것)
  s = fertilize(s, 0, false, T);
  assert.equal(s.farm.plots[0].fertStack, 1);
  assert.equal(s.farm.plots[0].fert, 18);
  s = fertilize(s, 0, false, T);
  assert.equal(s.farm.plots[0].fert, 30); // 18+12 (덮어쓰기 아님)
  s = fertilize(s, 0, false, T);
  assert.equal(s.farm.plots[0].fert, 38); // 18+12+8
  const before = s;
  s = fertilize(s, 0, false, T); // 4번째 — 상한
  assert.equal(s, before);
  s = fertilize(s, 0, true, T); // 골드
  assert.equal(s.farm.plots[0].fert, 78); // 38+40
  assert.equal(fertQuality(2, false), 30);
});

test("비료 — 심어도 보존, 성장 가속, 수확 후 1단계만 소모(잔존)", () => {
  let s = fresh();
  s.coins = 500;
  s.farm.fert = 3;
  s = fertilize(s, 0, false, T);
  s = fertilize(s, 0, false, T);
  s = plant(s, 0, "carrot", T);
  assert.equal(s.farm.plots[0].fertStack, 2); // plant 가 리셋하지 않음
  // 성장 가속 — 같은 경과시간에서 진행도가 더 높다
  const plain: typeof s.farm.plots[0] = { crop: "carrot", plantedAt: T, wateredAt: T, fert: 0 };
  const fast = cropStage(s, s.farm.plots[0], T + 3600_000).progress;
  const slow = cropStage(s, plain, T + 3600_000).progress;
  assert.ok(fast > slow, `가속 ${fast} > ${slow}`);
  // 수확 → fertStack 2-1=1 잔존
  s = harvest(s, 0, T + 30 * DAY_MS);
  assert.equal(s.farm.plots[0].crop, null);
  assert.equal(s.farm.plots[0].fertStack, 1);
  assert.equal(s.farm.plots[0].fert, 18);
});

test("품질 미리보기 — rng 미소비·결정적, 실제 수확 ★이 밴드 안", () => {
  let s = fresh();
  s.coins = 500;
  s.farm.skillXp = 1158; // 실플레이어 스냅샷(농사 Lv.5)
  s.farm.sprinkler = true;
  s = plant(s, 0, "strawberry", T); // 4월=봄 제철
  const rng0 = s.rng;
  const p1 = qualityPreview(s, 0, T + DAY_MS)!;
  const p2 = qualityPreview(s, 0, T + DAY_MS)!;
  assert.equal(s.rng, rng0); // rng 카운터 불변(렌더 경로 안전)
  assert.deepEqual(p1, p2);
  assert.ok(p1.score > 0 && p1.starMin >= 1 && p1.starMax <= 5 && p1.starMin <= p1.starMax);
  // 실제 수확이 항상 밴드 안(★5 게이트로 잘리는 경우 포함해 min 이하로는 안 내려감)
  for (let i = 0; i < 30; i++) {
    let t = fresh();
    t.coins = 500;
    t.seed = 1000 + i * 7;
    t.farm.skillXp = 1158;
    t.farm.sprinkler = true;
    t = plant(t, 0, "strawberry", T);
    const pv = qualityPreview(t, 0, T + 2 * DAY_MS)!;
    t = harvest(t, 0, T + 2 * DAY_MS);
    const got = t.farm.barn["strawberry"].star;
    assert.ok(got >= Math.min(pv.starMin, 4) && got <= pv.starMax, `seed${t.seed}: ${got} in [${pv.starMin},${pv.starMax}]`);
  }
});

test("★5 게이트 — 스킬 부족해도 비료 3단계면 열린다", () => {
  let s = fresh();
  s.coins = 500;
  s.farm.skillXp = 1158; // Lv.5 (< star5MinSkill 12)
  s.farm.sprinkler = true;
  s.farm.fert = 3;
  s = fertilize(s, 0, false, T);
  s = fertilize(s, 0, false, T);
  s = fertilize(s, 0, false, T);
  s = plant(s, 0, "strawberry", T);
  // 점수: 20 + 15 + 25 + 15 + 38 = 113 ≥ 110 → rng 무관 ★5, 게이트도 fertStack 3 으로 통과
  s = harvest(s, 0, T + 2 * DAY_MS);
  assert.equal(s.farm.barn["strawberry"].star, 5);
});

test("행운의 두둑 — 거부된 심기는 rng 카운터를 소비하지 않음", () => {
  let s = fresh();
  s.coins = 0; // 씨앗 못 삼
  const rng0 = s.rng;
  const before = s;
  s = plant(s, 0, "strawberry", T);
  assert.equal(s, before);
  assert.equal(before.rng, rng0); // 원본 그대로(카운터 미소비 — 양 클라 동기 유지)
});

test("날씨 — seed+날짜 결정적, rng 미소비, 비 오는 날 자동 급수 1회", () => {
  const s = fresh();
  const w1 = weatherOf(s, T);
  for (let i = 0; i < 50; i++) assert.equal(weatherOf(s, T), w1); // 몇 번을 불러도 동일
  assert.equal(s.rng, fresh().rng);
  // 비 오는 날짜를 찾아 자동 급수 1회 검증
  let rainT: number | null = null;
  for (let d = 0; d < 60; d++) if (weatherOf(s, T + d * DAY_MS) === "rain") { rainT = T + d * DAY_MS; break; }
  if (rainT != null) {
    let t = fresh();
    t.coins = 500;
    t = plant(t, 0, "strawberry", T);
    t.farm.plots[0].wateredAt = null; // 마른 밭
    t = hugPet(t, rainT); // 아무 액션 → tick → 비 급수
    assert.equal(t.farm.plots[0].wateredAt, rainT);
    const w = t.farm.plots[0].wateredAt;
    t = playPet(t, rainT + 3600_000); // 같은 날 두 번째 tick — rainDay 가드로 재급수 없음
    assert.equal(t.farm.plots[0].wateredAt, w);
  }
});

test("공방 — 농사 스킬 게이트·수프는 당근2+버섯1로 즉시, 슬롯은 스킬 파생 패딩", () => {
  let s = fresh();
  s.farm.skillXp = 1158; // Lv.5 — 실플레이어 스냅샷
  s.farm.barn = { carrot: { qty: 2, star: 3 }, mushroom: { qty: 2, star: 2 } };
  s = startCraft(s, 0, "soup", T);
  assert.equal(s.farm.craft[0].product, "soup"); // '들어가지도 않아' 종료
  // 와인은 minSkill 9 — 거부
  let t = fresh();
  t.farm.skillXp = 1158;
  t.farm.barn = { grape: { qty: 9, star: 3 } };
  const before = t;
  t = startCraft(t, 0, "wine", T);
  assert.equal(t, before);
  // 슬롯 패딩: 스킬 Lv.8 이상이면 tick 이 조리대를 2개로 늘린다(절대 줄이진 않음)
  let u = fresh();
  u.farm.skillXp = skillXpFor(8) + 1;
  u = hugPet(u, T);
  assert.equal(u.farm.craft.length, 2);
  assert.equal(craftSlots(u), 2);
});

test("데코 이동 — 빈 칸으로만, 무비용, 세트 유지", () => {
  let s = fresh();
  s.coins = 5000;
  s.level = 5;
  s = placeDecor(s, "tulip", 0, 0, T);
  s = placeDecor(s, "rose", 1, 0, T);
  const id = s.decor.find((d) => d.key === "tulip")!.id;
  const coins0 = s.coins;
  s = moveDecor(s, id, 3, 2);
  assert.equal(s.decor.find((d) => d.id === id)!.x, 3);
  assert.equal(s.decor.find((d) => d.id === id)!.y, 2);
  assert.equal(s.coins, coins0); // 무비용
  // 차 있는 칸/범위 밖/같은 자리 → no-op(원본 반환)
  const before = s;
  assert.equal(moveDecor(s, id, 1, 0), before); // rose 자리
  assert.equal(moveDecor(s, id, -1, 0), before);
  assert.equal(moveDecor(s, id, 3, 2), before); // 같은 자리
});

test("수면 — 재우면 잠들고, 탭(wake)으로 깨고, 시간이 지나면 저절로 깬다", () => {
  let s = fresh();
  assert.equal(isAsleep(s, T), false);
  s = restPet(s, T);
  assert.equal(isAsleep(s, T + 1000), true); // 자는 중(공유 상태)
  assert.equal(isAsleep(s, T + TUNING.pet.action.rest.sleepH * 3600_000 + 1), false); // 자동 기상(파생)
  // 깨우기 — 벌 없음
  const energy = s.pet.stats.energy;
  s = wakePet(s, T + 1000);
  assert.equal(isAsleep(s, T + 1001), false);
  // 에너지는 사실상 그대로(1초치 tick 감쇠만) — 깨워도 벌 없음
  assert.ok(Math.abs(s.pet.stats.energy - energy) < 0.01);
  // 안 자는데 깨우기 → no-op
  const before = s;
  assert.equal(wakePet(s, T + 2000), before);
  // 직렬화 왕복에도 안전(sleepUntil 제거는 JSON 에서 사라짐)
  const round = JSON.parse(JSON.stringify(s));
  assert.equal(round.pet.sleepUntil, undefined);
});

test("evolutionPreview — 다음 진화까지 진행/분기/힌트 [회귀 lock 2026-07-27]", () => {
  const s = fresh(); // egg, careXp 0
  const p0 = evolutionPreview(s);
  assert.equal(p0.stage, 0);
  assert.equal(p0.needLevel, 5); // 부화 레벨 게이트
  assert.equal(p0.target, "hatchling");
  assert.ok(p0.pct >= 0 && p0.pct < 100);
  // 아기 + 낮은 정성 → 그늘이 예상 + 상위 분기 힌트
  const s2 = fresh();
  s2.pet.form = "hatchling";
  s2.pet.cq = 20;
  const p2 = evolutionPreview(s2);
  assert.equal(p2.target, "moody");
  assert.ok(p2.hint && p2.hint.includes("포근이") && p2.hint.includes("햇살이"), "상위 분기 안내");
  // 정성 높으면 햇살이 + 힌트 없음(이미 상위)
  s2.pet.cq = 90;
  const p3 = evolutionPreview(s2);
  assert.equal(p3.target, "sunny");
  assert.equal(p3.hint, null);
  // 최종형 → needLevel null, target null
  const s4 = fresh();
  s4.pet.form = "celestial_fox";
  const p4 = evolutionPreview(s4);
  assert.equal(p4.needLevel, null);
  assert.equal(p4.target, null);
});

test("harvestAllReady — 다 자란 것만 한 번에 수확 [회귀 lock 2026-07-27]", () => {
  let s = fresh();
  s.coins = 500;
  s = plant(s, 0, "carrot", T);
  s = plant(s, 1, "carrot", T);
  s = plant(s, 2, "pumpkin", T); // 2.5d + 봄엔 비제철 — 확실히 안 익음
  const later = T + 0.8 * 86400000; // 당근(0.75d·제철)만 익음
  const before = Object.keys(s.farm.barn).length;
  const h = harvestAllReady(s, later);
  assert.ok((h.farm.barn.carrot?.qty ?? 0) >= 2, "당근 2개 모두 수확");
  assert.equal(h.farm.plots[2].crop, "pumpkin"); // 호박은 그대로 자라는 중
  assert.ok(Object.keys(h.farm.barn).length >= before);
  // 익은 게 없으면 원본 참조 그대로(헛 커밋 방지)
  const noop = harvestAllReady(h, later);
  assert.equal(noop, h);
});
