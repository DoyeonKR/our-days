// 쿡찌르기 전송 lock. [사용자 리포트 2026-08-03: "메인 채팅이 전송중이라고 계속 뜸"]
//
// 원인: 낙관적 말풍선(tmp-…)을 지우는 유일한 경로가 **실시간 echo** 였다. 실시간이 늦거나
// 끊기면 메시지는 저장됐는데도 화면엔 "전송 중" 이 영원히 남는다. 실시간은 신뢰할 수 없는
// 전송 경로라, 자기 메시지의 확정을 거기에 맡기면 안 된다.
//
// 계약: sendPoke 가 **저장된 행을 반환**하고, 호출부가 그 행으로 임시 버블을 즉시 치환한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const couple = readFileSync(join(import.meta.dirname, "..", "lib", "couple.ts"), "utf8");
const sync = readFileSync(join(import.meta.dirname, "CoupleSync.tsx"), "utf8");

/** 함수 본문만 잘라낸다(다음 export 선언 전까지). */
function bodyOf(src: string, decl: string): string {
  const i = src.indexOf(decl);
  assert.ok(i >= 0, `${decl} 를 찾지 못함`);
  const rest = src.slice(i + decl.length);
  const j = rest.indexOf("\nexport ");
  return j >= 0 ? rest.slice(0, j) : rest;
}

test("sendPoke 는 저장된 행을 반환한다(void 회귀 금지)", () => {
  const body = bodyOf(couple, "export async function sendPoke(");
  assert.ok(!/\):\s*Promise<void>/.test(body), "Promise<void> 로 되돌리면 임시 버블을 지울 방법이 없다");
  assert.ok(/Promise<Poke \| null>/.test(body), "저장된 행(Poke)을 반환해야 한다");
  assert.ok(body.includes(".select()"), "insert 후 select 로 행을 받아야 한다");
});

test("전송 성공 시 임시 버블을 서버 행으로 치환한다(실시간 의존 금지)", () => {
  const body = bodyOf(sync, "  async function handlePoke(");
  assert.ok(/const saved = await sendPoke\(/.test(body), "sendPoke 결과를 받아야 한다");
  assert.ok(body.includes("x.id === tmpId ? saved : x"), "임시 버블을 저장된 행으로 치환해야 한다");
});

test("전송 실패 롤백은 **이번 버블만** 지운다", () => {
  // 예전엔 startsWith('tmp-') 로 전부 지워, 동시에 보낸 다른 메시지의 버블까지 사라졌다.
  const body = bodyOf(sync, "  async function handlePoke(");
  assert.ok(
    !/filter\(\(x\) => !x\.id\.startsWith\("tmp-"\)\)/.test(body),
    "전체 tmp 삭제 금지 — 다른 전송의 버블까지 지운다",
  );
  assert.ok(body.includes("x.id !== tmpId"), "이번 전송의 id 로만 롤백해야 한다");
});
