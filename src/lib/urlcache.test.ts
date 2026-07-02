// 서명URL 캐시 순수 로직 회귀 lock. [2026-07-02]
// 프라이버시(만료 URL 잔존)·정확성(만료 직전 히트)·내구성(오염 JSON)이 걸린 로직.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFreshUrlEntry,
  parseStoredUrlEntries,
  persistableUrlEntries,
} from "./urlcache.ts";
import { inQuietHours } from "./quiet.ts";
import { humanError } from "./humanError.ts";

const NOW = 1_750_000_000_000;

test("isFreshUrlEntry: 잔여 60초 미만이면 미스 (만료 임박 URL 사용 금지)", () => {
  assert.equal(isFreshUrlEntry({ url: "u", exp: NOW + 61_000 }, NOW), true);
  assert.equal(isFreshUrlEntry({ url: "u", exp: NOW + 59_000 }, NOW), false);
  assert.equal(isFreshUrlEntry({ url: "u", exp: NOW - 1 }, NOW), false);
  assert.equal(isFreshUrlEntry(undefined, NOW), false);
});

test("parseStoredUrlEntries: 유효 엔트리만 복원 + 오염 데이터 무해", () => {
  const good: [string, { url: string; exp: number }][] = [
    ["a/b.webm", { url: "https://x/1", exp: NOW + 3_000_000 }],
    ["c/d.webp", { url: "https://x/2", exp: NOW + 10_000 }], // 만료 임박 → 제외
  ];
  const out = parseStoredUrlEntries(JSON.stringify(good), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0][0], "a/b.webm");
  // 오염/이상 입력 — 어떤 것도 크래시 없이 빈 배열
  assert.deepEqual(parseStoredUrlEntries(null, NOW), []);
  assert.deepEqual(parseStoredUrlEntries("not-json{", NOW), []);
  assert.deepEqual(parseStoredUrlEntries('{"a":1}', NOW), []);
  assert.deepEqual(parseStoredUrlEntries('[["k"],[1,2,3],[null,null]]', NOW), []);
});

test("persistableUrlEntries: 만료 제거 + 최근 cap 유지", () => {
  const entries: [string, { url: string; exp: number }][] = [];
  for (let i = 0; i < 350; i++) entries.push([`p${i}`, { url: "u", exp: NOW + 1000 }]);
  entries.push(["expired", { url: "u", exp: NOW - 1 }]);
  const out = persistableUrlEntries(entries, NOW, 300);
  assert.equal(out.length, 300);
  assert.equal(out.some(([k]) => k === "expired"), false);
  assert.equal(out[out.length - 1][0], "p349"); // 최근 것이 살아남는다
});

test("inQuietHours: wrap-around(23~08) 포함 — Edge 서버 게이트 미러 [회귀 lock]", () => {
  // 일반 범위 (13~15)
  assert.equal(inQuietHours(13, 13, 15), true);
  assert.equal(inQuietHours(14, 13, 15), true);
  assert.equal(inQuietHours(15, 13, 15), false); // end 미포함
  assert.equal(inQuietHours(12, 13, 15), false);
  // 자정 넘는 범위 (23~08)
  assert.equal(inQuietHours(23, 23, 8), true);
  assert.equal(inQuietHours(2, 23, 8), true);
  assert.equal(inQuietHours(7, 23, 8), true);
  assert.equal(inQuietHours(8, 23, 8), false);
  assert.equal(inQuietHours(12, 23, 8), false);
  // 미설정/동일값 = 조용시간 없음
  assert.equal(inQuietHours(3, null, 8), false);
  assert.equal(inQuietHours(3, 23, null), false);
  assert.equal(inQuietHours(3, 5, 5), false);
});

test("humanError: 영어 원문 → 한국어, 한국어는 그대로, 미지 메시지는 원문 보존", () => {
  assert.equal(humanError("Failed to fetch"), "네트워크 연결을 확인해 주세요.");
  assert.equal(humanError("JWT expired"), "로그인이 만료됐어요. 앱을 새로고침해 주세요.");
  assert.equal(
    humanError('new row violates row-level security policy for table "deco_entries"'),
    "권한이 없어요. 다시 로그인해 주세요.",
  );
  assert.equal(humanError("duplicate key value violates unique constraint"), "이미 등록돼 있어요.");
  assert.equal(humanError("이미 한국어 메시지"), "이미 한국어 메시지");
  assert.ok(humanError("Weird unknown thing").includes("Weird unknown thing"));
  assert.ok(humanError("").includes("문제가 생겼어요"));
});
