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
    /const todayKey = useDayTick\(\)/.test(editor),
    "DecoEditor 가 useDayTick 을 쓰지 않음(자정 넘기면 어제로 저장될 수 있음)",
  );
  // 새 일기 = 오늘 / 수정 = 원본 날짜 유지
  assert.ok(
    /const date = entry \? entry\.entry_date : todayKey/.test(editor),
    "새 일기 날짜가 오늘(useDayTick) 파생이 아님",
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

/* ── 오늘-전용 규칙의 필수 짝: 수정 경로 ──────────────────────────
 * '오늘만 쓰기'만 넣고 수정이 없으면, 어제 일기의 오타를 고치려고 지우는 순간
 * 그 날짜로는 영원히 다시 쓸 수 없다(삭제=비가역 데이터 손실). 둘은 세트다. */

test("일기 수정 경로가 존재하고, 날짜/사진은 건드리지 않는다", () => {
  assert.ok(/export async function updateDecoEntry\(/.test(couple), "updateDecoEntry 가 없음");
  const body = bodyOf(couple, "export async function updateDecoEntry(");
  // entry_date 검사는 update() 인자 객체로 한정 — 시그니처의 Omit<…,"entry_date"> 오탐 제거
  const updateArg = body.slice(body.indexOf(".update({"), body.indexOf("})", body.indexOf(".update({")));
  assert.ok(
    updateArg.length > 0 && !/entry_date/.test(updateArg),
    "수정이 entry_date 를 바꾸면 오늘-전용 규칙이 무의미해진다",
  );
  assert.ok(!/storage|upload/i.test(body), "수정은 사진을 건드리지 않는다(그날의 기록 보존)");
  // 본문/공개범위 등 실제 수정 대상은 포함
  for (const f of ["title", "body", "mood_emoji", "bg", "hashtags", "stickers", "visibility"])
    assert.ok(new RegExp(`${f}:`).test(body), `${f} 가 수정 대상에서 빠짐`);
});

test("일기 카드에 수정 버튼이 있고, 편집기는 기존 일기를 받는다", () => {
  assert.ok(/aria-label="일기 수정"/.test(deco), "카드에 수정 버튼이 없음");
  assert.ok(/onEdit/.test(deco), "onEdit 배선이 없음");
  const editor = deco.slice(deco.indexOf("function DecoEditor"));
  assert.ok(/entry: DecoEntry \| null/.test(editor), "편집기가 기존 일기를 받지 않음");
  // 수정 시 원본 날짜 유지(오늘로 덮어쓰지 않음)
  assert.ok(/entry \? entry\.entry_date : todayKey/.test(editor), "수정 시 원본 날짜 유지가 아님");
});

test("지난 날 일기 삭제는 '다시 쓸 수 없음'을 경고한다", () => {
  assert.ok(
    /지난 날 일기는 다시 쓸 수 없으니/.test(deco),
    "오늘-전용 규칙 때문에 삭제가 비가역인데 경고가 없음",
  );
});
