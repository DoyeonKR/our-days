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
export function learnedAt(species: string, level: number): string[] {
  return [...new Set(SPECIES[species].learn.filter(([lv]) => lv <= level).map(([, id]) => id))];
}

export function movesAt(species: string, level: number): string[] {
  const sp = SPECIES[species];
  const learned = learnedAt(species, level);
  const own = learned.filter((id) => MOVES[id].power > 0 && MOVES[id].type === sp.type);
  const status = learned.filter((id) => MOVES[id].power === 0);
  // 자기 속성 공격 셋 + 변화 하나 — 고레벨에도 생물마다 기술이 달라지게
  const pick = [...own.slice(-3), ...status.slice(-1)];
  for (const id of [...learned].reverse()) {
    if (pick.length >= 4) break;
    if (!pick.includes(id) && MOVES[id].power > 0) pick.splice(pick.length - (status.length && pick.includes(status[status.length - 1]) ? 1 : 0), 0, id);
  }
  return pick.slice(0, 4);
}

/** 이 생물이 지금 쓰는 기술 — 직접 고른 것이 있으면(배운 것만, 넷까지) 그것 */
export function movesOf(m: Pick<Mon, "species" | "level" | "picked">): string[] {
  const ok = learnedAt(m.species, m.level);
  const p = (m.picked ?? []).filter((id, i, a) => ok.includes(id) && a.indexOf(id) === i).slice(0, 4);
  return p.length ? p : movesAt(m.species, m.level);
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
  /** 직접 고른 기술(없으면 레벨에 맞춰 자동) */
  picked?: string[];
  /** 끼운 장신구 — 모험에서만 든다(대전 팀은 freshMon 이 떼어 낸다) */
  charm?: CharmKey;
};

export const CHARMS = {
  power: { name: "힘의 구슬", note: "공격 +12%", price: 1500 },
  guard: { name: "단단한 조개", note: "방어 +12%", price: 1500 },
  swift: { name: "바람 깃털", note: "빠르기 +12%", price: 1500 },
  spark: { name: "각성의 돌", note: "각성 게이지가 1.4배 빨리 차요", price: 2200 },
} as const;
export type CharmKey = keyof typeof CHARMS;
export const CHARM_KEYS = Object.keys(CHARMS) as CharmKey[];
export const charmGain = (m: Pick<Mon, "charm">) => (m.charm === "spark" ? 1.4 : 1);
/** 장신구를 반영한 전투 능력치 */
export function battleStats(m: Mon): Stats {
  const st = statsOf(m);
  const up = (v: number, k: CharmKey) => (m.charm === k ? Math.round(v * 1.12) : v);
  return { hp: st.hp, atk: up(st.atk, "power"), def: up(st.def, "guard"), spd: up(st.spd, "swift") };
}
/** 팀 · 보관함에 끼워 둔 수 */
const charmUsed = (save: AdvSave, k: CharmKey) => [...save.party, ...save.box].filter((m) => m.charm === k).length;
/** 다음 장신구로 바꾼다(없음 → 가진 것 차례로 → 없음) */
export function cycleCharm(save: AdvSave, id: string): AdvSave {
  const m = [...save.party, ...save.box].find((x) => x.id === id);
  if (!m) return save;
  const order: (CharmKey | undefined)[] = [undefined, ...CHARM_KEYS];
  const at = order.indexOf(m.charm);
  let next: CharmKey | undefined;
  for (let i = 1; i <= order.length; i++) {
    const k = order[(at + i) % order.length];
    if (!k || (save.charms?.[k] ?? 0) > charmUsed(save, k)) {
      next = k;
      break;
    }
  }
  const put = (x: Mon) => (x.id === id ? { ...x, charm: next } : x);
  return { ...save, party: save.party.map(put), box: save.box.map(put) };
}

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
    const want = movesOf(m);
    for (const id of want)
      if (!m.moves.some((x) => x.id === id)) notes.push(`${josa(SPECIES[m.species].name, "은/는")} ${josa(MOVES[id].name, "을/를")} 배웠다!`);
    for (const [lv, id] of SPECIES[m.species].learn)
      if (lv === m.level && !want.includes(id)) notes.push(`${MOVES[id].name} — 팀 화면에서 기술로 고를 수 있어요`);
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
  /** 지역 대장 — 처음 이기면 뱃지와 보상 */
  boss?: { name: string; team: [string, number][]; gold: number; ball: BallKey; count: number };
};

export const REGIONS: Region[] = [
  {
    boss: { name: "숲지기 아름", team: [["beetle_2", 6], ["puff_2", 7]], gold: 300, ball: "basic", count: 5 },
    key: "meadow", name: "들꽃 숲", blurb: "풀숲과 꽃밭 — 처음 떠나기 좋은 곳",
    levels: [2, 5], needLevel: 0,
    table: [["leaf_2", 25], ["beetle_2", 25], ["burr_2", 25], ["puff_2", 20], ["leaf_3", 3], ["beetle_3", 2]],
    sky: ["#bfe6ff", "#e9f8de"], ground: "#8fcf6a",
  },
  {
    boss: { name: "바람지기 소요", team: [["sloth_2", 12], ["toy_2", 13]], gold: 500, ball: "great", count: 2 },
    key: "hill", name: "바람 언덕", blurb: "바람 부는 풀언덕 — 느긋한 친구들이 살아요",
    levels: [6, 12], needLevel: 5,
    table: [["toy_2", 18], ["bee_2", 18], ["mush_2", 18], ["sloth_2", 14], ["koala_2", 14], ["scare_2", 12], ["toy_3", 3], ["bee_3", 3]],
    sky: ["#c7ecf7", "#f4f1cf"], ground: "#a9cf72",
  },
  {
    boss: { name: "호수지기 물결", team: [["snow_2", 15], ["conch_3", 16], ["volt_3", 17]], gold: 800, ball: "great", count: 3 },
    key: "lake", name: "물빛 호수", blurb: "맑은 물가 — 번개 새와 눈송이가 놀러 와요",
    levels: [9, 16], needLevel: 8,
    table: [["conch_2", 22], ["volt_2", 22], ["snow_2", 22], ["puff_2", 10], ["conch_3", 8], ["volt_3", 7], ["snow_3", 7], ["burr_3", 2]],
    sky: ["#9fd4f5", "#d8f1f7"], ground: "#7cc3c9",
  },
  {
    boss: { name: "늪지기 이끼", team: [["capy_2", 18], ["croc_2", 19], ["octo_3", 20]], gold: 1200, ball: "great", count: 5 },
    key: "swamp", name: "안개 늪", blurb: "물안개 낀 늪 — 물가 친구들이 모여요",
    levels: [12, 20], needLevel: 12,
    table: [["swan_2", 16], ["capy_2", 16], ["croc_2", 14], ["snail_2", 14], ["octo_2", 14], ["seal_2", 14], ["capy_3", 6], ["croc_3", 6]],
    sky: ["#b9cfc8", "#dfe8d6"], ground: "#6f9a7a",
  },
  {
    boss: { name: "동굴지기 달그림자", team: [["bat_3", 29], ["ghost_3", 30], ["ember_3", 31]], gold: 2000, ball: "star", count: 2 },
    key: "cave", name: "달빛 동굴", blurb: "깜깜한 동굴 — 귀한 생물이 숨어 있어요",
    levels: [17, 30], needLevel: 17,
    table: [["bat_2", 16], ["ghost_2", 16], ["ember_2", 12], ["bat_3", 14], ["ghost_3", 14], ["ember_3", 8], ["volt_3", 6], ["snow_3", 6], ["leaf_3", 4], ["bat_4", 2], ["ghost_4", 2]],
    sky: ["#2c2346", "#4c3d6e"], ground: "#5d5470",
  },
  {
    boss: { name: "고원지기 설화", team: [["peng_4", 34], ["boar_4", 35], ["ele_4", 36]], gold: 3000, ball: "star", count: 3 },
    key: "plateau", name: "눈꽃 고원", blurb: "높고 추운 고원 — 힘센 생물이 돌아다녀요",
    levels: [24, 34], needLevel: 24,
    table: [["peng_2", 14], ["moth_2", 14], ["rac_2", 14], ["mole_2", 14], ["boar_2", 12], ["ele_2", 12], ["unicorn_2", 10], ["peaco_2", 10]],
    sky: ["#cfe4f5", "#f6fbff"], ground: "#cfdde6",
  },
  {
    boss: { name: "신전의 수호자", team: [["azure_dragon", 40], ["phoenix", 41], ["yellow_dragon", 44]], gold: 6000, ball: "star", count: 5 },
    key: "temple", name: "별빛 신전", blurb: "별이 쏟아지는 옛 신전 — 전설 영물이 잠들어 있어요",
    levels: [36, 46], needLevel: 35,
    table: [["ember_4", 8], ["leaf_4", 8], ["conch_4", 8], ["volt_4", 8], ["snow_4", 8], ["bat_4", 8], ["ghost_4", 8], ["unicorn_4", 8], ["ele_4", 8], ["moth_4", 8], ["tiger", 1], ["bengal_tiger", 1], ["lion", 1], ["giraffe", 1], ["mudeung_tiger", 1], ["cheonma", 1], ["baengnok", 1], ["bulgasari", 1], ["imugi", 1], ["maek", 1], ["azure_dragon", 1], ["vermilion_bird", 1], ["white_tiger", 1], ["black_tortoise", 1], ["bii_jo", 1], ["eungryong", 1], ["baektaek", 1], ["geumseom", 1], ["phoenix", 1], ["haetae", 1], ["samjoko", 1], ["cheonrok", 1], ["yellow_dragon", 1], ["hong_dragon", 1]],
    sky: ["#1b1740", "#433a86"], ground: "#6a5f9c",
  },
];

/** 앞 지역 대장을 이기면 열린다 — 대장이 너무 어려우면 레벨로도 넘어갈 수 있다(막다른 길이 없게) */
export const openLevel = (r: Region) => r.needLevel + 8;
export function regionOpen(save: AdvSave, r: Region): boolean {
  const i = REGIONS.indexOf(r);
  if (i <= 0) return true;
  return (save.badges ?? []).includes(REGIONS[i - 1].key) || topLevel(save) >= openLevel(r);
}
/** 대장을 이기기 알맞은 레벨 */
export const bossLevel = (r: Region) => Math.max(...r.boss!.team.map(([, lv]) => lv));

/** 컴퓨터의 눈치(0~1) — 대전 1, 대장은 깊은 지역일수록, 야생은 살짝씩 */
export function aiLevelOf(b: Pick<Battle, "wild" | "boss" | "region" | "trainer" | "tower">): number {
  if (isDuel(b)) return 1;
  if (b.tower != null) return Math.min(1, 0.3 + b.tower * 0.025);
  const i = Math.max(0, REGIONS.findIndex((r) => r.key === b.region));
  return b.boss ? 0.3 + i * 0.1 : b.trainer ? 0.15 + i * 0.08 : i * 0.06;
}

/** 지금 뭘 하면 좋을까 — 지역 탭 맨 위에 한 줄 */
export function nextGoal(save: AdvSave): { text: string; region?: Region } {
  if (save.party.length < 2 && save.box.length === 0) return { text: "수풀에서 체력을 깎은 생물에게 공을 던져 친구를 만들어요", region: REGIONS[0] };
  const r = REGIONS.find((x) => x.boss && !(save.badges ?? []).includes(x.key));
  if (r && regionOpen(save, r)) return { text: `${r.name}의 ${r.boss!.name}에게 도전해요 — 권장 Lv.${bossLevel(r) + 1}`, region: r };
  const missing = SPECIES_KEYS.length - save.caught.length;
  return missing > 0 ? { text: `모든 대장을 이겼어요! 도감을 채워요 — 앞으로 ${missing}종` } : { text: "도감까지 다 채웠어요. 온라인 대전에서 겨뤄 봐요" };
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
  /** 이긴 지역 대장 */
  badges?: string[];
  /** 필드 상자 — 그날 연 것(KST 날짜가 바뀌면 다시 열린다) */
  field?: { day: string; opened: string[] };
  /** 이긴 필드 트레이너 · 이야기를 본 지역 */
  trainers?: string[];
  intro?: string[];
  /** 오늘의 임무 진행 */
  daily?: Daily;
  /** 도전의 탑 — 깬 가장 높은 층 */
  tower?: number;
  /** 가진 장신구 수 */
  charms?: Partial<Record<CharmKey, number>>;
};

export type Daily = { day: string; win: number; catch: number; chest: number; claimed: number[] };

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
    const moves = movesOf(m).map((id) => ({ id, pp: Math.min(MOVES[id].pp, had.get(id) ?? MOVES[id].pp) }));
    return { ...m, moves, hp: clamp(m.hp ?? 0, 0, statsOf(m).hp), charm: m.charm && m.charm in CHARMS ? m.charm : undefined };
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
    badges: (s.badges ?? []).filter((k) => REGIONS.some((r) => r.key === k)),
    trainers: (s.trainers ?? []).filter((k) => typeof k === "string"),
    intro: (s.intro ?? []).filter((k) => typeof k === "string"),
    daily: s.daily && typeof s.daily.day === "string" ? { day: s.daily.day, win: s.daily.win ?? 0, catch: s.daily.catch ?? 0, chest: s.daily.chest ?? 0, claimed: Array.isArray(s.daily.claimed) ? s.daily.claimed : [] } : undefined,
    tower: Math.max(0, Math.floor(s.tower ?? 0)),
    charms: Object.fromEntries(CHARM_KEYS.map((k) => [k, Math.max(0, Math.floor(s.charms?.[k] ?? 0))])),
    field: s.field && typeof s.field.day === "string" && Array.isArray(s.field.opened) ? { day: s.field.day, opened: s.field.opened.filter((k) => typeof k === "string").slice(0, 60) } : undefined,
  };
}

/* ───────── 보관함 · 상자 ───────── */

/** 보관함의 생물을 놓아준다 — 레벨만큼 골드. 팀은 건드리지 않는다. */
export function releaseMon(save: AdvSave, id: string): AdvSave {
  const m = save.box.find((x) => x.id === id);
  if (!m) return save;
  return { ...save, box: save.box.filter((x) => x.id !== id), gold: save.gold + m.level * 10 };
}

export type ChestReward = { gold: number; ball?: BallKey; balls?: number; item?: ItemKey; items?: number };
/** 상자 내용 — 깊은 지역일수록 좋다. 정해진 표라 두 번 열어도 같다. */
export function chestReward(regionIndex: number, slot: number): ChestReward {
  const gold = 60 + regionIndex * 70 + slot * 30;
  if (slot === 0) return { gold, ball: regionIndex >= 4 ? "star" : regionIndex >= 1 ? "great" : "basic", balls: 2 };
  if (slot === 1) return { gold, item: regionIndex >= 3 ? "bigpotion" : "potion", items: 2 };
  return { gold: gold * 2 };
}

/** 상자 열기 — 그날 처음이면 보상을 넣고 새 저장을 돌려준다. 이미 열었으면 null. */
export function openChest(save: AdvSave, region: Region, slot: number, day: string): { save: AdvSave; reward: ChestReward } | null {
  const field = save.field?.day === day ? save.field : { day, opened: [] as string[] };
  const id = `${region.key}:${slot}`;
  if (field.opened.includes(id)) return null;
  const reward = chestReward(REGIONS.indexOf(region), slot);
  return {
    reward,
    save: {
      ...save,
      gold: save.gold + reward.gold,
      balls: reward.ball ? { ...save.balls, [reward.ball]: save.balls[reward.ball] + (reward.balls ?? 0) } : save.balls,
      items: reward.item ? { ...save.items, [reward.item]: save.items[reward.item] + (reward.items ?? 0) } : save.items,
      field: { day, opened: [...field.opened, id] },
      daily: { ...dailyOf(save, day), chest: dailyOf(save, day).chest + 1 },
    },
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
  /** 지역 대장전이면 그 지역 */
  boss?: string;
  /** 필드 트레이너 id */
  trainer?: string;
  /** 도전의 탑 층 */
  tower?: number;
};

/** 온라인 대전인가 — 서버 판정과 맞춰야 하는 판 */
export const isDuel = (b: Pick<Battle, "wild" | "boss" | "trainer" | "tower">) => !b.wild && !b.boss && !b.trainer && b.tower == null;

const fighter = (mon: Mon): Fighter => ({ mon: { ...mon, moves: mon.moves.map((x) => ({ ...x })) }, stats: battleStats(mon), stages: { atk: 0, def: 0, spd: 0 }, sleep: 0 });

export function startWild(save: AdvSave, region: Region, met?: { species: string; level: number }): { battle: Battle; save: AdvSave } {
  const rng = { s: save.seed };
  const w = met ?? rollWild(region, rng);
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

export function startBoss(save: AdvSave, region: Region): { battle: Battle; save: AdvSave } {
  const rng = { s: save.seed };
  const team = region.boss!.team.map(([k, lv], i) => makeMon(k, lv, rng, `boss${i}`));
  const lead = Math.max(0, save.party.findIndex((m) => m.hp > 0));
  const battle: Battle = {
    seed: rng.s,
    sides: [
      { team: save.party.map(fighter), active: lead, name: "나" },
      { team: team.map(fighter), active: 0, name: region.boss!.name },
    ],
    wild: false, region: region.key, boss: region.key, turn: 0, runTries: 0, needSwap: false, over: null,
    joined: [save.party[lead].id],
  };
  return { battle, save: { ...save, seed: rng.s } };
}

/* ───────── 이야기 · 트레이너 ───────── */

export const REGION_STORY: Record<string, { intro: string; boss: string; after: string }> = {
  meadow: { intro: "꽃 냄새가 나는 숲이에요. 수풀을 헤치면 작은 친구들이 튀어나와요. 길 끝에는 숲지기가 기다려요.", boss: "이 숲을 지키는 건 힘이 아니라 마음이야. 네 마음을 보여 줘!", after: "좋은 팀이구나. 바람 언덕으로 가는 길을 열어 줄게." },
  hill: { intro: "언덕 위로 바람이 쉬지 않고 불어요. 돌풍이 불면 몸이 밀리니 조심해요.", boss: "바람은 멈추지 않아. 너도 멈추지 않을 수 있겠니?", after: "바람이 네 편이 됐네. 호수는 저 아래야." },
  lake: { intro: "맑은 호수에 하늘이 비쳐요. 물에 들어가면 느려지지만, 물 친구들은 더 빨라져요.", boss: "물결은 부드럽지만 바위도 깎는단다.", after: "호수가 잔잔해졌어. 안개 낀 늪을 조심해." },
  swamp: { intro: "안개 때문에 앞이 잘 안 보여요. 독 웅덩이에 오래 서 있지 마세요.", boss: "늪은 천천히 삼키지. 서두르다간 빠져나올 수 없어.", after: "안개를 뚫고 왔구나. 동굴엔 달빛만이 길을 비춰." },
  cave: { intro: "달빛이 스며드는 깜깜한 동굴이에요. 천장에서 종유석이 떨어지니 붉은 원을 피해요.", boss: "어둠 속에서도 네 친구가 보이니?", after: "빛을 잃지 않았구나. 고원의 눈은 더 차가워." },
  plateau: { intro: "끝없는 눈밭이에요. 빙판에서는 미끄러지고, 눈덩이가 굴러떨어져요.", boss: "여기까지 온 자는 많지 않아. 추위를 이겨 낼 수 있겠어?", after: "얼음도 녹일 뜨거운 팀이네. 이제 신전뿐이야." },
  temple: { intro: "별이 쏟아지는 옛 신전이에요. 제단에 서면 힘이 차오르고, 전설의 영물이 잠들어 있어요.", boss: "별들이 네 여정을 지켜봤다. 마지막 시험을 받아라.", after: "모든 뱃지를 모았구나. 이제 도전의 탑이 너를 기다린다." },
};

export type Trainer = { id: string; name: string; hello: string; bye: string; team: [string, number][]; gold: number };
const TRAINER_TEXT: Record<string, [string, string, string][]> = {
  meadow: [["꼬마 다온", "내 친구들이 제일 귀여워! 한번 볼래?", "우아, 너희도 귀엽다!"], ["채집가 보라", "수풀에서 뭘 찾았는지 겨뤄 볼까?", "오늘은 네가 더 잘 찾았네."]],
  hill: [["연날리기 하늘", "바람을 읽을 줄 알아야 이겨!", "바람이 너한테 불었나 봐."], ["목동 누리", "우리 애들 튼튼하게 키웠거든!", "다음엔 더 잘 먹여 볼게."]],
  lake: [["낚시꾼 윤슬", "물고기 대신 네가 걸렸네!", "놓친 고기가 더 크대."], ["뱃사공 물길", "노 젓는 팔심 좀 볼래?", "팔이 다 아프네, 하하."]],
  swamp: [["안개지기 새벽", "안개 속에선 내가 먼저 봐.", "다 보였구나, 내 수가."], ["약초꾼 이슬", "독도 잘 쓰면 약이지!", "해독제나 챙겨야겠어."]],
  cave: [["광부 돌쇠", "여기 보석은 내 거야!", "그래, 하나 가져가."], ["탐험가 그믐", "지도엔 없는 길을 알아.", "네가 더 멀리 가겠네."]],
  plateau: [["등반가 한결", "정상까진 내가 먼저야.", "숨이 차네, 먼저 가."], ["눈사람 장인 소담", "내 눈사람보다 단단하니?", "녹아 버렸어…"]],
  temple: [["순례자 별하", "별빛이 내게 힘을 줘.", "별이 너를 골랐구나."], ["수문장 은하", "자격을 증명해라.", "지나가도 좋다."]],
};
function grownUp(species: string, level: number): string {
  let k = species;
  for (let evo = SPECIES[k].evolves; evo && level >= evo.at; evo = SPECIES[k].evolves) k = evo.to;
  return k;
}
/** 지역의 트레이너 둘 — 그 지역 생물로 팀을 짠다(표에서 파생해 늘 같다) */
export function trainersOf(r: Region): Trainer[] {
  const kinds = r.table.map(([k]) => k).filter((k) => !SPECIES[k].legend);
  return (TRAINER_TEXT[r.key] ?? []).map(([name, hello, bye], i) => {
    const lv = Math.round(r.levels[0] + (r.levels[1] - r.levels[0]) * (i ? 0.85 : 0.5));
    const team: [string, number][] = [[grownUp(kinds[(i * 2) % kinds.length], lv), lv], [grownUp(kinds[(i * 2 + 1) % kinds.length], lv + 1), lv + 1]];
    return { id: `${r.key}:${i}`, name, hello, bye, team, gold: lv * 30 };
  });
}
export const trainerById = (id: string) => {
  const r = REGIONS.find((x) => x.key === id.split(":")[0]);
  return r ? trainersOf(r).find((t) => t.id === id) : undefined;
};

/* ───────── 오늘의 임무 ───────── */

export const MISSIONS = [
  { key: "win", need: 5, label: "전투 5번 이기기", gold: 300, ball: "basic", balls: 3 },
  { key: "catch", need: 2, label: "생물 2마리 잡기", gold: 200, ball: "great", balls: 2 },
  { key: "chest", need: 2, label: "필드 상자 2개 열기", gold: 400, ball: "star", balls: 1 },
] as const;
export const dailyOf = (save: AdvSave, day: string): Daily => (save.daily?.day === day ? save.daily : { day, win: 0, catch: 0, chest: 0, claimed: [] });
export function claimMission(save: AdvSave, i: number, day: string): AdvSave | null {
  const d = dailyOf(save, day);
  const m = MISSIONS[i];
  if (!m || d.claimed.includes(i) || d[m.key] < m.need) return null;
  return { ...save, gold: save.gold + m.gold, balls: { ...save.balls, [m.ball]: save.balls[m.ball] + m.balls }, daily: { ...d, claimed: [...d.claimed, i] } };
}

/* ───────── 트레이너전 · 도전의 탑 ───────── */

function startTeam(save: AdvSave, region: Region, name: string, team: [string, number][], extra: Partial<Battle>, healFirst = false): { battle: Battle; save: AdvSave } {
  const rng = { s: save.seed };
  const foes = team.map(([k, lv], i) => makeMon(k, lv, rng, `foe${i}`));
  const party = healFirst ? save.party.map(healMon) : save.party;
  const lead = Math.max(0, party.findIndex((m) => m.hp > 0));
  const battle: Battle = {
    seed: rng.s,
    sides: [{ team: party.map(fighter), active: lead, name: "나" }, { team: foes.map(fighter), active: 0, name }],
    wild: false, region: region.key, turn: 0, runTries: 0, needSwap: false, over: null, joined: [party[lead].id], ...extra,
  };
  return { battle, save: { ...save, seed: rng.s } };
}
export const startTrainer = (save: AdvSave, r: Region, t: Trainer) => startTeam(save, r, t.name, t.team, { trainer: t.id });

export const TOWER_MAX = 50;
export const towerOpen = (save: AdvSave) => (save.badges ?? []).includes(REGIONS[0].key);
/** 층마다 정해진 상대 — 위로 갈수록 레벨이 높고, 10층마다 전설이 나온다 */
export function towerTeam(floor: number): [string, number][] {
  const lv = Math.min(MAX_LEVEL, 8 + Math.round(floor * 0.9));
  const stage = lv >= 32 ? 4 : lv >= 16 ? 3 : 2;
  const pool = SPECIES_KEYS.filter((k) => SPECIES[k].stage === stage && !SPECIES[k].legend);
  const pick = (i: number) => pool[(floor * 7 + i * 13) % pool.length];
  const team: [string, number][] = [[pick(0), lv], [pick(1), lv], [pick(2), Math.min(MAX_LEVEL, lv + 1)]];
  if (floor % 10 === 0) team[2] = [LEGEND_KEYS[(floor / 10 - 1) % LEGEND_KEYS.length], Math.min(MAX_LEVEL, lv + 1)];
  return team;
}
export const towerRegion = (floor: number) => REGIONS[floor % REGIONS.length];
export function towerReward(floor: number): { gold: number; star: number; charm?: CharmKey } {
  return { gold: 100 + floor * 40, star: floor % 5 === 0 ? 1 : 0, charm: floor % 10 === 0 ? CHARM_KEYS[(floor / 10 - 1) % CHARM_KEYS.length] : undefined };
}
/** 탑은 언제나 팀을 회복하고 오른다 */
export const startTower = (save: AdvSave, floor: number) => startTeam(save, towerRegion(floor), `도전의 탑 ${floor}층`, towerTeam(floor), { tower: floor }, true);

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

export type Outcome = { save: AdvSave; notes: string[]; gold: number; art: string[]; evos: { from: string; to: string }[]; xp: number };

/** 판이 끝난 뒤 — 체력 · 상태를 돌려놓고 경험치 · 골드 · 잡은 생물을 저장에 넣는다. */
export function finishBattle(save: AdvSave, b: Battle, spent: { balls: Record<BallKey, number>; items: Record<ItemKey, number> }, day?: string): Outcome {
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
  const evos = party.flatMap((m) => {
    const was = save.party.find((x) => x.id === m.id);
    return was && was.species !== m.species ? [{ from: was.species, to: m.species }] : [];
  });
  const art = evos.map((e) => e.to);
  const xpGot = party.reduce((sum, m) => sum + Math.max(0, m.xp - (save.party.find((x) => x.id === m.id)?.xp ?? m.xp)), 0);
  let box = save.box;
  let caught = save.caught;
  let next = save.next;
  if (b.over === "caught" && b.caught) {
    const mon: Mon = { ...b.caught, id: `m${next++}`, status: undefined, caughtAt: b.region };
    art.push(mon.species);
    if (party.length < PARTY_MAX) party = [...party, mon];
    else {
      box = [...box, mon];
      notes.push(`팀이 가득 차서 ${josa(SPECIES[mon.species].name, "은/는")} 보관함으로 갔다`);
    }
    if (!caught.includes(mon.species)) caught = [...caught, mon.species];
  }
  for (const m of party) if (!caught.includes(m.species)) caught = [...caught, m.species];
  const seen = [...new Set([...save.seen, ...caught])];
  let badges = save.badges ?? [];
  let balls = spent.balls;
  const bossOf = b.boss ? REGIONS.find((r) => r.key === b.boss) : undefined;
  if (b.over === "win" && bossOf?.boss && !badges.includes(bossOf.key)) {
    badges = [...badges, bossOf.key];
    gold += bossOf.boss.gold;
    balls = { ...balls, [bossOf.boss.ball]: balls[bossOf.boss.ball] + bossOf.boss.count };
    notes.push(`${bossOf.name} 뱃지를 얻었다! 골드 +${bossOf.boss.gold} · ${BALLS[bossOf.boss.ball].name} ×${bossOf.boss.count}`);
  }
  let trainers = save.trainers ?? [];
  const tr = b.trainer ? trainerById(b.trainer) : undefined;
  if (b.over === "win" && tr && !trainers.includes(tr.id)) {
    trainers = [...trainers, tr.id];
    gold += tr.gold;
    notes.push(`${tr.name}: "${tr.bye}" — 골드 +${tr.gold}`);
  }
  let tower = save.tower ?? 0;
  let charms = save.charms ?? {};
  if (b.over === "win" && b.tower != null && b.tower > tower) {
    tower = b.tower;
    const rw = towerReward(b.tower);
    gold += rw.gold;
    if (rw.star) balls = { ...balls, star: balls.star + rw.star };
    if (rw.charm) charms = { ...charms, [rw.charm]: (charms[rw.charm] ?? 0) + 1 };
    notes.push(`도전의 탑 ${b.tower}층 돌파! 골드 +${rw.gold}${rw.star ? " · 별빛공 ×1" : ""}${rw.charm ? ` · ${CHARMS[rw.charm].name}` : ""}`);
  }
  let daily = save.daily;
  if (day && (b.over === "win" || b.over === "caught")) {
    const d = dailyOf(save, day);
    daily = { ...d, win: d.win + (b.over === "win" ? 1 : 0), catch: d.catch + (b.over === "caught" ? 1 : 0) };
  }
  if (b.over === "lose") {
    const lost = b.tower != null ? 0 : Math.floor(save.gold * 0.1);
    gold = -lost;
    party = party.map(healMon);
    notes.push(`쉼터로 돌아와 모두 회복했다${lost ? ` · 골드 ${lost} 를 잃었다` : ""}`);
  }
  return {
    save: {
      ...save,
      party, box, caught, seen, next,
      gold: Math.max(0, save.gold + gold),
      balls,
      badges,
      trainers,
      tower,
      charms,
      daily,
      items: spent.items,
      wins: save.wins + (b.over === "win" ? 1 : 0),
      catches: save.catches + (b.over === "caught" ? 1 : 0),
      seed: b.seed,
    },
    notes,
    gold,
    art,
    evos,
    xp: xpGot,
  };
}
