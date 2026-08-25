import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("공유 시작일은 서버 확인 뒤에만 설정 저장 성공으로 닫힌다", () => {
  const saveStart = source.indexOf("async function saveProfile");
  const saveEnd = source.indexOf("function adoptStart", saveStart);
  const saveBody = source.slice(saveStart, saveEnd);
  assert.match(saveBody, /await updateCoupleStartDate\(coupleId, iso\)/);
  assert.doesNotMatch(saveBody, /\.catch\(\(\) => \{\}\)/);

  const settingsStart = source.indexOf("function Settings(");
  const settingsBody = source.slice(settingsStart);
  assert.match(settingsBody, /await onSave\(date, a\.trim\(\)\)/);
  assert.match(settingsBody, /phase: "error"/);
  assert.match(settingsBody, /disabled=\{saving\}/);
});
