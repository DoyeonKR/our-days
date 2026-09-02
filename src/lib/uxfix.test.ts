// [사용자 요청 2026-09-01] 세 가지 lock — 줌 차단 · 히어로 개명 · 연타 성능.
//
//   "키보드 올리고 핀치아웃 인 줌 기능하면 ui가 다 꺠져 막아줘 어느 브라우저에서도"
//   "히어로 이름 변경할 수 있게 해줘 상시는 말고 하트 소비해서 한 2000정도"
//   "지금 성능이 매우느려 … 물주기나 비료, 사료 구매 등 연속으로 구매할때 어려움이 있어"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TUNING, createIsland, renamePet, type IslandState } from "./island.ts";

const SRC = join(import.meta.dirname, "..");
/** ⚠ 주석을 먼저 지운다 — 이 저장소는 '왜'를 주석에 길게 쓴다(hscroll.test 에서 겪은 사고). */
const strip = (p: string) =>
  readFileSync(join(SRC, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/[^\n]*$/gm, "");

const T = Date.UTC(2026, 8, 1, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T);

// ── 1. 줌 차단 ─────────────────────────────────────────────────

test("★★ 줌 차단은 메타 **와** JS 둘 다여야 한다 — 한쪽만이면 한 진영이 뚫린다", () => {
  const layout = strip("app/layout.tsx");
  // 메타: 안드로이드 크롬·삼성 인터넷 쪽
  assert.ok(/maximumScale:\s*1\b/.test(layout), "viewport 에 maximumScale 이 없다");
  assert.ok(/userScalable:\s*false/.test(layout), "viewport 에 userScalable:false 가 없다");
  // JS: iOS Safari 는 iOS 10 부터 user-scalable=no 를 **무시한다**
  assert.ok(/<ZoomLock\s*\/>/.test(layout), "ZoomLock 이 마운트돼 있지 않다 — iOS 에서 안 막힌다");
  assert.ok(/from "@\/components\/ZoomLock"/.test(layout), "ZoomLock import 가 없다");
});

test("★ ZoomLock 이 iOS 경로(gesture·멀티터치·더블탭)를 모두 막는다", () => {
  const z = strip("components/ZoomLock.tsx");
  for (const ev of ["gesturestart", "gesturechange", "gestureend", "touchmove", "touchend"]) {
    assert.ok(z.includes(ev), `ZoomLock 이 ${ev} 를 안 막는다`);
  }
  // passive:false 가 아니면 preventDefault 가 무시된다 — 있으나 마나가 된다
  assert.ok(/passive:\s*false/.test(z), "passive:false 가 없다 — preventDefault 가 안 먹는다");
});

// ── 2. 히어로 개명 ─────────────────────────────────────────────

test("★ 개명은 하트를 쓴다 — 공짜 상시 개명이면 이름이 가벼워진다", () => {
  assert.equal(TUNING.pet.renameCost, 2000);
  const s = fresh();
  s.coins = 5000;
  const a = renamePet(s, "무등이", T);
  assert.equal(a.pet.name, "무등이");
  assert.equal(a.coins, 5000 - 2000, "하트가 안 빠졌다");
  assert.notEqual(a, s, "새 상태를 안 돌려줬다");
});

test("★★ 못 하는 경우는 **원본 참조 그대로** — 커밋 경로가 헛돌면 안 된다", () => {
  // act() 는 `next === cur` 이면 커밋을 건너뛴다. 여기서 새 객체를 돌려주면
  // 코인이 모자란데도 버전이 오르고 거짓 충돌이 난다.
  const s = fresh();
  s.coins = 100; // 부족
  assert.equal(renamePet(s, "무등이", T), s, "코인 부족인데 새 상태를 돌려준다");
  s.coins = 5000;
  assert.equal(renamePet(s, s.pet.name, T), s, "같은 이름인데 새 상태를 돌려준다");
  assert.equal(renamePet(s, "   ", T), s, "공백 이름인데 새 상태를 돌려준다");
});

test("★ 이름 길이 상한이 있고 앞뒤 공백은 잘린다", () => {
  const s = fresh();
  s.coins = 5000;
  const long = "가".repeat(TUNING.pet.nameMax + 10);
  assert.equal(renamePet(s, long, T).pet.name.length, TUNING.pet.nameMax);
  assert.equal(renamePet(s, "  무등이  ", T).pet.name, "무등이");
});

test("★ 개명은 진화형·기록을 안 건드린다 — 이름만 바뀐다", () => {
  const s = fresh();
  s.coins = 5000;
  s.pet.form = "royal_cat";
  s.pet.careXp = 9000;
  const a = renamePet(s, "새이름", T);
  assert.equal(a.pet.form, "royal_cat");
  assert.equal(a.pet.careXp, 9000);
  assert.deepEqual(a.museum, s.museum);
});

// ── 3. 연타 성능 ───────────────────────────────────────────────

test("★★★ 액션이 서버 왕복을 기다리지 않는다 — 연타가 버려지면 안 된다", () => {
  // 예전 경로: 액션마다 `setBusy(true)` → `await pushState` → 그동안 누른 탭은
  // `if (!row || busy) return false` 로 **버려졌다**. 물주기·비료 연타가 안 되던 이유.
  const g = strip("components/IslandGame.tsx");
  // 낙관적 로컬 상태가 있고 화면이 그걸 먼저 본다
  assert.ok(/const s: IslandState \| null = draft \?\? row\?\.state/.test(g), "화면이 draft 를 먼저 보지 않는다");
  assert.ok(/draftRef\.current = next/.test(g), "액션이 draft 에 즉시 반영되지 않는다");
  // commit 이 더 이상 await 로 화면을 잠그지 않는다
  assert.ok(
    !/const ok = await pushState\(row\.version, next\)/.test(g),
    "commit 이 아직 서버 왕복을 await 한다 — 화면이 잠긴다",
  );
  assert.ok(!/if \(!row \|\| busy\) return false/.test(g), "busy 일 때 액션을 버리는 가드가 남아 있다");
});

test("★★ 못 보낸 draft 를 화면 떠날 때 반드시 내보낸다", () => {
  const g = strip("components/IslandGame.tsx");
  assert.ok(/visibilitychange/.test(g), "백그라운드 전환에서 flush 하지 않는다");
  assert.ok(/if \(draftRef\.current\) void flush\(\)/.test(g), "언마운트에서 flush 하지 않는다");
});

test("★★ draft 가 남아 있는 동안 구독이 row 를 갈아끼우지 않는다", () => {
  // 버전만 새로 받으면 우리 draft 가 상대 변경을 조용히 덮어쓴다.
  // 충돌로 드러나 재동기화되는 편이 안전하다(낙관적 커밋 도입 전과 같은 결과).
  const g = strip("components/IslandGame.tsx");
  assert.ok(/if \(draftRef\.current\) return;/.test(g), "구독 로드가 draft 를 보호하지 않는다");
});

test("★ 스테이지 분모를 손으로 적지 않는다 — '스테이지 5/4' 재발 방지", () => {
  const g = strip("components/IslandGame.tsx");
  assert.ok(!/스테이지 \{stage\}\/4/.test(g), "분모가 4 로 하드코딩돼 있다");
  assert.ok(/MAX_PET_STAGE/.test(g), "표에서 파생한 분모(MAX_PET_STAGE)를 안 쓴다");
});
