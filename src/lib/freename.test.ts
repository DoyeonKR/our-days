// 새 알 첫 이름 무료 lock. [2026-09-23 게임 리뷰]
//
// 은퇴하면 새 알은 늘 "새 친구"로 태어나고, 이름을 지으려면 개명과 똑같이 하트 2,000 이 들었다 —
// 갓 태어난 아이 이름값을 받는 셈이었다. 첫 이름만 무료로 하고 **동의 절차는 그대로** 둔다
// (둘의 펫이다 — 개명 동의는 사용자가 직접 요청한 규칙이다).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TUNING,
  createIsland,
  renameAccept,
  renameCostOf,
  renamePet,
  renameProposeName,
  retirePet,
  type IslandState,
} from "./island.ts";

const T = Date.UTC(2026, 8, 23, 3, 0, 0);
function retired(coins = 0): IslandState {
  const s = createIsland("콩", null, T);
  s.pet.form = "royal_cat";
  s.coins = coins;
  return retirePet(s, "새 친구", T);
}

test("은퇴로 태어난 알의 첫 이름은 무료다 — 하트가 0 이어도 지을 수 있다", () => {
  const s = retired(0);
  assert.equal(renameCostOf(s), 0);
  const named = renamePet(s, "보리", T + 1000);
  assert.equal(named.pet.name, "보리", "하트 0 이면 첫 이름도 못 짓는다");
  assert.equal(named.coins, 0, "무료인데 하트가 빠졌다");
});

test("무료는 첫 이름 한 번뿐 — 그다음부터는 원래 값", () => {
  const s = renamePet(retired(5000), "보리", T + 1000);
  assert.equal(renameCostOf(s), TUNING.pet.renameCost);
  const again = renamePet(s, "보리보리", T + 2000);
  assert.equal(again.coins, 5000 - TUNING.pet.renameCost);
});

test("기존 펫(표시 없음)은 영향이 없다 — 무마이그레이션", () => {
  const s = createIsland("콩", null, T);
  assert.equal(renameCostOf(s), TUNING.pet.renameCost, "처음부터 이름을 받고 만든 펫까지 무료가 됐다");
});

test("커플이면 첫 이름도 **상대 동의**를 거친다 — 무료여도 절차는 그대로", () => {
  const s = retired(0);
  const proposed = renameProposeName(s, "me", "보리", T + 1000);
  assert.equal(proposed.pet.name, "새 친구", "제안만으로 이름이 바뀌었다");
  assert.equal(renameAccept(proposed, "me", T + 2000).pet.name, "새 친구", "제안한 사람이 스스로 수락했다");
  const ok = renameAccept(proposed, "partner", T + 2000);
  assert.equal(ok.pet.name, "보리");
  assert.equal(ok.coins, 0, "무료 첫 이름인데 수락 때 하트가 빠졌다");
});

test("보글보글 — 창을 떠나면 누르던 키가 풀린다 [소스 스캔]", async () => {
  // keyup 만 들으면 알트탭 중에 뗀 키의 keyup 이 다른 창으로 가서 히어로가 혼자 계속 달린다.
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(import.meta.dirname, "..", "components", "BubbleGame.tsx"), "utf8");
  assert.match(src, /addEventListener\("blur", release\)/, "blur 에서 입력을 안 푼다");
  assert.match(src, /visibilitychange/, "탭이 숨겨질 때 입력을 안 푼다");
});
