// 리터럴 면 × 테마 글자색 짝 lock.
// [사용자 리포트 2026-08-05 "라이트모드에서 말풍선이 잘 안보여" 를 파다가 발견]
//
// `bg-white` 는 리터럴 흰색이라 테마를 안 따르는데 `text-ink` 는 따라간다.
// 다크 모드에서 --ink 가 #e6e9f2(밝음)이 되므로 **흰 바탕 + 흰 글씨**가 된다.
// 실측(브라우저 computed): bg rgb(255,255,255) / color rgb(230,233,242) → 대비 1.13:1.
// 게임 액션 버튼 19곳이 전부 이 상태였다 — 라이트로만 보면 절대 안 보이는 종류의 버그다.
//
// 잠그는 것: **테마 불변 배경엔 테마 불변 글자색**. 짝이 어긋난 className 이 하나도 없어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** 테마를 따라 뒤집히는 글자색 유틸 — 리터럴 면 위에 쓰면 한쪽 테마에서 사라진다. */
const THEMED_TEXT = /\btext-(ink|muted)\b/;
/** 테마와 무관하게 항상 밝은 면. */
const LITERAL_LIGHT_BG = /\bbg-white\s/;

test("★ 리터럴 흰 배경에 테마 글자색을 쓰지 않는다 (다크 모드 흰글씨 방지)", () => {
  const bad: string[] = [];
  for (const f of tsxFiles(SRC)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.match(/"[^"\n]*"/g) ?? []) {
      if (LITERAL_LIGHT_BG.test(m) && THEMED_TEXT.test(m)) {
        bad.push(`${f.slice(SRC.length + 1)} :: ${m.slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `리터럴 흰 면 + 테마 글자색 짝 — 다크 모드에서 글씨가 사라진다:\n  ${bad.join("\n  ")}`);
});

test("★ --ink-on-light 는 다크 모드에서 뒤집히지 않는다", () => {
  const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
  const light = css.match(/--ink-on-light:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(light, "--ink-on-light 토큰이 있어야 한다");
  const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  assert.ok(!dark.includes("--ink-on-light:"), "다크 블록에서 재정의하면 버그가 그대로 돌아온다");
});
