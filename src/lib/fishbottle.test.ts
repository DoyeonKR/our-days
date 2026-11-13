// 유리병 편지(2026-11-12) — A 가 띄우고 B 가 낚아 연다. 10글자(자소 묶음) · 줄바꿈 · 주소 · 상한 · 한 번만 열기 · 낚시 저장을 지나도 남기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, type IslandState } from "./island.ts";
import { buyBait, haulJunk, type FishCatch } from "./fishing.ts";
import { landSpecial, rollSpecial, specialCatch, type SpecialCtx } from "./fishplus.ts";
import {
  BOTTLE_BASE, BOTTLE_MAX, BOTTLE_LEN, BOTTLE_LOG, BOTTLE_PER_SENDER, BOTTLE_QUEUE, BOTTLE_SURE_MS, DEV_PARTNER,
  bottleChance, bottleLength, bottleLogOf, bottlesOf, checkBottleText, clipBottleText, devSeedBottle, graphemes, landBottle, rollBottle, sendBottle,
} from "./fishbottle.ts";

const A = "user-aaaa-1111", B = "user-bbbb-2222";
const T0 = Date.UTC(2026, 10, 12, 3);
const ctx = (who: string, seed: number, now: number, couple = true): SpecialCtx =>
  ({ who, couple, spot: {} as never, method: "float" as never, seed, now, today: "2026-11-12" });
const island = (): IslandState => ({ ...createIsland("펫", null, T0), coins: 100000 });
const sendOk = (s: IslandState, who: string, text: string, at: number) => {
  const r = sendBottle(s, who, text, at);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? r.state : s;
};
/** 걸릴 때까지 던진다 — 몇 번째 판에 걸렸나 */
const castUntil = (s: IslandState, who: string, now: number, max = 400) => {
  for (let i = 0; i < max; i++) {
    const c = rollBottle(s, ctx(who, 1000 + i * 7919, now));
    if (c) return { c, n: i + 1 };
  }
  return null;
};

test("A 가 띄우고 B 가 낚아 연다 — A 는 제 병을 못 건진다", () => {
  let s = sendOk(island(), A, "보고 싶어", T0);
  assert.equal(bottlesOf(s).length, 1);
  // A 는 하루가 지나 확률이 100% 여도 못 건진다
  for (let i = 0; i < 200; i++) assert.equal(rollBottle(s, ctx(A, i, T0 + BOTTLE_SURE_MS * 2)), null);
  assert.equal(rollSpecial(s, ctx(A, 3, T0 + BOTTLE_SURE_MS * 2)), null, "rollSpecial 도 같은 길");
  const got = castUntil(s, B, T0 + 60_000);
  assert.ok(got, "B 는 건진다");
  assert.equal(got!.c.special?.kind, "bottle");
  const r = landSpecial(s, got!.c, ctx(B, 0, T0 + 120_000));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.outcome, "special");
  assert.equal(r.coins, 0);
  assert.equal(r.special?.title, "유리병 편지");
  assert.equal(r.special?.body, "보고 싶어");
  assert.equal(r.special?.from, "상대가 띄운 편지");
  s = r.state;
  assert.equal(bottlesOf(s).length, 0, "떠다니는 병에서 빠진다");
  const log = bottleLogOf(s);
  assert.equal(log.length, 1);
  assert.equal(log[0].by, B);
  assert.equal(log[0].from, A);
  assert.equal(log[0].openedAt, T0 + 120_000);
  assert.equal(rollBottle(s, ctx(B, 1, T0 + BOTTLE_SURE_MS * 3)), null, "연 병은 다시 안 걸린다");
});

test("혼자 하는 섬 — 개발용 상대 병만 걸린다", () => {
  let s = sendOk(island(), "me", "혼잣말", T0);
  for (let i = 0; i < 100; i++) assert.equal(rollBottle(s, ctx("other", i, T0 + BOTTLE_SURE_MS, false)), null, "혼자 섬엔 남의 병도 안 걸린다");
  const d = devSeedBottle(s, "연습이야", T0);
  assert.ok(d.ok);
  if (!d.ok) return;
  s = d.state;
  const c = rollBottle(s, ctx("me", 42, T0, false));
  assert.ok(c, "하루 전으로 띄워 둬서 다음 판에 바로 걸린다");
  const r = landBottle(s, c!, ctx("me", 0, T0, false));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.special?.from, "연습용 편지");
  if (r.ok) assert.equal(bottleLogOf(r.state)[0].from, DEV_PARTNER);
});

test("10글자는 자소 묶음으로 — 한글 조합 · 이모지 조합은 한 글자", () => {
  const ten = "안녕하세요안녕하세요";
  assert.equal(graphemes(ten).length, 10);
  assert.ok(checkBottleText(ten).ok);
  assert.equal(checkBottleText(ten + "요").ok, false);
  // 풀어 쓴 한글(첫소리 + 가운뎃소리 + 끝소리 코드)도 열 글자 — 저장은 NFC 로 모은다
  const nfd = ten.normalize("NFD");
  assert.ok(nfd.length > 10);
  const c = checkBottleText(nfd);
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.text, ten, "NFC 로 저장");
  assert.equal(checkBottleText((ten + "요").normalize("NFD")).ok, false);
  // 가족 이모지(사람 셋을 ZWJ 로 이은 것) · 피부색 손 · 국기는 각각 한 글자
  const family = "\u{1F468}\u200d\u{1F469}\u200d\u{1F467}";
  const wave = "\u{1F44B}\u{1F3FD}";
  const flag = "\u{1F1F0}\u{1F1F7}";
  assert.equal(bottleLength(family + wave + flag), 3);
  assert.ok(checkBottleText(family.repeat(10)).ok, "가족 이모지 열 개 = 열 글자");
  assert.equal(checkBottleText(family.repeat(11)).ok, false);
  // 가장 긴 축에 드는 조합 — 네 식구(11단위) · 피부색 커플 입맞춤(15단위)도 열 개면 열 글자로 통과한다
  const four = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466);
  const kiss = String.fromCodePoint(0x1f469, 0x1f3fd, 0x200d, 0x2764, 0xfe0f, 0x200d, 0x1f48b, 0x200d, 0x1f468, 0x1f3fd);
  assert.equal(kiss.length, 15);
  assert.ok(checkBottleText(four.repeat(10)).ok, "네 식구 열 개");
  assert.ok(checkBottleText(kiss.repeat(10)).ok, "피부색 커플 열 개");
  assert.equal(clipBottleText(kiss.repeat(12)), kiss.repeat(10), "그릴 때 이모지 반쪽 없이 열 글자");
  // 조합 표시를 끝없이 붙인 한 글자는 저장 길이로 막는다
  assert.equal(checkBottleText("a" + "\u0301".repeat(200)).ok, false);
  // 그릴 때도 10글자까지만(옛 앱 · 다른 기기가 쓴 긴 값)
  assert.equal(clipBottleText("가나다라마바사아자차카타파하"), "가나다라마바사아자차");
  assert.equal(graphemes(clipBottleText(family.repeat(14))).length, BOTTLE_LEN);
});

test("줄바꿈은 띄어쓰기로 · 앞뒤 다듬기 · 빈 편지 거절", () => {
  const c = checkBottleText("  안녕\n자기\r\n야  ");
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.text, "안녕 자기 야");
  assert.equal(bottleLength("가\n\n\n나"), 3, "카운터도 보낼 모양으로 센다");
  assert.equal(checkBottleText("   ").ok, false);
  assert.equal(checkBottleText("\n\n").ok, false);
  assert.equal(checkBottleText("").ok, false);
  assert.equal(checkBottleText(String.fromCodePoint(0x200b, 0x3164, 0x200b)).ok, false, "보이지 않는 글자만");
  assert.equal(sendBottle(island(), A, " \n ", T0).ok, false, "엔진도 막는다");
  assert.equal(sendBottle(island(), A, "열한글자를넘는긴편지야", T0).ok, false, "엔진이 10글자를 막는다");
});

test("주소는 못 넣는다", () => {
  for (const t of ["http://a.b", "https:x", "www.abc", "bit.ly/xy", "abc.com", "HTTP://X", "go.kr/x"]) {
    const c = checkBottleText(t);
    assert.equal(c.ok, false, t);
    if (!c.ok) assert.match(c.reason, /주소/);
  }
  for (const t of ["사랑해.", "밥 먹었어?", "3.5km 걸음"]) assert.ok(checkBottleText(t).ok, t);
});

test("상한 — 한 사람 3개 · 바다 10개 · 열어 본 편지 30통", () => {
  let s = island();
  for (let i = 0; i < BOTTLE_PER_SENDER; i++) s = sendOk(s, A, `편지${i}`, T0 + i);
  const over = sendBottle(s, A, "또", T0 + 9);
  assert.equal(over.ok, false);
  // 바다 전체 10개 — 여러 사람(또는 개발용)으로 채운다
  for (let i = 0; i < BOTTLE_QUEUE - BOTTLE_PER_SENDER; i++) s = sendOk(s, `u${i}`, "안녕", T0 + 100 + i);
  assert.equal(bottlesOf(s).length, BOTTLE_QUEUE);
  assert.equal(sendBottle(s, B, "안녕", T0 + 500).ok, false);
  assert.equal(devSeedBottle(s, "안녕", T0).ok, false);
  // 열어 본 편지는 최신 30통만
  let t = island();
  for (let i = 0; i < BOTTLE_LOG + 5; i++) {
    t = sendOk(t, A, `${i}`, T0 + i * 1000);
    const id = bottlesOf(t)[0].id;
    const r = landBottle(t, specialCatch("bottle", id, "유리병"), ctx(B, 0, T0 + i * 1000 + 1));
    assert.ok(r.ok);
    if (r.ok) t = r.state;
  }
  const log = bottleLogOf(t);
  assert.equal(log.length, BOTTLE_LOG);
  assert.equal(log[0].text, `${BOTTLE_LOG + 4}`, "최신이 앞");
  assert.equal(new Set(log.map((b) => b.id)).size, BOTTLE_LOG, "번호가 겹치지 않는다(건진 뒤에 띄워도)");
});

test("같은 병을 두 번 끌어올려도 한 번만 연다 · 없는 병은 거절", () => {
  const s = sendOk(island(), A, "한 번만", T0);
  const c = specialCatch("bottle", bottlesOf(s)[0].id, "유리병");
  const r1 = landBottle(s, c, ctx(B, 0, T0 + 5));
  assert.ok(r1.ok);
  if (!r1.ok) return;
  const r2 = landBottle(r1.state, c, ctx(B, 0, T0 + 6));
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.reason, "이미 열어 본 편지예요");
  assert.equal(landBottle(s, specialCatch("bottle", "nope", "유리병"), ctx(B, 0, T0)).ok, false, "없는 병");
  assert.equal(landBottle(s, { ...c, special: undefined } as FishCatch, ctx(B, 0, T0)).ok, false);
  assert.equal(landBottle(s, c, ctx(A, 0, T0)).ok, false, "제 병은 못 연다");
  // 모양이 틀린 저장(다른 기기 · 다른 판)도 깨지지 않는다
  const broken = { ...s, fishPlus: { bottles: [null, 3, { id: 1 }], bottleLog: "x" } } as unknown as IslandState;
  assert.deepEqual(bottlesOf(broken), []);
  assert.deepEqual(bottleLogOf(broken), []);
  assert.equal(rollBottle(broken, ctx(B, 0, T0)), null);
});

test("걸리는 확률 — 9% 에서 하루면 50% · 뽑기는 seed 로만", () => {
  assert.equal(bottleChance(0), BOTTLE_BASE);
  assert.equal(bottleChance(-5_000_000), BOTTLE_BASE, "시계가 어긋나도 음수 나이는 0");
  assert.equal(bottleChance(BOTTLE_SURE_MS), BOTTLE_MAX);
  assert.ok(BOTTLE_BASE <= 0.09 && BOTTLE_MAX <= 0.5, "예전(18% → 100%)의 절반");
  assert.ok(bottleChance(BOTTLE_SURE_MS / 2) > 0.27 && bottleChance(BOTTLE_SURE_MS / 2) < 0.33);
  const s = sendOk(island(), A, "언제 와", T0);
  // 하루 지난 병은 몇 판 안에 걸린다(판마다 50%)
  assert.ok([0, 1, 2, 3, 4, 5, 6, 7].some((i) => rollBottle(s, ctx(B, 12345 + i * 7919, T0 + BOTTLE_SURE_MS))));
  // 같은 입력 = 같은 결과
  for (let i = 0; i < 50; i++) assert.deepEqual(rollBottle(s, ctx(B, i, T0)), rollBottle(s, ctx(B, i, T0)));
  // 띄운 바로 그때 던지면 대략 18% — 많이 던지면 그 근처
  let hit = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (rollBottle(s, ctx(B, i * 2654435761, T0))) hit++;
  assert.ok(Math.abs(hit / N - BOTTLE_BASE) < 0.03, `${hit / N}`);
  // 띄운 날 몇 판이면 대개 건진다 — 1시간 뒤 20판 안에 건질 확률이 거의 1
  let found = 0;
  for (let k = 0; k < 200; k++) {
    for (let i = 0; i < 40; i++) if (rollBottle(s, ctx(B, k * 1009 + i * 7919, T0 + 3_600_000))) { found++; break; }
  }
  assert.ok(found >= 196, `${found}/200`);
});

test("낚시 저장(미끼 사기 · 꽝 건지기)이 병을 지우지 않는다", () => {
  const s = sendOk(sendOk(island(), A, "남아 있어", T0), B, "나도", T0 + 1);
  const r = buyBait(s, "bait_shrimp", "2026-11-12");
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.state.fishPlus, s.fishPlus);
  const j = haulJunk(s, { family: "x", stage: 0, grade: "흔함", difficulty: 1, junk: "can" } as never, "2026-11-12");
  if (j.ok) assert.deepEqual(bottlesOf(j.state), bottlesOf(s));
  assert.equal(bottlesOf(s).length, 2);
});

test("화면 — 커플만 보내기 · maxLength 없음 · 수집 탭에 한 줄", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishBottles.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /maxLength/, "한글 조합 중에 잘린다");
  assert.match(code, /if \(!p\.couple && !devView\) return null;/);
  assert.match(code, /isComposing/);
  assert.match(code, /__fishSeedBottle/);
  assert.doesNotMatch(code, /\p{Extended_Pictographic}/u, "UI 크롬에 이모지 금지");
  const collect = readFileSync(join(process.cwd(), "src/components/FishCollect.tsx"), "utf8");
  assert.match(collect, /<FishBottles \{\.\.\.p\} \/>/);
});
