// 낚시 밸런스(2026-11-05) [사용자: "50번을 던졌는데 같은 물고기만 계속 잡힌다면 그건 지루할거야" → "A안 + 진행 속도"]
// 시작 미끼로 15곳 중 11곳이 한 계열만 나왔고(50번에 같은 물고기 평균 18번 연속), 레벨 18 → 25 는 울릉도에서 900번 넘게 도루묵만 낚았다.
// 미끼 1% 규칙(BAIT_STEP)은 그대로 — 고친 건 낚시터 구성 · 같은 계열 연속 · 레벨 곡선 · 깊은 낚시터의 힘.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BAITS, SPOTS, STREAK_MAX, baitIndex, catchTable, fightLevel, rollCatch, spotMinBait, spotPush, xpNeed } from "./fishing.ts";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("모든 낚시터 — 시작 미끼로 세 계열 이상, 한 계열이 45%를 넘지 않는다(통영 항구는 바다의 가장 싼 물고기가 둘뿐이라 민물새우부터)", () => {
  for (const s of SPOTS) {
    const min = baitIndex(spotMinBait(s).key);
    const bait = s.key === "harbor" ? baitIndex("bait_shrimp") : min;
    const t = catchTable(s, 5, bait, "float", undefined, 6000);
    assert.ok(t.length >= 3, `${s.key} ${BAITS[bait].name}: ${t.length}계열`);
    assert.ok(t[0].chance <= 0.45, `${s.key} ${t[0].family} ${Math.round(t[0].chance * 100)}%`);
  }
  // 통영 항구도 지렁이로 두 계열이 반반은 된다
  const harbor = SPOTS.find((s) => s.key === "harbor")!;
  assert.ok(catchTable(harbor, 5, 0, "float", undefined, 6000)[0].chance <= 0.6);
});

test("미끼 1% 규칙은 그대로 — 한 단계 올려도 위 등급 계열은 몇 % 만 는다(낚시터 구성만 바꿨다)", () => {
  for (const s of SPOTS) {
    if (s.common !== undefined) continue; // 열대관 · 항구는 대표 물고기를 흔한 물고기로 친다
    const min = baitIndex(spotMinBait(s).key);
    if (min + 1 >= BAITS.length) continue;
    const a = catchTable(s, 5, min, "float", undefined, 6000), b = catchTable(s, 5, min + 1, "float", undefined, 6000);
    const baseA = new Set(a.map((x) => x.family));
    const extra = b.filter((x) => !baseA.has(x.family)).reduce((n, x) => n + x.chance, 0);
    assert.ok(extra < 0.06, `${s.key}: 한 단계 위 미끼로 새 계열 ${Math.round(extra * 100)}%`);
  }
});

test("같은 계열이 STREAK_MAX 번 이어지면 다음 한 번은 다른 계열 — 흔한 물고기가 둘 이상인 곳", () => {
  assert.equal(STREAK_MAX, 5);
  for (const s of SPOTS) {
    const bait = s.key === "harbor" ? baitIndex("bait_shrimp") : baitIndex(spotMinBait(s).key);
    let streak = { f: "", n: 0 }, worst = 0;
    for (let i = 0; i < 3000; i++) {
      const avoid = streak.n >= STREAK_MAX ? streak.f : undefined;
      const c = rollCatch(s, 1, 0.4, i * 7919 + 3, { bait, junk: true, avoid });
      if (c.junk) continue;
      streak = c.family === streak.f ? { f: c.family, n: streak.n + 1 } : { f: c.family, n: 1 };
      worst = Math.max(worst, streak.n);
    }
    assert.ok(worst <= STREAK_MAX, `${s.key}: ${worst}번 연속`);
  }
  // avoid 를 안 주면 뽑기 순서가 예전 그대로다(같은 seed = 같은 물고기)
  const brook = SPOTS[0];
  for (let i = 0; i < 200; i++) assert.deepEqual(rollCatch(brook, 3, 0.5, i, { bait: 0 }), rollCatch(brook, 3, 0.5, i, { bait: 0, avoid: undefined }));
});

test("깊은 낚시터일수록 힘겨루기가 세다 — 판매가 · 경험치 · 포획 확률은 등급 그대로(push 는 힘겨루기에만)", () => {
  assert.equal(spotPush(SPOTS[0]), 0, "첫 낚시터는 그대로 쉽다");
  for (const s of SPOTS) assert.ok(spotPush(s) >= 0 && spotPush(s) <= 4, s.key);
  const c = rollCatch(SPOTS.find((s) => s.key === "ocean")!, 5, 0.5, 11, { bait: 1 });
  assert.ok(fightLevel(c) > c.difficulty);
  const game = code("src/components/FishingGame.tsx");
  for (const f of ["fightTune(fightLevel(fish)", "deepTune(fightLevel(fish)", "swayTune(fightLevel(fish)", "lureTune(fightLevel(fishRef.current ?? c)", "hookWindowMs(fightLevel(fishRef.current ?? c)", "tapLure(cur, tune, fightLevel(fish))", "stepLure(cur, dt, tune, fightLevel(c))"]) assert.ok(game.includes(f), f);
  assert.match(game, /captureChance\(eff\.catch, fish\.difficulty/, "포획 확률은 등급 그대로");
  assert.match(game, /coinValue\(fish\.difficulty\)/);
});

test("레벨 곡선 — 늘 오르기만 하고, 첫 레벨은 첫 낚시터를 둘러볼 만큼 · 울릉도 구간(18~24)은 예전보다 짧다", () => {
  for (let l = 1; l < 50; l++) assert.ok(xpNeed(l + 1) > xpNeed(l), `Lv${l}`);
  assert.ok(xpNeed(1) >= 150, "레벨 2(루어)까지 첫 낚시터에서 스무 번쯤");
  const old = (l: number) => 30 + l * l * 6;
  let a = 0, b = 0;
  for (let l = 18; l < 25; l++) { a += xpNeed(l); b += old(l); }
  assert.ok(a < b * 0.5, `울릉도 구간 ${a} / 예전 ${b}`);
});

test("화면 — 새 낚시터가 열려도 저절로 옮기지 않는다 · 던질 때 고른 낚시터를 기억한다 · 열렸다는 소식은 결과 카드에", () => {
  const game = code("src/components/FishingGame.tsx");
  assert.match(game, /setSpotPick\(spot\.key\);\s+savePrefs\(\{ spot: spot\.key \}\);/);
  assert.match(game, /openedSpots\.length > 0 && <p className="fish-levelup">새 낚시터/);
  assert.match(game, /const avoid = streak\.current\.n >= STREAK_MAX \? streak\.current\.family : undefined;/);
});
