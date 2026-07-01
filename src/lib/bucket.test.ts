// 버킷리스트 순수 로직 회귀 lock (진행률/카테고리 폴백/시드 샘플). [2026-07-01]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUCKET_CATEGORIES,
  BUCKET_SEED,
  bucketProgress,
  categoryMeta,
  sampleSeed,
} from "./bucket.ts";

test("bucketProgress: 완료/전체/퍼센트, 빈 목록 0%", () => {
  assert.deepEqual(bucketProgress([]), { done: 0, total: 0, pct: 0 });
  assert.deepEqual(bucketProgress([{ done: true }, { done: false }, { done: false }]), {
    done: 1,
    total: 3,
    pct: 33,
  });
  assert.deepEqual(bucketProgress([{ done: true }, { done: true }]), {
    done: 2,
    total: 2,
    pct: 100,
  });
});

test("categoryMeta: 알 수 없는 키는 '기타'로 폴백 [회귀 lock]", () => {
  assert.equal(categoryMeta("travel").label, "여행");
  assert.equal(categoryMeta("nonexistent").key, "etc");
  assert.equal(categoryMeta("").key, "etc");
});

test("sampleSeed: 요청 개수만큼, 시드 원본 오염 없음", () => {
  const before = BUCKET_SEED.length;
  const s = sampleSeed(4, () => 0.5);
  assert.equal(s.length, 4);
  assert.equal(BUCKET_SEED.length, before, "원본 배열이 변형됨");
  // 과도 요청은 전체로 clamp
  assert.equal(sampleSeed(9999).length, BUCKET_SEED.length);
  assert.equal(sampleSeed(0).length, 0);
});

test("BUCKET_SEED: 모든 시드 카테고리가 유효 (categoryMeta 폴백에 안 걸림) [회귀 lock]", () => {
  const keys = new Set(BUCKET_CATEGORIES.map((c) => c.key));
  for (const s of BUCKET_SEED) {
    assert.ok(keys.has(s.category), `시드 카테고리 무효: ${s.category}`);
    assert.ok(s.title.trim().length > 0, "빈 시드 제목");
  }
});
