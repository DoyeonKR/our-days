// 픽셀 UI 톤 lock. [2026-08-03]
// 사용자: "모든 톤앤 매너 도트 픽셀로 — 메인 화면도 그렇고 섬도 그렇고".
//
// 이 규칙들은 **눈으로 잡히지 않는다**. 11px 폰트도, 1.5px 별도, 흐린 그림자도 "조금 흐린가?"
// 정도로만 보여 그냥 넘어간다. 그래서 숫자로 고정한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fontGrid } from "../../scripts/fontgrid.mjs";

const cssPath = join(import.meta.dirname, "..", "app", "globals.css");
const css = readFileSync(cssPath, "utf8");
/** 주석 제외 — 왜 없앴는지 적어둔 설명문을 위반으로 잡으면 기록을 못 남긴다. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("폰트 격자 실측 — 이름이 아니라 파일이 크기를 정한다", () => {
  const root = join(import.meta.dirname, "..", "..");
  const g11 = fontGrid(join(root, "public", "fonts", "Galmuri11.woff2"));
  const g9 = fontGrid(join(root, "public", "fonts", "Galmuri9.woff2"));
  // 이름은 11/9 지만 실제 격자는 12/10 이다. 이 값이 바뀌면 타입 스케일 전체를 다시 잡아야 한다.
  assert.equal(g11.dotsPerEm, 12, "Galmuri11 격자가 12 가 아니다 — 타입 스케일 재산정 필요");
  assert.equal(g9.dotsPerEm, 10, "Galmuri9 격자가 10 이 아니다 — 마이크로 티어 재산정 필요");
});

test("타입 스케일이 폰트 격자의 정수배", () => {
  // plain @theme 블록의 --text-* 값을 읽어 격자와 대조한다.
  const MICRO = new Set(["--text-xs", "--text-lg", "--text-xl"]); // Galmuri9(10 배수)
  const bad: string[] = [];
  for (const m of cssCode.matchAll(/(--text-[a-z0-9]+):\s*(\d+)px;/g)) {
    const [, name, px] = m;
    const grid = MICRO.has(name) ? 10 : 12;
    if (Number(px) % grid !== 0) bad.push(`${name}: ${px}px (격자 ${grid} 의 배수가 아님)`);
  }
  assert.ok(bad.length === 0, `격자를 벗어난 글자 크기:\n${bad.join("\n")}`);
  // line-height 는 짝수여야 half-leading 이 정수가 된다
  const oddLh: string[] = [];
  for (const m of cssCode.matchAll(/(--text-[a-z0-9]+--line-height):\s*(\d+)px;/g)) {
    if (Number(m[2]) % 2 !== 0) oddLh.push(`${m[1]}: ${m[2]}px`);
  }
  assert.deepEqual(oddLh, [], `홀수 line-height (글자가 반픽셀에 앉는다):\n${oddLh.join("\n")}`);
});

test("모서리 전면 0 — 둥근 모서리는 도트 격자를 깬다", () => {
  const bad: string[] = [];
  for (const m of cssCode.matchAll(/(--radius[a-z0-9-]*):\s*([^;]+);/g)) {
    const [, name, val] = m;
    if (name === "--radius-card") continue; // var(--radius) 참조
    if (val.trim() !== "0px") bad.push(`${name}: ${val.trim()}`);
  }
  assert.deepEqual(bad, [], `0 이 아닌 모서리 토큰:\n${bad.join("\n")}`);
});

test("그림자에 블러가 없다 — 깊이는 '몇 도트 밀렸나'로만 표현한다", () => {
  const bad: string[] = [];
  for (const m of cssCode.matchAll(/(--(?:inset-)?shadow-[a-z0-9]+):\s*([^;]+);/g)) {
    const [, name, val] = m;
    if (val.includes("inset")) continue; // 베벨(안쪽 1도트 선)은 허용
    // "Xpx Ypx Bpx ..." 에서 3번째(blur)가 0 이어야 한다
    const lens = val.match(/-?\d+px/g) ?? [];
    if (lens.length >= 3 && parseInt(lens[2], 10) !== 0) bad.push(`${name}: ${val.trim()}`);
  }
  assert.deepEqual(bad, [], `블러가 살아있는 그림자:\n${bad.join("\n")}`);
});

test("픽셀 폰트 렌더 설정 — 안티앨리어싱/소수 자간 금지", () => {
  assert.ok(cssCode.includes("-webkit-font-smoothing: none"), "안티앨리어싱이 켜지면 도트가 번진다");
  assert.ok(!/letter-spacing:\s*-?0?\.\d+em/.test(cssCode), "소수 자간 금지(글자가 반픽셀에 앉는다)");
  assert.ok(cssCode.includes('--font-sans: "Galmuri11"'), "본문 폰트 = Galmuri11");
});

test("컴포넌트에 격자를 벗어난 임의 글자 크기가 없다", () => {
  const allow = new Set([12, 24, 36, 48, 60, 72, 10, 20]); // 두 격자의 정수배
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".tsx")) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/text-\[(\d+)px\]/g)) {
        if (!allow.has(Number(m[1]))) bad.push(`${name}: text-[${m[1]}px]`);
      }
      // rem 임의 크기는 사용자 브라우저 설정에 흔들려 격자를 못 지킨다
      for (const m of src.matchAll(/text-\[[\d.]+rem\]/g)) bad.push(`${name}: ${m[0]}`);
    }
  };
  walk(join(import.meta.dirname, "..", "components"));
  walk(join(import.meta.dirname, "..", "app"));
  assert.deepEqual(bad, [], `격자를 벗어난 임의 글자 크기:\n${bad.join("\n")}`);
});

test("긴 글은 정수 2배 티어로 읽는다(.prose-ko)", () => {
  // 한글 12px 은 자모 3개를 12칸에 넣어야 해 길게 읽기 어렵다 → 24px(격자 2배).
  // 1.5배(18px) 같은 값으로 타협하면 그 즉시 흐려진다.
  const block = css.match(/\.prose-ko\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(block, ".prose-ko 가 있어야 한다(일기·댓글 본문 가독성)");
  const size = Number(/font-size:\s*(\d+)px/.exec(block)?.[1] ?? 0);
  const lh = Number(/line-height:\s*(\d+)px/.exec(block)?.[1] ?? 0);
  assert.equal(size % 12, 0, `.prose-ko font-size ${size}px 이 12 배수가 아니다`);
  assert.ok(size >= 24, `.prose-ko 는 본문(12px)보다 커야 한다 — 현재 ${size}px`);
  assert.equal(lh % 2, 0, `.prose-ko line-height ${lh}px 이 홀수다`);
});
