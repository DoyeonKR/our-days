// 우리 연대기 잠금 [2026-11-13] — 합치기 · 정렬 · 달 묶기, 우리 사이 · 기념일, 섬 상태에서 게임 순간(날짜를 지어내지 않는다),
// 올해의 우리 카드 배치. 화면 · 가져오기는 OurChronicle · chronicledata(소스 계약만 본다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVOLVE_LINE,
  MAX_MONTHS_BACK,
  YEAR_MOMENTS_MAX,
  anniversaryItems,
  appendMonths,
  bossFirstDefeat,
  chronicleDateLabel,
  eventsHeldInYear,
  firstDiaryItem,
  firstLogItem,
  firstPhotoItem,
  floorMonth,
  gameMilestones,
  groupByMonth,
  itemsInMonths,
  mergeChronicle,
  monthCountsLine,
  monthsBack,
  relationshipMilestones,
  yearMonths,
  yearSummary,
  type ChronicleItem,
  type IslandSlice,
} from "./chronicle.ts";
import { YEAR_LAYOUT, clampLine, MOMENT_MAX_CHARS } from "./yearcard.ts";
import type { CoupleEvent } from "./dday.ts";

const src = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");
const item = (key: string, date: string, o: Partial<ChronicleItem> = {}): ChronicleItem => ({ key, kind: "diary", date, title: key, icon: "book", route: { view: "diary" }, ...o });
const name = (id: string) => (id === "me" ? "나" : "상대");

/* ── 합치기 · 정렬 · 묶기 ───────────────────────── */

test("합치기 — 최신 순 · 같은 key 하나 · 같은 날은 우리 사이 > 기념일 > 기록 > 게임, 경계만 아는 항목은 정확한 항목 뒤", () => {
  const out = mergeChronicle(
    [item("diary:a", "2026-03-02"), item("boss:x", "2026-03-05", { kind: "boss", approx: "before" })],
    [item("rel:d100", "2026-03-05", { kind: "days" }), item("diary:a", "2026-03-02", { title: "중복" })],
    [item("anniv:e:2026-03-05", "2026-03-05", { kind: "anniv" }), item("bad", "2026-3-5")],
  );
  assert.deepEqual(out.map((i) => i.key), ["rel:d100", "anniv:e:2026-03-05", "boss:x", "diary:a"]);
  assert.equal(out.find((i) => i.key === "diary:a")?.title, "diary:a", "먼저 온 쪽을 남긴다");
});

test("달 묶기 — 최신 달부터, 빈 달은 만들지 않고, 쪽을 넘어 같은 달은 한 머리로", () => {
  const g = groupByMonth([item("a", "2026-01-30"), item("b", "2026-03-01"), item("c", "2026-01-02")]);
  assert.deepEqual(g.map((m) => m.monthKey), ["2026-03", "2026-01"]);
  assert.deepEqual(g[1].items.map((i) => i.key), ["a", "c"]);
  const joined = appendMonths(g, groupByMonth([item("d", "2026-01-15"), item("e", "2025-12-31")]));
  assert.deepEqual(joined.map((m) => m.monthKey), ["2026-03", "2026-01", "2025-12"]);
  assert.deepEqual(joined[1].items.map((i) => i.key), ["a", "d", "c"]);
  assert.deepEqual(itemsInMonths([item("x", "2026-02-01"), item("y", "2026-04-01")], ["2026-02"]).map((i) => i.key), ["x"]);
});

test("쪽 넘기기 — 바닥 달 아래로 안 가고, 바닥은 아는 가장 이른 날(최대 MAX_MONTHS_BACK 달)", () => {
  assert.deepEqual(monthsBack("2026-02", 3, "2025-01"), ["2026-02", "2026-01", "2025-12"]);
  assert.deepEqual(monthsBack("2026-02", 3, "2026-01"), ["2026-02", "2026-01"]);
  assert.deepEqual(monthsBack("2025-12", 3, "2026-01"), []);
  assert.equal(floorMonth("2026-11-13", ["2025-04-02", null, "2024-12-25T10:00:00Z", "bad"]), "2024-12");
  assert.equal(floorMonth("2026-11-13", []), "2026-11", "아무것도 모르면 이번 달");
  assert.equal(floorMonth("2026-11-13", ["1990-01-01"]), "2006-11", `${MAX_MONTHS_BACK}달 위로는 안 간다`);
  assert.equal(floorMonth("2026-11-13", ["2030-01-01"]), "2026-11", "앞날은 바닥이 아니다");
});

/* ── 우리 사이 · 기념일 ─────────────────────────── */

test("우리 사이 — 시작한 날 · 100일 단위 · 주년(2/29 는 평년 2/28), 오늘 이후는 없다", () => {
  const all = relationshipMilestones("2024-02-29", "2024-01", "2026-12", "2026-11-13");
  const by = Object.fromEntries(all.map((i) => [i.key, i.date]));
  assert.equal(by["rel:start"], "2024-02-29");
  assert.equal(by["rel:d100"], "2024-06-07", "당일이 1일째 — 100일째는 99일 뒤");
  assert.equal(by["rel:y1"], "2025-02-28");
  assert.equal(by["rel:y2"], "2026-02-28");
  assert.equal(by["rel:d900"], "2026-08-16");
  assert.equal(by["rel:y3"], undefined, "3주년은 앞날");
  assert.ok(all.every((i) => i.date <= "2026-11-13"), "오늘 이후는 싣지 않는다");
});

test("우리 사이 — 범위 달 안의 것만, 시작일이 없으면 없다", () => {
  const all = relationshipMilestones("2024-02-29", "2024-01", "2026-12", "2026-11-13");
  const keys = new Set(all.map((i) => i.key));
  for (const k of ["rel:d100", "rel:d500", "rel:d900", "rel:y1", "rel:y2"]) assert.ok(keys.has(k), k);
  assert.ok(!keys.has("rel:d1000"), "1000일째(2026-11-24)는 아직");
  const inMarch = relationshipMilestones("2024-02-29", "2025-02", "2025-02", "2026-11-13");
  assert.deepEqual(inMarch.map((i) => i.key), ["rel:y1"]);
  assert.deepEqual(relationshipMilestones(null, "2024-01", "2026-12", "2026-11-13"), []);
});

test("기념일 — 기념일로 표시한 일정만, 그 달 회차(건너뛴 회차 · 앞날 제외), 누르면 그 일정", () => {
  const ev = (o: Partial<CoupleEvent>): CoupleEvent => ({ id: "e1", title: "처음 만난 날", date: "2023-05-10", repeatYearly: true, category: "anniversary", ...o });
  const events = [ev({}), ev({ id: "e2", title: "치과", date: "2026-05-03", repeatYearly: false, category: "plan" }), ev({ id: "e3", title: "매달", date: "2026-01-20", recurrence: "monthly", repeatYearly: false, skipDates: ["2026-05-20"] })];
  const may = anniversaryItems(events, "2026-05", "2026-11-13");
  assert.deepEqual(may.map((i) => i.key), ["anniv:e1:2026-05-10"]);
  assert.deepEqual(may[0].route, { view: "plan", sub: "cal", focus: "e1" });
  assert.equal(anniversaryItems(events, "2026-11", "2026-11-13").length, 0, "11월 20일은 앞날");
  assert.equal(anniversaryItems(events, "2026-06", "2026-11-13").map((i) => i.key).join(), "anniv:e3:2026-06-20");
  // 함께한 일정 — 종류 무관 · 오늘까지
  assert.equal(eventsHeldInYear(events, 2026, "2026-11-13"), 1 + 1 + 9, "처음 만난 날 1 · 치과 1 · 매달 1~10월 중 5월 건너뜀 = 9");
});

/* ── 그 달의 첫 기록 — 썸네일만 ─────────────────── */

test("첫 기록 — 썸네일만 싣고 원본으로 물러나지 않는다, 경로는 그 기록으로", () => {
  const d = firstDiaryItem({ id: "d1", entry_date: "2026-04-03", title: " 봄 ", thumb_paths: [null, "c/t.webp"] });
  assert.equal(d.thumbPath, "c/t.webp");
  assert.equal(d.sub, "봄");
  assert.deepEqual(d.route, { view: "diary", focus: "d1" });
  assert.equal(firstDiaryItem({ id: "d2", entry_date: "2026-04-03", title: null }).thumbPath, null, "옛 일기는 그림 없이");
  assert.equal(firstPhotoItem({ id: "p1", thumb_path: null, shot: "2026-04-05" }).thumbPath, null);
  assert.deepEqual(firstPhotoItem({ id: "p1", thumb_path: "c/p.webp", shot: "2026-04-05" }).route, { view: "records", sub: "photos", focus: "p1" });
  assert.equal(firstLogItem({ id: "l1", log_date: "2026-04-06", body: null, poster_path: "c/poster.jpg" }).thumbPath, "c/poster.jpg");
  const data = read("lib/chronicledata.ts");
  assert.doesNotMatch(data, /storage_path|photo_paths|video_path/, "원본 경로를 읽지 않는다");
  assert.match(data, /\.limit\(1\)/);
  assert.match(data, /limit\(BUCKET_CAP\)/);
  assert.match(data, /getMonthRecap/, "달 숫자는 서버 집계(memory_month_stats)");
  assert.match(data, /getIsland\(/, "섬은 읽기만(loadIsland 는 솔로 섬을 올릴 수 있다)");
  assert.doesNotMatch(data, /loadIsland|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/, "쓰지 않는다 · 새 RPC 없음");
});

/* ── 게임 — 저장에 날짜가 있는 것만 ─────────────── */

const SAMPLE: IslandSlice & Record<string, unknown> = {
  fishing: {
    bosses: {
      dolsoe: { hp: 1, at: "2026-11-05", tries: {}, caught: 1, until: "2026-11-12", last: { day: "2026-11-05", by: "me", dmg: {} } },
      neuti: { hp: 1, at: "2026-11-10", tries: {}, caught: 3, until: "2026-11-17", last: { day: "2026-11-10", by: "you", dmg: {} } },
      hongryeon: { hp: 1, at: "2026-11-08", tries: {}, caught: 2, until: "2026-11-15" },
      dammit: { hp: 0.4, at: "2026-11-11", tries: {}, caught: 0, until: "" },
      gwihyang: { hp: 1, at: "x", tries: {}, caught: 1, until: "" },
      nobody: { hp: 1, at: "2026-11-01", tries: {}, caught: 1, until: "2026-11-08", last: { day: "2026-11-01", by: "me", dmg: {} } },
    },
  },
  fishPlus: { awake: { dolsoe_awake: { hp: 1, at: "2026-11-12", tries: {}, caught: 1, until: "2026-11-19", last: { day: "2026-11-12", by: "me", dmg: {} } } } },
  feed: [
    { at: Date.parse("2026-11-09T16:30:00Z"), by: "you", msg: "🥚→🐣 아기 토끼(으)로 진화했어요! 🎉" },
    { at: Date.parse("2026-11-09T01:00:00Z"), by: "me", msg: "밭에 물을 줬어요" },
    { at: "어제", by: "me", msg: "🐣→🐰 토끼(으)로 진화했어요! 🎉" },
  ],
  // 날짜가 없는 기록 — 싣지 않는다
  aquarium: { tank: 9, fish: [] },
  aquaTankTop: 9,
  museum: ["dragon_5"],
  merge: { best: { me: 4096 }, top: { me: 11 } },
};

test("주인 — 한 번 잡았으면 그날, 여러 번이면 '이 날 이전'(다시 나오기까지 7일), last 가 없으면 until 로 경계, 그 밖은 싣지 않는다", () => {
  assert.deepEqual(bossFirstDefeat({ caught: 1, last: { day: "2026-11-05", by: "me", dmg: {} } }), { date: "2026-11-05" });
  assert.deepEqual(bossFirstDefeat({ caught: 3, last: { day: "2026-11-10", by: "me", dmg: {} } }), { date: "2026-10-27", approx: "before" });
  assert.deepEqual(bossFirstDefeat({ caught: 2, until: "2026-11-15" }), { date: "2026-11-01", approx: "before" });
  assert.equal(bossFirstDefeat({ caught: 1, until: "" }), null, "날짜도 경계도 없다");
  assert.equal(bossFirstDefeat({ caught: 0, last: { day: "2026-11-05", by: "me", dmg: {} } }), null);
  assert.equal(bossFirstDefeat(undefined), null);
});

test("섬 상태 → 게임 순간 — 날짜가 있는 주인 · 펫 진화만, 수조 단계 · 박물관 · 합치기 기록(날짜 없음)은 없다", () => {
  const got = gameMilestones(SAMPLE, name);
  const keys = got.map((i) => i.key).sort();
  assert.deepEqual(keys, ["boss:dolsoe", "boss:dolsoe_awake", "boss:hongryeon", "boss:neuti", `pet:${Date.parse("2026-11-09T16:30:00Z")}`].sort());
  const by = Object.fromEntries(got.map((i) => [i.key, i]));
  assert.equal(by["boss:dolsoe"].date, "2026-11-05");
  assert.equal(by["boss:dolsoe"].approx, undefined);
  assert.equal(by["boss:neuti"].approx, "before");
  assert.equal(by["boss:neuti"].sub, "지금까지 3번 토벌");
  assert.match(by["boss:dolsoe_awake"].title, /각성한 돌쇠/);
  const pet = got.find((i) => i.kind === "pet")!;
  assert.equal(pet.date, "2026-11-10", "소식 시각은 KST 날짜로(UTC 16:30 = 다음 날 01:30)");
  assert.equal(pet.title, "펫이 아기 토끼(으)로 진화했어요");
  assert.equal(pet.sub, "상대의 돌봄으로");
  assert.deepEqual(pet.route, { view: "game", open: "island" });
  for (const it of got) assert.match(it.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(gameMilestones(null, name), []);
  assert.deepEqual(gameMilestones({ fishing: null, feed: "x" } as IslandSlice, name), [], "모양이 어긋나도 던지지 않는다");
  assert.equal(chronicleDateLabel(by["boss:neuti"]), "10월 27일 이전");
});

test("진화 소식 줄 — 섬 엔진의 pushLog 문구와 맞는다", () => {
  const island = read("lib/island.ts");
  const m = /pushLog\(s, `\$\{from\.emoji\}→\$\{nf\.emoji\} \$\{nf\.name\}\(으\)로 진화했어요! 🎉`\)/.exec(island);
  assert.ok(m, "evolve() 의 문구가 바뀌었다 — EVOLVE_LINE 도 같이");
  const line = `🐣→🐰 ${"하얀 달토끼"}(으)로 진화했어요! 🎉`;
  assert.equal(EVOLVE_LINE.exec(line)?.[1].trim(), "하얀 달토끼");
});

/* ── 올해의 우리 ──────────────────────────────── */

const recap = (monthKey: string, total: number) => ({ monthKey, diaries: 1, photos: 2, logs: 3, answers: 0, activeDays: 4, topMood: null, moods: [], total });

test("올해의 우리 — 숫자 합 · 있는 것만 말한다(최대 넷)", () => {
  const rel = relationshipMilestones("2024-02-29", "2026-01", "2026-12", "2026-11-13");
  const fish = item("fish:5", "2026-11-03", { kind: "fish", title: "처음 낚은 전설 물고기" });
  const s = yearSummary({ year: 2026, months: [recap("2026-01", 6), recap("2026-05", 42), recap("2026-07", 42)], events: 7, relationship: rel, bucketsDone: 2, firstFish: fish });
  assert.equal(s.diaries, 3);
  assert.equal(s.photos, 6);
  assert.equal(s.logs, 9);
  assert.equal(s.events, 7);
  assert.equal(s.activeDays, 12);
  assert.equal(s.total, 90);
  assert.equal(s.moments.length, YEAR_MOMENTS_MAX);
  assert.equal(s.moments[0], "2월 28일 · 2주년", "주년이 먼저");
  assert.equal(s.moments[1], "가장 많이 남긴 달 · 5월 42개", "같으면 앞 달");
  assert.ok(s.moments.includes("함께 이룬 버킷 2개"));
  const empty = yearSummary({ year: 2026, months: [], events: 0, relationship: [], bucketsDone: 0, firstFish: null });
  assert.deepEqual(empty.moments, [], "없는 순간을 지어내지 않는다");
  assert.deepEqual(yearMonths(2026, "2026-03-02", "2025-06"), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(yearMonths(2025, "2026-03-02", "2025-11"), ["2025-11", "2025-12"]);
  assert.equal(monthCountsLine({ diaries: 0, photos: 3, logs: 1 }), "사진 3 · 로그 1");
});

test("올해의 우리 카드 — 숫자 칸 · 순간 줄 · 맺음말이 겹치지 않는다(RECAP_LAYOUT 과 같은 방식)", () => {
  const L = YEAR_LAYOUT;
  assert.ok(L.titleBase < L.statTop, "제목이 숫자 칸에 닿는다");
  assert.equal(L.statBottom, L.statTop + L.statH * 2 + L.statGap);
  assert.ok(L.statBottom + 40 < L.momentsHeadBase, "숫자 칸이 '기억할 순간' 제목을 덮는다");
  assert.ok(L.momentsHeadBase < L.momentsTop, "제목과 첫 줄이 겹친다");
  assert.equal(L.momentsBottom, L.momentsTop + L.momentLine * YEAR_MOMENTS_MAX);
  assert.ok(L.momentsBottom < L.footTop, "순간 줄이 맺음말을 덮는다");
  assert.ok(L.footBottom <= L.height - 40, "아래 글자가 카드 끝에 닿는다");
  assert.equal(clampLine("가".repeat(MOMENT_MAX_CHARS)).length, MOMENT_MAX_CHARS);
  assert.equal([...clampLine("가".repeat(MOMENT_MAX_CHARS + 5))].length, MOMENT_MAX_CHARS);
  assert.ok(clampLine("나".repeat(40)).endsWith("…"));
});

test("화면 — 이모지 없는 아이콘 · 추억에서 펼칠 때만 받는 조각 · 카드 공유는 앱 공유 시트 → Web Share → 내려받기", () => {
  const ui = read("components/OurChronicle.tsx");
  assert.match(ui, /<Icon name=\{item\.icon\}/);
  assert.doesNotMatch(ui.replace(/\/\*[\s\S]*?\*\//g, ""), /\p{Extended_Pictographic}/u, "UI 크롬에 이모지 없음");
  assert.match(ui, /observeInPage\(/, "iOS 는 main 이 스크롤한다 — root 를 준다");
  assert.match(ui, /import\("@\/lib\/yearcard"\)/, "카드 그리기는 누를 때 받는다");
  assert.doesNotMatch(ui, /<h1/, "추억 화면의 h1 은 하나(heading.test)");
  const recapUi = read("components/MemoriesRecap.tsx");
  assert.match(recapUi, /const OurChronicle = dynamic\(\(\) => import\("@\/components\/OurChronicle"\)/);
  assert.match(read("app/page.tsx"), /<MemoriesRecap [^>]*onRoute=\{goRoute\}/);
  const card = read("lib/yearcard.ts");
  assert.match(card, /shareOrDownload\(blob, `haru-\$\{sum\.year\}\.png`, "올해의 우리"\)/);
  assert.match(read("lib/recapcard.ts"), /shareFileInApp\(blob, name, title\)/, "앱(Capacitor)은 네이티브 공유 시트");
});
