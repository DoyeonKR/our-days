// 가로 스크롤 방어선 lock.
//
// [사용자 리포트 2026-08-05 · 삼성 인터넷]
//   "처음 접속했을 때 gnb 가 안 보이고, 스크롤하면 나타나는데 그때 해상도가 안 맞고
//    우측 게임 메뉴가 짤려보여. 그리고 좌우 스크롤링이 되는 증상이야"
//
// 세 증상이 하나로 이어진다: 어딘가 화면보다 넓은 요소가 있으면 문서가 가로로 스크롤되고,
// **fixed 요소를 문서 스크롤 폭에 넣는 모바일 엔진**에서는 GNB 가 왼쪽으로 밀려 맨 오른쪽
// '게임' 탭이 잘린다. 배율까지 틀어져 보인다.
//
// body 에만 overflow-x 를 걸면 소용없다 — `position: fixed` 자손의 컨테이닝 블록은
// body 가 아니라 뷰포트(ICB)라 body 의 overflow 가 그것들을 통제하지 못한다.
// 그래서 **html 에도** 걸어야 한다. 이 lock 은 그 한 쌍이 유지되는지만 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "app", "globals.css"),
  "utf8",
);
/** 주석엔 'html 에도 걸어야 한다' 같은 설명이 들어 있다 — 규칙만 본다. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** 선택자가 포함된 선언 블록들.
 *  `}` 로 잘라 훑는 단순한 파서다 — 중첩(@media)까지 다루지 않지만, 여기서 보는 건
 *  최상위 html/body 규칙뿐이라 충분하고 정규식 한 방보다 덜 깨진다. */
function blocksFor(selector: string): string[] {
  const out: string[] = [];
  const sel = new RegExp(`(^|,)\\s*${selector}\\s*(,|$)`, "m");
  for (const chunk of rules.split("}")) {
    const i = chunk.indexOf("{");
    if (i < 0) continue;
    if (sel.test(chunk.slice(0, i).trim())) out.push(chunk.slice(i + 1));
  }
  return out;
}

test("★ html 과 body 둘 다 가로 넘침을 막는다", () => {
  for (const sel of ["html", "body"]) {
    const hit = blocksFor(sel).some((b) => /overflow-x:\s*clip/.test(b));
    assert.ok(
      hit,
      `${sel} 에 overflow-x: clip 이 없다 — body 만 막으면 fixed 요소(GNB·베젤)가 만든 가로 스크롤은 안 막힌다`,
    );
  }
});

test("★ 루트에 overflow-x: hidden 을 쓰지 않는다 (sticky 헤더가 깨진다)", () => {
  // hidden 은 스크롤 컨테이너를 만들어 일기장 월별 sticky 헤더와 스크롤 복원을 깬다.
  // clip 은 스크롤만 막고 나머지는 그대로 둔다.
  for (const sel of ["html", "body"]) {
    for (const b of blocksFor(sel)) {
      assert.ok(!/overflow-x:\s*hidden/.test(b), `${sel} 에 overflow-x: hidden — clip 을 써라`);
      assert.ok(!/overflow:\s*hidden/.test(b), `${sel} 에 overflow: hidden — clip 을 써라`);
    }
  }
});

test("★ 가로 패닝을 명시적으로 허용하지 않는다", () => {
  // touch-action: pan-x 를 주면 1px 만 넘쳐도 손가락으로 좌우로 끌린다.
  // 진짜 가로 스크롤러(칩 목록 등)는 자기 요소에 따로 pan-x 를 준다.
  const rootTouch = blocksFor("body")
    .concat(blocksFor("html"))
    .map((b) => /touch-action:\s*([^;]+)/.exec(b)?.[1]?.trim())
    .filter(Boolean);
  assert.ok(rootTouch.length > 0, "루트에 touch-action 이 지정돼 있어야 한다");
  for (const t of rootTouch) {
    assert.ok(!/pan-x|auto|manipulation/.test(t!), `루트 touch-action 이 가로 패닝을 허용한다: ${t}`);
  }
});
