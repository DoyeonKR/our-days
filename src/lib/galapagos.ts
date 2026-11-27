/** 갈라파고스 제도(2026-11-27) — 최상위 낚시터(Lv.40) 및 50종(해양 포유류 · 파충류 · 조류 · 상어 · 가오리 · 외양 대형어 · 산호초 고유종 · 무척추동물).
 *  각 종은 기준 이미지(public/aqua/fish) · 3D GLB 모델(public/aqua/models/fish) · 고유 습성(FishHabit) · 해부학(Anatomy)을 모두 갖춘다. */
import type { FishHabit } from "./aqua3d/habits.ts";
import type { Anatomy } from "./aqua3d/anatomy.ts";
import type { StagedFamily } from "./shrimp.ts";

export type GalapagosTimed = {
  species: string;
  time?: "day" | "dusk" | "night";
  wx?: "clear" | "rain" | "snow";
  always?: true;
  rare?: number;
};

export type GalapagosSpecies = StagedFamily & {
  /** 낚시터 풀 무게(0 이면 때 손님 전용) */
  poolWeight: number;
  /** 때 손님 설정(전설 · 신화 · 태초 대형종) */
  timed?: Omit<GalapagosTimed, "species">;
  /** 3D 해부학 덮어쓰기 */
  anatomy: Partial<Anatomy>;
};

const crawl = (more: Partial<FishHabit>): FishHabit => ({
  lo: -5, hi: -3.5, speed: 0.055, reach: 0.65, depth: 1.3, hug: 0.1, tilt: 0, rest: 0.6, hop: 0.65, dart: 0.15, pace: 1.1, idle: 0.45, ...more,
});
const reefSwim = (more: Partial<FishHabit>): FishHabit => ({
  lo: -2.4, hi: 2.2, speed: 0.22, reach: 0.85, depth: 1.5, rest: 0.25, dart: 0.3, pace: 1.15, tilt: 0.28, ...more,
});
const pelagic = (more: Partial<FishHabit>): FishHabit => ({
  lo: -1.4, hi: 2.8, speed: 0.38, reach: 1, depth: 1.9, dart: 0.25, pace: 1.25, tilt: 0.25, ...more,
});
const sharkSwim = (more: Partial<FishHabit>): FishHabit => ({
  lo: -2.2, hi: 2.2, speed: 0.26, reach: 1, depth: 1.9, pace: 0.8, tilt: 0.2, ...more,
});
const rayGlide = (more: Partial<FishHabit>): FishHabit => ({
  lo: -3.4, hi: 1.8, speed: 0.19, reach: 0.95, depth: 1.8, pace: 0.72, tilt: 0.22, bob: 0.08, ...more,
});
const mammalSwim = (more: Partial<FishHabit>): FishHabit => ({
  lo: -1.6, hi: 2.5, speed: 0.26, reach: 1, depth: 2, breathe: 65, breathOnly: true, pace: 0.75, tilt: 0.32, ...more,
});

export const GALAPAGOS_FAMILIES: readonly GalapagosSpecies[] = [
  /* ── 희귀 16종 (koi 15000/168 ~ croaker 18000/180 사이 단조 증가) ── */
  { key: "galapagos_damselfish", name: "갈라파고스 자리돔", grade: "희귀", price: 15150, hours: 168.6, minTank: 2, size: 14, cm: 16, fresh: false, ornamental: false, spots: [], poolWeight: 4.2,
    habit: reefSwim({ school: true, speed: 0.25, rest: 0.2 }), anatomy: { frequency: 5.4, flex: 0.11 } },
  { key: "mandarinfish", name: "만다린 피쉬", grade: "희귀", price: 15300, hours: 169.2, minTank: 2, size: 12, cm: 8, fresh: false, ornamental: true, spots: [], poolWeight: 3.4,
    habit: reefSwim({ lo: -2.4, hi: 0.4, speed: 0.11, rest: 0.4, dart: 0.08 }), anatomy: { frequency: 4.4, flex: 0.12 } },
  { key: "sally_lightfoot_crab", name: "샐리 라이트풋 게", grade: "희귀", price: 15450, hours: 169.8, minTank: 2, size: 16, cm: 15, fresh: false, ornamental: false, spots: [], poolWeight: 3.6,
    habit: crawl({ speed: 0.06, rest: 0.55, dart: 0.25, hug: 0.06, lane: 0.48 }), anatomy: { frequency: 2.8, flex: 0.06 } },
  { key: "moorish_idol", name: "깃대돔", grade: "희귀", price: 15600, hours: 170.4, minTank: 2, size: 18, cm: 22, fresh: false, ornamental: true, spots: [], poolWeight: 3.8,
    habit: reefSwim({ school: true, speed: 0.2, rest: 0.3, tilt: 0.32 }), anatomy: { frequency: 3.9, flex: 0.1 } },
  { key: "picasso_triggerfish", name: "피카소 쥐치", grade: "희귀", price: 15750, hours: 171.0, minTank: 2, size: 19, cm: 28, fresh: false, ornamental: true, spots: [], poolWeight: 3.4,
    habit: reefSwim({ speed: 0.17, rest: 0.38, dart: 0.35 }), anatomy: { frequency: 3.6, flex: 0.09 } },
  { key: "king_angelfish", name: "킹 엔젤피쉬", grade: "희귀", price: 15900, hours: 171.6, minTank: 2, size: 21, cm: 35, fresh: false, ornamental: true, spots: [], poolWeight: 3.6,
    habit: reefSwim({ school: true, speed: 0.19, rest: 0.28 }), anatomy: { frequency: 3.5, flex: 0.09 } },
  { key: "spanish_hogfish", name: "스패니시 호그피쉬", grade: "희귀", price: 16050, hours: 172.2, minTank: 2, size: 21, cm: 38, fresh: false, ornamental: false, spots: [], poolWeight: 3.2,
    habit: reefSwim({ speed: 0.23, rest: 0.2, dart: 0.35 }), anatomy: { frequency: 4.1, flex: 0.1 } },
  { key: "garden_eel", name: "정원장어", grade: "희귀", price: 16200, hours: 172.8, minTank: 2, size: 18, cm: 40, fresh: false, ornamental: false, spots: [], poolWeight: 3.0,
    habit: crawl({ lo: -5, hi: -3.2, speed: 0.08, hug: 0.14, rest: 0.65, school: true, lane: 0.56 }), anatomy: { frequency: 2.8, flex: 0.2 } },
  { key: "porcupinefish", name: "가시복", grade: "희귀", price: 16350, hours: 173.4, minTank: 2, size: 23, cm: 60, fresh: false, ornamental: false, spots: [], poolWeight: 3.0,
    habit: reefSwim({ speed: 0.14, rest: 0.45, dart: 0.12, bob: 0.08 }), anatomy: { frequency: 2.9, flex: 0.08 } },
  { key: "spotted_trumpetfish", name: "점박이 트럼펫피쉬", grade: "희귀", price: 16500, hours: 174.0, minTank: 3, size: 24, cm: 75, fresh: false, ornamental: false, spots: [], poolWeight: 2.8,
    habit: reefSwim({ speed: 0.13, rest: 0.5, tilt: 0.45, dart: 0.45 }), anatomy: { frequency: 3.0, flex: 0.14 } },
  { key: "red_snapper", name: "붉은도미", grade: "희귀", price: 16650, hours: 174.6, minTank: 3, size: 24, cm: 75, fresh: false, ornamental: false, spots: [], poolWeight: 3.2,
    habit: pelagic({ lo: -2.2, hi: 1.6, speed: 0.27, school: true }), anatomy: { frequency: 4.1, flex: 0.09 } },
  { key: "skipjack_tuna", name: "가다랑어", grade: "희귀", price: 16800, hours: 175.2, minTank: 3, size: 26, cm: 85, fresh: false, ornamental: false, spots: [], poolWeight: 3.0,
    habit: pelagic({ school: true, speed: 0.42, pace: 1.35 }), anatomy: { frequency: 6.4, flex: 0.06 } },
  { key: "amberjack", name: "잿방어", grade: "희귀", price: 16950, hours: 175.8, minTank: 3, size: 28, cm: 130, fresh: false, ornamental: false, spots: [], poolWeight: 2.8,
    habit: pelagic({ speed: 0.34, school: true }), anatomy: { frequency: 5.0, flex: 0.07 } },
  { key: "marble_ray", name: "대리석가오리", grade: "희귀", price: 17100, hours: 176.4, minTank: 3, size: 30, cm: 150, fresh: false, ornamental: false, spots: [], poolWeight: 2.4,
    habit: rayGlide({ lo: -5, hi: -2.8, hug: 0.14, rest: 0.5, speed: 0.14, lane: 0.64 }), anatomy: { kind: "ray", frequency: 2.2, flex: 0.11 } },
  { key: "blacktip_reef_shark", name: "블랙팁 리프샤크", grade: "희귀", price: 17250, hours: 177.0, minTank: 3, size: 31, cm: 160, fresh: false, ornamental: false, spots: [], poolWeight: 2.4,
    habit: sharkSwim({ lo: -1.4, hi: 2.6, speed: 0.31, dart: 0.3 }), anatomy: { frequency: 3.3, flex: 0.065 } },
  { key: "whitetip_reef_shark", name: "화이트팁 리프샤크", grade: "희귀", price: 17400, hours: 177.6, minTank: 3, size: 32, cm: 170, fresh: false, ornamental: false, spots: [], poolWeight: 2.4,
    habit: sharkSwim({ lo: -4.4, hi: -1.2, hug: 0.2, rest: 0.45, speed: 0.2, lane: 0.72 }), anatomy: { frequency: 3.0, flex: 0.075 } },

  /* ── 영웅 18종 (4개 기존 영웅 구간에 단조 배치) ── */
  // 구간 A: gulper_eel(26000/213) ~ striped_jack(28000/220)
  { key: "pygmy_seahorse", name: "피그미 해마", grade: "영웅", price: 26200, hours: 213.8, minTank: 3, size: 12, cm: 4, fresh: false, ornamental: true, spots: [], poolWeight: 1.8,
    habit: reefSwim({ lo: -3.4, hi: 0.8, speed: 0.07, rest: 0.6, bob: 0.12 }), anatomy: { frequency: 2.5, flex: 0.07 } },
  { key: "red_lipped_batfish", name: "붉은입술박쥐물고기", grade: "영웅", price: 26450, hours: 214.6, minTank: 3, size: 20, cm: 25, fresh: false, ornamental: false, spots: [], poolWeight: 1.9,
    habit: crawl({ speed: 0.055, rest: 0.62, hop: 0.55, dart: 0.12, hug: 0.08, lane: 0.8 }), anatomy: { frequency: 2.4, flex: 0.08 } },
  { key: "galapagos_lobster", name: "갈라파고스 가시랍스터", grade: "영웅", price: 26700, hours: 215.4, minTank: 3, size: 24, cm: 40, fresh: false, ornamental: false, spots: [], poolWeight: 1.9,
    habit: crawl({ speed: 0.05, rest: 0.58, dart: 0.35, hug: 0.07, lane: 0.88 }), anatomy: { frequency: 2.9, flex: 0.09 } },
  { key: "clown_triggerfish", name: "광대쥐치", grade: "영웅", price: 26950, hours: 216.2, minTank: 3, size: 22, cm: 45, fresh: false, ornamental: true, spots: [], poolWeight: 2.0,
    habit: reefSwim({ speed: 0.19, rest: 0.35, dart: 0.3 }), anatomy: { frequency: 3.4, flex: 0.09 } },
  { key: "galapagos_penguin", name: "갈라파고스 펭귄", grade: "영웅", price: 27200, hours: 217.0, minTank: 4, size: 22, cm: 53, fresh: false, ornamental: false, spots: [], poolWeight: 1.6,
    habit: mammalSwim({ speed: 0.36, haul: true, walk: true, breathe: 50, burst: 9, dart: 0.35, pace: 1.1, tilt: 0.45 }), anatomy: { frequency: 2.8, flex: 0.08 } },
  { key: "hawksbill_turtle", name: "대모거북", grade: "영웅", price: 27500, hours: 218.0, minTank: 4, size: 28, cm: 90, fresh: false, ornamental: false, spots: [], poolWeight: 1.7,
    habit: mammalSwim({ lo: -2.6, hi: 2.2, speed: 0.17, breathe: 75, pace: 0.65, tilt: 0.25 }), anatomy: { kind: "ray", frequency: 1.7, flex: 0.07 } },

  // 구간 B: arowana(32000/240) ~ redtail_catfish(33500/245)
  { key: "golden_cownose_ray", name: "황금매가오리", grade: "영웅", price: 32250, hours: 240.8, minTank: 4, size: 28, cm: 100, fresh: false, ornamental: false, spots: [], poolWeight: 1.7,
    habit: rayGlide({ school: true, speed: 0.23, lo: -1.8, hi: 2.2 }), anatomy: { kind: "ray", frequency: 2.3, flex: 0.11 } },
  { key: "ribbon_eel", name: "리본 장어", grade: "영웅", price: 32550, hours: 241.8, minTank: 4, size: 26, cm: 110, fresh: false, ornamental: true, spots: [], poolWeight: 1.6,
    habit: { lo: -2.8, hi: -0.6, speed: 0.14, reach: 0.85, depth: 1.4, rest: 0.25, pace: 0.9, tilt: 0.2 }, anatomy: { frequency: 2.6, flex: 0.22 } },
  { key: "giant_clam", name: "대왕조개", grade: "영웅", price: 32850, hours: 242.8, minTank: 4, size: 28, cm: 110, fresh: false, ornamental: false, spots: [], poolWeight: 1.5,
    habit: crawl({ speed: 0.04, rest: 0.55, hop: 0.5, dart: 0, hug: 0.06, idle: 0.85, lane: 0.45 }), anatomy: { frequency: 0.8, flex: 0.03 } },
  { key: "loggerhead_turtle", name: "붉은바다거북", grade: "영웅", price: 33150, hours: 243.8, minTank: 4, size: 30, cm: 110, fresh: false, ornamental: false, spots: [], poolWeight: 1.6,
    habit: mammalSwim({ lo: -3.0, hi: 1.8, speed: 0.16, breathe: 85, forage: true, pace: 0.6, tilt: 0.24 }), anatomy: { kind: "ray", frequency: 1.5, flex: 0.06 } },

  // 구간 C: redtail_catfish(33500/245) ~ blue_shark(35000/250)
  { key: "bumphead_parrotfish", name: "혹머리 비늘돔", grade: "영웅", price: 33750, hours: 245.8, minTank: 4, size: 30, cm: 120, fresh: false, ornamental: false, spots: [], poolWeight: 1.6,
    habit: reefSwim({ school: true, speed: 0.2, lo: -2.6, hi: 1.4 }), anatomy: { frequency: 3.1, flex: 0.08 } },
  { key: "galapagos_fur_seal", name: "갈라파고스 물개", grade: "영웅", price: 34050, hours: 246.8, minTank: 4, size: 31, cm: 150, fresh: false, ornamental: false, spots: [], poolWeight: 1.5,
    habit: mammalSwim({ speed: 0.28, haul: true, breathe: 60, dart: 0.25, pace: 0.85 }), anatomy: { frequency: 1.9, flex: 0.1 } },
  { key: "giant_trevally", name: "자이언트 트레발리", grade: "영웅", price: 34350, hours: 247.8, minTank: 4, size: 32, cm: 150, fresh: false, ornamental: false, spots: [], poolWeight: 1.6,
    habit: pelagic({ speed: 0.37, dart: 0.4, pace: 1.15 }), anatomy: { frequency: 4.8, flex: 0.065 } },
  { key: "wahoo", name: "꼬치삼치", grade: "영웅", price: 34650, hours: 248.8, minTank: 4, size: 34, cm: 180, fresh: false, ornamental: false, spots: [], poolWeight: 1.6,
    habit: pelagic({ speed: 0.46, dart: 0.35, pace: 1.4 }), anatomy: { frequency: 6.2, flex: 0.06 } },

  // 구간 D: anglerfish(40000/270) ~ arapaima(42500/279)
  { key: "yellowfin_tuna", name: "황다랑어", grade: "영웅", price: 40500, hours: 271.5, minTank: 4, size: 35, cm: 200, fresh: false, ornamental: false, spots: [], poolWeight: 1.5,
    habit: pelagic({ school: true, speed: 0.45, pace: 1.35 }), anatomy: { frequency: 6.8, flex: 0.055 } },
  { key: "spotted_dolphin", name: "점박이돌고래", grade: "영웅", price: 41000, hours: 273.3, minTank: 4, size: 36, cm: 210, fresh: false, ornamental: false, spots: [], poolWeight: 1.4,
    habit: mammalSwim({ school: true, speed: 0.35, breathe: 52, dart: 0.25, pace: 0.95 }), anatomy: { frequency: 2.2, flex: 0.1 } },
  { key: "silky_shark", name: "미흑점상어", grade: "영웅", price: 41500, hours: 275.1, minTank: 4, size: 37, cm: 250, fresh: false, ornamental: false, spots: [], poolWeight: 1.4,
    habit: sharkSwim({ speed: 0.32, lo: -1.6, hi: 2.4 }), anatomy: { frequency: 3.1, flex: 0.06 } },
  { key: "galapagos_shark", name: "갈라파고스 상어", grade: "영웅", price: 42000, hours: 277.0, minTank: 4, size: 38, cm: 300, fresh: false, ornamental: false, spots: [], poolWeight: 1.4,
    habit: sharkSwim({ speed: 0.29, lo: -2.0, hi: 2.0 }), anatomy: { frequency: 2.8, flex: 0.06 } },

  /* ── 전설 9종 (때 손님으로 출현 — fishinglegend.test 6% 규칙 준수) ── */
  // 구간 E: great_white(54000/318) ~ manta(56000/324)
  { key: "blue_ringed_octopus", name: "파란고리문어", grade: "전설", price: 54300, hours: 319.0, minTank: 5, size: 22, cm: 18, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "night" }, habit: crawl({ speed: 0.075, rest: 0.5, dart: 0.25, hug: 0.08, lane: 0.6 }), anatomy: { frequency: 2.2, flex: 0.19 } },
  { key: "nautilus", name: "앵무조개", grade: "전설", price: 54700, hours: 320.2, minTank: 5, size: 23, cm: 22, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "night" }, habit: { lo: -2.6, hi: 0.6, speed: 0.09, reach: 0.8, depth: 1.6, rest: 0.45, bob: 0.14, pace: 0.7, tilt: 0.1 }, anatomy: { frequency: 1.9, flex: 0.09 } },
  { key: "marine_iguana", name: "바다이구아나", grade: "전설", price: 55100, hours: 321.4, minTank: 5, size: 32, cm: 130, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { wx: "clear" }, habit: mammalSwim({ lo: -3.2, hi: 1.8, speed: 0.2, haul: true, walk: true, breathe: 55, forage: true, pace: 0.9, tilt: 0.25 }), anatomy: { frequency: 2.7, flex: 0.16 } },
  { key: "galapagos_sea_lion", name: "갈라파고스 바다사자", grade: "전설", price: 55500, hours: 322.6, minTank: 5, size: 38, cm: 200, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "day" }, habit: mammalSwim({ speed: 0.31, haul: true, breathe: 58, dart: 0.32, pace: 0.88, tilt: 0.38 }), anatomy: { frequency: 1.7, flex: 0.1 } },

  // 구간 F: rising(60000/336) ~ blue_whale(100000/450) — 전설 5종 + 신화 6종
  { key: "goliath_grouper", name: "골리앗 그루퍼", grade: "전설", price: 61500, hours: 342, minTank: 5, size: 40, cm: 240, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { always: true }, habit: { lo: -4.4, hi: -1.4, speed: 0.11, reach: 0.85, depth: 1.7, hug: 0.25, rest: 0.45, pace: 0.65, tilt: 0.14, lane: 0.76 }, anatomy: { frequency: 2.2, flex: 0.07 } },
  { key: "spotted_eagle_ray", name: "얼룩매가오리", grade: "전설", price: 63500, hours: 348, minTank: 5, size: 40, cm: 240, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "day" }, habit: rayGlide({ school: true, speed: 0.22, lo: -1.6, hi: 2.4 }), anatomy: { kind: "ray", frequency: 1.8, flex: 0.11 } },
  { key: "sailfish", name: "돗새치", grade: "전설", price: 66000, hours: 355, minTank: 5, size: 42, cm: 290, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { wx: "clear" }, habit: pelagic({ speed: 0.48, dart: 0.35, pace: 1.35 }), anatomy: { frequency: 5.5, flex: 0.06 } },
  { key: "scalloped_hammerhead", name: "홍살귀상어", grade: "전설", price: 68500, hours: 362, minTank: 5, size: 44, cm: 380, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "dusk" }, habit: sharkSwim({ school: true, speed: 0.27, lo: -1.8, hi: 2.2 }), anatomy: { frequency: 2.8, flex: 0.055 } },
  { key: "pilot_whale", name: "들쇠고래", grade: "전설", price: 71000, hours: 370, minTank: 5, size: 45, cm: 600, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "dusk" }, habit: mammalSwim({ school: true, speed: 0.2, breathe: 75, pace: 0.58, tilt: 0.26 }), anatomy: { frequency: 1.25, flex: 0.08 } },

  /* ── 신화 6종 (때 손님 · 희귀도 rare 적용) ── */
  { key: "leafy_seadragon", name: "나뭇잎해룡", grade: "신화", price: 75000, hours: 382, minTank: 5, size: 24, cm: 35, fresh: false, ornamental: true, spots: [], poolWeight: 0,
    timed: { wx: "rain", rare: 0.35 }, habit: reefSwim({ speed: 0.09, rest: 0.5, bob: 0.12, pace: 0.65 }), anatomy: { frequency: 2.1, flex: 0.11 } },
  { key: "leatherback_turtle", name: "장수거북", grade: "신화", price: 79000, hours: 394, minTank: 5, size: 40, cm: 200, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "night", rare: 0.35 }, habit: mammalSwim({ lo: -2.0, hi: 2.4, speed: 0.2, breathe: 95, pace: 0.55, tilt: 0.25 }), anatomy: { kind: "ray", frequency: 1.3, flex: 0.06 } },
  { key: "napoleon_wrasse", name: "나폴레옹 피쉬", grade: "신화", price: 83000, hours: 406, minTank: 5, size: 41, cm: 210, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "day", rare: 0.35 }, habit: reefSwim({ lo: -2.4, hi: 1.8, speed: 0.16, rest: 0.3, pace: 0.72 }), anatomy: { frequency: 2.5, flex: 0.07 } },
  { key: "mobula_ray", name: "악마가오리", grade: "신화", price: 87000, hours: 418, minTank: 5, size: 43, cm: 320, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "dusk", rare: 0.35 }, habit: rayGlide({ school: true, speed: 0.24, lo: -1.4, hi: 2.6 }), anatomy: { kind: "ray", frequency: 1.5, flex: 0.1 } },
  { key: "blue_marlin", name: "청새치", grade: "신화", price: 91000, hours: 430, minTank: 5, size: 46, cm: 380, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { wx: "clear", rare: 0.65 }, habit: pelagic({ speed: 0.45, dart: 0.3, pace: 1.2 }), anatomy: { frequency: 4.5, flex: 0.055 } },
  { key: "tiger_shark", name: "뱀상어", grade: "신화", price: 95000, hours: 440, minTank: 5, size: 47, cm: 450, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { time: "night", rare: 0.3 }, habit: sharkSwim({ speed: 0.25, lo: -2.2, hi: 1.8 }), anatomy: { frequency: 2.4, flex: 0.05 } },

  /* ── 태초 1종 (polar_bear 135000/550 ~ kraken 150000/600 사이) ── */
  { key: "brydes_whale", name: "브라이드고래", grade: "태초", price: 142000, hours: 575, minTank: 6, size: 49, cm: 1400, fresh: false, ornamental: false, spots: [], poolWeight: 0,
    timed: { wx: "rain", rare: 0.2 }, habit: mammalSwim({ lo: -1.2, hi: 2.6, speed: 0.18, breathe: 85, pace: 0.48, tilt: 0.22 }), anatomy: { frequency: 0.85, flex: 0.075 } },
];

export const GALAPAGOS_KEYS: readonly string[] = GALAPAGOS_FAMILIES.map((f) => f.key);
export const GALAPAGOS_POOL: readonly (readonly [string, number])[] = GALAPAGOS_FAMILIES.filter((f) => f.poolWeight > 0).map((f) => [f.key, f.poolWeight] as const);
export const GALAPAGOS_TIMED: readonly GalapagosTimed[] = GALAPAGOS_FAMILIES.filter((f) => f.timed).map((f) => ({ species: f.key, ...f.timed! }));
export const GALAPAGOS_ANATOMY: Readonly<Record<string, Partial<Anatomy>>> = Object.fromEntries(GALAPAGOS_FAMILIES.map((f) => [f.key, f.anatomy]));
