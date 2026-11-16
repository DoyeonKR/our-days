// 합치기 주간 도전판(2026-11-13) lock — 규칙 엔진 · 주와 규칙이 앱 · 서버에서 같다 · 규칙마다 점수 범위 · 주간 보상 상한과 한 번 · migration 규칙.
// [사용자 승인: "합치기 주간 도전판"] README §14.4.5 '주간 도전판'.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_LV, MOVES_MASS, PRESET_TOP, SIZE, WEEKLY_REWARD_CAP, WEEKLY_REWARD_SCALE, WEEKLY_REWARD_TIERS, WEEKLY_RULES, WEEK_PAID_KEEP,
  canMove, isChallengeGame, isGame, mergeOf, newChallenge, newGame, play, rand, settleWeekly, slide, weekOf, weekSerialOf, weekSerialOfStart,
  weekStartOf, weeklyReward, weeklyRuleOfSerial, weeklyScoreCeiling, weeklyScoreFloor, weeklyTopMax,
  type Board, type Dir, type Game, type Tile, type WeeklyRuleId,
} from "./merge.ts";
import { createIsland, type IslandState } from "./island.ts";

const root = join(import.meta.dirname, "..", "..");
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const MIG_NAME = "20261107100000_merge_weekly.sql";
const MIG = raw(`supabase/migrations/${MIG_NAME}`);
const sql = MIG.replace(/--[^\n]*/g, "");
const code = (p: string) => raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const T = (id: number, lv: number, extra: Partial<Tile> = {}): Tile => ({ id, lv, ...extra });
const S = (id: number): Tile => ({ id, lv: 0, stone: true });
const row = (b: Board, r: number, n = SIZE) => b.slice(r * n, r * n + n).map((t) => (t ? (t.stone ? "S" : t.lv) : 0));

/* ── 엔진 ── */

test("보통 판은 그대로 — 규칙 없는 판은 4×4 · 장르 표준([1,1,1,1] → [2,2]) · isGame 은 16칸만", () => {
  const b: Board = Array(16).fill(null);
  [0, 1, 2, 3].forEach((i) => (b[i] = T(i + 1, 1)));
  assert.deepEqual(row(slide(b, "left").board, 0), [2, 2, 0, 0]);
  const g = newGame(42);
  assert.equal(g.board.length, 16);
  assert.equal(g.rule, undefined);
  assert.ok(isGame(g));
  assert.equal(isGame(newChallenge(42, "big")), false, "5×5 도전판이 보통 판 저장 자리로 새면 안 된다");
});

test("★ 보통 판의 결과가 도전판 이전 엔진과 같다 — 시드별 끝 점수 · 수 · 최고 단계(dc5cd5e 엔진으로 잰 값)", () => {
  // 2026-11-13 확인: 도전판 이전 엔진(dc5cd5e 의 merge.ts)과 지금 엔진을 60판 · 10,592수 동안 매 수 deepEqual 로 견줘 같았다.
  // 그때 잰 끝 값을 잠근다 — 규칙 옵션을 고치다 보통 판의 난수 순서 · 밀기가 바뀌면 여기서 깨진다.
  const order: Dir[] = ["down", "left", "right", "up"];
  const finish = (seed: number, randomish: boolean) => {
    let g = newGame(seed);
    let r = seed ^ 0x5bd1e995;
    for (let n = 0; n < 6000 && !g.over; n++) {
      let x: number;
      [x, r] = rand(r);
      const tries = randomish ? [order[Math.floor(x * 4)], ...order] : [...order];
      let moved = false;
      for (const d of tries) {
        const t = play(g, d);
        if (t.result) {
          g = t.game;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    return `${g.score}:${g.moves}:${g.top}`;
  };
  assert.equal(finish(1000, false), "3909:279:8");
  assert.equal(finish(8919, true), "1600:145:7");
  assert.equal(finish(16838, false), "6963:372:9");
  assert.equal(finish(24757, true), "1182:110:7");
});

test("돌 — 움직이지 않고 줄을 토막으로 나눈다 · 돌 너머로 합쳐지지 않는다 · 거름도 안 먹는다", () => {
  const b: Board = Array(16).fill(null);
  b[1] = T(1, 1);
  b[2] = S(2);
  b[3] = T(3, 1);
  const left = slide(b, "left");
  assert.deepEqual(row(left.board, 0), [1, 0, "S", 1], "돌 왼쪽 토막은 끝까지 몰리고, 오른쪽 타일은 돌에 막혀 제자리");
  assert.equal(left.merged.length, 0, "돌을 사이에 둔 같은 재료는 안 합쳐진다");
  assert.ok(left.moved);
  const right = slide(b, "right");
  assert.deepEqual(row(right.board, 0), [0, 1, "S", 1]);
  // 돌 한쪽 토막 안에서는 장르 표준대로 합쳐진다
  const c: Board = Array(16).fill(null);
  c[0] = T(1, 2);
  c[1] = T(2, 2);
  c[2] = S(3);
  c[3] = T(4, 0, { fert: true });
  const r = slide(c, "left");
  assert.equal(r.board[0]?.lv, 3);
  assert.equal(r.board[1], null);
  assert.equal(r.board[2]?.stone, true);
  assert.equal(r.board[3]?.fert, true, "거름은 돌과 합쳐지지 않는다");
  // 돌로 가득 막힌 판은 끝
  const full: Board = Array.from({ length: 16 }, (_, i) => (i % 2 ? S(i + 1) : T(i + 1, 1 + ((i / 2 + Math.floor(i / 4)) % 2))));
  assert.equal(canMove(full), false);
});

test("돌밭 — 돌 2~3개가 시드로 놓이고, 판 내내 제자리 · 점수 · 최고 단계에 안 든다", () => {
  const counts = new Set<number>();
  for (let s = 1; s <= 40; s++) {
    let g = newChallenge(s * 977, "stones");
    const stones = g.board.flatMap((t, i) => (t?.stone ? [i] : []));
    counts.add(stones.length);
    assert.equal(g.board.filter((t) => t && !t.stone).length, 2, "무작위 두 타일로 시작");
    for (let k = 0; k < 120 && !g.over; k++) {
      const t = play(g, (["left", "up", "right", "down"] as Dir[])[k % 4]);
      if (t.result) g = t.game;
    }
    assert.deepEqual(g.board.flatMap((t, i) => (t?.stone ? [i] : [])), stones, "돌은 움직이지 않는다");
  }
  assert.deepEqual([...counts].sort(), [2, 3]);
});

test("60수 — 60번째 수에서 판이 끝나고, 거름이 안 나온다", () => {
  let g = newChallenge(5, "moves");
  let fert = 0;
  for (let k = 0; k < 500 && !g.over; k++) {
    let moved = false;
    for (const d of ["down", "left", "right", "up"] as Dir[]) {
      const t = play(g, d);
      if (t.result) {
        g = t.game;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    fert += g.board.filter((t) => t?.fert).length;
  }
  assert.equal(g.moves, 60);
  assert.ok(g.over);
  assert.equal(fert, 0);
  assert.equal(play(g, "left").result, null, "끝난 판은 더 안 움직인다");
});

test("같은 출발 — 시드와 상관없이 같은 판에서 시작한다", () => {
  const a = newChallenge(1, "preset"), b = newChallenge(999_999, "preset");
  assert.deepEqual(a.board, b.board);
  assert.equal(Math.max(...a.board.map((t) => t?.lv ?? 0)), PRESET_TOP);
  assert.equal(a.top, PRESET_TOP);
});

test("거름 풍년 — 5수째부터 훨씬 자주(보통 판보다 많이)", () => {
  const count = (mk: (s: number) => Game) => {
    let n = 0;
    for (let s = 1; s <= 30; s++) {
      let g = mk(s);
      for (let k = 0; k < 40 && !g.over; k++) {
        const before = new Set(g.board.map((t) => t?.id));
        const t = play(g, (["down", "left", "right", "up"] as Dir[])[k % 4]);
        if (!t.result) continue;
        g = t.game;
        if (g.board.some((x) => x?.fert && !before.has(x.id))) n++;
      }
    }
    return n;
  };
  const rich = count((s) => newChallenge(s, "fert"));
  const plain = count((s) => newGame(s));
  assert.ok(rich > 50 && rich > plain * 3, `거름 풍년 ${rich} · 보통 ${plain}`);
});

test("넓은 밭 — 5×5 판에서 줄 다섯이 밀린다 · 저장 검증은 규칙과 크기가 맞을 때만", () => {
  const g = newChallenge(3, "big");
  assert.equal(g.board.length, 25);
  assert.ok(isChallengeGame(g));
  assert.equal(isChallengeGame({ ...g, board: g.board.slice(0, 16) }), false);
  assert.equal(isChallengeGame(newGame(3)), false, "규칙 없는 판은 도전판이 아니다");
  const b: Board = Array(25).fill(null);
  [0, 1, 2, 3, 4].forEach((i) => (b[20 + i] = T(i + 1, 1)));
  assert.deepEqual(row(slide(b, "right").board, 4, 5), [0, 0, 1, 2, 2]);
  assert.deepEqual(row(slide(b, "left").board, 4, 5), [2, 2, 1, 0, 0]);
});

/* ── 주 · 규칙 ── */

test("주는 KST 월요일 0시에 바뀐다 · 같은 주 = 같은 규칙 · 이웃한 주는 규칙이 다르다 · 다섯 주에 다섯 규칙", () => {
  const at = (s: string) => Date.parse(s);
  assert.equal(weekOf(at("2026-11-16T00:00:00+09:00")).week, "2026-11-16");
  assert.equal(weekOf(at("2026-11-15T23:59:59+09:00")).week, "2026-11-09");
  assert.equal(weekOf(at("2026-11-22T23:59:59+09:00")).week, "2026-11-16");
  assert.equal(weekOf(at("2026-11-15T15:00:00Z")).week, "2026-11-16", "UTC 일요일 15시 = KST 월요일 0시");
  const w = weekOf(at("2026-11-18T12:00:00+09:00"));
  assert.equal(w.endsAt, at("2026-11-23T00:00:00+09:00"));
  assert.equal(weekSerialOfStart(w.week), w.serial);
  assert.equal(weekSerialOfStart("2026-11-17"), null, "월요일이 아니다");
  assert.equal(weekSerialOfStart("abc"), null);
  for (let s = 2700; s < 2900; s++) {
    assert.equal(weekSerialOf(Date.parse(`${weekStartOf(s)}T00:00:00+09:00`)), s);
    assert.notEqual(weeklyRuleOfSerial(s).id, weeklyRuleOfSerial(s + 1).id);
  }
  assert.equal(new Set([0, 1, 2, 3, 4].map((k) => weeklyRuleOfSerial(2800 + k).id)).size, WEEKLY_RULES.length);
  // 연말 · 53주 해에도 그대로 돈다(ISO 주 번호를 쓰지 않는다)
  const a = weekOf(at("2026-12-31T12:00:00+09:00")), b = weekOf(at("2027-01-05T12:00:00+09:00"));
  assert.equal(b.serial, a.serial + 1);
});

test("★ 서버 = 앱 — migration 의 주 · 규칙 식과 목록이 merge.ts 와 같다", () => {
  const fn = sql.slice(sql.indexOf("create or replace function private.merge_week_rule("));
  const list = [...fn.slice(fn.indexOf("array["), fn.indexOf("]::text[]")).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(list, WEEKLY_RULES.map((r) => r.id), "규칙 순서가 다르다 — 둘을 같이 바꾼다");
  assert.match(fn, /\(\(p_week - date '1970-01-05'\) \/ 7\) % 5 \+ 1\]/);
  assert.equal(WEEKLY_RULES.length, 5);
  assert.equal(weekStartOf(0), "1970-01-05", "앱의 기준 월요일 = 서버의 date '1970-01-05'");
  assert.match(sql, /select date '1970-01-05' \+ \(\(\(\(p_at at time zone 'Asia\/Seoul'\)::date - date '1970-01-05'\) \/ 7\) \* 7\);/);
  assert.match(sql, /rule\s+text not null check \(rule in \('stones', 'moves', 'preset', 'fert', 'big'\)\)/);
});

/* ── 점수 범위 ── */

function runChallenge(seed: number, rule: WeeklyRuleId, smart: boolean, check: (g: Game) => void): Game {
  let g = newChallenge(seed, rule);
  let r = seed ^ 0x5bd1e995;
  const order: Dir[] = ["down", "left", "right", "up"];
  for (let n = 0; n < 8000 && !g.over; n++) {
    const tries: Dir[] = smart ? [...order] : [];
    if (!smart) {
      let x: number;
      [x, r] = rand(r);
      tries.push(order[Math.floor(x * 4)], ...order);
    }
    let moved = false;
    for (const d of tries) {
      const t = play(g, d);
      if (t.result) {
        g = t.game;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    check(g);
  }
  return g;
}

test("★ 규칙마다 점수 상한 · 하한 — 실제 엔진의 모든 수가 범위 안이다(서버가 거르는 식)", () => {
  for (const { id } of WEEKLY_RULES) {
    let checks = 0, maxTop = 0;
    for (let i = 0; i < 40; i++) {
      const g = runChallenge(500 + i * 7919, id, i % 2 === 0, (x) => {
        if (x.score <= 0) return;
        checks++;
        assert.ok(x.top <= weeklyTopMax(id), `${id}: 최고 ${x.top} > ${weeklyTopMax(id)}`);
        assert.ok(x.score <= weeklyScoreCeiling(id, x.top), `${id}: 점수 ${x.score} > 상한 ${weeklyScoreCeiling(id, x.top)} (최고 ${x.top})`);
        assert.ok(x.score >= weeklyScoreFloor(id, x.top), `${id}: 점수 ${x.score} < 하한 ${weeklyScoreFloor(id, x.top)} (최고 ${x.top})`);
      });
      maxTop = Math.max(maxTop, g.top);
    }
    assert.ok(checks > 1500, `${id}: 시뮬레이션이 너무 얕다(${checks})`);
    assert.ok(maxTop >= 6, `${id}: 최고 ${maxTop}단계`);
  }
  // 범위가 의미가 있다 — 보통 판 상한보다 넓은 건 큰 밭뿐이고, 60수는 훨씬 좁다
  assert.equal(weeklyScoreCeiling("stones", 11), 655_360);
  assert.equal(weeklyScoreCeiling("big", 11), 1_024_000);
  assert.equal(weeklyTopMax("moves"), 7);
  assert.equal(MOVES_MASS, 248);
  assert.equal(weeklyScoreCeiling("moves", 7), 2 * 6 * 248);
  assert.equal(weeklyScoreCeiling("moves", 8), 0);
  assert.equal(weeklyScoreFloor("preset", PRESET_TOP), 1, "같은 출발은 시작 재료 단계까지 합치지 않아도 된다");
  assert.equal(weeklyScoreFloor("preset", PRESET_TOP + 1), 2 ** (PRESET_TOP + 1));
  assert.equal(weeklyScoreFloor("fert", 3), 8);
  assert.equal(weeklyScoreCeiling("big", MAX_LV), 10_000_000);
});

test("★ 서버 범위 식 = 앱 — migration 의 상수가 merge.ts 와 같다", () => {
  const fn = sql.slice(sql.indexOf("create or replace function private.merge_weekly_plausible("), sql.indexOf("create or replace function private.merge_weekly_totals("));
  assert.match(fn, new RegExp(`p_top between 1 and \\(case when p_rule = 'moves' then ${weeklyTopMax("moves")} else ${MAX_LV} end\\)`));
  assert.match(fn, new RegExp(`case when p_rule = 'preset' then ${PRESET_TOP} else 2 end`));
  assert.match(fn, /2 \* \(case when p_rule = 'big' then 25 else 16 end\)::bigint \* \(p_top - 1\)::bigint \* \(1::bigint << p_top\)/);
  assert.match(fn, new RegExp(`case when p_rule = 'moves' then 2 \\* \\(p_top - 1\\)::bigint \\* ${MOVES_MASS} else 10000000::bigint end`));
  assert.equal(WEEKLY_RULES.find((r) => r.id === "big")!.size, 5);
  assert.equal(WEEKLY_RULES.filter((r) => r.id !== "big").every((r) => r.size === 4), true);
  assert.equal(WEEKLY_RULES.find((r) => r.id === "moves")!.moveLimit, 60, "MOVES_MASS 는 60수 기준");
  assert.equal(WEEKLY_RULES.find((r) => r.id === "moves")!.fertChance, 0, "60수의 질량 상한은 거름이 없어야 맞다");
});

/* ── 주간 보상 ── */

const island = (): IslandState => createIsland("콩", null, Date.parse("2026-11-16T10:00:00+09:00"));

test("★ 주간 보상 — 점수 단계별 · 주당 상한 600 · 끝난 주만 · 같은 주는 한 번", () => {
  assert.equal(weeklyReward(0, "preset"), 0);
  assert.equal(weeklyReward(-5, "preset"), 0);
  assert.equal(weeklyReward(Number.NaN, "preset"), 0);
  assert.equal(weeklyReward(1, "preset"), 50);
  assert.equal(weeklyReward(499, "preset"), 50);
  assert.equal(weeklyReward(500, "preset"), 100);
  assert.equal(weeklyReward(40_000, "preset"), 600);
  for (const { id } of WEEKLY_RULES) {
    assert.equal(weeklyReward(9_999_999, id), WEEKLY_REWARD_CAP, id);
    assert.equal(weeklyReward(1, id) > 0, true, `${id}: 1점이라도 했으면 받는다`);
    assert.ok(WEEKLY_REWARD_SCALE[id] > 0, id);
  }
  // 규칙마다 점수 크기가 달라 곱해 맞춘다 — 60수 커플의 실제 상한(2,976 × 2)으로도 꼭대기 근처에 닿는다
  assert.equal(weeklyReward(2 * weeklyScoreCeiling("moves", weeklyTopMax("moves")), "moves"), 500);
  assert.equal(weeklyReward(500, "moves"), 200);
  assert.equal(weeklyReward(10_000, "big"), 200);
  for (const [, coins] of WEEKLY_REWARD_TIERS) assert.ok(coins <= WEEKLY_REWARD_CAP);
  for (let i = 1; i < WEEKLY_REWARD_TIERS.length; i++) assert.ok(WEEKLY_REWARD_TIERS[i][0] < WEEKLY_REWARD_TIERS[i - 1][0], "높은 것부터");
  assert.ok(WEEKLY_REWARD_CAP <= 600);

  const s0 = island();
  assert.equal(weeklyRuleOfSerial(weekSerialOfStart("2026-11-16")!).id, "preset", "아래 값은 같은 출발 주(곱 1) 기준");
  const r1 = settleWeekly(s0, "2026-11-16", 12_345, "2026-11-23");
  assert.equal(r1.coins, 400);
  assert.equal(r1.state.coins, s0.coins + 400);
  assert.deepEqual(mergeOf(r1.state).weekPaid, ["2026-11-16"]);
  const r2 = settleWeekly(r1.state, "2026-11-16", 99_999, "2026-11-23");
  assert.equal(r2.dup, true);
  assert.equal(r2.coins, 0);
  assert.equal(r2.state, r1.state, "이미 받은 주는 같은 참조");
  // 아직 안 끝난 주 · 미래 주 · 월요일이 아닌 값 · 점수 없음
  for (const [week, cur] of [["2026-11-16", "2026-11-16"], ["2026-11-23", "2026-11-16"], ["2026-11-10", "2026-11-16"]]) {
    const r = settleWeekly(s0, week, 5000, cur);
    assert.equal(r.coins, 0, week);
    assert.equal(r.state, s0);
  }
  assert.equal(settleWeekly(s0, "2026-11-09", 0, "2026-11-16").state, s0);
  // 한 주에 여러 번 불러도 600 을 넘지 않는다
  let s = s0;
  for (let k = 0; k < 5; k++) s = settleWeekly(s, "2026-11-02", 1_000_000, "2026-11-16").state;
  assert.equal(s.coins - s0.coins, 600);
  // 받은 주 목록은 최근 WEEK_PAID_KEEP 개만, 다른 merge 칸은 그대로
  let t: IslandState = { ...s0, merge: { ...mergeOf(s0), skins: ["x"], best: { a: 5 } } };
  for (let k = 0; k < 20; k++) t = settleWeekly(t, weekStartOf(2700 + k), 100, weekStartOf(2800)).state;
  const m = mergeOf(t);
  assert.equal(m.weekPaid?.length, WEEK_PAID_KEEP);
  assert.equal(m.weekPaid?.at(-1), weekStartOf(2719));
  assert.deepEqual(m.skins, ["x"]);
  assert.equal(m.best.a, 5);
});

/* ── migration ── */

test("★ migration — 새 표 · 멱등 · 지우지 않음 · PT4xx · 잠금 · 횟수 · 권한 · schema.sql 끝에 한 번", () => {
  assert.match(sql, /^begin;$/m);
  assert.match(sql.trimEnd(), /commit;$/);
  assert.doesNotMatch(sql, /\b(delete from|drop table|truncate|drop function)\b/i);
  assert.doesNotMatch(sql, /errcode\s*=\s*'(40001|40P01)'/i);
  assert.match(sql, /create table if not exists public\.merge_weekly_runs/);
  assert.doesNotMatch(sql, /alter table public\.merge_runs/, "전체 순위 표는 건드리지 않는다");
  assert.doesNotMatch(sql, /function public\.(submit_merge_run|merge_run_board|merge_leaderboard|submit_merge_score|merge_overtaken)\b/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('merge_weekly:' \|\| v_uid::text, 0\)\)/);
  assert.match(sql, /interval '20 seconds'\) then\s+raise exception '[^']+' using errcode = 'PT429'/);
  assert.match(sql, />= 200 then\s+raise exception '[^']+' using errcode = 'PT429'/);
  assert.match(sql, /v_nick := public\.merge_clean_nick\(p_nickname\);/);
  assert.match(sql, /p_rule is distinct from private\.merge_week_rule\(p_week\)/);
  assert.match(sql, /not private\.merge_weekly_plausible\(p_rule, p_score, p_top\)/);
  for (const c of ["PT401", "PT403", "PT422", "PT429"]) assert.ok(sql.includes(`errcode = '${c}'`), c);
  // 정책 — set-based · to authenticated · drop if exists 짝
  assert.match(sql, /drop policy if exists merge_weekly_runs_select_couple on public\.merge_weekly_runs;/);
  assert.match(sql, /create policy merge_weekly_runs_select_couple on public\.merge_weekly_runs for select to authenticated\s+using \(couple_id in \(select private\.my_couple_ids\(\)\)\);/);
  assert.match(sql, /revoke all on public\.merge_weekly_runs from public, anon, authenticated;/);
  assert.match(sql, /grant select on public\.merge_weekly_runs to authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*merge_weekly_runs/i, "쓰기는 RPC 로만");
  // 함수 권한
  for (const f of ["submit_merge_weekly(date, text, text, integer, integer)", "merge_weekly_board(date)"]) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon;`), f);
    assert.ok(sql.includes(`grant execute on function public.${f} to authenticated;`), f);
  }
  for (const f of ["merge_week_start(timestamptz)", "merge_week_rule(date)", "merge_weekly_plausible(text, integer, integer)", "merge_weekly_totals(date)"]) {
    assert.ok(sql.includes(`revoke all on function private.${f} from public, anon, authenticated;`), f);
    assert.ok(!sql.includes(`grant execute on function private.${f}`), f);
  }
  for (const d of sql.split(/create or replace function /).slice(1)) assert.match(d.slice(0, d.indexOf("$$")), /set search_path = /, d.slice(0, 50));
  // 순위판은 닉네임 · 점수만(아이디 칸이 반환형에 없다)
  const board = sql.slice(sql.indexOf("function public.merge_weekly_board"));
  const ret = board.slice(board.indexOf("returns table ("), board.indexOf(")", board.indexOf("returns table (")));
  assert.doesNotMatch(ret, /user_id|couple_id/);
  assert.match(board, /where k\.rk <= 20 or k\.mine/);
  assert.match(ret, /ended boolean/, "보상은 서버 시각으로 끝난 주만");
  assert.match(board, /ok\.week < private\.merge_week_start\(now\(\)\)/);
  // 신규 bootstrap
  const schema = raw("supabase/schema.sql");
  assert.equal(schema.split(MIG.trim()).length - 1, 1);
});

/* ── 화면 ── */

test("화면 — 도전판은 보통 판과 저장 · 정산 · 순위가 따로다 [소스 스캔]", () => {
  const w = code("src/components/MergeWeekly.tsx");
  assert.match(w, /ourdays:merge:wk:v1:/, "도전판은 자기 저장 자리");
  assert.doesNotMatch(w, /ourdays:merge:v1:/);
  assert.doesNotMatch(w, /\b(settleGame|submitMergeRun|getMergeRunBoard)\b/, "도전판은 보통 판의 하트 · 순위로 가지 않는다");
  assert.match(w, /submitMergeWeekly\(/);
  assert.match(w, /settleWeekly\(/);
  assert.match(w, /gameNow\(\)/, "주 판정은 서버 시각(잰 뒤)으로");
  assert.match(w, /!mine\.ended\) return;/, "보상은 서버가 끝났다고 한 주만");
  assert.match(w, /useDialogFocus\(/);
  const g = code("src/components/MergeGame.tsx");
  assert.match(g, /<MergeWeekly\b/);
  assert.match(g, /useState<"game" \| "shop" \| "weekly">/);
  const couple = code("src/lib/couple.ts");
  assert.match(couple, /sb\.rpc\("submit_merge_weekly", \{ p_week: week, p_rule: rule, p_nickname: nickname, p_score: Math\.round\(score\), p_top: top \}\)/);
  assert.match(couple, /sb\.rpc\("merge_weekly_board", \{ p_week: week \}\)/);
});

test("화면 CSS — 5×5 판 칸 크기 · 돌 · 움직임 줄이기 · 글자 크기 짝(12/18 · 15/24)", async () => {
  const css = raw("src/styles/games.css");
  const i = css.indexOf("/* ── 합치기 주간 도전판");
  assert.ok(i >= 0, "games.css 에 도전판 덩어리가 없다");
  const block = css.slice(i, css.indexOf("/* ── 합치기 주간 도전판 끝"));
  assert.match(block, /\.merge-board\.is-n5 \.merge-cell, \.merge-board\.is-n5 \.merge-tile, \.merge-board\.is-n5 \.merge-burst \{[^}]*calc\(\(100% - 6 \* var\(--g\)\) \/ 5\)/);
  assert.match(block, /\.merge-tile\.is-stone/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)/);
  for (const m of block.matchAll(/font-size:\s*(\d+)px;\s*line-height:\s*(\d+)px/g)) assert.ok((m[1] === "12" && m[2] === "18") || (m[1] === "15" && m[2] === "24"), `${m[1]}/${m[2]}`);
  assert.doesNotMatch(block, /font-size:\s*(?!12px|15px)\d+px/, "글자 크기는 12 · 15 만");
});
