// 갈림길(계보 ↔ 옛 히어로) lock. [사용자 2026-10-17 "히어로랑 그 포켓몬이랑 진화 연계되도록" · "어떤걸로 시작했어도 다 분기를 탔으면"]
//
// 성장기·중간형은 계보 폼이든 옛 히어로 폼이든 다음 단계에서 **두 갈래**다 — 자기 줄의 다음 폼(same)과 다른 줄의 같은 단계 폼(other).
// 잠그는 성질:
//  1. 돌봄 기록이나 seenForms 가 없으면 갈림길이 안 열린다(옛 저장분 · 옛 호출부 — 무마이그레이션).
//  2. 계보 → 히어로는 돌봄에서 정한 히어로 줄(옛 규칙: 집중도 · 정성), 히어로 → 계보는 돌봄 묶음으로 고른 계보.
//  3. 못 만난 쪽으로 자라고, 둘 다 같은 처지면 번갈아 — 어느 쪽도 영영 안 나오지 않는다.
//  4. 히어로 중간형 10 · 최종형 20 이 전부 계보에서 닿는다(못 채우는 칸이 없다).
//  5. 옛 히어로 최종형도 신화로 간다(돌봄 묶음의 영물), 업적 · 도감도 다시 열린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  PET_FORMS,
  type CareAct,
  type EvoContext,
  achievementViews,
  createIsland,
  evolutionPreview,
  evolutionTree,
  forkOptions,
  nextEvolution,
} from "./island.ts";
import { LINEAGE_OF_FORM } from "./lineages.ts";

const T = Date.UTC(2026, 9, 17, 3, 0, 0);
type Care = Partial<Record<CareAct, number>>;
const ctx = (seed: number, lives: number, seen: string[] = []): EvoContext => ({ seed, lives, seenForms: new Set(seen) });
const FOCUS_PLAY: Care = { play: 10, hug: 1 }; // 놀기 한 가지 — 집중

test("★ 돌봄 기록이나 seenForms 가 없으면 갈림길이 안 열린다 — 자기 줄 그대로", () => {
  assert.equal(nextEvolution("ember_2", 90, 5, 0), "ember_3");
  assert.equal(nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, { seed: 1, lives: 0 }), "ember_4", "seenForms 없음");
  assert.equal(nextEvolution("ember_3", 90, 5, 0, 0, undefined, ctx(1, 0)), "ember_4", "돌봄 기록 없음");
  assert.equal(nextEvolution("fox", 90, 5, 0), "celestial_fox");
  assert.equal(nextEvolution("sunny", 90, 5, 0, 0, undefined, ctx(1, 0)), "fox");
});

test("★ 계보 → 히어로 — 돌봄이 정한 히어로 줄(집중도 · 정성)", () => {
  const c = ctx(0, 0);
  assert.deepEqual(forkOptions("ember_2", "ember_3", 3, 90, 0, FOCUS_PLAY, c), { same: "ember_3", other: "fox" }, "놀기 + 집중 → 여우");
  assert.deepEqual(forkOptions("ember_3", "ember_4", 4, 90, 0, FOCUS_PLAY, c), { same: "ember_4", other: "celestial_fox" }, "정성 높으면 천상여우");
  assert.deepEqual(forkOptions("ember_3", "ember_4", 4, 50, 0, FOCUS_PLAY, c), { same: "ember_4", other: "starlight_fox" }, "정성 낮으면 별빛여우");
  assert.equal(forkOptions("ember_3", "ember_4", 4, 90, 3, FOCUS_PLAY, c)!.other, "starlight_fox", "방치가 많으면 정성이 높아도 일반");
  // 고루 하면 고양이(옛 중간형 규칙)
  const even: Care = { play: 3, hug: 3, feed: 3, clean: 3, rest: 3 };
  const o = forkOptions("ember_2", "ember_3", 3, 90, 0, even, ctx(0, 0))!.other;
  assert.ok(["cat", "panda", "wolf", "rabbit", "squirrel"].includes(o), `고루 → 고루 갈래: ${o}`);
});

test("★ 히어로 → 계보 — 돌봄 묶음으로 고른 계보의 같은 단계 폼", () => {
  const c = ctx(0, 0);
  assert.deepEqual(forkOptions("sunny", "fox", 3, 90, 0, FOCUS_PLAY, c), { same: "fox", other: "ember_3" });
  assert.deepEqual(forkOptions("fox", "celestial_fox", 4, 90, 0, FOCUS_PLAY, c), { same: "celestial_fox", other: "ember_4" });
  const pair: Care = { play: 6, hug: 6, feed: 1 };
  assert.equal(forkOptions("cat", "royal_cat", 4, 90, 0, pair, c)!.other, "toy_4", "두 가지를 즐겨 하면 투톱 계보");
});

test("★ 못 만난 쪽으로 자라고, 같은 처지면 번갈아 — 한쪽만 영영 나오는 일이 없다", () => {
  const same = nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, ctx(0, 0, ["celestial_fox"]));
  assert.equal(same, "ember_4", "히어로 쪽을 이미 만났으면 계보 쪽");
  const other = nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, ctx(0, 0, ["ember_4"]));
  assert.equal(other, "celestial_fox", "계보 쪽을 이미 만났으면 히어로 쪽");
  const both = new Set<string>();
  for (let lives = 0; lives < 4; lives++) both.add(nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, ctx(0, lives)) ?? "");
  assert.deepEqual([...both].sort(), ["celestial_fox", "ember_4"], "둘 다 같은 처지면 생마다 번갈아");
  // 결정적
  for (let i = 0; i < 4; i++) assert.equal(nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, ctx(3, 2)), nextEvolution("ember_3", 90, 5, 0, 0, FOCUS_PLAY, ctx(3, 2)));
});

test("★ 히어로 중간형 10 · 최종형 20 이 전부 계보에서 닿는다", () => {
  const mids = Object.values(PET_FORMS).filter((f) => f.legacy && f.stage === 3).map((f) => f.key);
  const finals = Object.values(PET_FORMS).filter((f) => f.legacy && f.stage === 4).map((f) => f.key);
  assert.equal(mids.length, 10);
  assert.equal(finals.length, 20);
  const gotMid = new Set<string>(), gotFinal = new Set<string>();
  const acts: CareAct[] = ["play", "hug", "feed", "clean", "rest"];
  const profiles: Care[] = [];
  for (const a of acts) profiles.push(Object.fromEntries(acts.map((x) => [x, x === a ? 10 : 1])) as Care); // 집중
  profiles.push({ play: 3, hug: 3, feed: 3, clean: 3, rest: 3 }); // 고루(돌림으로 다섯 줄을 다 돈다)
  for (const care of profiles) for (let lives = 0; lives < 5; lives++) for (const [cq, neg] of [[90, 0], [40, 5]] as const) {
    const c = ctx(0, lives);
    const m = forkOptions("ember_2", "ember_3", 3, cq, neg, care, c);
    const f = forkOptions("ember_3", "ember_4", 4, cq, neg, care, c);
    if (m) gotMid.add(m.other);
    if (f) gotFinal.add(f.other);
  }
  assert.deepEqual([...gotMid].sort(), [...mids].sort(), "히어로 중간형 10 이 전부 닿아야 한다");
  assert.deepEqual([...gotFinal].sort(), [...finals].sort(), "히어로 최종형 20 이 전부 닿아야 한다");
});

test("★ 계보 폼 어디서든(성장기 · 중간형) 갈림길이 열린다 — 어떤 걸로 시작해도 분기를 탄다", () => {
  const care: Care = { play: 6, hug: 6, feed: 6, clean: 6, rest: 6 };
  for (const form of ["ember_2", "toy_2", "unicorn_2", "ember_3", "ele_3", "snow_3"]) {
    const st = PET_FORMS[form].stage;
    const same = LINEAGE_OF_FORM[form].lineage.forms[st - 1].key;
    const f = forkOptions(form, same, st + 1, 90, 0, care, ctx(0, 0));
    assert.ok(f && f.other !== f.same && !LINEAGE_OF_FORM[f.other], `${form}: 히어로 갈래가 안 열린다`);
  }
  for (const form of ["sunny", "cozy", "fox", "panda", "deer"]) {
    const next = nextEvolution(form, 90, 1, 0)!;
    const st = PET_FORMS[form].stage;
    const f = forkOptions(form, next, st + 1, 90, 0, care, ctx(0, 0));
    assert.ok(f && !!LINEAGE_OF_FORM[f.other], `${form}: 계보 갈래가 안 열린다`);
  }
});

test("★ 옛 히어로 최종형도 신화로 간다 — 돌봄 묶음이 영물을 정한다(기록 없으면 호랑이)", () => {
  const cq = 70;
  assert.equal(nextEvolution("royal_cat", cq, 1, 5), "tiger", "기록 없음");
  assert.equal(nextEvolution("royal_cat", cq, 1, 5, 0, { rest: 10, play: 1 }, ctx(0, 0)), "maek", "재우기 → 몽맥");
  assert.equal(nextEvolution("royal_cat", cq, 1, 5, 0, { play: 10, hug: 1 }, ctx(0, 0)), "cheonma", "놀기 → 천마");
  assert.equal(nextEvolution("royal_cat", 30, 1, 5, 0, { play: 10 }, ctx(0, 0)), "giraffe", "정성 미달은 기린");
});

test("★ 미리보기가 갈림길을 알려 준다 — same · other · 지금 정해진 쪽", () => {
  const s = createIsland("콩", null, T);
  s.pet.form = "ember_2";
  s.pet.care = FOCUS_PLAY;
  const p = evolutionPreview(s);
  assert.ok(p.fork, "갈림길이 안 보인다");
  assert.equal(p.fork!.same, "ember_3");
  assert.equal(p.fork!.other, "fox");
  assert.ok([p.fork!.same, p.fork!.other].includes(p.fork!.chosen));
  assert.equal(p.target, p.fork!.chosen, "미리보기와 엔진이 같은 답");
  assert.ok(p.hint && p.hint.includes("갈림길"));
  // 아기 · 신화 이상은 갈림길이 없다
  const e = createIsland("콩", null, T);
  e.pet.form = "hatchling";
  assert.equal(evolutionPreview(e).fork, null);
});

test("★ 히어로 줄 · 업적이 다시 열린다 — 도감 열 줄, 옛 최종형 업적도 보인다", () => {
  const s = createIsland("콩", null, T);
  const t = evolutionTree(s);
  assert.equal(t.branches.length, 10);
  assert.ok(ACHIEVEMENTS.some((a) => a.key === "pet_royal_cat"));
  assert.ok(achievementViews(s, T).some((v) => v.key === "pet_royal_cat"), "옛 최종형 업적이 감춰져 있다");
});
