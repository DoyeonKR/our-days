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

test("장비 — 돌봄 흐름을 차지하지 않는다 · 한 번에 한 칸만 · 잠긴 이유는 다 보인다 [회귀 lock]", () => {
  // 2026-08-12 "장비류들이 너무 많은 칸을 차지해" — 그때는 장비 15종이 펫 카드 **안**(스탯과 케어 데크
  // 사이)에 있어서, 줄여도 케어 데크를 아래로 밀었다. 2026-09-24 개편으로 장비는 자기 칸(장비)으로
  // 옮겨 갔다: 돌봄 칸엔 장비 목록이 없고, 장비 칸은 한 번에 한 슬롯(5종)만 펼친다.
  const panels = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetPanels.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.ok(/petView === "gear" && \(\s*<GearView/.test(code), "장비 목록이 장비 칸 밖에도 그려진다");
  const care = code.slice(code.indexOf('petView === "care"'), code.indexOf('petView === "gear"'));
  assert.ok(!care.includes("GEARS.filter"), "돌봄 칸에 장비 목록이 들어왔다 — 케어 데크를 다시 밀어낸다");
  assert.ok(/GEARS\.filter\(\(g\) => g\.slot === slot\)/.test(panels), "장비 칸이 한 슬롯씩 펼치지 않는다");
  // 잠긴 이유는 **잘리지 않고** 보인다 — 예전 칩은 '히어…' 에서 잘려 이유를 못 읽었다
  const lock = /\{lock && <p[^>]*>/.exec(panels)?.[0] ?? "";
  assert.ok(panels.includes("gearLockReason"), "잠긴 이유 표시가 사라졌다");
  assert.ok(lock && !lock.includes("truncate"), "잠긴 이유가 한 줄로 잘린다");
});
