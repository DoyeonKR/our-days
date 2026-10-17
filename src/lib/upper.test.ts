// 상위 단계 확장 lock. [2026-10-17 "상위 목록이 너무 적어 상위 목록도 2배이상 늘려줘"]
//
// 신화 5 → 10 · 사신 4 → 8 · 천수 2 → 4 · 황룡 1 → 2 (12 → 24). 여기서 잠그는 건 값이 아니라 **성질**이다:
//  1. 표(uppers.ts)와 PET_FORMS · 도감 배열이 어긋나지 않는다.
//  2. 신화: 옛 서열(무등산 > 뱅갈 > 사자)은 그대로, 그 아래에서 **계보의 영물**이 갈린다 — 호랑이도 닿는다(만능).
//  3. 사신: 새 네 축이 이겨도 옛 넷의 답은 안 바뀐다(재료가 없으면 0 이라 못 이긴다).
//  4. 천수 · 황룡: 우선순위가 정해져 있고, 재료가 없으면 예전 답(해태 · 황룡)이다 — 무마이그레이션.
//  5. 24폼 전부 어떤 상태에서든 **닿을 수 있다** — 못 채우는 칸이 없다.
//  6. 도트 전용(일러스트 원화 없음)이라 isPixelOnlyForm 이 도트로 받고, 도트 계약(걷기 · 앵커 · 정의된 글자 · 수면)을 진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  APEX_FORMS,
  CELESTIAL_FORMS,
  DIVINE_FORMS,
  MYTHIC_FORMS,
  PET_FORMS,
  TUNING,
  type EvoContext,
  createIsland,
  divineDirection,
  evoContextOf,
  evolutionPreview,
  evolutionTree,
  nextEvolution,
} from "./island.ts";
import { LINEAGES, isPixelOnlyForm } from "./lineages.ts";
import { MYTHIC_BEAST_BY_ACT, UPPERS, UPPER_KEYS, mythicBeastOf } from "./uppers.ts";
import { petSprites, sleepSprite } from "./pixelart.ts";
import { gearAnchors, validateSprite } from "./pixel.ts";
import { GAIT_FRAMES } from "./pixelpet48.ts";

const T = Date.UTC(2026, 9, 17, 3, 0, 0);
const B = TUNING.pet.branch;
const finalOf = (key: string) => LINEAGES.find((l) => l.key === key)!.forms[2].key;

// ── 1. 표 ───────────────────────────────────────────────────────

test("★ 상위는 12 → 24 — 신화 10 · 사신 8 · 천수 4 · 황룡 2, 단조 감소 유지", () => {
  const count = (st: number) => Object.values(PET_FORMS).filter((f) => f.stage === st).length;
  assert.deepEqual([5, 6, 7, 8].map(count), [10, 8, 4, 2]);
  assert.equal([5, 6, 7, 8].reduce((n, st) => n + count(st), 0), 24);
  assert.equal(UPPERS.length, 12);
  for (let st = 6; st <= 8; st++) assert.ok(count(st) <= count(st - 1), `stage ${st} 가 아래층보다 넓다`);
});

test("★ 표 · PET_FORMS · 도감 배열이 일치한다", () => {
  const keysOf = (st: number) => Object.values(PET_FORMS).filter((f) => f.stage === st).map((f) => f.key).sort();
  assert.deepEqual([...MYTHIC_FORMS].sort(), keysOf(5));
  assert.deepEqual([...DIVINE_FORMS].sort(), keysOf(6));
  assert.deepEqual([...CELESTIAL_FORMS].sort(), keysOf(7));
  assert.deepEqual([...APEX_FORMS].sort(), keysOf(8));
  for (const u of UPPERS) {
    const f = PET_FORMS[u.key];
    assert.ok(f && f.extra, `${u.key}: PET_FORMS 에 extra 로 없다`);
    assert.equal(f.stage, u.stage);
    assert.ok(!f.lineage && !f.legacy);
    assert.ok(UPPER_KEYS.has(u.key));
  }
  const t = evolutionTree(createIsland("콩", null, T));
  assert.deepEqual(t.mythics.map((n) => n.key).sort(), keysOf(5));
  assert.deepEqual(t.divines.map((n) => n.key).sort(), keysOf(6));
  assert.deepEqual(t.celestials.map((n) => n.key).sort(), keysOf(7));
  assert.deepEqual(t.apex.map((n) => n.key).sort(), keysOf(8));
  assert.equal(t.finalsTotal, 30 + 10 + 8 + 4 + 2, "컬렉션 분모 = 계보 최종 30 + 상위 24");
});

test("★ 새 폼마다 업적이 있다 — 층이 오를수록 보상도 오른다", () => {
  for (const u of UPPERS) assert.ok(ACHIEVEMENTS.some((a) => a.key === `pet_${u.key}`), `${u.key} 업적`);
  const reward = (st: number) => ACHIEVEMENTS.find((a) => a.key === `pet_${UPPERS.find((u) => u.stage === st)!.key}`)!.reward;
  assert.ok(reward(5) < reward(6) && reward(6) < reward(7) && reward(7) < reward(8));
});

// ── 2. 신화 ─────────────────────────────────────────────────────

test("★ 신화 — 최상위 조건(무등산 > 뱅갈 > 사자)은 계보 폼에서도 그대로 앞선다", () => {
  const f = finalOf("ember");
  assert.equal(nextEvolution(f, 95, 1, 0, 1), "mudeung_tiger");
  assert.equal(nextEvolution(f, 95, 1, 0, 0), "bengal_tiger");
  assert.equal(nextEvolution(f, 70, B.s5LionBond, 5), "lion");
});

test("★ 신화 — 정성이 받쳐 주면 계보의 영물, 모자라면 기린 (돌봄 하나가 영물 하나)", () => {
  assert.deepEqual(
    Object.entries(MYTHIC_BEAST_BY_ACT).sort(),
    [["clean", "imugi"], ["feed", "bulgasari"], ["hug", "baengnok"], ["play", "cheonma"], ["rest", "maek"]],
  );
  const mid = B.s5Mid;
  for (const l of LINEAGES) {
    const f = l.forms[2].key;
    assert.equal(nextEvolution(f, mid, 1, 5), mythicBeastOf(l.acts), `${l.key}`);
    assert.equal(nextEvolution(f, mid - 1, 1, 5), "giraffe", `${l.key}: 정성 미달은 기린`);
  }
  assert.equal(mythicBeastOf(["play"]), "cheonma");
  assert.equal(mythicBeastOf(["hug", "clean"]), "baengnok", "묶음의 첫 돌봄");
  assert.equal(mythicBeastOf(["play", "hug", "feed", "clean"]), "tiger", "만능은 호랑이 — 호랑이가 새 생에서도 닿는다");
});

test("★ 신화 — 옛 최종형(legacy)의 답은 안 바뀐다", () => {
  assert.equal(nextEvolution("royal_cat", B.s5Mid, 1, 5), "tiger");
  assert.equal(nextEvolution("royal_cat", B.s5Mid - 1, 1, 5), "giraffe");
});

test("★ 신화 10종이 전부 닿는다 — 못 채우는 칸이 없다", () => {
  const reach = new Set<string>();
  for (const l of LINEAGES) for (const [cq, bond, neg, fed] of [[95, 1, 0, 1], [95, 1, 0, 0], [70, 9, 3, 0], [70, 1, 3, 0], [20, 1, 3, 0]] as const) {
    const m = nextEvolution(l.forms[2].key, cq, bond, neg, fed);
    if (m) reach.add(m);
  }
  assert.deepEqual([...reach].sort(), [...MYTHIC_FORMS].sort());
});

// ── 3. 사신 ─────────────────────────────────────────────────────

test("★ 사신 — 새 네 축이 각자 이긴다 · 옛 넷의 답은 그대로", () => {
  const f = B.s6Full;
  assert.equal(divineDirection({ bond: f.bond }), "bii_jo", "유대 → 비익조");
  assert.equal(divineDirection({ streak: f.streak }), "eungryong", "출석 → 응룡");
  assert.equal(divineDirection({ dex: f.dex }), "baektaek", "도감 → 백택");
  assert.equal(divineDirection({ level: f.level }), "geumseom", "섬 레벨 → 금두꺼비");
  assert.equal(divineDirection({ farmSkill: f.farm }), "azure_dragon");
  assert.equal(divineDirection({ huntBest: f.hunt }), "vermilion_bird");
  assert.equal(divineDirection({ gearOwned: f.gear }), "white_tiger");
  assert.equal(divineDirection({ rating: f.rating }), "black_tortoise");
  assert.equal(divineDirection({}), "black_tortoise", "아무것도 안 팠으면 현무");
});

test("★ 사신 — 동점이면 옛 넷이 먼저(결정적), 더 깊이 판 새 축은 옛 축을 넘는다", () => {
  const f = B.s6Full;
  assert.equal(divineDirection({ farmSkill: f.farm, bond: f.bond }), "azure_dragon", "같은 비율이면 옛 축 먼저");
  assert.equal(divineDirection({ farmSkill: f.farm, bond: f.bond * 2 }), "bii_jo", "새 축이 더 깊으면 새 축");
  for (let i = 0; i < 5; i++) assert.equal(divineDirection({ streak: f.streak, dex: f.dex }), "eungryong");
});

test("★ evoContextOf 가 새 재료를 읽는다 — 유대 · 출석 · 도감(펫 폼만) · 섬 레벨", () => {
  const s = createIsland("콩", null, T);
  s.bond.level = 7;
  s.streak.count = 12;
  s.level = 9;
  s.catalog = ["egg", "hatchling", "tulip", "combo_x", "tiger"]; // 꾸미기·조합 키는 도감 수에 안 센다
  const c = evoContextOf(s);
  assert.deepEqual({ bond: c.bond, streak: c.streak, level: c.level, dex: c.dex }, { bond: 7, streak: 12, level: 9, dex: 3 });
});

// ── 4. 천수 · 황룡 ──────────────────────────────────────────────

test("★ 천수 — 봉황(박물관) > 삼족오(유대) > 천록(출석) > 해태, 재료가 없으면 해태", () => {
  const all: EvoContext = { museum: B.s7PhoenixMuseum, bond: B.s7Bond, streak: B.s7Streak };
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, undefined, all), "phoenix");
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, undefined, { ...all, museum: 0 }), "samjoko");
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, undefined, { ...all, museum: 0, bond: 0 }), "cheonrok");
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, undefined, {}), "haetae");
  assert.equal(nextEvolution("bii_jo", 90, 5, 0), "haetae", "새 사신에서도 같은 길");
});

test("★ 황룡 — 박물관을 크게 채우면 홍룡, 아니면 황룡 (모든 천수에서)", () => {
  for (const from of CELESTIAL_FORMS) {
    assert.equal(nextEvolution(from, 10, 0, 9, 0, undefined, {}), "yellow_dragon", `${from} → 황룡`);
    assert.equal(nextEvolution(from, 10, 0, 9, 0, undefined, { museum: B.s8Museum }), "hong_dragon", `${from} → 홍룡`);
  }
  for (const a of APEX_FORMS) assert.equal(nextEvolution(a, 100, 10, 0, 3, undefined, { museum: 99 }), null, "정점 위는 없다");
});

test("★ 24폼 전부 어떤 아래층에서든 닿는다 — 사신 8 · 천수 4 · 황룡 2", () => {
  const f = B.s6Full;
  const divine = new Set<string>([
    divineDirection({ farmSkill: f.farm }), divineDirection({ huntBest: f.hunt }), divineDirection({ gearOwned: f.gear }),
    divineDirection({ rating: f.rating }), divineDirection({ bond: f.bond }), divineDirection({ streak: f.streak }),
    divineDirection({ dex: f.dex }), divineDirection({ level: f.level }),
  ]);
  assert.deepEqual([...divine].sort(), [...DIVINE_FORMS].sort());
  const cel = new Set<string>();
  for (const c of [{ museum: 99 }, { bond: 99 }, { streak: 99 }, {}] as EvoContext[]) cel.add(String(nextEvolution("azure_dragon", 90, 5, 0, 0, undefined, c)));
  assert.deepEqual([...cel].sort(), [...CELESTIAL_FORMS].sort());
});

// ── 5. 미리 알림 ────────────────────────────────────────────────

test("★ 미리보기가 새 갈래를 안내한다 — 계보 영물 · 천수 · 홍룡", () => {
  const mk = (form: string, cq = 50) => {
    const s = createIsland("콩", null, T);
    s.pet.form = form;
    s.pet.cq = cq;
    return evolutionPreview(s);
  };
  const low = mk(finalOf("ember"), 30);
  assert.equal(low.target, "giraffe");
  assert.ok(low.hint && low.hint.includes("천마"), `계보 영물 이름을 알려 준다: ${low.hint}`);
  const mid = mk(finalOf("ember"), B.s5Mid);
  assert.equal(mid.target, "cheonma");
  const six = mk("azure_dragon");
  assert.equal(six.target, "haetae");
  assert.ok(six.hint && six.hint.includes("삼족오") && six.hint.includes("천록") && six.hint.includes("봉황"));
  const seven = mk("haetae");
  assert.equal(seven.target, "yellow_dragon");
  assert.ok(seven.hint && seven.hint.includes("홍룡"));
  const divine = mk("tiger");
  assert.ok(divine.target && divine.hint && divine.hint.includes("지금은"), "사신 축 안내");
});

// ── 6. 도트 ─────────────────────────────────────────────────────

test("★ 새 12폼 — 도트 전용으로 받고, 알이 아니며, 걷기 · 앵커 · 정의된 글자 · 수면 계약을 진다", () => {
  const egg = petSprites("egg")[0].rows.join("");
  for (const u of UPPERS) {
    assert.ok(isPixelOnlyForm(u.key), `${u.key}: 일러스트 모드에서 알로 그려진다`);
    const fr = petSprites(u.key);
    assert.notEqual(fr[0].rows.join(""), egg, `${u.key}: 도트가 없어 알로 떨어졌다`);
    assert.equal(fr.length, GAIT_FRAMES, `${u.key}: 프레임 수`);
    fr.forEach((s, i) => assert.deepEqual(validateSprite(s, `${u.key}#${i}`), [], `${u.key}#${i}`));
    assert.ok(gearAnchors(fr[0]).ok, `${u.key}: 앵커 산출 실패`);
    const sl = sleepSprite(u.key);
    assert.deepEqual(validateSprite(sl, `${u.key}#sleep`), []);
    assert.notEqual(sl.rows.join(""), sleepSprite("egg").rows.join(""), `${u.key}: 수면 도트가 알이다`);
  }
});
