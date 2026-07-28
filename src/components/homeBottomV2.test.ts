// 홈 하단 V2 회귀 lock. [2026-07-27]
// 사용자: "최상단 피드만 개선되어 있고 홈 하단은 V2 처럼 변경되지 않았어" → 하단 섹션
// (오늘의 우리/오늘의 질문/기념일/우리 현황/커플 연동)을 월드(상단 씬)와 같은 세계로 개편.
// 문법: world.tsx 소품 + WorldSectionHead(시간대 억양 밑줄). 이 테스트가 막는 회귀:
// (1) eyebrow 텍스트 헤더로 되돌아가는 것, (2) 소품/헤더 문법이 끊기는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../app/page.tsx"), "utf8");
const head = readFileSync(join(here, "WorldSectionHead.tsx"), "utf8");
const world = readFileSync(join(here, "island/art/world.tsx"), "utf8");
const dq = readFileSync(join(here, "DailyQuestion.tsx"), "utf8");
const sync = readFileSync(join(here, "CoupleSync.tsx"), "utf8");
const act = readFileSync(join(here, "CoupleActivity.tsx"), "utf8");

test("홈 하단 — 월드 소품 헤더(WorldSectionHead) 문법 사용 [회귀 lock]", () => {
  // 공용 헤더가 시간대 억양(scenetime)을 따른다 — 상단 하늘과 같은 세계
  assert.ok(head.includes("skyLook"), "WorldSectionHead 는 scenetime 팔레트 사용");
  assert.ok(head.includes("useSkyAccent"), "시간대 억양 훅");
  // page: 오늘의 우리(폴라로이드) + 기념일(표지판) 헤더
  assert.ok(page.includes("<WorldSectionHead"), "page 가 V2 헤더 사용");
  assert.ok(page.includes("<PhotoCard"), "오늘의 우리 = 폴라로이드 소품");
  assert.ok(page.includes("<Signpost"), "기념일 = 표지판 소품(월드 표지판의 목적지)");
  // 옛 eyebrow 텍스트 헤더 부활 금지
  assert.ok(!page.includes('className="eyebrow mb-2 mt-8 px-1">오늘의 우리'), "eyebrow 오늘의 우리 금지");
  assert.ok(!/<h2 className="eyebrow">다가오는 기념일<\/h2>/.test(page), "eyebrow 기념일 금지");
});

test("홈 하단 — 우편함/러브레터/모닥불 세계관 [회귀 lock]", () => {
  // CoupleSync = 월드 우편함의 목적지(같은 소품)
  assert.ok(sync.includes("<Mailbox"), "커플 연동 헤더에 우편함 소품");
  assert.ok(sync.includes("우리의 우편함"), "우편함 아이덴티티 타이틀");
  assert.ok(!sync.includes('text-ink">커플 연동</h2>'), "옛 플레인 h2 금지");
  // DailyQuestion = 러브레터 배달
  assert.ok(dq.includes("<LoveLetter"), "오늘의 질문에 러브레터 소품");
  assert.ok(dq.includes("도착했어요"), "질문 배달 카피");
  // CoupleActivity = 모닥불(스트릭)
  assert.ok(act.includes("모닥불"), "스트릭 = 모닥불 카피");
  assert.ok(act.includes("radial-gradient"), "모닥불 잔광 글로우");
});

test("world 소품 — 폴라로이드/러브레터 추가 + 계약 준수 [회귀 lock]", () => {
  for (const sym of ["export function PhotoCard", "export function LoveLetter"]) {
    assert.ok(world.includes(sym), `world.tsx 에 ${sym} 필요`);
  }
  // 소품 파일 계약: 그라데이션 금지(다중 렌더 안전) — 신규 소품이 어기지 않게
  assert.ok(!/linearGradient|radialGradient/.test(world), "world 소품은 그라데이션 금지(useId 불필요 계약)");
});
