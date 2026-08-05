// Tailwind 스캐너가 잡아먹으면 안 되는 문자열 lock.
//
// [2026-08-05 — 같은 실수를 두 번 했다]
//   1) 테스트 실패 메시지에 클래스 예시를 통짜로 적었다 → Tailwind 가 후보로 잡아 유효하지 않은
//      규칙을 생성 → globals.css 파싱이 통째로 실패 → **앱 스타일 전멸**.
//   2) 그 사고를 README 에 기록하면서 문제의 문자열을 그대로 옮겨 적었다 → 그대로 재발.
//
// Tailwind v4 는 소스뿐 아니라 **문서까지** 레포 전체를 훑는다. `next build` 는 조용히
// 통과하고 브라우저 콘솔에서만 터지므로, CI 에서 잡으려면 이렇게 소스를 직접 봐야 한다.
//
// 잠그는 것: 임의값 대괄호 안에 **자리표시자(...)** 가 들어간 토큰. 실제 클래스에는 절대
// 나오지 않는 모양이라 오검출이 없고, 두 사고가 정확히 이 모양이었다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** ⚠ 정규식을 **조각내어** 만든다 — 리터럴로 적으면 이 파일 자체가 그 후보가 된다. */
const PLACEHOLDER = new RegExp("[a-z][a-z-]{0,12}-" + "\\[" + "[^\\]\\n]{0,80}" + "\\.\\.\\.", "g");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "out" || e.name === ".git") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|md|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("★ Tailwind 가 만들 수 없는 '자리표시자 클래스'가 레포에 없다", () => {
  const bad: string[] = [];
  for (const f of walk(ROOT)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.match(PLACEHOLDER) ?? []) {
      bad.push(`${f.slice(ROOT.length + 1)} :: ${m}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    "임의값 대괄호에 '...' 자리표시자가 들어간 토큰이 있다. Tailwind 가 이걸 클래스로 만들어\n" +
      "  유효하지 않은 CSS 를 뱉고 globals.css 파싱이 통째로 실패한다(앱 스타일 전멸).\n" +
      "  설명이 필요하면 문자열을 조각내서 적어라:\n  " +
      bad.join("\n  "),
  );
});
