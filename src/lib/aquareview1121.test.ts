// 수조 · 낚시 리뷰 2 · 3 · 4 — 2026-11-21 [사용자: 리뷰 중 "2번 3번 4번 진행해 1번은 필요없어"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aquaAlert, aquaTodayItems } from "./aquatoday.ts";
import { MASTERY_RELEASE_N, noteReleaseMastery, spotMastery } from "./fishmastery.ts";
import type { AquaFish, AquaState } from "./aquarium.ts";
import type { IslandState } from "./island.ts";

const read = (p: string) => readFileSync(p, "utf8");
const fish = (id: number, family: string, stage: 0 | 1 | 2): AquaFish => ({ id, family, stage, growH: 0, care: 1 } as unknown as AquaFish);
const tank = (over: Partial<AquaState>): AquaState => ({ tank: 1, fish: [], placed: [], bag: {}, hunger: 100, water: 100, at: Date.UTC(2026, 10, 21), ...over } as unknown as AquaState);

test("④ · ⑦ 오늘 할 일 — 배고픈 사냥꾼이 맨 앞, 먹이 · 물이 멈췄으면 급함, 물고기가 없으면 빈 목록", () => {
  assert.deepEqual(aquaTodayItems(tank({})), []);
  const hungryHunter = tank({ fish: [fish(1, "great_white", 2), fish(2, "guppy", 0)], hunger: 50 });
  const items = aquaTodayItems(hungryHunter);
  assert.equal(items[0]?.key, "hunter");
  assert.ok(items[0].urgent);
  assert.match(aquaAlert(hungryHunter) ?? "", /배고픈 사냥꾼/);
  const dry = aquaTodayItems(tank({ fish: [fish(1, "guppy", 1)], hunger: 0, water: 0 }));
  assert.deepEqual(dry.map((x) => x.key), ["feed", "water"]);
  assert.equal(aquaAlert(tank({ fish: [fish(1, "guppy", 1)] })), null, "급한 것이 없으면 카드는 원래 문구");
  assert.match(read("src/components/GameArcade.tsx"), /aquaAlert\(aqua\) \?\? growBlock\(aqua\)/);
});

test("⑥ 다 키워 보내면 잡은 낚시터 숙련도가 오른다 — 낚시터를 모르면 그대로", () => {
  const st = { fishPlus: {} } as unknown as IslandState;
  assert.equal(noteReleaseMastery(st, undefined, "guppy"), st);
  const after = noteReleaseMastery(st, "brook", "guppy");
  assert.equal(spotMastery(after, "brook").n, MASTERY_RELEASE_N);
  assert.deepEqual(spotMastery(noteReleaseMastery(after, "brook", "guppy"), "brook").kinds, ["guppy"], "같은 모습은 한 번만");
  assert.match(read("src/lib/fishing.ts"), /const origin = f\.stage === 2 && raisedShare\(f\) > 0 \? releaseSpot\(f, synced\.life\) : undefined;/, "수조에서 자란 몫이 있을 때만(2026-11-23)");
});

test("⑤ · ⑨ 수조 화면 — 가득 차면 견주기 카드, 늘리기는 넓히기 칸, 오늘 할 일 칩", () => {
  const g = read("src/components/AquariumGame.tsx");
  assert.match(g, /\["grow", "넓히기"\]/);
  assert.match(g, /fishRoom\(a\) <= 0 && a\.fish\.length > 0 && <FullCompare/);
  const tankTab = g.slice(g.indexOf('{tab === "tank" && ('), g.indexOf('{tab === "grow" && ('));
  for (const s of ["widenTank(", "deepenTank(", "sinkTank(", "upgradeTank("]) assert.ok(!tankTab.includes(s), `${s} 는 수조 칸에 없다`);
  assert.match(tankTab, /aqua-today-chip/);
});

test("⑧ 보기 버튼은 하나 — 전체 보기 · 사진 · 해변 · 밖에서 보기를 메뉴로", () => {
  const ui = read("src/components/Aquarium3D.tsx");
  assert.match(ui, /className=\{`aqua-view-btn/);
  for (const c of ["aqua-photo-btn", "aqua-beach-btn", "aqua-tunnel-btn"]) assert.ok(!ui.includes(c), c);
  assert.match(ui, /function runView\(k: ViewKey\)/);
});

test("⑪ 낚싯대 · 찌 그리기는 fishingfxgear 로 — fishingfx 는 다시 내보내기만", () => {
  const fx = read("src/lib/fishingfx.ts"), gear = read("src/lib/fishingfxgear.ts");
  assert.match(gear, /export function bakeRod\(/);
  assert.match(gear, /export function paintBobber\(/);
  assert.ok(!/function bakeRod\(|function paintBobber\(/.test(fx));
  assert.match(fx, /export \{ FX_RODS, FX_ROD_ART, FX_NET_HOOP, FX_LOOK_DEFAULT, FX_BOBBERS, paintBobber, type FxLook \} from "\.\/fishingfxgear\.ts";/);
});
