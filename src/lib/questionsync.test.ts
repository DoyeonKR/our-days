// 아침 질문 알림(daily-reminders)과 앱이 **같은 질문**을 쓰는가 lock. [2026-09-24]
// 엣지 함수(Deno)는 src/ 를 못 불러와서 supabase/functions/_shared/questions.ts 에 복사본을 둔다.
// 한쪽만 고치면 알림은 A 질문, 앱은 B 질문이 된다 — 글자 하나까지 같아야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const norm = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");

test("질문 풀 복사본이 원본과 같다(src/lib ↔ supabase/functions/_shared)", () => {
  assert.equal(norm("supabase/functions/_shared/questions.ts"), norm("src/lib/questions.ts"));
});

test("질문 모듈은 import 가 없다 — Deno 에서도 그대로 돌아야 한다", () => {
  assert.ok(!/^\s*import\s/m.test(norm("src/lib/questions.ts")));
});

test("아침 알림 — 오늘의 질문을 보내고(이미 답했으면 안 보냄), 아침에만, 설정으로 끌 수 있다", () => {
  const fn = norm("supabase/functions/daily-reminders/index.ts").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /from "\.\.\/_shared\/questions\.ts"/, "공유 질문 모듈을 안 쓴다");
  assert.match(fn, /todaysQuestion\(today\)/, "그 사람의 오늘 날짜로 질문을 고르지 않는다");
  assert.match(fn, /prefs\?\.question !== false/, "아침 질문 알림을 끌 수 없다");
  assert.match(fn, /\.from\("qa_answers"\)[\s\S]{0,200}question_id", q\.id\)/, "이미 답한 사람에게도 보낸다");
  assert.match(fn, /url: "\.\/\?go=answer"/, "알림을 누르면 질문 카드로 안 간다");
  assert.match(fn, /hour >= 6 && hour < 12/, "아침에만 보내는 조건이 없다");
  const notify = norm("src/lib/notify.ts");
  assert.match(notify, /\{ key: "question", label: "아침 질문 알림"/, "설정 화면에 아침 질문 알림 토글이 없다");
});
