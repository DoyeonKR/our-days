// 물때 · 달(2026-11-12) [사용자: "실제 날짜로 계산한 사리 · 조금, 달 모양에 따라 바다 낚시터의 입질과 대물 확률이 달라집니다. 보름달에만 오는 손님도 둡니다"]
// 잠그는 것: 실제 삭 · 망 날짜(일식 · 월식 — 시각이 확실한 것) · 음력 날(물때표 사이트의 양력 ↔ 음력 날짜) · 7물때식 숫자 ·
// 효과는 바다에만 · 작게(범위) · 등급 · 계열 뽑기는 물때로 안 바뀐다(미끼 1% 규칙 — 사용자 결정) · 보름달 손님은 보름달 밤에만 ·
// 손님이 없을 땐 뽑기 순서가 예전과 똑같다 · 산갈치처럼 다른 낚시터에서 늘 오던 다 큰 모습이 막히지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BAITS, catchTable, rollCatch, spotOf, waitPlan } from "./fishing.ts";
import { FISH_BASE_CM, FISH_STAGE_SIZE, familyOf, speciesOf } from "./aquarium.ts";
import { MOON_FISH, TIMED_CHANCE, TIMED_FISH, finalAllowed, timedAt, timedLabel, type FishMoment } from "./fishingworld.ts";
import { FULL_ILLUM, SYNODIC, TIDE_FX, moonLitPath, moonMomentOf, moonPhase, nextFullMoon, tideEffect, tideOf, tideOfLunarDay } from "./fishtide.ts";

const H = 3_600_000, D = 24 * H;
const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
/** KST 그날 h시 */
const kst = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h - 9);
const TOP = BAITS.length - 1;

test("달 — 실제 망 · 삭 시각(월식 · 일식)과 하루 안으로 맞는다", () => {
  // 개기월식 = 망, 개기일식 = 삭 — 시각이 널리 알려져 있어 기준으로 쓴다(UTC)
  const fulls = [Date.UTC(2022, 10, 8, 11, 2), Date.UTC(2024, 0, 25, 17, 54), Date.UTC(2025, 2, 14, 6, 55), Date.UTC(2026, 2, 3, 11, 38)];
  for (const t of fulls) {
    const got = nextFullMoon(t - 10 * D);
    assert.ok(Math.abs(got - t) < D, `망 ${new Date(t).toISOString()} → ${new Date(got).toISOString()}`);
    const m = moonPhase(t);
    assert.equal(m.name, "보름");
    assert.ok(m.illum > 0.99, `${m.illum}`);
  }
  const news = [Date.UTC(2017, 7, 21, 18, 30), Date.UTC(2024, 3, 8, 18, 21)];
  for (const t of news) {
    const m = moonPhase(t + 2 * H);
    assert.ok(Math.abs(m.newMoon - t) < D, `삭 ${new Date(t).toISOString()} → ${new Date(m.newMoon).toISOString()}`);
    assert.ok(m.illum < 0.01);
    assert.equal(m.name, "그믐");
  }
  // 삭망월이 평균 길이로 돈다 · 반달 즈음은 상현 · 하현
  assert.ok(Math.abs(moonPhase(Date.UTC(2024, 3, 8, 18, 21) + 7.4 * D).illum - 0.5) < 0.12);
  assert.equal(moonPhase(Date.UTC(2024, 3, 8, 18, 21) + 7.4 * D).name, "상현");
  assert.equal(moonPhase(Date.UTC(2024, 3, 8, 18, 21) + 22 * D).name, "하현");
  assert.equal(moonPhase(Date.UTC(2024, 3, 8, 18, 21) + 3 * D).name, "초승");
  assert.ok(SYNODIC > 29.5 && SYNODIC < 29.6);
});

test("음력 날 — 물때표의 양력 ↔ 음력 날짜와 같다 · 삭이 든 날은 하루 내내 1일", () => {
  // 바다타임(badatime.com) 의 '양력 · 음력' 머리글에서 옮겼다
  const table: [number, number, number, number][] = [
    [2026, 6, 10, 25], [2026, 6, 13, 28], [2026, 6, 18, 4], [2026, 7, 12, 28], [2026, 7, 14, 1], [2026, 8, 20, 8], [2026, 9, 7, 26],
  ];
  for (const [y, m, d, lunar] of table) {
    for (const h of [0, 12, 23]) assert.equal(tideOf(kst(y, m, d, h)).lunarDay, lunar, `${y}-${m}-${d} ${h}시`);
  }
  // 2026-07-14 은 저녁(18시 44분 KST)에 삭 — 그날 낮도 6월 1일이다(그 시각으로 고르면 전달 30일이 나왔다)
  assert.equal(tideOf(kst(2026, 7, 14, 9)).label, "7물 · 사리");
  assert.equal(tideOf(kst(2026, 7, 13, 12)).lunarDay, 29);
});

test("물때 — 서해안 7물때식: 1일 7물 · 8일 조금 · 9일 무시 · 10일 1물 · 보름 뒤 같은 순서", () => {
  const n = (d: number) => tideOfLunarDay(d).n;
  assert.deepEqual([1, 2, 7, 8, 9, 10, 15, 16, 23, 24, 25, 30].map(n), [7, 8, 13, 14, 15, 1, 6, 7, 14, 15, 1, 6]);
  assert.equal(tideOfLunarDay(1).label, "7물 · 사리");
  assert.equal(tideOfLunarDay(8).label, "조금");
  assert.equal(tideOfLunarDay(9).label, "무시");
  assert.equal(tideOfLunarDay(7).label, "13물 · 조금");
  assert.equal(tideOfLunarDay(12).label, "3물");
  // 사리 = 6~8물(삭 · 망 무렵), 조금 = 13물 · 조금(반달 무렵)
  for (let d = 1; d <= 30; d++) {
    const t = tideOfLunarDay(d);
    assert.equal(t.kind, t.n >= 6 && t.n <= 8 ? "sari" : t.n === 13 || t.n === 14 ? "jogeum" : "mid", `${d}일`);
    assert.doesNotMatch(t.label, /14물|15물/, "14 · 15 는 조금 · 무시로 부른다");
  }
  // 실제 달과도 맞물린다 — 사리는 보름 · 그믐 무렵, 조금은 반달 무렵
  for (let ms = kst(2026, 1, 1); ms < kst(2027, 1, 1); ms += D) {
    const t = tideOf(ms), m = moonPhase(ms);
    if (t.kind === "sari") assert.ok(m.illum > 0.85 || m.illum < 0.15, `${new Date(ms).toISOString()} 사리인데 밝기 ${m.illum}`);
    if (t.kind === "jogeum") assert.ok(m.illum > 0.2 && m.illum < 0.8, `${new Date(ms).toISOString()} 조금인데 밝기 ${m.illum}`);
  }
});

test("효과 — 바다에만 · 작게 · 기다림과 대물만", () => {
  assert.deepEqual(tideEffect("sea", { tide: 7 }), { wait: 0.85, trophy: 0.02 });
  assert.deepEqual(tideEffect("sea", { tide: 14 }), { wait: 1.1, trophy: 0 });
  assert.deepEqual(tideEffect("sea", { tide: 3 }), { wait: 1, trophy: 0 });
  for (const w of ["river", "lake", "valley", "wetland", "hall"]) for (let n = 1; n <= 15; n++) assert.deepEqual(tideEffect(w, { tide: n }), { wait: 1, trophy: 0 }, w);
  assert.deepEqual(tideEffect("sea", undefined), { wait: 1, trophy: 0 }, "달을 모르면(옛 호출) 효과 없음");
  for (const fx of Object.values(TIDE_FX)) {
    assert.ok(fx.wait >= 0.85 && fx.wait <= 1.1, `${fx.wait}`);
    assert.ok(fx.trophy >= 0 && fx.trophy <= 0.02, `${fx.trophy}`);
  }
  // 한 해를 한 시간씩 — 실제 날짜로 나오는 효과도 그 범위 안
  let sari = 0, jogeum = 0, n = 0;
  for (let ms = kst(2026, 1, 1); ms < kst(2027, 1, 1); ms += 6 * H, n++) {
    const fx = tideEffect("sea", moonMomentOf(ms));
    assert.ok(fx.wait >= 0.85 && fx.wait <= 1.1 && fx.trophy >= 0 && fx.trophy <= 0.02);
    if (fx.wait < 1) sari++;
    if (fx.wait > 1) jogeum++;
  }
  assert.ok(sari / n > 0.15 && sari / n < 0.25, `사리 ${sari / n}`);
  assert.ok(jogeum / n > 0.1 && jogeum / n < 0.17, `조금 ${jogeum / n}`);
  // 기다림 — 뽑기 순서는 그대로, 배율만큼 줄고 간 보기는 그 안에
  for (let s = 1; s < 300; s++) {
    const a = waitPlan(s), b = waitPlan(s, 0.85), c = waitPlan(s, 1);
    assert.deepEqual(a, c);
    assert.ok(Math.abs(b.waitMs - a.waitMs * 0.85) <= 1);
    assert.equal(b.nibbles.length, a.nibbles.length);
    for (const t of b.nibbles) assert.ok(t < b.waitMs + 200);
  }
});

test("물때는 등급 · 계열을 안 바꾼다 — 같은 seed 면 길이 말고 전부 같다 · 사리엔 대물이 조금 더", () => {
  const harbor = spotOf("harbor")!, ocean = spotOf("ocean")!;
  for (const spot of [harbor, ocean]) for (const bait of [1, 3, TOP]) {
    const plain: FishMoment = { time: "day", wx: null }, sari: FishMoment = { ...plain, moon: { tide: 7, full: false } }, jogeum: FishMoment = { ...plain, moon: { tide: 14, full: false } };
    const t0 = catchTable(spot, 10, bait, "float", plain, 2000);
    assert.deepEqual(catchTable(spot, 10, bait, "float", sari, 2000), t0, `${spot.key} 미끼 ${bait} 사리`);
    assert.deepEqual(catchTable(spot, 10, bait, "float", jogeum, 2000), t0, `${spot.key} 미끼 ${bait} 조금`);
  }
  let big0 = 0, big1 = 0;
  for (let i = 0; i < 8000; i++) {
    const seed = i * 2654435761 >>> 0;
    const a = rollCatch(harbor, 5, 0.4, seed, { bait: 2, junk: true, when: { time: "day", wx: null } });
    const b = rollCatch(harbor, 5, 0.4, seed, { bait: 2, junk: true, when: { time: "day", wx: null, moon: { tide: 7, full: false } } });
    assert.deepEqual({ ...a, cm: 0 }, { ...b, cm: 0 }, "길이 말고는 같아야 한다");
    if (a.junk) continue;
    const base = (FISH_BASE_CM[a.family] ?? 20) * FISH_STAGE_SIZE[a.stage];
    if (a.cm! >= base * 1.3) big0++;
    if (b.cm! >= base * 1.3) big1++;
    assert.ok(b.cm! <= base * 1.7 + 0.05, "최대 크기는 그대로");
  }
  assert.ok(big1 > big0, `사리 대물 ${big1} > 평소 ${big0}`);
  assert.ok(big1 - big0 < 8000 * 0.03, "덤은 2% 남짓");
});

test("보름달 손님 — 보름달 밤에만 · 그 바다에만 · 이미 있는 품종 · pool 에 없는 계열", () => {
  assert.ok(MOON_FISH.length >= 2 && MOON_FISH.length <= 3);
  for (const t of MOON_FISH) {
    const spot = spotOf(t.spot);
    assert.ok(spot && spot.water === "sea", t.spot);
    assert.ok(speciesOf(t.species), t.species);
    assert.ok(!spot!.pool.some(([k]) => familyOf(k)?.finals.some((x) => x.key === t.species)), `${t.species} 는 ${t.spot} pool 밖이어야 '보름달에만'이 참말`);
    assert.equal(t.moon, "full");
    assert.equal(t.time, "night");
    assert.match(timedLabel(t), /보름달 밤/);
    // TIMED_FISH 에 넣지 않는다 — 넣으면 finalAllowed 가 그 품종의 다 큰 모습을 다른 낚시터에서까지 막는다
    assert.ok(!TIMED_FISH.some((x) => x.moon), "보름달 손님은 따로 둔다");
  }
  const night = (full: boolean): FishMoment => ({ time: "night", wx: null, moon: { tide: 7, full } });
  for (const t of MOON_FISH) {
    const spot = spotOf(t.spot)!;
    const sp = t.species;
    let on = 0, off = 0, day = 0;
    for (let i = 0; i < 6000; i++) {
      const seed = i * 41 + 7;
      const isGuest = (c: ReturnType<typeof rollCatch>) => c.species === sp || (c.stage < 2 && !!familyOf(c.family)?.finals.some((x) => x.key === sp));
      if (isGuest(rollCatch(spot, 5, 0.4, seed, { bait: TOP, when: night(true) }))) on++;
      if (isGuest(rollCatch(spot, 5, 0.4, seed, { bait: TOP, when: night(false) }))) off++;
      if (isGuest(rollCatch(spot, 5, 0.4, seed, { bait: TOP, when: { time: "day", wx: null, moon: { tide: 7, full: true } } }))) day++;
    }
    assert.equal(off, 0, `${t.species} 보름달이 아니면 안 온다`);
    assert.equal(day, 0, `${t.species} 낮엔 안 온다`);
    // 같은 10% 칸을 밤 때 손님과 나눈다
    const share = TIMED_CHANCE / timedAt(t.spot, night(true)).length;
    assert.ok(Math.abs(on / 6000 - share) < 0.03, `${t.species} ${on / 60}% (기대 ${share * 100}%)`);
  }
  assert.deepEqual(timedAt("harbor", night(false)).map((t) => t.species), ["sea_bass"]);
  assert.deepEqual(timedAt("harbor", night(true)).map((t) => t.species), ["sea_bass", "jellyfish"]);
  // 미끼 상한은 그대로 — 지렁이로는 전설 산갈치가 안 온다
  for (let i = 0; i < 3000; i++) assert.notEqual(rollCatch(spotOf("ocean")!, 5, 0.4, i * 13, { bait: 0, when: night(true) }).family, "oarfish");
});

test("손님이 없으면 뽑기 순서가 그대로 · 산갈치 · 해파리의 다른 낚시터 규칙도 그대로", () => {
  // 보름달 손님이 없는 낚시터는 보름달이어도 같은 seed = 같은 물고기(길이까지 — 민물엔 물때가 없다)
  for (const key of ["brook", "pond", "reef", "starsea"]) {
    const spot = spotOf(key)!;
    for (let i = 0; i < 2000; i++) {
      const seed = i * 97 + 5;
      const a = rollCatch(spot, 8, 0.5, seed, { bait: 3, junk: true, when: { time: "night", wx: null } });
      const b = rollCatch(spot, 8, 0.5, seed, { bait: 3, junk: true, when: { time: "night", wx: null, moon: { tide: 3, full: true } } });
      assert.deepEqual(b, a, `${key} ${seed}`);
    }
  }
  // 손님이 있는 바다도 보름달이 아니고 중물이면 옛 호출과 똑같다
  for (let i = 0; i < 2000; i++) {
    const seed = i * 31 + 1;
    assert.deepEqual(rollCatch(spotOf("harbor")!, 8, 0.5, seed, { bait: 3, when: { time: "night", wx: null, moon: { tide: 3, full: false } } }), rollCatch(spotOf("harbor")!, 8, 0.5, seed, { bait: 3, when: { time: "night", wx: null } }));
  }
  // 산갈치는 용궁사 · 심해 pool 에서 보름달과 상관없이 다 큰 모습이 열려 있다(TIMED_KEYS 에 안 들었다)
  for (const key of ["palace", "abyss"]) for (const full of [false, true]) assert.ok(finalAllowed("oarfish", key, { time: "day", wx: null, moon: { tide: 3, full } }), `${key} ${full}`);
  // 해파리는 여전히 문섬의 밤 · 통영의 보름달 밤에만 다 큰 모습
  assert.ok(finalAllowed("jellyfish", "reef", { time: "night", wx: null }));
  assert.ok(!finalAllowed("jellyfish", "harbor", { time: "night", wx: null, moon: { tide: 7, full: false } }));
  assert.ok(finalAllowed("jellyfish", "harbor", { time: "night", wx: null, moon: { tide: 7, full: true } }));
});

test("보름달 밤 — 밝기 95% 넘는 KST 밤(20시~5시)만 · 한 달에 밤 넷쯤", () => {
  const full = nextFullMoon(kst(2026, 11, 12));
  assert.ok(moonMomentOf(full).full === (new Date(full + 9 * H).getUTCHours() >= 20 || new Date(full + 9 * H).getUTCHours() < 5));
  assert.equal(moonMomentOf(kst(2026, 11, 24, 22)).full, true, "2026-11-24 밤 보름달");
  assert.equal(moonMomentOf(kst(2026, 11, 24, 13)).full, false, "낮은 아니다");
  assert.equal(moonMomentOf(kst(2026, 11, 12, 22)).full, false, "초승 무렵");
  let hours = 0;
  for (let ms = kst(2026, 1, 1); ms < kst(2027, 1, 1); ms += H) if (moonMomentOf(ms).full) hours++;
  const nights = hours / 9;
  assert.ok(nights > 40 && nights < 65, `한 해 보름달 밤 ${nights}`);
  for (let ms = kst(2026, 1, 1); ms < kst(2027, 1, 1); ms += 7 * H) {
    const m = moonPhase(ms);
    assert.equal(m.name === "보름", m.illum > FULL_ILLUM, "칩의 '보름'과 손님 판정이 같은 기준");
  }
});

test("달 아이콘 — 모양대로 · 지수 표기 없음 · 이모지 없이 SVG", () => {
  assert.equal(moonLitPath(0), null);
  assert.equal(moonLitPath(0.999), null);
  for (let f = 0.01; f < 1; f += 0.01) {
    const d = moonLitPath(f);
    if (d) assert.doesNotMatch(d, /e-|NaN|Infinity/, `${f}: ${d}`);
  }
  assert.match(moonLitPath(0.25)!, /A0 10 0 0 1 12 2Z$/, "반달은 곧은 종결선");
  assert.match(moonLitPath(0.1)!, / 0 0 0 12 2Z$/, "초승은 밝은 쪽으로 불룩");
  assert.match(moonLitPath(0.4)!, / 0 0 1 12 2Z$/, "볼록한 달은 반대쪽으로");
  const game = code("src/components/FishingGame.tsx"), icons = code("src/components/FishingIcons.tsx"), panels = code("src/components/FishingPanels.tsx");
  assert.match(game, /waitPlan\(seed, tideEffect\(spot\.water, moment\.moon\)\.wait \* craftFx\.wait\)/, "입질 기다림에 물때(만든 향 미끼 배율과 곱한다)");
  assert.match(game, /moon: moonMomentOf\(clock\(\)\)/, "달은 서버 시각(gameNow)으로");
  assert.match(game, /<MoonIcon frac=\{moonNow\.frac\} \/>/);
  assert.match(icons, /export function MoonIcon/);
  assert.doesNotMatch(icons + panels.slice(panels.indexOf("export function MoonSheet"), panels.indexOf("const chanceText")), /[\u{1F311}-\u{1F31D}]/u, "달 이모지 금지");
  assert.match(panels, /강 · 호수는 물때가 없어요/);
  assert.match(panels, /moon\.name === "보름" \? "보름달 무렵이에요\. 오늘 밤 20시부터/, "망이 지난 보름 낮에 '다음 달'을 말하지 않는다");
  assert.match(game, /fish-moon-chip \$\{guests\.some\(\(g\) => g\.moon\)/, "손님 없는 강엔 테두리를 안 켠다");
  // 망이 지난 보름날 낮 — nextFullMoon 은 다음 달인데 달은 아직 보름이다(시트의 가운데 갈래가 필요한 이유)
  const fm = nextFullMoon(kst(2026, 11, 12)), noon = fm + 12 * H;
  assert.equal(moonPhase(noon).name, "보름");
  assert.ok(nextFullMoon(noon) - noon > 20 * D);
  assert.match(panels, /moment\.moon\?\.full\]\)/, "물고기 표가 보름달에 다시 잰다");
});
