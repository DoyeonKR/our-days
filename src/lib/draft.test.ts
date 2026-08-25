import { test } from "node:test";
import assert from "node:assert/strict";
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from "./draft.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

test("초안: 기능·대상별 키로 자동 저장하고 성공 뒤 제거한다", () => {
  const storage = memoryStorage();
  const key = draftStorageKey("event", "new");
  assert.equal(key, "ourdays:draft:event:new");
  assert.equal(saveDraft(storage, key, { title: "데이트" }), true);
  assert.deepEqual(loadDraft(storage, key), { title: "데이트" });
  clearDraft(storage, key);
  assert.equal(loadDraft(storage, key), null);
});

test("초안: 깨진 JSON과 저장소 예외는 작성 화면을 깨뜨리지 않는다", () => {
  assert.equal(loadDraft({ getItem: () => "{" }, "x"), null);
  assert.equal(saveDraft({ setItem: () => { throw new Error("quota"); } }, "x", "y"), false);
});
