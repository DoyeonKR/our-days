// '오늘 어땠어?'(오늘의 기분 복귀판) 회귀 lock. [2026-07-27]
// 사용자: "없앴던 기능인데 개선된 화면으로 — 한줄 평 느낌, 숙제 같지 않고 재미있게".
// 핵심 계약: 매일 다른 프롬프트(KST 날짜 결정적 — 둘이 같은 질문), 칩 6개(1탭),
// 오늘 판정은 updated_at KST 날짜, 같은 칩이면 이심전심.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOOD_PROMPTS,
  isJinx,
  isTodayMood,
  kstDayOf,
  todaysMoodPrompt,
} from "./moodPrompt.ts";

test("프롬프트 풀 — 6개 이상, 칩은 항상 6개(2×3 그리드), 이모지 중복 없음", () => {
  assert.ok(MOOD_PROMPTS.length >= 6, "매일 로테이션할 만큼");
  for (const p of MOOD_PROMPTS) {
    assert.equal(p.chips.length, 6, `${p.id} 칩 6개`);
    const uniq = new Set(p.chips.map((c) => c.e));
    assert.equal(uniq.size, 6, `${p.id} 칩 이모지 중복 금지(같은 칩 판정이 꼬임)`);
    assert.ok(p.q.length <= 20, `${p.id} 질문은 가볍게(한 줄)`);
  }
});

test("오늘의 프롬프트 — KST 날짜 결정적(둘이 같은 질문), 날짜 바뀌면 로테이션", () => {
  const t = Date.UTC(2026, 6, 27, 3, 0, 0); // KST 낮
  assert.equal(todaysMoodPrompt(t).id, todaysMoodPrompt(t + 3600_000).id, "같은 날 = 같은 질문");
  assert.notEqual(todaysMoodPrompt(t).id, todaysMoodPrompt(t + 86400_000).id, "다음 날 = 다음 질문");
  // KST 자정 경계: UTC 14:59 = KST 23:59 / UTC 15:00 = KST 00:00
  const before = Date.UTC(2026, 6, 27, 14, 59);
  const after = Date.UTC(2026, 6, 27, 15, 0);
  assert.equal(kstDayOf(after) - kstDayOf(before), 1, "KST 자정에 날짜가 넘어감");
});

test("오늘 판정 + 이심전심 — updated_at KST 날짜 기준", () => {
  const now = Date.UTC(2026, 6, 27, 10, 0); // KST 19시
  const todayIso = new Date(Date.UTC(2026, 6, 27, 1, 0)).toISOString(); // 같은 KST 날
  const yesterIso = new Date(Date.UTC(2026, 6, 26, 1, 0)).toISOString();
  assert.equal(isTodayMood(todayIso, now), true);
  assert.equal(isTodayMood(yesterIso, now), false, "어제 답은 오늘로 안 침(매일 리셋)");
  assert.equal(isTodayMood("broken", now), false, "오염 입력 방어");
  // 이심전심: 둘 다 오늘 + 같은 이모지
  const a = { emoji: "🌈", updated_at: todayIso };
  const b = { emoji: "🌈", updated_at: todayIso };
  assert.equal(isJinx(a, b, now), true);
  assert.equal(isJinx(a, { emoji: "☁️", updated_at: todayIso }, now), false);
  assert.equal(isJinx(a, { emoji: "🌈", updated_at: yesterIso }, now), false, "어제 답과는 아님");
  assert.equal(isJinx(a, null, now), false);
});
