// 오늘의 질문 풀 (번들 — 서버 불필요). 날짜 시드로 그날 질문 결정 → 둘이 같은 질문.
// ⚠ 순서를 바꾸지 말고 새 질문은 끝에만 추가 (question_id 가 index 기반이라 안정성 유지).
export const QUESTIONS: string[] = [
  "오늘 가장 고마웠던 순간은?",
  "요즘 나를 가장 웃게 하는 건 뭐야?",
  "우리가 처음 만난 날 기억나는 장면 하나는?",
  "지금 제일 하고 싶은 데이트는?",
  "최근에 나한테 서운했던 적 있어?",
  "내가 어떤 말 해줄 때 가장 힘이 나?",
  "우리 관계에서 제일 소중한 건 뭐라고 생각해?",
  "다음 여행 가고 싶은 곳 한 곳만?",
  "오늘 하루를 색으로 표현하면?",
  "내가 몰랐으면 하는 나의 매력 포인트는?",
  "요즘 스트레스 받는 일 있어?",
  "우리 1년 뒤엔 어떤 모습이면 좋겠어?",
  "내가 해준 것 중 제일 기억에 남는 건?",
  "지금 가장 배우고 싶은 게 있다면?",
  "오늘 나에게 하고 싶은 칭찬 한마디?",
  "우리만의 규칙을 하나 만든다면?",
  "요즘 제일 자주 듣는 노래는?",
  "힘들 때 내가 어떻게 해주면 좋아?",
  "최근에 제일 맛있게 먹은 음식은?",
  "내가 반한 너의 첫인상은?",
  "이번 주 가장 기대되는 일은?",
  "우리 같이 도전해보고 싶은 거 있어?",
  "오늘 나에게 필요한 한마디는?",
  "내가 없으면 제일 아쉬울 순간은?",
  "지금 마음속 날씨는 맑음/흐림/비 중 뭐야?",
  "우리 사이 별명을 새로 짓는다면?",
  "요즘 사고 싶은 거 하나?",
  "내가 더 자주 해줬으면 하는 표현이 있어?",
  "오늘 웃겼던 일 하나 공유해줘",
  "10년 뒤 우리는 뭘 하고 있을까?",
  // ↓ 스파이시 팩 (커플 전용 공간이라 은근한 19금 허용) — 끝에만 추가(append-only)
  "요즘 나의 어떤 모습에 제일 설레?",
  "내가 어떤 스킨십 해줄 때 제일 좋아?",
  "우리 둘만 아는 은밀한 추억 하나는?",
  "오늘 밤 나랑 같이 하고 싶은 것 하나만 😏",
  "나한테 반했던 '그 순간'을 자세히 말해줘",
  "함께 해보고 싶은 짜릿한 일탈 하나는?",
];

/**
 * 로테이션 스케줄 — 질문 풀을 늘릴 때 QUESTIONS.length 를 그대로 쓰면(idx=day%n)
 * 배포 순간 '오늘의 질문'이 모두 바뀌고, 번들 스큐(한쪽 구버전) 시 커플이 서로 다른
 * 질문에 답해 영영 안 묶인다. 그래서 컷오버 일자부터만 새 풀 크기를 적용한다.
 * ⚠ 질문을 추가하면: QUESTIONS 끝에 append + 여기 (내일 이후의 fromDay, 새 length) 1줄 append.
 */
const ROTATION: { fromDay: number; n: number }[] = [
  { fromDay: 0, n: 30 },
  { fromDay: 20637, n: 36 }, // 2026-07-03 부터 스파이시 팩(31~36번째) 로테이션 편입
];

export function todaysQuestion(ref: Date = new Date()): { id: string; text: string } {
  const dayNum = Math.floor(
    Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()) / 86_400_000,
  );
  let n = ROTATION[0].n;
  for (const r of ROTATION) if (dayNum >= r.fromDay) n = r.n;
  n = Math.min(n, QUESTIONS.length); // 안전 가드
  const idx = ((dayNum % n) + n) % n;
  return { id: `q${idx}`, text: QUESTIONS[idx] };
}

/** question_id('q{idx}') → 질문 텍스트. */
export function questionText(id: string): string {
  const m = /^q(\d+)$/.exec(id);
  if (m) {
    const idx = Number(m[1]);
    if (idx >= 0 && idx < QUESTIONS.length) return QUESTIONS[idx];
  }
  return "질문";
}
