// 모바일 가로 스크롤 회귀 lock. [사용자 리포트 2026-08-04 "계속 좌우 스크롤이 생겨서 상당히 불편"]
//
// 이 결함은 **데스크톱에서 안 보인다** — 실측상 Chrome 360px 뷰포트에서 넘침이 0 이었다.
// 그래서 눈으로 잡을 수 없고, 원인 패턴 자체를 소스에서 금지하는 방식으로 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");

/** src 아래 모든 .tsx 를 훑는다. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("★ fixed 요소를 변환으로 중앙 정렬하지 않는다 — 모바일에서 가로 스크롤이 생긴다", () => {
  // `fixed + left-1/2 + w-full + -translate-x-1/2` 는 **변환 전** 박스가 50vw~150vw 다.
  // 데스크톱 Chrome 은 이를 문서 스크롤 폭에 넣지 않지만, fixed 요소를 포함시키는
  // 모바일 엔진에서는 그대로 좌우 스크롤이 된다. 변환 없는 `inset-x-0 + mx-auto` 를 쓴다.
  const bad: string[] = [];
  for (const f of tsxFiles(SRC)) {
    const src = readFileSync(f, "utf8");
    // className="..." 문자열 단위로 본다(여러 요소가 한 줄에 있어도 섞이지 않게)
    for (const m of src.matchAll(/className=\{?["`]([^"`]*)["`]/g)) {
      const cls = m[1];
      if (!/\bfixed\b/.test(cls)) continue;
      if (/\bleft-1\/2\b/.test(cls) && /-translate-x-1\/2/.test(cls)) {
        bad.push(`${f.slice(SRC.length + 1)}: ${cls.slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `fixed 변환 중앙정렬(모바일 가로 스크롤 유발):\n${bad.join("\n")}`);
});

test("★ 전역 touch-action 이 가로 패닝을 허용하지 않는다", () => {
  // pan-x 를 주면 **가로 패닝을 명시적으로 허용**하는 것이라, 어디선가 1px 만 넘쳐도
  // 손가락으로 좌우로 끌린다. 세로만 허용하고, 진짜 가로 스크롤러만 국소 허용한다.
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
  const block = /html,\s*\nbody\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
  assert.ok(block, "html, body 블록을 찾지 못했다");
  const ta = /touch-action:\s*([^;]+);/.exec(block)?.[1]?.trim();
  assert.ok(ta, "html, body 에 touch-action 이 있어야 한다");
  assert.ok(!/\bpan-x\b/.test(ta), `전역 touch-action 에 pan-x 금지 — 현재: ${ta}`);
});

test("가로 스크롤 컨테이너는 자기 요소에 pan-x 를 되살린다", () => {
  // 전역이 pan-y 라, overflow-x-auto 를 쓰는 곳은 touch-action 을 직접 켜야 손가락으로 넘어간다.
  const bad: string[] = [];
  for (const f of tsxFiles(SRC)) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("overflow-x-auto")) continue;
    // 같은 요소 안(다음 '>' 전까지)에 touch-action 이 있는지
    for (const m of src.matchAll(/overflow-x-auto/g)) {
      const seg = src.slice(m.index, src.indexOf(">", m.index) + 1);
      if (!/touchAction|touch-action/.test(seg)) {
        bad.push(`${f.slice(SRC.length + 1)} @${m.index}`);
      }
    }
  }
  assert.deepEqual(bad, [], `가로 스크롤러에 touch-action: pan-x 누락:\n${bad.join("\n")}`);
});

test("넘침 안전망은 clip 이다 — hidden 은 sticky 를 깬다", () => {
  // 일기장 월별 헤더가 position: sticky 다. body 에 overflow-x: hidden 을 걸면
  // 스크롤 컨테이너가 생겨 sticky 가 죽는다. clip 은 스크롤 컨테이너를 만들지 않는다.
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
  assert.ok(/overflow-x:\s*clip/.test(css), "body 에 overflow-x: clip 안전망이 있어야 한다");
  assert.ok(!/overflow-x:\s*hidden/.test(css), "overflow-x: hidden 금지(sticky 를 깬다)");
});
