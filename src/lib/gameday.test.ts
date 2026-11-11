// 폰 날짜 되돌리기 lock(2026-11-11 경제 리뷰). 낚시 · 합성 · 수조가 기기 시계(Date.now)를 그대로 쓰고, 엔진은 하루 칸을 '같은 날인가'로만 봐서
// 날짜를 어제 · 오늘로 번갈아 바꾸면 하루 상한이 날마다 다시 열렸다(실측: 주인 도전 15번 — 정상 6번 · 합성 하트 2,000 — 정상 800 · 크라켄 22일치 가짜 날에 90,000).
// 고친 것: ① 화면은 서버에 맞춘 시각(islandsync.gameNow) ② 엔진은 오늘이 남긴 날보다 '뒤'일 때만 비우고, 되돌린 날은 비우지도 세지도 않는다.
// 앞으로만 돌리는 시계는 엔진이 진짜 시간과 가를 수 없다 — 그건 ①이 막는다(맨 아래 화면 테스트).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addFish, aquaOf, claimRequest, stow, syncAqua } from "./aquarium.ts";
import { BOSSES, BOSS_RETURN_DAYS, BOSS_TRIES, bossHp, laterDay } from "./fishingworld.ts";
import { FREE_WORMS, SPOTS, baitStock, bossBlockOf, bossLost, bossOpen, bossRefund, bossWon, claimFishGoal, expedFor, fishingOf, sellCatch, spendBait, type FishCatch } from "./fishing.ts";
import { DAILY_COIN_CAP, settleGame } from "./merge.ts";
import { createIsland, type IslandState } from "./island.ts";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const D1 = "2026-11-12", D0 = "2026-11-11", D2 = "2026-11-13";
const T0 = Date.parse("2026-11-12T20:00:00+09:00");
const fresh = (coins = 0): IslandState => ({ ...createIsland("x", null, T0), coins });
const lv50 = (s: IslandState): IslandState => ({ ...s, fishing: { ...fishingOf(s), level: 50 } });
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };

test("laterDay — 둘 중 나중 날 · 빈 값은 늘 앞", () => {
  assert.equal(laterDay(D1, D0), D1);
  assert.equal(laterDay(D0, D1), D1);
  assert.equal(laterDay("", D0), D0);
  assert.equal(laterDay(undefined, D0), D0);
});

test("합성 — 날짜 둘을 번갈아 정산해도 하트는 진짜 이틀치(하루 상한 × 2)를 넘지 않는다", () => {
  let s = fresh();
  let got = 0;
  for (const [i, d] of [D1, D2, D1, D2, D1].entries()) {
    const r = settleGame(s, "A", 30000, 11, d, 100 + i);
    s = r.state;
    got += r.coins;
  }
  assert.equal(got, DAILY_COIN_CAP * 2, `예전엔 ${DAILY_COIN_CAP * 5}`);
  // 되돌린 날은 남긴 날(뒤 날)의 상한을 같이 쓴다 — 날짜도 뒤 날 그대로
  assert.equal(s.merge?.day, D2);
  // 진짜로 다음 날이 되면 다시 열린다
  assert.equal(settleGame(s, "A", 30000, 11, "2026-11-14", 999).coins, DAILY_COIN_CAP);
});

test("낚시 하루 목표 — 날짜를 되돌린 날엔 받은 목표가 다시 열리지 않는다", () => {
  let s = lv50(fresh(10_000));
  const spot = SPOTS[0];
  let got = 0;
  for (const d of [D1, D0, D1, D0, D1]) {
    const c = spendBait(s, spot, "float", "bait_worm", d, 20);
    if (c.ok) s = c.state;
    for (let i = 0; i < 3; i++) {
      const r = sellCatch(s, guppy, d);
      if (r.ok) s = r.state;
    }
    for (const id of ["d_landed", "d_cast"]) {
      const r = claimFishGoal(s, id, d);
      if (r.ok) {
        got += r.state.coins - s.coins;
        s = r.state;
      }
    }
  }
  assert.equal(got, 100, "진짜 하루(60 + 40) 한 번 — 예전엔 날짜를 바꿀 때마다 다시");
  assert.equal(fishingOf(s).day, D1, "되돌린 날로 하루 칸의 날짜가 내려가지 않는다");
  // 진짜 다음 날은 비워진다
  const next = spendBait(s, spot, "float", "bait_worm", D2, 20);
  assert.ok(next.ok);
  if (next.ok) assert.equal(fishingOf(next.state).dayLanded, 0);
});

test("공짜 지렁이 — 날짜를 되돌린 날엔 다시 차지 않는다 · 진짜 다음 날엔 찬다", () => {
  let s = fresh();
  const spot = SPOTS[0];
  for (let i = 0; i < FREE_WORMS; i++) {
    const r = spendBait(s, spot, "float", "bait_worm", D1);
    assert.ok(r.ok);
    if (r.ok) s = r.state;
  }
  const f = fishingOf(s);
  assert.equal(baitStock(f, "bait_worm", D1), 0);
  assert.equal(baitStock(f, "bait_worm", D0), 0, "어제로 되돌려도 안 찬다");
  assert.equal(spendBait(s, spot, "float", "bait_worm", D0).ok, false);
  assert.equal(baitStock(f, "bait_worm", D2), FREE_WORMS, "진짜 다음 날");
});

test("주인 도전 — 날짜 둘을 번갈아도 하루 도전 수가 다시 열리지 않는다(예전 15번)", () => {
  let s = lv50(fresh());
  const boss = BOSSES.find((b) => b.key === "simyeon")!;
  let opens = 0;
  for (const d of [D1, D0, D1, D0, D1]) for (let k = 0; k < 5; k++) {
    const o = bossOpen(s, boss.key, "A", d);
    if (o.ok) {
      s = o.state;
      opens++;
    }
  }
  assert.ok(opens <= BOSS_TRIES * 2, `${opens}번`);
  assert.equal(opens, BOSS_TRIES, "먼저 쓴 날이 뒤 날이면 앞 날로 되돌려도 그 날의 도전을 같이 쓴다");
  const rec = fishingOf(s).bosses[boss.key];
  assert.equal(rec.tries.A.day, D1);
  assert.equal(rec.at, D1);
  // 되돌린 날에 돌려받아도 뒤 날의 칸에서 하나 돌려줄 뿐 — 날짜가 내려가지 않는다
  const back = bossRefund(s, boss.key, "A", D0);
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(fishingOf(back.state).bosses[boss.key].tries.A, { day: D1, n: BOSS_TRIES - 1 });
  // 진짜 다음 날엔 다시 3번
  assert.equal(bossBlockOf(fishingOf(s), boss, "A", D2), null);
});

test("주인 토벌 — 날짜를 되돌려 잡아도 다시 나타나는 날이 당겨지지 않는다 · 되돌린 날로 체력을 되찾지 않는다", () => {
  let s = lv50(fresh());
  const boss = BOSSES[0];
  const o = bossOpen(s, boss.key, "A", D1);
  assert.ok(o.ok);
  if (o.ok) s = o.state;
  const hurt = bossLost(s, boss.key, 0.5, D1, "A", 0, 1);
  assert.ok(hurt.ok);
  if (hurt.ok) s = hurt.state;
  const hp = fishingOf(s).bosses[boss.key].hp;
  // 일주일 전으로 되돌려 잡는다
  const past = "2026-11-05";
  const o2 = bossOpen(s, boss.key, "A", past);
  assert.ok(o2.ok);
  if (o2.ok) s = o2.state;
  assert.equal(bossHp(fishingOf(s).bosses[boss.key], D1), hp, "되돌린 날을 지나도 체력이 안 찬다(at 이 뒤 날 그대로)");
  const won = bossWon(s, boss.key, "A", past, 0);
  assert.ok(won.ok);
  if (won.ok) s = won.state;
  const rec = fishingOf(s).bosses[boss.key];
  assert.ok(rec.until >= "2026-11-19", `다시 나타나는 날 ${rec.until} — 예전엔 ${past} + ${BOSS_RETURN_DAYS}일 = 진짜 오늘`);
  assert.ok(bossBlockOf(fishingOf(s), boss, "A", D1), "진짜 오늘엔 쉬는 중");
});

test("주간 원정 — 지난주로 되돌려도 새 원정이 열리지 않는다", () => {
  let s = lv50(fresh());
  const r = sellCatch(s, guppy, D1, { who: "A", couple: false });
  assert.ok(r.ok);
  if (r.ok) s = r.state;
  const e = fishingOf(s).exped!;
  assert.ok(e);
  assert.equal(expedFor(fishingOf(s), "2026-11-04", false), e, "지난주 날짜 — 남긴 주의 원정 그대로");
  assert.notEqual(expedFor(fishingOf(s), "2026-11-17", false).week, e.week, "진짜 다음 주엔 새 원정");
});

test("수조 손님 — 날짜를 되돌려도 새 손님이 오지 않는다 · 들어준 손님을 다시 들어줄 수 없다", () => {
  const H = 3_600_000;
  let st = addFish(fresh(), "guppy", 2, "cobra_guppy", T0);
  st = syncAqua(st, T0).state;
  const req = aquaOf(st).req!;
  assert.equal(req.day, D1);
  // 들어준 셈 치고(부탁 종류는 시드마다 다르다) 하루 전으로
  st = stow(st, { ...aquaOf(st), req: { ...req, done: true } });
  const back = syncAqua(st, T0 - 24 * H);
  assert.equal(back.a.req?.day, D1, "되돌린 날엔 손님이 새로 안 온다");
  assert.equal(back.a.req?.done, true);
  assert.equal(claimRequest(back.state, T0 - 24 * H).ok, false);
  // 진짜 다음 날엔 새 손님
  assert.equal(syncAqua(st, T0 + 24 * H).a.req?.day, D2);
});

test("화면 — 낚시 · 합성 · 수조는 서버에 맞춘 시각(gameNow)으로 하루를 정한다(앞으로 돌린 폰 시계도 막는다)", () => {
  const fish = code("src/components/FishingGame.tsx");
  assert.match(fish, /const clock = \(\) => gameNow\(\);/);
  assert.match(fish, /import \{ gameNow \} from "@\/lib\/islandsync";/);
  // 기기 시계는 경과 시간 · 예보 신선도에만
  for (const m of fish.matchAll(/deviceClock\(\)/g)) assert.ok(m.index !== undefined);
  assert.doesNotMatch(fish, /kstDate\(Date\.now\(\)\)|kstDate\(deviceClock\(\)\)/);
  const merge = code("src/components/MergeGame.tsx");
  assert.match(merge, /const today = kstDate\(gameNow\(\)\);/);
  const aqua = code("src/components/AquariumGame.tsx");
  assert.doesNotMatch(aqua, /Date\.now\(\)/, "수조 화면이 기기 시계를 그대로 쓴다");
  assert.match(aqua, /const t = gameNow\(\);/);
});
