// 경제 밸런스 lock(2026-11-11 경제 리뷰 — 실제 엔진으로 1년을 돌린 시뮬레이션의 결론).
// ① 주인 다시 잡기 보상이 경제를 덮었다 ② 정원 ★5 배수 7 이 손 없이 도는 밭에 붙었다 ③ 합치기 스킨이 합치기 수입의 약 10배
// ④ 비싼 미끼가 쓰라고 만든 낚시터에서도 손해 · 맨 끝 낚시터(심해)가 용궁사보다 덜 벌었다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BAITS, SPOTS, baitIndex, catchValue, rollCatch, spotMinBait, spotOf, type FishSpot } from "./fishing.ts";
import { BOSSES, bossBeaten, bossChunk, bossHp, bossHurt, bossReward, bossStarted, bossTriesLeft, type BossRecord } from "./fishingworld.ts";
import { RAID_TIERS, raidTier } from "./bossmark.ts";
import { BOSS_CALL_DAY_CAP, BOSS_CALL_MAX, applyBossCall } from "./bosscall.ts";
import { AQUA_LIGHTS, AQUA_LIGHT_TOTAL } from "./aqualight.ts";
import type { IslandState } from "./island.ts";
import { DAILY_COIN_CAP } from "./merge.ts";
import { SKINS } from "./mergeskins.ts";
import { TUNING } from "./island.ts";

test("주인 — 처음 잡기 보상은 그대로(합 201,400 — 2026-11-18 남극 세종기지 빙벽의 범고래 30,000 을 더했다) · 다시 잡기는 4분의 1", () => {
  assert.equal(BOSSES.reduce((n, b) => n + bossReward(b, 0), 0), 201_400);
  for (const b of BOSSES) {
    assert.equal(bossReward(b, 0), b.coins);
    assert.equal(bossReward(b, 1), Math.round(b.coins / 4), b.key);
    assert.equal(bossReward(b, 9), bossReward(b, 1));
  }
});

test("정원 ★ 배수 — 늘 오르고, ★5 는 4 안팎(예전 7)", () => {
  const m = TUNING.farm.starMult;
  for (let s = 2; s <= 5; s++) assert.ok(m[s] > m[s - 1], `★${s}`);
  assert.ok(m[5] <= 4.5 && m[5] >= 4, `★5 ${m[5]}`);
});

test("합치기 스킨 — 전부 사는 값이 합치기 하루 상한으로 2년 안(예전 5,270일)", () => {
  const total = SKINS.reduce((n, k) => n + k.price, 0);
  assert.ok(total / DAILY_COIN_CAP < 730, `${total} = 상한 ${Math.round(total / DAILY_COIN_CAP)}일`);
});

/** 한 번 던질 때 순이익 — 끌어올림 80% · 다 팔기 · 쓰레기 2하트(fishev.ts 와 같은 어림) */
function net(spot: FishSpot, bait: number, luck = 25, n = 3000): number {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const c = rollCatch(spot, luck, 0.6, (Math.imul(i + 1, 2654435761) + 7) >>> 0, { bait, junk: true });
    v += c.junk ? 2 : catchValue(c);
  }
  return (v / n) * 0.8 - (bait === 0 ? 0 : BAITS[bait].price / BAITS[bait].uses);
}

test("낚시 — 뒤 낚시터일수록 한 번당 순이익이 줄지 않는다(심해 > 거진항 ≥ 용궁사 > 울릉도)", () => {
  const at = (k: string) => { const s = spotOf(k)!; return net(s, baitIndex(spotMinBait(s).key)); };
  const [ocean, palace, starsea, abyss] = ["ocean", "palace", "starsea", "abyss"].map(at);
  assert.ok(palace > ocean, `용궁사 ${palace} > 울릉도 ${ocean}`);
  assert.ok(starsea >= palace - 2, `거진항 ${starsea} ≥ 용궁사 ${palace}`);
  assert.ok(abyss > starsea, `심해 ${abyss} > 거진항 ${starsea} — 예전엔 33 대 50`);
  assert.equal(SPOTS[SPOTS.length - 1].key, "abyss");
});

// 심해는 시작 미끼(떡밥)가 본전 자리다. 발광 · 진주 · 별가루는 심해에서 도감(실러캔스 · 대왕오징어 · 크라켄)을 노리는 값이라
// 손해를 감수한다 — 미끼 1% 규칙(사용자 결정)을 지키려고 심해 물고기 구성은 그대로 두었다(2026-11-11).
test("낚시 — 비싼 미끼는 쓰라고 만든 낚시터에서 본전 이상(행운 25)", () => {
  const meant: Record<string, string[]> = {
    bait_squid: ["pond", "jungle", "harbor", "reef"], bait_paste: ["jungle", "ocean", "abyss"],
    bait_glow: ["palace", "starsea"], bait_pearl: ["palace", "starsea"], bait_star: ["palace", "starsea"],
  };
  for (const [k, spots] of Object.entries(meant)) for (const sp of spots) {
    const e = net(spotOf(sp)!, baitIndex(k));
    assert.ok(e >= -1, `${k} @ ${sp}: ${e.toFixed(1)}`);
  }
});

/* ── 2026-11-18: 레이드 점수 보상 · 보내 주면 주인이 빨리 · 수조 조명 ─────────────────────
 * §10.25 의 1년 시뮬레이션(combo_sim)은 레포에 없다 — 그래서 이번에 건드린 길(주인 토벌 보상)만 실제 엔진 함수로 1년을 돌리는
 * 모형을 두고, 늘어나고 줄어든 하트를 §10.25 의 1년 순수입(하루 순수입 × 365)에 견준다.
 *  · 주인 15마리가 첫날부터 다 열려 있다고 친다(위 경계 — 실제로는 레벨을 따라 열린다).
 *  · 하루 R 판을 둘이 번갈아 가장 비싼, 도전할 수 있는 주인에게 쓴다(협공 1.5배 · 하루 3번 · 쉬는 7일 · 다시 잡기 4분의 1 — 엔진 그대로).
 *  · 한 판에 깎는 양 = 한 판 몫 × 점수. 한 판 몫이 남은 체력을 넘으면 토벌.
 *  · 보내 주기는 하루 H 시간(희귀 물고기 2시간씩)을 가장 비싼 쉬는 주인에게 — 경제로는 가장 나쁜 쪽(위 경계). */
const DAY0 = "2027-01-04";
const dayN = (n: number) => new Date(Date.parse(`${DAY0}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
type YearOut = { coins: number; kills: number };
// 1년 모형은 §10.25 시뮬레이션(주인 15마리)의 1년 순수입과 견준다 — 그 뒤에 더한 주인(2026-11-18 남극 세종기지 bingbyeok)을 넣으면 분자에만 새 낚시터 수입이 들어가
//   같은 세상끼리 견주지 않게 된다. 그래서 그 15마리로만 돌린다(새 낚시터는 새 수입이라 따로 본다)
const SIM_BOSSES = BOSSES.filter((b) => b.key !== "bingbyeok");
const BY_COINS = [...SIM_BOSSES].sort((x, y) => y.coins - x.coins);
function bossYear(opts: { raids: number; score: number; tiered: boolean; callH: number }): YearOut {
  let recs: Record<string, BossRecord> = {}, call: IslandState["bossCall"] = undefined, coins = 0, kills = 0;
  const who = ["a", "b"];
  for (let d = 0; d < 365; d++) {
    const today = dayN(d);
    // 보내 주기 — 가장 비싼 쉬는 주인부터
    let left = opts.callH;
    for (const b of BY_COINS) {
      while (left >= 2) {
        const st = { fishing: { bosses: recs }, bossCall: call, coins: 0 } as unknown as IslandState;
        const r = applyBossCall(st, b.key, 3, today);
        if (!r.plan || !("total" in r.plan)) break;
        recs = r.state.fishing!.bosses; call = r.state.bossCall; left -= r.plan.add;
      }
    }
    for (let i = 0; i < opts.raids; i++) {
      const p = who[i % 2];
      const b = BY_COINS.find((x) => {
        const r = recs[x.key];
        return !(r?.until && r.until > today) && bossTriesLeft(r, p, today) > 0;
      });
      if (!b) break;
      const opened = bossStarted(recs[b.key], p, today);
      const chunk = bossChunk(b, opened, p, today), hp = bossHp(opened, today), dealt = chunk * opts.score;
      if (dealt >= hp) {
        const base = bossReward(b, opened.caught);
        coins += opts.tiered ? Math.round(base * raidTier(opts.score).mult) : base;
        kills++;
        recs = { ...recs, [b.key]: bossBeaten(opened, p, today) };
      } else recs = { ...recs, [b.key]: bossHurt(opened, dealt, today, p) };
    }
  }
  return { coins, kills };
}
/** §10.25 의 1년 순수입 — 하루 순수입 × 365 */
const YEAR = { casual: 10_316 * 365, keen: 19_800 * 365 };
const pct = (x: number) => Math.round(x * 1000) / 10;

test("레이드 단계 — 아래부터 오르고 0.8 ~ 1.25배, §10.25 가정(0.85) = 1배, 대충 손(0.57~0.67) 0.9 · 잘하는 손 위쪽(0.86~) 1.1", () => {
  for (let i = 1; i < RAID_TIERS.length; i++) assert.ok(RAID_TIERS[i].min > RAID_TIERS[i - 1].min && RAID_TIERS[i].mult > RAID_TIERS[i - 1].mult);
  assert.equal(RAID_TIERS[0].mult, 0.8);
  assert.equal(RAID_TIERS[RAID_TIERS.length - 1].mult, 1.25);
  for (const s of [0.57, 0.63, 0.67]) assert.equal(raidTier(s).mult, 0.9, `${s}`);
  for (const s of [0.7, 0.81, 0.85]) assert.equal(raidTier(s).mult, 1, `${s}`);
  for (const s of [0.86, 0.88]) assert.equal(raidTier(s).mult, 1.1, `${s}`);
  assert.equal(raidTier(0.95).mult, 1.25);
  assert.equal(raidTier(null).mult, 1);
});

test("1년 모형 — 레이드 점수 보상 + 보내 주기가 §10.25 1년 순수입의 ±5% 안", (t) => {
  const rows: [string, number, number, number, number][] = [
    // 이름, 하루 판 수, 점수, 하루 보내 주기 시간, 1년 순수입
    ["대충 · 실제 손(0.65)", 6, 0.65, 8, YEAR.casual],
    ["대충 · §10.25 가정(0.85)", 6, 0.85, 8, YEAR.casual],
    ["열심 · 잘하는 손(0.85)", 24, 0.85, 12, YEAR.keen],
    ["열심 · 잘하는 봇 위쪽(0.88)", 24, 0.88, 12, YEAR.keen],
    ["열심 · 최고 단계(0.95)", 24, 0.95, 12, YEAR.keen],
  ];
  for (const [name, raids, score, callH, year] of rows) {
    const old = bossYear({ raids, score, tiered: false, callH: 0 });
    const tier = bossYear({ raids, score, tiered: true, callH: 0 });
    const both = bossYear({ raids, score, tiered: true, callH });
    const d6 = (tier.coins - old.coins) / year, d4 = (both.coins - tier.coins) / year, all = (both.coins - old.coins) / year;
    t.diagnostic(`${name}: 주인 1년 ${old.coins}(${old.kills}마리) → 점수 보상 ${tier.coins}(${pct(d6)}%) → +보내 주기 ${both.coins}(${both.kills}마리, ${pct(d4)}%) · 합 ${pct(all)}% · 1년 순수입 ${year} 중 주인 ${pct(old.coins / year)}%`);
    // 0.95 는 봇도 못 넘는 손 — 그 커플만 5% 를 조금 넘을 수 있다(보상이 '잘한 만큼'이라는 뜻). 나머지는 ±5%
    if (score < 0.92) assert.ok(Math.abs(all) <= 0.05, `${name} ${pct(all)}%`);
    assert.ok(d4 >= 0 && d4 <= 0.02, `${name} 보내 주기 ${pct(d4)}%`);
  }
});

test("보내 주기 — 하루 상한(6시간)보다 많이 보내도 상한만큼만", () => {
  assert.equal(BOSS_CALL_DAY_CAP, 6);
  assert.equal(BOSS_CALL_MAX, 24);
  const capped = bossYear({ raids: 24, score: 0.85, tiered: true, callH: 6 });
  const flood = bossYear({ raids: 24, score: 0.85, tiered: true, callH: 100 });
  assert.equal(flood.coins, capped.coins);
});

test("수조 조명 — 값이 오르기만 하고, 합이 다 산 뒤 1년 잔액의 의미 있는 몫(대충 잔액 이상 · 열심 잔액의 30~60%)", () => {
  for (let i = 1; i < AQUA_LIGHTS.length; i++) assert.ok(AQUA_LIGHTS[i].price > AQUA_LIGHTS[i - 1].price, AQUA_LIGHTS[i].key);
  assert.equal(AQUA_LIGHT_TOTAL, 2_480_000);
  assert.ok(AQUA_LIGHT_TOTAL >= 2_107_716, "대충 커플의 365일째 잔액(§10.25)");
  const keen = AQUA_LIGHT_TOTAL / 5_569_397;
  assert.ok(keen >= 0.3 && keen <= 0.6, `열심 잔액의 ${pct(keen)}%`);
  // 맨 아래는 대충 커플 사흘치, 맨 위는 열심 커플 한 달 반 안쪽
  assert.ok(AQUA_LIGHTS[0].price <= 10_316 * 3);
  assert.ok(AQUA_LIGHTS[AQUA_LIGHTS.length - 1].price <= 19_800 * 46);
});
