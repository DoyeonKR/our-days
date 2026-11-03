// 2026-11-03 게임 리뷰 후속 lock — 닫기 · 뒤로 가기 · 수조 교체 · 사냥 흔적 · 경제 · 목표 · 소리 · 3D 모델.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { addFish, aquaOf, tankOf } from "./aquarium.ts";
import { BAITS, DAILY_FISH_COINS, NETS, RODS, rollCatch, TANK_FULL, buffedStats, claimFishGoal, effectiveStats, fishingOf, sellCatch, spendBait, SPOTS, storeBlock, tryStoreSwap, type FishCatch } from "./fishing.ts";
import { claimGoal, claimableGoals, dailyGoals, nextGoals } from "./fishinggoals.ts";
import { createIsland, type IslandState } from "./island.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const T0 = Date.UTC(2026, 10, 3, 3);
const TODAY = "2026-11-03";
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
function fullTank(): IslandState {
  let s = createIsland("a", null, T0) as IslandState;
  const room = tankOf(aquaOf(s)).fish;
  for (let i = 0; i < room; i++) s = addFish(s, "guppy", 0, undefined, T0);
  return s;
}

test("닫기 — 판 도중 · 잡은 물고기를 말없이 버리지 않는다", () => {
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /<GameHead title="낚시"[^>]*onClose=\{requestClose\}/);
  assert.match(src, /phase === "landed" && fish && !fish\.junk/);
  assert.match(src, /팔고 닫기/);
  assert.match(src, /useBackClose\(requestClose\)/);
});

test("뒤로 가기 — 게임 창 넷이 다 맨 위 창만 닫는다 · 확인창이면 기록을 다시 쌓는다", () => {
  for (const f of ["FishingGame", "AquariumGame", "MergeGame", "IslandGame"]) assert.match(code(`src/components/${f}.tsx`), /useBackClose\(/, f);
  const hook = code("src/lib/useBackClose.ts");
  assert.match(hook, /top\.close\(\) === false/);
  assert.match(hook, /ignorePops\+\+/);
  assert.ok(hook.includes("setTimeout(sync, 0)"), "한 박자 뒤에 맞춘다");
});

test("수조가 차도 귀한 물고기를 팔 수밖에 없지 않다 — 한 마리 보내고 담는다", () => {
  const s = fullTank();
  assert.equal(storeBlock(s, guppy), TANK_FULL);
  const id = aquaOf(s).fish[0].id;
  const got = tryStoreSwap(s, guppy, id, 1, 0, T0, TODAY);
  assert.ok(got.ok && got.outcome === "stored");
  if (got.ok) {
    assert.equal(aquaOf(got.state).fish.length, aquaOf(s).fish.length);
    assert.ok(!aquaOf(got.state).fish.some((f) => f.id === id));
  }
});
test("담기에 실패하면 아무도 떠나지 않는다", () => {
  const s = fullTank();
  const got = tryStoreSwap(s, guppy, aquaOf(s).fish[0].id, 0.5, 0.9, T0, TODAY);
  assert.ok(got.ok && got.outcome === "slipped");
  if (got.ok) assert.equal(aquaOf(got.state).fish.length, aquaOf(s).fish.length);
});

test("피버를 다 맞히면 수조에 꼭 담긴다", () => {
  assert.match(code("src/components/FishingGame.tsx"), /feverWon \|\| fish\.boss \? 1 : captureChance/);
});

test("사냥 흔적 — 엔진이 없고, 보이는 글에도 없고, 그 효과는 낚시 힘이 됐다", () => {
  assert.equal(existsSync(join(process.cwd(), "src/lib/hunt.ts")), false);
  const island = readFileSync(join(process.cwd(), "src/lib/island.ts"), "utf8");
  assert.doesNotMatch(island, /(unit|perk): "[^"]*(사냥|공격력)/);
  assert.doesNotMatch(island, /`[^`]*사냥 공격력/);
  assert.doesNotMatch(code("src/components/island/PetPanels.tsx"), /공격력/);
  assert.doesNotMatch(code("src/components/IslandGame.tsx"), /농사·사냥/);
  const s = { buffs: { hunt: { until: T0 + 1000, amount: 50 } } } as unknown as IslandState;
  const f = fishingOf({});
  assert.equal(buffedStats(s, f, T0).power, Math.round(effectiveStats(f).power * 1.5));
  assert.equal(buffedStats(s, f, T0 + 2000).power, effectiveStats(f).power, "끝난 효과는 안 든다");
});
test("주작은 사냥 없이도 닿는다 — 낚시 레벨이 그 축이다", () => {
  assert.match(readFileSync(join(process.cwd(), "src/lib/island.ts"), "utf8"), /huntBest: Math\.max\(s\.hunt\?\.best \?\? 0, s\.fishing \? \(s\.fishing\.level \?\? 1\) \* 2 : 0\)/);
});

test("경제 — 비싼 미끼 값이 평균 수입을 터무니없이 넘지 않는다 · 장비가 낚시만으로 1년 안에 끝난다", () => {
  const perCast = BAITS.map((b) => b.price / b.uses);
  for (let i = 1; i < perCast.length; i++) assert.ok(perCast[i] > perCast[i - 1], "높은 미끼가 더 비싸다");
  assert.ok(perCast[perCast.length - 1] <= 200, `별가루 ${perCast[perCast.length - 1]}`);
  const total = [...RODS, ...NETS].reduce((n, x) => n + x.price, 0);
  assert.ok(total / DAILY_FISH_COINS < 365, `${total / DAILY_FISH_COINS}일`);
  assert.ok(total / DAILY_FISH_COINS > 90, "금방 끝나도 안 된다");
});

test("하루가 바뀌면 오늘 기록과 하트 한도가 비워진다 · 미끼를 써도 어제 칸이 남지 않는다", () => {
  let s = createIsland("a", null, T0) as IslandState;
  const r1 = spendBait(s, SPOTS[0], "float", "bait_worm", TODAY, 30);
  assert.ok(r1.ok);
  if (r1.ok) s = r1.state;
  const sold = sellCatch(s, guppy, TODAY);
  assert.ok(sold.ok);
  if (sold.ok) s = sold.state;
  assert.equal(fishingOf(s).dayLanded, 1);
  assert.equal(fishingOf(s).dayCast, 30);
  assert.equal(dailyGoals(fishingOf(s), "2026-11-04")[0].now, 0);
  const r2 = spendBait(s, SPOTS[0], "float", "bait_worm", "2026-11-04", 5);
  assert.ok(r2.ok);
  if (r2.ok) {
    assert.equal(fishingOf(r2.state).dayCoins, 0);
    assert.equal(fishingOf(r2.state).dayCast, 5);
  }
});

test("목표 — 해야 받고, 한 번만 받고, 다음 단계가 열린다", () => {
  const f = { ...fishingOf({}), landed: 12 };
  const g = nextGoals(f).find((x) => x.id === "landed_10")!;
  assert.ok(g.done);
  assert.equal(nextGoals(fishingOf({})).find((x) => x.id === "landed_10")!.done, false);
  assert.ok(claimableGoals(f, TODAY) >= 1);
  const got = claimGoal(f, "landed_10", TODAY)!;
  assert.equal(got.coins, g.coins);
  assert.equal(claimGoal(got.f, "landed_10", TODAY), null);
  assert.ok(nextGoals(got.f).some((x) => x.id === "landed_50"));
  assert.equal(claimFishGoal(createIsland("a", null, T0) as IslandState, "landed_10", TODAY).ok, false);
  const d = { ...fishingOf({}), day: TODAY, dayLanded: 3 };
  const first = claimGoal(d, "d_landed", TODAY)!;
  assert.ok(first);
  assert.equal(claimGoal(first.f, "d_landed", TODAY), null);
});
test("옛 기록의 최고 등급은 만나 본 물고기에서 되짚는다", () => {
  assert.ok(fishingOf({ fishing: { seen: ["kohaku_koi"] } as never }).topGrade >= 0);
  assert.equal(fishingOf({}).topGrade, -1);
});

test("첫 판 안내 — 방식마다 · 저장소가 막혀도 판마다 뜨지 않는다", () => {
  const head = code("src/components/GameHead.tsx");
  assert.match(head, /catch \{\s*return true;/);
  const game = code("src/components/FishingGame.tsx");
  for (const m of ["float", "lure", "scoop", "deep"]) assert.match(game, new RegExp(`${m}: \\[`));
  assert.match(game, /<GameCoach/);
});

test("3D 모델 — 목록과 파일이 같고 · 임시 모델 위에 갈아 끼우며 · 나눠 쓰는 형상을 지우지 않는다", () => {
  const glb = readFileSync(join(process.cwd(), "src/lib/aqua3d/glb.ts"), "utf8");
  const list = (name: string) => new Set([...new RegExp(`${name}: ReadonlySet<string> = new Set\\(\\[([^\\]]*)\\]`).exec(glb)![1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
  for (const [name, dir] of [["FISH_GLB", "fish"], ["DECOR_GLB", "decor"]]) {
    const files = readdirSync(join(process.cwd(), "public/aqua/models", dir)).map((f) => f.replace(/\.glb$/, ""));
    assert.deepEqual([...list(name)].sort(), files.sort(), name);
  }
  const scene = code("src/lib/aqua3d/scene.ts");
  assert.match(scene, /FISH_GLB\.has\(key\)/);
  assert.match(scene, /DECOR_GLB\.has\(p\.key\)/);
  assert.match(scene, /o\.userData\.glbShared/);
  assert.match(scene, /glb\.dispose\(\)/);
  const report = JSON.parse(readFileSync(join(process.cwd(), "design/aqua3d-review/models.json"), "utf8"));
  assert.equal(report.approved, Object.values<{ approval: string }>(report.models).every(m => m.approval.startsWith("user_approved")), "new drafts must not inherit approval of existing models");
  for (const [key, m] of Object.entries<{ triangles: number; kind: string }>(report.models)) assert.ok(m.triangles <= (m.kind === "fish" ? 3500 : 12000), key);
});

test("미끼 — 한 단계 오를 때 귀한 계열 확률이 1% 안팎만 는다 · 열리는 순간에도 튀지 않는다 · 시작 미끼의 물고기가 대부분이다", () => {
  const share = (spotKey: string, bait: number, family: string) => {
    const spot = SPOTS.find((x) => x.key === spotKey)!;
    let n = 0;
    for (let i = 0; i < 20000; i++) if (rollCatch(spot, 5, 0.4, i * 37 + 11, { bait }).family === family) n++;
    return n / 200; // %
  };
  // 연꽃 연못의 비단잉어는 오징어살(2)부터 — 전엔 0 → 22%
  assert.equal(share("pond", 1, "koi"), 0);
  let prev = 0;
  for (let b = 2; b < BAITS.length; b++) {
    const now = share("pond", b, "koi");
    assert.ok(now - prev > 0.5 && now - prev < 1.8, `단계 ${b}: ${prev} → ${now}`);
    prev = now;
  }
  assert.ok(share("reef", 6, "clown") > 85, "맨 위 미끼여도 산호초는 대부분 흰동가리");
  assert.equal(share("starsea", 5, "rising") > 90, true);
});

test("뒤로 가기 — 링크로 들어와도 Next 의 기록 표시를 지우지 않는다(지우면 시트를 닫을 때 페이지가 새로고침된다)", () => {
  assert.doesNotMatch(code("src/app/page.tsx"), /replaceState\(null, "", here\.href\)/);
  assert.match(code("src/app/page.tsx"), /replaceState\(window\.history\.state, "", here\.href\)/);
});
test("옛 조각 파일 오류는 한 번만 저절로 새로고침한다", () => {
  const src = code("src/app/error.tsx");
  assert.match(src, /ChunkLoadError/);
  assert.match(src, /isStaleChunk\(error\) && !chunkReloaded\(\)/);
  assert.match(src, /sessionStorage\.setItem\(CHUNK_KEY/);
});

test("수조를 낚시 위에 열면 낚시 머리글이 겹치지 않는다 — 그 닫기를 누르면 낚시까지 닫혔다", () => {
  assert.match(code("src/components/FishingGame.tsx"), /\{!tankOpen && <GameHead title="낚시"/);
});
