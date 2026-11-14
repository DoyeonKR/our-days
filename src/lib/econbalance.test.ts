// 경제 밸런스 lock(2026-11-11 경제 리뷰 — 실제 엔진으로 1년을 돌린 시뮬레이션의 결론).
// ① 주인 다시 잡기 보상이 경제를 덮었다 ② 정원 ★5 배수 7 이 손 없이 도는 밭에 붙었다 ③ 합치기 스킨이 합치기 수입의 약 10배
// ④ 비싼 미끼가 쓰라고 만든 낚시터에서도 손해 · 맨 끝 낚시터(심해)가 용궁사보다 덜 벌었다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BAITS, SPOTS, baitIndex, catchValue, rollCatch, spotMinBait, spotOf, type FishSpot } from "./fishing.ts";
import { BOSSES, bossReward } from "./fishingworld.ts";
import { DAILY_COIN_CAP } from "./merge.ts";
import { SKINS } from "./mergeskins.ts";
import { TUNING } from "./island.ts";

test("주인 — 처음 잡기 보상은 그대로(합 171,400) · 다시 잡기는 4분의 1", () => {
  assert.equal(BOSSES.reduce((n, b) => n + bossReward(b, 0), 0), 171_400);
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
