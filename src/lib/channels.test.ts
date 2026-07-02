// realtime 채널 이중구독 회귀 lock. [2026-07-02]
// keep-mounted 도입으로 홈(TodayLogCard)과 로그 탭(TodayLog)이 동시 마운트되는데,
// 둘 다 같은 채널명(clogs:{coupleId})을 쓰면 두 번째 .on() 에서
// "cannot add postgres_changes callbacks after subscribe()" 크래시 → 로그 탭 백지.
// (실제 장애 2026-07-02 — subscribeDeco 의 "deco-cal" 분리와 동일 패턴)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("모든 realtime 구독은 인스턴스별 유니크 채널명(_chanName) 사용", () => {
  const s = read("src/lib/couple.ts");
  // 유니크 suffix 헬퍼 존재
  assert.ok(s.includes("++_chanSeq"), "_chanName 유니크 suffix 헬퍼가 사라짐");
  // .channel( 호출 전부가 _chanName( 경유 — 고정 이름 채널이 하나라도 생기면 재발
  const all = (s.match(/\.channel\(/g) ?? []).length;
  const uniq = (s.match(/\.channel\(_chanName\(/g) ?? []).length;
  assert.ok(all > 0, "구독 채널이 없음(구조 변경?)");
  assert.equal(
    all,
    uniq,
    `고정 이름 .channel() ${all - uniq}건 — 동시 마운트/StrictMode 재마운트에서 이중구독 크래시 재발`,
  );
});

test("TodayLogCard(홈)는 로그 탭과 다른 채널 키를 쓴다", () => {
  const card = read("src/components/TodayLogCard.tsx");
  assert.ok(
    card.includes('subscribeCoupleLogs(coupleId, refresh, "clogs-home")'),
    "홈 카드가 채널 키를 분리하지 않음 — 로그 탭과 이중구독 크래시 재발",
  );
});

test("page.tsx 캘린더 일기 구독은 일기장 탭과 채널 분리(deco-cal) 유지", () => {
  const page = read("src/app/page.tsx");
  assert.ok(page.includes('"deco-cal"'), "deco-cal 채널 키 분리가 사라짐");
});
