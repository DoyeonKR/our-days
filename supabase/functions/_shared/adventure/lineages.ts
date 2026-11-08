// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
type CareAct = "feed" | "play" | "clean" | "hug" | "rest";
import { UPPER_KEYS } from "./uppers.ts";

export type LineageForm = { key: string; name: string; emoji: string };

export type Lineage = {

  key: string;

  acts: readonly CareAct[];

  type: string;

  forms: readonly [LineageForm, LineageForm, LineageForm];

  note: string;
};

export const CARE_ORDER: readonly CareAct[] = ["play", "hug", "feed", "clean", "rest"];

const f = (key: string, n: 2 | 3 | 4, name: string, emoji: string): LineageForm => ({ key: `${key}_${n}`, name, emoji });

export const LINEAGES: readonly Lineage[] = [
  {
    key: "ember", acts: ["play"], type: "불꽃",
    forms: [f("ember", 2, "불똥이", "🎇"), f("ember", 3, "불도롱", "🦎"), f("ember", 4, "염룡", "🌋")],
    note: "불꽃 아가미를 단 도롱뇽. 자랄수록 불꽃 갈기가 커져요",
  },
  {
    key: "burr", acts: ["hug"], type: "노말",
    forms: [f("burr", 2, "밤톨이", "🥜"), f("burr", 3, "밤송이", "🦔"), f("burr", 4, "대왕밤송이", "🍂")],
    note: "밤송이처럼 둥근 고슴도치. 가시 끝이 솜털 같아요",
  },
  {
    key: "leaf", acts: ["feed"], type: "풀",
    forms: [f("leaf", 2, "풀쏙이", "🍃"), f("leaf", 3, "잎개구리", "🐸"), f("leaf", 4, "연꽃개구리", "🌼")],
    note: "잎사귀를 머리에 얹은 개구리. 다 자라면 꽃을 피워요",
  },
  {
    key: "conch", acts: ["clean"], type: "물",
    forms: [f("conch", 2, "소라꼬마", "🐚"), f("conch", 3, "소라게", "🦀"), f("conch", 4, "소라성주", "🏰")],
    note: "소라 껍데기를 지고 다니는 게. 껍데기가 성이 돼요",
  },
  {
    key: "bat", acts: ["rest"], type: "악",
    forms: [f("bat", 2, "깜박이", "🌑"), f("bat", 3, "밤박쥐", "🦇"), f("bat", 4, "박쥐군주", "🌌")],
    note: "밤하늘을 닮은 박쥐. 날개 안에 별이 떠요",
  },
  {
    key: "toy", acts: ["play", "hug"], type: "노말",
    forms: [f("toy", 2, "헝겊이", "🧵"), f("toy", 3, "헝겊인형", "🎎"), f("toy", 4, "광대인형", "🤡")],
    note: "헝겊 조각이 인형이 되고 단추 눈 광대로 자라요",
  },
  {
    key: "beetle", acts: ["play", "feed"], type: "벌레",
    forms: [f("beetle", 2, "굼벵이", "🐛"), f("beetle", 3, "풍뎅이", "🐞"), f("beetle", 4, "장수풍뎅이", "🪲")],
    note: "굼벵이가 자라 뿔 달린 풍뎅이가 돼요",
  },
  {
    key: "volt", acts: ["play", "clean"], type: "전기",
    forms: [f("volt", 2, "찌릿이", "⚡"), f("volt", 3, "번개참새", "🕊️"), f("volt", 4, "천둥새", "🌩️")],
    note: "번개 볏을 단 새. 다 자라면 날개를 활짝 펴요",
  },
  {
    key: "moth", acts: ["play", "rest"], type: "에스퍼",
    forms: [f("moth", 2, "솜털누에", "🧶"), f("moth", 3, "달나방", "🌝"), f("moth", 4, "월광나방", "🌜")],
    note: "솜털 애벌레가 달빛을 먹고 큰 날개 나방이 돼요",
  },
  {
    key: "bee", acts: ["hug", "feed"], type: "벌레",
    forms: [f("bee", 2, "꿀방울", "🧡"), f("bee", 3, "꿀벌", "🐝"), f("bee", 4, "여왕벌", "👸")],
    note: "꿀 한 방울이 벌이 되고 왕관 쓴 여왕벌이 돼요",
  },
  {
    key: "puff", acts: ["hug", "clean"], type: "페어리",
    forms: [f("puff", 2, "몽실이", "☁️"), f("puff", 3, "구름양", "🐑"), f("puff", 4, "뭉게양", "🌈")],
    note: "구름 털을 두른 양. 털 끝에 무지개가 어려요",
  },
  {
    key: "ghost", acts: ["hug", "rest"], type: "고스트",
    forms: [f("ghost", 2, "이불이", "🛏️"), f("ghost", 3, "이불유령", "🌫️"), f("ghost", 4, "한밤유령", "🕯️")],
    note: "이불을 뒤집어쓴 유령. 한밤엔 촛불을 들어요",
  },
  {
    key: "swan", acts: ["feed", "clean"], type: "물",
    forms: [f("swan", 2, "연못이", "💦"), f("swan", 3, "꼬마오리", "🦆"), f("swan", 4, "백조공주", "🦢")],
    note: "솜털 오리가 자라 우아한 백조가 돼요",
  },
  {
    key: "mush", acts: ["feed", "rest"], type: "풀",
    forms: [f("mush", 2, "홀씨", "🟤"), f("mush", 3, "갓버섯", "🍄"), f("mush", 4, "송이대왕", "🏕️")],
    note: "작은 갓이 자라 포자 구름을 두른 큰 버섯이 돼요",
  },
  {
    key: "snow", acts: ["clean", "rest"], type: "얼음",
    forms: [f("snow", 2, "눈송이", "❄️"), f("snow", 3, "눈덩이", "⛄"), f("snow", 4, "눈사람왕", "🧊")],
    note: "눈 한 톨이 눈덩이가 되고 목도리 두른 눈사람이 돼요",
  },
  {
    key: "scare", acts: ["play", "hug", "feed"], type: "풀",
    forms: [f("scare", 2, "짚단이", "🌾"), f("scare", 3, "허수아비", "🎃"), f("scare", 4, "호박대왕", "🥧")],
    note: "짚단이 허수아비가 되고 호박 머리 대왕으로 자라요",
  },
  {
    key: "peng", acts: ["play", "hug", "clean"], type: "얼음",
    forms: [f("peng", 2, "아기펭귄", "🐧"), f("peng", 3, "미끄럼펭귄", "⛷️"), f("peng", 4, "황제펭귄", "🏔️")],
    note: "솜털 펭귄이 얼음 위를 지치다 의젓한 황제가 돼요",
  },
  {
    key: "sloth", acts: ["play", "hug", "rest"], type: "노말",
    forms: [f("sloth", 2, "느릿이", "🥱"), f("sloth", 3, "나무늘보", "🦥"), f("sloth", 4, "대왕늘보", "🌴")],
    note: "느릿느릿 나무에 매달려 한 해에 한 뼘씩 자라요",
  },
  {
    key: "rac", acts: ["play", "feed", "clean"], type: "악",
    forms: [f("rac", 2, "라쿤이", "🧼"), f("rac", 3, "라쿤", "🦝"), f("rac", 4, "라쿤대장", "🎭")],
    note: "먹이를 꼭 씻어 먹는 장난꾸러기. 다 크면 복면 대장이 돼요",
  },
  {
    key: "mole", acts: ["play", "feed", "rest"], type: "땅",
    forms: [f("mole", 2, "꼬물이", "🕳️"), f("mole", 3, "두더지", "⛏️"), f("mole", 4, "굴착두더지", "🚧")],
    note: "땅속을 파고 놀다 단단한 삽발 두더지가 돼요",
  },
  {
    key: "octo", acts: ["play", "clean", "rest"], type: "물",
    forms: [f("octo", 2, "먹물이", "🦑"), f("octo", 3, "꼬마문어", "🐙"), f("octo", 4, "대왕문어", "🔱")],
    note: "먹물을 뿜던 꼬마가 여덟 다리 대왕이 돼요",
  },
  {
    key: "capy", acts: ["hug", "feed", "clean"], type: "물",
    forms: [f("capy", 2, "카피꼬마", "🍊"), f("capy", 3, "카피바라", "🛁"), f("capy", 4, "온천카피", "♨️")],
    note: "느긋한 카피바라. 머리 위 귤이 커져 온천을 차려요",
  },
  {
    key: "koala", acts: ["hug", "feed", "rest"], type: "노말",
    forms: [f("koala", 2, "꼬마코알라", "🌳"), f("koala", 3, "코알라", "🐨"), f("koala", 4, "유칼립투스왕", "🌿")],
    note: "나뭇가지에 안겨 먹고 자며 큰 코알라가 돼요",
  },
  {
    key: "snail", acts: ["hug", "clean", "rest"], type: "벌레",
    forms: [f("snail", 2, "민달이", "🍥"), f("snail", 3, "달팽이", "🐌"), f("snail", 4, "수정달팽이", "💠")],
    note: "민달팽이가 껍데기를 얻고 수정 껍데기로 반짝여요",
  },
  {
    key: "croc", acts: ["feed", "clean", "rest"], type: "악",
    forms: [f("croc", 2, "악어알이", "🥔"), f("croc", 3, "아기악어", "🐊"), f("croc", 4, "늪지악어", "🪵")],
    note: "늪에서 먹고 씻고 자며 듬직한 악어가 돼요",
  },
  {
    key: "unicorn", acts: ["play", "hug", "feed", "clean"], type: "페어리",
    forms: [f("unicorn", 2, "망아지", "🐴"), f("unicorn", 3, "은갈기말", "🐎"), f("unicorn", 4, "유니콘", "🦄")],
    note: "잠만 빼고 다 해 준 말. 이마에 무지갯빛 뿔이 돋아요",
  },
  {
    key: "boar", acts: ["play", "hug", "feed", "rest"], type: "땅",
    forms: [f("boar", 2, "멧새끼", "🐗"), f("boar", 3, "진흙멧돼지", "🐖"), f("boar", 4, "산신멧돼지", "⛰️")],
    note: "씻기만 빼고 다 해 준 멧돼지. 진흙투성이가 자랑이에요",
  },
  {
    key: "seal", acts: ["play", "hug", "clean", "rest"], type: "물",
    forms: [f("seal", 2, "물범새끼", "🌀"), f("seal", 3, "물범", "🦭"), f("seal", 4, "바다물범왕", "🌐")],
    note: "밥만 뺀 소식가 물범. 공을 굴리며 물 위에서 자요",
  },
  {
    key: "peaco", acts: ["play", "feed", "clean", "rest"], type: "노말",
    forms: [f("peaco", 2, "깃털이", "🪶"), f("peaco", 3, "꼬마공작", "🦜"), f("peaco", 4, "공작", "🌺")],
    note: "안기만 빼고 다 해 준 도도한 새. 꼬리 부채가 활짝 펴져요",
  },
  {
    key: "ele", acts: ["hug", "feed", "clean", "rest"], type: "땅",
    forms: [f("ele", 2, "아기코끼리", "🐘"), f("ele", 3, "코끼리", "🦣"), f("ele", 4, "현자코끼리", "🧘")],
    note: "놀기만 뺀 점잖은 거인. 코로 물을 뿜어 씻고 푹 자요",
  },
];

export const FAMILY_NAME: Record<CareAct, string> = {
  play: "볕", hug: "포근", feed: "숲", clean: "물", rest: "그늘",
};

export const CARE_NAME: Record<CareAct, string> = {
  play: "놀기", hug: "안기", feed: "밥", clean: "씻기", rest: "재우기",
};

export const LINEAGE_CLASS: Record<1 | 2 | 3 | 4, { name: string; blurb: string }> = {
  1: { name: "한 우물", blurb: "한 가지 돌봄을 두드러지게 해 줬을 때" },
  2: { name: "투톱", blurb: "두 가지 돌봄을 즐겨 해 줬을 때" },
  3: { name: "삼총사", blurb: "세 가지 돌봄을 즐겨 해 줬을 때" },
  4: { name: "만능", blurb: "한 가지만 빼고 두루 해 줬을 때" },
};

export function lineageLabel(l: Lineage): string {
  if (l.acts.length === 4) {
    const missing = CARE_ORDER.find((a) => !l.acts.includes(a));
    return missing ? `${FAMILY_NAME[missing]} 뺀 만능` : "만능";
  }
  return l.acts.map((a) => FAMILY_NAME[a]).join("·");
}

export const LINEAGE_OF_FORM: Readonly<Record<string, { lineage: Lineage; stage: 2 | 3 | 4 }>> = Object.fromEntries(
  LINEAGES.flatMap((l) => l.forms.map((fm, i) => [fm.key, { lineage: l, stage: (2 + i) as 2 | 3 | 4 }])),
);

export const LINEAGE_FORM_KEYS: readonly string[] = LINEAGES.flatMap((l) => l.forms.map((fm) => fm.key));

export const isPixelOnlyForm = (form: string): boolean => form in LINEAGE_OF_FORM || UPPER_KEYS.has(form);

const sameActs = (a: readonly CareAct[], b: readonly CareAct[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

export function lineagePool(
  near: readonly CareAct[],
  live?: ReadonlySet<string>,
  table: readonly Lineage[] = LINEAGES,
): Lineage[] {
  return table.filter((l) => (!live || live.has(l.key)) && l.acts.every((a) => near.includes(a)));
}

export type LineageWhy = "exact" | "fresh" | "again";
export type LineagePick = {
  lineage: Lineage;
  why: LineageWhy;

  pool: number;
  fresh: number;
};

export function pickLineage(
  near: readonly CareAct[],
  rot: number,
  seen: (key: string) => boolean,
  live?: ReadonlySet<string>,
  table: readonly Lineage[] = LINEAGES,
): LineagePick | null {
  const pool = lineagePool(near, live, table);
  if (pool.length === 0) return null;
  const fresh = pool.filter((l) => !seen(l.key));
  const exact = pool.find((l) => sameActs(l.acts, near));
  const mod = (n: number, m: number) => ((Math.floor(n) % m) + m) % m;
  if (exact && fresh.includes(exact)) return { lineage: exact, why: "exact", pool: pool.length, fresh: fresh.length };
  if (fresh.length > 0) return { lineage: fresh[mod(rot, fresh.length)], why: "fresh", pool: pool.length, fresh: fresh.length };
  return { lineage: exact ?? pool[mod(rot, pool.length)], why: "again", pool: pool.length, fresh: 0 };
}
