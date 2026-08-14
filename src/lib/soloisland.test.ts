// 솔로 섬 회귀 lock. [사용자 리포트 2026-08-12 "혼자서라도 할 수 있는게 있었으면 좋겠어"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, feedPet } from "./island.ts";

// node 에는 localStorage 가 없다 — 심플 심(테스트 전용)
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const T = Date.UTC(2026, 7, 12, 3, 0, 0);

test("솔로 섬 — 저장/로드/버전 증가가 서버 계약과 같은 모양이다", async () => {
  const { getSoloIsland, saveSoloIsland, clearSoloIsland, SOLO_ID } = await import("./soloisland.ts");
  clearSoloIsland();
  assert.equal(getSoloIsland(), null, "처음엔 섬이 없다");
  const s0 = createIsland("혼자", null, T);
  const r1 = saveSoloIsland(s0);
  assert.equal(r1.version, 1);
  assert.equal(r1.couple_id, SOLO_ID);
  // 케어 액션 → 저장 → 버전 증가 + 상태 반영(엔진은 저장소를 모른다)
  const s1 = feedPet(r1.state, T + 3600_000);
  const r2 = saveSoloIsland(s1);
  assert.equal(r2.version, 2, "저장마다 버전이 는다(서버 낙관적 락과 같은 봉투)");
  assert.equal(getSoloIsland()!.state.pet.careXp, s1.pet.careXp, "로드가 저장을 돌려준다");
  clearSoloIsland();
  assert.equal(getSoloIsland(), null);
});

test("배선 — 화면은 라우팅 함수만 쓰고, 연동 승격이 존재한다 [회귀 lock]", () => {
  const root = join(import.meta.dirname, "..");
  const read = (p: string) =>
    readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  // 화면 5곳: 서버 전용 함수를 직접 부르면 솔로가 다시 죽는다 → loadIsland/saveIsland/watchIsland 만
  for (const f of [
    "components/IslandGame.tsx",
    "components/HuntGame.tsx",
    "components/BubbleGame.tsx",
    "components/GameArcade.tsx",
    "components/island/HomePet.tsx",
  ]) {
    const src = read(f);
    assert.ok(!/\bgetIsland\s*\(/.test(src), `${f}: getIsland 직접 호출 — 솔로가 안 돈다`);
    assert.ok(!/\bcommitIslandAction\s*\(/.test(src), `${f}: commitIslandAction 직접 호출`);
    assert.ok(!/\bsubscribeIsland\s*\(/.test(src), `${f}: subscribeIsland 직접 호출`);
  }
  // 승격 — 연동했다고 혼자 키운 알이 사라지면 그건 벌이다
  const couple = read("lib/couple.ts");
  assert.ok(/createIsland\(solo\.state\)/.test(couple), "연동 시 로컬 섬 승격이 사라졌다");
  assert.ok(
    couple.indexOf("clearSoloIsland()") > couple.indexOf("createIsland(solo.state)"),
    "로컬 삭제는 서버 생성 **확인 뒤** — 순서가 뒤집히면 실패 시 섬이 증발한다",
  );
  // 게임 탭 잠금 카드 부활 금지
  const arcade = read("components/GameArcade.tsx");
  assert.ok(!arcade.includes("커플 연결 후에 열려요"), "게임 탭이 다시 커플 게이트로 잠겼다");
});
