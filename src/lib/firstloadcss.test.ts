// 첫 화면 CSS lock — 게임 화면 규칙은 렌더 차단 CSS(globals.css)에 없다. [2026-11-11]
//
// globals.css 는 모든 화면이 그리기 전에 받는 CSS 다(빌드 약 300KB). 그중 약 40%가 낚시 · 수조 · 합치기 · 섬 · 보스 ·
// 꾸미기 · 모험 규칙이었다 — 홈만 보는 사람도 그걸 다 받고 나서야 첫 화면을 그렸다. 그래서 그 규칙을 게임 탭이 받는
// styles/games.css · 모험 탭이 받는 styles/adventure.css 로 옮겼다(클래스 이름 그대로, CSS 모듈 아님).
// 여기서 잠그는 것:
//   · globals.css 에 게임 클래스만으로 된 선택자가 다시 생기지 않는다(새 게임 규칙은 styles/ 에).
//   · 게임 CSS 는 게임 탭 · 모험 탭 컴포넌트만 부른다 — 홈이 정적으로 닿는 파일이 부르면 다시 첫 화면에 실린다.
//   · 게임 CSS 도 Tailwind 를 거친다(@reference) — 안 거치면 color-mix 대체값이 빠져 옛 WebView 에서 그림자 · 배경이 사라진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME_CSS, GLOBAL_CSS } from "./cssfiles.ts";

const SRC = join(import.meta.dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
/** :not() · :is() · :where() 안의 클래스는 그 요소를 게임 요소로 한정하지 않는다 — 빼고 본다 */
const stripFn = (sel: string) => {
  let s = sel;
  for (let prev = ""; prev !== s; ) { prev = s; s = s.replace(/:(not|is|where)\(([^()]*)\)/g, ""); }
  return s;
};
const GAME_FAMILY = /^(fish|aqua|merge|boss|decor|adv)-/;

function selectors(css: string): string[] {
  const out: string[] = [];
  for (const m of strip(css).matchAll(/([^{}]+)\{/g)) {
    const head = m[1].trim();
    if (!head || head.startsWith("@") || /^(from|to|\d)/.test(head)) continue;
    out.push(...head.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

test("globals.css 에 게임 클래스만으로 된 선택자가 없다 — 게임 규칙은 styles/games.css · adventure.css", () => {
  const css = readFileSync(GLOBAL_CSS, "utf8");
  const sels = selectors(css);
  assert.ok(sels.length > 500, `선택자를 ${sels.length}개만 읽었다 — 파싱이 깨졌다`);
  const bad = sels.filter((s) => {
    const cls = [...stripFn(s).matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    return cls.length > 0 && cls.some((c) => GAME_FAMILY.test(c)) && cls.every((c) => GAME_FAMILY.test(c) || /^is-|^lv-/.test(c));
  });
  assert.deepEqual(bad, [], `게임 화면 규칙이 첫 화면 CSS 에 있다 — styles/ 로 옮길 것:\n${bad.slice(0, 20).join("\n")}`);
  // 옮긴 쪽엔 실제로 규칙이 있다(테스트가 헛돌지 않게)
  for (const f of GAME_CSS) assert.ok(selectors(readFileSync(f, "utf8")).length > 100, f);
});

test("게임 CSS 는 게임 탭 · 모험 탭만 부른다 — 홈 · 레이아웃 · 다른 탭이 부르면 다시 첫 화면에 실린다", () => {
  const importers: Record<string, string[]> = { "styles/games.css": [], "styles/adventure.css": [] };
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [join(dir, e.name)] : []));
  for (const f of walk(SRC)) {
    const code = readFileSync(f, "utf8");
    for (const k of Object.keys(importers)) if (code.includes(`import "@/${k}"`)) importers[k].push(f.slice(SRC.length + 1).replace(/\\/g, "/"));
  }
  assert.deepEqual(importers["styles/games.css"], ["components/GameArcade.tsx"]);
  assert.deepEqual(importers["styles/adventure.css"], ["components/adventure/AdventureTab.tsx"]);
  // 두 탭은 page.tsx 에서 지연 로드다(정적 import 면 그 CSS 가 첫 화면에 실린다)
  const page = readFileSync(join(SRC, "app", "page.tsx"), "utf8");
  assert.match(page, /const GameArcade = dynamic\(\(\) => import\("@\/components\/GameArcade"\)/);
  assert.match(page, /const AdventureTab = dynamic\(\(\) => import\("@\/components\/adventure\/AdventureTab"\)/);
  assert.doesNotMatch(strip(page), /^import .*(GameArcade|AdventureTab)/m);
});

test("게임 CSS 도 Tailwind 를 거친다 — @reference 한 줄(규칙은 내보내지 않는다)", () => {
  for (const f of GAME_CSS) {
    const css = strip(readFileSync(f, "utf8"));
    assert.match(css, /@reference "tailwindcss";/, f);
    assert.doesNotMatch(css, /@import "tailwindcss"/, `${f} — @import 면 Tailwind 전체(유틸 · 리셋)가 한 벌 더 실린다`);
  }
});
