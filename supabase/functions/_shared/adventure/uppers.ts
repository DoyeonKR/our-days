// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
type CareAct = "feed" | "play" | "clean" | "hug" | "rest";

export type UpperForm = { key: string; stage: 5 | 6 | 7 | 8; name: string; emoji: string; note: string };

export const UPPERS: readonly UpperForm[] = [
  { key: "cheonma", stage: 5, name: "천마", emoji: "🎠", note: "놀기가 으뜸인 계보가 닿는 하늘 말" },
  { key: "baengnok", stage: 5, name: "백록", emoji: "🤍", note: "안기가 으뜸인 계보가 닿는 흰 사슴" },
  { key: "bulgasari", stage: 5, name: "불가사리", emoji: "🔩", note: "밥이 으뜸인 계보가 닿는 쇠 먹는 영물" },
  { key: "imugi", stage: 5, name: "이무기", emoji: "🐍", note: "씻기가 으뜸인 계보가 닿는, 용이 되려는 물뱀" },
  { key: "maek", stage: 5, name: "몽맥", emoji: "🌠", note: "재우기가 으뜸인 계보가 닿는 꿈 먹는 영물" },
  { key: "bii_jo", stage: 6, name: "비익조", emoji: "💞", note: "둘이 날개를 맞대야 나는 새 — 유대를 가장 깊이 판 이" },
  { key: "eungryong", stage: 6, name: "응룡", emoji: "⛈️", note: "날개 달린 용 — 출석을 가장 꾸준히 이어 온 이" },
  { key: "baektaek", stage: 6, name: "백택", emoji: "🔭", note: "만물을 아는 흰 영수 — 도감을 가장 많이 채운 이" },
  { key: "geumseom", stage: 6, name: "금두꺼비", emoji: "🪙", note: "복을 부르는 금빛 두꺼비 — 섬을 가장 크게 키운 이" },
  { key: "samjoko", stage: 7, name: "삼족오", emoji: "🌞", note: "해 속의 세 발 까마귀 — 둘의 유대가 깊은 이" },
  { key: "cheonrok", stage: 7, name: "천록", emoji: "🔔", note: "하늘의 복을 내리는 사슴 — 꾸준히 찾아온 이" },
  { key: "hong_dragon", stage: 8, name: "홍룡", emoji: "🎆", note: "무지개 비늘의 용 — 박물관을 크게 채운 이" },
];

export const UPPER_KEYS: ReadonlySet<string> = new Set(UPPERS.map((u) => u.key));

export const MYTHIC_BEAST_BY_ACT: Readonly<Record<CareAct, string>> = {
  play: "cheonma",
  hug: "baengnok",
  feed: "bulgasari",
  clean: "imugi",
  rest: "maek",
};

export const mythicBeastOf = (acts: readonly CareAct[]): string =>
  acts.length >= 4 ? "tiger" : MYTHIC_BEAST_BY_ACT[acts[0]];
