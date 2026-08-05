// 홈 캐릭터 탭 반응 회귀 lock. [사용자 피드백 2026-08-04]
//
// 예전 홈 탭은 어떤 상황에서도 squish-1 + 깡총 + 하트 3개로 **항상 같았다**.
// 반응이 한 가지면 두 번째 탭부터는 눌러도 아무 일이 안 일어나는 것처럼 느껴진다.
// 이 테스트가 잠그는 것: 단계가 실제로 커지는가 · 같은 단계 안에서도 다양한가 ·
// 도트를 회전시키지 않는가(픽셀 격자 규약).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type PetVibe,
  TAP_COMBO_MAX,
  TAP_COMBO_MS,
  tapReaction,
  tapTier,
} from "./petmotion.ts";

const VIBES: PetVibe[] = ["sick", "sleepy", "hungry", "sad", "happy", "ok"];
const RS = [0, 0.2, 0.35, 0.5, 0.7, 0.85, 0.99];

test("콤보 단계 경계 — 1~2 / 3~4 / 5~7 / 8+", () => {
  assert.deepEqual([1, 2].map(tapTier), [1, 1]);
  assert.deepEqual([3, 4].map(tapTier), [2, 2]);
  assert.deepEqual([5, 6, 7].map(tapTier), [3, 3, 3]);
  assert.deepEqual([8, 12, 99].map(tapTier), [4, 4, 4]);
});

test("★ 연타할수록 실제로 커진다 — 파티클·퍼짐이 단조 증가", () => {
  const at = (c: number) => tapReaction("happy", c, 0.5);
  const counts = [1, 3, 5, 8].map((c) => at(c).count);
  const spreads = [1, 3, 5, 8].map((c) => at(c).spread);
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] > counts[i - 1], `파티클 ${counts}`);
    assert.ok(spreads[i] > spreads[i - 1], `퍼짐 ${spreads}`);
  }
  assert.ok(at(8).count >= 12, "최고 단계는 확실히 터져야 한다");
});

test("흔들림·링·외침은 단계가 올라야 붙는다 — 1탭부터 다 터지면 단계가 무의미", () => {
  const t1 = tapReaction("ok", 1, 0.5);
  assert.equal(t1.shake, false);
  assert.equal(t1.ring, false);
  assert.equal(t1.cry, null);
  assert.equal(tapReaction("ok", 3, 0.5).cry !== null, true, "2단계부터 외침");
  assert.equal(tapReaction("ok", 5, 0.5).shake, true, "3단계부터 흔들림");
  assert.equal(tapReaction("ok", 5, 0.5).ring, true, "3단계부터 링");
});

test("★ 같은 단계 안에서도 동작이 여러 가지 — 한 가지면 '다양'이 아니다", () => {
  for (const tierCombo of [3, 5]) {
    const anims = new Set(RS.map((r) => tapReaction("happy", tierCombo, r).anim));
    assert.ok(anims.size >= 2, `combo ${tierCombo}: 동작 ${[...anims].join(",")}`);
  }
});

test("★ 도트를 회전시키지 않는다 — rotate 는 픽셀 격자를 깬다(README §14.5)", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
  const anims = new Set<string>();
  for (const v of VIBES) for (const c of [1, 3, 5, 8]) for (const r of RS) anims.add(tapReaction(v, c, r).anim);
  for (const a of anims) {
    const block = css.match(new RegExp(`@keyframes pet-${a}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.ok(block, `@keyframes pet-${a} 가 CSS 에 없다 — 애니가 조용히 안 걸린다`);
    assert.ok(!/rotate\s*\(/.test(block), `pet-${a} 가 도트를 회전시킨다`);
  }
});

test("모든 기분 × 모든 콤보에서 값이 온전하다", () => {
  for (const v of VIBES) {
    for (let c = 1; c <= TAP_COMBO_MAX + 4; c++) {
      for (const r of RS) {
        const R = tapReaction(v, c, r);
        assert.ok(R.anim.length > 0, `${v}/${c}: 빈 anim`);
        assert.ok(R.particle.length > 0, `${v}/${c}: 빈 파티클`);
        assert.ok(R.count > 0 && R.count <= 20, `${v}/${c}: 파티클 ${R.count}`);
        assert.ok(R.spread > 0, `${v}/${c}: 퍼짐 ${R.spread}`);
        assert.ok(R.vibrate.length > 0 && R.vibrate.every((n) => n > 0), `${v}/${c}: 진동`);
        if (R.cry !== null) assert.ok(R.cry.length > 0 && R.cry.length <= 6, `${v}/${c}: 외침 길이`);
      }
    }
  }
});

test("상한을 넘겨도 최고 단계에서 멈춘다 — 무한 인플레 금지", () => {
  const a = tapReaction("happy", TAP_COMBO_MAX, 0.5);
  const b = tapReaction("happy", TAP_COMBO_MAX + 50, 0.5);
  assert.equal(a.tier, 4);
  assert.deepEqual(a, b);
});

test("결정적 — 같은 (기분, 콤보, r) 이면 같은 반응", () => {
  assert.deepEqual(tapReaction("sad", 4, 0.3), tapReaction("sad", 4, 0.3));
});

test("콤보 유지 시간이 사람이 연타할 수 있는 범위다", () => {
  assert.ok(TAP_COMBO_MS >= 500 && TAP_COMBO_MS <= 1500, `${TAP_COMBO_MS}ms`);
});

/* ── 레이아웃 회귀(소스 스캔) ─────────────────────────────────── */

test("★ 홈 말풍선과 캐릭터가 겹칠 수 없는 구조다 [사용자 피드백 '계속 겹쳐']", () => {
  // 예전엔 말풍선을 무대 안에 `absolute ... top-1` 로 얹었는데, 무대 128px 에서 펫(96px)이
  // bottom-20% 에 서므로 머리는 항상 y=6.4px → 말풍선(4~33px)과 27px 가 **항상** 겹쳤다.
  // 지금은 세로로 분리된 밴드라 좌표가 겹칠 수 없다. 절대배치로 되돌리면 즉시 재발한다.
  const src = readFileSync(join(import.meta.dirname, "..", "components", "island", "HomePet.tsx"), "utf8");
  // 말풍선 자체는 PetBubble 로 분리했다(대비 수정 때 — 프로브에서 진짜 하늘 위에 올려보려고).
  // 밴드는 HomePet 에, 말풍선 본체는 PetBubble 에 있으므로 두 파일을 같이 본다.
  const bubble = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetBubble.tsx"), "utf8");
  assert.ok(src.includes("<PetBubble"), "HomePet 이 PetBubble 을 쓴다");
  // 말풍선 **컨테이너**가 절대배치면 안 된다(안쪽 꼬리 span 의 absolute 는 정상 — 말풍선 기준).
  const wrapper = bubble.slice(bubble.indexOf("<div className=\"animate-pop"), bubble.indexOf(">", bubble.indexOf("<div className=\"animate-pop")) + 1);
  assert.ok(
    !/\babsolute\b/.test(wrapper),
    `말풍선 컨테이너가 다시 absolute 로 얹혔다 — 겹침이 재발한다: ${wrapper}`,
  );

  // 밴드 자체의 계약 3가지. 첫 시도는 (a)(b) 를 빠뜨려 겹침을 펫에서 **월드 소품**으로
  // 옮겼고, 스테이지가 z-20 이라 우편함·표지판 탭까지 가로챘다.
  const band = src.slice(src.indexOf('<div className="pointer-events-none flex h-['), src.indexOf("<PetYard"));
  assert.ok(band, "말풍선 밴드를 찾지 못했다 — 클래스가 바뀌었으면 이 테스트도 같이 고쳐라");
  assert.ok(
    /pointer-events-none/.test(band),
    "(a) 밴드는 pointer-events-none 이어야 한다 — 아니면 뒤의 월드 소품(우편함·표지판)을 못 누른다",
  );
  const h = /\bh-\[(\d+)px\]/.exec(band);
  assert.ok(h && Number(h[1]) >= 50, `(b) 밴드 높이는 2줄 기준으로 고정해야 한다(현재 ${h?.[1]}) — auto 면 1↔2줄 순환마다 출렁인다`);
  const mw = /max-w-\[(\d+)%\]/.exec(bubble);
  assert.ok(
    mw && Number(mw[1]) <= 70,
    `(c) 말풍선 폭은 좌우 소품 사이로 제한해야 한다(현재 ${mw?.[1]}%) — w-full 이면 우편함·표지판을 덮는다`,
  );
});

test("★ 히어로 무대는 연출을 자르지 않고, 뒤의 월드 소품 탭을 막지 않는다", () => {
  // 무대 128px 에 픽셀 펫은 102px(48+2 스프라이트 × 정수배 2~3) — 96px 이 아니다.
  // 머리 위 여유가 18px 뿐이라 3~4단계 점프는 overflow-hidden 이면 40px 넘게 잘린다.
  // 그리고 무대가 히트테스트를 먹으면 바로 앞 커밋에서 배지를 단 소품을 못 누르게 된다.
  const src = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetYard.tsx"), "utf8");
  const root = src.slice(src.indexOf("className={`${"), src.indexOf("{/* 언덕"));
  assert.ok(/overflow-visible/.test(root), "bare 무대는 overflow-visible 이어야 연출이 안 잘린다");
  assert.ok(/pointer-events-none/.test(root), "bare 무대는 pointer-events-none 이어야 소품을 누를 수 있다");
  assert.ok(
    /pointer-events-auto/.test(src),
    "펫 버튼은 pointer-events-auto 로 되돌려야 한다 — 아니면 펫을 못 누른다",
  );
  // 루트 리마운트 금지 — key 가 바뀌면 React 가 DOM 서브트리를 파괴/재생성한다
  assert.ok(!/key=\{`yard\$\{/.test(src), "무대 루트에 key 를 걸면 안 된다(파티클 되감김·펫 순간이동)");
});

test("★ 펫 무대 컨테이너가 뒤를 막지 않는다", () => {
  // 이 박스는 화면 전폭 × 컬럼 높이(약 240px)라 **투명해도** 히트테스트를 먹는다.
  // z-20 이라 뒤에 무엇을 두든(사진줄·소품 등) 덮어 버린다 — 위생 규칙으로 유지한다.
  const hw = readFileSync(join(import.meta.dirname, "..", "components", "HomeWorld.tsx"), "utf8");
  const stage = /<div className="([^"]*absolute inset-x-0 bottom-0 z-20[^"]*)"/.exec(hw)?.[1] ?? "";
  assert.ok(stage, "펫 무대 컨테이너를 찾지 못했다");
  assert.ok(
    /pointer-events-none/.test(stage),
    `무대 컨테이너는 pointer-events-none 이어야 한다 — 현재: ${stage}`,
  );
});

test("월드 내비 소품이 되살아나지 않는다 [사용자 요청 2026-08-04 '없애라고']", () => {
  // 하단 탭에 캘린더·일기장·게임이 이미 있어 **같은 곳으로 가는 두 번째 문**이었다.
  // 상태 배지를 달아 쓸모를 만들어 보려 했지만 사용자에겐 여전히 군더더기였다.
  // 되살릴 땐 히트테스트·말풍선 폭 계산을 함께 되돌려야 하므로 이 락으로 알린다.
  const hw = readFileSync(join(import.meta.dirname, "..", "components", "HomeWorld.tsx"), "utf8");
  for (const kind of ["mailbox", "signpost", "rowboat", "benchbook"]) {
    assert.ok(!hw.includes(`kind="${kind}"`), `히어로에 ${kind} 소품이 되돌아왔다`);
  }
  assert.ok(!/function WorldProp\(/.test(hw), "WorldProp 컴포넌트가 되살아났다");
});

test("하단 탭 라벨은 픽셀 서체가 아니다 [사용자 피드백 2026-08-04]", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
  const block = css.match(/\.ui-sans\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(block, ".ui-sans 스코프가 있어야 한다");
  assert.ok(block.includes("font-family: var(--font-prose)"), ".ui-sans 는 읽기 서체여야 한다");
  assert.ok(!block.includes("Galmuri"), ".ui-sans 에 픽셀 폰트 직접 지정 금지");
  const page = readFileSync(join(import.meta.dirname, "..", "app", "page.tsx"), "utf8");
  const nav = page.slice(page.indexOf("하단 탭 네비"), page.indexOf("하단 탭 네비") + 800);
  assert.ok(/className="ui-sans/.test(nav), "하단 nav 에 .ui-sans 가 붙어 있어야 한다");
});

test("★ 섬은 픽셀 무대를 유지하면서 홈과 같은 탭 반응을 쓴다 [2026-08-04]", () => {
  // 두 번 틀린 자리다. 처음엔 섬 onTap 이 petPet() 한 번 호출뿐이라 손맛이 홈과 달랐고,
  // 고치겠다고 무대까지 PetYard 로 바꿨더니 배경이 CSS 그라데이션이 되어 **오히려 픽셀이
  // 아니게** 됐다(사용자: "픽셀로 맞춰달라는건데").
  // 지켜야 할 계약 두 개: (a) 픽셀 무대는 PixelPet 그대로 (b) 반응은 홈과 같은 스펙.
  const island = readFileSync(join(import.meta.dirname, "..", "components", "IslandGame.tsx"), "utf8");
  assert.ok(/<PixelPet/.test(island), "(a) 섬 픽셀 무대는 PixelPet(도트 캔버스 씬)이어야 한다");
  assert.ok(/<PetTapFx/.test(island), "(b) 반응은 PetTapFx 로 얹어야 한다 — 안 그러면 손맛이 다시 갈린다");

  // PetTapFx 와 PetYard 가 **같은 순수 스펙**을 쓰는지 — 이게 '다르지 않다'의 근거다.
  const fx = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetTapFx.tsx"), "utf8");
  const yard = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetYard.tsx"), "utf8");
  for (const [name, src] of [["PetTapFx", fx], ["PetYard", yard]] as const) {
    assert.ok(src.includes("tapReaction("), name + " 가 tapReaction 스펙을 써야 한다");
    assert.ok(/TAP_COMBO_MS/.test(src), name + " 가 같은 콤보 창을 써야 한다");
  }
});
