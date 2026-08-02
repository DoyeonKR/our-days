// 일기 '오늘만 쓰기' 회귀 lock. [2026-07-28 사용자 요청]
// 지난 날짜로 소급 작성하면 스트릭/회상('작년 오늘')/월별 타임라인의 의미가 무너진다.
// 규칙(2겹):
//  1) UI(DecoEditor): 날짜 입력(type="date")을 두지 않고 useDayTick 이 준 오늘로 고정.
//  2) 데이터계층(addDecoEntry): 클라가 무엇을 보내든 서버 저장 직전 오늘로 확정
//     (자정을 넘긴 채 열려 있던 화면/오래된 캐시 방어).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const deco = readFileSync(join(import.meta.dirname, "..", "components", "DecoBook.tsx"), "utf8");
const couple = readFileSync(join(import.meta.dirname, "couple.ts"), "utf8");

/** 함수 본문만 잘라낸다(다음 export 선언 전까지). */
function bodyOf(src: string, decl: string): string {
  const i = src.indexOf(decl);
  assert.ok(i >= 0, `${decl} 를 찾지 못함`);
  const rest = src.slice(i + decl.length);
  const j = rest.indexOf("\nexport ");
  return j >= 0 ? rest.slice(0, j) : rest;
}

test("일기 편집기 — 날짜 선택 입력이 없어야 한다(소급 작성 금지)", () => {
  const editor = deco.slice(deco.indexOf("function DecoEditor"));
  assert.ok(
    !/type="date"/.test(editor),
    "DecoEditor 에 날짜 선택 input 이 되살아남 → 지난 날 일기를 쓸 수 있게 된다",
  );
});

test("일기 편집기 — 날짜는 useDayTick(자정 롤오버) 로 오늘 고정", () => {
  assert.ok(/useDayTick/.test(deco), "useDayTick import/사용이 사라짐");
  const editor = deco.slice(deco.indexOf("function DecoEditor"));
  assert.ok(
    /const date = useDayTick\(\)/.test(editor),
    "DecoEditor 의 date 가 useDayTick 고정이 아님(자정 넘기면 어제로 저장될 수 있음)",
  );
  // 임의 변경 경로(setDate)가 없어야 한다
  assert.ok(!/setDate\(/.test(editor), "setDate 가 남아 있음 — 날짜를 바꿀 수 있는 경로");
});

test("addDecoEntry — 전달된 entry_date 를 신뢰하지 않고 오늘로 확정", () => {
  const body = bodyOf(couple, "export async function addDecoEntry(");
  assert.ok(/toISODate\(new Date\(\)\)/.test(body), "저장 직전 오늘 계산이 없음");
  assert.ok(
    /entry_date:\s*todayISO/.test(body),
    "insert 가 여전히 input.entry_date 를 그대로 씀 → 소급 작성 방어 없음",
  );
});
