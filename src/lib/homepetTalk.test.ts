import { test } from "node:test";
import assert from "node:assert/strict";
import { petTalk, type TalkCtx } from "./homepetTalk.ts";

const base = (o: Partial<TalkCtx> = {}): TalkCtx => ({
  petName: "방울이",
  partnerName: "지연",
  vibe: "ok",
  pendingEvolve: false,
  coopWaiting: false,
  cropsReady: 0,
  nDays: 300,
  milestoneDay: null,
  milestoneInDays: null,
  annivLabel: null,
  annivInDays: null,
  season: "spring",
  hour: 14,
  seed: 0,
  ...o,
});

test("항상 1개 이상, 문자열 배열", () => {
  const lines = petTalk(base());
  assert.ok(Array.isArray(lines) && lines.length > 0);
  for (const l of lines) assert.equal(typeof l, "string");
});

test("긴급 케어(아픔/배고픔)가 맨 앞", () => {
  assert.match(petTalk(base({ vibe: "sick" }))[0], /아파|약/);
  assert.match(petTalk(base({ vibe: "hungry" }))[0], /배고파|밥/);
});

test("진화 대기 → 진화 대사 포함", () => {
  assert.ok(petTalk(base({ pendingEvolve: true })).some((l) => l.includes("진화") || l.includes("모습")));
});

test("100일 단위: 오늘=며칠째, 임박=남은 일수", () => {
  assert.ok(petTalk(base({ milestoneDay: 500, milestoneInDays: 0 })).some((l) => l.includes("500") && l.includes("오늘")));
  assert.ok(petTalk(base({ milestoneDay: 500, milestoneInDays: 12 })).some((l) => l.includes("500") && l.includes("12일")));
});

test("주년: 오늘=축하, 임박=남은 일수", () => {
  assert.ok(petTalk(base({ annivLabel: "2주년", annivInDays: 0 })).some((l) => l.includes("2주년") && l.includes("오늘")));
  assert.ok(petTalk(base({ annivLabel: "2주년", annivInDays: 5 })).some((l) => l.includes("2주년") && l.includes("5일")));
});

test("수확 가능 → 개수 안내", () => {
  assert.ok(petTalk(base({ cropsReady: 3 })).some((l) => l.includes("3개") && l.includes("수확")));
  assert.ok(!petTalk(base({ cropsReady: 0 })).some((l) => l.includes("수확")));
});

test("상대가 함께놀기 대기 → 상대 이름 포함", () => {
  assert.ok(petTalk(base({ coopWaiting: true, partnerName: "지연" })).some((l) => l.includes("지연") && l.includes("놀자")));
});

test("상대 이름 없으면 '우리'로 대체(빈 문자열 안전)", () => {
  const lines = petTalk(base({ partnerName: "  ", coopWaiting: true }));
  assert.ok(lines.some((l) => l.includes("우리가") || l.includes("우리랑") || l.startsWith("우리")));
});

test("계절 대사는 계절에 맞게", () => {
  assert.ok(petTalk(base({ season: "summer" })).some((l) => l.includes("여름")));
  assert.ok(petTalk(base({ season: "winter" })).some((l) => l.includes("겨울")));
});

test("nDays null 이면 '며칠째' 자랑 대사 없음", () => {
  assert.ok(!petTalk(base({ nDays: null })).some((l) => l.includes("일째래")));
  assert.ok(petTalk(base({ nDays: 300 })).some((l) => l.includes("300") && l.includes("일째래")));
});

test("일상 애정 대사는 seed 에 대해 결정적", () => {
  const a = petTalk(base({ seed: 2 }));
  const b = petTalk(base({ seed: 2 }));
  assert.deepEqual(a, b); // 같은 컨텍스트+seed → 완전히 동일
  // seed 가 배열 길이를 넘거나 음수여도 안전(throw 없음, 문자열)
  for (const s of [-3, 0, 4, 999]) {
    const l = petTalk(base({ seed: s }));
    assert.ok(l.every((x) => typeof x === "string"));
  }
});

test("행복하면 밝은 한마디가 추가된다", () => {
  const ok = petTalk(base({ vibe: "ok" })).length;
  const happy = petTalk(base({ vibe: "happy" }));
  assert.ok(happy.length > ok);
  assert.ok(happy.some((l) => l.includes("최고")));
});
