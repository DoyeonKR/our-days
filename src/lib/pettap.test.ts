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
  const bubble = src.slice(src.indexOf("{current && ("), src.indexOf("<PetYard"));
  assert.ok(bubble, "말풍선 블록을 찾지 못했다");
  // 말풍선 **컨테이너**가 절대배치면 안 된다(안쪽 꼬리 span 의 absolute 는 정상 — 말풍선 기준).
  const wrapper = bubble.slice(0, bubble.indexOf(">") + 1);
  assert.ok(
    !/\babsolute\b/.test(wrapper),
    `말풍선 컨테이너가 다시 absolute 로 얹혔다 — 겹침이 재발한다: ${wrapper}`,
  );
  assert.ok(
    /min-h-\[\d+px\]/.test(src),
    "말풍선 밴드에 최소 높이가 있어야 한다 — 없으면 대사가 뜰 때마다 펫이 아래로 튄다",
  );
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
