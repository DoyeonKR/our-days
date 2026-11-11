// 공통 버튼 lock. [사용자 2026-11-02 "닫기 버튼이나 이런 공통적인 버튼은 컴포넌트화 해서 동일하게좀 만들어줘 너무 산만해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { appCss } from "./cssfiles.ts";

const root = process.cwd();
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : p.endsWith(".tsx") ? [p] : [];
  });
}
const files = [...tsx(join(root, "src/components")), join(root, "src/app/page.tsx")];

test("닫기는 CloseButton 하나 — 화면마다 따로 만든 닫기 · ✕ 가 다시 생기지 않는다", () => {
  for (const f of files) {
    if (f.endsWith("AppButtons.tsx")) continue;
    const src = code(f);
    assert.doesNotMatch(src, /aria-label="닫기"/, `${f}: 닫기 버튼을 직접 만들었다`);
    assert.doesNotMatch(src, />\s*닫기\s*<\/button>/, `${f}: 닫기 버튼을 직접 만들었다`);
    assert.doesNotMatch(src, />\s*✕\s*<\/button>/, f);
    assert.doesNotMatch(src, /aqua-close|merge-close|island-close|home-appearance-close/, f);
  }
  for (const f of ["FishingGame", "AquariumGame", "MergeGame", "IslandGame", "PhotoViewer", "LogCapture", "HomeAppearanceEditor", "island/IslandSheet", "island/CoopPlay"]) {
    assert.match(code(join(root, `src/components/${f}.tsx`)), /<CloseButton|<GameHead/, f);
  }
  // 공용 시트(page.tsx 에서 components/Sheet 로 꺼냄, 2026-11-06)가 닫기 버튼을 그린다
  assert.ok(code(join(root, "src/components/Sheet.tsx")).includes("<CloseButton"));
  assert.match(code(join(root, "src/app/page.tsx")), /import Sheet from "@\/components\/Sheet"/);
});

test("닫기 모양은 한 곳 — 44px 터치 · 어떤 바탕에서도 읽히는 어두운 면", () => {
  const css = appCss();
  const rule = /\.app-close \{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(rule, /min-height: 44px/);
  assert.match(rule, /min-width: 60px/);
  assert.match(rule, /color: #fff/);
  assert.doesNotMatch(css, /^\.(aqua-close|merge-close|island-close|home-appearance-close)\b/m);
});

test("게임 버튼은 ActionButton — 낚시 · 수조 · 합치기가 같은 버튼을 쓴다 · 색은 글자색을 따른다", () => {
  for (const f of ["FishingGame", "AquariumGame", "MergeGame"]) assert.ok(code(join(root, `src/components/${f}.tsx`)).includes("<ActionButton"), f);
  for (const f of ["AquariumGame", "MergeGame"]) assert.doesNotMatch(code(join(root, `src/components/${f}.tsx`)), /<button[^>]*className="tap aqua-btn/, f);
  const css = appCss();
  assert.match(/^\.aqua-btn \{([^}]*)\}/m.exec(css)?.[1] ?? "", /color: inherit/);
  assert.doesNotMatch(css, /^\.merge-tools button \{|^\.merge-result-go \{|^\.merge-shop-back \{/m);
});
