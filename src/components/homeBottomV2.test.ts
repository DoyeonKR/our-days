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
  // GNB 는 BottomNav.tsx 로 분리했다(2026-08-05 — 로그인 뒤 화면이라 프로브로 재려고).
  // 계약은 그대로이고 **보는 파일만** 옮겼다.
  const navSrc = readFileSync(join(import.meta.dirname, "BottomNav.tsx"), "utf8");
  // ⚠ **속성 순서**도 고정하지 않는다 — 2026-08-05 에 style 이 className 앞에 붙으면서
  //    `<nav className="..."` 정확 일치가 깨졌다. <nav ...> 태그 안의 className 만 꺼낸다.
  const navTag = /<nav\b[\s\S]*?>/.exec(navSrc)?.[0] ?? "";
  const navCls = /className="([^"]*)"/.exec(navTag)?.[1] ?? "";
  assert.ok(navCls, "하단 nav 를 찾지 못했다 (BottomNav.tsx)");
  for (const c of ["glass", "fixed"]) {
    assert.ok(new RegExp(`\\b${c}\\b`).test(navCls), `하단 nav 에 ${c} 가 있어야 한다`);
  }
  // 아래 붙임은 bottom-0 또는 --vv-bottom(브라우저 툴바 회피, 2026-08-05) 둘 중 하나.
  assert.ok(
    /\bbottom-0\b/.test(navCls) || /var\(--vv-bottom/.test(navTag),
    `하단 nav 가 화면 아래에 붙지 않는다: ${navTag.slice(0, 120)}`,
  );
  assert.ok(navSrc.includes("bg-[var(--surface-nav)]"), "nav 는 --surface-nav 사용(bg-surface 회귀 금지)");
  // ★ 모바일 가로 스크롤 회귀 금지 [사용자 리포트 2026-08-04]
  //   `fixed + left-1/2 + w-full + -translate-x-1/2` 는 변환 **전** 박스가 50vw~150vw 라,
  //   fixed 요소를 문서 스크롤 폭에 넣는 모바일 엔진에서 좌우 스크롤이 생긴다.
  //   중앙 정렬은 변환 없는 inset-x-0 + mx-auto 로 한다.
  assert.ok(
    !(/\bleft-1\/2\b/.test(navCls) && /-translate-x-1\/2/.test(navCls)),
    `하단 nav 가 변환 중앙정렬로 되돌아갔다(모바일 가로 스크롤 유발): ${navCls}`,
  );
  assert.ok(/\binset-x-0\b/.test(navCls) && /\bmx-auto\b/.test(navCls), "nav 중앙 정렬 = inset-x-0 + mx-auto");
  // nav 라벨 래핑 방어(폰트 확대 시 nav 세로 성장 → 콘텐츠 침범 차단)
  // ⚠ 크기 클래스도, **유틸 이름도** 고정하지 않는다. 지켜야 할 계약은 '줄바꿈 금지' 하나다.
  //    2026-08-05: whitespace-nowrap → truncate 로 바꿨다. truncate 는 nowrap 을 포함하면서
  //    overflow:hidden 까지 줘서, 라벨이 칸보다 길어도 **옆 칸을 밀어내지 않는다**
  //    (nowrap 만 쓰면 flex min-width:auto 와 겹쳐 마지막 칸 '게임'이 잘렸다).
  assert.ok(
    /\b(truncate|whitespace-nowrap)\b/.test(navSrc),
    "nav 라벨이 줄바꿈될 수 있다 — truncate 나 whitespace-nowrap 중 하나는 있어야 한다",
  );
});

test("★ 스스로 뜨는 오버레이가 없다 [사용자 요청 2026-08-04 '버튼 좀 없애라']", () => {
  // 설치 배너(InstallPrompt)와 주간 피드백 팝업(FeedbackNudge)을 제거했다.
  // 둘 다 **사용자가 부르지 않았는데 나타나고**, 홈 전용이 아니라 어느 탭에서든 떴다.
  //  · 설치 배너: 쿨다운을 close() 에서만 기록 → 무시하면 매 실행마다 재출현(영구 노출).
  //  · 피드백 팝업: '표시할 때' 타임스탬프를 찍어 닫아도 7일 뒤 재출현. z-70 전체 모달.
  //    게다가 mailto 수신처가 앱 사용자 본인이었다.
  // 되살릴 땐 최소한 '다시 보지 않기'와 '닫을 때 기록'을 갖춰야 한다.
  const page = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
  for (const c of ["InstallPrompt", "FeedbackNudge"]) {
    assert.ok(!page.includes(c), `${c} 가 홈에 되살아났다 — 스스로 뜨는 배너는 금지`);
  }
});

test("★ 펫 이름 행은 버튼이 아니다 [사용자 요청 2026-08-04]", () => {
  // 원래 이 락은 '이름 행이 좌우 소품 메뉴와 겹치지 않게'를 지켰는데, 소품이 사라져
  // 겹칠 상대가 없어졌다. 지금 지켜야 할 계약은 다른 것이다 —
  // 이름 행은 **표시 전용**이다. '우리 섬 →' CTA 는 하단 탭 '게임'과 목적지가 겹쳐 뗐다
  // (월드 소품 4개를 지운 것과 같은 이유). 되살리면 같은 불만이 반복된다.
  const raw = readFileSync(join(here, "island/HomePet.tsx"), "utf8");
  // ⚠ 주석을 벗기고 본다 — 왜 뺐는지 적어둔 설명문까지 위반으로 잡으면 기록을 못 남긴다.
  const pet = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!pet.includes("우리 섬 →"), "이름 행에 '우리 섬 →' CTA 가 되살아났다");
  // 이름·기분·배지는 **정보**라 남아 있어야 한다(같이 지우면 펫이 누군지 알 수 없다)
  assert.ok(pet.includes("진화 가능 ✨"), "진화 가능 배지는 정보 — 남아야 한다");
  assert.ok(pet.includes("아파요 🤒"), "아파요 배지는 정보 — 남아야 한다");
});
