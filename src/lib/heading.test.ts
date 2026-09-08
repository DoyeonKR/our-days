// 제목 요소 lock. [배포본 실측 2026-09-08]
//
// 다섯 탭을 열어 heading 을 세어 보니 **홈과 기록(오늘 로그)에는 제목 요소가 0 개**였다.
// 보이는 큰 글씨는 전부 span/p 였고, 섹션 제목(WorldSectionHead)도 p 였다.
// 스크린리더 사용자는 제목으로 건너뛰는데, 목차가 비어 있으면 위에서부터 다 읽는 수밖에 없다.
//
// ⚠ 태그만 바꾸면 되고 **시각은 안 바뀐다** — Tailwind preflight 가 heading 의
//   font-size / font-weight / margin 을 리셋한다(배포본에서 h2 에 같은 클래스를 줘 보니
//   15px / 800 / margin 0 으로 span 과 동일했다). 그래서 디자인 협의 없이 고칠 수 있었다.
//
// 비활성 탭 패널은 display:none 이라 접근성 트리에서 빠진다 — 한 화면에 h1 이 하나만 노출된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f: string) =>
  readFileSync(join(import.meta.dirname, "..", "components", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("홈 히어로의 앱 이름이 이 화면의 제목이다", () => {
  const src = read("HomeWorld.tsx");
  assert.match(src, /<h1[^>]*>하루<\/h1>/, "홈에 heading 이 없다 — 탭 전체에 목차가 비어 있게 된다");
});

test("섹션 헤더는 h2 다", () => {
  const src = read("WorldSectionHead.tsx");
  assert.match(src, /<h2[^>]*>\{title\}<\/h2>/, "WorldSectionHead 제목이 heading 이 아니다");
});

test("오늘 로그에도 제목이 있다 (일기장·사진첩엔 있는데 여기만 없었다)", () => {
  const src = read("TodayLog.tsx");
  assert.match(src, /<h1 className="sr-only">/, "오늘 로그만 기록 탭 세 뷰 중 제목이 없다");
});

test("탭 서브뷰마다 제목이 하나씩 있다", () => {
  // 기록 = 오늘 로그 / 일기장 / 사진첩, 계획 = 캘린더 / 버킷리스트
  for (const f of ["DecoBook.tsx", "PhotoAlbum.tsx", "BucketList.tsx", "Calendar.tsx", "WeatherView.tsx"]) {
    const n = (read(f).match(/<h1[\s>]/g) ?? []).length;
    assert.equal(n, 1, `${f} 의 h1 이 ${n}개다 (1개여야 한다)`);
  }
});
