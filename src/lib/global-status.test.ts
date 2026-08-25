import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../components/GlobalStatusHost.tsx", import.meta.url),
  "utf8",
);

test("전역 상태: online/offline과 공통 성공·실패 알림을 접근 가능한 live region으로 노출", () => {
  assert.match(source, /addEventListener\("offline"/);
  assert.match(source, /addEventListener\("online"/);
  assert.match(source, /role=\{notice\.kind === "error" \? "alert" : "status"\}/);
  assert.match(source, /작성 중인 초안은 이 기기에 남지만 서버 저장/);
});
