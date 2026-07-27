// 펫 액션 리액션 스펙 — "무엇을 하면 어떤 연출이 나오는가"의 단일 소스(순수).
// UI(PetYard)는 이 스펙대로 소품(emoji)을 띄우고 몸 애니 클래스를 입힌다.
// ⚠ DOM/React/시간 의존 없음 — 결정적, 테스트 가능.

export type PetActionKind = "feed" | "clean" | "play" | "hug" | "rest" | "wake" | "medicine";

export type FxProp = {
  emoji: string;
  x: number; // 펫 중심 기준 오프셋(px)
  y: number;
  anim: "fx-pop" | "fx-rise" | "fx-drop" | "fx-bubble";
  delay?: number; // ms
};

export type PetFxSpec = {
  body: string | null; // 펫 몸에 입힐 애니 클래스(없으면 null — 예: 재우기는 포즈가 담당)
  ms: number; // 연출 전체 길이(부모가 이 시간 뒤 fx 를 걷는다)
  props: FxProp[];
  dim?: boolean; // 무대를 은은히 어둡게(재우기)
};

const SPEC: Record<PetActionKind, PetFxSpec> = {
  feed: {
    body: "animate-pet-munch",
    ms: 1500,
    props: [
      { emoji: "🍚", x: -30, y: 26, anim: "fx-pop" },
      { emoji: "🍙", x: 22, y: -18, anim: "fx-rise", delay: 350 },
      { emoji: "😋", x: 0, y: -32, anim: "fx-rise", delay: 800 },
    ],
  },
  clean: {
    body: "animate-pet-shake-dry",
    ms: 1800,
    props: [
      { emoji: "🫧", x: -24, y: -8, anim: "fx-bubble" },
      { emoji: "🫧", x: 16, y: -20, anim: "fx-bubble", delay: 220 },
      { emoji: "💧", x: 0, y: -34, anim: "fx-drop", delay: 120 },
      { emoji: "🫧", x: 28, y: 2, anim: "fx-bubble", delay: 420 },
      { emoji: "✨", x: 0, y: -10, anim: "fx-pop", delay: 1250 },
    ],
  },
  play: {
    body: "animate-pet-joy",
    ms: 1100,
    props: [
      { emoji: "⚽", x: -36, y: 22, anim: "fx-pop" },
      { emoji: "💨", x: 26, y: 10, anim: "fx-rise", delay: 250 },
    ],
  },
  hug: {
    body: "animate-pet-squish-2",
    ms: 900,
    props: [
      { emoji: "💗", x: 0, y: -28, anim: "fx-rise" },
      { emoji: "💗", x: -20, y: -16, anim: "fx-rise", delay: 130 },
      { emoji: "💗", x: 20, y: -16, anim: "fx-rise", delay: 260 },
    ],
  },
  rest: {
    body: null, // 눕는 포즈는 asleep 상태가 담당 — 여기선 이불/스르르 소품만
    ms: 1300,
    props: [
      { emoji: "💤", x: 14, y: -26, anim: "fx-rise" },
      { emoji: "🌙", x: -22, y: -30, anim: "fx-pop", delay: 200 },
    ],
    dim: true,
  },
  wake: {
    body: "animate-pet-startle",
    ms: 1200,
    props: [
      { emoji: "⏰", x: -26, y: -26, anim: "fx-pop" },
      { emoji: "❗", x: 22, y: -32, anim: "fx-rise", delay: 180 },
      { emoji: "🙈", x: 0, y: -12, anim: "fx-pop", delay: 600 },
    ],
  },
  medicine: {
    body: "animate-pet-jitter-once",
    ms: 1500,
    props: [
      { emoji: "💊", x: 0, y: -30, anim: "fx-drop" },
      { emoji: "✨", x: -16, y: -8, anim: "fx-pop", delay: 850 },
      { emoji: "💪", x: 18, y: -20, anim: "fx-rise", delay: 1000 },
    ],
  },
};

/** 액션 종류 → 연출 스펙. */
export function petFx(kind: PetActionKind): PetFxSpec {
  return SPEC[kind];
}

export const PET_ACTION_KINDS: PetActionKind[] = ["feed", "clean", "play", "hug", "rest", "wake", "medicine"];
