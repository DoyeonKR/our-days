// 2026-11-18 게임 경제 업그레이드 셋을 잠근다 — ④ 보내 주면 그 낚시터 주인이 빨리 ⑥ 레이드 점수에 따른 토벌 보상 ⑦ 수조 조명(늦은 소모처).
// 공통 규칙(§14.4.6 · §10.19): 새 저장은 섬 맨 위 칸(raidMark · bossCall · aquaLight)에만. 옛 앱은 s.fishing · s.aquarium · s.aquaPlus 를
// 아는 칸으로 다시 지으므로, 그 셋 안에 새 칸이 생기면 안 되고 쓴 하트 · 산 조명은 다시 짓기를 지나도 남아야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addFish, aquaOf, type AquaResult } from "./aquarium.ts";
import { bossLost, bossOpen, bossWon, bossWinTier, fishingOf, releaseBoss, releaseBossPlan, releaseToSea } from "./fishing.ts";
import { BOSS_TAKEN, bossOf, bossReward, type BossRecord } from "./fishingworld.ts";
import { RAID_MARK_KEEP, noteRaidScore, paidMult, raidAvg, raidMarkOf, raidScores, raidTier } from "./bossmark.ts";
import { BOSS_CALL_DAY_CAP, BOSS_CALL_HOURS, BOSS_CALL_MAX, applyBossCall, bossCallDayLeft, bossCallOf, planBossCall } from "./bosscall.ts";
import { AQUA_LIGHTS, aquaLightRec, buyAquaLight, setAquaLight } from "./aqualight.ts";
import { raidInterrupted, raidKillPace, raidTune, startRaid } from "./bossraid.ts";
import { createIsland, type IslandState } from "./island.ts";

const T0 = Date.UTC(2026, 10, 18, 3); // KST 정오
const DAY = "2026-11-18";
const rich = (coins = 5_000_000): IslandState => ({ ...createIsland("콩", null, T0), coins });
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.ok(r.ok, (r as unknown as { reason?: string }).reason);
  return r as Extract<T, { ok: true }>;
}
/** 옛 앱의 다시 짓기 흉내 — s.fishing 은 fishingOf 가 아는 칸으로, 맨 위 칸은 ...st 로 그대로 흐른다 */
const oldAppRebuild = (st: IslandState): IslandState => ({ ...st, fishing: fishingOf(st) });
const withBoss = (st: IslandState, key: string, rec: BossRecord): IslandState => ({ ...st, fishing: { ...fishingOf(st), level: 40, bosses: { ...fishingOf(st).bosses, [key]: rec } } });

/* ── ⑥ 레이드 점수 ─────────────────────────────── */

test("⑥ 점수 적기 — 같은 판은 한 번 · 출현이 바뀌면 지난 점수는 버린다 · 최근 16판", () => {
  let st = rich();
  st = noteRaidScore(st, "dolsoe", 0, 11, 0.9);
  assert.equal(noteRaidScore(st, "dolsoe", 0, 11, 0.1), st, "같은 판 번호는 다시 안 적는다");
  st = noteRaidScore(st, "dolsoe", 0, 12, 0.7);
  assert.equal(raidAvg(st, "dolsoe", 0), 0.8);
  assert.equal(raidAvg(st, "dolsoe", 1), null, "다른 출현의 평균은 없다");
  st = noteRaidScore(st, "dolsoe", 1, 13, 0.5);
  assert.deepEqual(raidScores(st, "dolsoe", 1), [0.5]);
  for (let i = 0; i < 30; i++) st = noteRaidScore(st, "dolsoe", 1, 100 + i, 1);
  assert.equal(raidScores(st, "dolsoe", 1).length, RAID_MARK_KEEP);
  // 망가진 저장값은 버린다
  assert.deepEqual(raidMarkOf({ raidMark: { x: { n: "a" }, y: { n: 1, s: [[1, 999], ["z", 1]] } } }), { y: { n: 1, s: [[1, 100]] } });
});

test("⑥ bossLost — 깎기가 기록된 저장에서만 점수를 적는다(다시 받은 저장 · 상대가 먼저 잡음은 안 적는다)", () => {
  let st = withBoss(rich(), "dolsoe", { hp: 1, at: DAY, tries: {}, caught: 0, until: "" });
  st = ok(bossOpen(st, "dolsoe", "me", DAY)).state;
  const a = ok(bossLost(st, "dolsoe", 0.1, DAY, "me", 0, 7, 0.82)).state;
  assert.deepEqual(raidScores(a, "dolsoe", 0), [0.82]);
  assert.equal(ok(bossLost(a, "dolsoe", 0.1, DAY, "me", 0, 7, 0.1)).state, a, "같은 판을 다시 저장하면 그대로");
  const gone = bossLost(a, "dolsoe", 0.1, DAY, "me", 5, 8, 0.3);
  assert.ok(!gone.ok && gone.reason === BOSS_TAKEN);
  // 점수 칸은 s.fishing 이 아니라 맨 위 — 옛 앱 다시 짓기를 지나도 남는다
  assert.equal("raidMark" in (a.fishing as object), false);
  assert.deepEqual(raidScores(oldAppRebuild(a), "dolsoe", 0), [0.82]);
});

test("⑥ bossWon — 이번 출현 평균의 배율로 보상 · 다시 받은 저장은 그대로 · 점수가 없으면 1배", () => {
  const boss = bossOf("geomeun")!;
  const base = withBoss(rich(0), "geomeun", { hp: 0.05, at: DAY, tries: {}, caught: 2, until: "" });
  // 점수 없음 = 1배(옛 앱이 싸운 출현)
  const plain = ok(bossWon(base, "geomeun", "me", DAY, 2)).state;
  assert.equal(plain.coins, bossReward(boss, 2));
  // 높은 점수 둘 = 1.25배
  let st = noteRaidScore(base, "geomeun", 2, 1, 0.96);
  st = noteRaidScore(st, "geomeun", 2, 2, 0.94);
  assert.equal(bossWinTier(st, "geomeun", 2).mult, 1.25);
  const won = ok(bossWon(st, "geomeun", "me", DAY, 2)).state;
  assert.equal(won.coins, Math.round(bossReward(boss, 2) * 1.25));
  assert.equal(paidMult(won, "geomeun", 3), 1.25, "준 배율을 남긴다(다시 받은 저장의 문구)");
  assert.equal(raidAvg(won, "geomeun", 3), null, "다음 출현은 빈 점수로");
  // 응답을 잃고 다시 저장 — 아무것도 안 바뀐다(두 번 안 준다)
  assert.equal(ok(bossWon(won, "geomeun", "me", DAY, 2)).state, won);
  // 낮은 점수 = 0.8배
  const low = ok(bossWon(noteRaidScore(base, "geomeun", 2, 1, 0.3), "geomeun", "me", DAY, 2)).state;
  assert.equal(low.coins, Math.round(bossReward(boss, 2) * 0.8));
  // 토벌 판의 빠르기도 한 줄로 더한다
  const killed = ok(bossWon(noteRaidScore(base, "geomeun", 2, 1, 0.9), "geomeun", "me", DAY, 2, { id: 9, score: 1 })).state;
  assert.equal(killed.coins, Math.round(bossReward(boss, 2) * 1.25), "(0.9 + 1) / 2 = 0.95");
  // 옛 앱 다시 짓기 뒤에도 하트 · 잡은 수가 그대로
  const rebuilt = oldAppRebuild(won);
  assert.equal(rebuilt.coins, won.coins);
  assert.equal(rebuilt.fishing!.bosses.geomeun.caught, 3);
});

test("⑥ 토벌 판의 빠르기 — 10초 넘게 싸운 토벌 판만, 30초로 늘려 잰다", () => {
  const tune = raidTune(4.6, 0, { power: 0, line: 0 });
  const r = startRaid(1, tune, 0.5, 0.14);
  assert.equal(raidKillPace(r), null, "끝나지 않은 판");
  assert.equal(raidKillPace({ ...r, end: "kill", t: 5, dealt: tune.need * 0.3 }), null, "짧게 끝난 판은 빼고");
  assert.equal(raidKillPace({ ...r, end: "kill", t: 15, dealt: tune.need * 0.4 }), 0.8);
  assert.equal(raidKillPace({ ...r, end: "kill", t: 12, dealt: tune.need * 0.9 }), 1, "1 을 넘지 않는다");
  assert.equal(raidTier(0.8).mult, 1);
  // 시작 직후 앱이 숨어 끝난 판은 평균에 안 넣는다 · 줄이 다 끊긴 판 · 30초를 다 싸운 판은 넣는다
  assert.equal(raidInterrupted({ ...r, end: "time", t: 0.4, away: true }), true);
  assert.equal(raidInterrupted({ ...r, end: "time", t: 0.4 }), false, "그만하기로 끝낸 판은 진짜 점수");
  assert.equal(raidInterrupted({ ...r, end: "down", t: 3 }), false);
  assert.equal(raidInterrupted({ ...r, end: "time", t: 30 }), false);
});

test("⑥ 화면 — 결과 창이 단계 줄을 그리고, 레이드는 못 깎은 판도 저장해 평균에 넣는다", () => {
  const raid = readFileSync(join(import.meta.dirname, "../components/BossRaidGame.tsx"), "utf8");
  assert.match(raid, /RaidTierRow/);
  const game = readFileSync(join(import.meta.dirname, "../components/FishingGame.tsx"), "utf8");
  assert.doesNotMatch(game, /if \(dealt <= 0\.0005\) return;/, "못 깎은 판을 빼면 못한 판만 평균에서 빠진다");
  assert.match(game, /bossLost\(s, cur\.key, dealt, day, who, cur\.seen, cur\.seed, raidInterrupted\(r\) \? undefined : raidScore\(r\)\)/);
  assert.match(game, /const kill = pace === null \? undefined : \{ id: cur\.seed, score: pace \}; raidRetry\.current = \(\) => saveBossWin\(b, cur\.seen, kill\);/);
});

/* ── ④ 보내 주면 주인이 빨리 ─────────────────────── */

const resting = (caught = 1): BossRecord => ({ hp: 1, at: DAY, tries: {}, caught, until: "2026-11-25" });

test("④ 쉬는 주인만 · 등급만큼 · 하루 상한 · 24시간이 차면 하루 당긴다 · 한 번 쉴 때 상한", () => {
  let st = withBoss(rich(), "dolsoe", resting());
  assert.equal(BOSS_CALL_HOURS.length, 8);
  // 태초(6) — 하루 상한 6 을 혼자 채운다
  const p = planBossCall(st, "dolsoe", 7, DAY)!;
  assert.ok("total" in p && p.add === BOSS_CALL_DAY_CAP && p.days === 0);
  st = applyBossCall(st, "dolsoe", 7, DAY).state;
  assert.equal(bossCallDayLeft(st, DAY), 0);
  const blocked = planBossCall(st, "dolsoe", 0, DAY)!;
  assert.ok(!("total" in blocked) && blocked.add === 0);
  // 나흘에 걸쳐 24시간 — until 이 하루 당겨진다
  for (const d of ["2026-11-19", "2026-11-20", "2026-11-21"]) st = applyBossCall(st, "dolsoe", 7, d).state;
  assert.equal(st.fishing!.bosses.dolsoe.until, "2026-11-24");
  assert.equal(bossCallOf(st).b.dolsoe.h, BOSS_CALL_MAX);
  // 한 번 쉴 때 상한 — 더는 안 당긴다
  const full = planBossCall(st, "dolsoe", 7, "2026-11-22")!;
  assert.ok(!("total" in full));
  // 날짜를 되돌려도 하루 상한이 다시 안 열린다
  assert.equal(bossCallDayLeft(st, "2026-11-19"), 0);
  // 출현 번호는 그대로 — 옛 앱 다시 짓기 뒤에도 당긴 날이 남는다(until 은 옛 앱도 아는 칸)
  assert.equal(st.fishing!.bosses.dolsoe.caught, 1);
  assert.equal(oldAppRebuild(st).fishing!.bosses.dolsoe.until, "2026-11-24");
  assert.equal("bossCall" in (st.fishing as object), false);
});

test("④ 효과 없음 — 낚시터에 있는 주인 · 안 잡은 주인 · 새 출현은 모은 시간을 0 부터", () => {
  const here = withBoss(rich(), "dolsoe", { hp: 0.5, at: DAY, tries: {}, caught: 1, until: "2026-11-10" });
  const p = planBossCall(here, "dolsoe", 7, DAY)!;
  assert.ok(!("total" in p) && p.why.includes("낚시터"));
  assert.equal(planBossCall(withBoss(rich(), "dolsoe", { hp: 1, at: DAY, tries: {}, caught: 0, until: "" }), "dolsoe", 7, DAY), null, "안 잡은 주인은 말하지 않는다");
  assert.equal(applyBossCall(here, "dolsoe", 7, DAY).state, here);
  let st = applyBossCall(withBoss(rich(), "dolsoe", resting(1)), "dolsoe", 7, DAY).state;
  st = withBoss(st, "dolsoe", resting(2)); // 그 사이 다시 잡혔다
  const next = planBossCall(st, "dolsoe", 0, "2026-11-19")!;
  assert.ok("total" in next && next.total === BOSS_CALL_HOURS[0], "새 출현은 0 부터");
});

test("④ 어느 주인인가 — 잡힌 낚시터 → 계열이 사는 첫 낚시터 → 주인 계열, 다 큰 물고기만", () => {
  assert.equal(releaseBoss({ id: 1, family: "guppy", stage: 2 }), "dolsoe");
  assert.equal(releaseBoss({ id: 1, family: "guppy", stage: 1 }), null, "다 큰 물고기만");
  assert.equal(releaseBoss({ id: 1, family: "koi", stage: 2 }), "hongryeon");
  assert.equal(releaseBoss({ id: 1, family: "kraken", stage: 2 }), "simyeon", "pool 에 없으면 주인 계열");
  const life = { names: {}, memorial: [], n: 0, log: { "5": [{ t: 0, k: "caught" as const, key: "guppy", spot: "jungle" }] } };
  assert.equal(releaseBoss({ id: 5, family: "guppy", stage: 2 }, life), "geurimja", "잡힌 낚시터가 먼저");
});

test("④ releaseToSea — 같은 저장에서 주인을 부르고 문구에 남긴다 · 확인창 계산과 같다", () => {
  let st = withBoss(rich(), "dolsoe", resting());
  st = addFish(st, "guppy", 2, undefined, T0);
  const id = aquaOf(st).fish[0].id;
  const plan = releaseBossPlan(st, id, T0)!;
  assert.ok(plan && "total" in plan);
  const r = ok(releaseToSea(st, id, T0));
  assert.match(r.note ?? "", /돌쇠에게 \d시간 모였어요\(\d+\/24\)/);
  assert.equal(bossCallOf(r.state).b.dolsoe.h, plan.add);
});

/* ── ⑦ 수조 조명 ─────────────────────────────── */

test("⑦ 조명 — 사다리 순서대로 · 하트가 빠지고 바로 켠다 · 끄기 · 산 것만 켠다", () => {
  let st = rich(AQUA_LIGHTS[0].price + AQUA_LIGHTS[1].price);
  const skip = buyAquaLight(st, AQUA_LIGHTS[1].key);
  assert.ok(!skip.ok, "앞 조명을 사야 다음이 열린다");
  st = ok(buyAquaLight(st, AQUA_LIGHTS[0].key)).state;
  assert.equal(st.coins, AQUA_LIGHTS[1].price);
  assert.deepEqual(aquaLightRec(st), { owned: [AQUA_LIGHTS[0].key], on: AQUA_LIGHTS[0].key });
  assert.ok(!buyAquaLight(st, AQUA_LIGHTS[0].key).ok, "두 번 안 산다");
  st = ok(buyAquaLight(st, AQUA_LIGHTS[1].key)).state;
  assert.equal(st.coins, 0);
  assert.ok(!buyAquaLight(st, AQUA_LIGHTS[2].key).ok, "하트가 모자라요");
  st = ok(setAquaLight(st, null)).state;
  assert.equal(aquaLightRec(st).on, null);
  assert.ok(!setAquaLight(st, AQUA_LIGHTS[5].key).ok);
});

test("⑦ 조명 — 맨 위 칸이라 수조 저장 · 옛 앱 다시 짓기를 지나도 남는다", () => {
  let st = ok(buyAquaLight(rich(), AQUA_LIGHTS[0].key)).state;
  st = addFish(st, "guppy", 0, undefined, T0); // 수조 저장(stow)을 한 번 지나게
  const after: AquaResult = { ok: true, state: st };
  assert.ok(after.ok);
  assert.deepEqual(aquaLightRec(oldAppRebuild(st)).owned, [AQUA_LIGHTS[0].key]);
  assert.equal("aquaLight" in (st.aquarium as object), false);
  assert.equal("aquaLight" in ((st as { aquaPlus?: object }).aquaPlus ?? {}), false);
});

test("⑦ 조명 — 3D 장면이 켠 조명을 받아 빛 색 · 세기를 바꾼다(그림 파일 없이)", () => {
  const scene = readFileSync(join(import.meta.dirname, "aqua3d/scene.ts"), "utf8");
  assert.match(scene, /applyLight\(next\.light\?\?null\)/);
  assert.match(scene, /lightK\[1\]/);
  const game = readFileSync(join(import.meta.dirname, "../components/AquariumGame.tsx"), "utf8");
  assert.match(game, /light: lights\.on/);
  assert.match(game, /<LightShop /);
});
