// 펫 계보 표 — 순수 데이터. [2026-10-04 펫 개편, docs/PET-LINEAGES.md]
//
// 계보 = 한 생물이 자라는 일직선(성장기 Lv15 → 중간형 Lv30 → 최종형 Lv50).
// 가족 = 가장 많이 해 준 돌봄(놀기·안기·밥·씻기·재우기) — 가족마다 계보가 둘(A·B).
//   A = 손버릇이 **뚜렷할** 때 가는 계보, B = 고루 했을 때 쪽(애매하면 생마다 A·B 번갈아).
//
// 왜 따로 파일인가: 이 표는 엔진(island.ts) · 도트(pixellineage.ts) · 화면 · 테스트가 모두 읽는다.
// 엔진을 통째로 끌어오지 않고도 읽을 수 있어야(첫 로드 · 순환 import 방지) 한 곳이 정본일 수 있다.
// ⚠ island.ts 를 **값으로** import 하지 마라 — 타입만(`import type`). island.ts 가 이 파일을 읽는다.
//
// ⚠ 속성은 분위기 표시일 뿐 전투 상성은 없다(사냥은 무기만 본다).
// ⚠ 이모지는 기존 폼(PET_FORMS)과 안 겹쳐야 한다 — 도감·박물관에서 같으면 같은 폼으로 읽힌다
//   (lineage.test 가 겹침을 잡는다).

import type { CareAct } from "./island.ts";

export type LineageForm = { key: string; name: string; emoji: string };

export type Lineage = {
  /** 계보 키 — 폼 키는 `${key}_2` · `_3` · `_4`. */
  key: string;
  family: CareAct;
  /** 0 = A(뚜렷할 때), 1 = B(고르거나 번갈아). 가족 안 순서가 곧 `돌림` 순서다. */
  slot: 0 | 1;
  /** 분위기 속성 이름. */
  type: string;
  /** 성장기(2) · 중간형(3) · 최종형(4). */
  forms: readonly [LineageForm, LineageForm, LineageForm];
  /** 한 줄 소개 — 도감용. */
  note: string;
};

const f = (key: string, n: 2 | 3 | 4, name: string, emoji: string): LineageForm => ({ key: `${key}_${n}`, name, emoji });

export const LINEAGES: readonly Lineage[] = [
  // ── 볕 (놀기) ────────────────────────────────────────────────
  {
    key: "ember", family: "play", slot: 0, type: "불꽃",
    forms: [f("ember", 2, "불똥이", "🎇"), f("ember", 3, "불도롱", "🦎"), f("ember", 4, "염룡", "🌋")],
    note: "불꽃 아가미를 단 도롱뇽. 자랄수록 불꽃 갈기가 커져요",
  },
  {
    key: "volt", family: "play", slot: 1, type: "전기",
    forms: [f("volt", 2, "찌릿이", "⚡"), f("volt", 3, "번개참새", "🕊️"), f("volt", 4, "천둥새", "🌩️")],
    note: "번개 볏을 단 새. 다 자라면 날개를 활짝 펴요",
  },
  // ── 포근 (안기) ──────────────────────────────────────────────
  {
    key: "burr", family: "hug", slot: 0, type: "노말",
    forms: [f("burr", 2, "밤톨이", "🥜"), f("burr", 3, "밤송이", "🦔"), f("burr", 4, "대왕밤송이", "🍂")],
    note: "밤송이처럼 둥근 고슴도치. 가시 끝이 솜털 같아요",
  },
  {
    key: "puff", family: "hug", slot: 1, type: "페어리",
    forms: [f("puff", 2, "몽실이", "☁️"), f("puff", 3, "구름양", "🐑"), f("puff", 4, "뭉게양", "🌈")],
    note: "구름 털을 두른 양. 털 끝에 무지개가 어려요",
  },
  // ── 숲 (밥) ──────────────────────────────────────────────────
  {
    key: "leaf", family: "feed", slot: 0, type: "풀",
    forms: [f("leaf", 2, "풀쏙이", "🍃"), f("leaf", 3, "잎개구리", "🐸"), f("leaf", 4, "연꽃개구리", "🌼")],
    note: "잎사귀를 머리에 얹은 개구리. 다 자라면 꽃을 피워요",
  },
  {
    key: "beetle", family: "feed", slot: 1, type: "벌레",
    forms: [f("beetle", 2, "굼벵이", "🐛"), f("beetle", 3, "풍뎅이", "🐞"), f("beetle", 4, "장수풍뎅이", "🪲")],
    note: "굼벵이가 자라 뿔 달린 풍뎅이가 돼요",
  },
  // ── 물 (씻기) ────────────────────────────────────────────────
  {
    key: "conch", family: "clean", slot: 0, type: "물",
    forms: [f("conch", 2, "소라꼬마", "🐚"), f("conch", 3, "소라게", "🦀"), f("conch", 4, "소라성주", "🏰")],
    note: "소라 껍데기를 지고 다니는 게. 껍데기가 성이 돼요",
  },
  {
    key: "snow", family: "clean", slot: 1, type: "얼음",
    forms: [f("snow", 2, "눈송이", "❄️"), f("snow", 3, "눈덩이", "⛄"), f("snow", 4, "눈사람왕", "🧊")],
    note: "눈 한 톨이 눈덩이가 되고 목도리 두른 눈사람이 돼요",
  },
  // ── 그늘 (재우기) ────────────────────────────────────────────
  {
    key: "bat", family: "rest", slot: 0, type: "악",
    forms: [f("bat", 2, "깜박이", "🌑"), f("bat", 3, "밤박쥐", "🦇"), f("bat", 4, "박쥐군주", "🌌")],
    note: "밤하늘을 닮은 박쥐. 날개 안에 별이 떠요",
  },
  {
    key: "ghost", family: "rest", slot: 1, type: "고스트",
    forms: [f("ghost", 2, "이불이", "🛏️"), f("ghost", 3, "이불유령", "🌫️"), f("ghost", 4, "한밤유령", "🕯️")],
    note: "이불을 뒤집어쓴 유령. 한밤엔 촛불을 들어요",
  },
];

/** 가족 이름 — 돌봄 한 가지가 계열 하나다. */
export const FAMILY_NAME: Record<CareAct, string> = {
  play: "볕", hug: "포근", feed: "숲", clean: "물", rest: "그늘",
};
/** 가족 → 돌봄 이름(화면 문구용). */
export const CARE_NAME: Record<CareAct, string> = {
  play: "놀기", hug: "안기", feed: "밥", clean: "씻기", rest: "재우기",
};

/** 가족 안 계보 목록(slot 순). 돌림 번호가 이 순서를 따라 돈다. */
export const LINEAGES_BY_FAMILY: Record<CareAct, readonly Lineage[]> = {
  play: LINEAGES.filter((l) => l.family === "play").sort((a, b) => a.slot - b.slot),
  hug: LINEAGES.filter((l) => l.family === "hug").sort((a, b) => a.slot - b.slot),
  feed: LINEAGES.filter((l) => l.family === "feed").sort((a, b) => a.slot - b.slot),
  clean: LINEAGES.filter((l) => l.family === "clean").sort((a, b) => a.slot - b.slot),
  rest: LINEAGES.filter((l) => l.family === "rest").sort((a, b) => a.slot - b.slot),
};

/** 폼 키 → {계보, 단계(2~4)}. 계보에 없는 키는 undefined. */
export const LINEAGE_OF_FORM: Readonly<Record<string, { lineage: Lineage; stage: 2 | 3 | 4 }>> = Object.fromEntries(
  LINEAGES.flatMap((l) => l.forms.map((fm, i) => [fm.key, { lineage: l, stage: (2 + i) as 2 | 3 | 4 }])),
);

/** 계보 폼 키 전부(30개). 도트 전용 — 일러스트(SVG) 원화는 없다. */
export const LINEAGE_FORM_KEYS: readonly string[] = LINEAGES.flatMap((l) => l.forms.map((fm) => fm.key));

/** 도트 전용 폼인가 — 일러스트 모드에서도 도트로 그려야 한다. petArt(form) 은 원화가 없는 키를 **알**로 돌려주므로,
 *  일러스트 아트(PET_ART)를 직접 쓰는 곳(PetYard · IslandScene · PetIcon)은 이걸로 먼저 가른다. 정적 임포트가 가벼운
 *  이 파일에 둔 이유: 일러스트 아트 전체(pets.tsx)를 끌어오지 않고도 물을 수 있어야 한다. */
export const isPixelOnlyForm = (form: string): boolean => form in LINEAGE_OF_FORM;

/** 지금 계보를 쓰는 가족. 여기 없는 가족은 옛 규칙(성장기 병아리 5색 → 중간형 → 최종형)으로 간다.
 *  ⚠ 도트가 다 갖춰진 가족만 넣는다 — 도트가 없는 폼으로 보내면 펫이 알로 그려진다.
 *  한 줄로 끄고 켤 수 있어서 문제가 생기면 이 집합만 비우면 된다(이미 자라는 펫은 영향 없음). */
export const LIVE_FAMILIES: ReadonlySet<CareAct> = new Set<CareAct>(["play", "hug", "feed", "clean", "rest"]);

/** 가족의 계보 중 돌림 번호로 하나를 고른다. 뚜렷하면(clear) 항상 A.
 *  ⚠ 계보 돌림은 가족 돌림(`돌림 mod k`)과 **다른 번호**여야 한다 — `⌊돌림 ÷ k⌋`.
 *    같은 번호의 홀짝을 쓰면 k=2 일 때 가족과 계보가 묶여 네 계보 중 둘만 나온다(docs/PET-LINEAGES.md §3.1). */
export function pickLineage(family: CareAct, clear: boolean, cycle: number): Lineage {
  const list = LINEAGES_BY_FAMILY[family];
  if (clear) return list[0];
  const n = list.length;
  return list[((Math.floor(cycle) % n) + n) % n];
}
