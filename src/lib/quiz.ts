// 서로 알기 퀴즈 문항 (번들 — A/B 취향). 각자 '나는?' + '상대는?(예측)' 을 고르고,
// 둘 다 답하면 내 예측이 상대 실제와 맞았는지 점수. question_id 는 안정(끝에만 추가).
export type QuizChoice = "a" | "b";
export type QuizQ = { id: string; q: string; a: string; b: string };

export const QUIZ: QuizQ[] = [
  { id: "qz0", q: "쉬는 날엔?", a: "집콕 🏠", b: "밖에 나가기 🚶" },
  { id: "qz1", q: "여행 스타일은?", a: "계획파 📋", b: "즉흥파 🎲" },
  { id: "qz2", q: "아침형 vs 저녁형?", a: "아침형 🌅", b: "저녁형 🌙" },
  { id: "qz3", q: "데이트 먹거리?", a: "맛집 탐방 🍽️", b: "집밥·배달 🍚" },
  { id: "qz4", q: "연락 스타일?", a: "자주 짧게 💬", b: "가끔 길게 📞" },
  { id: "qz5", q: "다투면?", a: "바로 풀기 🤝", b: "시간 두기 ⏳" },
  { id: "qz6", q: "선물은?", a: "실용템 🎁", b: "감성템 💌" },
  { id: "qz7", q: "휴가지?", a: "바다 🌊", b: "산 ⛰️" },
  { id: "qz8", q: "영화 취향?", a: "액션·스릴러 💥", b: "로맨스·드라마 💕" },
  { id: "qz9", q: "카페 vs 술집?", a: "카페 ☕", b: "술집 🍺" },
  { id: "qz10", q: "성향은?", a: "외향 E 🎉", b: "내향 I 📖" },
  { id: "qz11", q: "돈 쓰는 편은?", a: "아끼는 편 🐿️", b: "쓰는 편 💸" },
  { id: "qz12", q: "정리·청소는?", a: "깔끔파 ✨", b: "느긋파 🌀" },
  { id: "qz13", q: "겨울 vs 여름?", a: "겨울 ❄️", b: "여름 ☀️" },
  { id: "qz14", q: "먼저 고백은?", a: "내가 먼저 💘", b: "상대가 먼저 💝" },
];

export function quizChoiceLabel(id: string, choice: QuizChoice): string {
  const q = QUIZ.find((x) => x.id === id);
  if (!q) return choice;
  return choice === "a" ? q.a : q.b;
}

export type QuizResponseLite = {
  question_id: string;
  user_id: string;
  self_choice: QuizChoice;
  guess_choice: QuizChoice;
};

/** 둘 다 답한 문제에서 '내 예측(guess)'이 '상대 실제(self)'와 맞은 개수.
 *  total = 둘 다 답한 문제 수. 순수 함수(회귀 lock 가능). */
export function quizScore(
  responses: QuizResponseLite[],
  uid: string | null,
): { correct: number; total: number } {
  const mine = new Map<string, QuizResponseLite>();
  const partner = new Map<string, QuizResponseLite>();
  for (const r of responses) {
    (r.user_id === uid ? mine : partner).set(r.question_id, r);
  }
  let correct = 0;
  let total = 0;
  for (const [qid, m] of mine) {
    const p = partner.get(qid);
    if (!p) continue;
    total += 1;
    if (m.guess_choice === p.self_choice) correct += 1;
  }
  return { correct, total };
}
