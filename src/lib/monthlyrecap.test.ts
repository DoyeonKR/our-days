// 2026-11-05 사용자 요청 잠금 — 사파리 하단 바 · 공유 카드 겹침 · 일기 질문 제거 · 매달 팝업 · 일기책.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { previousMonth, recapHighlights, recapPopupMonth } from "./recappopup.ts";
import { bookPages } from "./diarybook.ts";
import { RECAP_LAYOUT } from "./recapcard.ts";

const src = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");
const recap = (o = {}) => ({ monthKey: "2026-10", diaries: 1, photos: 1, logs: 1, answers: 1, activeDays: 20, topMood: null, moods: [], total: 40, ...o });

test("공유 카드 — 사진이 글자를 가리지 않는다 [사용자 캡처]", () => {
  const { photoBottom, lineTop, statTop, labelBottom, height } = RECAP_LAYOUT;
  assert.ok(photoBottom < lineTop, "사진이 요약 글을 덮는다");
  assert.ok(lineTop < statTop, "요약 글과 숫자가 겹친다");
  assert.ok(labelBottom <= height - 40, "아래 글자가 카드 끝에 닿는다");
});

test("팝업 — 그달 처음 여는 날(1~7일) 한 번, 지난달을 보여 준다", () => {
  assert.equal(previousMonth("2026-11-01"), "2026-10");
  assert.equal(previousMonth("2027-01-03"), "2026-12");
  assert.equal(recapPopupMonth("2026-11-01", null), "2026-10");
  assert.equal(recapPopupMonth("2026-11-05", "2026-09"), "2026-10");
  assert.equal(recapPopupMonth("2026-11-01", "2026-10"), null, "한 달에 한 번");
  assert.equal(recapPopupMonth("2026-11-08", null), null);
});

test("팝업 이야기 — 그 달 날수 · 늘어난 만큼 · 사진 많은 날", () => {
  const l = recapHighlights(recap(), recap({ total: 30 }), ["2026-10-18", "2026-10-18", "2026-10-02"]);
  assert.deepEqual(l, ["10월 31일 중 20일을 함께 기록했어요", "지난달보다 10개의 순간을 더 남겼어요", "10월 18일에 사진을 가장 많이 남겼어요 · 2장"]);
  assert.equal(recapHighlights(recap(), recap({ total: 90 }), []).length, 1, "줄어든 건 굳이 말하지 않는다");
});

test("일기책 쪽 나누기 — 차례의 쪽 번호가 달 표제지를 가리킨다", () => {
  const e = (id: string, entry_date: string) => ({ id, entry_date, title: null, body: null, location: null, mood_emoji: null, hashtags: [], photo_urls: [], created_by: "u" });
  const pages = bookPages([e("c", "2026-02-01"), e("a", "2026-01-02"), e("b", "2026-01-09")]);
  assert.deepEqual(pages.map((p) => p.kind), ["cover", "toc", "month", "entry", "entry", "month", "entry", "end"]);
  const toc = pages[1];
  assert.ok(toc.kind === "toc");
  for (const m of toc.months) {
    const at = pages[m.page];
    assert.ok(at.kind === "month" && at.month === m.month);
  }
});

test("일기 쓰기에 질문이 없다", () => {
  const deco = read("components/DecoBook.tsx");
  assert.doesNotMatch(deco, /todaysQuestion|todaysMoodPrompt|오늘의 쓸 거리/);
});

test("iOS 는 문서가 아니라 main 이 스크롤한다 — 문서가 안 움직이면 fixed 도 안 따라온다 [사용자 영상]", () => {
  const css = read("app/globals.css");
  assert.match(css, /html:has\(\.app-scroller\),\s*body:has\(\.app-scroller\) \{[^}]*overflow: hidden/);
  assert.match(css, /\.app-scroller \{[^}]*height: 100dvh[^}]*overflow-y: auto/);
  const page = read("app/page.tsx");
  assert.match(page, /<main className="app-scroller relative /);
  assert.ok(page.indexOf("cover-wash") > page.indexOf('<main className="app-scroller'), "대표사진은 main 안에 있어야 같이 스크롤된다");
  assert.ok(read("lib/scrollLock.ts").includes("pageScroller()"), "스크롤 잠금이 안쪽 영역을 안 잠근다");
  for (const f of ["app/page.tsx", "components/GameWindowGuard.tsx"]) assert.doesNotMatch(read(f), /window\.scroll(To|Y)/, f);
});
