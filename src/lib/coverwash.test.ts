// 대표사진 배경 wash lock. [사용자 요청 2026-09-08 "배경 메인 사진이 너무 안 보인다"]
//
// wash 를 진하게 하려면 **그 위에 뜨는 글씨에 바닥이 있어야** 한다.
// 실측: 예전 13% 에서도 어두운 사진 위 --muted 3.47 / --accent-ink 3.85 였다(기준 4.5).
// soft-light 로 섞어도 3.34 라 나아지지 않고, 글씨색 조정으로도 못 푼다 —
// 밝은 사진과 어두운 사진이 같은 화면에 있으면 한 색으로 둘 다 이길 수 없다.
//
// 성립하는 이유: 페이지 배경이 background-attachment: fixed 라 뷰포트 고정이다.
// 같은 그라디언트를 쓰는 자식은 스크롤·위치와 무관하게 정확히 같은 색이 된다.
// (문서 기준이었으면 위치마다 어긋나 이 수법을 못 쓴다.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dirname;
const css = readFileSync(join(here, "..", "app", "globals.css"), "utf8");
const page = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
const head = readFileSync(join(here, "..", "components", "WorldSectionHead.tsx"), "utf8");
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("페이지 바탕 정의는 한 곳(--page-bg)에만 있다", () => {
  // body 와 .page-bed 가 각자 그라디언트를 적으면 언젠가 한쪽만 바뀌고, 그때 바닥이 드러난다.
  assert.match(bare, /--page-bg:\s*linear-gradient\(/);
  const grads = bare.match(/background:\s*linear-gradient\(\s*\n?\s*180deg,\s*\n?\s*var\(--bg-1\)/g) ?? [];
  assert.deepEqual(grads, [], "body/.page-bed 가 그라디언트를 직접 적고 있다 — --page-bg 를 써라");
});

test("body 와 .page-bed 가 같은 바탕을 같은 방식으로 그린다", () => {
  for (const sel of ["body", ".page-bed"]) {
    // ⚠ `body` 규칙은 이 파일에 여러 개다(리셋·넘침 방어·바탕). 배경을 그리는 것만 고른다.
    const bodies: string[] = [];
    for (let at = bare.indexOf(sel + " {"); at >= 0; at = bare.indexOf(sel + " {", at + 1)) {
      bodies.push(bare.slice(at, bare.indexOf("}", at)));
    }
    assert.ok(bodies.length, `${sel} 규칙을 못 찾음`);
    const body = bodies.find((b) => /background:/.test(b));
    assert.ok(body, `${sel} 에 배경을 그리는 규칙이 없다`);
    assert.match(body!, /background:\s*var\(--page-bg\)/, `${sel} 가 --page-bg 를 안 쓴다`);
    // ⚠ fixed 가 빠지면 문서 기준이 되어 스크롤할 때 바닥이 어긋나 보인다.
    assert.match(body!, /background-attachment:\s*fixed/, `${sel} 에 background-attachment: fixed 가 없다`);
  }
});

test("wash 가 예전 값(13%)보다 확실히 진하다", () => {
  const m = page.match(/fixed inset-0 -z-10 bg-cover bg-center opacity-\[([\d.]+)\]/);
  assert.ok(m, "대표사진 배경 레이어를 못 찾음");
  const v = Number(m![1]);
  assert.ok(v >= 0.3, `wash 가 ${v} 다 — 요청은 '더 보이게' 였다`);
  assert.ok(v <= 0.5, `wash 가 ${v} 다 — 카드 사이가 사진으로 가득 차 글씨 바닥이 눈에 띄기 시작한다`);
});

test("사진 위에 뜨는 글씨 블록에는 바닥이 깔려 있다", () => {
  // 섹션 헤더 — 카드 밖이라 wash 위에 바로 앉는다.
  assert.match(head, /className=\{`page-bed /, "WorldSectionHead 에 page-bed 가 없다");
  // 탭 머리글 셋(기록·계획·함께).
  const beds = page.match(/page-bed/g) ?? [];
  assert.ok(beds.length >= 3, `탭 머리글 바닥이 ${beds.length}곳뿐이다 (기록·계획·함께 셋)`);
});
