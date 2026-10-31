// 정원 합치기 스킨 상점 lock. [사용자 2026-10-31 "단계별 스킨을 하트로 살 수 있는 상점 … 우리 에셋 활용 … 가격은 비싸게"]
// + 이름 없는 사람의 랭킹 닉네임 [사용자 "이름 없는 사람들은 랭킹 등록 시 닉네임 정할 수 있게"].
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAIN, MAX_LV, mergeOf, settleGame } from "./merge.ts";
import { SKINS, buySkin, ownedSkins, seenFormsOf, skinPrice, skinsOfLv, wearSkin, wornForms } from "./mergeskins.ts";
import { ACTIVITY_KINDS, gameRouteOf } from "./activity.ts";
import { PET_FORMS, createIsland, type IslandState } from "./island.ts";
import { hasHeroAsset, heroAsset } from "./heroassets.ts";

const root = process.cwd();
const rich = (coins: number): IslandState => ({ ...createIsland("콩", null, 0), coins });

test("단계마다 스킨 둘 — 섬 히어로 원화(실제 파일)이고 이름이 펫 표와 같다", () => {
  assert.equal(CHAIN.length, MAX_LV);
  for (let lv = 1; lv <= MAX_LV; lv++) assert.equal(skinsOfLv(lv).length, 2, `${lv}단계`);
  assert.equal(new Set(SKINS.map((k) => k.form)).size, SKINS.length, "같은 그림을 두 번 팔지 않는다");
  for (const k of SKINS) {
    assert.ok(hasHeroAsset(k.form), `${k.form} 원화`);
    const p = heroAsset(k.form, 64).split("?")[0];
    assert.ok(existsSync(join(root, "public", p)), `${p} 파일`);
    assert.equal(PET_FORMS[k.form]?.name, k.name, `${k.form} 이름`);
  }
});

test("가격은 비싸고 단계가 오를수록 오른다", () => {
  assert.equal(skinPrice(1), 5000);
  assert.ok(skinPrice(MAX_LV) >= 80000);
  for (let lv = 2; lv <= MAX_LV; lv++) assert.ok(skinPrice(lv) > skinPrice(lv - 1));
  for (const k of SKINS) assert.equal(k.price, skinPrice(k.lv));
});

test("사기 — 하트를 내고 바로 낀다 · 모자라면 못 산다 · 두 번 못 산다", () => {
  const k = skinsOfLv(12)[0];
  assert.equal(buySkin(rich(k.price - 1), "a", k.id).ok, false);
  const r = buySkin(rich(k.price + 10), "a", k.id);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.coins, 10);
  assert.equal(wornForms(mergeOf(r.state), "a")[12], k.form);
  assert.equal(wornForms(mergeOf(r.state), "b")[12], undefined, "끼는 건 사람마다");
  assert.equal(buySkin({ ...r.state, coins: 1e9 }, "b", k.id).ok, false, "산 스킨은 커플이 같이 쓴다(다시 안 산다)");
});

test("끼기 · 벗기 — 산 것만, 그 단계에만", () => {
  const k = skinsOfLv(3)[1];
  assert.equal(wearSkin(rich(0), "a", 3, k.id).ok, false, "안 산 스킨");
  const bought = buySkin(rich(k.price), "a", k.id);
  assert.ok(bought.ok);
  if (!bought.ok) return;
  assert.equal(wearSkin(bought.state, "a", 4, k.id).ok, false, "다른 단계");
  const b = wearSkin(bought.state, "b", 3, k.id);
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(wornForms(mergeOf(b.state), "b")[3], k.form);
  const off = wearSkin(b.state, "a", 3, null);
  assert.ok(off.ok);
  if (!off.ok) return;
  assert.equal(wornForms(mergeOf(off.state), "a")[3], undefined);
  assert.equal(ownedSkins(mergeOf(off.state)).has(k.id), true, "벗어도 산 건 남는다");
});

test("판을 끝내 섬에 남겨도 스킨은 그대로 · 옛 저장분(스킨 없음)도 돈다", () => {
  const k = skinsOfLv(1)[0];
  const r = buySkin(rich(k.price), "a", k.id);
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = settleGame(r.state, "a", 500, 5, "2026-10-31").state;
  assert.equal(wornForms(mergeOf(s), "a")[1], k.form);
  assert.deepEqual(wornForms(mergeOf(rich(0)), "a"), {});
  assert.deepEqual(wornForms({ skins: ["없는거"], wear: { a: { "1": "없는거" } } }, "a"), {});
});

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("스킨 엔진은 섬 엔진을 값으로 부르지 않는다(타입만)", () => {
  const src = strip(readFileSync(join(root, "src/lib/mergeskins.ts"), "utf8"));
  assert.doesNotMatch(src, /import\s+\{[^}]*\}\s+from\s+"\.\/island(\.ts)?"/);
});

test("화면 — 상점 버튼 · 낀 스킨을 칸에 그린다 · 이름 없으면 닉네임을 정한 뒤 올린다", () => {
  const src = strip(readFileSync(join(root, "src/components/MergeGame.tsx"), "utf8"));
  assert.match(src, /스킨 상점/);
  assert.match(src, /skin=\{worn\[tile\.lv\]\}/);
  assert.match(src, /buySkin\(st, who, k\.id\)/);
  assert.match(src, /if \(!pendingRank \|\| !rankName\) return;/, "이름이 없으면 순위 등록을 기다린다");
  assert.doesNotMatch(src, /"이름 없음"/, "'이름 없음'으로 올리지 않는다");
  assert.match(src, /aria-label="랭킹 닉네임"/);
});

test("못 만난 캐릭터는 상점에서 '?' — 섬에서 만났거나(도감 · 박물관 · 지금 펫) 산 것만 보인다", () => {
  const s = createIsland("콩", null, 0);
  const seen = seenFormsOf({ ...s, catalog: ["fox"], museum: ["tiger"] });
  assert.ok(seen.has("fox") && seen.has("tiger") && seen.has(s.pet.form));
  assert.ok(!seen.has("yellow_dragon"));
  const src = strip(readFileSync(join(root, "src/components/MergeGame.tsx"), "utf8"));
  assert.match(src, /const hidden = !has && !seen\.has\(k\.form\)/);
  assert.match(src, /hidden \? "\?\?\?" : k\.name/);
});

test("게임 링크 — ?go=game · merge · island 와 짧은 주소 /game/", () => {
  assert.deepEqual(gameRouteOf("merge"), { view: "game", open: "merge" });
  assert.deepEqual(gameRouteOf("island"), { view: "game", open: "island" });
  assert.deepEqual(gameRouteOf("game"), { view: "game" });
  assert.equal(gameRouteOf("toString"), null);
  for (const k of ACTIVITY_KINDS) assert.equal(gameRouteOf(k), null, `${k} 는 활동 종류 — 겹치면 안 된다`);
  assert.match(readFileSync(join(root, "src/app/game/GameRedirect.tsx"), "utf8"), /asset\("\/\?go=merge"\)/);
  assert.match(strip(readFileSync(join(root, "src/app/page.tsx"), "utf8")), /kind \? activityRoute\(kind\) : gameRouteOf\(go\)/);
});
