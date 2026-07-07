// 순위판 TOP N 노출/등록 게이트 회귀 lock. [2026-07-06]
// 사용자: "순위표는 5위까지만 노출되고 등록가능하게". 순위판은 상위 N명만 보이고, 실제 TOP N 에
// 든 최고기록일 때만 축하/등록 팝업이 떠야 한다(개인 최고기록만으로 뜨면 6위인데 "순위판 반영"
// 오표시). 게이트가 풀리면 회귀 → 소스로 lock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LEADERBOARD_TOP_N } from "../lib/game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "GameArcade.tsx"), "utf8");

test("순위판 TOP N: 상수=5 + 조회/등록이 TOP N 게이트 [회귀 lock]", () => {
  assert.equal(LEADERBOARD_TOP_N, 5);
  // 순위판 조회를 LEADERBOARD_TOP_N 개로 제한(20 하드코딩/무제한 금지)
  assert.match(src, /listLeaderboard\([^;]*LEADERBOARD_TOP_N/);
  // 축하/등록 팝업은 rank<=LEADERBOARD_TOP_N 일 때만
  assert.match(src, /res\.isBest && res\.rank <= LEADERBOARD_TOP_N/);
  // 개인 최고기록만으로(rank 무관) 팝업 뜨는 옛 분기 부활 금지
  assert.ok(
    !src.includes("if (res.isBest) {"),
    "축하 팝업이 rank 게이트 없이 isBest 만으로 뜨면 안 됨(TOP N 밖 오표시)",
  );
});

test("순위판 닉네임은 커플 아이디로 고정 — 한마디만 커스텀 [회귀 lock 2026-07-07]", () => {
  // 사용자: "랭킹등록 닉네임은 커플 생성 아이디로만, 한마디만 커스텀". 닉네임 입력창 재도입 금지.
  assert.ok(
    !src.includes('placeholder="순위판 이름 (닉네임)"'),
    "축하 팝업에 닉네임 입력창이 다시 생기면 안 됨(닉네임은 커플 아이디로 고정)",
  );
  assert.ok(!src.includes("setCName"), "cName 상태(사용자 닉네임 입력) 부활 금지");
  // 등록은 myName(커플 아이디)을 display_name 으로 강제 — 사용자 입력 이름을 쓰면 안 됨
  assert.match(
    src,
    /updateMyRank\(celebrate\.game, myName \|\| "익명", cMsg\)/,
    "닉네임은 myName(커플 아이디) 고정, 한마디(cMsg)만 커스텀",
  );
});
