// 모험 온라인 대전 lock — 팀 고르기 · 닉네임 · 연습 상대 · 판 · 점수 · 서버 복사본 · DB 권한. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVES, SPECIES, newSave, playTurn, statsOf, type AdvSave } from "./adventure.ts";
import { TEAM_MAX, botTeam, cleanNick, duelAction, eloDelta, pickTeam, startDuel } from "./adventurepvp.ts";
import { SHARED_FILES, sharedContent } from "../../scripts/adventure-shared.mjs";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");

test("★ 서버 복사본(_shared/adventure)이 src/lib 와 같다 — 엔진을 고치면 node scripts/adventure-shared.mjs 후 함수 재배포", () => {
  for (const f of SHARED_FILES as string[]) {
    assert.equal(read(`supabase/functions/_shared/adventure/${f}`), sharedContent(root, f).replace(/\r\n/g, "\n"), `${f} 복사본이 낡았다`);
    assert.doesNotMatch(read(`supabase/functions/_shared/adventure/${f}`), /from "\.\/island\.ts"/, "섬 엔진을 끌고 가면 안 된다");
  }
});

function richSave(): AdvSave {
  const s = newSave("leaf_2", 7);
  const extra = { ...s.party[0], id: "m9", species: "volt_3", level: 99, gene: { hp: 40, atk: -3, def: 2.7, spd: 7 }, hp: 1, moves: [{ id: "fake", pp: 99 }] };
  return { ...s, party: [...s.party, extra], box: [{ ...s.party[0], id: "m10", species: "conch_2", level: 12 }] };
}

test("대전 팀은 기록에서 id 로 — 최대 셋 · 겹치지 않게 · 레벨 · 개체값 범위 · 기술 · 체력을 새로", () => {
  const team = pickTeam(richSave(), ["m9", "m9", "nope", "m1", "m10", "m1"]);
  assert.equal(team.length, 3);
  assert.deepEqual(team.map((m) => m.id), ["m9", "m1", "m10"]);
  const t = team[0];
  assert.equal(t.level, 50);
  assert.deepEqual(t.gene, { hp: 7, atk: 0, def: 2, spd: 7 });
  assert.ok(t.moves.every((m) => MOVES[m.id] && m.pp === MOVES[m.id].pp));
  assert.equal(t.hp, statsOf(t).hp);
  assert.ok(team.length <= TEAM_MAX);
  assert.deepEqual(pickTeam(richSave(), ["x"]), []);
});

test("닉네임 — 공백 정리 · 12자 · 링크 · 보이지 않는 글자", () => {
  assert.equal(cleanNick("  숲속   탐험가 "), "숲속 탐험가");
  assert.equal(cleanNick("가".repeat(13)), null);
  assert.equal(cleanNick("http://a.b"), null);
  assert.equal(cleanNick("www.x"), null);
  assert.equal(cleanNick("​​"), null);
  assert.equal(cleanNick("a​b"), "ab");
  assert.equal(cleanNick(5), null);
});

test("연습 상대 — 같은 날 · 레벨 · 번호면 같은 팀, 셋 다 다른 계보, 레벨에 맞는 진화 단계", () => {
  for (const lv of [5, 20, 40]) for (let i = 0; i < 5; i++) {
    const a = botTeam(lv, i, "2026-11-08");
    assert.deepEqual(a, botTeam(lv, i, "2026-11-08"));
    assert.equal(a.team.length, TEAM_MAX);
    assert.equal(new Set(a.team.map((m) => SPECIES[m.species].lineage)).size, TEAM_MAX);
    const want = a.team[0].level >= 32 ? 4 : a.team[0].level >= 16 ? 3 : 2;
    assert.ok(a.team.some((m) => SPECIES[m.species].stage === want || Math.abs(m.level - lv) <= 4));
  }
});

test("대전 판 — 공 · 도망 · 가방은 안 먹히고, 기술 · 교체로 끝까지 간다", () => {
  const mine = pickTeam(richSave(), ["m1", "m9", "m10"]);
  const theirs = botTeam(20, 1, "2026-11-08").team;
  let b = startDuel(mine, theirs, 42, ["나", "상대"]);
  assert.equal(playTurn(b, { kind: "ball", ball: "basic", aim: 1 }, { balls: { basic: 9, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } }).events.length, 0);
  assert.equal(playTurn(b, { kind: "run" }).events.length, 0);
  assert.equal(playTurn(b, { kind: "item", item: "potion", target: 0 }).events.length, 0);
  for (let i = 0; i < 200 && !b.over; i++) {
    const r = b.needSwap ? playTurn(b, { kind: "swap", to: b.sides[0].team.findIndex((f) => f.mon.hp > 0) }) : playTurn(b, { kind: "move", i: 0 });
    b = r.battle;
  }
  assert.ok(b.over === "win" || b.over === "lose");
});

test("서버가 받는 행동은 기술 · 교체뿐", () => {
  assert.deepEqual(duelAction({ kind: "move", i: 2 }), { kind: "move", i: 2 });
  assert.deepEqual(duelAction({ kind: "swap", to: 1 }), { kind: "swap", to: 1 });
  assert.equal(duelAction({ kind: "move", i: 9 }), null);
  assert.equal(duelAction({ kind: "ball", ball: "star" }), null);
  assert.equal(duelAction({ kind: "run" }), null);
  assert.equal(duelAction(null), null);
});

test("점수(ELO) — 이기면 오르고 지면 내리며, 센 상대를 이기면 더 오른다", () => {
  assert.ok(eloDelta(1000, 1000, 1, 32) > 0 && eloDelta(1000, 1000, 0, 32) < 0);
  assert.ok(eloDelta(1000, 1300, 1, 32) > eloDelta(1000, 1000, 1, 32));
  assert.equal(eloDelta(1000, 1000, 1, 32), 16);
});

test("★ 서버 함수 — 판 상태는 DB 에서만 읽고(앱이 보낸 battle 을 안 믿는다), 턴 번호로 두 번 돌지 않는다", () => {
  const fn = read("supabase/functions/adventure-battle/index.ts");
  assert.doesNotMatch(fn, /body\.battle|body\?\.battle/, "앱이 보낸 판 상태를 쓰면 체력을 조작할 수 있다");
  assert.match(fn, /duelAction\(body\.action\)/);
  assert.match(fn, /\.eq\("turn", m\.turn\)/, "같은 턴을 두 번 돌리지 않게");
  assert.match(fn, /adventure_settle/);
  assert.match(fn, /from "\.\.\/_shared\/adventure\/adventure\.ts"/);
});

test("★ DB — 대전 표는 앱이 못 쓰고, 정산은 서비스 롤만, 순위 · 전적은 닉네임 · 점수만", () => {
  const sql = read("supabase/migrations/20261107040000_adventure_pvp.sql");
  assert.match(sql, /revoke insert, update, delete on public\.adventure_teams, public\.adventure_ratings, public\.adventure_matches from authenticated;/);
  assert.match(sql, /grant execute on function public\.adventure_settle\(uuid, uuid, boolean, integer, integer\) to service_role;/);
  assert.match(sql, /revoke all on function public\.adventure_settle\(uuid, uuid, boolean, integer, integer\) from public, anon, authenticated;/);
  const board = sql.slice(sql.indexOf("function public.adventure_board"), sql.indexOf("revoke all on function public.adventure_board"));
  assert.doesNotMatch(board, /select[^;]*\bt\.team\b(?! -> 0)/, "순위에 팀 전체가 나가면 안 된다");
  assert.doesNotMatch(sql, /errcode = '40001'|errcode = '40P01'/);
});

test("★ 서버 복사본만으로 판이 끝까지 돈다(주석을 뺀 복사본이 깨지지 않았다)", async () => {
  const eng = await import("../../supabase/functions/_shared/adventure/adventure.ts");
  const pvp = await import("../../supabase/functions/_shared/adventure/adventurepvp.ts");
  const save = eng.newSave("conch_2", 3);
  const mine = pvp.pickTeam(save, [save.party[0].id]);
  let b = pvp.startDuel(mine, pvp.botTeam(6, 0, "2026-11-08").team, 11, ["나", "상대"]);
  for (let i = 0; i < 200 && !b.over; i++) {
    const r = b.needSwap ? eng.playTurn(b, { kind: "swap", to: b.sides[0].team.findIndex((f: { mon: { hp: number } }) => f.mon.hp > 0) }) : eng.playTurn(b, { kind: "move", i: 0 });
    b = r.battle;
  }
  assert.ok(b.over === "win" || b.over === "lose");
  assert.equal(Object.keys(eng.SPECIES).length, 30);
});
