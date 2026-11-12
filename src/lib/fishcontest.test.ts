// 이달의 대회(2026-11-12) lock — 그 달의 어종이 앱 · 서버에서 같다 · KST 달 경계 · 1등 상품은 1등일 때 한 번만 · migration 규칙.
// [사용자: "달마다 물고기 한 종을 정해 크기를 겨루고, 1등에게 칭호와 한정 찌를 줍니다"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES } from "./aquarium.ts";
import { SPOTS, familyBaitTier } from "./fishing.ts";
import { createIsland, type IslandState } from "./island.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";
import { LIMITED_LOOKS, LOOKS, TROPHY_BOBBER, buyLook, defaultLook, looksOf, ownsLook, wearLook, wornLooks } from "./fishlooks.ts";
import {
  CONTEST_FAMILIES, canClaim, claimContest, claimedMonth, contestFamily, daysLeft, kstMonthOf, monthBounds, myTitles, shiftMonth, titleText, titlesOf,
  type ContestRow,
} from "./fishcontest.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const MIG_NAME = "20261107080000_fish_month_contest.sql";
const MIG = read(`supabase/migrations/${MIG_NAME}`);
const noComments = (s: string) => s.replace(/--[^\n]*/g, "");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** migration 의 private.contest_family 본문 */
function sqlContestFn() {
  const sql = noComments(MIG);
  const i = sql.indexOf("create or replace function private.contest_family(");
  assert.ok(i >= 0);
  return sql.slice(i, sql.indexOf("$$;", i));
}
const sqlList = () => {
  const f = sqlContestFn();
  return [...f.slice(f.indexOf("array["), f.indexOf("]::text[]")).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
};
/** SQL 식을 그대로 따라 계산한다(배열은 1부터) — 식의 글자는 아래 테스트가 잠근다 */
function sqlFamily(month: string): string | null {
  const f = sqlContestFn();
  const re = new RegExp(f.match(/p_month !~ '([^']+)'/)![1]);
  if (!re.test(month)) return null;
  const n = Number(f.match(/- 1\) % (\d+)\) \+ 1\]/)![1]);
  const [y, m] = month.split("-").map(Number);
  return sqlList()[((y * 12 + m - 1) % n) + 1 - 1];
}

test("대회 어종 — 앱 목록과 서버 목록이 같은 순서 · 공식이 같다(36달)", () => {
  assert.deepEqual(sqlList(), [...CONTEST_FAMILIES], "앱의 CONTEST_FAMILIES 와 migration 의 배열이 다르다 — 둘을 같이 바꾼다");
  const f = sqlContestFn();
  assert.match(f, /\(\(split_part\(p_month, '-', 1\)::integer \* 12 \+ split_part\(p_month, '-', 2\)::integer - 1\) % 15\) \+ 1\]/);
  assert.equal(Number(f.match(/- 1\) % (\d+)\) \+ 1\]/)![1]), CONTEST_FAMILIES.length, "나머지 수 = 목록 길이");
  assert.match(f, /p_month !~ '\^\[0-9\]\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$'/);
  assert.match(f, /immutable\s+set search_path = ''/);
  const months: string[] = [];
  for (let k = 0; k < 36; k++) months.push(shiftMonth("2026-01", k));
  assert.equal(months[35], "2028-12");
  for (const m of months) {
    assert.equal(contestFamily(m), sqlFamily(m), m);
    assert.ok(contestFamily(m), m);
  }
  for (let k = 1; k < months.length; k++) assert.notEqual(contestFamily(months[k]), contestFamily(months[k - 1]), `${months[k]} 이웃한 달이 같은 어종`);
  assert.notEqual(contestFamily("2026-11"), contestFamily("2027-11"), "해마다 같은 달의 어종이 바뀐다");
  assert.equal(new Set(months.slice(0, 15).map(contestFamily)).size, 15, "15달 동안 모든 어종이 한 번씩");
  for (const bad of ["abc", "2026-13", "2026-00", "2026-1", "", "2026-11-01"]) {
    assert.equal(contestFamily(bad), null, bad);
    assert.equal(sqlFamily(bad), null, bad);
  }
});

test("대회 어종 — 아는 계열 · 크기 순위 계열 · Lv.12 안 낚시터의 기본 계열만(주인 · 깊은 바다 · 미끼 1% 계열 아님)", () => {
  const keys = new Set(FAMILIES.map((f) => f.key));
  const guard = read("supabase/migrations/20261107060000_review_guard.sql");
  const ok = guard.slice(guard.indexOf("create or replace function private.fish_family_ok("));
  const okList = new Set([...ok.slice(ok.indexOf("array["), ok.indexOf("]::text[]")).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
  assert.equal(new Set(CONTEST_FAMILIES).size, CONTEST_FAMILIES.length);
  for (const k of CONTEST_FAMILIES) {
    assert.ok(keys.has(k), `${k}: FAMILIES 에 없다`);
    assert.ok(okList.has(k), `${k}: private.fish_family_ok 에 없다 — 크기 순위에 안 들어 대회가 비게 된다`);
    const at = SPOTS.filter((s) => s.minLevel <= 12 && s.pool.some(([f]) => f === k)).some((s) => {
      const base = Math.max(Math.min(...s.pool.map(([f]) => familyBaitTier(f))), s.common ?? -1);
      return familyBaitTier(k) <= base;
    });
    assert.ok(at, `${k}: Lv.12 안의 낚시터에서 시작 미끼로 무는 기본 계열이 아니다`);
  }
});

test("KST 달 경계 — 말일 23:59:59 KST 는 그 달, 다음 날 0시는 다음 달 · 서버의 t0 · t1 과 같은 순간", () => {
  assert.equal(kstMonthOf(Date.UTC(2026, 10, 30, 14, 59, 59)), "2026-11");
  assert.equal(kstMonthOf(Date.UTC(2026, 10, 30, 15, 0, 0)), "2026-12");
  assert.equal(kstMonthOf(Date.UTC(2026, 9, 31, 15, 0, 0)), "2026-11", "UTC 로는 10월 31일이지만 KST 는 11월 1일");
  assert.deepEqual(monthBounds("2026-11"), { start: Date.UTC(2026, 9, 31, 15), end: Date.UTC(2026, 10, 30, 15) });
  assert.deepEqual(monthBounds("2026-12"), { start: Date.UTC(2026, 10, 30, 15), end: Date.UTC(2026, 11, 31, 15) });
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(daysLeft(Date.UTC(2026, 10, 30, 14, 0)), 1, "말일은 1일 남음");
  assert.equal(daysLeft(Date.UTC(2026, 9, 31, 15, 0)), 30, "1일 0시는 30일 남음(11월)");
  // 서버 경계의 글자 — 같은 식이어야 같은 순간이다
  const fn = noComments(MIG);
  assert.match(fn, /\(p_month \|\| '-01'\)::timestamp at time zone 'Asia\/Seoul'/);
  assert.match(fn, /\(\(p_month \|\| '-01'\)::timestamp \+ interval '1 month'\) at time zone 'Asia\/Seoul'/);
  assert.match(fn, /c\.created_at >= m\.t0 and c\.created_at < m\.t1/);
});

const NOW = Date.UTC(2026, 11, 3, 3); // 2026-12-03 KST — 11월 대회가 끝났다
const LAST = "2026-11";
const row = (rank: number, is_me: boolean, family = contestFamily(LAST)!): ContestRow => ({ family, rank, name: `n${rank}`, cm: 50 - rank, catch_name: "", caught_at: "2026-11-05T00:00:00Z", is_me });
const island = (): IslandState => ({ ...createIsland("펫", null, NOW), coins: 1_000_000 });
const ok = <T extends { ok: boolean }>(r: T) => {
  assert.ok(r.ok, JSON.stringify(r));
  return r as T & { ok: true; state: IslandState };
};

test("1등 상품 — 서버가 내 줄을 1등이라 할 때만 · 끝난 달만 · 그 달의 어종만 · 한 번만", () => {
  const s = island();
  assert.equal(canClaim(s, LAST, [row(1, true), row(2, false)], NOW), true);
  assert.equal(canClaim(s, LAST, [row(1, false), row(2, true)], NOW), false, "2등은 못 받는다");
  assert.equal(canClaim(s, LAST, [row(5, true)], NOW), false, "20등 밖의 내 줄만 있어도 1등이 아니다");
  assert.equal(canClaim(s, LAST, [], NOW), false);
  assert.equal(canClaim(s, LAST, [row(1, true, "guppy")], NOW), contestFamily(LAST) === "guppy", "다른 어종 줄은 안 된다");
  assert.equal(canClaim(s, "2026-12", [row(1, true, contestFamily("2026-12")!)], NOW), false, "이번 달 1등은 아직");
  assert.equal(claimContest(s, "a", "2026-12", contestFamily("2026-12")!, NOW).ok, false, "끝나지 않은 달은 거절");
  assert.equal(claimContest(s, "a", LAST, "guppy" === contestFamily(LAST) ? "tetra" : "guppy", NOW).ok, false, "어종이 다르면 거절");

  const after = ok(claimContest(s, "a", LAST, contestFamily(LAST)!, NOW)).state;
  assert.equal(claimedMonth(after, LAST), true);
  assert.deepEqual(titlesOf(after).map((t) => [t.who, t.month, t.text]), [["a", LAST, titleText(LAST, contestFamily(LAST)!)]]);
  assert.match(titleText("2026-11", "rockfish"), /^이달의 강태공 \(2026\.11 우럭\)$/);
  assert.equal(myTitles(after, "b").length, 0, "칭호는 이긴 사람 것");
  assert.equal(canClaim(after, LAST, [row(1, true)], NOW), false, "받은 뒤엔 다시 안 받는다");
  assert.equal(claimContest(after, "a", LAST, contestFamily(LAST)!, NOW).ok, false, "저장 충돌로 다시 돌아도 두 번 안 받는다");
  // 다음 달엔 또 받을 수 있다
  const dec = ok(claimContest(after, "a", "2026-12", contestFamily("2026-12")!, Date.UTC(2027, 0, 2))).state;
  assert.deepEqual(myTitles(dec, "a").map((t) => t.month), ["2026-12", "2026-11"], "최근 달 먼저");
  assert.equal(looksOf(dec).owned.filter((x) => x === TROPHY_BOBBER).length, 1, "찌는 한 번만 넣는다");
});

test("한정 찌 — 하트로 못 산다 · 받기 전엔 못 낀다 · 받으면 끼고 연출이 안다 · 상점 표(기본 하나 · 소모처 합계)는 그대로", () => {
  const trophy = LIMITED_LOOKS.find((x) => x.id === TROPHY_BOBBER)!;
  assert.ok(trophy && trophy.limited && trophy.kind === "bobber");
  assert.ok(!LOOKS.some((x) => x.id === TROPHY_BOBBER), "상점 표에 섞지 않는다");
  assert.equal(defaultLook("bobber").id, "bob_red", "값이 0 이라도 기본이 아니다");
  const s = island();
  assert.equal(ownsLook(looksOf(s), TROPHY_BOBBER), false, "아무나 갖지 않는다");
  assert.equal(buyLook(s, "a", TROPHY_BOBBER).ok, false, "하트로 못 산다");
  assert.equal(wearLook(s, "a", TROPHY_BOBBER).ok, false, "받기 전엔 못 낀다");
  const got = ok(claimContest(s, "a", LAST, contestFamily(LAST)!, NOW)).state;
  assert.equal(got.coins, s.coins, "하트는 그대로");
  assert.deepEqual(looksOf(got).owned, [TROPHY_BOBBER]);
  const worn = ok(wearLook(got, "a", TROPHY_BOBBER)).state;
  assert.equal(wornLooks(worn, "a").bobber.id, TROPHY_BOBBER, "끼면 그 칸에 적힌다(기본처럼 지워지지 않는다)");
  assert.equal(wornLooks(worn, "b").bobber.id, "bob_red", "끼는 건 각자");
  const back = ok(wearLook(worn, "a", "bob_red")).state;
  assert.equal(wornLooks(back, "a").bobber.id, "bob_red", "기본으로 돌아가도 한정 찌는 가진 목록에 남는다");
  assert.deepEqual(looksOf(back).owned, [TROPHY_BOBBER]);
});

test("상품 쓰기는 저장된 그대로에 더한다 — 모르는 칸 · 산 꾸미기 · 끼던 것 · 모르는 칭호를 지우지 않는다", () => {
  const s = withFishPlus(island(), {
    future: { a: 1 },
    titles: [{ id: "other:x", who: "z", month: "2025-01", text: "다른 칭호", at: 1, extra: true }, "망가짐"],
    looks: { owned: ["bob_star", "미래의찌"], wear: { a: { bobber: "bob_star" } }, later: 7 },
  });
  const after = ok(claimContest(s, "a", LAST, contestFamily(LAST)!, NOW)).state;
  const plus = fishPlusOf(after);
  assert.deepEqual(plus.future, { a: 1 });
  assert.equal((plus.titles as unknown[]).length, 3, "망가진 칸도 저장에선 지우지 않는다(읽을 때만 거른다)");
  assert.deepEqual((plus.looks as { owned: string[] }).owned, ["bob_star", "미래의찌", TROPHY_BOBBER]);
  assert.equal((plus.looks as { later: number }).later, 7);
  assert.equal(wornLooks(after, "a").bobber.id, "bob_star", "끼던 찌는 그대로");
  assert.equal(titlesOf(after).length, 2, "읽기는 모양이 맞는 것만");
});

test("migration — 가장 마지막 번호 · schema.sql 에 원문 한 번 · 한 트랜잭션 · 권한 · 같은 보이기 규칙", () => {
  const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(MIG_NAME > "20261107070000_adventure_finish.sql", "번호가 그 전 마지막 파일보다 크다");
  assert.ok(files.indexOf(MIG_NAME) >= 0);
  const schema = read("supabase/schema.sql");
  assert.equal(schema.split(MIG.trim()).length - 1, 1, "schema.sql 에 원문이 정확히 한 번");
  const sql = noComments(MIG);
  assert.match(sql, /^begin;$/m);
  assert.match(sql.trimEnd(), /commit;$/);
  assert.doesNotMatch(sql, /40001|40P01/);
  assert.doesNotMatch(sql, /\b(drop|delete|update|insert|alter)\b/i, "표 · 행 · 기존 함수를 건드리지 않는다");
  assert.equal((sql.match(/create or replace function/g) ?? []).length, 2, "함수 둘만 더한다");
  const board = sql.slice(sql.indexOf("create or replace function public.fish_month_contest("));
  assert.match(board, /^create or replace function public\.fish_month_contest\(p_month text\)\nreturns table \(family text, rank integer, name text, cm real, catch_name text, caught_at timestamptz, is_me boolean\)\nlanguage sql\nstable\nsecurity definer\nset search_path = public\n/);
  assert.match(board, /private\.fish_family_ok\(m\.family\)/, "아는 계열만(fish_size_board_all 과 같다)");
  assert.match(board, /coalesce\(private\.clean_board_text\(n\.nickname, 20\), '이름 없음'\) as name/);
  assert.match(board, /coalesce\(private\.clean_board_text\(b\.catch_name, 30\), ''\) as catch_name/);
  assert.match(board, /order by c\.user_id, c\.cm desc, c\.created_at asc, c\.id asc/, "사람마다 가장 긴 한 마리 · 같은 길이면 먼저 잡은 것");
  assert.match(board, /row_number\(\) over \(order by b\.cm desc, b\.created_at asc, b\.id asc\)/, "같은 길이면 먼저 잡은 사람이 앞");
  assert.match(board, /where r\.rank <= 20 or r\.is_me/);
  assert.doesNotMatch(board.slice(board.indexOf("select m.family, r.rank")), /user_id/, "user_id 는 안 나간다");
  assert.match(sql, /revoke all on function public\.fish_month_contest\(text\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.fish_month_contest\(text\) to authenticated;/);
  assert.match(sql, /revoke all on function private\.contest_family\(text\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /grant execute on function private\./);
});

test("화면 — 수집 탭에 대회 칸 · 함수가 없으면 '대회 준비 중' · 상품은 canClaim 뒤 한 번 · 랭킹에서 대회로 · 크롬에 이모지 없음", () => {
  assert.match(code("src/components/FishCollect.tsx"), /<FishContest \{\.\.\.p\} \/>/);
  const ui = code("src/components/FishContest.tsx");
  assert.match(ui, /cur\.rows === null \? \(\s*<p className="aqua-note fish-rank-empty">대회 준비 중이에요/);
  assert.match(ui, /if \(!claimable \|\| p\.busy \|\| tried\.current === last\) return;/);
  assert.match(ui, /const claimable = !!prev\?\.rows && canClaim\(p\.st, last, prev\.rows, p\.now\);/);
  assert.match(ui, /<FishArt artKey=\{art\}/);
  assert.doesNotMatch(read("src/components/FishContest.tsx"), /\p{Extended_Pictographic}/u, "UI 크롬에 이모지 금지");
  const couple = code("src/lib/couple.ts");
  const fn = couple.slice(couple.indexOf("export async function getFishMonthContest("), couple.indexOf("export async function getFishBoard("));
  assert.match(fn, /sb\.rpc\("fish_month_contest", \{ p_month: month \}\)/);
  assert.match(fn, /if \(isMissingFunction\(error\)\) return null;/);
  assert.match(code("src/components/FishingGame.tsx"), /<FishRank myName=\{myName\} onContest=\{\(\) => \{ setTab\("more"\); setMsg\(null\); \}\} \/>/);
  assert.match(code("src/components/FishRank.tsx"), /onClick=\{onContest\}>이달의 대회 보기/);
  // 상점은 한정을 가진 커플에게만 '끼기'로 보인다(값 단추 없음)
  assert.match(code("src/components/FishLooks.tsx"), /\[\.\.\.LOOKS, \.\.\.LIMITED_LOOKS\.filter\(\(x\) => rec\.owned\.includes\(x\.id\)\)\]/);
});
