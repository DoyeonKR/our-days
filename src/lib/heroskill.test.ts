// 히어로 기술 · 돌봄 상태 lock. [2026-09-24]
// [사용자: "장비는 지금 너무 활용처가 없어" · "케어 데크도 UI UX 개편해"]
//
// 장비는 퍼센트 퍽뿐이라 사도 보이는 게 없었다. 슬롯마다 기술(훈련·채집·모험)을 주고, 낀 장비의
// 등급이 기술의 세기가 되게 했다. 케어 데크는 '왜 못 누르는지'를 엔진 한 곳(careStatus)에서 읽는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  GEARS,
  GEAR_SLOTS,
  HERO_SKILLS,
  HERO_SKILL_TUNE,
  TUNING,
  careStatus,
  cleanPet,
  createIsland,
  gearTier,
  heroSkillStatus,
  heroSkillText,
  heroSkillTier,
  hugPet,
  medicinePet,
  playPet,
  restPet,
  runHeroSkill,
  seasonOf,
  type CareKey,
  type HeroSkill,
  type IslandState,
} from "./island.ts";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 25, 3, 0, 0); // 가을(KST)

function hero(equip: Partial<Record<"weapon" | "hat" | "cape", string>> = {}): IslandState {
  const s = createIsland("콩", null, T0);
  const owned = Object.values(equip);
  return {
    ...s,
    coins: 10_000,
    hero: { owned, equip },
    pet: { ...s.pet, stats: { ...s.pet.stats, energy: 100, hunger: 100, happy: 80, clean: 80, health: 100 } },
  };
}
const TOP: Record<"weapon" | "hat" | "cape", string> = { weapon: "galaxy", hat: "starcrown", cape: "galaxycape" };
const LOW: Record<"weapon" | "hat" | "cape", string> = { weapon: "stick", hat: "straw", cape: "scarf" };

// ── 1. 등급 ───────────────────────────────────────────────────────

test("장비 등급은 슬롯 안 순서 1~5 — 비쌀수록·늦게 열릴수록 높다", () => {
  for (const slot of GEAR_SLOTS) {
    const list = GEARS.filter((g) => g.slot === slot);
    assert.equal(list.length, 5, `${slot} 가 5단이 아니다`);
    list.forEach((g, i) => {
      assert.equal(gearTier(g.key), i + 1);
      if (i > 0) {
        assert.ok(g.price > list[i - 1].price, `${g.name} 이 아래 등급보다 싸다 — 등급과 표 순서가 어긋났다`);
        assert.ok(g.minLevel >= list[i - 1].minLevel, `${g.name} 의 레벨 게이트가 아래 등급보다 낮다`);
      }
    });
  }
  assert.equal(gearTier("ghost"), 0);
});

test("★ 기술은 등급이 오를수록 세진다 — 비싼 장비가 기술로도 값을 한다", () => {
  const tr = HERO_SKILL_TUNE.train, fo = HERO_SKILL_TUNE.forage, ve = HERO_SKILL_TUNE.venture;
  for (let t = 2; t <= 5; t++) {
    assert.ok(tr.buffPct(t) > tr.buffPct(t - 1));
    assert.ok(tr.xp(t) > tr.xp(t - 1));
    assert.ok(fo.count(t) >= fo.count(t - 1) && fo.star(t) > fo.star(t - 1));
    assert.ok(fo.fert(t) > fo.fert(t - 1));
    assert.ok(ve.coins(t) > ve.coins(t - 1) && ve.treasure(t) > ve.treasure(t - 1));
  }
  assert.ok(ve.treasure(5) < 1, "보물 확률이 100% 를 넘으면 '가끔'이 아니다");
});

// ── 2. 잠금 · 이유 ─────────────────────────────────────────────────

test("★ 장비가 없으면 기술이 잠기고 이유를 말한다 · 끼면 열린다", () => {
  const bare = hero();
  for (const d of HERO_SKILLS) {
    const st = heroSkillStatus(bare, d.key, T0);
    assert.equal(st.ok, false);
    assert.equal(st.reason, d.unlock, `${d.name}: 잠긴 이유가 안 보인다`);
    assert.equal(runHeroSkill(bare, d.key, T0), bare, `${d.name}: 장비 없이 실행됐다`);
    assert.equal(heroSkillText(d.key, 0), d.unlock);
  }
  const s = hero(LOW);
  for (const d of HERO_SKILLS) {
    assert.equal(heroSkillTier(s, d.key), 1);
    assert.equal(heroSkillStatus(s, d.key, T0).ok, true, `${d.name}: 1등급 장비로 안 열린다`);
  }
});

test("자는 중 · 기력 부족 · 배고픔 · 쿨다운이면 못 쓴다 — 버튼과 실행이 같은 판정", () => {
  const base = hero(TOP);
  const asleep = { ...base, pet: { ...base.pet, sleepUntil: T0 + HOUR } };
  assert.equal(heroSkillStatus(asleep, "train", T0).reason, "자는 중이에요");
  assert.equal(runHeroSkill(asleep, "train", T0), asleep);

  const tired = { ...base, pet: { ...base.pet, stats: { ...base.pet.stats, energy: 10 } } };
  assert.match(heroSkillStatus(tired, "venture", T0).reason ?? "", /기력/);
  assert.equal(runHeroSkill(tired, "venture", T0), tired);

  const hungry = { ...base, pet: { ...base.pet, stats: { ...base.pet.stats, hunger: 3 } } };
  assert.equal(heroSkillStatus(hungry, "train", T0).reason, "배고파해요");

  const once = runHeroSkill(base, "train", T0);
  assert.notEqual(once, base);
  const again = heroSkillStatus(once, "train", T0 + HOUR);
  assert.equal(again.ok, false);
  assert.ok(again.cdLeftMs > 0 && again.cdLeftMs <= 6 * HOUR, "쿨다운 남은 시간이 안 나온다");
  assert.equal(runHeroSkill(once, "train", T0 + HOUR), once);
});

// ── 3. 효과 ───────────────────────────────────────────────────────

test("★ 훈련 — 사냥 공격력 효과 + 성장, 기력·포만을 쓴다", () => {
  const s = hero(TOP);
  const t = heroSkillTier(s, "train");
  const r = runHeroSkill(s, "train", T0);
  assert.equal(r.buffs!.hunt!.amount, HERO_SKILL_TUNE.train.buffPct(t));
  assert.equal(r.buffs!.hunt!.until, T0 + HERO_SKILL_TUNE.train.hours * HOUR);
  assert.ok(r.pet.careXp > s.pet.careXp);
  assert.equal(r.pet.stats.energy, 100 - 20);
  assert.equal(r.pet.stats.hunger, 100 - 10);
});

test("훈련이 더 긴·더 센 요리 효과를 깎지 않는다(갱신 규칙 — 쌓이지도 줄지도 않는다)", () => {
  const s0 = hero(LOW);
  const s = { ...s0, buffs: { hunt: { until: T0 + 20 * HOUR, amount: 60 } } };
  const r = runHeroSkill(s, "train", T0);
  assert.equal(r.buffs!.hunt!.until, T0 + 20 * HOUR);
  assert.equal(r.buffs!.hunt!.amount, 60);
});

test("★ 채집 — 제철 작물을 등급만큼, ★ 바닥 이상으로 · 전설은 안 나온다 · 결정적", () => {
  const s = hero(TOP);
  const t = heroSkillTier(s, "forage");
  const r = runHeroSkill(s, "forage", T0);
  const season = seasonOf(T0);
  const got = Object.entries(r.farm.barn);
  const total = got.reduce((a, [, v]) => a + v.qty, 0);
  assert.equal(total, HERO_SKILL_TUNE.forage.count(t));
  for (const [k, v] of got) {
    const c = CROPS.find((x) => x.key === k)!;
    assert.ok(c, `작물이 아닌 '${k}' 가 나왔다`);
    assert.equal(c.season, season, `${c.name} 은 제철이 아니다`);
    assert.ok(!c.unique, `전설 작물 ${c.name} 이 채집으로 나왔다`);
    assert.ok(v.star >= HERO_SKILL_TUNE.forage.star(t));
  }
  assert.deepEqual(runHeroSkill(s, "forage", T0).farm.barn, r.farm.barn, "같은 상태에서 결과가 갈린다");
});

test("모험 — 하트는 표의 범위 안, 보물은 '가끔'(확률 근사)", () => {
  let hits = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const s0 = hero(TOP);
    const s = { ...s0, seed: 1000 + i * 7919 };
    const r = runHeroSkill(s, "venture", T0);
    const gain = r.coins - s.coins;
    const c = HERO_SKILL_TUNE.venture;
    assert.ok(gain >= c.coins(5) && gain <= c.coins(5) + c.spread, `모험 하트 ${gain} 가 범위 밖`);
    const loot = r.farm.fert > s.farm.fert || r.farm.gold > s.farm.gold || Object.keys(r.farm.barn).length > 0;
    if (loot) hits += 1;
  }
  const p = hits / N, want = HERO_SKILL_TUNE.venture.treasure(5);
  assert.ok(Math.abs(p - want) < 0.08, `보물 확률 ${p.toFixed(2)} 이 표(${want}) 와 너무 다르다`);
});

test("★ 기술은 돌봄 카운터를 안 올린다 — 진화 분기('가장 많이 해 준 돌봄')가 기술에 휩쓸리면 안 된다", () => {
  const s = hero(TOP);
  let r = s;
  let t = T0;
  for (const k of ["train", "forage", "venture"] as HeroSkill[]) {
    r = runHeroSkill(r, k, t);
    t += 1000;
  }
  // 새 섬은 care 가 비어 있고(undefined) clone 이 {} 로 편다 — 내용이 같은지만 본다
  assert.deepEqual(r.pet.care ?? {}, s.pet.care ?? {});
});

// ── 4. 돌봄 상태 = 액션 가드 ──────────────────────────────────────

test("★ careStatus 가 실제 액션 가드와 일치한다 — 무작위 상태 300개", () => {
  const fns: Partial<Record<CareKey, (s: IslandState, now: number) => IslandState>> = {
    play: playPet, clean: cleanPet, hug: hugPet, rest: restPet, medicine: medicinePet,
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 300; i++) {
    const s0 = createIsland("콩", null, T0);
    const s: IslandState = {
      ...s0,
      coins: Math.floor(rnd() * 120),
      pet: {
        ...s0.pet,
        sick: rnd() < 0.2,
        stats: { hunger: rnd() * 100, happy: rnd() * 100, energy: rnd() * 40, clean: rnd() * 100, health: rnd() < 0.5 ? 100 : rnd() * 100 },
        cd: { play: T0 - rnd() * 6 * HOUR, clean: T0 - rnd() * 9 * HOUR, hug: T0 - rnd() * 3 * HOUR, rest: T0 - rnd() * 12 * HOUR },
      },
    };
    for (const [k, fn] of Object.entries(fns) as [CareKey, (s: IslandState, now: number) => IslandState][]) {
      const ok = careStatus(s, k, T0).ok;
      const acted = fn(s, T0) !== s;
      assert.equal(ok, acted, `${i}번째 상태 · ${k}: 화면(${ok}) ≠ 엔진(${acted})`);
    }
  }
});

test("놀기 — 기력이 모자라면 이유를 말한다(예전엔 눌러도 조용히 무시됐다)", () => {
  const s0 = hero();
  const s = { ...s0, pet: { ...s0.pet, stats: { ...s0.pet.stats, energy: 10 } } };
  assert.equal(careStatus(s, "play", T0).reason, "기력 15 필요");
  const med = careStatus(hero(), "medicine", T0);
  assert.equal(med.reason, "건강해요 ✓");
  assert.equal(TUNING.pet.action.play.energy < 0, true, "전제: 놀기는 기력을 쓴다");
});
