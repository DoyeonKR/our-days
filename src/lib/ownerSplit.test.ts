// '내/상대' 오귀속 회귀 lock. [2026-07-28]
// 사용자 리포트: "한 사람이 마음온도 미지근 선택하면 다른 사람이 다른 걸 선택해도 그걸로 보임".
// 원인: uid 미확정(null) 상태에서 rows.find(r => r.user_id !== uid) 가 아무 행이나 '상대'로
// 귀속 — 내 선택은 하이라이트 안 되고 화면엔 첫 행(상대의 미지근)만 남았다.
// 계약: uid 를 모르면 어느 쪽도 귀속하지 않는다(오귀속 < 미표시).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { splitByOwner } from "./ownerSplit.ts";

const A = { user_id: "uid-a", emoji: "🌡️" };
const B = { user_id: "uid-b", emoji: "🔥" };

test("uid 매칭 — 내/상대 정확히 분리", () => {
  const r = splitByOwner([A, B], "uid-b", (m) => m.user_id);
  assert.equal(r.mine, B, "내 행 = 내 uid 행");
  assert.equal(r.partner, A, "상대 행 = 다른 uid 행");
});

test("uid null — 어느 쪽도 귀속하지 않는다 [버그 재현 케이스]", () => {
  // 옛 코드: partner = rows.find(r => r.user_id !== null) === rows[0] → A(미지근)로 오귀속
  const r = splitByOwner([A, B], null, (m) => m.user_id);
  assert.equal(r.mine, null);
  assert.equal(r.partner, null, "uid 모르면 첫 행을 상대로 오귀속 금지");
});

test("내가 아직 안 답함 — 상대 행만 있어도 상대는 정확히 귀속", () => {
  const r = splitByOwner([A], "uid-b", (m) => m.user_id);
  assert.equal(r.mine, null);
  assert.equal(r.partner, A);
});

test("내 행만 있음 — 상대 null (내 행이 상대 칸에 뜨는 회귀 금지)", () => {
  const r = splitByOwner([B], "uid-b", (m) => m.user_id);
  assert.equal(r.mine, B);
  assert.equal(r.partner, null);
});

test("컴포넌트 3곳이 공용 귀속 규칙 사용 — raw find 부활 금지 [소스 lock]", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const f of ["MoodLine.tsx", "DailyQuestion.tsx", "TodayLogCard.tsx"]) {
    const src = readFileSync(join(here, "../components", f), "utf8");
    assert.ok(src.includes("splitByOwner("), `${f}: splitByOwner 사용`);
    assert.ok(src.includes("useMyUid("), `${f}: uid 자가복구 훅 사용(prop null 영구화 방어)`);
    assert.ok(
      !/find\(\s*\(?\w+\)?\s*=>\s*\w+\.(user_id|created_by)\s*!==/.test(src),
      `${f}: raw 'uid 불일치 find'(오귀속 원인) 재도입 금지`,
    );
  }
});

test("MoodLine — 한마디는 버튼 없이 바로 작성(사용자 요청) [소스 lock]", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../components/MoodLine.tsx"), "utf8");
  assert.ok(!src.includes("+ 한마디"), "'+ 한마디' 게이트 버튼 부활 금지");
  assert.ok(!src.includes("noteOpen"), "noteOpen 토글 상태 부활 금지(입력은 상시 노출)");
  assert.ok(/\{mine && \([\s\S]{0,700}saveNote/.test(src), "답한 뒤 인라인 입력 + 저장이 바로 렌더");
  assert.ok(src.includes("noteDirty"), "입력 중 realtime 새로고침이 타이핑을 덮지 않는 가드");
});

test("vlog 미니 — 스토리 링 + 탭 진입 + 중첩버튼 금지 [소스 lock]", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const card = readFileSync(join(here, "../components/TodayLogCard.tsx"), "utf8");
  assert.ok(card.includes("STORY_RING"), "채워진 미니에 인스타 스토리 링");
  assert.ok(card.includes('role="button"'), "미니 래퍼는 div role=button (LoopVideo 내 재생 button 과 중첩 금지)");
  assert.ok(!/<button[^>]*\n?[^>]*aria-label=\{filled/.test(card), "미니 래퍼 <button> 부활 금지");
  const video = readFileSync(join(here, "../components/LoopVideo.tsx"), "utf8");
  assert.ok(video.includes("stopPropagation"), "재생 폴백 탭이 부모 내비게이션으로 새지 않게");
});
