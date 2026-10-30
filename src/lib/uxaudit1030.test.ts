// 2026-10-30 UX 점검 lock. [사용자: "ux 적으로 개선할것들 체크해" → "다 고쳐서 배포까지 해줘"]
// 실제 계정으로 전 화면을 훑고 찾은 것들 — 되돌아오지 않게 소스로 잠근다(주석은 지우고 본다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { glueEdgeEmoji, normalizeHomeAppearance } from "./homePersonalization.ts";

const code = (...p: string[]) =>
  readFileSync(join(import.meta.dirname, "..", ...p), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/[^\n]*/gm, "");

test("일기 목록은 나눠 그리고 긴 글은 접는다 — 197편을 한 번에 펼치면 탭이 24만 px 였다", () => {
  const diary = code("components", "DecoBook.tsx");
  assert.match(diary, /const DIARY_PAGE = 10;/);
  assert.match(diary, /groupByMonth\(filtered\.slice\(0, shown\)\)/);
  assert.match(diary, /지난 일기 더 보기/);
  // 본문 접기(더 보기)는 사용자가 빼도 된다고 했다 [2026-10-30 "더보기는 뺴도 괜찮아"] — 나눠 불러오기만 남긴다
  assert.doesNotMatch(diary, /line-clamp-6|DiaryBody/);
});

test("홈 — 같은 일을 하는 버튼을 두 번 두지 않는다 · 끝맺음은 맨 끝", () => {
  const page = code("app", "page.tsx");
  assert.match(page, /\{nextMs && <HomeNextPlan /, "다가오는 일정이 없을 때 빈 카드의 '일정 추가하기'가 빠른 실행 '일정 추가'와 겹친다");
  assert.ok(page.indexOf("<HomeJournalEnd") > page.indexOf("<CoupleSync"), "끝맺음 카드가 쿡 찌르기보다 위에 있다");
  const together = code("components", "TodayTogether.tsx");
  assert.match(together, /\{n < STEPS\.length && <ol className="home-daily-steps"/, "다 끝난 날에도 진행 칩이 카드 셋을 한 번 더 말한다");
});

test("홈 머리말은 한국어 · 상대가 없으면 하트도 없다", () => {
  const files = ["HomeExperience.tsx", "HomeFollowUp.tsx", "TodayTogether.tsx", "TodayLogCard.tsx", "MoodLine.tsx", "DailyQuestion.tsx", "CoupleSync.tsx"];
  for (const f of files) {
    assert.doesNotMatch(code("components", f), /LITTLE MOMENTS|TODAY’S CHAPTER|OUR NEXT CHAPTER|TO BE CONTINUED|A LITTLE LOVE NOTE|DEAR YOU|FOR US|· MOMENT|· FEELING/, f);
  }
  assert.ok(!code("components", "HomeExperience.tsx").includes('"우리의 이야기"'), "상대 이름 자리에 문구가 들어간다");
  assert.equal(normalizeHomeAppearance({ story: "OUR STORY, STILL GROWING" }).story, "함께 쌓아 가는 중");
  assert.equal(normalizeHomeAppearance({ story: "함냐" }).story, "함냐", "사용자가 고친 문구는 그대로");
});

test("끝 이모지가 혼자 줄바꿈되지 않게 붙인다", () => {
  assert.equal(glueEdgeEmoji("🤍도요새와 팽나무🤍"), "🤍⁠도요새와 팽나무⁠🤍");
  assert.equal(glueEdgeEmoji("오늘도 우리 🤍"), "오늘도 우리 🤍", "앞이 띄어쓰기면 건드리지 않는다");
  assert.equal(glueEdgeEmoji("👩‍❤️‍👨 둘"), "👩‍❤️‍👨 둘", "ZWJ 이모지를 쪼개지 않는다");
  assert.equal(glueEdgeEmoji("하루"), "하루");
});

test("하늘 후광은 둥글다 — 네모 링이 달을 회색 액자에 넣었다", () => {
  const world = code("components", "HomeWorld.tsx");
  assert.equal((world.match(/borderRadius: 9999/g) ?? []).length, 2, "해·달 후광 둘 다 둥글어야 한다");
});

test("계획 — 다가오는 목록은 줄을 누르면 편집, 삭제는 편집 시트 안에서", () => {
  const page = code("app", "page.tsx");
  const plan = page.slice(page.indexOf('aria-label="다가오는 기념일"'), page.indexOf("<Calendar"));
  assert.match(plan, /다가오는 일정·기념일/);
  assert.ok(!plan.includes('name="trash"'), "다가오는 목록 줄에 휴지통이 돌아왔다");
  assert.match(page, /이 일정 삭제/);
});

test("로그 — 삭제는 수정과 생김새가 다르다", () => {
  const log = code("components", "TodayLog.tsx");
  assert.match(log, /vlog-film-danger/);
});

test("쿡 대화 상자는 페이지 스크롤을 가두지 않는다", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "components", "Poke.module.css"), "utf8");
  assert.match(css, /\.chat \{[^}]*overscroll-behavior-y:auto/);
});

test("처음 시작할 때 사귄 날을 오늘로 미리 채우지 않는다", () => {
  const page = code("app", "page.tsx");
  const onboard = page.slice(page.indexOf("function Onboarding"), page.indexOf("function UpcomingRow"));
  assert.match(onboard, /const \[date, setDate\] = useState\(""\);/);
  assert.match(onboard, /disabled=\{!date \|\| busy\}/);
});
