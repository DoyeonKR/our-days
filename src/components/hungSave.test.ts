import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("홈 빨랫줄 저장은 실패를 숨기지 않고 서버 정본 또는 이전 값으로 복원한다", () => {
  const start = source.indexOf("async function persistHung");
  const end = source.indexOf("function toggleHung", start);
  const body = source.slice(start, end);
  assert.match(body, /await updateCoupleHung\(targetCouple, next\)/);
  assert.match(body, /const server = await getCoupleHung\(targetCouple\)/);
  assert.match(body, /setHungPaths\(previous\)/);
  assert.match(body, /phase: "error"/);
  assert.doesNotMatch(body, /updateCoupleHung\([^)]*\)\.catch\(\(\) => \{\}\)/);
});

test("저장 중 사진 선택 연타와 realtime 역주행을 잠근다", () => {
  assert.match(source, /if \(!coupleId \|\| hungSaveLock\.current\) return/);
  assert.match(source, /if \(!hungSaveLock\.current\) \{\s*getCoupleHung/);
  assert.match(source, /hungBusy=\{hungSave\.phase === "saving"\}/);
});
