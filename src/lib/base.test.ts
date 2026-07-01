// asset() basePath 헬퍼 회귀 lock. BASE 접두는 빌드 env(NEXT_PUBLIC_BASE_PATH)에서
// 결정되므로(환경 의존), 여기선 env 무관하게 성립하는 '슬래시 정규화 계약'을 잠근다:
//  - 선행 슬래시 유무와 무관하게 동일 결과, 항상 정확히 하나의 구분 슬래시(// 없음).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, asset } from "./base.ts";

test("asset: 선행 슬래시 유무 무관하게 동일 결과 [회귀 lock]", () => {
  assert.equal(asset("sw.js"), asset("/sw.js"));
  assert.equal(asset("icon-192.png"), asset("/icon-192.png"));
});

test("asset: 경로가 항상 붙되 더블 슬래시(//) 없음", () => {
  const out = asset("/manifest.webmanifest");
  assert.ok(out.endsWith("/manifest.webmanifest"), out);
  // BASE 뒤 정확히 하나의 슬래시 — '//' 가 생기면 GitHub Pages 자산이 깨짐
  assert.ok(!out.includes("//"), `더블 슬래시 발생: ${out}`);
});

test("asset: BASE 접두가 결과 앞에 온다 (하위경로 배포 대비)", () => {
  // BASE 가 설정된 경우(예: /our-days) 결과는 그 접두로 시작해야 함.
  // 미설정(로컬/루트)이면 BASE="" 라 "/..." 로 시작.
  const out = asset("/sw.js");
  assert.ok(out.startsWith(`${BASE}/`), `BASE 접두 누락: ${out}`);
  assert.equal(out, `${BASE}/sw.js`);
});
