// 게임 리뷰 lock (2026-11-06) — 합치기 순위판 지킴이 · 끝난 판 줄 · 닉네임 동의 · 키보드 · 섬 앞 호환.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_LV, NICK_URL_RE, RANK_SCORE_MAX, mergeOf, newGame, normalizeNick, play, rand, scoreCeiling, scoreFloor, settleGame, type Dir, type Game,
} from "./merge.ts";
import { buyGear, createIsland, refreshOrders, type IslandState } from "./island.ts";

const root = join(import.meta.dirname, "..", "..");
const MIG = "supabase/migrations/20261106060000_games_guard.sql";
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const sql = (p: string) => raw(p).replace(/--[^\n]*/g, "");
const code = (p: string) => raw(`src/${p}`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** 실제 엔진으로 판을 끝까지 — 아무렇게나 · 모서리 지키기 두 방식 */
function runGame(seed: number, smart: boolean, check: (g: Game) => void): Game {
  let g = newGame(seed);
  let r = seed ^ 0x5bd1e995;
  const order: Dir[] = ["down", "left", "right", "up"];
  for (let n = 0; n < 6000 && !g.over; n++) {
    let moved = false;
    const tries: Dir[] = smart ? order : [];
    if (!smart) {
      let x: number;
      [x, r] = rand(r);
      tries.push(order[Math.floor(x * 4)], ...order);
    }
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

test("★ 점수 상한 · 하한 — 실제 엔진의 모든 수가 범위 안이다(서버가 거르는 식)", () => {
  let maxTop = 0;
  let checks = 0;
  for (let i = 0; i < 160; i++) {
    const g = runGame(1000 + i * 7919, i % 2 === 0, (x) => {
      if (x.score <= 0) return;
      checks++;
      assert.ok(x.score <= scoreCeiling(x.top), `점수 ${x.score} > 상한 ${scoreCeiling(x.top)} (최고 ${x.top}단계)`);
      assert.ok(x.score >= scoreFloor(x.top), `점수 ${x.score} < 하한 ${scoreFloor(x.top)} (최고 ${x.top}단계)`);
    });
    maxTop = Math.max(maxTop, g.top);
  }
  assert.ok(checks > 10_000 && maxTop >= 9, `시뮬레이션이 너무 얕다(수 ${checks} · 최고 ${maxTop}단계)`);
  // 상한이 의미가 있다 — 목표 단계의 가짜 1천만 점은 걸린다
  assert.equal(scoreCeiling(11), 655_360);
  assert.ok(scoreCeiling(11) < RANK_SCORE_MAX);
  assert.equal(scoreCeiling(MAX_LV), RANK_SCORE_MAX);
  assert.equal(scoreCeiling(0), 0);
  assert.equal(scoreCeiling(MAX_LV + 1), 0);
});

test("★ 서버 식 = 앱 식 — migration 의 범위 · 닉네임 정규식이 merge.ts 와 같다", () => {
  const m = sql(MIG);
  assert.equal(MAX_LV, 17);
  assert.match(m, /and p_top between 1 and 17/);
  assert.match(m, /p_score >= \(case when p_top >= 3 then \(1::bigint << p_top\) else 1 end\)/, "하한(2^L)");
  assert.match(m, /p_score <= least\(10000000::bigint, \(p_top - 1\)::bigint \* \(1::bigint << \(p_top \+ 5\)\)\)/, "상한((L-1)·2^(L+5))");
  assert.ok(m.includes(`'${NICK_URL_RE}'`), "주소 정규식이 앱과 다르다");
  assert.match(m, /else left\(x\.v, 12\)/, "12자");
  // 이 식들이 실제로 같은 값을 내는지 — 상한을 손으로 다시 계산
  for (let L = 1; L <= MAX_LV; L++) assert.equal(scoreCeiling(L), Math.min(10_000_000, (L - 1) * 2 ** (L + 5)));
});

test("닉네임 — 공백 정리 · 12자 · 링크와 보이지 않는 글자 금지", () => {
  assert.deepEqual(normalizeNick("  정원   왕  "), { ok: true, nick: "정원 왕" });
  assert.equal((normalizeNick("가나다라마바사아자차카타파하") as { nick: string }).nick.length, 12);
  for (const bad of ["", "   ", "http://x.y", "www.spam", "discord.gg/abc", "naver.com", "t.me", "a​b", "a\u0007b"])
    assert.equal(normalizeNick(bad).ok, false, bad);
  for (const okNick of ["정원왕", "Mr. Kim", "3.14", "a.b"]) assert.equal(normalizeNick(okNick).ok, true, okNick);
});

test("★ migration — 운영에 그대로 적용돼도 안전하다(멱등 · 지우지 않음 · PT4xx · 권한)", () => {
  const m = sql(MIG);
  assert.match(m, /^\s*begin;/m);
  assert.match(m, /commit;\s*$/);
  assert.doesNotMatch(m, /\b(delete from|drop table|truncate)\b/i, "행을 지우는 문장");
  assert.doesNotMatch(m, /errcode\s*=\s*'(40001|40P01)'/i, "PostgREST 가 끝없이 재시도할 오류 코드");
  assert.match(m, /pg_advisory_xact_lock\(hashtextextended\('merge_run:' \|\| v_uid::text, 0\)\)/, "사람마다 잠금");
  assert.match(m, /interval '20 seconds'\) then\s+raise exception '[^']+' using errcode = 'PT429'/);
  assert.match(m, />= 200 then\s+raise exception '[^']+' using errcode = 'PT429'/);
  assert.match(m, /using errcode = 'PT422'/);
  // security definer 함수는 search_path 를 고정한다
  const defs = m.split(/create or replace function /).slice(1);
  for (const d of defs) if (/security definer/.test(d)) assert.match(d, /set search_path = public/, d.slice(0, 60));
  // 앱 RPC 는 로그인한 사람만, 알림 대상은 서비스 롤만, 도우미는 아무도
  for (const f of ["submit_merge_run(text, integer, integer)", "merge_run_board(bigint)", "submit_merge_score(text, integer, integer)", "merge_leaderboard()"]) {
    assert.ok(m.includes(`revoke all on function public.${f} from public, anon;`), f);
    assert.ok(m.includes(`grant execute on function public.${f} to authenticated;`), f);
  }
  assert.ok(m.includes("grant execute on function public.merge_overtaken(bigint, uuid) to service_role;"));
  assert.doesNotMatch(m, /grant execute on function public\.merge_(clean_nick|score_plausible|run_visible)/);
  // 역전 푸시 — 지킴이를 지난 판만 · 받는 사람마다 하루 한 번
  const over = m.slice(m.indexOf("function public.merge_overtaken"));
  assert.match(over, /and r\.guarded/);
  assert.match(over, /insert into public\.merge_overtake_notified \(user_id, day\)[\s\S]*?on conflict do nothing/);
  // 옛 RPC 도 같은 지킴이(넣기는 submit_merge_run 으로 · 순위는 보이는 판만)
  assert.match(m, /function public\.submit_merge_score[\s\S]*?perform public\.submit_merge_run\(p_nickname, p_score, p_top\)/);
  assert.match(m, /function public\.merge_leaderboard\(\)[\s\S]*?where public\.merge_run_visible\(r\.nickname, r\.score, r\.top_lv\)/);
  // 새 설치(schema.sql)도 같은 규칙 — 끝에 그대로 한 번
  const schema = raw("supabase/schema.sql");
  const body = raw(MIG).trim();
  assert.equal(schema.split(body).length - 1, 1, "schema.sql 끝의 복사본이 없거나 둘이다");
  // 이 파일이 가장 마지막 merge 정의다(뒤에 옛 정의가 다시 오지 않게)
  const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  const later = files.slice(files.indexOf("20261106060000_games_guard.sql") + 1);
  for (const f of later) assert.doesNotMatch(sql(`supabase/migrations/${f}`), /function public\.submit_merge_run/, `${f} 가 지킴이를 덮는다`);
});

test("역전 푸시 함수는 그대로 서버 함수(merge_overtaken)에 묻는다 — 거르는 일은 DB 가 한다", () => {
  const fn = raw("supabase/functions/send-poke-push/index.ts");
  assert.match(fn, /sb\.rpc\("merge_overtaken", \{ p_run: runId, p_user: fromUser \}\)/);
});

test("★ 끝난 판은 줄이다 — 못 남긴 판을 새 판이 덮지 않고, 오프라인은 '섬 없음'이 아니다 [소스 스캔]", () => {
  const g = code("components/MergeGame.tsx");
  assert.doesNotMatch(g, /loadIsland\(coupleId\)\.catch\(\(\) => null\)/, "네트워크 오류를 섬 없음으로 바꾼다");
  assert.match(g, /type Saved = \{ game: Game; queue: Finished\[\] \}/);
  assert.match(g, /setSaved\(\(cur\) => \(\{ game: g, queue: capQueue\(\[\.\.\.\(cur\?\.queue \?\? \[\]\), f\]\) \}\)\)/, "끝난 판을 줄 끝에 붙이지 않는다");
  // 바쁘면(이미 도는 중) 남긴 것으로 치지 않는다
  assert.match(g, /if \(res === "busy"\) return;[\s\S]{0,200}?markDone\(f\.id, "settled"\)/);
  assert.match(g, /if \(res !== "busy"\) markDone\(f\.id, "ranked"\)/);
  assert.match(g, /if \(settleBusy\.current\) return "busy"/);
  assert.match(g, /const hasIsland = !\(island\.loaded && !islandRow\)/, "오프라인을 섬 없음으로 본다");
  // 상점도 같은 구분
  const shop = g.slice(g.indexOf("async function changeSkin"), g.indexOf("async function buy("));
  assert.match(shop, /섬을 불러오지 못했어요/);
  assert.match(shop, /if \(!row\) \{\s*setShopMsg\("섬을 먼저 시작해야 해요"\)/);
  // 옛 형식(끝난 판 한 칸)도 읽는다 — 첫 칸은 그 자리에 쓴다(옛 앱도 첫 판은 이어서 남긴다)
  assert.match(g, /finished: v\.queue\[0\] \?\? null, backlog: v\.queue\.slice\(1\)/);
  assert.match(g, /const raw = \[v\.finished, \.\.\.\(Array\.isArray\(v\.backlog\) \? v\.backlog : \[\]\)\]/);
});

test("★ 순위판 이름은 한 번 직접 정한다 — 계정 이름은 미리 채우기만 [소스 스캔]", () => {
  const g = code("components/MergeGame.tsx");
  assert.match(g, /const rankName = nick;/, "계정 이름을 동의 없이 전체 순위판에 올린다");
  assert.doesNotMatch(g, /\(myName \|\| ""\)\.trim\(\) \|\| nick/);
  assert.match(g, /setNickDraft\(v \|\| \[\.\.\.\(myName \|\| ""\)\.trim\(\)\]/, "계정 이름 미리 채우기");
  assert.match(g, /const NICK_KEY = "ourdays:merge:nick"/);
  assert.match(g, /normalizeNick\(nickDraft\)/, "서버와 같은 규칙으로 먼저 거른다");
});

test("★ 방향키는 판이 보일 때만 · 입력칸 · 대화 상자는 건드리지 않는다 · 판을 말로 알린다 [소스 스캔]", () => {
  const g = code("components/MergeGame.tsx");
  assert.match(g, /const boardActive = view === "game" && !coach && result\?\.phase !== "board"/);
  assert.match(g, /if \(!boardActive\) return;/);
  assert.match(g, /if \(!dir \|\| !keyIsForBoard\(e\)\) return;/);
  assert.match(g, /t\.closest\("input, textarea, select, \[contenteditable=''\], \[contenteditable='true'\]"\)/);
  assert.match(g, /id="merge-board-live" className="sr-only" aria-live="polite"/);
  assert.match(g, /aria-describedby="merge-board-live"/);
  assert.match(g, /useDialogFocus\(result\?\.phase === "board"/, "결과 판에 포커스 가두기 · Esc");
});

test("★ 섬 · 합치기 대화 상자는 포커스를 가두고 Esc 로 닫는다(useDialogFocus) [소스 스캔]", () => {
  for (const f of ["components/IslandGame.tsx", "components/island/EvoCinematic.tsx", "components/island/CoopPlay.tsx", "components/GameHead.tsx", "components/island/IslandSheet.tsx"])
    assert.match(code(f), /useDialogFocus\(/, f);
  assert.match(code("components/island/CoopPlay.tsx"), /if \(phase !== "play"\) onClose\(\)/, "15초 판 도중 Esc 가 판을 끊는다");
});

test("★ 앞 호환 — 옛 앱이 기록을 다시 지어도 새 칸이 살아남는다(mergeOf · 섬 복제 · 장비 · 주문)", () => {
  const s0 = createIsland("나비", null, Date.UTC(2026, 3, 15, 3));
  const s = {
    ...s0,
    coins: 99_999,
    merge: { best: {}, top: {}, day: "", dayCoins: 0, future: { x: 1 } },
    hero: { owned: [], equip: {}, futureHero: 7 },
    orders: { day: "2000-01-01", list: [], futureOrders: "y" },
  } as unknown as IslandState;
  const m = mergeOf(s) as unknown as { future?: unknown };
  assert.deepEqual(m.future, { x: 1 }, "mergeOf 가 모르는 칸을 지운다");
  const settled = settleGame(s, "me", 500, 5, "2026-04-15").state as unknown as { merge: { future?: unknown } };
  assert.deepEqual(settled.merge.future, { x: 1 }, "판을 끝낼 때마다 새 칸이 사라진다");
  const bought = buyGear(s, "stick", Date.UTC(2026, 3, 15, 4));
  assert.notEqual(bought, s, "장비 사기가 안 됐다(테스트가 헛돈다)");
  assert.equal((bought.hero as unknown as { futureHero?: number }).futureHero, 7, "장비를 사면 hero 의 새 칸이 사라진다");
  const refreshed = refreshOrders(s, Date.UTC(2026, 3, 15, 4)) as unknown as { orders?: { futureOrders?: string } };
  assert.equal(refreshed.orders?.futureOrders, "y", "주문을 새로 채우면 orders 의 새 칸이 사라진다");
  const src = code("lib/island.ts");
  assert.match(src, /hero: \{ \.\.\.s\.hero, owned: \[\.\.\.s\.hero\.owned\]/, "복제가 hero 를 아는 칸으로만 다시 짓는다");
  assert.match(src, /orders: \{ \.\.\.s\.orders, list: s\.orders\.list\.map/, "복제가 orders 를 아는 칸으로만 다시 짓는다");
  assert.match(code("lib/merge.ts"), /return \{ \.\.\.\(m \?\? \{\}\), best:/);
});
