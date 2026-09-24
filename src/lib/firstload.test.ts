// 첫 로드 lock — 홈이 **정적으로** 닿는 import 안에 무거운 섬·게임·다른 탭 모듈이 없다. [2026-09-25]
//
// [사용자: "다진행해" — 제안 5 '첫 로딩 줄이기'] 재 보니 홈 첫 로드(압축, noModule 폴리필 제외)가 약 355KB 였고
// 그중 80KB 남짓이 홈에서 안 쓰는 코드였다. 원인은 전부 '작은 것 하나 때문에 큰 모듈 통째로'였다:
//   · 홈 히어로 · 섹션 머리가 계절(seasonOf) 하나 때문에 섬 엔진(lib/island) 전체를 불렀다.
//   · couple.ts 가 날짜(kstDate) 하나 때문에 같은 섬 엔진을 불렀다.
//   · 아이콘 모듈들이 팔레트(PIXEL_PAL) 하나 때문에 펫 48×48 스프라이트 전부(lib/pixelart)를 불렀다.
//   · 홈 기분 도트가 섬 전용 도트(돌봄 · 장비 · 메달 …)와 한 파일(lib/pixelui)에 있었다.
//   · 함께 탭(CoupleSync) · 계정 칸(AccountSection) · 설정의 펫(PetIcon)이 정적 import 였다.
// 번들러는 표를 만드는 최상위 코드를 못 버린다 — 한 줄 import 가 모듈 전체를 싣는다. 그래서 크기가 아니라
// **import 그래프**를 잠근다: page.tsx 에서 정적 import 를 따라가 닿는 파일에 아래 목록이 없어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");

/** 정적 import 만 뽑는다 — `import type` · 전부 type 인 `{ type A, type B }` · 동적 `import()` 는 번들에 안 싣는다. */
function staticImports(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const out: string[] = [];
  const re = /^\s*(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm;
  for (const m of code.matchAll(re)) {
    if (m[1]) continue; // import type … / export type …
    const spec = m[2].trim();
    const braces = spec.match(/^\{([\s\S]*)\}$/);
    if (braces) {
      const names = braces[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    }
    out.push(m[3]);
  }
  // 부작용 import(import "x";)
  for (const m of code.matchAll(/^\s*import\s+["']([^"']+)["'];/gm)) out.push(m[1]);
  return out;
}

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = join(from, "..", spec);
  else return null; // 패키지(react · next · supabase …)는 여기서 안 본다
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand) && !cand.endsWith(".css") && /\.(ts|tsx)$/.test(cand)) return cand;
  }
  return null;
}

function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of staticImports(readFileSync(f, "utf8"))) {
      const r = resolve(f, spec);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return new Set([...seen].map((f) => f.slice(SRC.length + 1).replace(/\\/g, "/")));
}

test("첫 로드 — 홈(page.tsx)이 정적으로 닿는 곳에 섬 엔진 · 펫 스프라이트 · 섬 도트 · 다른 탭이 없다", () => {
  const got = reachable(join(SRC, "app", "page.tsx"));
  assert.ok(got.size > 30, `그래프가 ${got.size}개뿐 — import 파싱이 깨졌다`);
  assert.ok(got.has("components/PixelGlyph.tsx") && got.has("lib/pixelglyph.ts"), "홈 글리프 경로를 못 따라갔다(테스트가 헛돈다)");
  const HEAVY = [
    "lib/island.ts", // 섬 엔진 — 홈은 계절 · 날짜만 필요하다(lib/kst)
    "lib/pixelart.ts", // 펫 스프라이트 매핑(→ pixelpet48)
    "lib/pixelpet48.ts",
    "lib/pixelui.ts", // 섬 전용 도트 — 홈 글리프는 lib/pixelglyph
    "components/island/art/pets.tsx", // 일러스트 펫 23종(일러스트 모드에서만)
    "components/island/UiIcon.tsx", // 섬 아이콘 — 홈은 PixelGlyph
    "components/CoupleSync.tsx", // 함께 탭
    "components/AccountSection.tsx", // 설정 › 데이터
    "components/GameArcade.tsx",
    "components/IslandGame.tsx",
    "components/DecoBook.tsx",
  ];
  const leaked = HEAVY.filter((f) => got.has(f));
  assert.deepEqual(leaked, [], `홈 첫 로드에 무거운 모듈이 정적으로 딸려 온다 — dynamic() 이나 가벼운 모듈로:\n${leaked.join("\n")}`);
});

test("가벼운 모듈은 가볍게 — 팔레트 · 날짜 · 홈 글리프가 무거운 모듈을 부르지 않는다", () => {
  for (const f of ["lib/pixelpal.ts", "lib/kst.ts"]) {
    assert.deepEqual(staticImports(readFileSync(join(SRC, f), "utf8")), [], `${f} 가 다른 모듈을 부른다 — 값만 두는 곳이다`);
  }
  const glyph = [...reachable(join(SRC, "components", "PixelGlyph.tsx"))];
  for (const bad of ["lib/pixelui.ts", "lib/pixelart.ts", "lib/island.ts"]) {
    assert.ok(!glyph.includes(bad), `PixelGlyph 가 ${bad} 에 닿는다`);
  }
});
