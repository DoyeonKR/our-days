// 신화형 위 세 단계(사신 6 · 천수 7 · 황룡 8) lock.
// [사용자 요청 2026-08-31 "신화형 다음 진화 단계도 만들어줘 ... 그 윗단계까지 3단계를 더"]
//
// 사다리의 모양은 **깔때기**다: 12형 → 5 → 4 → 2 → 1. 갈래는 아래에서 벌어지고 위에서
// 모인다. 정점(황룡)에 갈래가 없어야 "못 받은 폼"이 영구히 남지 않는다 — 이 저장소가
// 신화형 때 이미 낸 답("12형→24형이면 컬렉션이 영영 안 끝난다")을 그대로 따른 것이다.
//
// 여기서 잠그는 것은 값이 아니라 **성질**이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APEX_FORMS,
  CELESTIAL_FORMS,
  DIVINE_FORMS,
  MAX_STAGE,
  PET_FORMS,
  TUNING,
  type AscendInput,
  ascendInputOf,
  createIsland,
  divineDirection,
  evolve,
  evolutionTree,
  hugPet,
  nextEvolution,
  petLevel,
  retirePet,
  type IslandState,
} from "./island.ts";

const T = Date.UTC(2026, 7, 31, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T);

/** 진화 대기 상태의 펫 하나 만들기. */
function at(form: string, careXp: number, extra: Partial<IslandState["pet"]> = {}): IslandState {
  const s = fresh();
  s.pet.form = form;
  s.pet.careXp = careXp;
  s.pet.pendingEvolve = true; // refreshEvolveFlag 는 액션 경유 — 여기선 직접 세팅
  Object.assign(s.pet, extra);
  return s;
}

// ── 사다리의 끝 ─────────────────────────────────────────────────

test("★ 사다리는 8(황룡)에서 끝난다 — 위가 없다", () => {
  assert.equal(MAX_STAGE, 8);
  assert.equal(PET_FORMS[APEX_FORMS[0]].stage, 8);
  assert.equal(nextEvolution(APEX_FORMS[0], 100, 10, 0, 3, {}), null, "황룡 위는 없다");
});

test("★ 깔때기 — 위로 갈수록 갈래가 좁아진다", () => {
  const count = (st: number) => Object.values(PET_FORMS).filter((f) => f.stage === st).length;
  assert.equal(count(4), 12);
  assert.equal(count(5), 5);
  assert.equal(count(6), 4);
  assert.equal(count(7), 2);
  assert.equal(count(8), 1);
  // 단조 감소가 이 설계의 전부다 — 어느 층이든 늘리면 컬렉션이 안 끝난다
  for (let st = 5; st <= MAX_STAGE; st++) {
    assert.ok(count(st) <= count(st - 1), `stage ${st} 가 아래층보다 넓다 — 깔때기가 깨졌다`);
  }
});

test("★ 새 폼도 이름·이모지가 전부 유일하다 — 로그에서 구분이 된다", () => {
  const all = Object.values(PET_FORMS);
  assert.equal(new Set(all.map((f) => f.name)).size, all.length, "이름 중복");
  assert.equal(new Set(all.map((f) => f.emoji)).size, all.length, "이모지 중복");
  assert.equal(new Set(all.map((f) => f.key)).size, all.length, "키 중복");
});

// ── 사신 방위 ───────────────────────────────────────────────────

test("★ 사신 — 가장 깊이 판 축이 방위를 정한다", () => {
  const f = TUNING.pet.branch.s6Full;
  assert.equal(divineDirection({ farmSkill: f.farm }), "azure_dragon", "농사 → 청룡");
  assert.equal(divineDirection({ huntBest: f.hunt }), "vermilion_bird", "사냥 → 주작");
  assert.equal(divineDirection({ bubbleBest: f.bubble }), "white_tiger", "보글보글 → 백호");
  assert.equal(divineDirection({ rating: f.rating }), "black_tortoise", "꾸미기 → 현무");
});

test("★★ 방위는 **다시 고를 수 있다** — 고정 우선순위였다면 여기서 막힌다", () => {
  // 이게 이 파일에서 제일 중요한 테스트다.
  // 농사 스킬은 펫이 아니라 **섬**에 붙어 있어 은퇴해도 안 줄어든다. 기존 문법대로
  // "먼저 맞는 것"으로 짰다면, 한 번 농사 기준을 넘긴 계정은 **영원히 청룡만** 나오고
  // 나머지 세 방위가 죽는다(도감이 영영 안 채워진다).
  const f = TUNING.pet.branch.s6Full;
  const farmMaxed = { farmSkill: TUNING.farm.skillMax }; // 되돌릴 수 없는 상태
  assert.equal(divineDirection(farmMaxed), "azure_dragon");
  // 사냥을 더 밀면 방위가 넘어간다
  const alsoHunted = { ...farmMaxed, huntBest: f.hunt * 2 };
  assert.equal(divineDirection(alsoHunted), "vermilion_bird", "농사가 최고여도 사냥을 더 밀면 주작");
  const alsoBubbled = { ...farmMaxed, bubbleBest: f.bubble * 3 };
  assert.equal(divineDirection(alsoBubbled), "white_tiger", "보글보글로도 갈아탈 수 있다");
});

test("★ 아무것도 안 판 상태는 현무 — '그 외'가 있어야 분기가 닫힌다", () => {
  assert.equal(divineDirection({}), "black_tortoise", "전무");
  assert.equal(divineDirection({ farmSkill: 1, huntBest: 2 }), "black_tortoise", "문턱 미달");
});

test("★ 동점이면 사신 순서대로 — 결정적이어야 두 사람이 같은 걸 본다", () => {
  const f = TUNING.pet.branch.s6Full;
  const tie = { farmSkill: f.farm, huntBest: f.hunt, bubbleBest: f.bubble, rating: f.rating };
  assert.equal(divineDirection(tie), "azure_dragon", "네 축이 같은 비율이면 청룡");
  assert.equal(divineDirection({ huntBest: f.hunt, bubbleBest: f.bubble }), "vermilion_bird");
  // 같은 입력은 몇 번을 불러도 같은 답 — RNG 가 끼면 양 클라가 갈린다
  for (let i = 0; i < 5; i++) assert.equal(divineDirection(tie), "azure_dragon");
});

test("★ 신화형(5)에서 사신(6)으로 넘어간다", () => {
  const f = TUNING.pet.branch.s6Full;
  const asc: AscendInput = { huntBest: f.hunt * 2 };
  for (const from of ["tiger", "lion", "giraffe", "bengal_tiger", "mudeung_tiger"]) {
    assert.equal(nextEvolution(from, 90, 5, 0, 0, asc), "vermilion_bird", `${from} → 주작`);
  }
});

// ── 천수 · 황룡 ─────────────────────────────────────────────────

test("★ 천수 — 여러 생을 거쳤으면 봉황, 한 생이면 해태", () => {
  const need = TUNING.pet.branch.s7PhoenixMuseum;
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, { museum: need }), "phoenix");
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0, 0, { museum: need - 1 }), "haetae");
  assert.equal(nextEvolution("black_tortoise", 90, 5, 0, 0, {}), "haetae", "박물관 정보가 없으면 해태");
});

test("★ 황룡은 갈래가 없다 — 끝까지 간 사람은 모두 같은 곳에 닿는다", () => {
  for (const from of CELESTIAL_FORMS) {
    assert.equal(nextEvolution(from, 10, 0, 9, 0, {}), APEX_FORMS[0], `${from} → 황룡`);
    assert.equal(nextEvolution(from, 100, 10, 0, 3, {}), APEX_FORMS[0], "조건과 무관하게 황룡");
  }
});

// ── 레벨 · 앵커 ─────────────────────────────────────────────────

test("★ 앵커를 늘려도 기존 레벨이 안 흔들린다 — 옛 저장분 보호", () => {
  assert.equal(petLevel(8300), 50, "최종형 앵커 불변");
  assert.equal(petLevel(15000), 70, "신화 앵커 불변");
});

test("★ 새 앵커 — 85/100/120 에 정확히 닿는다", () => {
  assert.equal(TUNING.pet.evoLevel[6], 85);
  assert.equal(TUNING.pet.evoLevel[7], 100);
  assert.equal(TUNING.pet.evoLevel[8], 120);
  assert.equal(petLevel(23500), 85);
  assert.equal(petLevel(33500), 100);
  assert.equal(petLevel(46000), 120);
  // 구간이 선형으로 이어진다(계단이 아니다)
  assert.ok(petLevel(19000) > 70 && petLevel(19000) < 85);
  assert.ok(petLevel(28000) > 85 && petLevel(28000) < 100);
});

test("★ 관문은 위로 갈수록 멀어진다 — 마지막이 제일 길다", () => {
  const a = TUNING.pet.lvlAnchors;
  const gaps: number[] = [];
  for (let i = a.length - 4; i < a.length - 1; i++) gaps.push(a[i + 1][1] - a[i][1]);
  for (let i = 1; i < gaps.length; i++) {
    assert.ok(gaps[i] > gaps[i - 1], `구간 ${i} 가 앞 구간보다 짧다 — 뒤로 갈수록 멀어야 한다`);
  }
});

test("★ careXp 가 아무리 많아도 **한 번에 한 단계**만 오른다", () => {
  // 앵커를 늘리면 Lv.70 이후 쌓인 careXp 가 소급 반영된다(의도된 선물). 그래도 진화는
  // 한 칸씩이어야 한다 — 건너뛰면 도감에 빈 칸이 남고 축하 순간도 사라진다.
  const s = at("mudeung_tiger", 999_999, { cq: 95 });
  const a = evolve(s, T);
  assert.equal(PET_FORMS[a.pet.form].stage, 6, "5 → 6 한 칸");
  const b = evolve({ ...a, pet: { ...a.pet, pendingEvolve: true } }, T);
  assert.equal(PET_FORMS[b.pet.form].stage, 7, "6 → 7 한 칸");
  const c = evolve({ ...b, pet: { ...b.pet, pendingEvolve: true } }, T);
  assert.equal(PET_FORMS[c.pet.form].stage, 8, "7 → 8 한 칸");
  assert.equal(c.pet.pendingEvolve, false, "황룡은 더 갈 곳이 없다");
});

// ── 조용히 실패하던 자리 ────────────────────────────────────────

test("★★ 진화 대기 플래그가 신화형 위에서도 선다 (stage < 5 하드코딩 회귀)", () => {
  // island.ts 두 곳에 `stage < 5` 가 박혀 있었다. 폼과 앵커만 넣고 이걸 놓치면
  // pendingEvolve 가 **영영 안 선다** — 에러도 안 나고 진화 버튼만 조용히 안 뜬다.
  // 그래서 상수가 아니라 **실제 액션 경로**로 확인한다(tick → refreshEvolveFlag).
  for (const [form, xp] of [["tiger", 23500], ["azure_dragon", 33500], ["phoenix", 46000]] as const) {
    const s = fresh();
    s.pet.form = form;
    s.pet.careXp = xp;
    s.pet.pendingEvolve = false;
    const after = hugPet(s, T + 3 * 3600_000); // 쿨다운 없는 시점으로
    assert.equal(after.pet.pendingEvolve, true, `${form}: 다음 층 관문에 닿았는데 대기가 안 선다`);
  }
  // 반대쪽도 본다 — 관문에 못 미치면 서면 안 된다
  const low = fresh();
  low.pet.form = "azure_dragon";
  low.pet.careXp = 24_000; // Lv.100(33,500) 미달
  assert.equal(hugPet(low, T + 3 * 3600_000).pet.pendingEvolve, false, "관문 미달인데 대기가 섰다");
  // 정점에서는 영영 안 선다
  const top = fresh();
  top.pet.form = APEX_FORMS[0];
  top.pet.careXp = 999_999;
  assert.equal(hugPet(top, T + 3 * 3600_000).pet.pendingEvolve, false, "황룡 위가 생겼다");
});

test("★ 은퇴는 새 단계에서도 열려 있다 — 컬렉션 반복이 막히면 안 된다", () => {
  for (const form of [...DIVINE_FORMS, ...CELESTIAL_FORMS, ...APEX_FORMS]) {
    const s = fresh();
    s.pet.form = form;
    const r = retirePet(s, "다음", T);
    assert.ok(r.museum.includes(form), `${form} 이 박물관에 안 들어간다`);
    assert.equal(r.pet.form, "egg", "새 알로 시작");
  }
});

test("★ 구버전 호출부(재료 없이)도 throw 없이 돈다 — 무마이그레이션", () => {
  // 옛 저장분엔 hunt/bubble 이 아예 없다(옵셔널 필드). 인자를 안 넘겨도 기본 갈래로 떨어져야 한다.
  assert.equal(nextEvolution("tiger", 90, 5, 0), "black_tortoise", "재료 없으면 현무");
  assert.equal(nextEvolution("azure_dragon", 90, 5, 0), "haetae", "재료 없으면 해태");
  const s = fresh();
  delete (s as { hunt?: unknown }).hunt;
  delete (s as { bubble?: unknown }).bubble;
  const inp = ascendInputOf(s);
  assert.equal(inp.huntBest, 0);
  assert.equal(inp.bubbleBest, 0);
  assert.ok(Number.isFinite(inp.rating ?? NaN), "평점은 항상 수");
});

test("★ ascendInputOf 가 섬의 네 축과 박물관을 그대로 읽는다", () => {
  const s = fresh();
  s.farm.skillXp = 100_000;
  s.hunt = { stage: 41, kills: 0, dmg: 0, at: T, total: 900, best: 40 };
  s.bubble = { best: 17, clears: 40, score: 900 };
  s.museum = ["royal_cat", "tiger"];
  const inp = ascendInputOf(s);
  assert.ok((inp.farmSkill ?? 0) > 1, "농사 스킬이 읽힌다");
  assert.equal(inp.huntBest, 40);
  assert.equal(inp.bubbleBest, 17);
  assert.equal(inp.museum, 2);
});

// ── 도감 · 보상 ─────────────────────────────────────────────────

test("★ 도감 줄이 PET_FORMS 의 stage 6/7/8 전체와 일치한다 (누락·오타 차단)", () => {
  const keysOf = (st: number) =>
    Object.values(PET_FORMS).filter((f) => f.stage === st).map((f) => f.key).sort();
  assert.deepEqual([...DIVINE_FORMS].sort(), keysOf(6));
  assert.deepEqual([...CELESTIAL_FORMS].sort(), keysOf(7));
  assert.deepEqual([...APEX_FORMS].sort(), keysOf(8));
  const t = evolutionTree(fresh());
  assert.deepEqual(t.divines.map((n) => n.key).sort(), keysOf(6));
  assert.deepEqual(t.celestials.map((n) => n.key).sort(), keysOf(7));
  assert.deepEqual(t.apex.map((n) => n.key).sort(), keysOf(8));
});

test("★ 컬렉션 진도에 새 단계가 포함된다", () => {
  const t = evolutionTree(fresh());
  assert.equal(t.finalsTotal, 12 + 5 + 4 + 2 + 1, "최종형+신화+사신+천수+황룡");
});

test("★ 업적 보상이 층마다 올라간다 — 위가 아래보다 싸면 안 된다", () => {
  const src = readFileSync(join(import.meta.dirname, "island.ts"), "utf8");
  const m = /ASCEND_REWARD[^=]*=\s*\{([^}]*)\}/.exec(src.replace(/\/\*[\s\S]*?\*\//g, ""));
  assert.ok(m, "ASCEND_REWARD 표를 못 찾았다");
  const pairs = [...m![1].matchAll(/(\d+)\s*:\s*(\d+)/g)].map(([, k, v]) => [+k, +v] as const);
  assert.ok(pairs.length >= 5, `보상 표가 ${pairs.length}줄뿐이다`);
  for (let i = 1; i < pairs.length; i++) {
    assert.ok(pairs[i][1] > pairs[i - 1][1], `stage ${pairs[i][0]} 보상이 아래층보다 크지 않다`);
  }
});

// ── 아트 폴백 ───────────────────────────────────────────────────

test("★ 새 폼이 **알로 그려지지 않는다** — 2차 전까지 골격을 빌려 쓴다", () => {
  // buildPetSprites·petArt 는 모르는 키를 알로 폴백한다. 등록을 잊으면 황룡이 🥚 로 보인다.
  const dir = join(import.meta.dirname, "..");
  const pixel = readFileSync(join(dir, "lib", "pixelart.ts"), "utf8");
  const svg = readFileSync(join(dir, "components", "island", "art", "pets.tsx"), "utf8");
  for (const key of [...DIVINE_FORMS, ...CELESTIAL_FORMS, ...APEX_FORMS]) {
    assert.ok(pixel.includes(key), `pixelart.ts 에 ${key} 가 없다 — 픽셀 모드에서 알로 보인다`);
    assert.ok(svg.includes(key), `pets.tsx 에 ${key} 가 없다 — 일러스트 모드에서 알로 보인다`);
  }
});
