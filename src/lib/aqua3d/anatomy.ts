export type Anatomy = {
  kind: "fish" | "ray" | "jelly" | "dragon" | "star" | "cephalopod";
  /** Body volume prior in the cropped source image; fins keep their actual source outline. */
  cx: number; cy: number; rx: number; ry: number; depth: number;
  frequency: number; flex: number; tail: number;
};
const families: Record<string, Partial<Anatomy>> = {
  crucian: { cx: .64, rx: .33, ry: .31, depth: .25, frequency: 3.8 },
  pale_chub: { cx: .62, rx: .35, ry: .16, depth: .17, frequency: 5.5 },
  chinese_minnow: { cx: .62, rx: .35, ry: .17, depth: .18, frequency: 5.0 },
  smelt: { cx: .62, rx: .35, ry: .14, depth: .16, frequency: 5.5 },
  bullhead: { cx: .64, rx: .34, ry: .23, depth: .24, frequency: 3.5 },
  common_carp: { cx: .63, rx: .35, ry: .27, depth: .30, frequency: 3.5 },
  masu_salmon: { cx: .63, rx: .35, ry: .19, depth: .21, frequency: 4.8 },
  snakehead: { cx: .60, rx: .38, ry: .20, depth: .23, frequency: 3.4, flex: .14 },
  mandarin_fish: { cx: .64, rx: .34, ry: .27, depth: .27, frequency: 3.8 },
  perch_kkeokji: { cx: .63, rx: .34, ry: .25, depth: .23, frequency: 4.0 },
  eel: { cx: .51, rx: .48, ry: .13, depth: .08, frequency: 2.6, flex: .22 },
  lenok: { cx: .63, rx: .35, ry: .21, depth: .22, frequency: 4.6 },
  mackerel: { cx: .62, rx: .35, ry: .18, depth: .22, frequency: 5.8, flex: .07 },
  rockfish_bollak: { cx: .65, rx: .31, ry: .28, depth: .25, frequency: 3.5 },
  black_seabream: { cx: .64, rx: .33, ry: .31, depth: .25, frequency: 3.8 },
  hairtail: { cx: .51, rx: .48, ry: .15, depth: .035, frequency: 2.7, flex: .22 },
  barred_knifejaw: { cx: .65, rx: .32, ry: .34, depth: .27, frequency: 3.7 },
  cutlassfish_pollock: { cx: .63, rx: .35, ry: .19, depth: .22, frequency: 4.5 },
  sailfin_sandfish: { cx: .65, rx: .32, ry: .23, depth: .23, frequency: 4.1 },
  puffer: { cx: .62, rx: .35, ry: .31, depth: .34, frequency: 3.0 },
  starfish: { kind: "star", cx: .5, rx: .42, ry: .42, depth: .16, frequency: 1.0, flex: .05 },
  squid: { kind: "cephalopod", cx: .30, rx: .26, ry: .18, depth: .22, frequency: 3.4, flex: .13 },
  octopus: { kind: "cephalopod", cx: .28, rx: .24, ry: .30, depth: .32, frequency: 2.0, flex: .19 },
  giant_squid: { kind: "cephalopod", cx: .25, rx: .22, ry: .17, depth: .23, frequency: 2.4, flex: .14 },
  kraken: { kind: "cephalopod", cx: .26, rx: .23, ry: .28, depth: .36, frequency: 1.6, flex: .20 },
  gulper_eel: { cx: .73, rx: .24, ry: .25, depth: .24, frequency: 3.0, flex: .22 },
  anglerfish: { cx: .64, rx: .32, ry: .33, depth: .34, frequency: 2.8 },
  oarfish: { cx: .50, rx: .48, ry: .22, depth: .055, frequency: 2.5, flex: .20 },
  coelacanth: { cx: .63, rx: .34, ry: .25, depth: .30, frequency: 3.1 },
  nurse_shark: { cx: .62, rx: .36, ry: .20, depth: .24, frequency: 2.7, flex: .075 },
  leopard_shark: { cx: .63, rx: .35, ry: .18, depth: .23, frequency: 3.1, flex: .065 },
  blue_shark: { cx: .64, rx: .34, ry: .14, depth: .20, frequency: 3.4, flex: .055 },
  hammerhead: { cx: .60, rx: .34, ry: .19, depth: .22, frequency: 3.1, flex: .055 },
  great_white: { cx: .64, rx: .35, ry: .23, depth: .34, frequency: 3.2, flex: .045 },
  megamouth: { cx: .62, rx: .36, ry: .26, depth: .35, frequency: 2.3, flex: .065 },
  flounder: { cx: .60, rx: .35, ry: .36, depth: .065, frequency: 3.0, flex: .07 },
  rockfish: { cx: .64, rx: .32, ry: .28, depth: .27, frequency: 3.5 },
  sea_bream: { cx: .63, rx: .32, ry: .32, depth: .24, frequency: 3.8 },
  sea_bass: { cx: .63, rx: .35, ry: .20, depth: .23, frequency: 4.1 },
  salmon: { cx: .63, rx: .35, ry: .19, depth: .24, frequency: 4.8 },
  yellowtail: { cx: .63, rx: .34, ry: .22, depth: .28, frequency: 5.2, flex: .065 },
  croaker: { cx: .63, rx: .35, ry: .22, depth: .24, frequency: 3.8 },
  striped_jack: { cx: .63, rx: .33, ry: .27, depth: .24, frequency: 4.7 },
  guppy: { cx: .71, rx: .27, ry: .13, depth: .21, tail: .43, flex: .16 },
  tetra: { cx: .63, rx: .35, ry: .16, depth: .20, tail: .30, frequency: 6.5 },
  sweetfish: { cx: .61, rx: .36, ry: .17, depth: .19, tail: .27, frequency: 5.4 },
  catfish: { cx: .46, cy: .54, rx: .42, ry: .20, depth: .25, tail: .25, frequency: 3.2, flex: .14 },
  jellyfish: { kind: "jelly", cx: .50, cy: .32, rx: .40, ry: .28, depth: .40, frequency: 1.8, flex: .04 },
  goldfish: { cx: .69, rx: .27, ry: .29, depth: .35, tail: .42, frequency: 3.6 },
  betta: { cx: .77, rx: .21, ry: .16, depth: .19, tail: .54, flex: .24, frequency: 3.8 },
  angel: { cx: .70, rx: .24, ry: .23, depth: .16, tail: .43, frequency: 3.4 },
  clown: { cx: .64, rx: .34, ry: .29, depth: .29, tail: .29, frequency: 4.8 },
  discus: { cx: .64, rx: .33, ry: .43, depth: .20, tail: .29, frequency: 3.1 },
  koi: { cx: .64, rx: .34, ry: .17, depth: .27, tail: .29, frequency: 3.7 },
  arowana: { cx: .61, rx: .37, ry: .17, depth: .23, tail: .25, frequency: 3.1 },
  bluefin: { cx: .66, rx: .33, ry: .19, depth: .34, tail: .30, frequency: 7.3, flex: .055 },
  whale_shark: { cx: .65, rx: .34, ry: .19, depth: .33, tail: .29, frequency: 2.4, flex: .055 },
  ray: { kind: "ray", cx: .69, cy: .57, rx: .30, ry: .31, depth: .20, frequency: 2.3, flex: .12 },
  manta: { kind: "ray", cx: .69, cy: .49, rx: .27, ry: .18, depth: .22, frequency: 2.1, flex: .12 },
  rising: { cx: .56, rx: .41, ry: .20, depth: .24, frequency: 2.6, flex: .14 },
  astral: { cx: .70, rx: .28, ry: .22, depth: .22, frequency: 2.5, flex: .20 },
};

export function anatomy(family: string, key: string): Anatomy {
  const a: Anatomy = { kind: "fish", cx: .66, cy: .50, rx: .31, ry: .20, depth: .25, frequency: 4.6, flex: .10, tail: .32, ...families[family] };
  if (key.startsWith("fry_") || key.startsWith("juv_")) {
    if (["guppy", "betta", "goldfish"].includes(family)) { a.cx -= .08; a.rx += .08; }
    a.flex *= .7;
  }
  if (key === "comet_gold") { a.ry = .17; a.depth = .23; }
  if (key === "fry_flounder") Object.assign(a, { cx: .63, rx: .34, ry: .14, depth: .12 });
  if (key === "ranchu_gold" || key === "oranda_gold") { a.rx = .30; a.ry = .34; a.depth = .39; }
  if (key === "ryukin_gold") { a.ry = .30; a.depth = .32; }
  if (key === "veil_betta") { a.cx = .76; a.cy = .40; }
  if (key === "moon_jelly") Object.assign(a, { kind: "jelly", cx: .50, cy: .20, rx: .35, ry: .19, depth: .43, frequency: 2.1 });
  if (key === "aurora_ray") Object.assign(a, families.manta, { cx: .70 });
  if (/imugi|dragonfish/.test(key)) Object.assign(a, { kind: "dragon", cx: .57, cy: .48, rx: .43, ry: .29, frequency: 2.5, flex: .12 });
  return a;
}

/** 헤엄치는 몸의 물결 — 마디(머리 쪽 0 → 꼬리 5)마다 흔드는 폭과 마디 사이 늦음(rad).
 *  옛 식은 모든 종이 같은 물결(폭 .02+i·.018 · 늦음 .62)이라 장어도 참치도 붕어처럼 헤엄쳤다. */
export type BendProfile = {
  kind: Anatomy["kind"];
  /** 마디 6개의 좌우 흔들림 폭(rad) */
  amp: readonly number[];
  /** 마디 사이 늦음(rad) — 1 에 가까우면 몸 전체에 물결이 한 번 지나간다(장어) */
  lag: number;
  /** 가슴 · 등 지느러미 폭(rad) */
  fin: number;
  /** 지느러미 박자(꼬리 박자 배수) — 엔젤 · 디스커스는 가슴지느러미로 노 젓듯 더 빨리 부친다 */
  finRate: number;
  /** 가오리 날개 폭(rad, 가오리가 아니면 0) */
  wing: number;
  /** 돌 때 몸을 C 자로 굽히는 정도(1 = 보통) */
  curl: number;
};
/** 뱀장어형 — 몸 전체가 고르게 물결친다 */
const EEL = /^(eel|oarfish|hairtail|snakehead|gulper_eel)$/;
/** 다랑어 · 상어형 — 몸통은 거의 안 흔들고 꼬리 두 마디로만 친다 */
const THUNNIFORM = /^(bluefin|mackerel|yellowtail|striped_jack|blue_shark|great_white|hammerhead|nurse_shark|leopard_shark|whale_shark|megamouth)$/;
/** 가슴지느러미로 노 젓는 넓적한 몸(꼬리는 조금만) */
const ROWER = /^(angel|discus|puffer)$/;
const PROFILES = new Map<string, BendProfile>();
const CARP_AMP = [0.038, 0.056, 0.074, 0.092, 0.11, 0.128];
export function bendProfile(family: string, key = family): BendProfile {
  const id = `${family}/${key}`;
  const hit = PROFILES.get(id);
  if (hit) return hit;
  const a = anatomy(family, key);
  let p: BendProfile;
  if (a.kind === "jelly") p = { kind: a.kind, amp: [0.045, 0.057, 0.069, 0.081, 0.093, 0.105], lag: 0.6, fin: a.flex, finRate: 1, wing: 0, curl: 0 };
  else if (a.kind === "ray") p = { kind: a.kind, amp: [0.008, 0.01, 0.012, 0.016, 0.022, 0.03], lag: 0.5, fin: 0, finRate: 1, wing: family === "ray" && key !== "aurora_ray" ? 0.34 : 0.46, curl: 0.3 };
  else if (a.kind === "dragon" || EEL.test(family)) p = { kind: a.kind, amp: [0.075, 0.08, 0.085, 0.09, 0.095, 0.1], lag: 1.0, fin: a.flex * 0.6, finRate: 1, wing: 0, curl: 1.3 };
  else if (THUNNIFORM.test(family)) p = { kind: a.kind, amp: [0.006, 0.008, 0.012, 0.022, 0.075, 0.15], lag: 0.45, fin: a.flex, finRate: 1, wing: 0, curl: 0.7 };
  else if (ROWER.test(family)) p = { kind: a.kind, amp: CARP_AMP.map((v) => v * 0.6), lag: 0.62, fin: Math.max(0.2, a.flex * 2.4), finRate: 1.6, wing: 0, curl: 0.8 };
  else p = { kind: a.kind, amp: CARP_AMP, lag: 0.62, fin: a.flex, finRate: 1, wing: 0, curl: 1 };
  PROFILES.set(id, p);
  return p;
}
/** 한 마디씩 돌 때 굽히는 몫(합 1) — 꼬리 쪽이 더 굽는다 */
const CURL = [0.08, 0.12, 0.16, 0.19, 0.21, 0.24];
/** 엔진이 넘기는 헤엄 자세 — course 결과(turn · amp · pulse)를 그대로 넘겨도 된다 */
export type SwimPose = { turn?: number; amp?: number; pulse?: number };
/** 마디 · 지느러미 각도를 out 에 채운다(새 배열을 안 만든다).
 *  out[0..5] = 머리 쪽 마디부터 꼬리까지 좌우(+Y 축) 각도 · out[6..9] = 왼 지느러미 · 왼 끝 · 오른 지느러미 · 오른 끝(X 축).
 *  돌 때(turn, +Y 축 rad/s)는 꼬리가 도는 안쪽으로 휘는 C 자가 더해진다 — 옛 몸은 통째로 돌았다. */
export function swimAngles(p: BendProfile, phase: number, pose: SwimPose | undefined, out: Float32Array | number[]) {
  const amp = Math.max(0, Math.min(1.4, pose?.amp ?? 1));
  const bend = Math.max(-0.42, Math.min(0.42, -(pose?.turn ?? 0) * 0.28)) * p.curl;
  for (let i = 0; i < 6; i++) out[i] = Math.sin(phase - (i + 1) * p.lag) * p.amp[i] * amp + bend * CURL[i];
  if (p.kind === "ray") {
    // 가오리는 꼬리 대신 날개를 친다 — 날개 끝이 조금 늦게 따라온다
    for (let s = 0; s < 2; s++) { const sign = s ? 1 : -1; out[6 + s * 2] = sign * Math.sin(phase) * p.wing; out[7 + s * 2] = sign * Math.sin(phase - 0.65) * p.wing * 0.88; }
  } else {
    const f = phase * p.finRate;
    for (let s = 0; s < 2; s++) { const sign = s ? 1 : -1; out[6 + s * 2] = sign * Math.sin(f) * p.fin; out[7 + s * 2] = sign * Math.sin(f - 0.7) * p.fin * 1.3; }
  }
  return out;
}
/** 해파리 갓의 숨쉬기 — s 는 1(펴짐) ~ -1(오므림). axis 는 갓이 선 축: 코드 모델은 "y", GLB 는 "x"(제작 파일이 옆으로 누워 있다).
 *  펴지면 옆으로 넓어지고 키가 줄며, 오므리면 좁아지고 길어진다 — 축을 틀리면 갓이 타원으로 찌그러진다. */
export function jellyPulse(s: number, axis: "x" | "y", out: { x: number; y: number; z: number }) {
  const along = 1 - s * 0.065, around = 1 + s * 0.055;
  out.x = axis === "x" ? along : around; out.y = axis === "y" ? along : around; out.z = around;
  return out;
}
/** GLB 를 세우는 각도(Z 축) — 해파리 GLB 는 갓 꼭대기가 +X 를 본다(눕혀 만들었다). +90° 돌리면 +X 가 +Y 로 간다. 나머지는 0 */
export const glbUpright = (family: string, key = family) => (anatomy(family, key).kind === "jelly" ? Math.PI / 2 : 0);
/** 몸길이를 잴 축 — 물고기는 머리에서 꼬리(x). 옛 엔진은 max(x, z, 1.25·높이)로 재서 키 큰 종(엔젤 · 디스커스 · 베타 · 문어 · 해파리 등 27종)이
 *  fishLength 의 0.71~0.90 로 작아졌다. 가오리 · 불가사리는 펼친 폭(xz), 해파리는 선 키(y), 두족류는 팔까지 가장 긴 쪽(max). */
export function lengthAxisFor(family: string, key = family): "x" | "xz" | "y" | "max" {
  const k = anatomy(family, key).kind;
  if (k === "jelly") return "y";
  if (k === "ray" || k === "star") return "xz";
  if (k === "cephalopod") return "max";
  return "x";
}
/** 경계 상자 크기 → 몸길이(lengthAxisFor 기준). 엔진: scale = fishLength / bodyMeasure(family, key, size) */
export function bodyMeasure(family: string, key: string, size: { x: number; y: number; z: number }) {
  switch (lengthAxisFor(family, key)) {
    case "x": return size.x;
    case "y": return size.y;
    case "xz": return Math.max(size.x, size.z);
    default: return Math.max(size.x, size.z, size.y * 1.25);
  }
}
