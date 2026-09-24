// 홈·기록·계획·함께 탭 UX 리뷰(2026-09-23) lock.
//
// 로컬 모드(백엔드 없음) 실화면 + 375×812 / 320×640 실측으로 찾은 것들이다.
// 대부분 "보기엔 멀쩡한데 특정 상태에서만" 깨지는 종류라 소스 계약으로 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
/** 주석을 지운 소스 — 이 저장소는 '왜'를 주석에 길게 남겨서 설명문이 먼저 잡힌다(README §10.5). */
const code = (rel: string) =>
  readFileSync(join(root, rel), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const hw = code("components/HomeWorld.tsx");
const page = code("app/page.tsx");

/** className 안의 `top-{[}Npx{]}` 값을 읽는다(문서에 통짜 클래스를 쓰면 Tailwind 가 주워 간다). */
function pxTop(src: string, marker: string): number {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, `표지를 못 찾았다: ${marker}`);
  const m = src.slice(Math.max(0, i - 400), i + 400).match(/top-\[(\d+)px\]/);
  assert.ok(m, `${marker} 근처에 px 단위 top 이 없다 — %로 되돌리면 사진 높이(고정 px)와 다시 어긋난다`);
  return Number(m[1]);
}

test("히어로 헤더는 safe-area 인셋을 두 번 더하지 않는다 (아이폰 홈 화면 앱)", () => {
  // <main> 이 이미 인셋만큼 내려 준다. 히어로 헤더가 또 더하면 인셋(47~59px)만큼 헤더만 더 내려와
  // 사진줄 위에 얹힌다. 브라우저 탭에선 인셋이 0 이라 안드로이드·데스크톱에선 절대 안 보인다.
  assert.match(page, /<main className="[^"]*pt-\[env\(safe-area-inset-top\)\]/, "main 이 인셋을 맡는 전제가 깨졌다");
  const header = hw.slice(hw.indexOf("absolute inset-x-0 top-0 z-20"), hw.indexOf("<h1"));
  assert.ok(header.length > 0, "히어로 헤더를 못 찾았다");
  assert.ok(!header.includes("safe-area-inset-top"), "히어로 헤더가 인셋을 또 더한다 — main 과 이중 적용");
});

test("사진줄은 헤더 아래, D-day 숫자는 사진줄 아래에서 시작한다", () => {
  const strip = pxTop(hw, 'aria-label={hung.length ?');
  const dday = pxTop(hw, "nDays.toLocaleString()");
  // 헤더: pt 0.7rem(11.2) + 설정 버튼 h-8(32) = 43
  assert.ok(strip >= 43, `사진줄(${strip}px)이 헤더(~43px)와 겹친다 — 첫 폴라로이드가 '하루' 제목 밑으로 들어간다`);
  // 폴라로이드 = 사진 62 + 위 패딩 4 + 아래 패딩 8, 장마다 marginTop 최대 6.
  // 숫자 줄 상자는 글리프보다 6px 위에서 시작한다(Galmuri 72px 실측) — 그만큼은 겹쳐도 안 보인다.
  const photo = Number(hw.match(/block h-\[(\d+)px\] w-\[\d+px\] object-cover/)?.[1]);
  assert.ok(photo > 0, "빨랫줄 사진 크기를 못 읽었다");
  const maxDrop = Math.max(...(hw.match(/marginTop: \[([\d, ]+)\]/)?.[1].split(",").map(Number) ?? [NaN]));
  assert.ok(Number.isFinite(maxDrop), "사진 marginTop 배열을 못 읽었다");
  const stripBottom = strip + photo + 4 + 8 + maxDrop;
  assert.ok(
    dday + 6 >= stripBottom,
    `D-day 숫자(글리프 ${dday + 6}px~)가 사진줄 바닥(${stripBottom}px)보다 위다 — 사진 4장이 숫자를 가린다`,
  );
  // 아래로는 펫 컬럼(말풍선 밴드 78 + 무대 128 + 이름행 32 + 여백 6)이 히어로 바닥에서 올라온다.
  const heroMin = Number(hw.match(/minHeight: (\d+)/)?.[1]);
  assert.ok(heroMin > 0, "히어로 최소 높이를 못 읽었다");
  const ddayBottom = dday + 76 + 4 + 22; // 숫자 줄 76 + mt-1 + 아랫줄
  assert.ok(
    ddayBottom <= heroMin - (78 + 128 + 32 + 6),
    `D-day 블록 바닥(${ddayBottom}px)이 최소 높이(${heroMin})에서 펫 말풍선 밴드를 침범한다`,
  );
});

test("이름 줄은 숫자 위가 아니라 아래에 있다", () => {
  // 예전엔 숫자 위(y80~106)에 '나 ♥ 상대'를 얹어서 사진이 4장 걸리면 가운데 두 장이 이름을 덮었다.
  const block = hw.slice(hw.indexOf("nDays.toLocaleString()") - 1200, hw.indexOf("nDays.toLocaleString()") + 2600);
  const digits = block.indexOf("nDays.toLocaleString()");
  const names = block.indexOf("{partnerName}");
  assert.ok(names > digits, "상대 이름이 D-day 숫자보다 먼저(위에) 그려진다");
  assert.ok(!/PIXEL_HEART\} size=\{8\} className="inline-block" \/>…/.test(hw), "상대 자리의 '…' 자리표시가 돌아왔다");
});

test("오늘의 경사 리본이 숫자 한가운데에 뜨지 않는다", () => {
  // 예전엔 top 30%(470 높이에서 y141)에 따로 떠서 100일·기념일 당일의 숫자를 가렸다.
  assert.ok(!/top-\[30%\] z-20/.test(hw), "리본이 다시 독립 레이어로 떠 있다");
  const block = hw.slice(hw.indexOf("nDays.toLocaleString()"), hw.indexOf("nDays.toLocaleString()") + 2600);
  assert.ok(block.includes("occ.label"), "리본은 D-day 블록 안(숫자 아랫줄)에 있어야 한다");
});

test("펫 말풍선의 꼬리가 잘리지 않는다", () => {
  // line-clamp 는 overflow:hidden 을 같이 건다. 꼬리를 품은 몸통에 걸면 꼬리가 통째로 잘린다.
  const bubble = code("components/island/PetBubble.tsx");
  const body = bubble.match(/className=\{`relative [^`]*`\}/)?.[0];
  assert.ok(body, "말풍선 몸통을 못 찾았다");
  assert.ok(!body.includes("line-clamp"), "줄 수 제한이 꼬리를 품은 몸통에 걸렸다 — 꼬리가 잘린다");
  assert.ok(/<span className="line-clamp-3">\{text\}<\/span>/.test(bubble), "글자에만 줄 수 제한을 건다");
});

test("한국어는 어절 단위로 줄을 바꾼다", () => {
  const css = readFileSync(join(root, "app", "globals.css"), "utf8");
  const body = [...css.matchAll(/(^|\n)body \{[^}]*\}/g)].map((m) => m[0]).join("\n");
  assert.match(body, /word-break: keep-all/, "기본값이면 '챙겨드 / 려요'처럼 낱말 가운데가 잘린다");
  // keep-all 만 걸면 긴 어절이 넘치고, flex 아이템의 최소 폭이 어절 전체로 커진다.
  assert.match(body, /overflow-wrap: anywhere/, "긴 어절의 안전망(anywhere)이 없다");
});

test("연결 전 빈 화면은 막다른 길이 아니다", () => {
  // 연결은 '함께' 탭에서만 된다. 빈 화면마다 그리로 가는 버튼이 있어야 한다.
  const cf = code("components/ConnectFirst.tsx");
  assert.ok(cf.includes("onConnect") && cf.includes("커플 연결하러 가기"), "공용 빈 화면에 연결 버튼이 없다");
  for (const f of ["components/DecoBook.tsx", "components/PhotoAlbum.tsx", "components/BucketList.tsx"]) {
    const src = code(f);
    assert.match(src, /<ConnectFirst[\s\S]*?onConnect=\{onConnect\}/, `${f} 의 연결 전 화면에 연결 버튼이 없다`);
    assert.ok(!/커플 연결 후[^<]*<\/p>/.test(src), `${f} 가 버튼 없는 옛 빈 카드를 따로 찍고 있다`);
  }
  assert.match(page, /<ConnectFirst[\s\S]*?onConnect=\{\(\) => setView\("together"\)\}/, "오늘 로그 빈 화면에 연결 버튼이 없다");
  for (const comp of ["DecoBook", "PhotoAlbum", "BucketList"]) {
    const use = page.slice(page.indexOf(`<${comp}`), page.indexOf("/>", page.indexOf(`<${comp}`)));
    assert.ok(use.includes('setView("together")'), `page 가 ${comp} 에 연결 경로를 안 넘긴다`);
  }
  // 버킷리스트는 연결 장소를 '홈'이라고 잘못 가리켰다
  assert.ok(!code("components/BucketList.tsx").includes("홈에서 상대와 연결"), "틀린 안내(홈에서 연결)가 돌아왔다");
});

test("세그먼트 아래에 제목을 한 번 더 찍지 않는다", () => {
  // '우리의 기록 → [세그먼트] → 우리의 기록 / 일기장' 처럼 두 겹이었고, 뷰마다 서체·크기도 달랐다.
  // 제목 요소는 스크린리더용으로 남긴다(heading.test — 뷰마다 h1 하나).
  for (const f of ["DecoBook.tsx", "PhotoAlbum.tsx", "BucketList.tsx", "Calendar.tsx", "MemoriesRecap.tsx"]) {
    const src = code(`components/${f}`);
    assert.match(src, /<h1 className="sr-only">/, `${f} 의 제목이 다시 눈에 보이는 큰 제목이 됐다`);
    assert.ok(!/className="eyebrow"/.test(src), `${f} 가 페이지 머리말(eyebrow)을 한 번 더 찍는다`);
  }
});

test("같은 일을 하는 버튼을 나란히 두지 않는다", () => {
  const cal = code("components/Calendar.tsx");
  assert.match(cal, /selItems\.length > 0 && \(\s*<button\s+onClick=\{\(\) => onAddOnDate\(selIso\)\}/, "빈 날에도 머리 '추가'가 '이 날 일정 추가'와 나란히 뜬다");
  const deco = code("components/DecoBook.tsx");
  assert.match(deco, /entries\.length > 0\) && \(/, "빈 일기장에 '오늘 쓰기'와 '첫 일기 쓰기'가 같이 뜬다");
});

test("일정 시트의 저장 버튼은 스크롤 밖 발판에 있다", () => {
  // 본문 1,039px / 보이는 높이 731px — 예전엔 '추가하기'가 화면 아래 300px 밖이었다.
  const start = page.indexOf("function AddEvent(");
  const add = page.slice(start, page.indexOf("function Settings(", start));
  const footer = add.slice(add.indexOf("footer={"), add.indexOf("footer={") + 1400);
  assert.ok(add.includes("footer={"), "AddEvent 가 발판을 안 쓴다");
  assert.ok(footer.includes('"추가하기"'), "저장 버튼이 발판 밖(스크롤 본문)에 있다");
  assert.ok(footer.includes('role="alert"'), "저장 오류가 발판 밖이면 스크롤 아래에 숨는다");
  const sheet = page.slice(page.indexOf("function Sheet("));
  assert.match(sheet, /min-h-0 flex-1 space-y-4 overflow-y-auto/, "시트 본문만 스크롤해야 발판이 고정된다");
});

test("커플 연결 해제는 보내기 버튼 밑에 없고, 잃는 것을 다 말한다", () => {
  const cs = code("components/CoupleSync.tsx");
  const input = cs.indexOf('aria-label="보내기"');
  const leave = cs.indexOf("onClick={handleLeave}");
  assert.ok(input > 0 && leave > input, "구조가 바뀌었으면 이 테스트도 같이 고쳐라");
  const between = cs.slice(input, leave);
  assert.ok(between.includes("<details"), "연결 해제가 접힌 칸 밖 — 하루 수십 번 누르는 보내기 버튼 바로 밑이다");
  const detail = cs.slice(cs.indexOf("async function handleLeave"), cs.indexOf("setBusy(true)", cs.indexOf("async function handleLeave")));
  for (const word of ["일기", "사진", "일정", "우리 섬"]) {
    assert.ok(detail.includes(word), `연결 해제 확인창이 '${word}'이(가) 안 보이게 된다는 걸 말하지 않는다`);
  }
});

test("홈 빠른 버튼은 이동이 아니라 동작이다", () => {
  // 예전 '기록 남기기·일정 보기·우리 소식'은 하단 탭과 같은 곳으로 가는 두 번째 문이었다.
  const quick = page.slice(page.indexOf('aria-label="빠른 실행"') - 2400, page.indexOf('aria-label="빠른 실행"'));
  assert.ok(quick.length > 0, "빠른 실행 줄을 못 찾았다");
  for (const old of ['"기록 남기기"', '"일정 보기"', '"우리 소식"']) {
    assert.ok(!quick.includes(old), `옛 이동 버튼 ${old} 이 돌아왔다`);
  }
  assert.match(quick, /"일기 쓰기"[\s\S]*?setDiaryComposeReq/, "'일기 쓰기'가 작성 창을 바로 열지 않는다");
  assert.match(quick, /"일정 추가"[^}]*openAddEvent\(undefined, "plan"\)/, "'일정 추가'가 일정(한 번) 종류로 열리지 않는다");
  // 연결 전엔 일기·쿡을 못 쓴다 — 막다른 버튼을 보이지 않는다
  const solo = quick.slice(quick.indexOf(": ["));
  assert.ok(!solo.includes('"일기 쓰기"') && !solo.includes('"쿡 찌르기"'), "연결 전에도 일기·쿡 버튼이 보인다");
  const deco = code("components/DecoBook.tsx");
  assert.match(deco, /composeReq === composeReqRef\.current/, "DecoBook 이 composeReq 를 한 번씩만 처리하지 않는다");
});

test("캘린더에서 여는 새 일정은 기념일(매년)이 아니라 일정이다", () => {
  // "이 날 일정 추가"가 '기념일 추가 · 매년 반복'으로 열려 치과 예약이 해마다 반복되는 기념일이 됐다.
  const open = page.slice(page.indexOf("function openAddEvent("), page.indexOf("function openAddEvent(") + 400);
  assert.match(open, /category \?\? \(date \? "plan" : "anniversary"\)/, "날짜를 들고 온 새 일정의 기본 종류가 일정이 아니다");
  const add = page.slice(page.indexOf("function AddEvent("), page.indexOf("function Settings("));
  assert.match(add, /recurrence: initialCategory === "plan" \? "none" : "yearly"/, "일정인데 기본 반복이 매년이다");
  assert.match(add, /category: initialCategory,/, "새 일정의 기본 종류가 고정값이다");
});

test("함께 탭은 서로 말 걸기(쿡)와 연결만 — 액자·기분·질문·활동함·추억은 제자리로 갔다", () => {
  // 2026-09-23 엔 액자를 쿡 채팅 아래로 내렸고(첫 화면 밖으로 밀던 문제), 2026-09-24 IA 개편에서 아예 뺐다 —
  // 같은 대표사진이 홈 히어로·사진첩·함께 세 곳에 걸려 있었다.
  const cs = code("components/CoupleSync.tsx");
  assert.ok(!cs.includes("CoverFrame"), "대표사진 액자가 함께 탭에 돌아왔다(홈 히어로·사진첩에 이미 있다)");
  assert.ok(cs.includes('aria-label="보내기"'), "쿡 입력창이 사라졌다");
  const together = page.slice(page.indexOf('visited.has("together")'), page.indexOf('visited.has("game")'));
  for (const moved of ["<MoodLine", "<DailyQuestion", "<ActivityList", "<ActivityInbox", "<MemoriesRecap"]) {
    assert.ok(!together.includes(moved), `${moved} 가 다시 함께 탭에 붙었다 — 홈 '오늘의 우리'·🔔·기록 › 추억으로 옮긴 것이다`);
  }
});
