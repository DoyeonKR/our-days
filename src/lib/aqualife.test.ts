// 색 변이 품종 · 물고기 개체 이야기(2026-11-13) lock.
// 결정적(두 기기 같은 결과) · 물려받기 확률 · 크기 상한 · 옛 앱의 다시 짓기를 지나도 남기 · 이름 검사 · 하트 수도꼭지 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREED_H, addFish, aquaOf, fishAge, fishMorph, nameFish, releaseFish, stow, syncAqua, tickAqua,
  type AquaResult, type AquaState, type Island,
} from "./aquarium.ts";
import { MORPHS, MORPH_BASE, MORPH_ONE_PARENT, MORPH_TWO_PARENTS, morphOf, rollMorph, type Morph } from "./aquamorph.ts";
import { LOG_MAX, MEMORIAL_MAX, NAME_LEN, checkFishName, clipName, lifeLeave, lifeLog, readLife } from "./aqualife.ts";
import { memorialLine, storyLine } from "./aquastory.ts";
import { tryStore, type FishCatch } from "./fishing.ts";
import { morphChunk } from "./aqua3d/morphlook.ts";
import { createIsland, type IslandState } from "./island.ts";

const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 13, 3); // KST 정오
const DAY = "2026-11-13";
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, T0), coins });
function must(r: AquaResult | { ok: true; state: IslandState } | { ok: false; reason: string }): Island {
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? (r.state as Island) : (undefined as never);
}
/** 다 큰 구피 둘 — 알을 낳을 수 있는 수조 */
function pairTank(): Island {
  let s = addFish(rich(), "guppy", 2, "cobra_guppy", T0) as IslandState;
  s = addFish(s, "guppy", 2, "tuxedo_guppy", T0);
  return s as Island;
}
/** 알 낳기 직전으로 — 짝이 잘 지낸 시간을 거의 다 채운다 */
const nearEgg = (s: Island, extra: Partial<AquaState> = {}): Island => {
  const a = aquaOf(s, T0);
  return stow(s, { ...a, hunger: 100, water: 100, breedH: BREED_H - 1, at: T0, ...extra }) as Island;
};

/* 2026-11-06 까지 배포된 앱(7ab54e1)의 쓰기 — aquacare.test 와 같은 흉내. aquaMorph · aquaLife 는 모르고 ...st 로 흘린다 */
const OLD_PLUS_KEYS = ["badH", "news", "newsN", "newsSeen", "care", "duoDay", "released", "net", "combos", "req", "food", "junkUsed", "breedH", "eggN"] as const;
function oldClientSave(st: Island, edit: (fish: AquaState["fish"], plus: Record<string, unknown>) => AquaState["fish"] = (f) => f): Island {
  const a = st.aquarium!;
  const plusIn = (st.aquaPlus ?? {}) as Record<string, unknown>, plus: Record<string, unknown> = {};
  for (const k of OLD_PLUS_KEYS) if (plusIn[k] !== undefined) plus[k] = plusIn[k];
  const fish = edit([...a.fish], plus);
  const core = { tank: Math.min(6, a.tank), hunger: a.hunger, water: a.water, at: a.at, nextId: Math.max(a.nextId, ...fish.map((f) => f.id + 1)), fish, placed: a.placed, bag: a.bag, dex: a.dex };
  return { ...st, aquarium: core as AquaState, aquaPlus: plus } as Island;
}

/* ── 변이 ─────────────────────────────────────────── */

test("변이 뽑기는 결정적이다 — 같은 치어 id · 계열 · 부모 = 같은 결과(Math.random 없음)", () => {
  for (let id = 1; id < 400; id++) {
    assert.equal(rollMorph(id, "guppy"), rollMorph(id, "guppy"));
    assert.equal(rollMorph(id, "koi", ["golden"]), rollMorph(id, "koi", ["golden"]));
  }
  const src = (rollMorph.toString() + morphOf.toString());
  assert.doesNotMatch(src, /Math\.random/);
});

test("물려받기 — 부모 변이가 없으면 약 5%, 하나면 약 15%, 둘이면 약 30% · 나오면 열에 여섯은 부모를 닮는다", () => {
  const N = 40_000;
  const rate = (parents: Morph[]) => {
    let hit = 0, like = 0;
    const by: Record<string, number> = {};
    for (let id = 1; id <= N; id++) {
      const m = rollMorph(id, "betta", parents);
      if (!m) continue;
      hit++;
      by[m] = (by[m] ?? 0) + 1;
      if (parents.includes(m)) like++;
    }
    return { p: hit / N, like: hit ? like / hit : 0, by };
  };
  const none = rate([]), one = rate(["albino"]), two = rate(["golden", "melanistic"]);
  assert.ok(Math.abs(none.p - MORPH_BASE) < 0.006, `부모 없음 ${none.p}`);
  assert.ok(Math.abs(one.p - MORPH_ONE_PARENT) < 0.01, `부모 하나 ${one.p}`);
  assert.ok(Math.abs(two.p - MORPH_TWO_PARENTS) < 0.012, `부모 둘 ${two.p}`);
  // 60% 는 부모 것 그대로 + 나머지 40% 가 무게대로 뽑다 같은 걸 고를 때(알비노 40%) — 약 76%
  assert.ok(one.like > 0.7 && one.like < 0.82, `부모를 닮는 비율 ${one.like}`);
  // 부모 없는 변이의 종류 — 오로라가 가장 드물다
  for (const m of MORPHS) assert.ok((none.by[m] ?? 0) > 0, `${m} 도 나온다`);
  assert.ok((none.by.aurora ?? 0) < (none.by.melanistic ?? 0));
});

test("옛 앱이 낳은 치어를 나중에 굴려도(부모 없이) 태어날 때 '없음'이었던 치어는 늘 없음이다", () => {
  for (let id = 1; id < 20_000; id++) {
    for (const parents of [["albino"], ["golden", "aurora"]] as Morph[][]) {
      if (rollMorph(id, "tetra", parents) === null) assert.equal(rollMorph(id, "tetra"), null, `id ${id}`);
    }
  }
});

test("알 — 짝 한 쌍의 변이로 굴리고, 이야기에 'A × B 의 알' · 변이가 남는다. 쪼개 정산 = 한 번 정산(이야기 · 변이까지)", () => {
  const base = pairTank();
  const a0 = aquaOf(base, T0);
  const [p1, p2] = a0.fish;
  // 부모가 둘 다 황금 — 물려받기 확률로 굴린다
  const golden = nearEgg(base, { morph: { ...a0.morph!, by: { [p1.id]: "golden", [p2.id]: "golden" } } });
  const one = syncAqua(golden, T0 + 3 * H);
  const fry = one.a.fish.find((f) => f.bred)!;
  assert.ok(fry, "알에서 치어가 나왔다");
  assert.equal(fishMorph(one.a, fry), rollMorph(fry.id, "guppy", ["golden", "golden"]));
  const hatched = one.a.life!.log[String(fry.id)][0];
  assert.equal(hatched.k, "hatched");
  assert.deepEqual(hatched.k === "hatched" ? hatched.p?.map((p) => p.id).sort() : [], [p1.id, p2.id].sort());
  // 쪼개 정산
  let split = aquaOf(golden, T0);
  for (let t = T0 + H / 2; t <= T0 + 3 * H; t += H / 2) split = tickAqua(split, t).a;
  const whole = tickAqua(aquaOf(golden, T0), T0 + 3 * H).a;
  assert.deepEqual(split.life, whole.life);
  assert.deepEqual(split.morph, whole.morph);
  // 두 기기 — 같은 저장값에서 같은 결과
  assert.deepEqual(syncAqua(golden, T0 + 3 * H).state, one.state);
});

test("변이는 보기만 — 보내 줄 때 하트가 변이 없는 같은 물고기와 같다(새 하트 수도꼭지 없음)", () => {
  const s = nearEgg(pairTank());
  const a = syncAqua(s, T0 + 3 * H);
  const fry = a.a.fish.find((f) => f.bred)!;
  const plain = must(releaseFish(a.state, fry.id, T0 + 4 * H));
  const withMorph = stow(a.state, { ...aquaOf(a.state, T0 + 3 * H), morph: { ...a.a.morph!, by: { ...a.a.morph!.by, [fry.id]: "aurora" } } });
  const morphed = must(releaseFish(withMorph, fry.id, T0 + 4 * H));
  assert.equal(morphed.coins, plain.coins);
  // 이름 짓기도 하트가 안 든다 · 안 생긴다
  const named = must(nameFish(a.state, a.a.fish[0].id, "콩이", T0 + 4 * H, "me"));
  assert.equal(named.coins, a.state.coins);
});

test("3D 색 바꾸기 셰이더는 ASCII 만(GLSL ES 1.0)", () => {
  for (const m of MORPHS) assert.match(morphChunk(m), /^[\x00-\x7f]*$/);
});

/* ── 이름 ─────────────────────────────────────────── */

test("이름 — 10글자(자소 묶음) · NFC · 주소 금지 · 빈 이름은 지우기 · 보이지 않는 글자만은 안 된다", () => {
  assert.deepEqual(checkFishName("  콩이  "), { ok: true, name: "콩이" });
  assert.deepEqual(checkFishName(""), { ok: true, name: "" });
  // 풀어 쓴 한글(ㅎ+ㅏ+ㄴ)은 한 글자로
  const nfd = "한".normalize("NFD");
  assert.equal(nfd.length, 3);
  const c = checkFishName(nfd);
  assert.ok(c.ok && c.name === "한" && c.name.length === 1);
  // 이모지 가족 하나 = 한 글자
  assert.ok(checkFishName("👨‍👩‍👧‍👦".repeat(NAME_LEN)).ok);
  assert.equal(checkFishName("가".repeat(NAME_LEN + 1)).ok, false);
  assert.equal(checkFishName("www.a.kr").ok, false);
  assert.equal(checkFishName("콩 https://x").ok, false);
  assert.equal(checkFishName("​ㅤ").ok, false);
  // 그릴 때 — 다른 기기가 쓴 긴 값도 10글자로
  assert.equal(clipName("가".repeat(30)), "가".repeat(NAME_LEN));
});

test("이름 짓기 — 저장되고, 여러 번 바꿔도 이야기에는 마지막 한 줄만 남는다", () => {
  let s = pairTank() as IslandState;
  const id = aquaOf(s, T0).fish[0].id;
  for (let i = 0; i < 15; i++) s = must(nameFish(s, id, `이름${i}`, T0 + i * H, "me"));
  const a = aquaOf(s, T0 + 20 * H);
  assert.equal(a.life!.names[String(id)], "이름14");
  const named = a.life!.log[String(id)].filter((e) => e.k === "named");
  assert.equal(named.length, 1);
  assert.equal(a.life!.log[String(id)][0].k, "caught", "처음 한 줄(어떻게 왔나)은 남는다");
  assert.equal(nameFish(s, id, "이름14", T0, "me").ok, false, "같은 이름");
  assert.equal(nameFish(s, 9999, "콩", T0, "me").ok, false, "없는 물고기");
  const cleared = must(nameFish(s, id, "  ", T0 + 30 * H, "me"));
  assert.equal(aquaOf(cleared, T0).life!.names[String(id)], undefined);
});

/* ── 이야기 · 추모 칸 ─────────────────────────────────── */

test("이야기 — 어디서 누가 잡았나 · 자랐나 · 누구를 먹었나 · 먹혔나(추모 칸)", () => {
  // 커플 섬에서 'a' 가 잡았다
  const c: FishCatch = { family: "tetra", stage: 0, grade: "흔함", difficulty: 0, at: "pond" };
  const st = must(tryStore(rich(), c, 1, 0, T0, DAY, { who: "a", couple: true }));
  const a = aquaOf(st, T0);
  const f = a.fish[0];
  const first = a.life!.log[String(f.id)][0];
  assert.equal(first.k, "caught");
  assert.ok(first.k === "caught" && first.by === "a" && first.spot === "pond");
  const [, mine] = storyLine(first, { who: "a", couple: true, a });
  const [, theirs] = storyLine(first, { who: "b", couple: true, a });
  assert.match(mine, /내가/);
  assert.match(theirs, /상대가/);
  // 자란다 — 정산 시각에 '자랐어요'
  const grown = syncAqua(st, T0 + 40 * H);
  const log = grown.a.life!.log[String(f.id)];
  assert.ok(log.some((e) => e.k === "grew" && e.stage === 1));
  assert.equal(fishAge(grown.a, f.id, T0 + 40 * H)?.days, 2);
});

test("보내 주기 · 잡아먹힘은 추모 칸으로 — 이름 · 함께한 날 · 까닭 · 변이가 남고 이야기 칸은 비운다", () => {
  let s = pairTank() as IslandState;
  const [f1] = aquaOf(s, T0).fish;
  s = must(nameFish(s, f1.id, "별이", T0 + H, "me"));
  const withMorph = aquaOf(s, T0 + H);
  s = stow(s, { ...withMorph, morph: { ...withMorph.morph!, by: { [f1.id]: "melanistic" } } });
  s = must(releaseFish(s, f1.id, T0 + 49 * H));
  const a = aquaOf(s, T0 + 50 * H);
  const m = a.life!.memorial[0];
  assert.equal(m.id, f1.id);
  assert.equal(m.cause, "released");
  assert.equal(m.name, "별이");
  assert.equal(m.morph, "melanistic");
  assert.equal(a.life!.log[String(f1.id)], undefined);
  assert.equal(a.life!.names[String(f1.id)], undefined);
  assert.match(memorialLine(m, a).span, /3일 함께했어요/);
});

test("상한 — 물고기마다 12줄(처음 한 줄 + 최근) · 추모 30 · 읽을 때도 다시 건다", () => {
  let life = readLife(undefined, 0);
  life = lifeLog(life, 1, { k: "start", t: T0, key: "fry_guppy" });
  for (let i = 0; i < 40; i++) life = lifeLog(life, 1, { k: "grew", t: T0 + i * H, key: "juv_guppy", stage: 1 });
  assert.equal(life.log["1"].length, LOG_MAX);
  assert.equal(life.log["1"][0].k, "start");
  for (let i = 0; i < 50; i++) life = lifeLeave(life, { id: 100 + i, key: "fry_guppy" }, "gone", T0);
  assert.equal(life.memorial.length, MEMORIAL_MAX);
  assert.equal(life.memorial[0].id, 149, "가장 최근이 맨 앞");
  // 같은 물고기를 두 번 보내도 한 번만
  assert.equal(lifeLeave(life, { id: 149, key: "fry_guppy" }, "gone", T0).memorial.length, MEMORIAL_MAX);
  // 다른 기기가 쓴 지나친 값도 읽으면서 자른다
  const fat = readLife({ log: { 1: Array.from({ length: 99 }, () => ({ k: "start", t: T0, key: "x" })) }, memorial: Array.from({ length: 99 }, (_, i) => ({ id: i, key: "x", to: T0, cause: "gone" })), names: { 1: "가".repeat(99), 2: 7 } }, 0);
  assert.equal(fat.log["1"].length, LOG_MAX);
  assert.equal(fat.memorial.length, MEMORIAL_MAX);
  assert.equal(fat.names["1"].length, NAME_LEN);
  assert.equal(fat.names["2"], undefined);
});

test("크기 — 물고기 60마리 이야기 가득 · 긴 이름 · 추모 30 이어도 섬 한 행(1MB)의 작은 몫", () => {
  let life = readLife(undefined, 0);
  for (let id = 1; id <= 60; id++) {
    life = { ...life, names: { ...life.names, [id]: "가나다라마바사아자차" } };
    life = lifeLog(life, id, { k: "caught", t: T0, key: "kohaku_koi", spot: "deepsea", by: "0f2c7a1e-1234-4bcd-9abc-1234567890ab" });
    for (let i = 0; i < 20; i++) life = lifeLog(life, id, { k: "ate", t: T0 + i * H, prey: { id: 1000 + i, key: "juv_cutlassfish_pollock" } });
  }
  for (let i = 0; i < 40; i++) life = lifeLeave({ ...life, names: { ...life.names, [500 + i]: "가나다라마바사아자차" } }, { id: 500 + i, key: "golden_dragonfish" }, "eaten", T0, { by: { id: 1, key: "great_white" }, morph: "aurora" });
  const bytes = new TextEncoder().encode(JSON.stringify(life)).length;
  assert.ok(bytes < 80_000, `${bytes} bytes`);
});

test("정산은 이야기 · 변이만으로 저장하지 않는다(dirty 아님) · 다시 정산해도 같은 결과", () => {
  const s = pairTank();
  const once = syncAqua(s, T0 + 2 * H);
  const twice = syncAqua(once.state, T0 + 2 * H);
  assert.equal(twice.dirty, false);
  assert.deepEqual(twice.state, once.state);
});

/* ── 옛 앱과 섞여도 ───────────────────────────────────── */

test("옛 앱의 다시 짓기를 지나도 이름 · 이야기 · 변이 · 추모 칸이 남는다(맨 위 칸)", () => {
  let s = pairTank() as IslandState;
  const [f1, f2] = aquaOf(s, T0).fish;
  s = must(nameFish(s, f1.id, "콩이", T0 + H, "me"));
  const a = aquaOf(s, T0 + H);
  s = stow(s, { ...a, morph: { ...a.morph!, by: { [f2.id]: "golden" }, seen: { "guppy:golden": 1 } } });
  s = must(releaseFish(s, f2.id, T0 + 2 * H));
  const before = aquaOf(s, T0 + 2 * H);
  const old = oldClientSave(s as Island);
  assert.equal((old.aquaPlus as Record<string, unknown>).life, undefined);
  const after = aquaOf(old, T0 + 2 * H);
  assert.deepEqual(after.life, before.life);
  assert.deepEqual(after.morph, before.morph);
  assert.equal(after.life!.names[String(f1.id)], "콩이");
  assert.equal(after.life!.memorial[0].morph, "golden");
  // 새 칸은 aquaPlus 에 안 생긴다(옛 앱이 버리는 자리)
  const plusKeys = Object.keys((s as Island).aquaPlus ?? {}).filter((k) => !(OLD_PLUS_KEYS as readonly string[]).includes(k) && k !== "tankTop");
  assert.deepEqual(plusKeys, []);
});

test("옛 앱이 알을 낳고 · 잡아먹히고 · 보내 줘도 — 새 앱이 소식에서 이야기를 옮기고(무렵) 변이를 같은 주사위로 적는다 · 두 번 적지 않는다", () => {
  let s = pairTank() as IslandState;
  s = syncAqua(s, T0).state; // 새 앱이 한 번 저장 — since · n 이 저장된다
  const a = aquaOf(s, T0);
  const [p1, p2] = a.fish;
  const since = a.morph!.since;
  // 변이가 나오는 id 를 찾는다(옛 앱이 낳은 치어 — 부모 없이 굴린다)
  let fryId = since;
  while (!rollMorph(fryId, "guppy")) fryId++;
  const newsN = a.newsN ?? 0;
  const old = oldClientSave(s as Island, (fish, plus) => {
    // 옛 앱: 알을 낳고(소식 egg) · p2 가 다른 물고기를 먹은 것처럼 소식 ate · p1 을 보내 줬다(소식 없음)
    plus.newsN = newsN + 2;
    plus.news = [...((plus.news as unknown[]) ?? []), { n: newsN + 1, id: fryId, family: "guppy", stage: 0, egg: true },
      { n: newsN + 2, id: p2.id, family: "guppy", stage: 2, species: p2.species, ate: { id: 7777, family: "tetra", stage: 0 } }];
    return [...fish.filter((f) => f.id !== p1.id), { id: fryId, family: "guppy", stage: 0, growH: 0, goodH: 0, totalH: 0, bred: true, caughtStage: 0, catchV: 0 }];
  });
  const t = old.aquarium!.at + 5 * H;
  const synced = syncAqua(old, t);
  const life = synced.a.life!;
  assert.equal(fishMorph(synced.a, { id: fryId, family: "guppy", bred: true }), rollMorph(fryId, "guppy"));
  assert.ok(synced.a.morph!.by[String(fryId)], "옛 앱이 낳은 치어의 변이가 적힌다");
  const hatched = life.log[String(fryId)][0];
  assert.equal(hatched.k, "hatched");
  assert.equal(hatched.a, 1, "때를 모른다 — 무렵");
  assert.equal(life.memorial.find((m) => m.id === p1.id)?.cause, "gone", "소식 없이 떠난 물고기");
  assert.equal(life.memorial.find((m) => m.id === 7777)?.cause, "eaten");
  assert.ok(life.log[String(p2.id)].some((e) => e.k === "ate" && e.prey.id === 7777));
  // 한 번 더 정산 · 저장 · 정산해도 두 번 적지 않는다
  const again = syncAqua(stow(synced.state, synced.a), t + H);
  assert.equal(again.a.life!.log[String(p2.id)].filter((e) => e.k === "ate").length, 1);
  assert.equal(again.a.life!.memorial.filter((m) => m.id === 7777).length, 1);
  assert.equal(again.a.morph!.seen[`guppy:${rollMorph(fryId, "guppy")}`], 1, "도감 수도 한 번만");
});

test("이 기능 전에 깬 물고기는 거슬러 변이가 되지 않는다(since)", () => {
  // aquaMorph 칸이 없던 섬 — 이미 수조에서 깬 치어가 있다
  const s = pairTank();
  const a = aquaOf(s, T0);
  const born = { id: a.nextId - 1, family: "guppy", stage: 0 as const, growH: 0, goodH: 0, totalH: 0, bred: true };
  const legacy = { ...s, aquaMorph: undefined, aquarium: { ...s.aquarium!, fish: [...s.aquarium!.fish.slice(0, 1), born] } } as Island;
  for (let id = 1; id < 200; id++) {
    const st = { ...legacy, aquarium: { ...legacy.aquarium!, fish: [{ ...born, id }], nextId: 300 } } as Island;
    assert.equal(fishMorph(syncAqua(st, T0).a, { id, family: "guppy", bred: true }), null);
  }
});
