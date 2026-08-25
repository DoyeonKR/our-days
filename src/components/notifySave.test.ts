import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./NotifySettings.tsx", import.meta.url), "utf8");

test("알림 설정 쓰기는 순서를 직렬화하고 최신 요청만 성공 표시한다", () => {
  assert.match(source, /saveChain\.current = saveChain\.current\.then\(run, run\)/);
  assert.match(source, /revision !== saveRevision\.current/);
  assert.match(source, /await saveMyNotifyPrefs\(next\)/);
});

test("불러오기·저장 실패를 숨기지 않고 재시도 동선을 제공한다", () => {
  assert.match(source, /setLoadFailed\(true\)/);
  assert.match(source, /phase: "error"/);
  assert.match(source, /다시 불러오기/);
  assert.match(source, /변경사항 다시 저장/);
  assert.doesNotMatch(source, /saveMyNotifyPrefs\([^)]*\)[\s\S]{0,100}\.catch\(\(\) => \{\}\)/);
});

test("디바운스 중 설정 시트를 닫아도 마지막 값을 저장 체인 끝에서 flush한다", () => {
  assert.match(source, /saveTimer\.current = null;[\s\S]*const flush = async/);
  assert.match(source, /saveChain\.current = saveChain\.current\.then\(flush, flush\)/);
});
