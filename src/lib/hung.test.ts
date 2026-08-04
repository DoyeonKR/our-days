// 홈 빨랫줄 사진 선택 회귀 lock. [사용자 요청 2026-08-04 "4장 걸리게 + 내가 선택"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HUNG_MAX, cleanHung, nextHung } from "./hung.ts";

test("최대 4장 — 화면 폭이 정한 상한이다", () => {
  // 360px 화면에서 좌우 px-4 를 뺀 328px 안에 62px 폴라로이드가 4장:
  // 4×(62+8 패딩) + 3×6 간격 = 298 ≤ 328. 5장이면 373 > 328 로 넘친다.
  assert.equal(HUNG_MAX, 4);
  assert.ok(4 * 70 + 3 * 6 <= 328, "4장은 들어간다");
  assert.ok(5 * 70 + 4 * 6 > 328, "5장은 못 들어간다 — 상한을 올리려면 크기부터 줄여야 한다");
});

test("걸기 — 순서가 곧 빨랫줄 왼쪽부터의 자리", () => {
  assert.deepEqual(nextHung([], "a"), ["a"]);
  assert.deepEqual(nextHung(["a"], "b"), ["a", "b"]);
  assert.deepEqual(nextHung(["a", "b"], "c"), ["a", "b", "c"]);
});

test("내리기 — 이미 걸린 걸 누르면 빠지고 나머지 순서는 유지", () => {
  assert.deepEqual(nextHung(["a", "b", "c"], "b"), ["a", "c"]);
  assert.deepEqual(nextHung(["a"], "a"), []);
});

test("★ 가득 차면 가장 오래 걸린 것이 빠진다(FIFO) — 막지 않는다", () => {
  // '4장이 꽉 찼어요' 로 막으면 사용자가 뭘 뺄지 찾으러 되돌아가야 한다.
  assert.deepEqual(nextHung(["a", "b", "c", "d"], "e"), ["b", "c", "d", "e"]);
  assert.deepEqual(nextHung(["a", "b", "c", "d", "e"], "f"), ["c", "d", "e", "f"]);
});

test("같은 걸 두 번 걸어도 늘지 않는다(토글이다)", () => {
  const once = nextHung(["a", "b"], "c");
  assert.deepEqual(nextHung(once, "c"), ["a", "b"]);
});

test("빈 경로는 무시 — 상태를 망가뜨리지 않는다", () => {
  assert.deepEqual(nextHung(["a"], ""), ["a"]);
});

test("입력을 변형하지 않는다 — 낙관적 UI 가 이전 값을 되돌릴 수 있어야 한다", () => {
  const cur = ["a", "b"];
  const next = nextHung(cur, "c");
  assert.deepEqual(cur, ["a", "b"], "원본이 바뀌면 롤백이 불가능하다");
  assert.notStrictEqual(cur, next);
});

test("저장 직전 정리 — 중복·빈 값 제거 + 상한", () => {
  assert.deepEqual(cleanHung(["a", "a", "b"]), ["a", "b"]);
  assert.deepEqual(cleanHung(["a", "", "b"]), ["a", "b"]);
  assert.deepEqual(cleanHung(["a", "b", "c", "d", "e"]), ["a", "b", "c", "d"]);
  assert.deepEqual(cleanHung([]), []);
});

/* ── 백엔드 계약(소스 스캔) ─────────────────────────────────── */

test("★ 스키마 grant 가 기존 컬럼을 잃지 않는다", () => {
  // couples 는 **컬럼 단위 grant** 다. grant 는 누적이 아니라 재선언이라,
  // 새 컬럼을 추가하며 기존 컬럼을 빠뜨리면 시작일·대표사진 수정이 조용히 막힌다
  // (revoke 가 먼저 돌기 때문). 실 DB 에도 셋 다 붙어 있는 것을 확인했다.
  const sql = readFileSync(join(import.meta.dirname, "..", "..", "supabase", "schema.sql"), "utf8");
  assert.ok(/add column if not exists hung_paths text\[\]/.test(sql), "hung_paths 컬럼 정의");
  // 파일에서 **마지막** grant 가 최종 상태다
  const grants = [...sql.matchAll(/grant\s+update\s*\(([^)]*)\)\s*on\s+public\.couples/g)];
  assert.ok(grants.length > 0, "couples 컬럼 grant 가 있어야 한다");
  const last = grants[grants.length - 1][1];
  for (const col of ["start_date", "cover_path", "hung_paths"]) {
    assert.ok(last.includes(col), `마지막 grant 에 ${col} 가 빠졌다 — 해당 기능이 조용히 막힌다`);
  }
});

test("홈은 선택이 없으면 최근 4장으로 폴백한다", () => {
  const page = readFileSync(join(import.meta.dirname, "..", "app", "page.tsx"), "utf8");
  assert.ok(/photosByPaths\(coupleId, hungPaths\)/.test(page), "고른 게 있으면 그것을 쓴다");
  assert.ok(/listRecentPhotos\(coupleId, 4\)/.test(page), "없으면 최근 4장 — 빈 빨랫줄로 두지 않는다");
});

test("빨랫줄은 최대 4장만 그린다", () => {
  const hw = readFileSync(join(import.meta.dirname, "..", "components", "HomeWorld.tsx"), "utf8");
  assert.ok(/photos\.slice\(0, 4\)/.test(hw), "HomeWorld 도 4장 상한");
});
