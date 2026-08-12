// 떠다니는 미니 펫 + 장비 칩 회귀 lock. [사용자 리포트 2026-08-12
// "장비류가 너무 많은 칸을 차지해" + "액션했을 때 히어로 행동을 보지 못해서 재미가 없어
//  — 팝업 형태로 계속 따라다니게"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "components", "IslandGame.tsx"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("미니 펫 — 무대가 안 보일 때 뜨고, 케어 연출을 같이 재생한다 [회귀 lock]", () => {
  // 스크롤 리스너가 아니라 IntersectionObserver(비용 0에 가깝다)
  assert.ok(code.includes("IntersectionObserver"), "무대 가시성 관찰이 사라졌다");
  assert.ok(/ref=\{stageRef\}/.test(code), "무대에 ref 가 없다 — 관찰할 대상이 없다");
  assert.ok(/!stageVis/.test(code), "무대가 보일 땐 팝업이 없어야 한다(이중 펫 금지)");
  // 케어 연출 축소 재생 — 액션을 눌렀을 때 반응이 눈앞에서 터지는 게 이 기능의 존재 이유
  assert.ok(/careFx && \(/.test(code) && code.includes("petFx(careFx.kind).props"), "팝업이 케어 연출을 재생하지 않는다");
  // 탭하면 무대로 — 팝업은 문이기도 하다
  assert.ok(code.includes("scrollIntoView"), "팝업 탭 → 무대 복귀가 없다");
  // ⚠ 하단 고정은 --vv-bottom 경유(삼성 인터넷 주소창 회피 — BottomNav 와 같은 규약)
  assert.ok(/var\(--vv-bottom/.test(code), "팝업이 bottom:0 기준이면 삼성에서 주소창 뒤에 숨는다");
});

test("장비 칩 — 카드 그리드로 되돌아가지 않는다 [회귀 lock]", () => {
  // 예전 3열 카드(이름+퍽+상태 4줄)는 15종이면 화면 한 장을 다 먹었다.
  // 가로 스크롤 칩(shrink-0) + 슬롯 헤더에 퍽 축 1회 표기가 계약이다.
  const gear = /GEAR_SLOTS\.map[\s\S]{0,2400}/.exec(code)?.[0] ?? "";
  assert.ok(gear.includes("overflow-x-auto"), "장비 줄이 가로 스크롤이 아니다");
  assert.ok(gear.includes("shrink-0"), "칩이 줄어들면 이름이 뭉갠다(flex min-width 규약)");
  assert.ok(!/grid-cols-3[\s\S]{0,400}GEARS\.filter/.test(gear), "3열 카드 그리드가 되살아났다");
  // 잠긴 이유는 계속 보인다(골드비료 사고 규약) — 축소가 정보 삭제가 되면 안 된다
  assert.ok(gear.includes("gearLockReason"), "잠긴 이유 표시가 사라졌다");
});
