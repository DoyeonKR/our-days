// 낚시 단순화 · 공개 연출 lock. [사용자 2026-11-02 "더 단순하지만 임펙트있게" → "다 해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fishingOf, rankLine, revealMs, sellCatch, tryStore, type FishCatch, type FishStanding } from "./fishing.ts";
import { FishFx, type FxCanvas } from "./fishingfx.ts";
import { createIsland } from "./island.ts";
import { appCss } from "./cssfiles.ts";

const root = process.cwd();
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const game = code("src/components/FishingGame.tsx");
const st = (over: Partial<FishStanding>): FishStanding => ({ rank: 12, score: 100, total: 40, gap_up: 30, partner_name: null, partner_score: 0, ...over });
const DAY = "2026-11-02";
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };

test("공개 뜸 — 귀할수록 길다 · 흔함은 짧고 태초는 2초 안팎 · 움직임 줄이기면 짧다", () => {
  assert.ok(revealMs(0, false) <= 500);
  assert.ok(revealMs(7, false) >= 1800 && revealMs(7, false) <= 2200);
  for (let g = 1; g < 8; g++) assert.ok(revealMs(g, false) > revealMs(g - 1, false));
  assert.ok(revealMs(7, true) <= 400);
});

test("공개 흐름 — 끌어올리면 실루엣이 먼저, 뜸 뒤에 공개 · 꽝도 같은 뜸(물고기 실루엣)을 들인다", () => {
  assert.match(game, /setPhase\("reveal"\)/);
  assert.match(game, /revealMs\(/);
  assert.ok(game.indexOf('setPhase("reveal")') < game.indexOf("fxRef.current?.junked()"), "꽝은 뜸 뒤에");
  assert.match(game, /fish\.junk && phase !== "reveal"/, "뜸 동안은 쓰레기도 물고기로 보인다");
  assert.match(game, /fish-new/);
  const css = appCss();
  assert.match(css, /\.fish-card\.is-reveal \.fish-card-pic \{[^}]*brightness\(0\)/);
});

test("연출 — land 를 잡아 두면 빛이 안 켜지고, reveal 에서 등급만큼 터진다", () => {
  const canvas: FxCanvas = { width: 0, height: 0, getContext: () => null };
  const fx = new FishFx(canvas);
  fx.resize(360, 600, 1);
  fx.land(7, true);
  assert.equal(fx.counts().rays, 0);
  fx.reveal(7);
  const high = fx.counts();
  assert.ok(high.rays > 0.8 && high.drops > 0);
  const low = new FishFx(canvas);
  low.resize(360, 600, 1);
  low.reveal(0);
  assert.ok(low.counts().rays < high.rays && low.counts().drops < high.drops);
  low.set({ phase: "reveal" });
  low.frame(16);
});

test("처음 만난 물고기 — 끌어올리면 기록된다(담기 · 놓침 · 팔기) · 옛 저장분도 돈다", () => {
  const s0 = { ...createIsland("콩", null, 0), coins: 0 };
  assert.deepEqual(fishingOf(s0).seen, []);
  const sold = sellCatch(s0, guppy, DAY);
  assert.ok(sold.ok);
  if (!sold.ok) return;
  assert.deepEqual(fishingOf(sold.state).seen, ["fry_guppy"]);
  const again = sellCatch(sold.state, guppy, DAY);
  assert.ok(again.ok && fishingOf(again.state).seen.length === 1, "중복 없음");
  const slip = tryStore(s0, guppy, 0, 0.5, 1, DAY);
  assert.ok(slip.ok && fishingOf(slip.state).seen.length === 1);
  const won = tryStore(s0, guppy, 1, 0, 1, DAY);
  assert.ok(won.ok && fishingOf(won.state).seen.length === 1);
});

test("순위 한 줄 — 올랐을 때 · 상대를 제쳤을 때 · 첫 등록 · 그대로일 때 · 1위 · 정보 없음", () => {
  assert.equal(rankLine(st({ rank: 12 }), st({ rank: 9 })), "이번 달 12위 → 9위");
  assert.equal(rankLine(st({ rank: null, score: 0 }), st({ rank: 30 })), "이번 달 30위로 올랐어요");
  assert.equal(rankLine(null, st({ rank: 30 })), "이번 달 30위");
  assert.equal(rankLine(st({ rank: 12 }), st({ rank: 12, gap_up: 30 })), "이번 달 12위 · 11위까지 30점");
  assert.equal(rankLine(st({ rank: 1, gap_up: null }), st({ rank: 1, gap_up: null })), "이번 달 1위를 지키고 있어요");
  assert.equal(rankLine(st({}), st({ rank: null })), null);
  const before = st({ score: 90, partner_name: "짝꿍", partner_score: 100 });
  const after = st({ score: 110, partner_name: "짝꿍", partner_score: 100 });
  assert.equal(rankLine(before, after), "짝꿍 님을 제쳤어요!");
  assert.equal(rankLine(after, { ...after, score: 120 }), "이번 달 12위 · 11위까지 30점", "이미 앞서면 또 축하하지 않는다");
});

test("던질 힘 게이지가 없다 — 누르면 바로 던진다", () => {
  assert.doesNotMatch(game, /castBonus|CAST_SWEET|fish-cast|castNote/);
  assert.doesNotMatch(code("src/lib/fishing.ts"), /castBonus|CAST_SWEET/);
  assert.doesNotMatch(appCss(), /\.fish-cast/);
});

test("첫 화면은 장면 + 한 줄 — 낚시터 · 방식 · 미끼 · 레벨은 시트 안에 · 시트를 못 열면 고를 수 없다", () => {
  const sheet = game.slice(game.indexOf('className="fish-sheet"'));
  for (const c of ["fish-spots", "fish-methods", "fish-baits", "fish-xp"]) {
    assert.ok(sheet.includes(c), `${c} 는 시트 안`);
    assert.ok(game.indexOf(c) > game.indexOf('className="fish-sheet"'), `${c} 가 시트 밖에 남았다`);
  }
  assert.match(game, /fish-loadout/);
  assert.match(game, /setSheetOpen\(true\)/);
  const css = appCss();
  assert.match(css, /\.fish-scene \{[^}]*100dvh/, "장면이 화면 높이를 채운다");
  assert.match(game, /currentBait\(fs, spot, baitPick/, "미끼가 떨어지면 쓸 수 있는 미끼로 넘어간다");
});

test("팔기는 작게 — 담을 수 있으면 주 버튼은 담기 하나 · 못 담으면 팔기가 주 버튼", () => {
  assert.match(game, /fish-choice-sell/);
});

test("서버 — 순위 함수는 로그인한 사람만 · user_id 를 안 돌려준다 · schema.sql 복사본", () => {
  const sql = readFileSync(join(root, "supabase/migrations/20261102010000_fish_standing.sql"), "utf8").replace(/\r\n/g, "\n");
  const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(schema.includes(sql.trim()));
  assert.match(sql, /returns table \(rank integer, score bigint, total integer, gap_up bigint, partner_name text, partner_score bigint\)/);
  assert.match(sql, /revoke all on function public\.fish_standing\(\) from public, anon/);
});
