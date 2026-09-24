// 홈·기록·계획·함께 IA 개편 lock. [2026-09-24]
// [사용자: "지금 메뉴가 너무 파편화 되어있는 것 같아 홈/기록/계획/함께 여기에서 모을 수 있는걸 다시 모으고 개편해보자"]
//
// 탭 하나 = 질문 하나: 홈은 오늘, 기록은 지난 우리, 계획은 앞으로, 함께는 서로 말 걸기.
// - 매일 하는 일 셋(3초 로그 · 기분 한 줄 · 오늘의 질문)은 홈 '오늘의 우리' 한 묶음 (예전: 홈 + 함께)
// - 활동함은 홈 머리글 🔔 (예전: 함께 탭 카드)
// - 작년 오늘 · 월간 리캡 · 이 달의 기분은 기록 › 추억 (예전: 함께 탭 + 일기장 안에 한 벌 더)
// - 다가오는 기념일 목록·편집·삭제는 계획 › 일정 (예전: 홈 — 고치는 곳이 둘)
// - 활동함 행은 **그 카드가 있는 화면**으로 간다 (예전: 기분·질문 → 홈인데 카드는 함께에 있었다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activityPresentation, activityRoute } from "./activity.ts";
import type { ActivityEvent } from "./couple.ts";

const root = join(import.meta.dirname, "..");
/** 주석을 지운 소스(README §10.5 — 설명문이 먼저 잡힌다). */
const code = (rel: string) =>
  readFileSync(join(root, rel), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const page = code("app/page.tsx");
const hub = code("components/TodayTogether.tsx");
const block = (from: string, to: string) => {
  const a = page.indexOf(from);
  const b = page.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `page 구조를 못 찾았다: ${from} → ${to}`);
  return page.slice(a, b);
};
const home = block('hidden={view !== "home"}', 'visited.has("records")');
const records = block('visited.has("records")', 'visited.has("plan")');
const plan = block('visited.has("plan")', 'visited.has("together")');
const together = block('visited.has("together")', 'visited.has("game")');

/** couple.ts 의 ActivityEvent kind 유니온 — 새 종류가 생기면 여기서 자동으로 잡힌다. */
const KINDS = (() => {
  const src = readFileSync(join(root, "lib/couple.ts"), "utf8");
  const m = /export type ActivityEvent = \{[\s\S]*?kind: ([^;]+);/.exec(src);
  assert.ok(m, "ActivityEvent.kind 를 못 찾았다");
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]) as ActivityEvent["kind"][];
})();

test("활동함의 모든 종류가 그 카드가 있는 화면으로 간다", () => {
  assert.ok(KINDS.length >= 8, `활동 종류가 ${KINDS.length}개뿐 — 파싱이 깨졌다`);
  const recordSubs = [...records.matchAll(/value: "(\w+)"/g)].map((m) => m[1]);
  const planSubs = [...plan.matchAll(/value: "(\w+)"/g)].map((m) => m[1]);
  for (const kind of KINDS) {
    const r = activityRoute(kind);
    if (r.view === "home") {
      assert.ok(r.focus, `${kind} 가 홈으로 가는데 어느 카드인지 모른다`);
      assert.match(hub, new RegExp(`id="${r.focus}"`), `${kind} → #${r.focus} 카드가 '오늘의 우리'에 없다`);
    } else if (r.view === "records") assert.ok(recordSubs.includes(r.sub), `${kind} → 기록 › ${r.sub} 칸이 없다`);
    else if (r.view === "plan") assert.ok(planSubs.includes(r.sub), `${kind} → 계획 › ${r.sub} 칸이 없다`);
    else assert.equal(r.view, "together");
  }
  // 예전 죽은 링크 — 기분·질문 답은 카드가 있는 홈의 그 카드로
  assert.deepEqual(activityRoute("mood"), { view: "home", focus: "today-mood" });
  assert.deepEqual(activityRoute("answer"), { view: "home", focus: "today-question" });
  assert.deepEqual(activityRoute("poke"), { view: "together" });
  // page 는 표(activityRoute)를 거친다 — 종류별 if 사다리를 다시 두지 않는다
  const open = page.slice(page.indexOf("function openActivityKind("), page.indexOf("function openActivityKind(") + 300);
  assert.match(open, /goRoute\(activityRoute\(kind\)\)/, "활동함 행이 경로 표를 안 거친다");
});

test("홈 = 오늘: 매일 하는 일 셋이 '오늘의 우리' 한 묶음에 있고 진행·연속 기록이 머리에 있다", () => {
  assert.ok(home.includes("<TodayTogether"), "홈에 '오늘의 우리' 묶음이 없다");
  for (const card of ["<TodayLogCard", "<MoodLine", "<DailyQuestion"]) assert.ok(hub.includes(card), `'오늘의 우리'에 ${card} 가 없다`);
  const order = ["today-log", "today-mood", "today-question"].map((id) => hub.indexOf(`id="${id}"`));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], "로그 → 기분 → 질문 순서가 아니다");
  assert.match(hub, /개 중 \$\{n\}개/, "머리에 '오늘 3개 중 N개' 진행이 없다");
  assert.ok(hub.includes("<StreakChip"), "머리에 연속 기록(모닥불)이 없다");
  // 진행은 카드가 자기 화면과 같은 기준으로 알려 준다(여기서 따로 조회하면 어긋난다)
  for (const f of ["TodayLogCard", "MoodLine", "DailyQuestion"]) {
    const src = code(`components/${f}.tsx`);
    assert.match(src, /onStatus\?\.\(/, `${f} 가 진행 상태를 알려 주지 않는다`);
  }
  assert.ok(!home.includes("<CoupleActivity"), "'우리 현황' 카드가 따로 돌아왔다 — 스트릭은 '오늘의 우리' 머리에 있다");
});

test("홈의 일정은 '다음 일정' 한 줄 — 목록·편집·삭제는 계획 › 일정 한 곳", () => {
  assert.ok(!home.includes("다가오는 기념일"), "홈에 기념일 목록이 돌아왔다 — 고치는 곳이 둘이 된다");
  assert.ok(!home.includes("openEditEvent") && !home.includes("removeEvent"), "홈에서 일정을 고치거나 지운다");
  assert.ok(home.includes("다음 일정") && home.includes('goPlan("cal")'), "홈에 계획으로 가는 '다음 일정' 한 줄이 없다");
  assert.ok(plan.includes("다가오는 기념일"), "계획 › 일정에 다가오는 기념일이 없다");
  assert.ok(plan.includes("openEditEvent") && plan.includes("removeEvent"), "기념일 편집·삭제가 계획에 없다");
  assert.ok(plan.indexOf("다가오는 기념일") < plan.indexOf("<Calendar"), "다가오는 기념일이 캘린더 위에 있지 않다");
});

test("기록 = 지난 우리: 추억 칸이 작년 오늘·월간 리캡·이 달의 기분을 모은다", () => {
  assert.ok(records.includes("<MemoriesRecap"), "기록에 추억 칸이 없다");
  const deco = code("components/DecoBook.tsx");
  assert.ok(!deco.includes("onThisDay") && !deco.includes("이번 달 우리 기분"), "일기장 안에 작년 오늘·기분 요약이 다시 한 벌 생겼다");
  const recap = code("components/MemoriesRecap.tsx");
  assert.ok(recap.includes("recap.moods"), "추억 칸에 이 달의 기분이 없다");
  assert.ok(!recap.includes("onOpenRecords"), "추억 칸 안에 '전체 기록 보러 가기'(바로 위 세그먼트와 같은 문)가 돌아왔다");
  // 홈엔 있는 날에만 한 장 — 가벼운 조회로(전체 스냅샷은 홈이 열릴 때마다 부르기엔 무겁다)
  assert.ok(home.includes("<MemoryTeaser"), "홈의 '작년 오늘' 한 장이 없다");
  const teaser = code("components/MemoryTeaser.tsx");
  assert.ok(teaser.includes("listOnThisDaySnapshot") && !teaser.includes("listMemorySnapshot("), "홈 티저가 전체 스냅샷을 받는다");
  assert.match(teaser, /if \(!found\) return null/, "작년 오늘이 없는 날에도 빈 카드를 그린다");
});

test("🔔 활동함은 홈 머리글 — 연결된 커플만, 안 읽은 개수와 함께", () => {
  const hw = code("components/HomeWorld.tsx");
  assert.match(hw, /onOpenInbox && \(/, "종이 항상 보인다(연결 전엔 활동이 없다)");
  assert.match(hw, /inboxUnread > 0 &&/, "안 읽은 개수 배지가 없다");
  assert.match(page, /onOpenInbox=\{coupleId \? openInbox : undefined\}/, "연결 전에도 종을 넘긴다");
  assert.match(page, /<ActivityList[\s\S]{0,200}since=\{inboxSheet\.since\}/, "시트를 연 순간의 읽음 시각으로 새 소식을 칠하지 않는다");
  // 열자마자 읽음 처리 → 지금의 lastRead 로 칠하면 새 소식 표시가 바로 사라진다
  const list = code("components/ActivityInbox.tsx");
  assert.match(list, /event\.created_at > since/, "새 소식 표시가 since 를 안 본다");
  assert.ok(!together.includes("<ActivityList"), "활동함이 함께 탭에도 있다");
});

test("활동함 문장: 내 활동은 '나님이'가 아니라 '내가'", () => {
  const ev = { id: "e", couple_id: "c", actor_user: "me", kind: "photo", entity_id: null, summary: null, metadata: {}, created_at: "2026-09-24T00:00:00Z" } as const;
  assert.equal(activityPresentation({ ...ev, metadata: {} }, [], "me").title, "내가 사진을 올렸어요");
  assert.equal(activityPresentation({ ...ev, metadata: {}, actor_user: "p" }, [], "me").title, "상대님이 사진을 올렸어요");
});

test("알림을 누르면 제자리로 — ?go=<활동 종류>, 활동함과 같은 경로 표", async () => {
  const { goKindOf, pushUrlFor, ACTIVITY_KINDS } = await import("./activity.ts");
  assert.deepEqual([...ACTIVITY_KINDS].sort(), [...KINDS].sort(), "알림 경로가 모르는 활동 종류가 있다");
  for (const k of KINDS) assert.equal(goKindOf(new URL(pushUrlFor(k), "https://x.test/our-days/").searchParams.get("go")), k);
  for (const bad of [null, undefined, "", "weather", "__proto__", "toString"]) assert.equal(goKindOf(bad), null, `?go=${bad} 를 받아들였다`);

  // SW 의 주소 정화(같은 앱 경로 안만)를 그대로 통과해야 한다 — sw.js 의 함수를 꺼내 실제로 돌린다
  const sw = readFileSync(join(root, "..", "public", "sw.js"), "utf8");
  const fnSrc = (name: string) => {
    const a = sw.indexOf(`function ${name}(`);
    let depth = 0;
    for (let i = sw.indexOf("{", a); i < sw.length; i++) {
      if (sw[i] === "{") depth++;
      else if (sw[i] === "}" && --depth === 0) return sw.slice(a, i + 1);
    }
    throw new Error(name);
  };
  const self = { registration: { scope: "https://doyeonkr.github.io/our-days/" }, location: { href: "https://doyeonkr.github.io/our-days/sw.js" } };
  const target = new Function("self", `${fnSrc("appRootUrl")}\n${fnSrc("notificationTargetUrl")}\nreturn notificationTargetUrl;`)(self) as (u: string) => string;
  assert.equal(target(pushUrlFor("mood")), "https://doyeonkr.github.io/our-days/?go=mood");
  assert.equal(target("https://evil.test/?go=mood"), "https://doyeonkr.github.io/our-days/", "다른 오리진으로 보낸다");

  // 열린 앱엔 postMessage 로 전한다(예전엔 focus 만 해서 보던 화면 그대로였다)
  const click = sw.slice(sw.indexOf('addEventListener("notificationclick"'));
  assert.match(click, /postMessage\(\{ type: "openRoute", url \}\)/, "열린 앱에 갈 곳을 전하지 않는다");
  assert.match(page, /d\?\.type === "openRoute"/, "앱이 openRoute 메시지를 안 받는다");
  assert.match(page, /searchParams\.get\("go"\)/, "앱이 부팅 때 ?go= 를 안 읽는다");
  assert.match(page, /searchParams\.delete\("go"\)/, "?go= 를 주소에 남겨 두면 새로고침마다 끌려간다");

  // 보내는 쪽 — 카테고리 기본값 + 한 카테고리가 두 카드를 가리키는 곳(오늘의 질문 답)은 직접 지정
  const notify = code("lib/notify.ts");
  for (const [cat, kind] of [["poke", "poke"], ["log", "log"], ["diary", "diary"], ["interact", "diary"], ["bucket", "bucket"], ["moodq", "mood"]])
    assert.match(notify, new RegExp(`${cat}: "${kind}"`), `${cat} 알림이 갈 곳(${kind})이 없다`);
  assert.match(notify, /url: pushUrlFor\(target\)/, "이벤트 푸시가 url 을 안 싣는다");
  assert.match(code("components/DailyQuestion.tsx"), /sendEventPush\([^)]*"answer"\)/, "질문 답 알림이 기분 카드로 간다");
  assert.match(code("lib/push.ts"), /url: pushUrlFor\("poke"\)/, "쿡 알림이 쿡 채팅으로 안 간다");
});
