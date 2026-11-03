// 우리 수조 lock. [사용자 2026-11-01 "수조 키우는 게임 … 등급 다양화 … 치어를 하트로 사서 … 오랜시간 잘 기르면 최종형태 … 최소 30가지 … 악세사리 배치 … 하트로 구매"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_SPECIES, DECOR, FAMILIES, GRADES, TANKS,
  addFish, aquaEffects, aquaOf, buyDecor, cleanWater, decorPose, feedFish, fishArtKey, fishCare, moveDecor, openFinals, pickFinal, placeDecor,
  releaseFish, releaseReward, storeDecor, syncAqua, tickAqua, upgradeTank,
  type AquaResult,
} from "./aquarium.ts";
import { DECOR_IMAGE_KEYS, FISH_IMAGE_KEYS, TANK_IMAGE_KEYS } from "./aquaimages.ts";
import { createIsland, type IslandState } from "./island.ts";

const root = process.cwd();
const H = 3_600_000;
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, 0), coins });
function must(r: AquaResult): IslandState {
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? r.state : (undefined as never);
}

test("종류 — 최종 형태 30가지 이상 · 8등급 전부 · 계열 안에선 등급이 내려가지 않는다", () => {
  assert.ok(ALL_SPECIES.length >= 30);
  assert.equal(new Set(ALL_SPECIES.map((x) => x.key)).size, ALL_SPECIES.length);
  assert.deepEqual([...new Set(ALL_SPECIES.map((x) => x.grade))].sort(), [...GRADES].sort());
  for (const f of FAMILIES) {
    const ranks = f.finals.map((x) => GRADES.indexOf(x.grade));
    assert.ok(f.finals.length >= 1 && f.finals.length <= 4, f.key);
    for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i] >= ranks[i - 1], f.key);
  }
  for (let i = 1; i < FAMILIES.length; i++) {
    assert.ok(FAMILIES[i].price > FAMILIES[i - 1].price, "뒤 계열일수록 비싸다");
    assert.ok(FAMILIES[i].hours > FAMILIES[i - 1].hours, "뒤 계열일수록 오래 걸린다");
  }
  assert.ok(DECOR.length >= 30);
  assert.equal(new Set(DECOR.map((x) => x.key)).size, DECOR.length);
});

/** 잡아 온 치어를 넣는다(낚시 판정은 fishing.test) */
const buyFry = (st: IslandState, key: string, now: number): AquaResult => ({ ok: true, state: addFish(st, key, 0, undefined, now) });

test("잡아 온 물고기는 치어로 들어가면 처음부터 완성체가 아니다 · 빈 수조는 새 물로 시작", () => {
  const st = must(buyFry(rich(5), FAMILIES[0].key, 0));
  assert.equal(st.coins, 5, "낚시로 잡았으니 하트를 안 낸다");
  const a = aquaOf(st);
  assert.equal(a.fish[0].stage, 0);
  assert.equal(fishArtKey(a.fish[0]), `fry_${FAMILIES[0].key}`);
  assert.equal(a.water, 100);
});

test("수조를 넓히면 칸이 늘어난다", () => {
  const st = must(upgradeTank(rich(), 0));
  assert.equal(aquaOf(st).tank, 2);
  assert.ok(TANKS[1].fish > TANKS[0].fish);
});

/** 12시간마다 먹이, 24시간마다 물 — 잘 돌보는 사람 */
function raise(st: IslandState, key: string, feedEvery = 12): IslandState {
  let cur = must(buyFry(st, key, aquaOf(st).at));
  let t = aquaOf(cur).at;
  const id = aquaOf(cur).fish[aquaOf(cur).fish.length - 1].id;
  for (let i = 0; i < 3000; i++) {
    t += feedEvery * H;
    const fed = feedFish(cur, t);
    if (fed.ok) cur = fed.state;
    const cl = cleanWater(cur, t);
    if (cl.ok) cur = cl.state;
    const me = aquaOf(cur).fish.find((f) => f.id === id);
    if (me?.stage === 2) return cur;
  }
  throw new Error("다 크지 않았다");
}

test("오랜 시간 잘 기르면 치어 → 어린 물고기 → 최종, 시간이 걸린다", () => {
  const fam = FAMILIES[2];
  let st = must(buyFry(rich(), fam.key, 0));
  const a = tickAqua(aquaOf(st), (fam.hours * 0.2) * H).a;
  assert.equal(a.fish[0].stage, 0);
  st = raise(rich(), fam.key);
  const f = aquaOf(st).fish[0];
  assert.equal(f.stage, 2);
  assert.ok(f.species && fam.finals.some((x) => x.key === f.species));
  assert.ok(aquaOf(st).dex.includes(f.species!), "도감에 오른다");
  assert.equal(fishCare(f), 100, "하루 두 번이면 정성이 가득이다");
});

test("굶거나 물이 더러우면 성장이 멈춘다 — 죽지는 않는다", () => {
  const st = must(buyFry(rich(), "goldfish", 0));
  const a = tickAqua(aquaOf(st), 1000 * H).a;
  assert.equal(a.fish.length, 1);
  assert.equal(a.hunger, 0);
  assert.ok(a.fish[0].growH <= 24.01, `먹이 한 번치(24시간)만 자란다: ${a.fish[0].growH}`);
});

test("쪼개서 정산해도 한 번에 정산해도 같다 — 보고 있을 때만 이득이 생기면 안 된다", () => {
  const st = must(buyFry(rich(), "goldfish", 0));
  const once = tickAqua(aquaOf(st), 30 * H).a;
  let a = aquaOf(st);
  for (let h = 3; h <= 30; h += 3) a = tickAqua(a, h * H).a;
  assert.ok(Math.abs(once.fish[0].growH - a.fish[0].growH) < 1e-6);
  assert.ok(Math.abs(once.hunger - a.hunger) < 1e-6);
  assert.ok(Math.abs(once.water - a.water) < 1e-6);
});

test("오래 비워도 못 돌본 시간은 48시간까지만 — 여행 다녀왔다고 키운 정성이 사라지지 않는다", () => {
  const st = must(buyFry(rich(), "goldfish", 0));
  const a = tickAqua(aquaOf(st), 24 * 30 * H).a;
  assert.ok(a.fish[0].totalH <= 48.001);
});

test("정성이 높을수록 높은 형태가 열리고, 못 만난 형태가 먼저다 — 잘 키우면 넷을 다 만난다", () => {
  assert.deepEqual([50, 60, 75, 90].map(openFinals), [1, 2, 3, 4]);
  for (const fam of FAMILIES) {
    assert.equal(pickFinal(fam, 10, [], 7).key, fam.finals[0].key, "정성이 낮으면 첫 형태");
    const seen: string[] = [];
    for (let i = 0; i < fam.finals.length; i++) seen.push(pickFinal(fam, 100, seen, i * 13 + 1).key);
    assert.equal(new Set(seen).size, fam.finals.length, `${fam.key}: 모든 형태를 만난다 ${seen}`);
    // 다 만난 뒤엔 네 형태 중 하나 — 같은 물고기면 결과가 같다(두 기기가 갈리지 않는다)
    assert.equal(pickFinal(fam, 100, seen, 5).key, pickFinal(fam, 100, seen, 5).key);
  }
  let hit = 0;
  for (let i = 0; i < 400; i++) if (pickFinal(FAMILIES[0], 100, FAMILIES[0].finals.map((x) => x.key), i).key === FAMILIES[0].finals[3].key) hit++;
  assert.ok(hit > 100 && hit < 220, `가장 높은 형태가 가장 잘 나오되 절반쯤까지: ${hit}/400`);
});

test("악세사리 — 사면 보관함, 놓으면 수조, 치우면 다시 보관함 · 자리 수 제한", () => {
  let st = must(buyDecor(rich(), "treasure", 0));
  assert.equal(aquaOf(st).bag.treasure, 1);
  assert.equal(placeDecor(st, "coral", 50, 50, 0).ok, false, "보관함에 없는 건 못 놓는다");
  st = must(placeDecor(st, "treasure", 500, -9, 0));
  const p = aquaOf(st).placed[0];
  assert.ok(p.x <= 94 && p.y >= 14, "수조 밖으로 못 나간다");
  assert.equal(aquaOf(st).bag.treasure, undefined);
  st = must(moveDecor(st, p.id, 30, 60, 0));
  assert.equal(aquaOf(st).placed[0].x, 30);
  st = must(storeDecor(st, p.id, 0));
  assert.equal(aquaOf(st).placed.length, 0);
  assert.equal(aquaOf(st).bag.treasure, 1);
  let full = rich();
  for (let i = 0; i <= TANKS[0].decor; i++) full = must(buyDecor(full, "pebbles", 0));
  for (let i = 0; i < TANKS[0].decor; i++) full = must(placeDecor(full, "pebbles", 50, 50, 0));
  assert.equal(placeDecor(full, "pebbles", 50, 50, 0).ok, false);
});

test("장비는 놓아야 듣고 종류마다 가장 좋은 하나만 듣는다 · 아름다움 효과엔 천장", () => {
  const base = aquaEffects(aquaOf(rich()));
  let st = must(buyDecor(must(buyDecor(rich(), "filter_1", 0)), "filter_3", 0));
  assert.equal(aquaEffects(aquaOf(st)).waterHours, base.waterHours, "보관함에선 안 듣는다");
  st = must(placeDecor(must(placeDecor(st, "filter_1", 50, 50, 0)), "filter_3", 60, 50, 0));
  assert.equal(aquaEffects(aquaOf(st)).waterHours, base.waterHours * 2);
  const a = { ...aquaOf(st), placed: Array.from({ length: 200 }, (_, i) => ({ id: i, key: "star_gate", x: 50, y: 50 })) };
  assert.equal(aquaEffects(a).beautyGrow, 0.15);
});

test("3D 장식 회전·크기는 공유 저장에 남고 효과·재고·하트를 추가하지 않는다", () => {
  const bought=must(buyDecor(rich(),"treasure",0)),pose={rotation:-30,scale:1.4};
  const placed=must(placeDecor(bought,"treasure",25,65,0,pose)),p=aquaOf(placed).placed[0];
  assert.equal(p.rotation,330);assert.equal(p.scale,1.4);assert.equal(placed.coins,bought.coins);
  const moved=must(moveDecor(placed,p.id,70,40,0,{rotation:720,scale:99}));
  assert.equal(aquaOf(moved).placed[0].rotation,0);assert.equal(aquaOf(moved).placed[0].scale,1.6);
  assert.deepEqual(aquaEffects(aquaOf(moved)),aquaEffects(aquaOf(placed)));
  const serialized=JSON.parse(JSON.stringify(moved));assert.deepEqual(aquaOf(serialized).placed,aquaOf(moved).placed);
  const stored=must(storeDecor(moved,p.id,0));assert.equal(aquaOf(stored).bag.treasure,1);
  assert.equal(aquaOf(stored).placed.length,0);
  assert.deepEqual(decorPose({}),{rotation:0,scale:1});
  assert.deepEqual(decorPose({rotation:NaN,scale:Infinity}),{rotation:0,scale:1});
  const old=must(placeDecor(bought,"treasure",50,50,0));assert.equal(aquaOf(old).placed[0].rotation,undefined);
});

test("보내 주기 — 다 큰 물고기만 하트를 돌려받고, 언제나 치어 값보다 적다(하트 찍어 내는 길 금지) · 도감은 남는다", () => {
  for (const fam of FAMILIES) for (const sp of fam.finals) {
    const r = releaseReward({ family: fam.key, stage: 2, species: sp.key });
    assert.ok(r > 0 && r < fam.price, sp.key);
    assert.ok(r < 2000, `물고기는 낚시로 공짜로 들어오니 보상을 묶어 둔다: ${sp.key} ${r}`);
  }
  assert.equal(releaseReward({ family: "guppy", stage: 0 }), 0);
  const st = raise(rich(), "guppy");
  const f = aquaOf(st).fish[0];
  const after = must(releaseFish(st, f.id, aquaOf(st).at));
  assert.equal(aquaOf(after).fish.length, 0);
  assert.ok(aquaOf(after).dex.includes(f.species!));
  assert.equal(after.coins, st.coins + releaseReward(f));
});

test("옛 저장분(수조 없음)도 돈다 · 표에서 사라진 값은 버린다", () => {
  const a = aquaOf({ aquarium: undefined }, 5);
  assert.equal(a.tank, 1);
  assert.deepEqual(a.fish, []);
  const b = aquaOf({ aquarium: { ...a, fish: [{ id: 1, family: "없는거", stage: 0, growH: 0, goodH: 0, totalH: 0 }], placed: [{ id: 2, key: "없는거", x: 1, y: 1 }] } });
  assert.deepEqual(b.fish, []);
  assert.deepEqual(b.placed, []);
  assert.equal(syncAqua(rich(), 0).evolved.length, 0);
});

test("프롬프트 문서 — 모든 물고기 · 악세사리 · 수조의 key 가 빠짐없이 있다 · 그림 목록은 실제 파일", async () => {
  const doc = readFileSync(join(root, "design/AQUARIUM-ART.md"), "utf8");
  const keys = [
    ...FAMILIES.flatMap((f) => [`fry_${f.key}`, `juv_${f.key}`]),
    ...ALL_SPECIES.map((x) => x.key),
    ...DECOR.map((x) => x.key),
    ...TANKS.map((_, i) => `tank_${i + 1}`),
    // Prepared artwork is deliberately registered before catch activation.
    ...["catfish", "sweetfish", "jellyfish"].flatMap(f => [f, `fry_${f}`, `juv_${f}`]),
  ];
  for (const k of keys) assert.ok(doc.includes(`| \`${k}\` |`), `${k} 프롬프트가 없다`);
  const rows = doc.split("\n").filter((l) => l.startsWith("| `")).length;
  assert.equal(rows, keys.length, "표에 없는 물고기의 프롬프트가 남았다");
  for (const k of FISH_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/aqua/fish", `${k}.webp`)) && existsSync(join(root, "public/aqua/fish/sm", `${k}.webp`)), k);
  for (const k of DECOR_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/aqua/decor", `${k}.webp`)) && existsSync(join(root, "public/aqua/decor/sm", `${k}.webp`)), k);
  for (const k of TANK_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/aqua/tank", `${k}.webp`)), k);
});

test("엔진은 섬 엔진을 값으로 부르지 않는다 · 게임 탭에 카드가 있다", () => {
  const src = readFileSync(join(root, "src/lib/aquarium.ts"), "utf8");
  assert.doesNotMatch(src, /^import \{[^}]*\} from "\.\/island/m);
  assert.match(src, /^import type \{ IslandState \} from "\.\/island\.ts";/m);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""), /Math\.random/, "두 기기의 결과가 갈린다");
  const arcade = readFileSync(join(root, "src/components/GameArcade.tsx"), "utf8");
  assert.ok(arcade.includes("game-mode-aqua") && arcade.includes("<AquariumGame"));
});
