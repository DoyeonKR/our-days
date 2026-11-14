// 4차 54계열 뒤 낚시 밸런스 되돌리기(2026-11-13) — 새 흔한 계열을 pool 끝(귀한 계열 뒤)에 붙여 rollCatch 의 '뒤쪽일수록 무게'를 가장 크게 받아,
// 낚시터 대표 물고기가 밀렸다(행운 5 · 시작 미끼: 우포늪 붕어 37% → 13% · 블루길 19% 1등, 섬진강 은어 38% → 18%, 생태원 테트라 · 베타 · 구피 26% → 8%).
// 미끼 1% 규칙(BAIT_STEP)과 rollCatch 의 식은 그대로 — 고친 건 pool 순서 · 무게, 오스카 · 피라루쿠 · 전기뱀장어 등급, 집어등 밤 물고기, 때 손님 칸.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BAITS, NIGHT_FAMILIES, SPOTS, baitIndex, catchTable, familyBaitTier, rollCatch, spotMinBait, type FishSpot } from "./fishing.ts";
import { FAMILIES, familyOf } from "./aquarium.ts";
import { TIMED_CHANCE, TIMED_FISH, TIMED_ONLY, TIMED_SIDE_CHANCE, timedAt, type FishMoment } from "./fishingworld.ts";
import { isPredator } from "./predation.ts";
import { denAssign, denCandidates, type Obstacle } from "./aqua3d/habits.ts";

// 4차 직전(3e89514)의 pool — 지금 엔진에 그대로 넣어 '그때의 몫'을 잰다
const PRE: Record<string, [string, number][]> = {
  brook: [["guppy", 50], ["tetra", 40], ["goldfish", 15], ["betta", 10]],
  dumulmeori: [["pale_chub", 40], ["crucian", 34], ["bullhead", 24], ["common_carp", 10]],
  pond: [["crucian", 40], ["pale_chub", 26], ["bullhead", 22], ["catfish", 40], ["common_carp", 20], ["koi", 15], ["snakehead", 12]],
  soyang: [["smelt", 42], ["crucian", 30], ["pale_chub", 24], ["common_carp", 15], ["mandarin_fish", 10]],
  seomjin: [["sweetfish", 42], ["pale_chub", 28], ["bullhead", 22], ["salmon", 15], ["mandarin_fish", 10], ["eel", 8]],
  bonghwa: [["chinese_minnow", 42], ["pale_chub", 30], ["bullhead", 20], ["masu_salmon", 15], ["perch_kkeokji", 20], ["lenok", 6]],
  jungle: [["angel", 36], ["tetra", 30], ["betta", 24], ["guppy", 20], ["discus", 30], ["ray", 20], ["arowana", 10]],
  hwacheon: [["smelt", 40], ["chinese_minnow", 30], ["pale_chub", 24], ["masu_salmon", 60], ["lenok", 4]],
  harbor: [["mackerel", 40], ["rockfish_bollak", 30], ["flounder", 40], ["rockfish", 30], ["black_seabream", 20], ["sea_bream", 20], ["starfish", 15], ["sea_bass", 18], ["squid", 10], ["croaker", 10], ["yellowtail", 8], ["octopus", 6], ["striped_jack", 5], ["puffer", 3]],
  sanriver: [["bullhead", 36], ["pale_chub", 30], ["crucian", 26], ["common_carp", 35], ["mandarin_fish", 30], ["snakehead", 12], ["perch_kkeokji", 8], ["eel", 6]],
  reef: [["clown", 40], ["black_seabream", 30], ["starfish", 24], ["hairtail", 15], ["nurse_shark", 15], ["leopard_shark", 15], ["sea_turtle", 30], ["barred_knifejaw", 10], ["octopus", 8], ["manta", 15]],
  ocean: [["sailfin_sandfish", 40], ["rockfish", 30], ["flounder", 24], ["cutlassfish_pollock", 20], ["squid", 18], ["bluefin", 60], ["blue_shark", 40], ["manta", 25], ["hammerhead", 15], ["great_white", 10], ["whale_shark", 15]],
  palace: [["rising", 40], ["striped_jack", 32], ["oarfish", 26], ["megamouth", 15], ["whale_shark", 20]],
  starsea: [["rising", 38], ["anglerfish", 32], ["hammerhead", 26], ["astral", 70]],
  abyss: [["gulper_eel", 40], ["octopus", 32], ["blue_shark", 26], ["anglerfish", 30], ["oarfish", 20], ["coelacanth", 12], ["giant_squid", 10], ["kraken", 3]],
};
const spot = (k: string) => SPOTS.find((s) => s.key === k)!;
/** 2026-11-14 다시 지은 낚시터 — 용궁사 · 거진항은 전설 · 신화 계열뿐이라 무엇을 낚든 100% 전설이었다. 영웅급 바다 물고기를 기본으로 깔았다(대표 물고기가 바뀐 게 의도) */
const REBUILT = new Set(["palace", "starsea"]);

test("4차 뒤에도 낚시터의 원래 흔한 물고기가 몫을 지킨다 — 행운 5 · 가장 싼 미끼(열대관 · 항구는 민물새우도)에서 4차 전 몫의 80% 이상", () => {
  const rows: string[] = [];
  for (const s of SPOTS) {
    if (REBUILT.has(s.key)) continue;
    const pre = PRE[s.key];
    assert.ok(pre, `${s.key} 의 4차 전 pool`);
    const min = baitIndex(spotMinBait(s).key);
    const baits = s.common !== undefined && s.common > min ? [min, s.common] : [min];
    for (const b of baits) {
      const was = catchTable({ ...s, pool: pre } as FishSpot, 5, b, "float", undefined, 6000);
      const now = catchTable(s, 5, b, "float", undefined, 6000);
      // 대표 물고기(4차 전 1등)는 반드시, 나머지 흔한 물고기(8% 넘던 것)도 같은 문턱
      for (const r of was.filter((x, i) => i === 0 || x.chance > 0.08)) {
        const c = now.find((x) => x.family === r.family)?.chance ?? 0;
        assert.ok(c >= r.chance * 0.8, `${s.key} ${BAITS[b].name} ${r.family}: ${(r.chance * 100).toFixed(1)}% → ${(c * 100).toFixed(1)}%`);
      }
      rows.push(`${s.key}/${BAITS[b].key} ${was[0].family} ${(was[0].chance * 100).toFixed(0)}→${((now.find((x) => x.family === was[0].family)?.chance ?? 0) * 100).toFixed(0)}%`);
    }
  }
  console.log("  " + rows.join(" · "));
});

test("4차 새 흔한 계열은 원래 흔한 물고기 바로 뒤(귀한 계열 앞)에 있고 여전히 잡힌다 — 대표 물고기 자리(pool[0])는 그대로", () => {
  for (const s of SPOTS) {
    if (REBUILT.has(s.key)) continue;
    const pre = PRE[s.key];
    assert.equal(s.pool[0][0], pre[0][0], `${s.key} 대표 물고기 자리`);
    const min = baitIndex(spotMinBait(s).key);
    const baseTier = Math.max(...[min, Math.min(s.common ?? -1, BAITS.length - 1)]);
    const isBase = (k: string) => familyBaitTier(k) <= baseTier;
    const fresh = s.pool.filter(([k]) => !pre.some(([p]) => p === k) && isBase(k)).map(([k]) => k);
    if (!fresh.length) continue;
    // 원래 흔한 계열은 4차 전과 같은 자리
    pre.forEach(([k], i) => { if (isBase(k)) assert.equal(s.pool[i]?.[0], k, `${s.key} ${k} 자리`); });
    const lastOld = Math.max(...pre.map(([k], i) => (isBase(k) ? i : -1)));
    for (const k of fresh) {
      const at = s.pool.findIndex((x) => x[0] === k);
      assert.ok(at > lastOld, `${s.key} ${k} 는 원래 흔한 물고기 뒤`);
      assert.ok(s.pool.slice(lastOld + 1, at).every(([p]) => isBase(p) && !pre.some(([q]) => q === p)), `${s.key} ${k} 앞에 귀한 계열이 없다`);
    }
    const t = catchTable(s, 5, Math.max(min, s.common ?? min), "float", undefined, 6000);
    for (const k of fresh) assert.ok((t.find((x) => x.family === k)?.chance ?? 0) > 0.01, `${s.key} ${k} 가 잡힌다`);
  }
});

test("오스카 — 생태원의 귀한 물고기(1% 띠)이고 사냥꾼이다 · 민물새우로는 안 문다", () => {
  const j = spot("jungle");
  assert.equal(familyOf("oscar")!.finals[0].grade, "희귀");
  assert.ok(isPredator("oscar"), "오스카는 작은 물고기를 먹는다");
  const shrimp = catchTable(j, 5, baitIndex("bait_shrimp"), "float", undefined, 6000);
  assert.equal(shrimp.find((x) => x.family === "oscar")?.chance ?? 0, 0);
  const squid = catchTable(j, 5, baitIndex("bait_squid"), "float", undefined, 6000);
  const o = squid.find((x) => x.family === "oscar")?.chance ?? 0;
  // 2026-11-14 — 같은 미끼 단계의 귀한 계열(디스커스 · 가오리 · 오스카 · 피라냐)이 한 칸을 나눠 갖는다
  assert.ok(o > 0.0005 && o < 0.02, `오징어살 오스카 ${o}`);
});

test("피라루쿠 · 전기뱀장어 — 생태원에서 쓰는 가장 높은 미끼(황금 떡밥)로 그때 온다", () => {
  const j = spot("jungle"), paste = baitIndex("bait_paste");
  for (const [sp, when] of [["arapaima", { time: "dusk", wx: null }], ["electric_eel", { time: "night", wx: null }]] as const) {
    assert.equal(familyOf(sp)!.finals[0].grade, "영웅");
    let hit = 0;
    for (let i = 0; i < 4000; i++) if (rollCatch(j, 5, 0.4, i * 41 + 7, { bait: paste, when }).family === sp) hit++;
    assert.ok(hit / 4000 > TIMED_SIDE_CHANCE * 0.6, `${sp} ${hit / 40}%`);
    // 떡밥보다 싼 미끼로는 안 온다(미끼 상한 그대로)
    for (let i = 0; i < 2000; i++) assert.notEqual(rollCatch(j, 5, 0.4, i * 41 + 7, { bait: paste - 1, when }).family, sp);
  }
});

test("때 손님 — 4차 손님은 곁 칸(side)이라 원래 손님의 몫이 그대로다 · 합쳐도 15% 를 넘지 않는다", () => {
  const fourth = TIMED_FISH.filter((t) => t.side);
  assert.equal(fourth.length, 22, "4차 때 손님 열여덟 + 해양 포유류 셋(해달 · 독도 강치 · 큰바다사자) + 범고래");
  for (const t of fourth) assert.ok(TIMED_ONLY.has(t.species), `${t.species} 는 pool 밖 손님`);
  assert.ok(TIMED_CHANCE + TIMED_SIDE_CHANCE <= 0.15 + 1e-9);
  const rate = (key: string, when: FishMoment, hitOf: (c: ReturnType<typeof rollCatch>) => boolean) => {
    let n = 0;
    for (let i = 0; i < 8000; i++) if (hitOf(rollCatch(spot(key), 5, 0.4, i * 41 + 7, { bait: BAITS.length - 1, when }))) n++;
    return n / 8000;
  };
  // 울릉도 맑은 새벽 — 고래상어는 4차 전처럼 10%(새벽 손님 만새기 · 꽁치는 곁 칸을 나눈다)
  const clearDawn: FishMoment = { time: "dawn", wx: "clear" };
  assert.deepEqual(timedAt("ocean", clearDawn).map((t) => t.species), ["whale_shark", "dolphinfish", "saury"]);
  const ws = rate("ocean", clearDawn, (c) => c.species === "whale_shark");
  assert.ok(Math.abs(ws - TIMED_CHANCE) < 0.02, `고래상어 ${ws}`);
  // 문섬 비 오는 밤 — 해파리 · 블랙아이스 흰동가리는 4차 전처럼 각 5%, 쏠배감펭은 곁 칸
  const rainNight: FishMoment = { time: "night", wx: "rain" };
  const jelly = rate("reef", rainNight, (c) => c.family === "jellyfish");
  const lion = rate("reef", rainNight, (c) => c.family === "lionfish");
  assert.ok(Math.abs(jelly - TIMED_CHANCE / 2) < 0.015, `해파리 ${jelly}`);
  assert.ok(Math.abs(lion - TIMED_SIDE_CHANCE) < 0.015, `쏠배감펭 ${lion}`);
  // 곁 칸 손님이 있어도 원래 손님 칸은 seed 마다 같다 — 맑은 새벽(만새기 · 꽁치 있음)에 고래상어가 온 판은 맑은 낮(고래상어뿐)에도 고래상어다.
  // 거꾸로는 아니다: 낮엔 보통 뽑기로 다 큰 고래상어가 오는 판(맑은 날이라 허용)이 새벽엔 곁 칸 손님에게 돌아갈 수 있다
  assert.ok(timedAt("ocean", { time: "day", wx: "clear" }).every((x) => !x.side));
  let onlyDay = 0;
  for (let i = 0; i < 6000; i++) {
    const seed = i * 41 + 7, bait = BAITS.length - 1;
    const dawn = rollCatch(spot("ocean"), 5, 0.4, seed, { bait, when: clearDawn });
    const day = rollCatch(spot("ocean"), 5, 0.4, seed, { bait, when: { time: "day", wx: "clear" } });
    if (dawn.species === "whale_shark") assert.equal(day.species, "whale_shark", `seed ${seed}`);
    else if (day.species === "whale_shark") { onlyDay++; assert.ok(["dolphinfish", "saury"].includes(dawn.family), `seed ${seed} → ${dawn.family}`); }
  }
  assert.ok(onlyDay < 6000 * 0.01, `곁 칸에 돌아간 판 ${onlyDay}`);
});

test("집어등 — 멸치 · 삼치도 밤 물고기(같은 미끼 단계 안에서만 기운다)", () => {
  for (const k of ["anchovy", "spanish_mackerel"]) {
    assert.ok(NIGHT_FAMILIES.has(k), k);
    assert.ok(FAMILIES.some((f) => f.key === k));
  }
});

test("곰치 — 둘이면 서로 다른 굴(바위)을 쓴다 · 바위보다 많으면 같은 바위를 나눠 입구를 돌린다 · id 순이라 두 기기가 같다", () => {
  const rocks: Obstacle[] = [{ x: -2, z: 0, r: 0.8, h: 0.6, kind: "rock" }, { x: 1.5, z: -1, r: 0.7, h: 0.5, kind: "decor" }];
  const len = 1.2;
  assert.equal(denCandidates(len, rocks).length, 2);
  // 어떤 id 짝이든 다른 바위
  for (let a = 1; a < 40; a++) for (let b = a + 1; b < a + 6; b++) {
    const m = denAssign([{ id: b, length: len }, { id: a, length: len }], rocks);
    assert.notEqual(m.get(a)!.rock, m.get(b)!.rock, `${a} · ${b}`);
    assert.deepEqual(denAssign([{ id: a, length: len }, { id: b, length: len }], rocks), m, "순서와 상관없이 같다");
  }
  // 셋이면 하나는 같은 바위를 나눠 쓴다(share 1)
  const three = denAssign([1, 2, 3].map((id) => ({ id, length: len })), rocks);
  assert.deepEqual([...three.values()].map((x) => x.share).sort(), [0, 0, 1]);
});

test("곰치 — 수조 한 프레임(stepFish)에서도 두 곰치가 포개지지 않는다", async () => {
  const { stepFish } = await import("./aqua3d/fishstep.ts");
  const { WORLD } = await import("./aqua3d/world.ts");
  const rocks: Obstacle[] = [{ x: -2.2, z: -0.5, r: 0.9, h: 0.8, kind: "rock" }, { x: 2, z: -1, r: 0.8, h: 0.7, kind: "rock" }];
  const fish = [7, 11].map((id) => [id, { family: "moray", key: "moray", length: 1.1, phase: 0, course: {} as never }] as [number, never]);
  const b = { positions: new Float32Array(6), heading: new Float32Array(6), lengths: new Float32Array(2), pinned: new Float32Array(2), offsets: new Float32Array(6), rolls: new Float32Array(2), courses: [], count: 0 };
  let closest = Infinity;
  for (let k = 0; k < 120; k++) {
    stepFish(fish, new Map(), () => 1.1, k / 10, k ? 0.1 : 0, { wide: 1, tall: 1, deep: 1, heightAt: () => WORLD.floor, obstacles: rocks, feed: null, hall: null }, b);
    closest = Math.min(closest, Math.hypot(b.positions[0] - b.positions[3], b.positions[2] - b.positions[5]));
  }
  assert.ok(closest > 1.5, `두 곰치 사이 ${closest}`);
});
