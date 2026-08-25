// Realtime 채널 다중화 회귀 lock. [2026-07-27 Disk IO 사건]
// 배경: 화면마다 postgres_changes 채널을 1개씩 열면(한때 19개) 재접속·재마운트마다 join 이
// 반복돼 realtime.subscription 삽입/삭제 폭증(실측 66일 ins/del 각 15,069, 오토배큠 259회) →
// WAL 디코딩 + 구독별 RLS set_config(8.5억 호출)가 무료 티어 Disk IO 예산을 소진시켰다.
// 규칙: postgres_changes 는 **muxOn(커플당 공유 채널 1개)** 로만 듣는다.
//  - 채널 직접 생성(.channel + postgres_changes)은 _muxRebuild 안에서만.
//  - presence/broadcast 채널(부루마블 접속표시·테트리스)만 예외.
//  - 재구성은 "새 이름 채널로 통째 교체"(subscribe 후 .on 추가 = 2026-07-02 크래시 클래스).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "couple.ts"), "utf8");

test("postgres_changes 는 _muxRebuild 단 한 곳에서만 등장", () => {
  const n = (src.match(/"postgres_changes"/g) ?? []).length;
  assert.equal(n, 1, `postgres_changes 가 ${n}곳 — muxOn 을 우회한 채널이 생겼다(IO 회귀)`);
  // 그 한 곳이 _muxRebuild 내부인지
  const i = src.indexOf("function _muxRebuild");
  const j = src.indexOf('"postgres_changes"');
  assert.ok(i >= 0 && j > i, "postgres_changes 가 _muxRebuild 밖에 있음");
});

test("구독 함수들은 전부 muxOn 경유", () => {
  for (const fn of [
    "subscribePokes",
    "subscribeMembers",
    "subscribeChatReads",
    "subscribePokeReactions",
    "subscribeLogComments",
    "subscribeCoupleEvents",
    "subscribePhotos",
    "subscribeCouple",
    "subscribeAnswers",
    // 2026-08-06: 아케이드·부루마블 삭제로 subscribeGameChallenges/subscribeBoardGame 도 제거됨
    "subscribeIsland",
    "subscribeDeco",
    "subscribeBucket",
    "subscribeEntryInteractions",
    "subscribeCoupleLogs",
  ]) {
    const i = src.indexOf(`export function ${fn}(`);
    assert.ok(i >= 0, `${fn} 이 없음`);
    const body = src.slice(i, src.indexOf("\nexport ", i + 10));
    assert.ok(/muxOn\(/.test(body), `${fn} 이 muxOn 을 쓰지 않음(개별 채널 회귀)`);
    assert.ok(!/\.channel\(/.test(body), `${fn} 이 채널을 직접 생성(개별 채널 회귀)`);
  }
});

test("presence/broadcast 채널만 직접 생성 허용", () => {
  // .channel( 호출 = _chanName 정의 제외하고 _muxRebuild(1) + presence/broadcast(2) 뿐이어야
  const calls = (src.match(/\.channel\(/g) ?? []).length;
  assert.ok(calls <= 3, `.channel( 호출이 ${calls}곳 — 다중화 우회 채널 의심`);
});

test("재구성은 새 이름 채널로 교체(디바운스) — subscribe 후 .on 추가 금지 클래스 봉인", () => {
  const i = src.indexOf("function _muxRebuild");
  const body = src.slice(i, i + 1600);
  assert.ok(/_chanName\(`mux:/.test(body), "재구성이 유니크 채널명(mux:)을 쓰지 않음");
  assert.ok(/removeChannel\(old\)/.test(body), "옛 채널 제거가 없음(채널 누수)");
});

test("새 채널 SUBSCRIBED 전까지 active 채널을 유지하고 최초 연결도 resync", () => {
  const i = src.indexOf("function _muxRebuild");
  const body = src.slice(i, src.indexOf("\nfunction _muxSchedule", i));
  assert.ok(body.includes("entry.pending = ch"), "연결 중 후보를 active와 분리해야 한다");
  assert.ok(body.includes('status !== "SUBSCRIBED"'), "SUBSCRIBED 확인 없이 교체하면 수신 공백이 생긴다");
  const subscribed = body.indexOf('status !== "SUBSCRIBED"');
  const removeOld = body.indexOf("removeChannel(old)", subscribed);
  assert.ok(removeOld > subscribed, "옛 채널 제거는 SUBSCRIBED 확인 뒤여야 한다");
  assert.ok(!body.includes("firstJoin"), "최초 조회와 최초 구독 사이 공백도 있으므로 첫 resync를 생략하면 안 된다");
  assert.ok(body.includes('cb({ eventType: "resync" })'), "모든 구독 완료에서 정본 재조회 신호가 필요하다");
});

test("증분형 pokes와 UPDATE 전용 couples도 resync를 소비한다", () => {
  const pokes = src.slice(src.indexOf("export function subscribePokes("), src.indexOf("/** realtime 채널명"));
  assert.ok(pokes.includes('p.eventType === "resync"'), "pokes가 재연결 공백의 서버 행을 복구하지 않는다");
  const couple = src.slice(src.indexOf("export function subscribeCouple("), src.indexOf("/* ---------- 오늘의 질문"));
  assert.ok(couple.includes('p.eventType === "resync"'), "couples UPDATE 공백을 재조회하지 않는다");
});

test("markChatRead 15초 쓰기 게이트(연타 업서트 IO 방지)", () => {
  const i = src.indexOf("export async function markChatRead(");
  const body = src.slice(i, src.indexOf("\nexport ", i + 10));
  assert.ok(/15_000|15000/.test(body), "markChatRead 쓰기 게이트가 사라짐(IO 회귀)");
});
