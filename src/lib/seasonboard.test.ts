// 시즌 2026-11-18 — 지난 달 못 받은 보상 · 펫 칭호(s.petTitle) · 시즌 순위(migration 20261114110000_season_board) 잠금
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MISSED_DAYS, MISSION_COUNT, SEASON_DECOR, SEASON_QUOTA, TIERS,
  claimBlock, missedBoard, missionsFor, monthOf, petTitlesOf, prevMonth, seasonAdd, seasonBoard, seasonOf, tierTitleText, wearTitle, wornOf,
} from "./season.ts";
import { claimSeason } from "./seasonclaim.ts";
import { addFish, aquaOf, cleanWater, feedFish } from "./aquarium.ts";
import { createIsland, plant, type IslandState } from "./island.ts";
import { settleGame } from "./merge.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");
const H = 3_600_000;
/** KST 정오 */
const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 3);
const NOV = at(2026, 11, 20);
const DEC2 = at(2026, 12, 2);
const DEC7_LAST = Date.UTC(2026, 11, 7, 14, 59); // 12-07 23:59 KST
const DEC8 = Date.UTC(2026, 11, 7, 15, 0); // 12-08 00:00 KST
const rich = (): IslandState => ({ ...createIsland("콩", null, at(2026, 11, 5)), coins: 1_000_000 });
const ok = <S,>(r: { ok: true; state: S } | { ok: false; reason: string }): S => {
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return (r as { state: S }).state;
};
function doneN(n: number, st: IslandState, now: number): IslandState {
  let s = st;
  for (const m of missionsFor(monthOf(now)).slice(0, n)) {
    if (m.stat === "kinds") for (let i = 0; i < m.goal; i++) s = seasonAdd(s, now, {}, { kind: `fam${i}` });
    else if (m.stat === "mergeScore" || m.stat === "mergeTop") s = seasonAdd(s, now, {}, { max: { [m.stat]: m.goal } });
    else s = seasonAdd(s, now, { [m.stat]: m.goal });
  }
  return s;
}
const bagCount = (s: IslandState, now: number) => SEASON_DECOR.reduce((n, k) => n + (aquaOf(s as never, now).bag[k] ?? 0), 0);

test("앞 달 · 미션 수 상수", () => {
  assert.equal(prevMonth("2026-12"), "2026-11");
  assert.equal(prevMonth("2027-01"), "2026-12");
  assert.equal(MISSION_COUNT, Object.values(SEASON_QUOTA).reduce((n, x) => n + x, 0));
  assert.equal(MISSION_COUNT, TIERS[TIERS.length - 1]);
  assert.equal(MISSED_DAYS, 7);
});

test("달을 넘길 때 지난 달 채운 수 · 받은 단계를 prev 에 남긴다", () => {
  let s = doneN(9, rich(), NOV);
  s = ok(claimSeason(s, 1, NOV, "me"));
  const dec = seasonAdd(s, DEC2, { harvest: 1 });
  const raw = (dec as { season: Record<string, unknown> }).season;
  assert.deepEqual(raw.prev, { m: "2026-11", done: 9, got: [1] });
  assert.equal(seasonOf(dec, "2026-12").n.harvest, 1, "이번 달 진행은 새로");
});

test("지난 달 못 받은 보상 — 넘기기 전(이번 달 동작 없음) · 넘긴 뒤 둘 다 · 단계마다 한 번 · 채운 만큼만", () => {
  const nov = ok(claimSeason(doneN(8, rich(), NOV), 1, NOV, "me")); // 11월: 8개, 1단계만 받음
  for (const [name, st] of [["넘기기 전", nov], ["넘긴 뒤", seasonAdd(nov, DEC2, { harvest: 1 })]] as const) {
    const m = missedBoard(st, DEC2);
    assert.ok(m, name);
    assert.equal(m.month, "2026-11");
    assert.equal(m.done, 8);
    assert.deepEqual(m.tiers.map((t) => [t.reached, t.got]), [[true, true], [true, false], [false, false]], name);
    assert.match(claimBlock(st, 1, DEC2, true) ?? "", /이미/, `${name}: 받은 단계`);
    assert.match(claimBlock(st, 3, DEC2, true) ?? "", /채우지 못했/, `${name}: 못 채운 단계`);
    const got = claimSeason(st, 2, DEC2, "you", true);
    assert.ok(got.ok, name);
    assert.equal(got.state.coins, st.coins, `${name}: 하트는 그대로`);
    assert.equal(claimSeason(got.state, 2, DEC2 + H, "me", true).ok, false, `${name}: 두 번째는 거절`);
    // 이번 달 받음 표시는 건드리지 않는다
    assert.deepEqual(seasonOf(got.state, "2026-12").got, [], name);
    // 받은 것이 이어서 달을 넘겨도 남는다(넘기기 전에 받은 경우 → 넘길 때 prev 로 간다)
    const after = seasonAdd(got.state, DEC2 + H, { feed: 1 });
    assert.deepEqual(missedBoard(after, DEC2 + H)?.tiers.map((t) => t.got), [true, true, false], name);
  }
});

test("지난 달 보상 — 1~7일만 · 시계가 빨랐던 폰은 열지 않는다 · 두 달 전은 없다", () => {
  const nov = doneN(4, rich(), NOV);
  assert.ok(missedBoard(nov, DEC7_LAST), "7일 끝까지");
  assert.equal(missedBoard(nov, DEC7_LAST)?.daysLeft, 1);
  assert.equal(missedBoard(nov, DEC8), null, "8일부터 닫힌다");
  assert.match(claimBlock(nov, 1, DEC8, true) ?? "", /7일까지/);
  assert.equal(missedBoard(nov, NOV), null, "이번 달엔 없다");
  assert.equal(missedBoard(nov, at(2027, 1, 2)), null, "두 달 전 기록은 받지 않는다");
  // 12월 기록이 이미 있는데(시계가 빨랐던 폰이 저장) 기기 시계가 11월 → 날짜는 앞으로만, 창 없음
  const ahead = seasonAdd(nov, DEC2, { harvest: 1 });
  assert.equal(missedBoard(ahead, NOV), null);
});

test("지난 달 보상은 지난 달 것 — 장식은 지난 달 장식 · 3단계 칭호도 지난 달", () => {
  const nov = doneN(12, rich(), NOV);
  const d = ok(claimSeason(nov, 1, DEC2, "me", true));
  assert.equal(bagCount(d, DEC2), bagCount(nov, DEC2) + 1);
  const t3 = ok(claimSeason(d, 3, DEC2, "me", true));
  const titles = (t3 as unknown as { season: { titles: { m: string }[] } }).season.titles;
  assert.deepEqual(titles.map((x) => x.m), ["2026-11"]);
  assert.deepEqual(petTitlesOf(t3).map((x) => [x.m, x.t]), [["2026-11", 3]]);
});

test("펫 칭호 — 단계마다 그 달 칭호가 오른다 · 옛 기록에서도 읽는다 · 고르기 · 숨기기", () => {
  let s = doneN(12, rich(), NOV);
  assert.equal(wornOf(s), null, "받기 전엔 칭호 없음");
  s = ok(claimSeason(s, 1, NOV, "me"));
  assert.deepEqual(wornOf(s), { m: "2026-11", t: 1, text: tierTitleText("2026-11", 1) });
  assert.equal(tierTitleText("2026-11", 1), "11월 시즌 새싹");
  assert.equal(tierTitleText("2026-11", 3), "11월 시즌 완주");
  s = ok(claimSeason(s, 2, NOV, "me"));
  s = ok(claimSeason(s, 3, NOV, "me"));
  assert.equal(wornOf(s)?.text, "11월 시즌 완주");
  // 새 칸은 섬 최상위 — s.season · s.aquarium · s.aquaPlus · s.fishing 안이 아니다
  assert.ok((s as { petTitle?: { list?: unknown[] } }).petTitle?.list?.length === 1);
  // 12월 1단계 → 가장 최근 달이 기본
  const dec = ok(claimSeason(doneN(4, s, DEC2), 1, DEC2, "me"));
  assert.equal(wornOf(dec)?.m, "2026-12");
  // 고르기 · 숨기기 · 받지 않은 달은 무시
  const wore = wearTitle(dec, "2026-11");
  assert.equal(wornOf(wore)?.text, "11월 시즌 완주");
  assert.equal(wearTitle(wore, "2025-01"), wore, "받지 않은 달은 그대로");
  assert.equal(wornOf(wearTitle(wore, "")), null);
  // 옛 앱이 받은 기록(s.season.titles · got)도 칭호가 된다 — petTitle 칸 없이
  const legacy = { ...rich(), season: { m: "2026-11", n: {}, kinds: [], got: [1, 2], titles: [{ m: "2026-10", who: "a", at: 1 }] } } as IslandState;
  assert.deepEqual(petTitlesOf(legacy).map((x) => [x.m, x.t]), [["2026-10", 3], ["2026-11", 2]]);
  // 시트 · 카드가 같은 값을 본다
  assert.equal(seasonBoard(wore, DEC2).worn?.m, "2026-11");
});

test("petTitle 은 엔진 동작을 지나도 남는다 — 섬 · 수조 · 합치기 · 시즌 쓰기가 최상위 칸을 그대로 흘린다", () => {
  const s0 = wearTitle(ok(claimSeason(doneN(4, addFish(rich(), "guppy", 0, undefined, NOV), NOV), 1, NOV, "me")), "2026-11");
  const pt = (x: object) => (x as { petTitle?: unknown }).petTitle;
  assert.ok(pt(s0));
  let s = plant(s0, 0, "strawberry", NOV + H);
  s = { ...s, aquarium: { ...s.aquarium!, water: 10, hunger: 10 } } as IslandState;
  s = ok(cleanWater(s, NOV + 2 * H));
  s = ok(feedFish(s, NOV + 2 * H));
  s = settleGame(s, "me", 3000, 7, "2026-11-20", 1).state;
  s = seasonAdd(s, DEC2, { harvest: 1 }); // 달 넘김(새 진행 칸)
  assert.deepEqual(pt(s), pt(s0));
  assert.equal(wornOf(s)?.m, "2026-11");
  // 옛 앱의 시즌 쓰기 흉내(s.season 만 새로 짓는다)도 최상위 칸은 건드리지 않는다
  const old = { ...s, season: { m: "2026-12", n: { harvest: 99 }, kinds: [], got: [] } };
  assert.equal(wornOf(old)?.m, "2026-11");
});

const strip = (s: string) => s.replace(/--[^\n]*/g, "");
const MIG = "20261114110000_season_board.sql";
const sql = readFileSync(join(ROOT, "supabase/migrations", MIG), "utf8").replace(/\r\n/g, "\n");
const code = strip(sql);

test("migration — schema.sql 에 원문 한 번(순서는 migrationlint 가 본다 — '맨 끝'은 다음 migration 이 오면 깨지니 묻지 않는다)", () => {
  const files = readFileSync(join(ROOT, "supabase/schema.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(files.split(sql.trim()).length - 1, 1);
});

test("migration — 표 · RLS · 쓰기는 RPC 로만 · 정책은 우리 커플 집합", () => {
  assert.match(code, /create table if not exists public\.season_runs/);
  assert.match(code, /done\s+smallint not null check \(done between 1 and 12\)/, "미션 수 상한 = MISSION_COUNT");
  assert.equal(MISSION_COUNT, 12);
  assert.match(code, /alter table public\.season_runs enable row level security;/);
  assert.match(code, /revoke all on public\.season_runs from public, anon, authenticated;\ngrant select on public\.season_runs to authenticated;/);
  assert.match(code, /create policy season_runs_select_couple on public\.season_runs for select to authenticated\s+using \(couple_id in \(select private\.my_couple_ids\(\)\)\);/);
  assert.doesNotMatch(code, /grant (insert|update|delete)[^;]*season_runs/);
});

test("migration — submit_season 지킴이: 로그인 · 서버 KST 달 · 1~12 · 닉네임 · 커플 · 잠금 · 20초 · 하루 30", () => {
  const fn = code.slice(code.indexOf("create or replace function public.submit_season"), code.indexOf("create or replace function public.season_board"));
  assert.match(fn, /security definer\s+set search_path = public/);
  assert.match(fn, /v_now\s+date := private\.season_month_start\(now\(\)\)/);
  assert.match(fn, /if p_month is distinct from v_now then\s+raise exception '[^']+' using errcode = 'PT422'/);
  assert.match(fn, /p_done < 1 or p_done > 12 then\s+raise exception '[^']+' using errcode = 'PT422'/);
  assert.match(fn, /v_nick := public\.merge_clean_nick\(p_nickname\);/);
  assert.match(fn, /errcode = 'PT403'/);
  assert.match(fn, /perform pg_advisory_xact_lock\(hashtextextended\('season:' \|\| v_uid::text, 0\)\);/);
  assert.match(fn, /interval '20 seconds'\) then\s+raise exception '[^']+' using errcode = 'PT429'/);
  assert.match(fn, />= 30 then\s+raise exception '[^']+' using errcode = 'PT429'/);
  // 잠금이 확인 · 넣기보다 먼저
  assert.ok(fn.indexOf("pg_advisory_xact_lock") < fn.indexOf("insert into public.season_runs"));
  assert.match(code, /private\.season_month_start[\s\S]*?date_trunc\('month', \(p_at at time zone 'Asia\/Seoul'\)\)::date/);
});

test("migration — season_board 는 닉네임 · 채운 수만 · 이번/지난 달만 · 권한", () => {
  const fn = code.slice(code.indexOf("create or replace function public.season_board"), code.indexOf("revoke all on function private.season_month_start"));
  assert.match(fn, /returns table \(month date, rank integer, names text, done integer, is_mine boolean, couples integer, ended boolean\)/);
  assert.doesNotMatch(fn.slice(fn.indexOf("select ok.month")), /user_id|couple_id,/, "아이디를 내보내지 않는다");
  assert.match(fn, /order by t\.done desc, t\.done_id asc/, "같은 수면 먼저 닿은 커플");
  assert.match(code, /revoke all on function private\.season_month_start\(timestamptz\) from public, anon, authenticated;/);
  assert.match(code, /revoke all on function private\.season_totals\(date\) from public, anon, authenticated;/);
  assert.match(code, /revoke all on function public\.submit_season\(date, text, integer\) from public, anon;/);
  assert.match(code, /revoke all on function public\.season_board\(date\) from public, anon;/);
  assert.match(code, /grant execute on function public\.submit_season\(date, text, integer\) to authenticated;/);
  assert.match(code, /grant execute on function public\.season_board\(date\) to authenticated;/);
  // 커플 점수는 합이 아니라 최대(둘이 같은 섬 진행을 본다), 지금도 그 커플인 사람만
  const tot = code.slice(code.indexOf("create or replace function private.season_totals"), code.indexOf("create or replace function public.submit_season"));
  assert.match(tot, /join public\.couple_members m on m\.couple_id = r\.couple_id and m\.user_id = r\.user_id/);
  assert.match(tot, /max\(l\.done\)/);
  assert.doesNotMatch(tot, /sum\(/);
});

test("앱 — 순위 올리기는 커플 · 닉네임 · 지금 달 · 늘었을 때만 · 허브는 시트를 정적으로 안 싣는다 · 섬 이름표에 칭호", () => {
  const read = (f: string) => readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const rank = read("lib/seasonrank.ts");
  assert.match(rank, /if \(!coupleId \|\| month !== nowMonth \|\| done < 1\) return false;/);
  assert.match(rank, /if \(!nick \|\| done <= readSent\(coupleId, month\)\) return false;/);
  assert.match(rank, /export const NICK_KEY = "ourdays:merge:nick";/);
  assert.match(rank, /if \(code === "PT422" \|\| code === "PT403"\) writeSent/);
  const hub = read("components/GameArcade.tsx");
  assert.doesNotMatch(hub, /from\s+["']@\/components\/SeasonSheet["']/);
  assert.match(hub, /syncSeasonRank\(coupleId, seasonMonth, nowMonth, seasonDone\)/);
  assert.match(hub, /const petTitle = season\?\.worn \?\? null;/);
  const isl = read("components/IslandGame.tsx");
  assert.match(isl, /const petTitle = wornOf\(s\);/);
  assert.match(isl, /\{petTitle && <span className="pet-title-chip"/);
  const sheet = read("components/SeasonSheet.tsx");
  assert.match(sheet, /claimSeason\(st, tier, gameNow\(\), uid \?\? "me", isMissed\)/);
  assert.match(sheet, /normalizeNick\(draft\)/, "서버와 같은 닉네임 규칙으로 먼저 거른다");
});
