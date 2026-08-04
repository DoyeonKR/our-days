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
  // ⚠ 컴포넌트 **이름**이 아니라 **소품 정체성**을 잠근다 — 2026-08-03 픽셀 전환에서 렌더가
  //    WorldProp(kind=…) 단일 진입점을 타게 바뀌었다. 그건 회귀가 아니라 의도된 경로 변경이다.
  assert.ok(/(<PhotoCard|kind="photocard")/.test(page), "오늘의 우리 = 폴라로이드 소품");
  assert.ok(/(<Signpost|kind="signpost")/.test(page), "기념일 = 표지판 소품(월드 표지판의 목적지)");
  // 옛 eyebrow 텍스트 헤더 부활 금지
  assert.ok(!page.includes('className="eyebrow mb-2 mt-8 px-1">오늘의 우리'), "eyebrow 오늘의 우리 금지");
  assert.ok(!/<h2 className="eyebrow">다가오는 기념일<\/h2>/.test(page), "eyebrow 기념일 금지");
});

test("홈 하단 — 우편함/러브레터/모닥불 세계관 [회귀 lock]", () => {
  // CoupleSync = 월드 우편함의 목적지(같은 소품)
  assert.ok(/(<Mailbox|kind="mailbox")/.test(sync), "커플 연동 헤더에 우편함 소품");
  assert.ok(sync.includes("우리의 우편함"), "우편함 아이덴티티 타이틀");
  assert.ok(!sync.includes('text-ink">커플 연동</h2>'), "옛 플레인 h2 금지");
  // DailyQuestion = 러브레터 배달
  assert.ok(/(<LoveLetter|kind="loveletter")/.test(dq), "오늘의 질문에 러브레터 소품");
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

test("하단 nav — 표면이 완전 불투명(피드 글씨 투과 금지) [회귀 lock 2026-07-28 / 2026-08-03 갱신]", () => {
  // 원래 사고: 사용자 "메뉴와 텍스트가 겹쳐". 당시 원인은 .glass 의 backdrop-blur 가 빌드에서
  // 탈락(Lightning CSS 병합) + nav 표면이 반투명이라 피드 글씨가 비친 것이었다.
  //
  // [2026-08-03 픽셀 톤 전환] 블러를 아예 없앴다. 지켜야 할 **계약은 "투과 금지"** 이지
  // "블러가 있을 것"이 아니다. 이제 표면 토큰이 알파 0 실색이라 투과가 **물리적으로 불가능**하다
  // — 블러보다 강한 보증이므로, 검사도 그 계약(불투명)으로 바꾼다.
  const css = readFileSync(join(here, "../app/globals.css"), "utf8");
  const navValues = [...css.matchAll(/--surface-nav:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.equal(navValues.length, 2, "--surface-nav 라이트+다크 2곳 정의");
  for (const v of navValues) {
    assert.ok(
      /^#[0-9a-f]{6}$/i.test(v),
      `--surface-nav 는 알파 없는 실색이어야 한다(투과 원천 차단) — 발견: ${v}`,
    );
  }
  // 블러가 되살아나면 픽셀 톤이 깨지고 저사양 성능도 되돌아간다.
  // ⚠ 주석은 제외한다 — 왜 없앴는지 적어둔 설명문까지 위반으로 잡으면 기록을 못 남긴다.
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/backdrop-blur|backdrop-filter/.test(cssCode), "globals.css: backdrop blur 부활 금지");
  assert.ok(!/backdrop-blur/.test(page), "page.tsx: backdrop blur 클래스 부활 금지");
  // ⚠ 클래스 **순서**를 고정하지 않는다 — 2026-08-04 에 .ui-sans(비-픽셀 라벨 서체)가 앞에
  //    붙으면서 정확 일치가 깨졌다. 지켜야 할 계약은 'nav 가 --surface-nav 를 쓴다' 하나다.
  assert.ok(/<nav className="[^"]*\bglass\b[^"]*\bfixed bottom-0/.test(page), "하단 nav 는 glass + fixed bottom-0");
  assert.ok(page.includes("bg-[var(--surface-nav)]"), "nav 는 --surface-nav 사용(bg-surface 회귀 금지)");
  // nav 라벨 래핑 방어(폰트 확대 시 nav 세로 성장 → 콘텐츠 침범 차단)
  // ⚠ 크기 클래스는 고정하지 않는다 — 픽셀 폰트 전환(2026-08-03)에서 임의 크기(text-[11px])가
  //    격자 토큰(text-sm)으로 바뀌었다. 지켜야 할 계약은 **줄바꿈 금지** 하나다.
  assert.ok(/whitespace-nowrap text-(sm|xs|\[)/.test(page), "nav 라벨 whitespace-nowrap");
  // 설치 배너는 nav 실높이(68.5px) 위에 떠야 함 — 64px 매직넘버 회귀 금지
  const install = readFileSync(join(here, "InstallPrompt.tsx"), "utf8");
  assert.ok(install.includes("safe-area-inset-bottom)+76px"), "설치 배너 offset 76px(nav 68.5 + 여유)");
  assert.ok(!install.includes("+64px"), "옛 64px offset 부활 금지(nav 상단 4.5px 침범)");
});

test("월드 무대 — 펫 이름 행이 좌우 오브젝트 메뉴와 안 겹침 [회귀 lock 2026-07-28]", () => {
  // 사용자: "메인피드 하단에 메뉴와 텍스트가 겹쳐". 원인: hero 이름 행이 w-full + '우리 섬 →'
  // 칩 ml-auto(우측 끝) → 같은 높이의 나룻배/벤치 WorldProp(z-30)와 정확히 겹침.
  // 수정: hero 는 중앙 컴팩트 필(mx-auto w-fit max-w). 이 회귀를 소스로 잠근다.
  const pet = readFileSync(join(here, "island/HomePet.tsx"), "utf8");
  assert.ok(/hero[\s\S]{0,200}mx-auto[\s\S]{0,80}w-fit[\s\S]{0,80}max-w-\[58%\]/.test(pet), "hero 이름 행 = 중앙 필");
  // '우리 섬 →' 칩이 hero 에서 ml-auto(우측 끝)로 돌아가는 회귀 금지
  assert.ok(/\$\{\s*hero \? "" : "ml-auto"\s*\}/.test(pet), "hero 에선 ml-auto 금지(우측 끝 = 벤치 메뉴 자리)");
});
