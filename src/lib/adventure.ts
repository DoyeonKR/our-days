/* 모험 — 지역을 돌며 우리 펫(계보 생물)을 잡고 키워 턴제로 싸우는 게임의 순수 엔진. [사용자 2026-11-07]
 *
 * ⚠ 원작 게임의 자료(그림 · 이름 · 기술 이름 · 수치표 · 코드)는 쓰지 않는다. 생물은 이 앱의 계보 펫(lib/lineages)이고,
 *   기술 이름 · 상성표 · 능력치 · 피해 공식 · 잡기 확률은 전부 여기서 새로 정했다. 장르의 구조(턴제 · 속성 · 공 던지기)만 같다.
 *   상성표는 일부러 원작과 다르게 짰다(무효 없음 · 고스트/악/페어리 고리 등) — 원작 표를 옮겨 오지 않는다.
 * ⚠ 같은 입력 = 같은 결과(난수는 battle.seed 하나) — 2단계 온라인 대전에서 서버가 같은 엔진으로 판정한다.
 * ⚠ 이 파일은 값으로 lineages.ts 만 읽는다(테스트가 node 로 돌린다 — 상대 경로 .ts).
 */
import { LINEAGES } from "./lineages.ts";
import { josa } from "./josa.ts";

/* ───────── 속성 ───────── */

export const TYPES = ["노말", "불꽃", "물", "풀", "전기", "얼음", "벌레", "악", "고스트", "페어리", "땅", "에스퍼"] as const;
export type MonType = (typeof TYPES)[number];

/** 공격 속성 → [잘 듣는 상대, 덜 듣는 상대]. 무효는 없다(누구나 누구에게든 조금은 들어간다). */
const CHART: Record<MonType, [MonType[], MonType[]]> = {
  노말: [[], ["고스트"]],
  불꽃: [["풀", "벌레", "얼음"], ["물", "불꽃"]],
  물: [["불꽃", "땅"], ["물", "풀", "얼음"]],
  풀: [["물", "땅"], ["불꽃", "벌레", "풀"]],
  전기: [["물"], ["풀", "전기"]],
  얼음: [["풀", "벌레"], ["불꽃", "물", "얼음"]],
  벌레: [["풀", "악"], ["불꽃", "페어리"]],
  악: [["고스트"], ["페어리", "악"]],
  고스트: [["페어리", "노말", "에스퍼"], ["악"]],
  페어리: [["악", "벌레"], ["불꽃", "고스트"]],
  땅: [["불꽃", "전기"], ["풀", "벌레"]],
  에스퍼: [["벌레", "땅"], ["악", "에스퍼"]],
};

export function effectiveness(atk: MonType, def: MonType): number {
  const [good, bad] = CHART[atk];
  if (good.includes(def)) return 2;
  if (bad.includes(def)) return 0.5;
  return 1;
}

export const TYPE_COLOR: Record<MonType, string> = {
  노말: "#9a958a", 불꽃: "#e8623a", 물: "#3d8be0", 풀: "#4fae4f", 전기: "#e3b51c",
  얼음: "#5cc6d6", 벌레: "#93a827", 악: "#5b4a63", 고스트: "#7a63c4", 페어리: "#e27fb3", 땅: "#b58a4c", 에스퍼: "#d45c93",
};

/* ───────── 기술 ───────── */

export type Status = "burn" | "poison" | "para" | "sleep";
export type StatKey = "atk" | "def" | "spd";

export type Move = {
  id: string;
  name: string;
  type: MonType;
  /** 0 = 변화 기술 */
  power: number;
  acc: number;
  pp: number;
  /** 맞은 상대에게 거는 상태이상(확률) */
  inflict?: { status: Status; chance: number };
  /** 능력 변화 — self 면 나, 아니면 상대 */
  boost?: { stat: StatKey; by: number; self: boolean };
  /** 최대 체력 대비 회복 */
  heal?: number;
  priority?: number;
  /** 연속 공격 — 최소 · 최대 횟수 */
  hits?: [number, number];
  /** 준 피해의 몇 배를 되찾는다 */
  drain?: number;
  /** 준 피해의 몇 배를 되받는다 */
  recoil?: number;
  /** 급소 확률(기본 1/16) */
  crit?: number;
  /** 상대가 아직 안 움직였으면 이 확률로 움찔(그 턴 못 움직임) */
  flinch?: number;
  /** 연출 방식 — 화면(lib/battlefx)이 고른다 */
  fx: FxStyle;
  note: string;
};

/** contact 몸으로 부딪기 · shot 쏘기 · beam 광선 · rain 위에서 쏟아짐 · burst 상대 자리에서 터짐 ·
 *  wave 물결처럼 밀려감 · slash 베기 · spiral 소용돌이 · self 나에게 · debuff 상대에게 거는 변화 */
export type FxStyle = "contact" | "shot" | "beam" | "rain" | "burst" | "wave" | "slash" | "spiral" | "self" | "debuff";

const M = (m: Move) => m;
export const MOVES: Record<string, Move> = Object.fromEntries(
  [
    M({ id: "bump", name: "콩 부딪기", type: "노말", power: 40, acc: 100, pp: 30, fx: "contact", note: "가볍게 몸을 부딪쳐요" }),
    M({ id: "flurry", name: "콩콩 연타", type: "노말", power: 18, acc: 95, pp: 20, hits: [2, 5], fx: "contact", note: "2~5번 연달아 때려요" }),
    M({ id: "roll", name: "데굴구르기", type: "노말", power: 65, acc: 95, pp: 20, fx: "contact", note: "굴러가 들이받아요" }),
    M({ id: "slam", name: "온몸 던지기", type: "노말", power: 100, acc: 90, pp: 10, recoil: 0.25, fx: "contact", note: "아주 세지만 나도 조금 아파요" }),
    M({ id: "dash", name: "번쩍 달려들기", type: "노말", power: 40, acc: 100, pp: 20, priority: 1, fx: "contact", note: "먼저 움직여요" }),
    M({ id: "stretch", name: "기지개", type: "노말", power: 0, acc: 100, pp: 20, boost: { stat: "atk", by: 2, self: true }, fx: "self", note: "내 공격이 크게 올라가요" }),
    M({ id: "growl", name: "으르렁", type: "노말", power: 0, acc: 100, pp: 25, boost: { stat: "atk", by: -1, self: false }, fx: "debuff", note: "상대 공격이 내려가요" }),
    M({ id: "rest", name: "쉬어 가기", type: "노말", power: 0, acc: 100, pp: 5, heal: 0.5, fx: "self", note: "체력을 절반 되찾아요" }),
    M({ id: "shell", name: "껍질 다지기", type: "노말", power: 0, acc: 100, pp: 20, boost: { stat: "def", by: 2, self: true }, fx: "self", note: "둘레에 방어막을 쳐요 · 안에선 피해가 절반" }),
    M({ id: "breeze", name: "바람 타기", type: "노말", power: 0, acc: 100, pp: 15, boost: { stat: "spd", by: 2, self: true }, fx: "self", note: "내 스피드가 크게 올라가요" }),

    M({ id: "spark", name: "불티 튀기기", type: "불꽃", power: 40, acc: 100, pp: 25, inflict: { status: "burn", chance: 0.1 }, fx: "shot", note: "불티를 쏴요 · 가끔 화상" }),
    M({ id: "emberrain", name: "불씨 소나기", type: "불꽃", power: 22, acc: 95, pp: 15, hits: [2, 4], inflict: { status: "burn", chance: 0.1 }, fx: "rain", note: "불씨가 2~4번 쏟아져요" }),
    M({ id: "flametail", name: "불꽃 꼬리", type: "불꽃", power: 70, acc: 95, pp: 15, inflict: { status: "burn", chance: 0.2 }, fx: "contact", note: "불붙은 꼬리로 후려쳐요" }),
    M({ id: "lava", name: "용암 분출", type: "불꽃", power: 100, acc: 85, pp: 5, inflict: { status: "burn", chance: 0.3 }, fx: "burst", note: "땅에서 용암이 솟아요" }),

    M({ id: "drop", name: "물방울 톡", type: "물", power: 40, acc: 100, pp: 25, fx: "shot", note: "물방울을 쏘아요" }),
    M({ id: "bubbles", name: "거품 세례", type: "물", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "거품이 2~5번 터져요" }),
    M({ id: "wave", name: "물결 밀기", type: "물", power: 70, acc: 95, pp: 15, fx: "wave", note: "물결로 밀어내요" }),
    M({ id: "whirl", name: "소용돌이 파도", type: "물", power: 100, acc: 85, pp: 5, fx: "spiral", note: "거센 소용돌이" }),

    M({ id: "leafy", name: "잎사귀 휙", type: "풀", power: 40, acc: 100, pp: 25, fx: "shot", note: "잎을 날려요" }),
    M({ id: "sap", name: "수액 빨기", type: "풀", power: 55, acc: 100, pp: 15, drain: 0.5, fx: "burst", note: "준 피해의 절반을 되찾아요" }),
    M({ id: "thorn", name: "가시덩굴", type: "풀", power: 70, acc: 95, pp: 15, crit: 0.2, fx: "slash", note: "덩굴로 휘감아요 · 급소에 잘 맞아요" }),
    M({ id: "grove", name: "숲의 울림", type: "풀", power: 100, acc: 85, pp: 5, fx: "rain", note: "숲 전체가 울려요" }),
    M({ id: "lullaby", name: "꽃가루 자장가", type: "풀", power: 0, acc: 75, pp: 10, inflict: { status: "sleep", chance: 1 }, fx: "debuff", note: "상대를 재워요" }),

    M({ id: "zap", name: "찌릿 손뼉", type: "전기", power: 40, acc: 100, pp: 25, inflict: { status: "para", chance: 0.1 }, fx: "contact", note: "가끔 마비" }),
    M({ id: "jolt", name: "번개 꼬리", type: "전기", power: 60, acc: 100, pp: 15, crit: 0.25, fx: "slash", note: "급소에 잘 맞아요" }),
    M({ id: "bolt", name: "번개 줄기", type: "전기", power: 70, acc: 95, pp: 15, inflict: { status: "para", chance: 0.2 }, fx: "beam", note: "가끔 마비" }),
    M({ id: "thunder", name: "천둥 낙하", type: "전기", power: 100, acc: 85, pp: 5, inflict: { status: "para", chance: 0.3 }, fx: "rain", note: "하늘에서 내리꽂혀요" }),

    M({ id: "frost", name: "서리 입김", type: "얼음", power: 40, acc: 100, pp: 25, fx: "beam", note: "차가운 입김" }),
    M({ id: "icicle", name: "고드름 연발", type: "얼음", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "고드름을 2~5번 쏴요" }),
    M({ id: "shard", name: "얼음 조각", type: "얼음", power: 70, acc: 95, pp: 15, flinch: 0.2, fx: "shot", note: "가끔 상대가 움찔해요" }),
    M({ id: "glacier", name: "빙하 낙하", type: "얼음", power: 100, acc: 85, pp: 5, fx: "rain", note: "얼음 덩어리가 떨어져요" }),

    M({ id: "antenna", name: "더듬이 찌르기", type: "벌레", power: 40, acc: 100, pp: 25, fx: "contact", note: "더듬이로 콕" }),
    M({ id: "buzz", name: "날갯짓 연타", type: "벌레", power: 18, acc: 95, pp: 20, hits: [2, 5], fx: "contact", note: "2~5번 연달아 쳐요" }),
    M({ id: "sting", name: "따끔 침", type: "벌레", power: 60, acc: 100, pp: 20, inflict: { status: "poison", chance: 0.3 }, fx: "shot", note: "가끔 독" }),
    M({ id: "horn", name: "뿔 들이받기", type: "벌레", power: 95, acc: 90, pp: 10, fx: "contact", note: "뿔로 힘껏" }),

    M({ id: "pinch", name: "몰래 꼬집기", type: "악", power: 40, acc: 100, pp: 25, priority: 1, fx: "contact", note: "먼저 움직여요" }),
    M({ id: "siphon", name: "그림자 빨기", type: "악", power: 55, acc: 100, pp: 15, drain: 0.5, fx: "burst", note: "준 피해의 절반을 되찾아요" }),
    M({ id: "nightfall", name: "밤그늘 베기", type: "악", power: 70, acc: 95, pp: 15, crit: 0.25, fx: "slash", note: "급소에 잘 맞아요" }),
    M({ id: "moonless", name: "달 없는 밤", type: "악", power: 95, acc: 90, pp: 10, flinch: 0.2, fx: "burst", note: "깜깜한 밤의 일격" }),

    M({ id: "beckon", name: "으스스 손짓", type: "고스트", power: 40, acc: 100, pp: 25, fx: "shot", note: "오싹해요" }),
    M({ id: "spook", name: "깜짝 놀래기", type: "고스트", power: 40, acc: 100, pp: 10, priority: 1, flinch: 0.3, fx: "burst", note: "먼저 움직여요 · 상대가 움찔해요" }),
    M({ id: "blanket", name: "이불 덮치기", type: "고스트", power: 70, acc: 95, pp: 15, fx: "contact", note: "이불로 푹" }),
    M({ id: "haunt", name: "혼령 폭풍", type: "고스트", power: 95, acc: 90, pp: 10, fx: "spiral", note: "혼령이 몰아쳐요" }),

    M({ id: "glitter", name: "반짝 가루", type: "페어리", power: 40, acc: 100, pp: 25, fx: "shot", note: "반짝반짝" }),
    M({ id: "candy", name: "별사탕 톡톡", type: "페어리", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "별사탕이 2~5번 터져요" }),
    M({ id: "dreamy", name: "꿈결 별빛", type: "페어리", power: 65, acc: 95, pp: 15, drain: 0.3, fx: "beam", note: "준 피해의 일부를 되찾아요" }),
    M({ id: "rainbow", name: "무지개 빛살", type: "페어리", power: 95, acc: 90, pp: 10, fx: "beam", note: "일곱 빛깔 광선" }),
    M({ id: "scent", name: "포근한 향", type: "페어리", power: 0, acc: 100, pp: 20, boost: { stat: "atk", by: -2, self: false }, fx: "debuff", note: "상대 공격이 크게 내려가요" }),
    // 속성마다 둘씩 더(2026-11-08) · 땅 · 에스퍼 — 이름과 수치는 이 게임 것이다
    M({ id: "stomp", name: "꾹꾹 내려밟기", type: "노말", power: 55, acc: 100, pp: 20, flinch: 0.2, fx: "contact", note: "뛰어올라 내려밟아요" }),
    M({ id: "shout", name: "우렁찬 외침", type: "노말", power: 75, acc: 95, pp: 15, fx: "burst", note: "둘레를 쩌렁쩌렁 울려요" }),
    M({ id: "cinder", name: "잉걸불 폭탄", type: "불꽃", power: 60, acc: 100, pp: 15, inflict: { status: "burn", chance: 0.15 }, fx: "shot", note: "닿으면 터져요" }),
    M({ id: "firefan", name: "부채 불길", type: "불꽃", power: 85, acc: 90, pp: 10, inflict: { status: "burn", chance: 0.2 }, fx: "wave", note: "앞을 넓게 태워요" }),
    M({ id: "spout", name: "물기둥", type: "물", power: 65, acc: 95, pp: 15, fx: "burst", note: "상대를 쫓아 두 번 솟아요" }),
    M({ id: "tide", name: "밀물", type: "물", power: 90, acc: 90, pp: 10, fx: "wave", note: "넓은 물결이 뚫고 지나가요" }),
    M({ id: "seedgun", name: "씨앗 연사", type: "풀", power: 15, acc: 95, pp: 20, hits: [3, 5], fx: "shot", note: "씨앗을 3~5번 쏴요" }),
    M({ id: "vinepull", name: "덩굴 끌기", type: "풀", power: 80, acc: 90, pp: 10, fx: "spiral", note: "덩굴이 끌어당겨 조여요" }),
    M({ id: "arc", name: "튀는 전류", type: "전기", power: 55, acc: 100, pp: 20, inflict: { status: "para", chance: 0.2 }, fx: "shot", note: "상대를 따라가요 · 가끔 마비" }),
    M({ id: "cage", name: "번개 우리", type: "전기", power: 90, acc: 85, pp: 10, inflict: { status: "para", chance: 0.2 }, fx: "rain", note: "번개가 둘레에 흩어져 떨어져요" }),
    M({ id: "snowball", name: "눈덩이 던지기", type: "얼음", power: 55, acc: 100, pp: 20, fx: "shot", note: "닿으면 부서져요" }),
    M({ id: "veil", name: "하얀 장막", type: "얼음", power: 85, acc: 90, pp: 10, flinch: 0.15, fx: "burst", note: "둘레를 하얗게 얼려요" }),
    M({ id: "swarm", name: "벌떼 몰이", type: "벌레", power: 18, acc: 95, pp: 15, hits: [3, 5], fx: "spiral", note: "벌떼가 쫓아가요" }),
    M({ id: "webnet", name: "거미줄 그물", type: "벌레", power: 70, acc: 95, pp: 15, inflict: { status: "para", chance: 0.3 }, fx: "wave", note: "앞으로 그물을 던져요 · 가끔 마비" }),
    M({ id: "ambush", name: "그림자 습격", type: "악", power: 60, acc: 100, pp: 15, crit: 0.25, fx: "contact", note: "순식간에 덮쳐요 · 급소에 잘 맞아요" }),
    M({ id: "nightrain", name: "검은 밤비", type: "악", power: 90, acc: 90, pp: 10, fx: "rain", note: "나에게서 상대 쪽으로 줄지어 떨어져요" }),
    M({ id: "wail", name: "번지는 울음", type: "고스트", power: 60, acc: 100, pp: 15, flinch: 0.2, fx: "wave", note: "울음이 뚫고 지나가요" }),
    M({ id: "gravecall", name: "무덤의 손길", type: "고스트", power: 90, acc: 90, pp: 10, fx: "spiral", note: "끌어당기며 여러 번 터져요" }),
    M({ id: "ribbon", name: "리본 휘감기", type: "페어리", power: 55, acc: 100, pp: 20, fx: "wave", note: "앞으로 리본을 휘둘러요" }),
    M({ id: "shooting", name: "별똥 소나기", type: "페어리", power: 90, acc: 85, pp: 10, fx: "rain", note: "별똥이 둘레에 흩어져 떨어져요" }),

    M({ id: "mudball", name: "진흙 경단", type: "땅", power: 40, acc: 100, pp: 25, fx: "shot", note: "진흙을 뭉쳐 던져요" }),
    M({ id: "gravel", name: "자갈 연타", type: "땅", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "shot", note: "자갈을 2~5번 튕겨요" }),
    M({ id: "burrow", name: "땅굴 돌진", type: "땅", power: 70, acc: 95, pp: 15, fx: "contact", note: "땅을 파며 뚫고 지나가요" }),
    M({ id: "tremor", name: "땅 울림", type: "땅", power: 100, acc: 85, pp: 5, fx: "burst", note: "둘레의 땅이 크게 흔들려요" }),
    M({ id: "pillar", name: "돌기둥 솟기", type: "땅", power: 60, acc: 95, pp: 15, fx: "burst", note: "상대 쪽으로 돌기둥이 솟아요" }),
    M({ id: "slide", name: "산비탈 무너짐", type: "땅", power: 90, acc: 90, pp: 10, fx: "rain", note: "상대를 쫓아 차례로 떨어져요" }),

    M({ id: "thought", name: "생각 콕", type: "에스퍼", power: 40, acc: 100, pp: 25, fx: "spiral", note: "생각이 상대를 따라가요" }),
    M({ id: "echo", name: "되울리는 생각", type: "에스퍼", power: 20, acc: 95, pp: 20, hits: [2, 5], fx: "spiral", note: "2~5번 되울려요" }),
    M({ id: "mindray", name: "마음 빛살", type: "에스퍼", power: 70, acc: 95, pp: 15, flinch: 0.15, fx: "beam", note: "곧게 뻗는 빛" }),
    M({ id: "headstorm", name: "머릿속 폭풍", type: "에스퍼", power: 100, acc: 85, pp: 5, fx: "burst", note: "넓은 자리가 뒤늦게 터져요" }),
    M({ id: "foresee", name: "미리 보기", type: "에스퍼", power: 60, acc: 100, pp: 15, priority: 1, fx: "shot", note: "먼저 움직여요" }),
    M({ id: "rift", name: "꿈의 균열", type: "에스퍼", power: 90, acc: 90, pp: 10, fx: "burst", note: "상대 쪽으로 줄지어 갈라져요" }),
  ].map((m) => [m.id, m]),
);

/** 속성마다 넷 — 약 · 특수(연속 · 흡수 · 급소) · 중 · 강 */
const TYPE_MOVES: Record<MonType, [string, string, string, string, string, string]> = {
  노말: ["bump", "flurry", "roll", "slam", "stomp", "shout"],
  불꽃: ["spark", "emberrain", "flametail", "lava", "cinder", "firefan"],
  물: ["drop", "bubbles", "wave", "whirl", "spout", "tide"],
  풀: ["leafy", "sap", "thorn", "grove", "seedgun", "vinepull"],
  전기: ["zap", "jolt", "bolt", "thunder", "arc", "cage"],
  얼음: ["frost", "icicle", "shard", "glacier", "snowball", "veil"],
  벌레: ["antenna", "buzz", "sting", "horn", "swarm", "webnet"],
  악: ["pinch", "siphon", "nightfall", "moonless", "ambush", "nightrain"],
  고스트: ["beckon", "spook", "blanket", "haunt", "wail", "gravecall"],
  페어리: ["glitter", "candy", "dreamy", "rainbow", "ribbon", "shooting"],
  땅: ["mudball", "gravel", "burrow", "tremor", "pillar", "slide"],
  에스퍼: ["thought", "echo", "mindray", "headstorm", "foresee", "rift"],
};

/* ───────── 생물 ───────── */

type Profile = { hp: number; atk: number; def: number; spd: number; type: MonType; extra: string };
/** 1단계에 쓰는 10계보 — 속성은 계보 표의 속성과 같다(도감과 맞게). extra = 계보마다 다른 변화 기술 */
const ROSTER: Record<string, Profile> = {
  leaf: { hp: 1.0, atk: 0.9, def: 1.1, spd: 0.9, type: "풀", extra: "lullaby" },
  beetle: { hp: 0.95, atk: 1.2, def: 1.1, spd: 0.8, type: "벌레", extra: "stretch" },
  burr: { hp: 1.2, atk: 0.95, def: 1.1, spd: 0.75, type: "노말", extra: "shell" },
  puff: { hp: 1.15, atk: 0.9, def: 0.95, spd: 1.0, type: "페어리", extra: "scent" },
  conch: { hp: 1.0, atk: 0.9, def: 1.3, spd: 0.75, type: "물", extra: "shell" },
  volt: { hp: 0.85, atk: 1.1, def: 0.8, spd: 1.3, type: "전기", extra: "breeze" },
  snow: { hp: 1.1, atk: 1.0, def: 1.0, spd: 0.9, type: "얼음", extra: "rest" },
  bat: { hp: 0.9, atk: 1.1, def: 0.85, spd: 1.2, type: "악", extra: "dash" },
  ghost: { hp: 0.95, atk: 1.1, def: 0.9, spd: 1.1, type: "고스트", extra: "growl" },
  ember: { hp: 0.9, atk: 1.2, def: 0.85, spd: 1.1, type: "불꽃", extra: "stretch" },
  toy: { hp: 1.05, atk: 0.95, def: 1.0, spd: 1.0, type: "노말", extra: "growl" },
  moth: { hp: 0.9, atk: 1.15, def: 0.85, spd: 1.1, type: "에스퍼", extra: "breeze" },
  bee: { hp: 0.85, atk: 1.15, def: 0.85, spd: 1.25, type: "벌레", extra: "breeze" },
  swan: { hp: 1.05, atk: 0.95, def: 1.0, spd: 1.05, type: "물", extra: "scent" },
  mush: { hp: 1.2, atk: 0.9, def: 1.05, spd: 0.75, type: "풀", extra: "lullaby" },
  scare: { hp: 1.0, atk: 1.1, def: 1.0, spd: 0.85, type: "풀", extra: "growl" },
  peng: { hp: 1.05, atk: 1.0, def: 1.0, spd: 1.0, type: "얼음", extra: "breeze" },
  sloth: { hp: 1.35, atk: 0.95, def: 1.0, spd: 0.6, type: "노말", extra: "rest" },
  rac: { hp: 0.95, atk: 1.1, def: 0.9, spd: 1.15, type: "악", extra: "growl" },
  mole: { hp: 0.95, atk: 1.2, def: 1.0, spd: 0.9, type: "땅", extra: "stretch" },
  octo: { hp: 1.05, atk: 1.1, def: 0.95, spd: 0.95, type: "물", extra: "growl" },
  capy: { hp: 1.3, atk: 0.85, def: 1.15, spd: 0.7, type: "물", extra: "rest" },
  koala: { hp: 1.2, atk: 0.9, def: 1.05, spd: 0.8, type: "노말", extra: "rest" },
  snail: { hp: 1.05, atk: 0.85, def: 1.4, spd: 0.65, type: "벌레", extra: "shell" },
  croc: { hp: 1.1, atk: 1.2, def: 1.1, spd: 0.7, type: "악", extra: "stretch" },
  unicorn: { hp: 1.05, atk: 1.05, def: 0.95, spd: 1.15, type: "페어리", extra: "breeze" },
  boar: { hp: 1.15, atk: 1.2, def: 1.0, spd: 0.8, type: "땅", extra: "stretch" },
  seal: { hp: 1.2, atk: 0.95, def: 1.05, spd: 0.85, type: "물", extra: "rest" },
  peaco: { hp: 0.95, atk: 1.05, def: 0.95, spd: 1.2, type: "노말", extra: "scent" },
  ele: { hp: 1.35, atk: 1.1, def: 1.1, spd: 0.6, type: "땅", extra: "shell" },
};

export type Species = {
  key: string;
  name: string;
  lineage: string;
  stage: 2 | 3 | 4;
  type: MonType;
  base: { hp: number; atk: number; def: number; spd: number };
  /** 다음 모습과 그 레벨 */
  evolves?: { to: string; at: number };
  /** [배우는 레벨, 기술 id] */
  learn: [number, string][];
  catchRate: number;
  xp: number;
  note: string;
  /** 전설 영물 — 진화하지 않고 별빛 신전에서만 드물게 만난다 · 연습 상대는 안 쓴다 */
  legend?: boolean;
};

const STAGE_BASE = { 2: 55, 3: 75, 4: 98 } as const;
export const EVOLVE_AT = { 2: 16, 3: 32 } as const;

function learnFor(type: MonType, extra: string): [number, string][] {
  const [weak, second, mid, strong, tech, burst] = TYPE_MOVES[type];
  const normal = type === "노말" ? ["dash", "growl"] : ["bump", "flurry"];
  return [[1, normal[0]], [1, weak], [5, extra], [8, second], [13, mid], [16, tech], [19, normal[1]], [25, strong], [30, burst], [33, "slam"], [40, "rest"]];
}

export const SPECIES: Record<string, Species> = {};
for (const l of LINEAGES) {
  const p = ROSTER[l.key];
  if (!p) continue;
  l.forms.forEach((form, i) => {
    const stage = (i + 2) as 2 | 3 | 4;
    const b = STAGE_BASE[stage];
    const next = l.forms[i + 1];
    SPECIES[form.key] = {
      key: form.key,
      name: form.name,
      lineage: l.key,
      stage,
      type: p.type,
      base: { hp: Math.round(b * p.hp), atk: Math.round(b * p.atk), def: Math.round(b * p.def), spd: Math.round(b * p.spd) },
      evolves: next && stage < 4 ? { to: next.key, at: EVOLVE_AT[stage as 2 | 3] } : undefined,
      learn: learnFor(p.type, p.extra),
      catchRate: stage === 2 ? 0.6 : stage === 3 ? 0.34 : 0.14,
      xp: stage === 2 ? 40 : stage === 3 ? 70 : 110,
      note: l.note,
    };
  });
}
/* 전설 영물 — 섬의 상위 펫 그림 그대로. 표에 더하면 도감 · 신전에 함께 올라온다 */
const LEGENDS: [string, string, MonType, string][] = [
  ["tiger", "호랑이", "노말", "stretch"],
  ["bengal_tiger", "뱅갈호랑이", "악", "stretch"],
  ["lion", "사자", "불꽃", "growl"],
  ["giraffe", "기린", "풀", "breeze"],
  ["mudeung_tiger", "무등산호랑이", "땅", "stretch"],
  ["cheonma", "천마", "페어리", "breeze"],
  ["baengnok", "백록", "얼음", "rest"],
  ["bulgasari", "불가사리", "땅", "shell"],
  ["imugi", "이무기", "물", "stretch"],
  ["maek", "몽맥", "에스퍼", "lullaby"],
  ["azure_dragon", "청룡", "풀", "stretch"],
  ["vermilion_bird", "주작", "불꽃", "breeze"],
  ["white_tiger", "백호", "얼음", "stretch"],
  ["black_tortoise", "현무", "물", "shell"],
  ["bii_jo", "비익조", "페어리", "breeze"],
  ["eungryong", "응룡", "전기", "breeze"],
  ["baektaek", "백택", "에스퍼", "scent"],
  ["geumseom", "금두꺼비", "땅", "rest"],
  ["phoenix", "봉황", "불꽃", "rest"],
  ["haetae", "해태", "에스퍼", "shell"],
  ["samjoko", "삼족오", "고스트", "breeze"],
  ["cheonrok", "천록", "페어리", "rest"],
  ["yellow_dragon", "황룡", "땅", "stretch"],
  ["hong_dragon", "홍룡", "불꽃", "stretch"],
];
for (const [key, name, type, extra] of LEGENDS) {
  SPECIES[key] = {
    key, name, lineage: key, stage: 4, type,
    base: { hp: 118, atk: 112, def: 106, spd: 106 },
    learn: learnFor(type, extra),
    catchRate: 0.06, xp: 180, note: "전설 영물 — 별빛 신전에서만 드물게 만나요", legend: true,
  };
}
export const LEGEND_KEYS = LEGENDS.map(([k]) => k);
export const SPECIES_KEYS = Object.keys(SPECIES);

/** 레벨에 맞는 기술 넷 — 배운 순서의 마지막 넷(위력 0 기술이 둘 넘으면 약한 공격을 대신 남긴다). */
/** 레벨에 맞는 기술 넷 — 자기 속성 공격 최근 둘(노말 속성은 셋) + 다른 공격 하나 + 변화 기술 하나.
 *  넷이 안 차면 배운 다른 공격으로 채운다. 순서: 자기 속성 → 다른 공격 → 변화. */
export function movesAt(species: string, level: number): string[] {
  const sp = SPECIES[species];
  const learned = [...new Set(sp.learn.filter(([lv]) => lv <= level).map(([, id]) => id))];
  const own = learned.filter((id) => MOVES[id].power > 0 && MOVES[id].type === sp.type);
  const other = learned.filter((id) => MOVES[id].power > 0 && MOVES[id].type !== sp.type);
  const status = learned.filter((id) => MOVES[id].power === 0);
  const pick = [...own.slice(sp.type === "노말" ? -3 : -2), ...other.slice(-1), ...status.slice(-1)];
  for (const id of [...learned].reverse()) {
    if (pick.length >= 4) break;
    if (!pick.includes(id) && MOVES[id].power > 0) pick.splice(pick.length - (status.length && pick.includes(status[status.length - 1]) ? 1 : 0), 0, id);
  }
  return pick.slice(0, 4);
}

/* ───────── 개체 ───────── */

export type Mon = {
  id: string;
  species: string;
  level: number;
  /** 누적 경험치 */
  xp: number;
  hp: number;
  status?: Status;
  /** 기술 id 와 남은 횟수 */
  moves: { id: string; pp: number }[];
  /** 개체마다 조금 다른 능력(0~7) — 같은 종이어도 키우는 맛 */
  gene: { hp: number; atk: number; def: number; spd: number };
  caughtAt?: string;
};

export const MAX_LEVEL = 50;
export const xpFor = (level: number) => Math.round(Math.pow(level, 3) * 0.8);

export type Stats = { hp: number; atk: number; def: number; spd: number };
export function statsOf(m: Pick<Mon, "species" | "level" | "gene">): Stats {
  const b = SPECIES[m.species].base;
  const L = m.level;
  const st = (base: number, g: number) => Math.floor(((base + g) * (L + 8)) / 28) + 4;
  return {
    hp: Math.floor(((b.hp + m.gene.hp) * (L + 8)) / 22) + 8,
    atk: st(b.atk, m.gene.atk),
    def: st(b.def, m.gene.def),
    spd: st(b.spd, m.gene.spd),
  };
}

export function makeMon(species: string, level: number, rng: Rng, id: string, at?: string): Mon {
  const gene = { hp: rint(rng, 0, 7), atk: rint(rng, 0, 7), def: rint(rng, 0, 7), spd: rint(rng, 0, 7) };
  const lv = clamp(Math.round(level), 1, MAX_LEVEL);
  const mon: Mon = { id, species, level: lv, xp: xpFor(lv), hp: 0, gene, moves: [], caughtAt: at };
  mon.hp = statsOf(mon).hp;
  mon.moves = movesAt(species, lv).map((m) => ({ id: m, pp: MOVES[m].pp }));
  return mon;
}

/** 경험치를 더하고 레벨 · 진화 · 새 기술을 반영한다. 새 객체를 돌려준다. */
export function grantXp(mon: Mon, amount: number): { mon: Mon; notes: string[] } {
  const m: Mon = { ...mon, moves: mon.moves.map((x) => ({ ...x })) };
  const notes: string[] = [];
  m.xp += Math.max(0, Math.round(amount));
  while (m.level < MAX_LEVEL && m.xp >= xpFor(m.level + 1)) {
    const before = statsOf(m).hp;
    m.level++;
    m.hp = Math.min(statsOf(m).hp, m.hp + (statsOf(m).hp - before));
    notes.push(`${SPECIES[m.species].name}의 레벨이 ${m.level}이 됐다!`);
    const evo = SPECIES[m.species].evolves;
    if (evo && m.level >= evo.at) {
      const was = SPECIES[m.species].name;
      const hpGap = statsOf(m).hp - m.hp;
      m.species = evo.to;
      m.hp = Math.max(1, statsOf(m).hp - hpGap);
      notes.push(`${josa(was, "이/가")} ${josa(SPECIES[m.species].name, "으로/로")} 진화했다!`);
    }
    const want = movesAt(m.species, m.level);
    for (const id of want)
      if (!m.moves.some((x) => x.id === id)) notes.push(`${josa(SPECIES[m.species].name, "은/는")} ${josa(MOVES[id].name, "을/를")} 배웠다!`);
    m.moves = want.map((id) => m.moves.find((x) => x.id === id) ?? { id, pp: MOVES[id].pp });
  }
  if (m.level >= MAX_LEVEL) m.xp = Math.min(m.xp, xpFor(MAX_LEVEL));
  return { mon: m, notes };
}

export function healMon(m: Mon): Mon {
  return { ...m, hp: statsOf(m).hp, status: undefined, moves: m.moves.map((x) => ({ id: x.id, pp: MOVES[x.id].pp })) };
}

/* ───────── 난수 ───────── */

export type Rng = { s: number };
export function rnd(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (r: Rng, a: number, b: number) => a + Math.floor(rnd(r) * (b - a + 1));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ───────── 지역 ───────── */

export type Region = {
  key: string;
  name: string;
  blurb: string;
  levels: [number, number];
  /** 팀에서 가장 높은 레벨이 이만큼은 돼야 들어간다 */
  needLevel: number;
  table: [string, number][];
  sky: [string, string];
  ground: string;
};

export const REGIONS: Region[] = [
  {
    key: "meadow", name: "들꽃 숲", blurb: "풀숲과 꽃밭 — 처음 떠나기 좋은 곳",
    levels: [2, 5], needLevel: 0,
    table: [["leaf_2", 25], ["beetle_2", 25], ["burr_2", 25], ["puff_2", 20], ["leaf_3", 3], ["beetle_3", 2]],
    sky: ["#bfe6ff", "#e9f8de"], ground: "#8fcf6a",
  },
  {
    key: "hill", name: "바람 언덕", blurb: "바람 부는 풀언덕 — 느긋한 친구들이 살아요",
    levels: [6, 12], needLevel: 5,
    table: [["toy_2", 18], ["bee_2", 18], ["mush_2", 18], ["sloth_2", 14], ["koala_2", 14], ["scare_2", 12], ["toy_3", 3], ["bee_3", 3]],
    sky: ["#c7ecf7", "#f4f1cf"], ground: "#a9cf72",
  },
  {
    key: "lake", name: "물빛 호수", blurb: "맑은 물가 — 번개 새와 눈송이가 놀러 와요",
    levels: [9, 16], needLevel: 8,
    table: [["conch_2", 22], ["volt_2", 22], ["snow_2", 22], ["puff_2", 10], ["conch_3", 8], ["volt_3", 7], ["snow_3", 7], ["burr_3", 2]],
    sky: ["#9fd4f5", "#d8f1f7"], ground: "#7cc3c9",
  },
  {
    key: "swamp", name: "안개 늪", blurb: "물안개 낀 늪 — 물가 친구들이 모여요",
    levels: [12, 20], needLevel: 12,
    table: [["swan_2", 16], ["capy_2", 16], ["croc_2", 14], ["snail_2", 14], ["octo_2", 14], ["seal_2", 14], ["capy_3", 6], ["croc_3", 6]],
    sky: ["#b9cfc8", "#dfe8d6"], ground: "#6f9a7a",
  },
  {
    key: "cave", name: "달빛 동굴", blurb: "깜깜한 동굴 — 귀한 생물이 숨어 있어요",
    levels: [17, 30], needLevel: 17,
    table: [["bat_2", 16], ["ghost_2", 16], ["ember_2", 12], ["bat_3", 14], ["ghost_3", 14], ["ember_3", 8], ["volt_3", 6], ["snow_3", 6], ["leaf_3", 4], ["bat_4", 2], ["ghost_4", 2]],
    sky: ["#2c2346", "#4c3d6e"], ground: "#5d5470",
  },
  {
    key: "plateau", name: "눈꽃 고원", blurb: "높고 추운 고원 — 힘센 생물이 돌아다녀요",
    levels: [24, 34], needLevel: 24,
    table: [["peng_2", 14], ["moth_2", 14], ["rac_2", 14], ["mole_2", 14], ["boar_2", 12], ["ele_2", 12], ["unicorn_2", 10], ["peaco_2", 10]],
    sky: ["#cfe4f5", "#f6fbff"], ground: "#cfdde6",
  },
  {
    key: "temple", name: "별빛 신전", blurb: "별이 쏟아지는 옛 신전 — 전설 영물이 잠들어 있어요",
    levels: [36, 46], needLevel: 35,
    table: [["ember_4", 8], ["leaf_4", 8], ["conch_4", 8], ["volt_4", 8], ["snow_4", 8], ["bat_4", 8], ["ghost_4", 8], ["unicorn_4", 8], ["ele_4", 8], ["moth_4", 8], ["tiger", 1], ["bengal_tiger", 1], ["lion", 1], ["giraffe", 1], ["mudeung_tiger", 1], ["cheonma", 1], ["baengnok", 1], ["bulgasari", 1], ["imugi", 1], ["maek", 1], ["azure_dragon", 1], ["vermilion_bird", 1], ["white_tiger", 1], ["black_tortoise", 1], ["bii_jo", 1], ["eungryong", 1], ["baektaek", 1], ["geumseom", 1], ["phoenix", 1], ["haetae", 1], ["samjoko", 1], ["cheonrok", 1], ["yellow_dragon", 1], ["hong_dragon", 1]],
    sky: ["#1b1740", "#433a86"], ground: "#6a5f9c",
  },
];

export function regionOpen(save: AdvSave, r: Region): boolean {
  return topLevel(save) >= r.needLevel;
}
export const topLevel = (save: AdvSave) => Math.max(0, ...save.party.map((m) => m.level), ...save.box.map((m) => m.level));

/** 수풀에서 나올 생물 하나 */
export function rollWild(region: Region, rng: Rng): { species: string; level: number } {
  const total = region.table.reduce((a, [, w]) => a + w, 0);
  let x = rnd(rng) * total;
  let species = region.table[0][0];
  for (const [k, w] of region.table) {
    if ((x -= w) < 0) {
      species = k;
      break;
    }
  }
  let level = rint(rng, region.levels[0], region.levels[1]);
  const st = SPECIES[species].stage;
  if (st === 3) level = Math.max(level, EVOLVE_AT[2]);
  if (st === 4) level = Math.max(level, EVOLVE_AT[3]);
  // 진화할 레벨을 넘긴 야생은 진화한 모습으로 나온다(Lv.28 인데 첫 모습이면 이상하다)
  for (let evo = SPECIES[species].evolves; evo && level >= evo.at; evo = SPECIES[species].evolves) species = evo.to;
  return { species, level };
}

/* ───────── 가방 ───────── */

export const BALLS = {
  basic: { name: "도토리공", mult: 1, price: 100, note: "기본 공" },
  great: { name: "물방울공", mult: 1.6, price: 300, note: "잘 잡혀요" },
  star: { name: "별빛공", mult: 2.4, price: 900, note: "아주 잘 잡혀요" },
} as const;
export type BallKey = keyof typeof BALLS;

export const ITEMS = {
  potion: { name: "상처약", heal: 40, price: 150, note: "체력 40 회복" },
  bigpotion: { name: "큰상처약", heal: 9999, price: 500, note: "체력 모두 회복" },
  cure: { name: "깨움약", heal: 0, price: 120, note: "상태이상 회복" },
} as const;
export type ItemKey = keyof typeof ITEMS;

export function applyItem(m: Mon, item: ItemKey): Mon | null {
  const max = statsOf(m).hp;
  if (m.hp <= 0) return null;
  if (item === "cure") return m.status ? { ...m, status: undefined } : null;
  if (m.hp >= max) return null;
  return { ...m, hp: Math.min(max, m.hp + ITEMS[item].heal) };
}

/* ───────── 저장 ───────── */

export type AdvSave = {
  v: 1;
  gold: number;
  balls: Record<BallKey, number>;
  items: Record<ItemKey, number>;
  party: Mon[];
  box: Mon[];
  seen: string[];
  caught: string[];
  wins: number;
  catches: number;
  /** 다음 개체 번호 */
  next: number;
  seed: number;
};

export const PARTY_MAX = 6;
export const STARTERS = ["leaf_2", "ember_2", "conch_2"] as const;

export function newSave(starter: string, seed: number): AdvSave {
  const rng = { s: seed | 0 };
  const mon = makeMon(starter, 5, rng, "m1");
  return {
    v: 1, gold: 500,
    balls: { basic: 5, great: 0, star: 0 },
    items: { potion: 3, bigpotion: 0, cure: 1 },
    party: [mon], box: [], seen: [starter], caught: [starter],
    wins: 0, catches: 0, next: 2, seed: rng.s,
  };
}

/** 읽어 들인 값 다듬기 — 모르는 종 · 기술은 떨군다(옛 · 새 번들이 섞여도 깨지지 않게). */
export function normalizeSave(raw: unknown): AdvSave | null {
  const s = raw as Partial<AdvSave> | null;
  if (!s || s.v !== 1 || !Array.isArray(s.party)) return null;
  const okMon = (m: Mon) => !!m && !!SPECIES[m.species];
  const fixMon = (m: Mon): Mon => {
    // 기술 표가 바뀌면(2026-11-08 기술 확장) 옛 개체도 지금 레벨의 기술 넷으로 맞춘다 — 같은 기술은 남은 횟수를 지킨다
    const had = new Map((m.moves ?? []).map((x) => [x.id, x.pp]));
    const moves = movesAt(m.species, m.level).map((id) => ({ id, pp: Math.min(MOVES[id].pp, had.get(id) ?? MOVES[id].pp) }));
    return { ...m, moves, hp: clamp(m.hp ?? 0, 0, statsOf(m).hp) };
  };
  const party = s.party.filter(okMon).map(fixMon);
  if (!party.length) return null;
  return {
    v: 1,
    gold: Math.max(0, Math.floor(s.gold ?? 0)),
    balls: { basic: s.balls?.basic ?? 0, great: s.balls?.great ?? 0, star: s.balls?.star ?? 0 },
    items: { potion: s.items?.potion ?? 0, bigpotion: s.items?.bigpotion ?? 0, cure: s.items?.cure ?? 0 },
    party,
    box: (s.box ?? []).filter(okMon).map(fixMon),
    seen: (s.seen ?? []).filter((k) => SPECIES[k]),
    caught: (s.caught ?? []).filter((k) => SPECIES[k]),
    wins: s.wins ?? 0, catches: s.catches ?? 0, next: s.next ?? 100, seed: s.seed ?? 1,
  };
}

/* ───────── 전투 ───────── */

export type Fighter = {
  mon: Mon;
  stats: Stats;
  stages: Record<StatKey, number>;
  sleep: number;
};
export type Side = { team: Fighter[]; active: number; name: string };
export type Battle = {
  seed: number;
  sides: [Side, Side];
  wild: boolean;
  region?: string;
  turn: number;
  runTries: number;
  /** 내 생물이 쓰러져 다음을 골라야 한다 */
  needSwap: boolean;
  over: null | "win" | "lose" | "run" | "caught";
  /** 이번 판에 나가 본 내 생물(경험치 나눔) */
  joined: string[];
  caught?: Mon;
};

const fighter = (mon: Mon): Fighter => ({ mon: { ...mon, moves: mon.moves.map((x) => ({ ...x })) }, stats: statsOf(mon), stages: { atk: 0, def: 0, spd: 0 }, sleep: 0 });

export function startWild(save: AdvSave, region: Region): { battle: Battle; save: AdvSave } {
  const rng = { s: save.seed };
  const w = rollWild(region, rng);
  const wildMon = makeMon(w.species, w.level, rng, "wild");
  const lead = Math.max(0, save.party.findIndex((m) => m.hp > 0));
  const battle: Battle = {
    seed: rng.s,
    sides: [
      { team: save.party.map(fighter), active: lead, name: "나" },
      { team: [fighter(wildMon)], active: 0, name: "야생" },
    ],
    wild: true, region: region.key, turn: 0, runTries: 0, needSwap: false, over: null,
    joined: [save.party[lead].id],
  };
  const seen = save.seen.includes(w.species) ? save.seen : [...save.seen, w.species];
  return { battle, save: { ...save, seed: rng.s, seen } };
}

export function cloneBattle(b: Battle): Battle {
  return JSON.parse(JSON.stringify(b)) as Battle;
}

export const activeOf = (b: Battle, side: 0 | 1) => b.sides[side].team[b.sides[side].active];
const stageMul = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/** 피해량 — 이 게임의 공식(원작 공식이 아니다). */
export function damage(att: Fighter, def: Fighter, move: Move, rng: Rng): { dmg: number; eff: number; crit: boolean } {
  const eff = effectiveness(move.type, SPECIES[def.mon.species].type);
  const crit = rnd(rng) < (move.crit ?? 1 / 16);
  const a = att.stats.atk * stageMul(crit ? Math.max(0, att.stages.atk) : att.stages.atk) * (att.mon.status === "burn" ? 0.5 : 1);
  const d = def.stats.def * stageMul(crit ? Math.min(0, def.stages.def) : def.stages.def);
  const stab = SPECIES[att.mon.species].type === move.type ? 1.3 : 1;
  const roll = 0.86 + rnd(rng) * 0.14;
  const dmg = Math.max(1, Math.floor(((move.power * (a / d) * (att.mon.level + 10)) / 55) * stab * eff * (crit ? 1.5 : 1) * roll));
  return { dmg, eff, crit };
}

const STRUGGLE: Move = { id: "struggle", name: "버둥거리기", type: "노말", power: 30, acc: 100, pp: 1, fx: "contact", note: "쓸 기술이 없어요" };
/** 기술 찾기 — 모르는 id 는 버둥거리기 */
export const moveOf = (id: string): Move => MOVES[id] ?? STRUGGLE;
/** 잡기 확률 — 체력이 낮을수록 · 상태이상일수록 · 좋은 공일수록 · 잘 겨눌수록(aim 0~1). */
export function catchChance(f: Fighter, ball: BallKey, aim: number): number {
  const sp = SPECIES[f.mon.species];
  const hpPart = 1 - (2 / 3) * (f.mon.hp / f.stats.hp);
  const st = f.mon.status === "sleep" ? 1.6 : f.mon.status ? 1.25 : 1;
  const aimMul = 0.8 + clamp(aim, 0, 1) * 0.5;
  return clamp(sp.catchRate * hpPart * st * BALLS[ball].mult * aimMul, 0.03, 0.97);
}

/* ───────── 끝난 판 → 저장 ───────── */

export type Outcome = { save: AdvSave; notes: string[]; gold: number };

/** 판이 끝난 뒤 — 체력 · 상태를 돌려놓고 경험치 · 골드 · 잡은 생물을 저장에 넣는다. */
export function finishBattle(save: AdvSave, b: Battle, spent: { balls: Record<BallKey, number>; items: Record<ItemKey, number> }): Outcome {
  const notes: string[] = [];
  let party: Mon[] = b.sides[0].team.map((f) => ({ ...f.mon, status: f.mon.status === "sleep" ? undefined : f.mon.status }));
  let gold = 0;
  const foe = b.sides[1].team;
  if (b.over === "win" || b.over === "caught") {
    const totalXp = foe.reduce((a, f) => a + (f.mon.hp <= 0 || b.over === "caught" ? (SPECIES[f.mon.species].xp * f.mon.level) / 7 : 0), 0);
    const share = b.joined.filter((id) => party.some((m) => m.id === id && m.hp > 0));
    party = party.map((m) => {
      if (!share.includes(m.id)) return m;
      const r = grantXp(m, totalXp / Math.max(1, share.length) * (b.wild ? 1 : 1.5));
      notes.push(...r.notes);
      return r.mon;
    });
    if (b.over === "win") gold = foe.reduce((a, f) => a + f.mon.level * 8 + 10, 0);
  }
  let box = save.box;
  let caught = save.caught;
  let next = save.next;
  if (b.over === "caught" && b.caught) {
    const mon: Mon = { ...b.caught, id: `m${next++}`, status: undefined, caughtAt: b.region };
    if (party.length < PARTY_MAX) party = [...party, mon];
    else {
      box = [...box, mon];
      notes.push(`팀이 가득 차서 ${josa(SPECIES[mon.species].name, "은/는")} 보관함으로 갔다`);
    }
    if (!caught.includes(mon.species)) caught = [...caught, mon.species];
  }
  for (const m of party) if (!caught.includes(m.species)) caught = [...caught, m.species];
  const seen = [...new Set([...save.seen, ...caught])];
  if (b.over === "lose") {
    const lost = Math.floor(save.gold * 0.1);
    gold = -lost;
    party = party.map(healMon);
    notes.push(`쉼터로 돌아와 모두 회복했다${lost ? ` · 골드 ${lost} 를 잃었다` : ""}`);
  }
  return {
    save: {
      ...save,
      party, box, caught, seen, next,
      gold: Math.max(0, save.gold + gold),
      balls: spent.balls,
      items: spent.items,
      wins: save.wins + (b.over === "win" ? 1 : 0),
      catches: save.catches + (b.over === "caught" ? 1 : 0),
      seed: b.seed,
    },
    notes,
    gold,
  };
}
