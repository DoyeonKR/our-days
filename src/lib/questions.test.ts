// 오늘의 질문 결정 로직 회귀 lock. 핵심 계약:
//  - 같은 '로컬 달력일'이면 항상 같은 질문(둘이 같은 질문을 봐야 답이 묶임).
//  - 하루 넘어가면 인덱스가 정확히 +1 (mod n) 로 진행(DST 무관 — Date.UTC 순수 산술).
//  - id('q{idx}') ↔ text 왕복이 일치.
//  - (2026-09-26~) 뜻이 겹치는 질문이 없고, 같은 주제가 이틀 연달아 오지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER, QUESTIONS, RETIRED, THEMES, questionDate, questionIndex, questionIndexForDay, questionText, todaysQuestion } from "./questions.ts";

const n = QUESTIONS.length;

test("todaysQuestion: 같은 로컬 날짜면 시각 무관 동일 (둘이 같은 질문) [회귀 lock]", () => {
  const morning = new Date(2026, 0, 1, 1, 5); // 로컬 2026-01-01 01:05
  const night = new Date(2026, 0, 1, 23, 55); // 로컬 2026-01-01 23:55
  const a = todaysQuestion(morning);
  const b = todaysQuestion(night);
  assert.deepEqual(a, b, "같은 날인데 시각에 따라 질문이 달라짐");
});

test("todaysQuestion: id/text 정합 + 범위 안", () => {
  const q = todaysQuestion(new Date(2026, 5, 15));
  const m = /^q(\d+)$/.exec(q.id);
  assert.ok(m, `id 포맷 이상: ${q.id}`);
  const idx = Number(m![1]);
  assert.ok(idx >= 0 && idx < n, "idx 범위 벗어남");
  assert.equal(q.text, QUESTIONS[idx]);
});

test("todaysQuestion: 연속된 날은 +1 (mod n), 항상 유효 인덱스 — 랩어라운드 포함 [회귀 lock]", () => {
  // 75문항 구간(2026-07-05 ~ 09-25, 83일) — 한 번은 경계(74 → 0)를 지난다.
  // 2026-09-26 부터는 365 팩 · 회차 id 규칙이라 아래 테스트가 따로 본다.
  const N75 = 75;
  let prev: number | null = null;
  for (let i = 0; i < 83; i++) {
    const q = todaysQuestion(new Date(2026, 6, 5 + i));
    const idx = questionIndex(q.id)!;
    assert.ok(idx >= 0 && idx < N75, `범위 이탈 day+${i}: ${idx}`);
    assert.ok(!q.id.includes("@"), `컷오버 전인데 회차 id: ${q.id}`);
    if (prev !== null) assert.equal((idx - prev + N75) % N75, 1, `day+${i} 증분이 1이 아님`);
    prev = idx;
  }
});

test("todaysQuestion: 풀 확장 컷오버 — 과거 날짜는 옛 풀(30) 유지, 컷오버부터 새 풀(36) [회귀 lock]", () => {
  // 컷오버 이전(2026-07-01, dayNum 20635): 30문항 로테이션 → 스파이시(q30~) 안 나옴
  const before = todaysQuestion(new Date(2026, 6, 1));
  const bIdx = Number(/^q(\d+)$/.exec(before.id)![1]);
  assert.ok(bIdx < 30, `컷오버 전인데 새 풀 인덱스: ${before.id}`);
  assert.equal(before.id, "q25"); // 20635 % 30
  // 과거 여러 날짜도 항상 옛 풀 범위(배포로 과거 질문이 안 바뀜)
  for (const d of [new Date(2026, 0, 15), new Date(2025, 11, 31), new Date(2026, 5, 30)]) {
    const idx = Number(/^q(\d+)$/.exec(todaysQuestion(d).id)![1]);
    assert.ok(idx < 30, `과거(${d.toDateString()})에 새 풀 인덱스 ${idx}`);
  }
  // 컷오버 당일(2026-07-03, dayNum 20637): 36문항 로테이션
  assert.equal(todaysQuestion(new Date(2026, 6, 3)).id, "q9"); // 20637 % 36
});

test("questionText: 왕복 일치 + 잘못된 id 는 '질문' 폴백", () => {
  const q = todaysQuestion(new Date(2026, 2, 3));
  assert.equal(questionText(q.id), q.text); // 왕복
  assert.equal(questionText("q0"), QUESTIONS[0]);
  assert.equal(questionText(`q${n - 1}`), QUESTIONS[n - 1]);
  assert.equal(questionText(`q${n}`), "질문"); // 범위 밖
  assert.equal(questionText("q9999"), "질문");
  assert.equal(questionText("qabc"), "질문");
  assert.equal(questionText(""), "질문");
  assert.equal(questionText("garbage"), "질문");
});

test("QUESTIONS: 중복/빈 문항 없음 (풀 품질) [회귀 lock]", () => {
  assert.ok(n >= 10, "질문 풀이 너무 적음");
  assert.equal(new Set(QUESTIONS).size, n, "중복 질문 존재");
  assert.ok(QUESTIONS.every((q) => q.trim().length > 0), "빈 질문 존재");
});

// ── 2026-09-26 365 팩 · 회차 id [사용자: "겹치는 질문 나왔을경우 이전 답변이 적혀져있어 새로운 질문이 필요해"] ──

test("★ 질문 365개 — 1년 동안 한 번도 안 겹친다", () => {
  assert.ok(QUESTIONS.length >= 365, `질문이 ${QUESTIONS.length}개뿐이다`);
  const seen = new Set<number>();
  for (let d = 20722; d < 20722 + 365; d++) seen.add(questionIndexForDay(d));
  assert.equal(seen.size, 365, "컷오버 후 1년 안에 같은 질문이 다시 나온다");
});

test("★ 컷오버 뒤엔 새 질문(75번~)이 먼저 — 며칠 전에 답한 옛 질문이 곧바로 다시 오지 않게", () => {
  const first = todaysQuestion(new Date(2026, 8, 26));
  assert.equal(questionIndex(first.id), 75);
  const fresh = QUESTIONS.length - 75; // 75번~ 전부(2026-09-25 에 끝에 붙인 8개 포함)
  for (let i = 0; i < fresh; i++) {
    const idx = questionIndex(todaysQuestion(new Date(2026, 8, 26 + i)).id)!;
    assert.ok(idx >= 75, `컷오버 ${i}일째에 옛 질문(${idx})이 나왔다`);
  }
  // 새 질문을 다 돈 다음 날부터 옛 질문으로
  const next = questionIndex(todaysQuestion(new Date(2026, 8, 26 + fresh)).id)!;
  assert.ok(next < 75 && !RETIRED.includes(next), `새 질문을 다 돈 다음 날이 옛 질문이 아니다(${next})`);
});

// ── 2026-09-25 겹침 정리 [사용자: "아직도 질문이 겹치는것들이 많아"] ──

test("★ 컷오버 첫날은 옛 번들과 같은 질문(75) — 새 번들을 아직 못 받은 기기와도 첫날은 답이 묶인다", () => {
  // 옛 번들의 규칙: 컷오버부터 새 질문(75~)을 번호 순서대로 → 첫날 75
  assert.equal(questionIndexForDay(20722), 75);
  assert.equal(ORDER[0], 75);
});

test("★ 로테이션 365 — 번호마다 한 번씩, 뜻이 겹쳐 뺀 옛 질문(RETIRED)은 다시 안 나온다", () => {
  assert.equal(ORDER.length, 365, "1년 = 365개가 아니다(RETIRED 를 늘리면 끝에 새 질문도 그만큼 붙인다)");
  assert.equal(new Set(ORDER).size, ORDER.length, "한 바퀴 안에 같은 번호가 두 번");
  const inOrder = new Set(ORDER);
  for (const r of RETIRED) assert.ok(!inOrder.has(r), `뺀 질문 ${r} 이 돈다`);
  for (let i = 0; i < QUESTIONS.length; i++) {
    if (!RETIRED.includes(i)) assert.ok(inOrder.has(i), `${i}번(${QUESTIONS[i]})이 로테이션에 없다 — 영영 안 나온다`);
  }
  // 옛 질문(RETIRED)은 글을 지우지 않는다 — 옛 답이 이 글 아래 보인다
  for (const r of RETIRED) assert.ok(QUESTIONS[r].length > 0 && questionText(`q${r}`) === QUESTIONS[r]);
});

test("★ 같은 주제가 이틀 연달아 오지 않는다 — 번호 순서면 A vs B 만 45일 이어졌다", () => {
  const themeOf = (i: number) => (i >= 365 ? THEMES.length - 1 : THEMES.findIndex(([a, b]) => i >= a && i <= b));
  const fresh = QUESTIONS.length - 75;
  let prev = themeOf(ORDER[0]);
  for (let k = 1; k < fresh; k++) {
    const t = themeOf(ORDER[k]);
    assert.ok(t >= 0, `${ORDER[k]}번이 어느 주제에도 없다`);
    assert.notEqual(t, prev, `${k}일째(${QUESTIONS[ORDER[k]]})가 전날과 같은 주제`);
    prev = t;
  }
  // 한 주제가 너무 뜸하지도 않게 — 어느 주제든 2주 안에 한 번은 온다
  const last = new Map<number, number>();
  for (let k = 0; k < fresh; k++) {
    const t = themeOf(ORDER[k]);
    if (last.has(t)) assert.ok(k - last.get(t)! <= 14, `주제 ${t} 가 ${k - last.get(t)!}일 만에 온다`);
    last.set(t, k);
  }
});

test("★ 이미 나온 옛 질문(0~74)의 글은 그대로 — 바꾸면 옛 답이 다른 질문 아래 보인다", () => {
  // 겹치면 글을 고치지 말고 RETIRED 로 로테이션에서만 뺀다. 이 지문이 바뀌었다면 옛 글이 바뀐 것이다.
  const fnv = (s: string) => {
    let h = 0x811c9dc5;
    for (const ch of s) {
      h ^= ch.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  assert.equal(fnv(QUESTIONS.slice(0, 75).join("\n")), "44499530");
});

// 뜻이 겹치는 질문 — 흔한 말(우리·제일·요즘·오늘…)과 조사를 떼고 남은 낱말 · 두 글자 조각의 겹침.
// "요즘 제일 자주 듣는 노래는?" ↔ "요즘 가장 많이 듣는 노래는?" 같은 쌍이 1.0 이 된다(자주·많이도 흔한 말로 친다). 낱말이 다른데 뜻이 같은 쌍
// (첫인상 두 개 등)은 못 잡는다 — 새 질문을 넣을 땐 눈으로도 읽는다(README §5).
const FILLER = new Set(
  "우리 둘이 둘의 둘만 둘만의 둘 서로 서로에게 서로의 너의 나의 나한테 나에게 나랑 나를 내가 너를 너랑 너 나 내 네 제일 가장 자주 많이 요즘 오늘 지금 최근 최근에 하나만 하나 한 한번 있어 있다면 한다면 된다면 이라면 라면 뭐야 뭐였어 뭘까 뭐 뭘 건 것 거 게 기억나 말해줘 알려줘 골라줘 추천해줘 그리고 이유 이유는 꼭 같이 함께 좋아 좋을까 좋겠어 어때 어땠어 어떤 어디 언제 누구 누가 무슨 몇 때 순간 순간은 vs".split(" "),
);
const words = (q: string) =>
  q
    .split(/\s+/)
    .map((t) => t.replace(/[?!.,'"·()~/…😏😉:]/g, "").replace(/(은|는|이|가|을|를|에|의|도|만|야|요|랑|과|와|으로|로|에서|에게|한테|까지|부터)$/, ""))
    .filter((t) => t && !FILLER.has(t));
function similarity(a: string, b: string): number {
  const A = new Set(words(a)), B = new Set(words(b));
  const inter = [...A].filter((x) => B.has(x)).length;
  const jaccard = A.size + B.size ? inter / (A.size + B.size - inter) : 0;
  const grams = (s: string) => Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2));
  const ga = grams(words(a).join("")), gb = grams(words(b).join(""));
  const pool = [...gb];
  let hit = 0;
  for (const g of ga) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  const dice = ga.length + gb.length ? (2 * hit) / (ga.length + gb.length) : 0;
  return Math.max(jaccard, dice);
}

test("★ 뜻이 겹치는 질문이 없다 — 새 질문(75~)이 낀 쌍은 낱말 겹침 0.6 미만", () => {
  // 옛 질문끼리(0~74)는 글을 못 바꿔서 여기서 안 본다 — 겹치면 RETIRED 로 뺀다.
  assert.ok(similarity("요즘 제일 자주 듣는 노래는?", "요즘 가장 많이 듣는 노래는?") >= 0.6, "검사가 헛돈다(뺀 쌍도 못 잡는다)");
  const bad: string[] = [];
  for (let x = 0; x < ORDER.length; x++)
    for (let y = x + 1; y < ORDER.length; y++) {
      const i = ORDER[x], j = ORDER[y];
      if (i < 75 && j < 75) continue;
      const s = similarity(QUESTIONS[i], QUESTIONS[j]);
      if (s >= 0.6) bad.push(`${s.toFixed(2)} ${i}:${QUESTIONS[i]} ↔ ${j}:${QUESTIONS[j]}`);
    }
  assert.deepEqual(bad, [], `겹치는 질문:\n${bad.join("\n")}`);
});

test("★ 회차 id — 같은 질문이 다시 와도 새 회차(날짜가 다르면 id 가 다르다)", () => {
  const a = todaysQuestion(new Date(2026, 8, 26));
  const again = todaysQuestion(new Date(2026, 8, 26 + 365)); // 1년 뒤 같은 질문
  assert.equal(questionIndex(again.id), questionIndex(a.id), "전제: 1년 뒤 같은 질문");
  assert.notEqual(again.id, a.id, "같은 질문인데 id 가 같다 — 예전 답이 '이미 쓴 답'으로 뜬다");
  assert.equal(a.id, "q75@2026-09-26");
  assert.equal(questionDate(a.id), "2026-09-26");
  assert.equal(questionText(a.id), a.text);
  // 옛 id 는 그대로 읽힌다
  assert.equal(questionIndex("q12"), 12);
  assert.equal(questionDate("q12"), null);
  assert.equal(questionIndex("q12@2026-09-26x"), null);
});

test("컷오버 전 날짜는 옛 id(날짜 없음) 그대로 — 배포로 과거 질문이 바뀌지 않는다", () => {
  assert.equal(todaysQuestion(new Date(2026, 8, 25)).id.includes("@"), false);
  assert.equal(todaysQuestion(new Date(2026, 8, 24)).id, "q20");
});
