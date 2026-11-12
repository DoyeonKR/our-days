// Generated from src/lib/aqua3d/anatomy.ts by build-swim-preview.mjs






const families                                   = {
  moray: { frequency: 2.6, flex: .16 },
  electric_eel: { frequency: 2.5, flex: .16 },
  loach: { frequency: 3.3, flex: .14 },
  frilled_shark: { frequency: 2.4, flex: .14 },
  boxfish: { frequency: 3.0, flex: .09 },
  sunfish: { frequency: 2.2, flex: .08 },
  seahorse: { frequency: 2.6, flex: .08 },
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

export function anatomy(family        , key        )          {
  const a          = { kind: "fish", cx: .66, cy: .50, rx: .31, ry: .20, depth: .25, frequency: 4.6, flex: .10, tail: .32, ...families[family] };
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


















/** 뱀장어형 — 몸 전체가 고르게 물결친다 */
const EEL = /^(eel|oarfish|hairtail|snakehead|gulper_eel|moray|electric_eel|loach|frilled_shark)$/;
/** 다랑어 · 상어형 — 몸통은 거의 안 흔들고 꼬리 두 마디로만 친다 */
const THUNNIFORM = /^(bluefin|mackerel|yellowtail|striped_jack|blue_shark|great_white|hammerhead|nurse_shark|leopard_shark|whale_shark|megamouth|marlin|swordfish|barracuda)$/;
/** 가슴지느러미로 노 젓는 넓적한 몸(꼬리는 조금만) */
const ROWER = /^(angel|discus|puffer|boxfish|sunfish|filefish|triggerfish|seahorse|lionfish|butterflyfish)$/;
const PROFILES = new Map                     ();
const CARP_AMP = [0.038, 0.056, 0.074, 0.092, 0.11, 0.128];
export function bendProfile(family        , key = family)              {
  const id = `${family}/${key}`;
  const hit = PROFILES.get(id);
  if (hit) return hit;
  const a = anatomy(family, key);
  let p             ;
  if (a.kind === "jelly") p = { kind: a.kind, amp: [0.045, 0.057, 0.069, 0.081, 0.093, 0.105], lag: 0.6, fin: a.flex, finRate: 1, wing: 0, curl: 0, stride: 0.6 };
  else if (a.kind === "ray") p = { kind: a.kind, amp: [0.008, 0.01, 0.012, 0.016, 0.022, 0.03], lag: 0.5, fin: 0, finRate: 1, wing: family === "ray" && key !== "aurora_ray" ? 0.34 : 0.46, curl: 0.3, stride: 1.0 };
  else if (a.kind === "dragon" || EEL.test(family)) {
    const expansion = /^(moray|electric_eel|loach|frilled_shark)$/.test(family);
    p = { kind: a.kind, amp: expansion ? [0.035, 0.065, 0.09, 0.115, 0.135, 0.15] : [0.075, 0.08, 0.085, 0.09, 0.095, 0.1], lag: expansion ? 0.95 : 1, fin: family === "moray" ? 0 : a.flex * 0.6, finRate: 1, wing: 0, curl: 1.3, stride: 0.36 };
  }
  else if (THUNNIFORM.test(family)) p = { kind: a.kind, amp: [0.006, 0.008, 0.012, 0.022, 0.075, 0.15], lag: 0.45, fin: a.flex, finRate: 1, wing: 0, curl: 0.7, stride: 0.8 };
  else if (ROWER.test(family)) p = { kind: a.kind, amp: /^(boxfish|sunfish|seahorse)$/.test(family) ? [0.003, 0.004, 0.006, 0.012, 0.04, 0.065] : CARP_AMP.map((v) => v * 0.6), lag: 0.62, fin: Math.max(0.2, a.flex * 2.4), finRate: 1.6, wing: 0, curl: /^(boxfish|sunfish|seahorse)$/.test(family) ? 0.2 : 0.8, stride: 0.6 };
  // 두족류(2026-11-11) — GLB 는 spine_0 이 팔 끝(+X), spine_3~5 가 외투막(−X)이다(뼈 위치 · 가중치로 쟀다). 붕어 물결을 쓰면 외투막 끝이 꼬리처럼 흔들렸다.
  // ⚠ 두족류의 amp 는 마디마다의 '몸 기준 절대 방향'이다(fishMotion 이 차이로 바꿔 넣고 외투막 앞 마디를 제자리에 묶는다).
  // 오징어 · 대왕오징어는 팔이 앞으로 뻗어 외투막과 갈린다 → 외투막은 거의 0. 문어 · 크라켄은 팔이 외투막 밑까지 늘어져 x 로만 묶여 있다(외투막과 같은 뼈) → 외투막도 조금 흔든다
  else if (a.kind === "cephalopod") {
    const squidLike = family === "squid" || family === "giant_squid";
    p = { kind: a.kind, amp: squidLike ? [0.24, 0.16, 0.06, 0.012, 0.005, 0.003] : [0.17, 0.13, 0.08, 0.035, 0.018, 0.01], lag: 0.9, fin: a.flex, finRate: 1, wing: 0, curl: 0.35, stride: 0.9 };
  }
  // 누운 광어는 몸 가장자리 물결로 기어 · 헤엄쳐 한 번에 덜 나간다
  else p = { kind: a.kind, amp: CARP_AMP, lag: 0.62, fin: a.flex, finRate: 1, wing: 0, curl: 1, stride: flatBody(family, key) ? 0.5 : 0.62 };
  PROFILES.set(id, p);
  return p;
}
/** 한 마디씩 돌 때 굽히는 몫(합 1) — 꼬리 쪽이 더 굽는다 */
const CURL = [0.08, 0.12, 0.16, 0.19, 0.21, 0.24];
/** 엔진이 넘기는 헤엄 자세 — course 결과(turn · amp · pulse · hover)를 그대로 넘겨도 된다. 전부 선택 — 없으면 옛 움직임 그대로.
 *  feed: 먹이로 몰려드는 정도(0~1, habits 의 feedW) · speed: 실제로 움직인 빠르기 ÷ 몸길이(1/s) · dt: 이번 프레임 초 */



/** 물속에 떠서 멈춘 정도 — 바닥에 앉아 쉬는 물고기(course.ground)는 노 젓기 · 끄덕임을 안 한다(habits 는 바닥에서 쉬어도 hover 를 준다) */
export const floating = (pose           ) => Math.max(0, Math.min(1, pose?.hover ?? 0)) * (1 - Math.max(0, Math.min(1, pose?.ground ?? 0)));
/** 넙치처럼 옆으로 누워 사는 몸(2026-11-11) — GLB(어린 · 다 큰 광어)는 xz 평면에 누워 있다(높이 ÷ 길이 0.08). 치어는 아직 서서 헤엄친다(0.29).
 *  누운 몸은 위아래(+Z 축)로 물결친다 — 옛 식은 Y 축으로 굽혀 모래 위에서 뱀처럼 좌우로 꿈틀댔다. 도는 C 자는 그대로 Y 축(모래 평면 안). 코드 모델도 같은 판정으로 눕힌다 */
export const flatBody = (family        , key = family) => family === "flounder" && !key.startsWith("fry_");
/** 몸 물결을 돌리는 축 — GLB(fishMotion) · 코드 모델(reference-model)이 같이 본다 */
export const bendAxisFor = (family        , key = family)            => (flatBody(family, key) ? "z" : "y");
/** 돌 때 마디 i 를 C 자로 굽히는 몫(rad, +Y 축) — 누운 몸은 물결(Z)과 따로 돌려야 해서 나눠 둔다 */
export function turnCurl(p             , pose                      , i        ) {
  return Math.max(-0.42, Math.min(0.42, -(pose?.turn ?? 0) * 0.28)) * p.curl * CURL[i];
}
/** 머리 반동 — 꼬리를 치면 머리가 반대쪽으로 조금 돈다(실제 물고기의 recoil). spine_0 에 −0.3 × 꼬리 마디 물결 */
export const HEAD_RECOIL = 0.3;
/** 마디 · 지느러미 각도를 out 에 채운다(새 배열을 안 만든다).
 *  out[0..5] = 머리 쪽 마디부터 꼬리까지 좌우(+Y 축) 각도 · out[6..9] = 왼 지느러미 · 왼 끝 · 오른 지느러미 · 오른 끝(X 축).
 *  돌 때(turn, +Y 축 rad/s)는 꼬리가 도는 안쪽으로 휘는 C 자가 더해진다 — 옛 몸은 통째로 돌았다.
 *  curl=false 면 C 자를 빼고 물결만(누운 몸은 C 자를 다른 축으로 따로 돌린다 — turnCurl) */
export function swimAngles(p             , phase        , pose                      , out                         , curl = true) {
  const amp = Math.max(0, Math.min(1.4, pose?.amp ?? 1));
  for (let i = 0; i < 6; i++) out[i] = Math.sin(phase - (i + 1) * p.lag) * p.amp[i] * amp + (curl ? turnCurl(p, pose, i) : 0);
  // 머리 반동 — 물고기 · 용만(가오리는 몸통이 거의 안 흔들리고, 두족류는 마디가 몸 기준 절대 방향이다)
  // spine_0 은 사슬 뿌리라 몸 전체가 같이 돈다 — 다랑어 · 상어처럼 몸통이 굳은 종은 머리 마디 폭의 3배까지만(꼬리만 크게 치는 종에서 몸 전체가 흔들렸다)
  if (p.kind === "fish" || p.kind === "dragon") out[0] -= Math.sin(phase - 6 * p.lag) * Math.min(HEAD_RECOIL * p.amp[5], 3 * p.amp[0]) * amp;
  if (p.kind === "ray") {
    // 가오리는 꼬리 대신 날개를 친다 — 날개 끝이 조금 늦게 따라온다
    for (let s = 0; s < 2; s++) { const sign = s ? 1 : -1; out[6 + s * 2] = sign * Math.sin(phase) * p.wing; out[7 + s * 2] = sign * Math.sin(phase - 0.65) * p.wing * 0.88; }
  } else {
    const f = phase * p.finRate;
    for (let s = 0; s < 2; s++) { const sign = s ? 1 : -1; out[6 + s * 2] = sign * Math.sin(f) * p.fin; out[7 + s * 2] = sign * Math.sin(f - 0.7) * p.fin * 1.3; }
  }
  return out;
}

/** 헤엄 시계(2026-11-11) — 한 마리가 들고 있는 박자 상태. 박자 · 지느러미 · 막 흔들림을 프레임마다 '쌓는다'.
 *  ⚠ time × (바뀌는 빠르기) 로 곱하지 않는다 — 빠르기가 바뀌는 순간 쌓인 시간 전체에 곱해져 위상이 튄다. */









export const swimClock = ()            => ({ beat: 0, fin: 0, flutter: 0, bob: 0, bobRate: 1, flare: 0, avgSpeed: 0, avgEffort: 0, last: 0, ready: false });
/** 멈춰 떠 있을 때 가슴지느러미로 노 젓는 박자(rad/s, 약 2Hz) · 끄덕임(rad/s) · 막이 늘 조금 떨리는 박자 */
const SCULL = 13, BOB = 0.9, FLUTTER_IDLE = 2.2;
/** 실제 빠르기를 박자에 섞는 몫 — 나머지는 길(course)이 준 effort. 유리에 막혀 멈췄는데 꼬리만 바삐 치던 것을 줄인다 */
const SPEED_MIX = 0.6;
/** time: 엔진이 넘기는 쌓인 시간(phase += dt·effort) · dt: 진짜 초(모르면 0 — 그땐 옛 식과 같은 박자) */
export function stepSwim(c           , a         , p             , time        , dt        , pose           ) {
  if (!c.ready) {
    c.ready = true; c.last = time; c.beat = time * a.frequency; c.fin = c.beat * p.finRate; c.flutter = c.beat;
    // 끄덕임 — 예전엔 모두 0 에서 같은 빠르기로 시작해 떠 있는 물고기가 다 같이 고개를 끄덕였다(2026-11-12). 엔진은 phase 를 id·1.73 에서 시작하므로 첫 time 으로 위상 · 빠르기를 흩는다
    const u = Math.sin(time * 12.9898) * 43758.5453, r = Math.sin(time * 78.233) * 43758.5453;
    c.bob = (u - Math.floor(u)) * 2 * Math.PI; c.bobRate = 0.8 + 0.4 * (r - Math.floor(r));
    return c;
  }
  let dTime = time - c.last; c.last = time;
  if (!(dTime >= 0 && dTime < 1)) dTime = 0; // 되감기 · 오래 멈춘 뒤엔 위상을 잇기만 한다
  const live = dt > 0 && dt < 0.25, wall = live ? dt : dTime;
  let dBeat = dTime * a.frequency; // 옛 식: phase = time · frequency
  if (live && pose?.effort === undefined && pose?.speed !== undefined && Number.isFinite(pose.speed)) {
    // 실제 빠르기 — 이 물고기의 평소 빠르기 대 평소 effort 비로 박자로 바꾼다(종마다 몸길이당 빠르기가 4배까지 달라 한 상수로는 못 맞춘다)
    // 평균은 움직이는 동안만 쌓는다 — 오래 쉬는 종(광어 등)은 쉬는 시간이 평균을 끌어내려 옮겨 갈 때 박자가 0.7 배로 느려졌다.
    // 보정은 지금 effort 의 0.6~1.5 배 안 — 유리에 막혀 멈춰도 꼬리가 아예 서지 않고, 밀려 빨라져도 미친 듯 치지 않는다
    const effort = dTime / dt, speed = Math.max(0, Math.min(8, pose.speed)), k = 1 - Math.exp(-dt / 20);
    if (speed > 0.02 && effort > 0.1) {
      if (c.avgEffort <= 0) { c.avgEffort = effort; c.avgSpeed = speed; }
      c.avgEffort += (effort - c.avgEffort) * k; c.avgSpeed += (speed - c.avgSpeed) * k;
    }
    const fromSpeed = c.avgSpeed > 1e-3 ? (speed * c.avgEffort) / c.avgSpeed : effort;
    const ratio = effort > 1e-6 ? Math.max(0.6, Math.min(1.5, 1 + (fromSpeed / effort - 1) * SPEED_MIX)) : 1;
    dBeat = dt * a.frequency * effort * ratio;
  }
  const hover = floating(pose);
  c.beat += dBeat;
  c.fin += dBeat * p.finRate + wall * SCULL * hover;
  c.flutter += dBeat * 1.3 + wall * FLUTTER_IDLE;
  c.bob += wall * BOB * (c.bobRate || 1);
  // 펼침 — 빨리 올라가고 천천히 내린다
  const want = Math.max(Math.max(0, Math.min(1, Math.abs(pose?.turn ?? 0) / 1.2 - 0.25)), Math.max(0, Math.min(1, pose?.feed ?? 0)));
  if (wall > 0) c.flare += (want - c.flare) * (1 - Math.exp(-wall / (want > c.flare ? 0.12 : 0.8)));
  return c;
}
/** 가슴지느러미 폭 배율 — 떠 있으면 작게 빨리(노 젓기), 펼치면 크게 */
export const finGain = (c           , pose           ) => (1 - 0.35 * floating(pose)) * (1 + 0.8 * c.flare);
/** 떠 있을 때 몸을 앞뒤로 천천히 끄덕이는 각도(rad, Z 축) */
export const hoverPitch = (c           , pose           ) => Math.sin(c.bob) * 0.035 * floating(pose);
/** 지느러미 막 흔들림 세기(셰이더에 넘기는 값, 1 = 보통) */
export const flutterGain = (c           , pose           ) => (0.55 + 0.45 * Math.max(0, Math.min(1.4, pose?.amp ?? 1))) * (1 + c.flare);
/** 해파리 갓의 숨쉬기 — s 는 1(펴짐) ~ -1(오므림). axis 는 갓이 선 축: 코드 모델은 "y", GLB 는 "x"(제작 파일이 옆으로 누워 있다).
 *  펴지면 옆으로 넓어지고 키가 줄며, 오므리면 좁아지고 길어진다 — 축을 틀리면 갓이 타원으로 찌그러진다. */
export function jellyPulse(s        , axis           , out                                     ) {
  // 2026-11-12 — 예전엔 ±5.5% 라 숨 쉬는지 안 보였다(실제 해파리는 갓 지름이 20~30% 오므라든다). 오므릴 때(s < 0)는 크게(가장자리 −15%, 키 +11%),
  // 펼 때(s > 0)는 조금만(+6% · −5%) — 갓은 늘 편 모양에 가깝고 짧게 꽉 쥔다. 박자의 빠른 오므림 · 느린 폄은 길(habits.jetAt, 30% · 70%)이 준다. 펴짐 대 오므림 지름 비 0.80
  const along = 1 - s * (s < 0 ? 0.11 : 0.05), around = 1 + s * (s < 0 ? 0.15 : 0.06);
  out.x = axis === "x" ? along : around; out.y = axis === "y" ? along : around; out.z = around;
  return out;
}
/** GLB 를 세우는 각도(Z 축) — 해파리 GLB 는 갓 꼭대기가 +X 를 본다(눕혀 만들었다). +90° 돌리면 +X 가 +Y 로 간다. 나머지는 0 */
export const glbUpright = (family        , key = family) => (anatomy(family, key).kind === "jelly" ? Math.PI / 2 : 0);
/** 몸길이를 잴 축 — 물고기는 머리에서 꼬리(x). 옛 엔진은 max(x, z, 1.25·높이)로 재서 키 큰 종(엔젤 · 디스커스 · 베타 · 문어 · 해파리 등 27종)이
 *  fishLength 의 0.71~0.90 로 작아졌다. 가오리 · 불가사리는 펼친 폭(xz), 해파리는 선 키(y), 두족류는 팔까지 가장 긴 쪽(max). */
export function lengthAxisFor(family        , key = family)                           {
  const k = anatomy(family, key).kind;
  if (k === "jelly") return "y";
  if (k === "ray" || k === "star") return "xz";
  if (k === "cephalopod") return "max";
  return "x";
}
/** 경계 상자 크기 → 몸길이(lengthAxisFor 기준). 엔진: scale = fishLength / bodyMeasure(family, key, size) */
export function bodyMeasure(family        , key        , size                                     ) {
  switch (lengthAxisFor(family, key)) {
    case "x": return size.x;
    case "y": return size.y;
    case "xz": return Math.max(size.x, size.z);
    default: return Math.max(size.x, size.z, size.y * 1.25);
  }
}
