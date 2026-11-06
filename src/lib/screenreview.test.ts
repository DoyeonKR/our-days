// 화면 리뷰 lock [2026-11-06] (README §10.19) — 고친 것이 되돌아가지 않게.
// 소스 스캔은 주석을 먼저 지운다(README §10.5 — 설명문이 먼저 잡힌다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exportExt, exportFileName } from "./logreview.ts";
import { bookCover, bookPages, type BookReaderEntry } from "./diarybook.ts";
import { diaryBookHtml } from "./diary.ts";
import { recapPopupAllowed } from "./recappopup.ts";
import { fetchAllPages } from "./pagedfetch.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const code = (p: string) => strip(read(p));

test("3초 로그 저장 — 확장자는 실제 형식(quicktime → .mov · mp4 → .mp4 · webm → .webm)", () => {
  assert.equal(exportFileName("clip", "2026-11-06-am", "video/quicktime"), "our-3s-2026-11-06-am.mov");
  assert.equal(exportFileName("clip", "2026-11-06-am", "video/mp4"), "our-3s-2026-11-06-am.mp4");
  assert.equal(exportFileName("clip", "2026-11-06-am", "video/webm;codecs=vp8"), "our-3s-2026-11-06-am.webm");
  assert.equal(exportFileName("month", "2026-10", "video/mp4;codecs=avc1"), "our-3s-film-2026-10.mp4");
  // 형식을 모르면(스토리지가 비워 줌) 올릴 때 붙인 경로의 확장자
  assert.equal(exportExt("", "c/x/am.mov"), "mov");
  assert.equal(exportExt("application/octet-stream", "c/x/am.MP4"), "mp4");
  assert.equal(exportExt("", null), "webm");
  // 아는 형식이면 경로보다 형식이 먼저
  assert.equal(exportExt("video/quicktime", "c/x/am.webm"), "mov");
  const log = code("src/components/TodayLog.tsx");
  assert.match(log, /exportFileName\("clip", [^;]*blob\.type, log\.video_path\)/, "저장 버튼이 경로를 같이 넘긴다");
});

test("iOS 사진첩 미리 받기 — rootMargin 을 쓰는 관찰자는 root 를 준다(main 이 스크롤하면 뷰포트 margin 이 안 듣는다)", () => {
  const dir = join(ROOT, "src", "components");
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(join(d, f.name));
      else if (/\.tsx?$/.test(f.name)) files.push(join(d, f.name));
    }
  };
  walk(dir);
  for (const f of files) {
    const src = strip(readFileSync(f, "utf8"));
    for (const m of src.matchAll(/new IntersectionObserver\(/g)) {
      const call = src.slice(m.index, m.index + 600);
      if (/rootMargin/.test(call)) assert.match(call, /\broot:/, `${f}: rootMargin 이 있는데 root 가 없다 — observeInPage 를 쓴다`);
    }
  }
  assert.match(code("src/components/PhotoAlbum.tsx"), /observeInPage\(el, [\s\S]*?rootMargin: "600px"/);
  const ps = code("src/lib/pageScroll.ts");
  assert.match(ps, /new IntersectionObserver\(cb, \{ \.\.\.opts, root: pageScroller\(\) \}\)/);
  // 컴포넌트 · 화면은 window 스크롤을 직접 만지지 않는다(lib/pageScroll · scrollLock 만)
  for (const f of [...files, join(ROOT, "src/app/page.tsx")]) {
    const src = strip(readFileSync(f, "utf8"));
    assert.doesNotMatch(src, /window\.scrollY|window\.scrollTo\(|window\.pageYOffset/, `${f}: pageScroll 을 쓴다`);
  }
});

test("일기책 접근성 — 안 보이는 쪽은 inert · 움직임 줄이기면 바로 넘긴다", () => {
  const src = code("src/components/DiaryBookReader.tsx");
  assert.match(src, /aria-hidden=\{i !== at\} inert=\{i !== at\}/);
  assert.match(src, /prefers-reduced-motion: reduce/);
  assert.match(src, /behavior: still \? "auto" : "smooth"/);
});

test("일기책 순서 · 표지 — 같은 날은 먼저 쓴 것부터, 표지는 책 순서의 첫 사진", () => {
  const e = (id: string, entry_date: string, created_at: string, photo = ""): BookReaderEntry =>
    ({ id, entry_date, created_at, title: id, body: null, location: null, mood_emoji: null, hashtags: [], photo_urls: photo ? [photo] : [], created_by: "u" });
  // 목록은 최신순으로 온다
  const list = [e("late", "2026-03-02", "2026-03-02T22:00:00Z", "p-late"), e("early", "2026-03-02", "2026-03-02T08:00:00Z"), e("jan", "2026-01-05", "2026-01-05T09:00:00Z", "p-jan"), e("feb", "2026-02-01", "2026-02-01T09:00:00Z", "p-feb")];
  const ids = bookPages(list).flatMap((p) => (p.kind === "entry" ? [p.entry.id] : []));
  assert.deepEqual(ids, ["jan", "feb", "early", "late"]);
  assert.equal(bookCover(list), "p-jan", "표지 = 첫 사진(README §10.18)");
  assert.equal(bookCover([e("x", "2026-01-01", "a")]), undefined);
  // 인쇄도 같은 순서
  const html = diaryBookHtml(list, { title: "t", from: "2026-01-01", to: "2026-12-31", nameOf: () => "n" });
  assert.ok(html.indexOf("<h2>early</h2>") < html.indexOf("<h2>late</h2>"));
  assert.match(code("src/components/DiaryBookReader.tsx"), /bookCover\(entries\)/);
});

test("매달 팝업은 알림 · 링크로 가는 자리를 덮지 않는다 — 홈 탭을 직접 누르면 보인다", () => {
  assert.equal(recapPopupAllowed({ view: "home", routed: false, focusPending: false }), true);
  assert.equal(recapPopupAllowed({ view: "diary", routed: false, focusPending: false }), false);
  assert.equal(recapPopupAllowed({ view: "home", routed: true, focusPending: false }), false);
  assert.equal(recapPopupAllowed({ view: "home", routed: false, focusPending: true }), false);
  const page = code("src/app/page.tsx");
  assert.match(page, /searchParams\.has\("go"\)[^\n]*sessionStorage\.getItem\(PENDING_GO_KEY\)/, "?go= · 맡겨 둔 경로가 있으면 처음부터 미룬다");
  assert.match(page, /function goRoute\(route: AppRoute\) \{\s*setRecapHold\(true\);/);
  assert.match(page, /if \(next === "home"\) setRecapHold\(false\);/);
  assert.match(page, /focusPending: !!\(homeFocus \|\| photoFocus \|\| planFocus\)/);
  assert.match(page, /recapMonth && recapOk && <MonthlyRecapPopup/);
});

test("업데이트 칩은 탭 바 윗변(--gnb-top) 위에 — 바 자리와 같은 변수에서 나온다", () => {
  const css = read("src/app/globals.css");
  const root = /:root \{\s*--gnb-gap: (\d+)px;\s*--gnb-pad: (\d+)px;\s*--gnb-tab-h: (\d+)px;\s*--gnb-h: calc\(var\(--gnb-tab-h\) \+ 2 \* var\(--gnb-pad\) \+ 2px\);\s*--gnb-top: calc\(var\(--vv-bottom, 0px\) \+ env\(safe-area-inset-bottom\) \+ var\(--gnb-gap\) \+ var\(--gnb-h\)\);/.exec(css);
  assert.ok(root, "--gnb-* 변수 묶음");
  assert.match(css, /\.cosmic-gnb \{\s*bottom: calc\(var\(--vv-bottom, 0px\) \+ env\(safe-area-inset-bottom\) \+ var\(--gnb-gap\)\) !important;/);
  assert.match(css, /\.cosmic-gnb > div \{ padding: var\(--gnb-pad\); \}/);
  assert.match(css, /\.cosmic-gnb-tab \{ min-height: var\(--gnb-tab-h\);/);
  assert.match(code("src/components/UpdateChip.tsx"), /bottom: "calc\(var\(--gnb-top, [^"]+\) \+ 10px\)"/);
});

test("섬 '다음 목표'는 한 번만 말한다", () => {
  const src = code("src/components/IslandGame.tsx");
  assert.equal(src.match(/>다음 목표</g)?.length, 1);
});

test("크기 순위는 1000행 상한에서 잘리지 않는다 — 계열 · 순위 순으로 끝까지 받는다", async () => {
  const all = Array.from({ length: 2345 }, (_, i) => i);
  const seen: [number, number][] = [];
  const got = await fetchAllPages(async (from, to) => { seen.push([from, to]); return all.slice(from, to + 1); });
  assert.deepEqual(got, all);
  assert.deepEqual(seen, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.equal((await fetchAllPages(async (f, t) => all.slice(f, t + 1).slice(0, 1000), 1000, 2)).length, 2000, "상한 쪽수에서 멈춘다");
  const couple = code("src/lib/couple.ts");
  const fn = couple.slice(couple.indexOf("export async function getFishSizeBoardAll"), couple.indexOf("export async function getFishSizeBoard("));
  assert.match(fn, /fetchAllPages\(/);
  assert.match(fn, /rpc\("fish_size_board_all"\)\.order\("family"\)\.order\("rank"\)\.range\(from, to\)/);
});

test("iOS 맨 위로 — 지금 탭을 다시 누르면 스크롤 영역을 맨 위로 · 키보드가 올라오면 입력칸을 보이게", () => {
  const page = code("src/app/page.tsx");
  assert.match(page, /if \(next === view\) \{ pageScrollToTop\(\); return; \}/);
  const ps = code("src/lib/pageScroll.ts");
  assert.match(ps, /export function pageScrollToTop\(\)[\s\S]*?\(el \?\? window\)\.scrollTo\(\{ top: 0/);
  assert.match(ps, /export function revealFocusedField\(\)[\s\S]*?scrollIntoView\(\{ block: "nearest" \}\)/);
  const fit = code("src/components/ViewportFit.tsx");
  assert.match(fit, /if \(shrank\) requestAnimationFrame\(revealFocusedField\)/);
  assert.match(fit, /removeEventListener\("resize", onResize\)/);
});

test("매달 팝업의 공유는 팝업이 받은 사진 주소를 그대로 쓴다(다시 받지 않는다)", () => {
  const pop = code("src/components/MonthlyRecapPopup.tsx");
  assert.match(pop, /shareMonthCard\(coupleId, recap, urls \?\? undefined\)/);
  const share = code("src/lib/recapshare.ts");
  assert.match(share, /photoUrls \? Promise\.resolve\(\[\.\.\.photoUrls\]\) : monthCardPhotos\(/);
});
