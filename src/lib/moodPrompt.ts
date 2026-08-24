import { kstDayOf } from "./kst.ts";

// '오늘 어땠어?' — 오늘의 기분 한 줄 평의 **매일 바뀌는 프롬프트**(순수·결정적).
// 옛 '오늘의 기분'(이모지 그리드 숙제 느낌)의 복귀 버전: 매일 다른 가벼운 질문이
// 놀이처럼 물어보고, 칩 하나 탭이면 끝. 둘이 같은 날 = 같은 프롬프트(KST 날짜 시드)라
// "같은 질문에 우리 둘의 답"이 성립한다. 같은 답이면 이심전심 💞.

export type MoodPrompt = {
  id: string;
  q: string; // 오늘의 질문(가볍게)
  chips: { e: string; label: string }[]; // 답 칩 6개 — 탭 1번이 전부
};

/** 프롬프트 풀 — 끝에만 추가(로테이션 안정). 칩은 6개 고정(2줄 3칸 그리드). */
export const MOOD_PROMPTS: MoodPrompt[] = [
  {
    id: "weather",
    q: "오늘을 날씨로 표현하면?",
    chips: [
      { e: "☀️", label: "쨍쨍" },
      { e: "🌤️", label: "맑음" },
      { e: "☁️", label: "흐림" },
      { e: "🌧️", label: "비" },
      { e: "⛈️", label: "폭풍" },
      { e: "🌈", label: "무지개" },
    ],
  },
  {
    id: "taste",
    q: "오늘 기분을 맛으로?",
    chips: [
      { e: "🍯", label: "달콤" },
      { e: "🍋", label: "새콤" },
      { e: "🌶️", label: "매콤" },
      { e: "🍦", label: "시원" },
      { e: "🍿", label: "고소" },
      { e: "🫖", label: "쌉싸름" },
    ],
  },
  {
    id: "energy",
    q: "지금 배터리 몇 칸?",
    chips: [
      { e: "🚀", label: "풀충전" },
      { e: "⚡", label: "쌩쌩" },
      { e: "🔋", label: "보통" },
      { e: "🪫", label: "간당" },
      { e: "😴", label: "방전" },
      { e: "🧘", label: "절전모드" },
    ],
  },
  {
    id: "animal",
    q: "오늘의 나, 동물로 치면?",
    chips: [
      { e: "🐶", label: "신남" },
      { e: "🐱", label: "도도" },
      { e: "🦥", label: "느긋" },
      { e: "🐿️", label: "분주" },
      { e: "🦁", label: "당당" },
      { e: "🐢", label: "꾸준" },
    ],
  },
  {
    id: "temp",
    q: "오늘 마음 온도는?",
    chips: [
      { e: "🧊", label: "꽁꽁" },
      { e: "❄️", label: "서늘" },
      { e: "🌡️", label: "미지근" },
      { e: "♨️", label: "따뜻" },
      { e: "🔥", label: "후끈" },
      { e: "💗", label: "몽글" },
    ],
  },
  {
    id: "one",
    q: "오늘을 이모지 하나로!",
    chips: [
      { e: "😊", label: "좋았어" },
      { e: "🥰", label: "행복" },
      { e: "😮‍💨", label: "후유" },
      { e: "😤", label: "으엑" },
      { e: "🥲", label: "찡함" },
      { e: "🤪", label: "정신없음" },
    ],
  },
];

/** KST 일수(에포크 기준) — 날짜가 바뀌면 프롬프트도 바뀐다. */
export { kstDayOf }; // 단일 소스(lib/kst) 재수출 — 기존 import 경로 유지

/** 오늘의 프롬프트(둘이 동일 — 날짜 결정). */
export function todaysMoodPrompt(now: number): MoodPrompt {
  return MOOD_PROMPTS[kstDayOf(now) % MOOD_PROMPTS.length];
}

/** 그날(KST) 안에 기록된 무드인지 — mood_checkins 는 '현재 1행' 스키마라 오늘 여부는 시각으로 판정. */
export function isTodayMood(updatedAtIso: string, now: number): boolean {
  const t = Date.parse(updatedAtIso);
  return Number.isFinite(t) && kstDayOf(t) === kstDayOf(now);
}

/** 이심전심 — 둘 다 오늘 답했고 같은 칩. */
export function isJinx(
  mine: { emoji: string; updated_at: string } | null,
  partner: { emoji: string; updated_at: string } | null,
  now: number,
): boolean {
  return !!(
    mine &&
    partner &&
    isTodayMood(mine.updated_at, now) &&
    isTodayMood(partner.updated_at, now) &&
    mine.emoji === partner.emoji
  );
}
