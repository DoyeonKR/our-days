/* 우리 수조 (2026-11-01) — [사용자: "수조 키우는 게임 … 등급을 엄청 다양화 … 치어를 하트를 주고 사서 키울 수 있는 … 오랜시간 잘 기르면 최종형태로 …
 * 최소 30가지 … 악세사리들을 배치 … 다 하트로 구매 … 이미지와 그래픽은 다른 세션에서"]
 * 순수 엔진(화면은 components/AquariumGame). 저장은 섬 상태의 옵셔널 칸 s.aquarium, 지갑은 섬 하트 s.coins — DB 변경 없음.
 *
 * 규칙의 뼈대:
 *  · 새끼(계열 16종)를 사서 새끼 → 어린 개체 → 최종 형태로 키운다. 기존 12계열은 넷씩, 해양 4계열은 같은 종으로 자라며 모두 52종 · 8등급.
 *  · 성장은 실제 시간이다(1일 ~ 21일). 배가 고프거나 물이 더러우면 성장이 멈춘다 — 죽지는 않는다.
 *  · 정성(cq) = 잘 돌본 시간의 비율. 정성이 높을수록 높은 형태까지 열린다.
 *    ⚠ 정성으로 종을 가르기만 하면 '대충 키워야 나오는 종'이 생긴다(README §14.5 펫 진화의 교훈). 그래서 **못 만난 형태가 먼저** 나온다 —
 *      잘 키우는 사람은 같은 계열을 네 번 키우면 넷을 다 만난다.
 *  · 계산은 지연 정산(syncAqua) — 꺼 둔 시간까지 한 번에 센다. 한 번 방치된 구간은 48시간까지만 '못 돌본 시간'으로 친다(여행 다녀왔다고 벌받지 않게).
 *  · 2026-11-05 보강: 모르는 계열을 지우지 않는다(alien) · 앞선 시계 보정 · 성장 소식 · 대기 그물 · 둘이 돌봄 · 먹이 · 조합 · 손님 · 알 · 보내 주기 재설계.
 *    새 칸은 섬의 맨 위 칸 s.aquaPlus 에 저장한다(옛 앱이 s.aquarium 을 다시 만들며 모르는 칸을 버리기 때문 — stow 참고).
 *  · 결과가 양쪽 기기에서 같아야 하므로 뽑기는 물고기 id 로만 정한다(Math.random 금지).
 * ⚠ 섬 엔진은 타입만 부른다 — 값으로 부르면 이 파일을 쓰는 화면이 섬 엔진까지 싣는다. */
import type { IslandState } from "./island.ts";
import { josa } from "./josa.ts";
import { kstDate } from "./kst.ts";

export const GRADES = ["흔함", "보통", "고급", "희귀", "영웅", "전설", "신화", "태초"] as const;
export type Grade = (typeof GRADES)[number];

export type AquaSpecies = { key: string; name: string; grade: Grade };
export type AquaFamily = {
  key: string;
  name: string;
  /** 계열의 값어치 순서(치어 가게 시절의 값 — 2026-11-02 부터 사지 않는다) */
  price: number;
  /** 최종 형태까지 걸리는 성장 시간 — 잘 먹고 물이 깨끗한 시간만 센다 */
  hours: number;
  /** 이 계열을 살 수 있는 수조 단계 */
  minTank: number;
  /** 다 컸을 때 크기(수조 폭의 %) */
  size: number;
  /** 실존 해양 생물은 한 종으로 성장한다. 기존 관상어는 네 품종을 유지한다. */
  finals: readonly [AquaSpecies, ...AquaSpecies[]];
  youngName?: string;
};

const s = (key: string, name: string, grade: Grade): AquaSpecies => ({ key, name, grade });

export const FAMILIES: readonly AquaFamily[] = [
  { key: "guppy", name: "구피", price: 300, hours: 24, minTank: 1, size: 15, finals: [s("cobra_guppy", "코브라 구피", "흔함"), s("tuxedo_guppy", "턱시도 구피", "보통"), s("mosaic_guppy", "모자이크 구피", "고급"), s("fullred_guppy", "풀레드 구피", "희귀")] },
  { key: "pale_chub", name: "피라미", price: 350, hours: 25, minTank: 1, size: 14, finals: [s("pale_chub", "피라미", "흔함")] },
  { key: "chinese_minnow", name: "버들치", price: 380, hours: 26, minTank: 1, size: 14, finals: [s("chinese_minnow", "버들치", "흔함")] },
  { key: "crucian", name: "붕어", price: 400, hours: 28, minTank: 1, size: 16, finals: [s("crucian", "붕어", "흔함")] },
  { key: "tetra", name: "테트라", price: 500, hours: 30, minTank: 1, size: 14, finals: [s("neon_tetra", "네온 테트라", "흔함"), s("cardinal_tetra", "카디널 테트라", "보통"), s("glowlight_tetra", "글로라이트 테트라", "고급"), s("diamond_tetra", "다이아몬드 테트라", "희귀")] },
  { key: "smelt", name: "빙어", price: 600, hours: 32, minTank: 1, size: 14, finals: [s("smelt", "빙어", "보통")] },
  { key: "sweetfish", name: "은어", price: 650, hours: 36, minTank: 1, size: 17, finals: [s("sweetfish", "은어", "보통")] },
  { key: "goldfish", name: "금붕어", price: 800, hours: 48, minTank: 1, size: 20, finals: [s("comet_gold", "코멧 금붕어", "보통"), s("ryukin_gold", "류킨 금붕어", "고급"), s("oranda_gold", "오란다 금붕어", "희귀"), s("ranchu_gold", "란추 금붕어", "영웅")] },
  { key: "bullhead", name: "동자개", price: 1200, hours: 54, minTank: 1, size: 17, finals: [s("bullhead", "동자개", "보통")] },
  { key: "betta", name: "베타", price: 1500, hours: 60, minTank: 1, size: 19, finals: [s("veil_betta", "베일테일 베타", "보통"), s("crown_betta", "크라운테일 베타", "고급"), s("halfmoon_betta", "하프문 베타", "희귀"), s("koi_betta", "코이 베타", "영웅")] },
  { key: "mackerel", name: "고등어", price: 1800, hours: 64, minTank: 1, size: 20, finals: [s("mackerel", "고등어", "보통")] },
  { key: "rockfish_bollak", name: "볼락", price: 1900, hours: 66, minTank: 1, size: 17, finals: [s("rockfish_bollak", "볼락", "보통")] },
  { key: "catfish", name: "메기", price: 2200, hours: 72, minTank: 1, size: 24, finals: [s("catfish", "메기", "고급")] },
  { key: "flounder", name: "광어", price: 2500, hours: 76, minTank: 2, size: 24, finals: [s("flounder", "광어", "고급")] },
  { key: "common_carp", name: "잉어", price: 2600, hours: 78, minTank: 2, size: 26, finals: [s("common_carp", "잉어", "고급")] },
  { key: "rockfish", name: "우럭", price: 2700, hours: 80, minTank: 2, size: 21, finals: [s("rockfish", "우럭", "고급")] },
  { key: "masu_salmon", name: "산천어", price: 2800, hours: 82, minTank: 2, size: 19, finals: [s("masu_salmon", "산천어", "고급")] },
  { key: "angel", name: "엔젤피시", price: 3000, hours: 84, minTank: 2, size: 22, finals: [s("silver_angel", "실버 엔젤", "고급"), s("marble_angel", "마블 엔젤", "희귀"), s("platinum_angel", "플래티넘 엔젤", "영웅"), s("altum_angel", "알툼 엔젤", "전설")] },
  { key: "black_seabream", name: "감성돔", price: 3200, hours: 87, minTank: 2, size: 22, finals: [s("black_seabream", "감성돔", "고급")] },
  { key: "sailfin_sandfish", name: "도루묵", price: 3400, hours: 90, minTank: 2, size: 18, finals: [s("sailfin_sandfish", "도루묵", "고급")] },
  { key: "starfish", name: "별불가사리", price: 3600, hours: 92, minTank: 2, size: 16, youngName: "새끼", finals: [s("starfish", "별불가사리", "고급")] },
  { key: "clown", name: "흰동가리", price: 5000, hours: 96, minTank: 2, size: 17, finals: [s("ocellaris_clown", "오셀라리스 흰동가리", "고급"), s("percula_clown", "퍼큘라 흰동가리", "희귀"), s("snowflake_clown", "스노우플레이크 흰동가리", "영웅"), s("blackice_clown", "블랙 아이스 흰동가리", "전설")] },
  { key: "sea_bream", name: "참돔", price: 5500, hours: 100, minTank: 2, size: 24, finals: [s("sea_bream", "참돔", "희귀")] },
  { key: "snakehead", name: "가물치", price: 6000, hours: 102, minTank: 3, size: 28, finals: [s("snakehead", "가물치", "희귀")] },
  { key: "mandarin_fish", name: "쏘가리", price: 6200, hours: 105, minTank: 2, size: 23, finals: [s("mandarin_fish", "쏘가리", "희귀")] },
  { key: "jellyfish", name: "보름달물해파리", price: 6500, hours: 108, minTank: 2, size: 22, youngName: "어린 개체", finals: [s("jellyfish", "보름달물해파리", "희귀")] },
  { key: "perch_kkeokji", name: "꺽지", price: 6800, hours: 109, minTank: 2, size: 18, finals: [s("perch_kkeokji", "꺽지", "희귀")] },
  { key: "sea_bass", name: "농어", price: 7000, hours: 110, minTank: 3, size: 26, finals: [s("sea_bass", "농어", "희귀")] },
  { key: "hairtail", name: "갈치", price: 7500, hours: 112, minTank: 3, size: 30, finals: [s("hairtail", "갈치", "희귀")] },
  { key: "salmon", name: "연어", price: 8000, hours: 115, minTank: 3, size: 27, finals: [s("salmon", "연어", "희귀")] },
  { key: "cutlassfish_pollock", name: "명태", price: 8500, hours: 116, minTank: 3, size: 26, finals: [s("cutlassfish_pollock", "명태", "희귀")] },
  { key: "squid", name: "살오징어", price: 8800, hours: 118, minTank: 3, size: 22, youngName: "새끼", finals: [s("squid", "살오징어", "희귀")] },
  { key: "discus", name: "디스커스", price: 9000, hours: 120, minTank: 3, size: 23, finals: [s("blue_discus", "블루 디스커스", "희귀"), s("pigeon_discus", "피전 블러드 디스커스", "영웅"), s("leopard_discus", "레오파드 디스커스", "영웅"), s("turquoise_discus", "터콰이즈 디스커스", "전설")] },
  { key: "nurse_shark", name: "수염상어", price: 10000, hours: 130, minTank: 3, size: 30, youngName: "새끼", finals: [s("nurse_shark", "수염상어", "희귀")] },
  { key: "leopard_shark", name: "표범상어", price: 12000, hours: 150, minTank: 3, size: 28, youngName: "새끼", finals: [s("leopard_shark", "표범상어", "희귀")] },
  { key: "koi", name: "비단잉어", price: 15000, hours: 168, minTank: 3, size: 27, finals: [s("kohaku_koi", "홍백 비단잉어", "희귀"), s("sanke_koi", "대정삼색 비단잉어", "영웅"), s("showa_koi", "소화삼색 비단잉어", "전설"), s("ogon_koi", "황금 비단잉어", "전설")] },
  { key: "croaker", name: "민어", price: 18000, hours: 180, minTank: 3, size: 29, finals: [s("croaker", "민어", "영웅")] },
  { key: "eel", name: "뱀장어", price: 19000, hours: 185, minTank: 3, size: 29, finals: [s("eel", "뱀장어", "영웅")] },
  { key: "yellowtail", name: "방어", price: 20000, hours: 190, minTank: 4, size: 31, finals: [s("yellowtail", "방어", "영웅")] },
  { key: "barred_knifejaw", name: "돌돔", price: 21000, hours: 195, minTank: 4, size: 25, finals: [s("barred_knifejaw", "돌돔", "영웅")] },
  { key: "ray", name: "민물가오리", price: 22000, hours: 200, minTank: 4, size: 28, finals: [s("motoro_ray", "모토로 가오리", "영웅"), s("polka_ray", "폴카닷 가오리", "전설"), s("black_ray", "블랙 다이아몬드 가오리", "전설"), s("pearl_ray", "펄 가오리", "신화")] },
  { key: "octopus", name: "대문어", price: 24000, hours: 206, minTank: 4, size: 30, youngName: "새끼", finals: [s("octopus", "대문어", "영웅")] },
  { key: "gulper_eel", name: "풍선장어", price: 26000, hours: 213, minTank: 4, size: 28, finals: [s("gulper_eel", "풍선장어", "영웅")] },
  { key: "striped_jack", name: "줄전갱이", price: 28000, hours: 220, minTank: 4, size: 28, finals: [s("striped_jack", "줄전갱이", "전설")] },
  { key: "lenok", name: "열목어", price: 29000, hours: 225, minTank: 4, size: 25, finals: [s("lenok", "열목어", "전설")] },
  { key: "puffer", name: "황복", price: 30000, hours: 230, minTank: 4, size: 22, finals: [s("puffer", "황복", "전설")] },
  { key: "arowana", name: "아로와나", price: 32000, hours: 240, minTank: 4, size: 32, finals: [s("silver_arowana", "실버 아로와나", "영웅"), s("golden_arowana", "골든 아로와나", "전설"), s("red_arowana", "슈퍼 레드 아로와나", "전설"), s("platinum_arowana", "플래티넘 아로와나", "신화")] },
  { key: "blue_shark", name: "청새리상어", price: 35000, hours: 250, minTank: 5, size: 37, youngName: "새끼", finals: [s("blue_shark", "청새리상어", "영웅")] },
  { key: "bluefin", name: "참다랑어", price: 38000, hours: 264, minTank: 5, size: 36, finals: [s("bluefin_tuna", "참다랑어", "영웅")] },
  { key: "anglerfish", name: "초롱아귀", price: 40000, hours: 270, minTank: 5, size: 30, finals: [s("anglerfish", "초롱아귀", "전설")] },
  { key: "sea_turtle", name: "바다거북", price: 45000, hours: 288, minTank: 5, size: 32, youngName: "새끼", finals: [s("green_sea_turtle", "바다거북", "전설")] },
  { key: "oarfish", name: "산갈치", price: 46000, hours: 292, minTank: 5, size: 38, finals: [s("oarfish", "산갈치", "전설")] },
  { key: "hammerhead", name: "귀상어", price: 48000, hours: 300, minTank: 5, size: 38, youngName: "새끼", finals: [s("hammerhead", "귀상어", "전설")] },
  { key: "whale_shark", name: "고래상어", price: 52000, hours: 312, minTank: 5, size: 45, youngName: "새끼", finals: [s("whale_shark", "고래상어", "신화")] },
  { key: "great_white", name: "백상아리", price: 54000, hours: 318, minTank: 5, size: 42, youngName: "새끼", finals: [s("great_white", "백상아리", "전설")] },
  { key: "manta", name: "만타가오리", price: 56000, hours: 324, minTank: 5, size: 43, youngName: "새끼", finals: [s("oceanic_manta", "만타가오리", "전설")] },
  { key: "coelacanth", name: "실러캔스", price: 57000, hours: 326, minTank: 5, size: 36, finals: [s("coelacanth", "실러캔스", "신화")] },
  { key: "megamouth", name: "넓은주둥이상어", price: 58000, hours: 330, minTank: 5, size: 44, youngName: "새끼", finals: [s("megamouth", "넓은주둥이상어", "신화")] },
  { key: "giant_squid", name: "대왕오징어", price: 59000, hours: 333, minTank: 5, size: 42, youngName: "새끼", finals: [s("giant_squid", "대왕오징어", "신화")] },
  { key: "rising", name: "등용어", price: 60000, hours: 336, minTank: 5, size: 34, finals: [s("pearl_carp", "여의주 잉어", "전설"), s("imugi_fish", "이무기어", "신화"), s("azure_dragonfish", "청룡어", "신화"), s("golden_dragonfish", "황룡어", "태초")] },
  { key: "astral", name: "별무리어", price: 120000, hours: 504, minTank: 6, size: 34, finals: [s("moon_jelly", "달빛 해파리", "신화"), s("aurora_ray", "오로라 가오리", "신화"), s("galaxy_fish", "은하수어", "태초"), s("genesis_fish", "태초의 물고기", "태초")] },
  { key: "kraken", name: "크라켄", price: 150000, hours: 600, minTank: 6, size: 48, youngName: "새끼", finals: [s("kraken", "크라켄", "태초")] },
];
export const ALL_SPECIES: readonly AquaSpecies[] = FAMILIES.flatMap((f) => [...f.finals]);
/** 다 컸을 때 보통 길이(cm) */
export const FISH_BASE_CM: Readonly<Record<string, number>> = {
  guppy: 5, tetra: 4, goldfish: 22, betta: 7, angel: 15, clown: 9, discus: 18, koi: 65, ray: 45, arowana: 85,
  bluefin: 220, sea_turtle: 95, whale_shark: 950, manta: 420, rising: 280, astral: 160, sweetfish: 22, catfish: 55, jellyfish: 30,
  nurse_shark: 180, leopard_shark: 130, blue_shark: 280, hammerhead: 350, great_white: 480, megamouth: 520,
  flounder: 60, rockfish: 40, sea_bream: 60, sea_bass: 80, salmon: 85, yellowtail: 110, croaker: 90, striped_jack: 85,
  pale_chub: 12, chinese_minnow: 12, crucian: 25, smelt: 13, bullhead: 22, mackerel: 35, rockfish_bollak: 22, common_carp: 70, masu_salmon: 28, black_seabream: 45, sailfin_sandfish: 25, starfish: 12, snakehead: 80, mandarin_fish: 50, perch_kkeokji: 21, hairtail: 110, cutlassfish_pollock: 60, squid: 40, eel: 90, barred_knifejaw: 55, octopus: 150, gulper_eel: 75, lenok: 60, puffer: 40, anglerfish: 60, oarfish: 500, coelacanth: 190, giant_squid: 1100, kraken: 1500,
};
export const FISH_STAGE_SIZE = [0.4, 0.7, 1] as const;
/** 지금 몸길이(cm) — 잡을 때 정해진 다 큰 길이(adultCm)에 지금 단계를 곱한다. 자라면 함께 커진다. 길이 칸이 없는 옛 물고기는 보통 크기. */
export const fishCm = (f: { family: string; stage: 0 | 1 | 2; adultCm?: number }) => Math.round((f.adultCm ?? FISH_BASE_CM[f.family] ?? 20) * FISH_STAGE_SIZE[f.stage] * 10) / 10;
export const familyOf = (key: string): AquaFamily | undefined => FAMILIES.find((f) => f.key === key);
/** 도감의 한 칸 — 치어 · 어린 모습 · 다 큰 품종이 각각 한 마리다[사용자: 모델링 "그거 다 물고기화 해봐"]. 모델 하나 = 칸 하나. */
export type AquaForm = { key: string; family: string; stage: 0 | 1 | 2; species?: string; grade: Grade };
export const ALL_FORMS: readonly AquaForm[] = FAMILIES.flatMap((f): AquaForm[] => [
  { key: `fry_${f.key}`, family: f.key, stage: 0, grade: f.finals[0].grade },
  { key: `juv_${f.key}`, family: f.key, stage: 1, grade: f.finals[0].grade },
  ...f.finals.map((x): AquaForm => ({ key: x.key, family: f.key, stage: 2, species: x.key, grade: x.grade })),
]);
export const speciesOf = (key: string | undefined): AquaSpecies | undefined => ALL_SPECIES.find((x) => x.key === key);


/** 수조 단계 값(2026-11-05 다시 매김) — 예전 누적 81,000(5단계) · 201,000(6단계)은 그 계열이 낚이는 레벨(12~18 · 32~36)의 낚시 벌이(레벨 36 까지 약 5.5만)를 한참 넘었다.
 *  진행 시뮬레이션(가장 깊은 곳 · 가장 싼 미끼 · 다 팔기, scratch income.mjs)의 누적 벌이: 레벨 9 약 3,800 · 12 약 6,300 · 18 약 12,500 · 25 약 21,400 · 36 약 59,600.
 *  지금 누적: 4단계 6,800(레벨 12 언저리) · 5단계 14,800(레벨 20 언저리 — 울릉도의 영웅 계열) · 6단계 34,800(레벨 30 언저리). 장비 · 미끼에도 써야 하니 벌이보다 조금 늦게 닿는다.
 *  전설 위는 수조 단계와 상관없이 담긴다(RARE_ANY_TANK) — 문섬의 바다거북 · 만타, 거진항의 별무리어, 심해의 크라켄. */
export const TANKS: readonly { name: string; fish: number; decor: number; price: number }[] = [
  { name: "작은 어항", fish: 4, decor: 6, price: 0 },
  { name: "둥근 어항", fish: 6, decor: 10, price: 800 },
  { name: "가정 수조", fish: 8, decor: 14, price: 2000 },
  { name: "대형 수조", fish: 12, decor: 20, price: 4000 },
  { name: "유리 수족관", fish: 16, decor: 26, price: 8000 },
  { name: "용궁 수조", fish: 20, decor: 32, price: 20000 },
  // 2026-11-05 상위 어항 — 옛 앱은 6단계까지만 알아서 7단계부터는 섬 최상위 칸 aquaTankTop(+ aquaPlus.tankTop)에 저장한다(stow)
  { name: "산호 대수족관", fish: 26, decor: 38, price: 45000 },
  { name: "심해 대수족관", fish: 32, decor: 44, price: 90000 },
  { name: "천상 수족관", fish: 40, decor: 52, price: 180000 },
  // 2026-11-11 [사용자: "저 엄청난 수조는 가지기 힘들게 … 저거보다 더 윗등급의 수조"] — 하트만으론 못 산다(TANK_GATES)
  { name: "해저 터널 수족관", fish: 50, decor: 60, price: 600000 },
  { name: "심연 돔 궁전", fish: 60, decor: 70, price: 2000000 },
];
/** 2026-11-11 까지 배포된 앱이 아는 마지막 단계 — 그 앱은 단계를 여기서 깎아 aquaTankTop 에 다시 쓴다. 그 위는 그 앱이 안 건드리는 aquaTankMax 에 둔다 */
export const TANK_TOP_LEGACY = 9;
/** 수조 배경 그림 파일 수 — 10 · 11단계는 9 를 쓴다(3D 물빛 · 볼거리가 다르다) */
export const TANK_ART_COUNT = 9;
/** 만난 모습 — 낚아 본 것 · 수조에서 키워 본 것 · 지금 수조에 있는 것. 도감 화면 · 게임 카드 · 수조 조건이 같은 수를 본다.
 *  도감 칸(ALL_FORMS)에 있는 key 만 센다(옛 저장분의 모르는 key 는 안 센다). fishing.ts 의 formsSeen 이 이걸 부른다. */
export function seenForms(st: { fishing?: unknown }, a: Pick<AquaState, "dex" | "fish">): Set<string> {
  const raw = (st.fishing as { seen?: unknown } | undefined)?.seen;
  const seen = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  return new Set([...seen, ...a.dex, ...a.fish.map((f) => fishArtKey(f))].filter((k) => FORM_KEYS().has(k)));
}
let formKeys: Set<string> | null = null;
const FORM_KEYS = () => (formKeys ??= new Set(ALL_FORMS.map((f) => f.key)));
/** 가지기 힘든 단계 — 하트에 더해 낚시 기록이 있어야 연다. 전부 이미 저장된 기록에서 센다(새 칸 없음) · 혼자 하는 섬도 닿는다 */
export const TANK_GATES: Readonly<Record<number, { level: number; dex: number; bosses: number }>> = {
  10: { level: 30, dex: 100, bosses: 5 },
  11: { level: 40, dex: 180, bosses: 12 },
};
export type TankGateCheck = { ok: boolean; items: { label: string; have: number; need: number }[] };
/** 낚시터 주인 key — fishingworld.ts 의 BOSSES 와 같은 순서 · 같은 목록이어야 한다(models-fix.test 가 맞춰 본다).
 *  값으로 import 하지 않는 이유: fishingworld 가 이 파일의 값(FISH_BASE_CM 등)을 import 한다 — 순환을 만들지 않는다 */
export const BOSS_KEYS: readonly string[] = ["dolsoe", "neuti", "hongryeon", "dammit", "gwihyang", "eunjasa", "geurimja", "eoreum", "baetmeori", "dodam", "sanho", "geomeun", "munji", "byeol", "simyeon"];
/** 잡아 본 주인 수 — 수조 조건(tankGate)과 주인 화면(FishingPanels)이 같이 쓴다(2026-11-11).
 *  예전엔 수조 조건이 저장된 아무 key 나 세고, 주인 화면은 BOSSES 만 세서 둘이 다른 수를 보일 수 있었다(옛 · 모르는 key) */
export function bossesBeaten(bosses: Readonly<Record<string, { caught?: unknown } | undefined>> | undefined): number {
  return BOSS_KEYS.filter((k) => num(bosses?.[k]?.caught, 0) > 0).length;
}
/** 그 단계의 조건 — 화면(잠긴 이유 · 진행)과 upgradeTank 가 같이 본다. 낚시 기록은 s.fishing 원본을 읽는다(fishing.ts 를 값으로 부르면 순환) */
export function tankGate(st: { fishing?: unknown }, a: Pick<AquaState, "dex" | "fish">, tier: number): TankGateCheck {
  const g = TANK_GATES[tier];
  if (!g) return { ok: true, items: [] };
  const f = (st.fishing ?? {}) as { level?: unknown; bosses?: Record<string, { caught?: unknown } | undefined> };
  const level = Math.max(1, Math.floor(num(f.level, 1)));
  const bosses = bossesBeaten(f.bosses);
  const items = [
    { label: "낚시 레벨", have: level, need: g.level },
    { label: "물고기 도감", have: seenForms(st, a).size, need: g.dex },
    { label: "주인 토벌", have: bosses, need: g.bosses },
  ];
  return { ok: items.every((x) => x.have >= x.need), items };
}
/** 옛 앱이 s.aquarium.tank 로 아는 마지막 단계 */
export const TANK_CORE_MAX = 6;
/** 물 한 번 가는 값 — 수조가 클수록 물이 많이 든다. 사흘에 한 번이라 한두 마리 판 값보다 적다 */
export const WATER_PRICES: readonly number[] = [10, 15, 20, 30, 40, 60, 80, 100, 130, 180, 250];
export const waterPrice = (tank: number) => WATER_PRICES[Math.min(WATER_PRICES.length, Math.max(1, tank)) - 1];

export type DecorKind = "plant" | "rock" | "ornament" | "gear";
export type AquaDecor = { key: string; name: string; kind: DecorKind; price: number; effect?: { type: "clean" | "grow" | "feed"; amount: number } };
const d = (key: string, name: string, kind: DecorKind, price: number, effect?: AquaDecor["effect"]): AquaDecor => ({ key, name, kind, price, ...(effect ? { effect } : {}) });

export const DECOR: readonly AquaDecor[] = [
  // 장비 — 종류마다 가장 좋은 하나만 듣는다(쌓이지 않는다). 놓아야 듣는다.
  d("filter_1", "스펀지 여과기", "gear", 400, { type: "clean", amount: 0.25 }),
  d("filter_2", "외부 여과기", "gear", 3000, { type: "clean", amount: 0.5 }),
  d("filter_3", "생명의 샘 여과기", "gear", 20000, { type: "clean", amount: 1 }),
  d("heater_1", "작은 히터", "gear", 500, { type: "grow", amount: 0.05 }),
  d("heater_2", "정온 히터", "gear", 4000, { type: "grow", amount: 0.1 }),
  d("heater_3", "용암석 히터", "gear", 25000, { type: "grow", amount: 0.15 }),
  d("feeder_1", "타이머 급이기", "gear", 600, { type: "feed", amount: 0.25 }),
  d("feeder_2", "스마트 급이기", "gear", 5000, { type: "feed", amount: 0.5 }),
  d("feeder_3", "풍요의 조개 급이기", "gear", 30000, { type: "feed", amount: 1 }),
  // 수초
  d("moss_ball", "모스 볼", "plant", 120),
  d("vallisneria", "발리스네리아", "plant", 150),
  d("java_fern", "자바 펀", "plant", 200),
  d("anubias", "아누비아스", "plant", 300),
  d("red_rotala", "붉은 로탈라", "plant", 500),
  d("water_lily", "수련", "plant", 800),
  d("coral", "산호", "plant", 1500),
  d("glow_kelp", "빛나는 해초", "plant", 5000),
  // 돌 · 나무
  d("pebbles", "조약돌", "rock", 100),
  d("driftwood", "유목", "rock", 350),
  d("stone_arch", "돌 아치", "rock", 700),
  d("lava_rock", "용암석", "rock", 1200),
  d("crystal", "수정 군락", "rock", 4000),
  d("moon_stone", "달의 돌", "rock", 9000),
  // 장식
  d("mailbox", "수중 우체통", "ornament", 600),
  d("diver", "잠수부 인형", "ornament", 900),
  d("heart_bubbler", "하트 기포기", "ornament", 1200),
  d("sand_castle", "모래성", "ornament", 1500),
  d("windmill", "수중 풍차", "ornament", 1800),
  d("treasure", "보물상자", "ornament", 2000),
  d("pearl_clam", "진주 조개", "ornament", 3000),
  d("stone_pagoda", "석탑", "ornament", 3500),
  d("sunken_ship", "난파선", "ornament", 6000),
  d("hanok", "수중 한옥", "ornament", 8000),
  d("mermaid", "인어 동상", "ornament", 12000),
  d("turtle_ship", "거북선", "ornament", 18000),
  d("dragon_palace", "용궁", "ornament", 60000),
  d("star_gate", "별의 문", "ornament", 100000),
];
export const decorOf = (key: string): AquaDecor | undefined => DECOR.find((x) => x.key === key);
/** 값이 비쌀수록 아름답지만 값만큼 늘지는 않는다(제곱근) */
export const decorBeauty = (x: AquaDecor) => Math.round(Math.sqrt(x.price));


/** 판매가 — 낚시(lib/fishing 의 coinValue)와 같은 식이다. 보내 주기 보상이 '그 자리에서 팔았으면 받았을 값'을 기준으로 삼으려고 여기에 둔다(낚시가 이 값을 다시 내보낸다). */
export const saleValue = (difficulty: number) => Math.round(15 * 1.6 ** difficulty);

export type AquaFish = {
  id: number;
  family: string;
  /** 0 치어 · 1 어린 물고기 · 2 최종 */
  stage: 0 | 1 | 2;
  species?: string;
  growH: number;
  goodH: number;
  totalH: number;
  /** 낚시터의 주인 — 그 이름. 왕관을 쓰고 헤엄친다 */
  crown?: string;
  /** 다 컸을 때 길이(cm) — 잡을 때의 길이에서 정한다. 대물은 자라도 대물이다. 지금 길이는 fishCm */
  adultCm?: number;
  /** 잡을 때의 단계 · 그 자리에서 팔았으면 받았을 하트(2026-11-05) — 보내 주기 보상의 기준. 옵셔널: 옛 물고기는 치어로 잡혔다고 친다. */
  caughtStage?: 0 | 1 | 2;
  catchV?: number;
  /** 수조의 알에서 태어났다 — 잡은 값이 없으니 보내 주기는 키운 만큼만 받는다(하트를 찍어 내는 길 금지) */
  bred?: boolean;
};
export type DecorPose = { rotation: number; scale: number };
export type PlacedDecor = { id: number; key: string; x: number; y: number; rotation?: number; scale?: number };
/** Optional fields keep old saves readable. Angles are degrees; size never changes gameplay effects. */
export function decorPose(p: { rotation?: number; scale?: number }): DecorPose {
  return { rotation: Number.isFinite(p.rotation) ? ((p.rotation! % 360) + 360) % 360 : 0,
    scale: Number.isFinite(p.scale) ? Math.min(1.6, Math.max(.6, p.scale!)) : 1 };
}

/** 성장 소식 한 줄 — 두 사람이 각자 한 번씩 본다(newsSeen). 시각은 안 남긴다(쪼개서 정산해도 같은 소식이어야 한다). */
export type AquaNews = { n: number; id: number; family: string; stage: 0 | 1 | 2; species?: string; egg?: boolean };
/** 대기 그물의 한 마리 — 수조가 찼을 때 24시간 붙잡아 둔다. value 는 잡을 때 판매가(지나면 그 값에 저절로 팔린다). */
export type NetFish = { family: string; stage: 0 | 1 | 2; species?: string; difficulty: number; value: number; at: number; cm?: number; crown?: string };
export type AquaReqKind = "adult" | "decor" | "beauty";
/** 오늘의 손님 의뢰 — 그날 처음 본 기기가 정해 저장한다(섬 주문 게시판과 같은 방식). */
export type AquaReq = { day: string; kind: AquaReqKind; key: string; n?: number; reward: number; done?: boolean };

export type AquaState = {
  tank: number;
  hunger: number;
  water: number;
  at: number;
  nextId: number;
  fish: AquaFish[];
  placed: PlacedDecor[];
  /** 옆으로 늘린 단계(0~3). 옵셔널 = 옛 저장분은 0 */
  wide?: number;
  /** 산 뒤 아직 안 놓은 악세사리(key → 개수) */
  bag: Record<string, number>;
  /** 만난 모습 — 다 큰 품종 · 2026-11-05 부터 치어(fry_) · 어린 모습(juv_)도 */
  dex: string[];
  /** 이 번들이 모르는 계열의 물고기 · 장식(새 버전이 더한 것) — 정산 · 화면에서 빼고, 저장할 때 그대로 되돌려 놓는다.
   *  ⚠ 예전엔 aquaOf 가 걸러 버려서 옛 앱이 무엇이든 저장하는 순간 새 계열 물고기가 영영 지워졌다. 저장되지 않는 칸이다(stow 가 뗀다). */
  alien?: { fish: unknown[]; placed: unknown[] };
  /* ── 2026-11-05 에 더한 칸 — 저장은 섬의 aquaPlus(맨 위 칸)에 따로 한다. 옛 앱의 aquaOf 는 아는 칸만 다시 만들어 저장하므로
   *    s.aquarium 안에 두면 상대가 옛 앱으로 먹이 한 번만 줘도 그물 속 물고기 · 소식이 사라진다. 맨 위 칸은 옛 앱도 ...st 로 그대로 흘려보낸다. */
  /** 지금 이어지는 방치 구간에서 못 돌본 시간(시간) — 48시간 상한을 '정산마다'가 아니라 '방치 구간마다' 걸려고 */
  badH?: number;
  news?: AquaNews[];
  newsN?: number;
  /** 사람 → 본 소식 번호 */
  newsSeen?: Record<string, number>;
  /** 사람 → 오늘 돌본 날(KST) · 둘이 돌봄 보너스를 받은 날 */
  care?: Record<string, string>;
  duoDay?: string;
  /** 계열 → 보내 준 수 */
  released?: Record<string, number>;
  net?: NetFish[];
  /** 찾은 장식 조합 id */
  combos?: string[];
  req?: AquaReq;
  /** 먹이 key → 남은 수 · 먹이로 바꾼 쓰레기 수(수집함은 줄이지 않는다) */
  food?: Record<string, number>;
  junkUsed?: number;
  /** 짝이 있는 동안 잘 돌본 시간 · 낳은 알 수 */
  breedH?: number;
  eggN?: number;
};
/** 맨 위 칸(s.aquaPlus)에 저장하는 칸들 */
const PLUS_KEYS = ["badH", "news", "newsN", "newsSeen", "care", "duoDay", "released", "net", "combos", "req", "food", "junkUsed", "breedH", "eggN"] as const;
export type AquaPlus = Partial<Pick<AquaState, (typeof PLUS_KEYS)[number]>>;
/** 섬 상태 + 수조의 맨 위 칸. 섬 타입(island.ts)은 건드리지 않는다 — 옛 저장분의 bubble 칸처럼 ...st 로 흘러간다.
 *  aquaTankTop: 7단계 위 수조. ⚠ aquaPlus 안에만 두면 2026-11-06 까지 배포된 앱(7ab54e1)이 aquaPlus 를 자기 칸 목록으로 다시 지어
 *  tankTop 을 버린다 — 하트는 그대로 쓰였는데 수조가 6단계로 내려앉는다. 섬 최상위 칸은 옛 앱도 ...st 로 그대로 흘려보낸다. */
export type Island = IslandState & { aquaPlus?: AquaPlus; aquaTankTop?: number; aquaTankMax?: number };

export const GROW_JUVENILE = 0.4;
export const HUNGER_HOURS = 24;
export const WATER_HOURS = 72;
/** 이 위면 '잘 돌보는 중' — 정성은 포만 40 · 물 50 위에서만 쌓인다 */
export const GOOD_HUNGER = 40;
export const GOOD_WATER = 50;
/** 물이 이 밑이면 성장이 멈춘다 */
export const MIN_WATER = 20;
/** 한 번 방치된 구간에서 '못 돌본 시간'으로 치는 상한(여행 다녀왔다고 키운 정성이 다 사라지지 않게) */
export const AWAY_CAP_H = 48;
export const BEAUTY_GROW_CAP = 0.15;
/** 저장된 시각이 이만큼 넘게 미래면 상대 기기 시계가 앞선 것이다 — 지금으로 다시 잡는다(그동안 줄이지도 키우지도 않는다) */
export const SKEW_MS = 5 * 60_000;
/** 대기 그물 — 몇 마리 · 몇 시간 */
export const NET_MAX = 3;
export const NET_HOURS = 24;
/** 짝이 잘 지낸 시간이 이만큼 쌓이면 알 하나. 잘 돌본 시간은 실제 시간보다 길 수 없으니 수조 하나에 3일에 많아야 하나다. */
export const BREED_H = 72;
/** 수조에서 키운 몫 — 보내 줄 때 '잡은 값'에 더하는 비율의 상한. 1 보다 작아서 다 키워도 다 큰 놈을 잡아 판 값보다 적다. */
export const RAISE_SHARE = 0.8;
/** 이 등급(전설) 위의 물고기는 수조 단계와 상관없이 한 칸을 차지한다 — 주인처럼 귀한 손님을 작은 수조라고 팔게 하면 안 된다 */
export const RARE_ANY_TANK = 5;
const HOUR = 3_600_000;
const EPS = 1e-7;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strRecord = (v: unknown): Record<string, string> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) as Record<string, string> : {});
const numRecord = (v: unknown): Record<string, number> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "number" && Number.isFinite(x))) as Record<string, number> : {});
const stageOf = (v: unknown): 0 | 1 | 2 => (v === 1 || v === 2 ? v : 0);

function readFish(v: unknown): AquaFish | null {
  if (!isObj(v) || typeof v.family !== "string" || !familyOf(v.family)) return null;
  const f = v as unknown as AquaFish;
  return { ...f, id: num(f.id, 0), stage: stageOf(f.stage), growH: num(f.growH, 0), goodH: num(f.goodH, 0), totalH: num(f.totalH, 0) };
}
function readPlaced(v: unknown): PlacedDecor | null {
  if (!isObj(v) || typeof v.key !== "string" || !decorOf(v.key)) return null;
  const p = v as unknown as PlacedDecor;
  return { ...p, id: num(p.id, 0), x: num(p.x, 50), y: num(p.y, 50) };
}
function readNet(v: unknown): NetFish | null {
  if (!isObj(v) || typeof v.family !== "string") return null;
  const n = v as unknown as NetFish;
  return { ...n, stage: stageOf(n.stage), difficulty: num(n.difficulty, 0), value: Math.max(0, Math.round(num(n.value, 0))), at: num(n.at, 0) };
}
function readPlus(p: unknown): AquaPlus {
  if (!isObj(p)) return {};
  const out: AquaPlus = {};
  if (typeof p.badH === "number" && Number.isFinite(p.badH)) out.badH = Math.max(0, Math.min(AWAY_CAP_H, p.badH));
  if (Array.isArray(p.news)) out.news = p.news.filter((x): x is AquaNews => isObj(x) && typeof x.n === "number" && typeof x.family === "string").map((x) => ({ ...x, stage: stageOf(x.stage) }));
  if (typeof p.newsN === "number") out.newsN = Math.max(0, Math.floor(p.newsN));
  if (isObj(p.newsSeen)) out.newsSeen = numRecord(p.newsSeen);
  if (isObj(p.care)) out.care = strRecord(p.care);
  if (typeof p.duoDay === "string") out.duoDay = p.duoDay;
  if (isObj(p.released)) out.released = numRecord(p.released);
  // 그물 속 물고기는 이 번들이 모르는 계열이어도 그대로 둔다(파는 값은 저장돼 있다)
  if (Array.isArray(p.net)) out.net = p.net.map(readNet).filter((x): x is NetFish => !!x).slice(0, NET_MAX);
  if (Array.isArray(p.combos)) out.combos = p.combos.filter((x): x is string => typeof x === "string");
  if (isObj(p.req) && typeof p.req.day === "string" && typeof p.req.key === "string" && ["adult", "decor", "beauty"].includes(p.req.kind as string)) out.req = { ...(p.req as AquaReq), reward: Math.max(0, num(p.req.reward, 0)) };
  if (isObj(p.food)) out.food = numRecord(p.food);
  if (typeof p.junkUsed === "number") out.junkUsed = Math.max(0, Math.floor(p.junkUsed));
  if (typeof p.breedH === "number" && Number.isFinite(p.breedH)) out.breedH = Math.max(0, Math.min(BREED_H, p.breedH));
  if (typeof p.eggN === "number") out.eggN = Math.max(0, Math.floor(p.eggN));
  return out;
}

type AquaSource = { aquarium?: AquaState | null; aquaPlus?: unknown; aquaTankTop?: unknown; aquaTankMax?: unknown };
/** 저장된 수조 단계 — 세 자리 중 가장 높은 값(하트로 산 단계는 어느 앱이 저장해도 내려가지 않는다) */
const tankTier = (st: AquaSource) => Math.min(TANKS.length, Math.max(1,
  Math.floor(num(st.aquarium?.tank, 1)),
  Math.floor(num((st.aquaPlus as { tankTop?: unknown } | null | undefined)?.tankTop, 1)),
  Math.floor(num(st.aquaTankTop, 1)),
  Math.floor(num(st.aquaTankMax, 1))));
/** 읽기 — 저장값을 검증해 한 덩어리로. 모르는 계열은 alien 으로 따로 들고 다닌다(버리지 않는다). */
export function aquaOf(st: AquaSource, now = 0): AquaState {
  const a = st.aquarium;
  const rawFish = [...(Array.isArray(a?.fish) ? a.fish : []), ...(a?.alien?.fish ?? [])];
  const rawPlaced = [...(Array.isArray(a?.placed) ? a.placed : []), ...(a?.alien?.placed ?? [])];
  const fish: AquaFish[] = [], placed: PlacedDecor[] = [], alien = { fish: [] as unknown[], placed: [] as unknown[] };
  for (const f of rawFish) { const ok = readFish(f); if (ok) fish.push(ok); else alien.fish.push(f); }
  for (const p of rawPlaced) { const ok = readPlaced(p); if (ok) placed.push(ok); else alien.placed.push(p); }
  return {
    tank: tankTier(st),
    wide: Math.min(WIDE_STEPS.length, Math.max(0, Math.floor(num(a?.wide, 0)))),
    hunger: Math.max(0, Math.min(100, num(a?.hunger, 100))),
    water: Math.max(0, Math.min(100, num(a?.water, 100))),
    at: num(a?.at, now),
    nextId: Math.max(1, Math.floor(num(a?.nextId, 1))),
    fish,
    placed,
    bag: numRecord(a?.bag),
    dex: Array.isArray(a?.dex) ? a.dex.filter((x): x is string => typeof x === "string") : [],
    ...(alien.fish.length || alien.placed.length ? { alien } : {}),
    ...readPlus(st.aquaPlus),
  };
}

/** 쓰기 — 수조 칸(옛 앱도 읽는 모양)과 맨 위 칸으로 나눠 섬에 얹는다. 모르는 계열은 수조 칸에 그대로 되돌린다. 모든 쓰기가 여기를 지난다. */
export function stow(st: IslandState, a: AquaState, coins = st.coins): Island {
  const core: AquaState = {
    tank: Math.min(a.tank, TANK_CORE_MAX), hunger: a.hunger, water: a.water, at: a.at, nextId: a.nextId,
    fish: [...a.fish, ...((a.alien?.fish ?? []) as AquaFish[])],
    placed: [...a.placed, ...((a.alien?.placed ?? []) as PlacedDecor[])],
    ...(a.wide !== undefined ? { wide: a.wide } : {}),
    bag: a.bag,
    dex: a.dex,
  };
  const plus: AquaPlus = {};
  for (const k of PLUS_KEYS) if (a[k] !== undefined) (plus as Record<string, unknown>)[k] = a[k];
  if (a.tank > TANK_CORE_MAX) (plus as Record<string, unknown>).tankTop = a.tank;
  // 최상위 칸이 진짜 자리 — 옛 앱이 aquaPlus 를 다시 지어도 남는다(tankTop 은 지금 앱끼리의 사본)
  // 10단계 위는 aquaTankMax 에도 — 지금 배포된 앱은 9 로 깎아 aquaTankTop 에 다시 쓰지만 이 칸은 모르고 흘린다(...st)
  return { ...st, coins, aquarium: core, aquaPlus: plus, ...(a.tank > TANK_CORE_MAX ? { aquaTankTop: a.tank } : {}), ...(a.tank > TANK_TOP_LEGACY ? { aquaTankMax: a.tank } : {}) };
}

/** 지금 모습의 그림 열쇠 — 치어 fry_<계열> · 어린 물고기 juv_<계열> · 최종 <종> */
export const fishArtKey = (f: Pick<AquaFish, "family" | "stage" | "species">) =>
  f.stage === 2 && f.species ? f.species : `${f.stage === 0 ? "fry" : "juv"}_${f.family}`;
/** 지금 모습의 이름 */
export function fishName(f: Pick<AquaFish, "family" | "stage" | "species"> & { crown?: string }): string {
  const fam = familyOf(f.family);
  if (f.crown) return `${f.crown} · ${speciesOf(f.species)?.name ?? fam?.name ?? "물고기"}`;
  if (f.stage === 2) return speciesOf(f.species)?.name ?? fam?.name ?? "물고기";
  return `${fam?.name ?? "물고기"} ${f.stage === 0 ? fam?.youngName ?? "치어" : fam?.youngName ? "어린 개체" : "어린 물고기"}`;
}
/** 어항을 옆으로 늘리는 값 [사용자: "재화를 주고 어항을 옆으로 늘릴 수 있도록"] — 넓어진 만큼 물고기 · 장식도 더 들어간다. 수조 단계와 따로 간다. */
export const WIDE_STEPS: readonly { price: number; fish: number; decor: number }[] = [
  { price: 12000, fish: 2, decor: 3 },
  { price: 30000, fish: 2, decor: 3 },
  { price: 70000, fish: 3, decor: 4 },
];
export const tankOf = (a: Pick<AquaState, "tank" | "wide">) => {
  const base = TANKS[a.tank - 1], done = WIDE_STEPS.slice(0, a.wide ?? 0);
  return { ...base, fish: base.fish + done.reduce((n, x) => n + x.fish, 0), decor: base.decor + done.reduce((n, x) => n + x.decor, 0) };
};
/** 수조에 든 물고기 수 — 이 번들이 모르는 계열도 자리는 차지한다(새 앱에서 보면 넘치면 안 된다) */
export const fishCount = (a: Pick<AquaState, "fish" | "alien">) => a.fish.length + (a.alien?.fish.length ?? 0);
export const fishRoom = (a: Pick<AquaState, "fish" | "alien" | "tank" | "wide">) => Math.max(0, tankOf(a).fish - fishCount(a));

function gearBest(a: Pick<AquaState, "placed">, type: "clean" | "grow" | "feed"): number {
  let best = 0;
  for (const p of a.placed) {
    const e = decorOf(p.key)?.effect;
    if (e?.type === type && e.amount > best) best = e.amount;
  }
  return best;
}

/* ── 장식 조합 · 좋아하는 장식(2026-11-05) ───────────────────────
 * 섬 꾸미기의 이웃 조합(island.ts DECOR_COMBOS)을 수조에 맞게 줄였다 — 수조엔 격자가 없으니 '가까이(COMBO_D % 안)'가 이웃이다.
 * 조합 하나 = 아름다움 +COMBO_BEAUTY, 성장 +2%(조합 성장은 셋까지). 처음 만들면 하트 조금 — 조합 수만큼만이라 하트를 찍어 내지 않는다. */
export const COMBO_D = 24;
export const COMBO_BEAUTY = 40;
export const COMBO_GROW = 0.02;
export const COMBO_GROW_CAP = 0.06;
export const COMBO_FIRST_COINS = 30;
export const AQUA_COMBOS: readonly { id: string; name: string; a: string; b: string }[] = [
  { id: "reef_garden", name: "산호초 정원", a: "coral", b: "pearl_clam" },
  { id: "treasure_isle", name: "보물섬", a: "treasure", b: "sunken_ship" },
  { id: "palace_feast", name: "용궁 잔치", a: "dragon_palace", b: "mermaid" },
  { id: "quiet_wood", name: "고요한 숲", a: "java_fern", b: "driftwood" },
  { id: "lily_bridge", name: "연못 다리", a: "water_lily", b: "stone_arch" },
  { id: "hanok_village", name: "물속 한옥 마을", a: "hanok", b: "stone_pagoda" },
  { id: "sea_battle", name: "옛 바다 싸움", a: "turtle_ship", b: "sunken_ship" },
  { id: "star_road", name: "별빛 길", a: "moon_stone", b: "star_gate" },
  { id: "lava_cave", name: "용암 동굴", a: "lava_rock", b: "crystal" },
  { id: "diver_mail", name: "편지 쓰는 잠수부", a: "mailbox", b: "diver" },
  { id: "sand_play", name: "모래 놀이", a: "sand_castle", b: "pebbles" },
  { id: "windy_meadow", name: "바람개비 풀밭", a: "windmill", b: "vallisneria" },
  { id: "glow_forest", name: "빛의 숲", a: "glow_kelp", b: "crystal" },
  { id: "moss_garden", name: "이끼 정원", a: "moss_ball", b: "anubias" },
  { id: "love_bubble", name: "사랑의 거품", a: "heart_bubbler", b: "red_rotala" },
];
/** 지금 성립한 조합 — 두 장식이 COMBO_D 안에 있으면. 같은 조합이 여러 쌍이어도 한 번만 센다. */
export function activeCombos(placed: readonly Pick<PlacedDecor, "key" | "x" | "y">[]): string[] {
  const out: string[] = [];
  for (const c of AQUA_COMBOS) {
    const as = placed.filter((p) => p.key === c.a), bs = placed.filter((p) => p.key === c.b);
    if (as.some((p) => bs.some((q) => q !== p && Math.hypot(p.x - q.x, p.y - q.y) <= COMBO_D))) out.push(c.id);
  }
  return out;
}
/** 좋아하는 장식 — 놓여 있으면 그 계열이 잘 돌본 시간을 FAVORITE_CARE 만큼 더 쳐 준다(정성이 조금 더 빨리 찬다) */
export const FAVORITE_CARE = 0.15;
export const FAVORITE_DECOR: Readonly<Record<string, string>> = {
  guppy: "moss_ball", tetra: "java_fern", goldfish: "water_lily", betta: "water_lily", angel: "driftwood", discus: "driftwood",
  clown: "coral", koi: "stone_arch", ray: "pebbles", arowana: "driftwood", catfish: "driftwood", crucian: "vallisneria",
  starfish: "pebbles", flounder: "pebbles", octopus: "pearl_clam", sea_turtle: "coral", jellyfish: "glow_kelp", eel: "lava_rock",
  anglerfish: "glow_kelp", rising: "dragon_palace", astral: "star_gate", kraken: "sunken_ship", whale_shark: "coral", manta: "coral",
  snakehead: "water_lily", mandarin_fish: "stone_arch", lenok: "pebbles", puffer: "treasure", coelacanth: "crystal", giant_squid: "sunken_ship",
};

export function tankBeauty(a: Pick<AquaState, "placed">): number {
  return a.placed.reduce((n, p) => {
    const x = decorOf(p.key);
    return n + (x ? decorBeauty(x) : 0);
  }, 0) + activeCombos(a.placed).length * COMBO_BEAUTY;
}
/** 지금 수조의 효과 — 화면과 정산이 같은 값을 본다 */
export function aquaEffects(a: Pick<AquaState, "placed" | "fish" | "tank"> & Partial<Pick<AquaState, "wide" | "alien">>) {
  const load = fishCount(a) / tankOf(a).fish;
  const beauty = tankBeauty(a);
  const beautyGrow = Math.min(BEAUTY_GROW_CAP, beauty / 2000);
  const combos = activeCombos(a.placed);
  const comboGrow = Math.min(COMBO_GROW_CAP, combos.length * COMBO_GROW);
  return {
    beauty,
    beautyGrow,
    combos,
    comboGrow,
    growMult: 1 + gearBest(a, "grow") + beautyGrow + comboGrow,
    hungerHours: HUNGER_HOURS * (1 + gearBest(a, "feed")),
    waterHours: WATER_HOURS * (1 - 0.3 * Math.min(1, load)) * (1 + gearBest(a, "clean")),
  };
}
/** 장비가 이미 더 좋은 게 있어서 사도 안 듣는가 — 놓여 있거나 보관함에 있는 같은 종류 장비 중 더 센 것 */
export function gearOutclassed(a: Pick<AquaState, "placed" | "bag">, key: string): string | null {
  const x = decorOf(key);
  if (!x?.effect) return null;
  const owned = [...a.placed.map((p) => p.key), ...Object.keys(a.bag).filter((k) => (a.bag[k] ?? 0) > 0)];
  const better = owned.map(decorOf).find((y) => y?.effect?.type === x.effect!.type && y.effect.amount > x.effect!.amount);
  return better ? better.name : null;
}

/** 정성 0~100 — 키운 시간 중 잘 돌본 비율 */
export const fishCare = (f: Pick<AquaFish, "goodH" | "totalH">) => (f.totalH <= 0 ? 100 : Math.round((Math.min(f.goodH, f.totalH) / f.totalH) * 100));
/** 정성에 따라 열리는 형태 수(아래부터) — 문턱은 CARE_MARKS */
export const CARE_MARKS = [60, 75, 90] as const;
export const openFinals = (cq: number) => (cq >= 90 ? 4 : cq >= 75 ? 3 : cq >= 60 ? 2 : 1);
/** n 번째 형태를 여는 정성(0 번째는 언제나) */
export const careToOpen = (i: number) => (i <= 0 ? 0 : CARE_MARKS[Math.min(CARE_MARKS.length, i) - 1]);
const WEIGHTS = [15, 20, 25, 40];

function hash(n: number, salt: string): number {
  let h = (2166136261 ^ n) >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** 최종 형태 고르기 — 정성이 연 형태 중 **못 만난 것 먼저**, 그 안에서 높은 형태일수록 잘 나온다. 결정적. */
export function pickFinal(fam: AquaFamily, cq: number, seen: readonly string[], seed: number): AquaSpecies {
  const open = fam.finals.map((sp, i) => ({ sp, w: WEIGHTS[i] })).slice(0, openFinals(cq));
  const fresh = open.filter((x) => !seen.includes(x.sp.key));
  const pool = fresh.length ? fresh : open;
  let r = hash(seed, fam.key) % pool.reduce((n, x) => n + x.w, 0);
  for (const x of pool) {
    if (r < x.w) return x.sp;
    r -= x.w;
  }
  return pool[pool.length - 1].sp;
}
/** 정성을 더 올리면 열리는 다음 형태(없으면 null) — 화면이 실루엣으로 보여 준다 */
export function nextForm(fam: AquaFamily, cq: number): { sp: AquaSpecies; care: number } | null {
  const i = openFinals(cq);
  return i < fam.finals.length ? { sp: fam.finals[i], care: careToOpen(i) } : null;
}

export type AquaEvolved = { id: number; family: string; stage: 1 | 2; species?: string };

const NEWS_MAX = 12;
function pushNews(a: AquaState, item: Omit<AquaNews, "n">): AquaState {
  const n = (a.newsN ?? 0) + 1;
  return { ...a, newsN: n, news: [...(a.news ?? []), { n, ...item }].slice(-NEWS_MAX) };
}
const addDex = (dex: readonly string[], key: string) => (dex.includes(key) ? [...dex] : [...dex, key]);

/** 짝이 있는 계열(다 큰 물고기 둘 이상) — 알을 낳을 수 있다 */
export function breedPairs(a: Pick<AquaState, "fish">): string[] {
  const n = new Map<string, number>();
  for (const f of a.fish) if (f.stage === 2) n.set(f.family, (n.get(f.family) ?? 0) + 1);
  return [...n].filter(([, c]) => c >= 2).map(([k]) => k).sort();
}

/** 사이의 정산 — 사건(모습이 바뀜 · 알) 없이 곧게 흐르는 구간. 지난 시간에 대해 선형이라 쪼개도 같다. */
function tickCore(input: AquaState, now: number, seen: readonly string[]): { a: AquaState; evolved: AquaEvolved[] } {
  const elapsed = (now - input.at) / HOUR;
  if (elapsed <= 0) return { a: input, evolved: [] };
  const fx = aquaEffects(input);
  const hr = 100 / fx.hungerHours, wr = 100 / fx.waterHours;
  // 성장하는 시간: 배가 안 비고 물이 MIN_WATER 위인 동안
  const growWin = Math.max(0, Math.min(elapsed, input.hunger / hr, (input.water - MIN_WATER) / wr));
  // 잘 돌본 시간: 배 · 물 모두 '좋음' 위인 동안. 배 · 물은 줄기만 하므로 좋은 시간은 언제나 구간의 앞쪽이다.
  const goodWin = Math.max(0, Math.min(elapsed, (input.hunger - GOOD_HUNGER) / hr, (input.water - GOOD_WATER) / wr));
  // 못 돌본 시간은 방치 구간마다 AWAY_CAP_H 까지만 — 이 구간 앞이 좋았으면 새 방치가 시작된 것이다.
  // ⚠ 예전엔 정산마다 48시간을 걸어서 같은 120시간을 한 번에 정산하면 정성 30, 6시간마다 정산하면 12 였다(자주 여는 사람이 손해).
  const badWin = elapsed - goodWin;
  const run0 = goodWin > 0 ? 0 : input.badH ?? 0;
  const badCounted = Math.min(badWin, Math.max(0, AWAY_CAP_H - run0));
  const badH = Math.min(AWAY_CAP_H, run0 + badWin);
  const evolved: AquaEvolved[] = [];
  let a: AquaState = { ...input };
  let dex = [...input.dex];
  const seenAll = (): string[] => [...dex, ...seen];
  const fish = input.fish.map((f): AquaFish => {
    if (f.stage === 2) return f;
    const fam = familyOf(f.family);
    if (!fam) return f;
    const fav = FAVORITE_DECOR[f.family] && input.placed.some((p) => p.key === FAVORITE_DECOR[f.family]) ? 1 + FAVORITE_CARE : 1;
    const n: AquaFish = { ...f, growH: f.growH + growWin * fx.growMult, goodH: f.goodH + goodWin * fav, totalH: f.totalH + goodWin + badCounted };
    if (n.stage === 0 && n.growH + EPS >= fam.hours * GROW_JUVENILE) {
      n.stage = 1;
      dex = addDex(dex, `juv_${fam.key}`);
      evolved.push({ id: n.id, family: n.family, stage: 1 });
    }
    if (n.stage === 1 && n.growH + EPS >= fam.hours) {
      const sp = pickFinal(fam, fishCare(n), seenAll(), n.id);
      n.stage = 2;
      n.species = sp.key;
      dex = addDex(dex, sp.key);
      const prev = evolved.find((e) => e.id === n.id);
      if (prev) { prev.stage = 2; prev.species = sp.key; } else evolved.push({ id: n.id, family: n.family, stage: 2, species: sp.key });
    }
    return n;
  });
  const pairs = breedPairs(input).length > 0;
  a = {
    ...a, at: now, hunger: Math.max(0, input.hunger - elapsed * hr), water: Math.max(0, input.water - elapsed * wr), fish, dex,
    ...(badH > 0 || input.badH !== undefined ? { badH } : {}),
    ...(pairs ? { breedH: Math.min(BREED_H, (input.breedH ?? 0) + goodWin) } : {}),
  };
  for (const e of evolved) a = pushNews(a, { id: e.id, family: e.family, stage: e.stage, ...(e.species ? { species: e.species } : {}) });
  return { a, evolved };
}

/** 구간 안에서 가장 먼저 오는 사건까지의 시간(시간) — 모습이 바뀌는 순간 · 알을 낳는 순간. 이 순간에서 정산을 나누면
 *  어디서 끊어 정산하든 같은 사건이 같은 때에 일어난다(정성 · 짝 · 치어가 사는 시간이 끊는 자리에 따라 갈리지 않는다). */
function nextEvent(a: AquaState, now: number): { h: number; egg: boolean } | null {
  const elapsed = (now - a.at) / HOUR;
  if (elapsed <= 0) return null;
  const fx = aquaEffects(a);
  const hr = 100 / fx.hungerHours, wr = 100 / fx.waterHours;
  const growWin = Math.max(0, Math.min(elapsed, a.hunger / hr, (a.water - MIN_WATER) / wr));
  const goodWin = Math.max(0, Math.min(elapsed, (a.hunger - GOOD_HUNGER) / hr, (a.water - GOOD_WATER) / wr));
  let best = Infinity, egg = false;
  for (const f of a.fish) {
    const fam = familyOf(f.family);
    if (!fam || f.stage === 2) continue;
    const thr = f.stage === 0 ? fam.hours * GROW_JUVENILE : fam.hours;
    if (f.growH + EPS >= thr) continue;
    const need = (thr - f.growH) / fx.growMult;
    if (need <= growWin && need < best) best = need;
  }
  if (breedPairs(a).length && fishRoom(a) > 0) {
    const need = Math.max(0, BREED_H - (a.breedH ?? 0));
    if (need <= goodWin && need < best) { best = need; egg = true; }
  }
  return best < elapsed ? { h: best, egg } : null;
}

/** 알 — 짝 중 하나를 결정적으로 고르고 치어 하나. 대물 쪽으로 조금 크게 태어난다(변이). */
function layEgg(a: AquaState): AquaState {
  const pairs = breedPairs(a);
  if (!pairs.length || fishRoom(a) <= 0 || (a.breedH ?? 0) + EPS < BREED_H) return a;
  const family = pairs[hash(a.eggN ?? 0, "egg") % pairs.length];
  const parents = a.fish.filter((f) => f.family === family && f.stage === 2);
  const base = FISH_BASE_CM[family] ?? 20;
  const avg = parents.reduce((n, f) => n + (f.adultCm ?? base), 0) / parents.length;
  const adultCm = Math.round(Math.min(base * 1.6, avg * 1.15) * 10) / 10;
  const fry: AquaFish = { id: a.nextId, family, stage: 0, growH: 0, goodH: 0, totalH: 0, adultCm, bred: true, caughtStage: 0, catchV: 0 };
  return pushNews({ ...a, nextId: a.nextId + 1, fish: [...a.fish, fry], dex: addDex(a.dex, `fry_${family}`), breedH: 0, eggN: (a.eggN ?? 0) + 1 }, { id: fry.id, family, stage: 0, egg: true });
}

/** 지연 정산 — 지난 시간만큼 배고픔 · 물 · 성장 · 정성 · 알을 굴린다. 순수 · 쪼개 정산해도 결과가 같다(aquarium.test).
 *  seen = 낚시로 만나 본 모습(못 만난 형태 먼저를 도감 · 낚시 기록을 합쳐 본다). */
export function tickAqua(input: AquaState, now: number, seen: readonly string[] = []): { a: AquaState; evolved: AquaEvolved[] } {
  // 상대 기기 시계가 앞서 저장한 시각 — 그대로 두면 그 시각까지 이 기기에선 아무것도 안 자란다(72시간 앞서면 72시간 동안). 지금으로 다시 잡는다.
  if (input.at > now + SKEW_MS) return { a: { ...input, at: now }, evolved: [] };
  let a = input;
  const evolved: AquaEvolved[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const ev = nextEvent(a, now);
    if (!ev) break;
    const r = tickCore(a, a.at + ev.h * HOUR, seen);
    evolved.push(...r.evolved);
    a = ev.egg ? layEgg(r.a) : r.a;
  }
  const r = tickCore(a, now, seen);
  evolved.push(...r.evolved);
  return { a: r.a, evolved };
}

/** 남은 성장 시간(지금 효과 기준, 잘 돌본다고 칠 때) */
export function hoursLeft(a: AquaState, f: AquaFish): number {
  const fam = familyOf(f.family);
  if (!fam || f.stage === 2) return 0;
  return Math.max(0, fam.hours - f.growH) / aquaEffects(a).growMult;
}
/** 자라는 중인가 — 멈췄으면 이유를 준다 */
export function growBlock(a: Pick<AquaState, "hunger" | "water">): string | null {
  if (a.hunger <= 0) return "배가 고파 성장이 멈췄어요";
  if (a.water <= MIN_WATER) return "물이 더러워 성장이 멈췄어요";
  return null;
}
/** 정성이 멈추기까지 남은 시간 — 포만이 GOOD_HUNGER · 물이 GOOD_WATER 아래로 내려가는 때 */
export function careHoursLeft(a: AquaState): { feed: number; clean: number } {
  const fx = aquaEffects(a);
  return { feed: Math.max(0, (a.hunger - GOOD_HUNGER) * fx.hungerHours / 100), clean: Math.max(0, (a.water - GOOD_WATER) * fx.waterHours / 100) };
}

export type AquaResult = { ok: true; state: Island; note?: string } | { ok: false; reason: string };

const put = (st: IslandState, a: AquaState, coins = st.coins, note?: string): AquaResult => ({ ok: true, state: stow(st, a, coins), ...(note ? { note } : {}) });

/** 정산 — 시간 · 그물 기한 · 오늘의 의뢰까지. 모든 동작이 이걸 먼저 부른다.
 *  dirty = 저장해야 할 변화(자람 · 알 · 그물 판매 · 새 의뢰 · 시계 보정)가 있나 — 화면이 보기만 하다가도 한 번 저장한다. */
export function syncAqua(st: IslandState, now: number): { state: Island; a: AquaState; evolved: AquaEvolved[]; dirty: boolean; netSold: number; netCoins: number } {
  const a0 = aquaOf(st as Island, now);
  const skew = a0.at > now + SKEW_MS;
  const eggs0 = a0.eggN ?? 0;
  const t = tickAqua(a0, now, st.fishing?.seen ?? []);
  let a = t.a;
  // 그물에서 기한이 지난 물고기는 잡을 때 값에 팔린다 — 누가 언제 열든 같은 값이다
  let netCoins = 0, netSold = 0;
  if (a.net?.length) {
    const keep: NetFish[] = [];
    for (const n of a.net) if (now - n.at >= NET_HOURS * HOUR) { netCoins += n.value; netSold++; } else keep.push(n);
    if (netSold) a = { ...a, net: keep };
  }
  const day = kstDate(now);
  let fresh = false;
  // 손님은 오늘이 지난 손님의 날보다 뒤일 때만 새로 온다 — 날짜를 되돌려 손님을 다시 부르지 못하게(2026-11-11 리뷰)
  if ((!a.req || day > a.req.day) && (a.fish.length || a.dex.length)) {
    a = { ...a, req: makeRequest(a, day, (st as { seed?: number }).seed ?? 0) };
    fresh = true;
  }
  const dirty = t.evolved.length > 0 || (a.eggN ?? 0) !== eggs0 || netSold > 0 || fresh || skew;
  return { state: stow(st, a, st.coins + netCoins), a, evolved: t.evolved, dirty, netSold, netCoins };
}
const begin = (st: IslandState, now: number) => {
  const s = syncAqua(st, now);
  return { s: s.state, a: s.a };
};

export const fryLockReason = (a: Pick<AquaState, "tank">, fam: AquaFamily, grade?: Grade): string | null =>
  a.tank < fam.minTank && !(grade && GRADES.indexOf(grade) >= RARE_ANY_TANK) ? `${TANKS[fam.minTank - 1].name}부터 키울 수 있어요` : null;
export const TANK_FULL_REASON = "수조가 가득 찼어요";
/** 수조에 담을 수 없는 이유 — 낚시 · 그물 · 알이 같은 판정을 쓴다. 주인과 전설 이상은 수조 단계를 안 본다. */
export function storeReason(a: AquaState, family: string, opt: { grade?: Grade; crown?: boolean } = {}): string | null {
  const fam = familyOf(family);
  if (!fam) return "없는 물고기예요";
  const lock = opt.crown ? null : fryLockReason(a, fam, opt.grade);
  if (lock) return lock;
  if (fishRoom(a) <= 0) return TANK_FULL_REASON;
  return null;
}

/** 낚시로 잡은 물고기를 수조에 넣는다(2026-11-02 — [사용자: "낚시에 성공한 물고기들만 수조에 보관"]). 치어 가게는 없어졌다.
 *  자리 · 수조 크기 판정은 부르는 쪽(lib/fishing 의 storeBlock)이 먼저 한다. 어린 물고기는 그만큼 자란 채로, 다 큰 물고기는 도감에 바로 오른다.
 *  catchV = 그 자리에서 팔았으면 받았을 하트(보내 주기의 기준). 빠지면 그 모습의 판매가로 어림한다. */
export function addFish(st: IslandState, key: string, stage: 0 | 1 | 2, species: string | undefined, now: number, crown?: string, cm?: number, catchV?: number): Island {
  const fam = familyOf(key);
  if (!fam) return st;
  const { s, a } = begin(st, now);
  const first = fishCount(a) === 0;
  const growH = stage === 0 ? 0 : stage === 1 ? fam.hours * GROW_JUVENILE : fam.hours;
  const sp = stage === 2 ? speciesOf(species) : undefined;
  const value = catchV ?? saleValue(GRADES.indexOf((sp ?? fam.finals[0]).grade) + stage * 0.5);
  const form = stage === 2 && species ? species : `${stage === 0 ? "fry" : "juv"}_${key}`;
  return stow(s, {
    ...a,
    // 빈 수조에 첫 물고기가 들어오면 새 물로 시작한다(비어 있던 동안 더러워진 물로 벌받지 않게)
    ...(first ? { hunger: 100, water: 100, badH: 0 } : {}),
    nextId: a.nextId + 1,
    dex: addDex(a.dex, form),
    fish: [...a.fish, { id: a.nextId, family: key, stage, ...(stage === 2 && species ? { species } : {}), ...(crown ? { crown } : {}), ...(cm ? { adultCm: Math.round((cm / FISH_STAGE_SIZE[stage]) * 10) / 10 } : {}), growH, goodH: 0, totalH: 0, caughtStage: stage, catchV: Math.max(0, Math.round(value)) }],
  });
}

/* ── 돌보기 ─────────────────────────────────────────── */

/** 둘이 같은 날(KST) 돌보면 자라는 물고기마다 잘 돌본 시간 +DUO_CARE_H(하루 한 번) — 혼자 하는 섬은 사람이 하나라 늘 그대로다 */
export const DUO_CARE_H = 4;
function careBy(a: AquaState, who: string | undefined, now: number): { a: AquaState; duo: boolean } {
  if (!who) return { a, duo: false };
  const day = kstDate(now);
  const care = Object.fromEntries(Object.entries({ ...(a.care ?? {}), [who]: day }).filter(([, d]) => d === day));
  const duo = Object.keys(care).length >= 2 && (!a.duoDay || day > a.duoDay);
  if (!duo) return { a: { ...a, care }, duo: false };
  return { a: { ...a, care, duoDay: day, fish: a.fish.map((f) => (f.stage === 2 || !familyOf(f.family) ? f : { ...f, goodH: f.goodH + DUO_CARE_H })) }, duo: true };
}

/** 먹이 — 기본 사료는 늘 있다. 나머지는 쓰레기 수집함의 분리수거 쿠폰(건진 쓰레기 수)으로 바꾼다. 수집함 숫자는 그대로다(목표가 그걸 센다).
 *  좋아하는 먹이를 주면 그 계열이 잘 돌본 시간 +FOOD_CARE_H · 성장 +FOOD_GROW(다음 모습 직전까지만). */
export type AquaFood = { key: string; name: string; cost: number; desc: string };
export const FOODS: readonly AquaFood[] = [
  { key: "flake", name: "기본 사료", cost: 0, desc: "언제나 있어요" },
  { key: "plankton", name: "플랑크톤 가루", cost: 2, desc: "작은 물고기 · 걸러 먹는 물고기가 좋아해요" },
  { key: "shrimp", name: "새우 알갱이", cost: 3, desc: "사냥하는 물고기가 좋아해요" },
  { key: "kelp", name: "해초 젤리", cost: 3, desc: "풀을 뜯는 물고기가 좋아해요" },
  { key: "star", name: "별빛 먹이", cost: 8, desc: "누구나 좋아해요" },
];
export const FOOD_BATCH = 3;
export const FOOD_CARE_H = 3;
export const FOOD_GROW = 0.02;
export const foodOf = (key: string) => FOODS.find((x) => x.key === key);
const PLANKTON = new Set(["guppy", "tetra", "smelt", "pale_chub", "chinese_minnow", "sweetfish", "jellyfish", "whale_shark", "manta", "megamouth", "starfish"]);
const KELP = new Set(["goldfish", "koi", "crucian", "common_carp", "discus", "angel", "puffer", "sea_turtle", "rising", "sailfin_sandfish", "barred_knifejaw"]);
/** 이 계열이 좋아하는 먹이(별빛은 누구나) */
export const likedFood = (family: string): string => (PLANKTON.has(family) ? "plankton" : KELP.has(family) ? "kelp" : "shrimp");
export const likesFood = (family: string, food: string) => food === "star" || (food !== "flake" && likedFood(family) === food);
/** 먹이로 바꿀 수 있는 쿠폰 — 건진 쓰레기 수 − 이미 바꾼 수 */
export function junkCoupons(st: Pick<IslandState, "fishing">, a: Pick<AquaState, "junkUsed">): number {
  const total = Object.values(st.fishing?.junk ?? {}).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0);
  return Math.max(0, total - (a.junkUsed ?? 0));
}
export function makeFood(st: IslandState, key: string, now: number): AquaResult {
  const x = foodOf(key);
  if (!x || x.cost <= 0) return { ok: false, reason: "만들 수 없는 먹이예요" };
  const { s, a } = begin(st, now);
  const have = junkCoupons(st, a);
  if (have < x.cost) return { ok: false, reason: `분리수거 쿠폰이 ${x.cost - have}장 모자라요 — 낚시에서 쓰레기를 건지면 생겨요` };
  return put(s, { ...a, junkUsed: (a.junkUsed ?? 0) + x.cost, food: { ...a.food, [key]: (a.food?.[key] ?? 0) + FOOD_BATCH } }, s.coins, `${x.name} ${FOOD_BATCH}번치를 만들었어요`);
}

export function feedFish(st: IslandState, now: number, opt: { food?: string; who?: string } = {}): AquaResult {
  const { s, a: a0 } = begin(st, now);
  if (!a0.fish.length) return { ok: false, reason: "아직 물고기가 없어요" };
  if (a0.hunger >= 90) return { ok: false, reason: "아직 배불러요 — 포만이 90 밑으로 내려가면 줄 수 있어요" };
  const food = opt.food && opt.food !== "flake" ? foodOf(opt.food) : undefined;
  if (opt.food && opt.food !== "flake" && (!food || (a0.food?.[opt.food] ?? 0) <= 0)) return { ok: false, reason: "그 먹이가 떨어졌어요" };
  let a: AquaState = { ...a0, hunger: 100 };
  let liked = 0;
  if (food) {
    const left = (a.food?.[food.key] ?? 0) - 1;
    const rest = { ...a.food, [food.key]: left };
    if (left <= 0) delete rest[food.key];
    a = {
      ...a, food: rest,
      fish: a.fish.map((f) => {
        const fam = familyOf(f.family);
        if (!fam || f.stage === 2 || !likesFood(f.family, food.key)) return f;
        liked++;
        // 다음 모습 바로 앞까지만 당긴다 — 모습은 정산(tickAqua)에서만 바뀌어야 쪼개 정산해도 같다
        const thr = f.stage === 0 ? fam.hours * GROW_JUVENILE : fam.hours;
        return { ...f, goodH: f.goodH + FOOD_CARE_H, growH: Math.max(f.growH, Math.min(thr - 0.01, f.growH + fam.hours * FOOD_GROW)) };
      }),
    };
  }
  const c = careBy(a, opt.who, now);
  const hours = Math.round(aquaEffects(c.a).hungerHours * (100 - GOOD_HUNGER) / 100);
  const note = `냠냠 — ${hours}시간 든든해요${food ? liked ? ` · ${liked}마리가 좋아하는 먹이예요` : " · 좋아하는 물고기가 없었어요" : ""}${c.duo ? ` · 둘이 함께 돌봐서 정성이 올랐어요` : ""}`;
  return put(s, c.a, s.coins, note);
}

export function cleanWater(st: IslandState, now: number, opt: { who?: string } = {}): AquaResult {
  const { s, a } = begin(st, now);
  if (a.water >= 90) return { ok: false, reason: "물이 아직 깨끗해요 — 90 밑으로 내려가면 갈 수 있어요" };
  const price = waterPrice(a.tank);
  if (s.coins < price) return { ok: false, reason: `물을 갈려면 하트가 ${price}개 필요해요` };
  const c = careBy({ ...a, water: 100 }, opt.who, now);
  const hours = Math.round(aquaEffects(c.a).waterHours * (100 - GOOD_WATER) / 100);
  return put(s, c.a, s.coins - price, `물을 갈았어요(하트 ${price}개) — ${hours}시간 맑아요${c.duo ? " · 둘이 함께 돌봐서 정성이 올랐어요" : ""}`);
}

export function upgradeTank(st: IslandState, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const next = TANKS[a.tank];
  if (!next) return { ok: false, reason: "가장 큰 수조예요" };
  const gate = tankGate(s, a, a.tank + 1);
  if (!gate.ok) return { ok: false, reason: `${next.name}은 ${gate.items.filter((x) => x.have < x.need).map((x) => `${x.label} ${x.need}`).join(" · ")}부터 열려요` };
  if (s.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - s.coins).toLocaleString()}개 모자라요` };
  const cur = tankOf(a), after = tankOf({ ...a, tank: a.tank + 1 });
  return put(s, { ...a, tank: a.tank + 1 }, s.coins - next.price, `수조를 넓혔어요 — ${next.name} · 물고기 ${cur.fish}→${after.fish}칸 · 장식 ${cur.decor}→${after.decor}칸`);
}

export function widenTank(st: IslandState, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const next = WIDE_STEPS[a.wide ?? 0];
  if (!next) return { ok: false, reason: "더 늘릴 수 없어요" };
  if (s.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - s.coins).toLocaleString()}개 모자라요` };
  return put(s, { ...a, wide: (a.wide ?? 0) + 1 }, s.coins - next.price, `어항을 옆으로 늘렸어요 — 물고기 +${next.fish} · 장식 +${next.decor}`);
}

export function buyDecor(st: IslandState, key: string, now: number): AquaResult {
  const x = decorOf(key);
  if (!x) return { ok: false, reason: "없는 악세사리예요" };
  const { s, a } = begin(st, now);
  if (s.coins < x.price) return { ok: false, reason: `하트가 ${(x.price - s.coins).toLocaleString()}개 모자라요` };
  return put(s, { ...a, bag: { ...a.bag, [key]: (a.bag[key] ?? 0) + 1 } }, s.coins - x.price, `${x.name} — 보관함에 넣었어요`);
}

const clampX = (v: number) => Math.min(94, Math.max(6, Math.round(v * 10) / 10));
const clampY = (v: number) => Math.min(94, Math.max(14, Math.round(v * 10) / 10));

/** 배치가 바뀐 뒤 — 처음 만든 조합이면 도감에 남기고 하트 조금 */
function afterLayout(s: IslandState, a: AquaState, base: string): AquaResult {
  const found = activeCombos(a.placed).filter((id) => !(a.combos ?? []).includes(id));
  if (!found.length) return put(s, a, s.coins, base);
  const names = found.map((id) => AQUA_COMBOS.find((c) => c.id === id)?.name).join(" · ");
  return put(s, { ...a, combos: [...(a.combos ?? []), ...found] }, s.coins + found.length * COMBO_FIRST_COINS, `${base} · 새 조합 ${names}! 하트 +${found.length * COMBO_FIRST_COINS}`);
}

/** 보관함에서 꺼내 놓기. 정산을 먼저 해서 '놓기 전' 시간에 새 효과가 소급되지 않게 한다. */
export function placeDecor(st: IslandState, key: string, x: number, y: number, now: number, pose?: Partial<DecorPose>): AquaResult {
  const { s, a } = begin(st, now);
  if ((a.bag[key] ?? 0) <= 0) return { ok: false, reason: "보관함에 없어요" };
  if (a.placed.length + (a.alien?.placed.length ?? 0) >= tankOf(a).decor) return { ok: false, reason: "더 놓을 자리가 없어요 — 수조를 넓혀 주세요" };
  const bag = { ...a.bag, [key]: a.bag[key] - 1 };
  if (bag[key] <= 0) delete bag[key];
  return afterLayout(s, { ...a, bag, nextId: a.nextId + 1, placed: [...a.placed, { id: a.nextId, key, x: clampX(x), y: clampY(y), ...(pose ? decorPose(pose) : {}) }] }, `${josa(decorOf(key)?.name ?? "장식", "을/를")} 놓았어요`);
}
export function moveDecor(st: IslandState, id: number, x: number, y: number, now: number, pose?: Partial<DecorPose>): AquaResult {
  const { s, a } = begin(st, now);
  if (!a.placed.some((p) => p.id === id)) return { ok: false, reason: "이미 치운 악세사리예요" };
  return afterLayout(s, { ...a, placed: a.placed.map((p) => (p.id === id ? { ...p, x: clampX(x), y: clampY(y), ...(pose ? decorPose({ ...p, ...pose }) : {}) } : p)) }, "자리를 옮겼어요");
}
export function storeDecor(st: IslandState, id: number, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const p = a.placed.find((q) => q.id === id);
  if (!p) return { ok: false, reason: "이미 치운 악세사리예요" };
  return put(s, { ...a, placed: a.placed.filter((q) => q.id !== id), bag: { ...a.bag, [p.key]: (a.bag[p.key] ?? 0) + 1 } }, s.coins, `${decorOf(p.key)?.name ?? "장식"} — 보관함으로 옮겼어요`);
}

/* ── 보내 주기(2026-11-05 다시 짬) ─────────────────────────
 * 예전 보상(24 · 1.7^등급)은 다 큰 물고기를 그 자리에서 파는 값(15 · 1.6^(등급+1))보다 커서 '잡아서 담고 바로 보내기'가 팔기보다 나았다
 * (영웅 157 → 200, 전설 252 → 341, 태초 644 → 985). 지금은:
 *   보상 = 잡은 값 V0 + (다 큰 값 V1 − V0) × RAISE_SHARE × 수조에서 자란 몫(0~1)
 *  · 바로 보내면 V0 — 그 자리에서 판 것과 같다(담기에 실패할 위험만큼 손해라 이득이 없다).
 *  · 다 키워도 V1 의 80% 언저리 — 다 큰 놈을 잡아 판 값보다 적다. 키우는 데 든 며칠은 도감 · 정성 · 알이 보상이다.
 *  · 알에서 난 물고기는 V0 = 0. 알은 수조 하나에 3일에 많아야 하나다. */
const growStart = (fam: AquaFamily, stage: 0 | 1 | 2) => (stage === 0 ? 0 : stage === 1 ? fam.hours * GROW_JUVENILE : fam.hours);
/** 수조에서 자란 몫 0~1 — 잡을 때 모습부터 다 클 때까지 중 수조에서 지난 비율 */
export function raisedShare(f: Pick<AquaFish, "family" | "growH" | "caughtStage">): number {
  const fam = familyOf(f.family);
  if (!fam) return 0;
  const start = growStart(fam, f.caughtStage ?? 0);
  if (start >= fam.hours) return 0;
  return Math.max(0, Math.min(1, (f.growH - start) / (fam.hours - start)));
}
/** 다 컸을 때의 난이도(등급 + 1) — 품종이 정해졌으면 그 등급, 아니면 계열의 첫 형태 */
export function adultDifficulty(f: Pick<AquaFish, "family" | "species">): number {
  const fam = familyOf(f.family);
  return GRADES.indexOf((speciesOf(f.species) ?? fam?.finals[0] ?? { grade: GRADES[0] }).grade) + 1;
}
export function releaseReward(f: Pick<AquaFish, "family" | "stage" | "species" | "growH" | "caughtStage" | "catchV" | "bred">): number {
  const fam = familyOf(f.family);
  if (!fam) return 0;
  const cs = f.caughtStage ?? 0;
  const v0 = f.bred ? 0 : f.catchV ?? saleValue(GRADES.indexOf(fam.finals[0].grade) + cs * 0.5);
  const v1 = saleValue(adultDifficulty(f));
  return Math.max(0, Math.round(v0 + Math.max(0, v1 - v0) * RAISE_SHARE * raisedShare(f)));
}
export function releaseFish(st: IslandState, id: number, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const f = a.fish.find((q) => q.id === id);
  if (!f) return { ok: false, reason: "이미 떠난 물고기예요" };
  const reward = releaseReward(f);
  return put(s, { ...a, fish: a.fish.filter((q) => q.id !== id), released: { ...a.released, [f.family]: (a.released?.[f.family] ?? 0) + 1 } }, s.coins + reward, `${josa(fishName(f), "을/를")} 바다로 보내 줬어요${reward ? ` — 하트 +${reward.toLocaleString()}` : ""}`);
}

/* ── 대기 그물(2026-11-05) ─────────────────────────────
 * 하루 45마리쯤 끌어올리는데 수조를 떠나는 다 큰 물고기는 하루 2~4마리라 잡은 물고기 90% 넘게가 '가득 찼어요 → 팔기'였다.
 * 가득 찼을 때 NET_MAX 마리를 NET_HOURS 동안 붙잡아 두고 나중에 수조로 옮기거나 판다. 지나면 다음 정산에서 잡을 때 값에 저절로 팔린다. */
export function keepInNet(st: IslandState, fish: Omit<NetFish, "at">, now: number): AquaResult {
  const { s, a } = begin(st, now);
  if ((a.net?.length ?? 0) >= NET_MAX) return { ok: false, reason: `대기 그물이 가득 찼어요(${NET_MAX}마리)` };
  return put(s, { ...a, net: [...(a.net ?? []), { ...fish, value: Math.max(0, Math.round(fish.value)), at: now }] }, s.coins, `대기 그물에 두었어요 — ${NET_HOURS}시간 안에 수조로 옮겨 주세요`);
}
export function netToTank(st: IslandState, index: number, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const n = a.net?.[index];
  if (!n) return { ok: false, reason: "이미 그물에 없어요" };
  const fam = familyOf(n.family);
  const grade = speciesOf(n.species)?.grade ?? fam?.finals[0].grade;
  const why = storeReason(a, n.family, { grade, crown: !!n.crown });
  if (why) return { ok: false, reason: why === TANK_FULL_REASON ? "수조가 가득 찼어요 — 한 마리를 보내 주면 옮길 수 있어요" : why };
  const rest = (a.net ?? []).filter((_, i) => i !== index);
  const moved = addFish(stow(s, { ...a, net: rest }), n.family, n.stage, n.species, now, n.crown, n.cm, n.value);
  return { ok: true, state: moved, note: `${josa(fishName(n), "을/를")} 수조로 옮겼어요` };
}
export function sellNet(st: IslandState, index: number, now: number): AquaResult {
  const { s, a } = begin(st, now);
  const n = a.net?.[index];
  if (!n) return { ok: false, reason: "이미 그물에 없어요" };
  return put(s, { ...a, net: (a.net ?? []).filter((_, i) => i !== index) }, s.coins + n.value, `${josa(fishName(n), "을/를")} 팔았어요 — 하트 +${n.value.toLocaleString()}`);
}
export const netHoursLeft = (n: Pick<NetFish, "at">, now: number) => Math.max(0, NET_HOURS - (now - n.at) / HOUR);

/* ── 성장 소식(2026-11-05) ─────────────────────────────
 * 자란 걸 처음 정산한 기기만 '최종 형태!' 카드를 봤고, 낚시하다 자라면 아무도 못 봤다. 소식을 저장하고 사람마다 본 번호를 남긴다. */
export const unseenNews = (a: Pick<AquaState, "news" | "newsSeen">, who: string) => (a.news ?? []).filter((x) => x.n > (a.newsSeen?.[who] ?? 0));
export function seeNews(st: IslandState, who: string, upTo: number, now: number): AquaResult {
  const { s, a } = begin(st, now);
  return put(s, { ...a, newsSeen: { ...a.newsSeen, [who]: Math.max(a.newsSeen?.[who] ?? 0, upTo) } });
}

/* ── 수조 → 낚시 버프(2026-11-05) ───────────────────────
 * 다 큰 계열 하나에 행운 +1, 다섯까지. 낚시 밸런스(fishingbalance.test)는 맨 능력치로 재므로 이 작은 덤은 체감용이다. */
export const AQUA_LUCK_MAX = 5;
export function aquaLuck(a: Pick<AquaState, "fish">): number {
  return Math.min(AQUA_LUCK_MAX, new Set(a.fish.filter((f) => f.stage === 2).map((f) => f.family)).size);
}

/* ── 오늘의 손님(2026-11-05) ───────────────────────────
 * 하루 한 번 손님이 부탁한다. 날짜 + 섬 시드 + 그때의 수조로 정하고, 그날 처음 본 기기가 저장한다(두 기기가 같은 부탁을 본다). */
export function makeRequest(a: AquaState, day: string, seed: number): AquaReq {
  const h = hash(seed >>> 0, day);
  const families = [...new Set(a.fish.map((f) => f.family))].sort();
  const owned = Object.keys(a.bag).filter((k) => (a.bag[k] ?? 0) > 0 && !decorOf(k)?.effect).sort();
  const cheap = DECOR.filter((x) => !x.effect && x.price <= 1500).map((x) => x.key);
  const kinds: AquaReqKind[] = families.length ? ["adult", "decor", "beauty"] : ["decor", "beauty"];
  const kind = kinds[h % kinds.length];
  if (kind === "adult") {
    const family = families[(h >>> 4) % families.length];
    const g = GRADES.indexOf(familyOf(family)?.finals[0].grade ?? GRADES[0]);
    return { day, kind, key: family, reward: 40 + g * 15 };
  }
  if (kind === "decor") {
    const list = owned.length ? owned : cheap;
    return { day, kind, key: list[(h >>> 4) % list.length], reward: 30 };
  }
  return { day, kind, key: "beauty", n: Math.ceil((tankBeauty(a) + 20) / 10) * 10, reward: 35 };
}
export function requestMet(a: AquaState): boolean {
  const r = a.req;
  if (!r) return false;
  if (r.kind === "adult") return a.fish.some((f) => f.family === r.key && f.stage === 2);
  if (r.kind === "decor") return a.placed.some((p) => p.key === r.key);
  return tankBeauty(a) >= (r.n ?? 0);
}
export function requestText(r: AquaReq): string {
  if (r.kind === "adult") return `다 큰 ${josa(familyOf(r.key)?.name ?? "물고기", "을/를")} 보고 싶어요`;
  if (r.kind === "decor") return `${josa(decorOf(r.key)?.name ?? "장식", "을/를")} 수조에 놓아 주세요`;
  return `아름다움 ${r.n}을 넘는 수조를 보고 싶어요`;
}
export function claimRequest(st: IslandState, now: number): AquaResult {
  const { s, a } = begin(st, now);
  if (!a.req || a.req.day < kstDate(now)) return { ok: false, reason: "오늘은 손님이 없어요" };
  if (a.req.done) return { ok: false, reason: "오늘 손님은 이미 다녀갔어요" };
  if (!requestMet(a)) return { ok: false, reason: "아직 부탁을 들어주지 못했어요" };
  return put(s, { ...a, req: { ...a.req, done: true } }, s.coins + a.req.reward, `손님이 기뻐해요 — 하트 +${a.req.reward}`);
}
