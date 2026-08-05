// 월드 UI 대비 lock — 하늘 위에 뜨는 것들이 어떤 시각·어떤 테마에서도 읽히는지.
// [사용자 리포트 2026-08-05 "라이트모드에서 말풍선이 잘 안보여 같은 하얀색이라"]
//
// 이 파일이 존재하는 이유:
//   1차 수정에서 말풍선 색을 앱 테마 토큰(--card/--line-strong)으로 바꿨다. 라이트는 고쳐졌지만
//   **다크 테마 × 노을 하늘에서 대비 1.02:1**(완전히 같은 색)로 오히려 나빠졌다.
//   눈으로 한 조합만 확인했으면 그대로 나갔을 회귀다 — 그래서 16 조합을 계산으로 전부 검사한다.
//
// 잠그는 성질: **면과 테두리 중 최소 하나는 하늘과 3:1 이상 차이 난다.**
//   값(#fff8e8 같은 것)이 아니라 '하늘과의 관계'를 잠근다. 하늘 팔레트를 손봐도 이 테스트가 잡는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { skyLook, type SkyPhase } from "./scenetime.ts";
import type { Season } from "./island.ts";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../app/globals.css"), "utf8");
const bubble = readFileSync(join(here, "../components/island/PetBubble.tsx"), "utf8");

/** globals.css 의 :root 토큰 값을 읽는다(실제로 배포되는 값을 검사하기 위해). */
function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `globals.css 에 --${name} 이 없다`);
  return m![1];
}

const rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const chan = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (h: string) => {
  const [r, g, b] = rgb(h);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};
/** WCAG 상대 명도 대비. 1 = 같은 색, 21 = 흑백. */
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PHASES: SkyPhase[] = ["night", "blueHour", "sunrise", "morning", "day", "golden", "sunset", "twilight"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
/** 말풍선이 뜨는 높이대(실측: 히어로의 59~71%) 가 걸치는 하늘 밴드. */
const BANDS = ["mid", "lower", "bottom"] as const;
const MIN = 3; // UI 경계의 최소 대비

test("★ 말풍선이 8개 하늘 × 4계절 전부에서 배경과 구분된다", () => {
  const card = token("world-card");
  const line = token("world-line");
  const worst: { where: string; v: number }[] = [];

  for (const season of SEASONS) {
    for (const phase of PHASES) {
      const look = skyLook(phase, season);
      for (const band of BANDS) {
        const sky = look[band];
        // 면이 묻히면 테두리가, 테두리가 묻히면 면이 형태를 지켜야 한다.
        const best = Math.max(contrast(card, sky), contrast(line, sky));
        worst.push({ where: `${look.label}/${season}/${band}`, v: best });
      }
    }
  }
  worst.sort((a, b) => a.v - b.v);
  assert.ok(
    worst[0].v >= MIN,
    `${worst[0].where} 에서 면·테두리 모두 하늘과 ${worst[0].v.toFixed(2)}:1 — ${MIN}:1 미만이면 말풍선이 사라진다`,
  );
});

test("★ 글자가 말풍선 면 위에서 읽힌다", () => {
  assert.ok(contrast(token("world-ink"), token("world-card")) >= 7, "본문 대비 AAA(7:1) 이상");
});

test("★ 월드 토큰은 다크 모드에서 뒤집히지 않는다", () => {
  // 뒤집는 순간 '테마 × 하늘' 조합 문제가 그대로 돌아온다. @media 블록 안에 정의가 없어야 한다.
  const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  for (const t of ["world-card", "world-line", "world-ink"]) {
    assert.ok(!darkBlock.includes(`--${t}:`), `--${t} 이 다크 블록에서 재정의됐다`);
  }
});

test("★ 말풍선이 앱 테마 토큰을 쓰지 않는다", () => {
  // 이게 정확히 1차 수정의 실패 원인이다. 클래스에 테마 토큰이 다시 들어오면 막는다.
  for (const bad of ["bg-card", "border-line-strong", "text-ink", "var(--card)", "var(--line-strong)"]) {
    assert.ok(!bubble.includes(bad), `PetBubble 이 테마 토큰 "${bad}" 를 쓴다 — 하늘 위에선 --world-* 를 써야 한다`);
  }
  assert.ok(bubble.includes("var(--world-card)"), "월드 토큰을 써야 한다");
  assert.ok(bubble.includes("var(--world-line)"), "테두리가 가독성을 책임진다");
});
