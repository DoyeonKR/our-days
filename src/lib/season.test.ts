// 시즌 미션(2026-11-13) — 달마다 같은 미션 · 동작 자리에서 센 수 · 달 넘김 · 한 번만 받기 · 허브 첫 그림
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GAME_ORDER, KINDS_MAX, MISSION_POOL, SEASON_BOBBER, SEASON_DECOR, SEASON_QUOTA, TIERS,
  activeMonth, claimBlock, daysLeft, missionValue, missionsFor, monthOf, seasonAdd, seasonAdvMerge, seasonBoard, seasonOf, type Mission,
} from "./season.ts";
import { claimSeason } from "./seasonclaim.ts";
import { addFish, aquaOf, claimRequest, cleanWater, feedFish, stow, decorOf } from "./aquarium.ts";
import { settleGame } from "./merge.ts";
import { createIsland, evolve, harvest, harvestAllReady, plant, waterPlot, type IslandState } from "./island.ts";
import { LIMITED_LOOKS, looksOf } from "./fishlooks.ts";
import { FX_BOBBERS } from "./fishingfx.ts";

const SRC = join(import.meta.dirname, "..");
const H = 3_600_000;
const DAY_MS = 24 * H;
/** 2026-11-05 KST 정오 */
const T0 = Date.UTC(2026, 10, 5, 3);
const DEC = Date.UTC(2026, 11, 2, 3);
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, T0), coins });
const ok = <S,>(r: { ok: true; state: S } | { ok: false; reason: string }): S => {
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return (r as { state: S }).state;
};
const mission = (id: string): Mission => MISSION_POOL.find((m) => m.id === id)!;
const value = (st: object, id: string, now = T0) => missionValue(seasonOf(st, activeMonth(st, now)), mission(id));

test("미션 고르기 — 달만 보고 정한다 · 12개 · 게임마다 몫 · 두 폰이 같다", () => {
  const a = missionsFor("2026-11"), b = missionsFor("2026-11");
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
  assert.equal(a.length, 12);
  assert.equal(Object.values(SEASON_QUOTA).reduce((n, x) => n + x, 0), 12);
  assert.equal(TIERS[TIERS.length - 1], 12);
  for (const g of GAME_ORDER) assert.equal(a.filter((m) => m.game === g).length, SEASON_QUOTA[g], g);
  // 섬 상태와 상관없다 — 보드도 같은 목록
  const s1 = seasonBoard(rich(), T0).rows.map((r) => r.m.id), s2 = seasonBoard(seasonAdd(rich(), T0, { harvest: 9 }), T0).rows.map((r) => r.m.id);
  assert.deepEqual(s1, a.map((m) => m.id));
  assert.deepEqual(s2, s1);
  // 달이 바뀌면 고르는 게 달라지는 달이 있다(늘 같으면 시즌이 아니다)
  const sets = new Set(Array.from({ length: 12 }, (_, i) => missionsFor(`2027-${String(i + 1).padStart(2, "0")}`).map((m) => m.id).join(",")));
  assert.ok(sets.size >= 3, `12달에 미션 조합 ${sets.size}가지`);
  // 풀은 id 가 겹치지 않는다 · 목표는 1 이상
  assert.equal(new Set(MISSION_POOL.map((m) => m.id)).size, MISSION_POOL.length);
  assert.ok(MISSION_POOL.every((m) => m.goal >= 1 && m.label.length > 0));
});

test("달 · 남은 날 — KST 달력 달 · 마지막 날은 1", () => {
  assert.equal(monthOf(Date.UTC(2026, 10, 30, 14, 59)), "2026-11");
  assert.equal(monthOf(Date.UTC(2026, 10, 30, 15, 0)), "2026-12");
  assert.equal(daysLeft(Date.UTC(2026, 10, 30, 3)), 1);
  assert.equal(daysLeft(Date.UTC(2026, 10, 1, 3)), 30);
  assert.equal(daysLeft(Date.UTC(2027, 1, 1, 3)), 28);
  assert.equal(daysLeft(Date.UTC(2028, 1, 1, 3)), 29);
});

test("수 · 최고값 · 계열 — 바뀐 게 없으면 원본 그대로 · 계열은 한 번씩 · 상한", () => {
  const st = rich();
  let s = seasonAdd(st, T0, { landed: 1 }, { kind: "guppy" });
  s = seasonAdd(s, T0 + H, { landed: 1 }, { kind: "guppy" });
  s = seasonAdd(s, T0 + H, { landed: 1 }, { kind: "tetra" });
  assert.equal(value(s, "fish_landed"), 3);
  assert.equal(value(s, "fish_kinds"), 2);
  const same = seasonAdd(s, T0, {}, { kind: "guppy" });
  assert.equal(same, s, "이미 센 계열 · 빈 더하기는 같은 참조");
  let many: IslandState = s;
  for (let i = 0; i < KINDS_MAX + 10; i++) many = seasonAdd(many, T0, {}, { kind: `k${i}` });
  assert.equal(seasonOf(many, "2026-11").kinds.length, KINDS_MAX);
  // 최고값은 큰 값만
  let m = seasonAdd(st, "2026-11-05", {}, { max: { mergeScore: 18000, mergeTop: 7 } });
  m = seasonAdd(m, "2026-11-06", {}, { max: { mergeScore: 9000, mergeTop: 9 } });
  assert.equal(value(m, "merge_score"), 18000);
  assert.equal(value(m, "merge_top"), 9);
  // 옛 앱이 모르는 칸이라 다른 최상위 칸 · 모르는 시즌 칸을 지우지 않는다
  const future = { ...st, season: { m: "2026-11", n: {}, future: [1] } } as IslandState;
  assert.deepEqual((seasonAdd(future, T0, { kick: 1 }).season as { future?: unknown }).future, [1]);
});

test("달 넘김 — 새 달이면 비우고 칭호는 남긴다 · 날짜는 앞으로만", () => {
  let s = seasonAdd(rich(), T0, { harvest: 5, water: 2 });
  s = { ...s, season: { ...(s.season as object), titles: [{ m: "2026-10", who: "a", at: 1 }] } };
  assert.equal(value(s, "island_harvest"), 5);
  // 12월이 되면 11월 수는 안 보인다
  assert.equal(seasonBoard(s, DEC).rows.find((r) => r.m.stat === "harvest")?.value ?? 0, 0);
  const dec = seasonAdd(s, DEC, { harvest: 1 });
  const v = seasonOf(dec, "2026-12");
  assert.equal(v.n.harvest, 1);
  assert.equal(v.n.water, undefined);
  assert.equal(v.titles.length, 1, "칭호는 달이 바뀌어도 남는다");
  // 12월이 저장된 뒤 시계가 11월로 돌아간 폰 — 11월로 되돌리지 않고 12월에 쌓는다
  const back = seasonAdd(dec, T0, { harvest: 1 });
  assert.equal(seasonOf(back, "2026-12").n.harvest, 2);
  assert.equal(activeMonth(back, T0), "2026-12");
  // 지난 달의 모험 수는 버린다
  assert.equal(seasonAdvMerge(dec, "u1", { m: "2026-11", advCatch: 3 }), dec);
});

test("모험 — 사람마다 큰 값으로 · 다시 보내도 두 번 세지 않는다 · 둘을 더한다 · 이 기기 값이 먼저 보인다", () => {
  let s = seasonAdvMerge(rich(), "me", { m: "2026-11", advCatch: 3, advBoss: 1 });
  s = seasonAdvMerge(s, "me", { m: "2026-11", advCatch: 3, advBoss: 1 });
  assert.equal(seasonAdvMerge(s, "me", { m: "2026-11", advCatch: 2 }), s, "작은 값은 아무것도 안 바꾼다");
  s = seasonAdvMerge(s, "you", { m: "2026-11", advCatch: 2, advWin: 4 });
  assert.equal(value(s, "adv_catch"), 5);
  assert.equal(value(s, "adv_boss"), 1);
  assert.equal(value(s, "adv_win"), 4);
  const v = seasonOf(s, "2026-11");
  assert.equal(missionValue(v, mission("adv_catch"), { uid: "me", tally: { m: "2026-11", advCatch: 6 } }), 8);
  // 사람 칸은 넷까지(커플 둘 + 기기를 바꾼 여유)
  let full = s;
  for (const u of ["a", "b", "c", "d"]) full = seasonAdvMerge(full, u, { m: "2026-11", advWin: 1 });
  assert.equal(Object.keys(seasonOf(full, "2026-11").adv).length, 4);
});

test("섬 — 수확 · 모두 수확 · 진화를 엔진이 센다 · 안 된 동작은 안 센다", () => {
  let s = rich();
  s = plant(s, 0, "strawberry", T0);
  s = plant(s, 1, "strawberry", T0);
  s = waterPlot(s, 0, T0 + 1000);
  s = waterPlot(s, 1, T0 + 1000);
  assert.equal(harvest(s, 0, T0 + 2000), s, "덜 자랐으면 원본 그대로(안 센다)");
  const one = harvest(s, 0, T0 + 3 * DAY_MS);
  assert.equal(value(one, "island_harvest", T0 + 3 * DAY_MS), 1);
  const all = harvestAllReady(s, T0 + 3 * DAY_MS);
  assert.equal(value(all, "island_harvest", T0 + 3 * DAY_MS), 2);
  const pet = rich();
  pet.pet.careXp = 210;
  pet.pet.pendingEvolve = true;
  const ev = evolve(pet, T0);
  assert.equal(ev.pet.form, "hatchling");
  assert.equal(value(ev, "island_evolve"), 1);
  const none = rich();
  assert.equal(evolve(none, T0), none, "대기 아니면 안 센다");
});

test("수조 — 물갈이 · 먹이 · 손님 · 알에서 깬 치어", () => {
  const st = addFish(rich(), "guppy", 0, undefined, T0);
  const dirty = { ...st, aquarium: { ...st.aquarium!, water: 10, hunger: 10 } } as IslandState;
  const w = ok(cleanWater(dirty, T0 + H));
  assert.equal(value(w, "aqua_water", T0 + H), 1);
  const f = ok(feedFish(w, T0 + H));
  assert.equal(value(f, "aqua_feed", T0 + H), 1);
  assert.equal(cleanWater(f, T0 + H).ok, false, "물이 깨끗하면 거절 — 안 센다");
  // 손님 — 오늘 의뢰를 채운 수조
  const a = aquaOf(st as never, T0);
  const req = { day: "2026-11-05", kind: "beauty" as const, key: "beauty", n: 0, reward: 10 };
  const withReq = stow(st, { ...a, req });
  const g = claimRequest(withReq, T0 + H);
  if (g.ok) assert.equal(value(g.state, "aqua_guest", T0 + H), 1);
  else assert.fail(g.reason);
  // 알 — eggN 이 늘어난 저장만 한 번
  const egg0 = stow(st, { ...a, eggN: 2 });
  const egg1 = stow(egg0, { ...aquaOf(egg0 as never, T0), eggN: 3 });
  assert.equal(value(egg1, "aqua_hatch") - value(egg0, "aqua_hatch"), 1);
  const again = stow(egg1, aquaOf(egg1 as never, T0));
  assert.equal(value(again, "aqua_hatch"), value(egg1, "aqua_hatch"), "같은 값을 다시 저장해도 안 센다");
});

test("합치기 — 끝낸 판 · 이번 달 최고 점수 · 단계 · 같은 판 두 번은 안 센다", () => {
  const st = rich();
  const a = settleGame(st, "me", 21000, 8, "2026-11-05", 1).state;
  const b = settleGame(a, "you", 5000, 6, "2026-11-06", 2).state;
  assert.equal(value(b, "merge_games"), 2);
  assert.equal(value(b, "merge_score"), 21000);
  assert.equal(value(b, "merge_top"), 8);
  const dup = settleGame(b, "me", 99999, 11, "2026-11-06", 1);
  assert.ok(dup.dup);
  assert.equal(value(dup.state, "merge_games"), 2);
});

/** 이번 달 미션을 n 개 채운 섬 */
function doneN(n: number, st = rich(), now = T0): IslandState {
  let s: IslandState = st;
  for (const m of missionsFor(monthOf(now)).slice(0, n)) {
    if (m.stat === "kinds") for (let i = 0; i < m.goal; i++) s = seasonAdd(s, now, {}, { kind: `fam${i}` });
    else if (m.stat === "mergeScore" || m.stat === "mergeTop") s = seasonAdd(s, now, {}, { max: { [m.stat]: m.goal } });
    else if (m.stat.startsWith("adv")) s = seasonAdvMerge(s, "me", { m: monthOf(now), [m.stat]: m.goal });
    else s = seasonAdd(s, now, { [m.stat]: m.goal });
  }
  return s;
}

test("받기 — 채운 만큼 · 단계마다 한 달에 한 번 · 받음 표시와 보상이 같은 저장", () => {
  const s3 = doneN(3);
  assert.equal(seasonBoard(s3, T0).done, 3);
  assert.match(claimBlock(s3, 1, T0) ?? "", /4개/);
  assert.equal(claimSeason(s3, 1, T0, "me").ok, false);

  const s4 = doneN(4);
  const c1 = claimSeason(s4, 1, T0, "me");
  assert.ok(c1.ok);
  const key = SEASON_DECOR.find((k) => (aquaOf(c1.state as never, T0).bag[k] ?? 0) > 0);
  assert.ok(key && decorOf(key), "그 달 장식이 보관함에(이미 있는 장식)");
  assert.equal(c1.state.coins, s4.coins, "하트는 그대로");
  const again = claimSeason(c1.state, 1, T0 + H, "you");
  assert.equal(again.ok, false, "두 번째는 거절(상대 폰 · 다시 돌린 저장)");
  assert.equal(claimSeason(c1.state, 2, T0, "me").ok, false, "8개 전엔 2단계 없음");

  const s8 = doneN(8, c1.state);
  const c2 = claimSeason(s8, 2, T0, "me");
  assert.ok(c2.ok);
  assert.ok(looksOf(c2.state).owned.includes(SEASON_BOBBER), "시즌 찌");
  assert.equal(claimSeason(c2.state, 2, T0, "me").ok, false);

  const s12 = doneN(12, c2.state);
  const c3 = claimSeason(s12, 3, T0, "me");
  assert.ok(c3.ok);
  const v = seasonOf(c3.state, "2026-11");
  assert.deepEqual([...v.got].sort(), [1, 2, 3]);
  assert.equal(v.titles.length, 1);
  assert.equal(v.titles[0].m, "2026-11");
  assert.equal(c3.state.coins, s4.coins, "어느 단계도 하트를 주지 않는다");

  // 다음 달 — 받음 표시는 비고 칭호는 남는다. 찌를 이미 가졌으면 2단계는 장식
  const dec = doneN(8, c3.state, DEC);
  assert.deepEqual(seasonOf(dec, "2026-12").got, []);
  const d2 = claimSeason(doneN(8, ok(claimSeason(dec, 1, DEC, "me")), DEC), 2, DEC, "me");
  assert.ok(d2.ok);
  assert.match(d2.note, /보관함/);
  assert.equal(seasonOf(d2.state, "2026-12").titles.length, 1);
});

test("시즌 찌 — 한정 꾸미기 · 연출이 그린다 · 하트로 못 산다", () => {
  const look = LIMITED_LOOKS.find((x) => x.id === SEASON_BOBBER);
  assert.ok(look && look.limited && look.kind === "bobber");
  assert.ok((FX_BOBBERS as readonly string[]).includes(SEASON_BOBBER));
  for (const k of SEASON_DECOR) assert.ok(decorOf(k), `${k} 는 이미 있는 장식`);
});

test("첫 그림 — season.ts 는 kst 만 · 허브는 받기 · 시트 코드를 정적으로 안 싣는다 · 모험 탭은 동적으로", () => {
  const strip = (f: string) => readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const imports = (f: string) => [...strip(f).matchAll(/^\s*import\s+(?!type\s)[\s\S]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports("lib/season.ts"), ["./kst.ts"]);
  const hub = strip("components/GameArcade.tsx");
  assert.doesNotMatch(hub, /from\s+["']@\/lib\/seasonclaim["']/);
  assert.doesNotMatch(hub, /from\s+["']@\/components\/SeasonSheet["']/);
  assert.match(hub, /const SeasonSheet = dynamic\(\(\) => import\("@\/components\/SeasonSheet"\), \{ ssr: false/);
  const tab = strip("components/adventure/AdventureTab.tsx");
  assert.doesNotMatch(tab, /from\s+["']@\/lib\/season(sync)?["']/);
  assert.match(tab, /import\("@\/lib\/seasonsync"\)/);
});
