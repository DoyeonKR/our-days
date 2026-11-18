/* 게 · 바닷가재 걷기(2026-11-18) [사용자: 게 · 가재가 다리 하나하나를 번갈아 움직이며 걸어야 한다 — 양쪽 다리 묶음이 한 덩어리로 흔들리지 않게]
 * 왜: 게 GLB(crab-build.mjs)는 위에서 본 그림 한 장을 부풀린 몸이라 뼈가 몸통 하나(spine_0) · 왼쪽 다리 묶음(fin_L) · 오른쪽 다리 묶음(fin_R)뿐이다.
 *   게임이 물고기처럼 fin_L · fin_R 를 저으니 한쪽 다리 넷이 판 하나처럼 같이 들썩였고, 바닷가재는 집게까지 그 뼈에 묶여 같이 흔들렸다.
 * 실제 게 · 가재(십각류)의 걸음: 걷는 다리가 한쪽에 넷, 서로 엇갈린 두 무리(왼1 · 오2 · 왼3 · 오4 / 오1 · 왼2 · 오3 · 왼4)가 번갈아 든다(교대 사각 보행).
 *   든 다리는 앞으로 옮기고(끝이 들린다 — 끝으로 갈수록 더), 짚은 다리는 바닥을 밀며 뒤로 간다. 집게는 걷는 데 안 쓰고 앞에 든 채 조금씩 흔든다.
 * 다리 나누기: 기준 그림에서 다리마다 가운데 선(뿌리 → 무릎 → 끝 꺾은선)을 따 표에 두고, 몸통 밖의 점은 가장 가까운 선의 다리가 된다.
 *   그림에서 다리끼리 겹친 곳(대게는 다리 끝이 옆 다리 위에 얹혀 있다)은 메시가 한 장이라, 다리마다 따로 움직이면 그 사이가 늘어나 막처럼 찢어진다 —
 *   그래서 모델을 지을 때(crab-build.mjs) 같은 표로 다른 다리끼리 맞닿은 칸을 잘라 둔다(다리와 몸통은 그대로 붙어 있다).
 * 움직임은 불러올 때 정점마다 '어느 다리인지 · 뿌리에서 얼마나 먼지'를 한 번 구해 두고(cephalopod.ts 와 같은 길),
 *   정점 셰이더가 다리마다 다른 위상으로 뿌리(세로축)를 축으로 돌리고 끝을 든다.
 * 그림의 uv 가 곧 정점 자리다(crab-build: u = x/W, v = y/H·0.5 — 배 쪽은 +0.5). 새끼 · 어린 것은 같은 그림 · 같은 모양이고 색만 옅다(표 하나).
 * 이 파일은 three 없이 순수 계산만 한다 — 셰이더(glb.ts) · 모델 짓기(crab-build.mjs)와 같은 식이고, 시험이 그대로 부른다. */

type Pt = readonly [number, number];
/** 기준 그림(픽셀) 위의 몸통 · 다리 — body: 몸통을 덮는 타원들 [가운데 x, y, 반지름 x, y] · parts: 다리마다 가운데 선(첫 점 = 몸통에 닿는 뿌리)과 종류.
 *  side: 그림 왼쪽(-1, 게임의 -Z = fin_L 쪽) · 오른쪽(1). tail: 몸통 안에서 꼬리로 칠 세로 구간 [시작 y, 끝 y](바닷가재).
 *  still: 움직이지 않는 가는 부속(바닷가재 더듬이) — 집게 위를 가로질러 그려져 있어, 따로 떼어 두지 않으면 집게가 흔들릴 때 더듬이가 토막 난다 */
export type CrabKind = "leg" | "claw" | "still";
export type CrabPart = { kind: CrabKind; side: -1 | 1; line: readonly Pt[] };
export type CrabArt = { size: Pt; body: readonly (readonly [number, number, number, number])[]; tail?: Pt; parts: readonly CrabPart[] };

const flip = (cx2: number, line: Pt[]): Pt[] => line.map(([x, y]) => [cx2 - x, y] as const);
export const CRAB_ART: Readonly<Record<string, CrabArt>> = {
  // 대게 — 집게 하나 · 걷는 다리 넷(한쪽). 다리 끝(발끝마디)이 옆 다리 위로 겹쳐 있다
  snow_crab: { size: [640, 427], body: [[320, 268, 92, 86]], parts: [
    { kind: "claw", side: -1, line: [[262, 196], [230, 150], [196, 108], [205, 80], [250, 62], [300, 45], [340, 35]] },
    { kind: "leg", side: -1, line: [[225, 250], [160, 200], [95, 150], [110, 110], [150, 75], [185, 45], [225, 44]] },
    { kind: "leg", side: -1, line: [[228, 292], [160, 282], [75, 268], [85, 240], [110, 205], [140, 170], [180, 157]] },
    { kind: "leg", side: -1, line: [[248, 326], [180, 336], [105, 350], [92, 320], [105, 280], [125, 240], [160, 250]] },
    { kind: "leg", side: -1, line: [[268, 340], [220, 370], [178, 397], [165, 370], [165, 330], [175, 313], [195, 313]] },
    { kind: "claw", side: 1, line: [[390, 212], [425, 170], [455, 135], [445, 108], [400, 105], [350, 118], [295, 140]] },
    { kind: "leg", side: 1, line: [[414, 252], [480, 200], [545, 152], [535, 110], [500, 75], [465, 48], [415, 44]] },
    { kind: "leg", side: 1, line: [[414, 290], [490, 280], [565, 265], [555, 230], [525, 195], [500, 168], [462, 157]] },
    { kind: "leg", side: 1, line: [[397, 326], [470, 338], [540, 350], [548, 310], [530, 260], [515, 235], [482, 250]] },
    { kind: "leg", side: 1, line: [[380, 343], [420, 370], [462, 396], [472, 365], [470, 330], [465, 312], [445, 313]] }] },
  // 킹크랩 — 집게 하나 · 걷는 다리 셋이 보인다(넷째 다리는 등딱지 밑에 숨은 작은 다리). 걷는 다리는 좌우가 거의 대칭(x = 630 − x)
  king_crab: { size: [640, 427], body: [[315, 228, 90, 72]], parts: [
    { kind: "claw", side: -1, line: [[285, 150], [270, 115], [262, 85], [285, 68], [305, 78], [315, 100], [318, 115]] },
    { kind: "leg", side: -1, line: [[240, 186], [200, 140], [165, 98], [120, 115], [80, 140], [52, 180], [45, 210]] },
    { kind: "leg", side: -1, line: [[223, 226], [170, 195], [120, 166], [90, 200], [60, 250], [45, 300], [45, 320]] },
    { kind: "leg", side: -1, line: [[218, 270], [160, 262], [100, 258], [110, 290], [150, 330], [185, 355], [222, 350]] },
    { kind: "claw", side: 1, line: [[362, 146], [375, 120], [390, 81], [370, 62], [345, 58], [328, 68]] },
    { kind: "leg", side: 1, line: flip(630, [[240, 186], [200, 140], [165, 98], [120, 115], [80, 140], [52, 180], [45, 210]]) },
    { kind: "leg", side: 1, line: flip(630, [[223, 226], [170, 195], [120, 166], [90, 200], [60, 250], [45, 300], [45, 320]]) },
    { kind: "leg", side: 1, line: flip(630, [[218, 270], [160, 262], [100, 258], [110, 290], [150, 330], [185, 355], [222, 350]]) }] },
  // 바닷가재(머리 위로 돌린 그림) — 큰 집게 · 걷는 다리 넷. 배(꼬리)는 몸통 안에서 따로 천천히 들썩인다.
  //   더듬이는 움직이지 않는 부속(still)으로 따로 떼어 둔다 — 오른쪽 집게 위를 가로질러 그려져 있다
  lobster: { size: [427, 640], body: [[202, 296, 42, 76], [199, 413, 37, 52], [160, 492, 58, 36]], tail: [366, 525], parts: [
    { kind: "claw", side: -1, line: [[168, 262], [135, 262], [112, 255], [95, 225], [85, 190], [75, 150], [68, 120]] },
    { kind: "claw", side: 1, line: [[240, 266], [270, 258], [292, 245], [292, 210], [285, 170], [272, 135]] },
    { kind: "leg", side: -1, line: [[160, 302], [130, 290], [105, 284], [85, 288]] },
    { kind: "leg", side: -1, line: [[160, 332], [135, 322], [112, 316], [100, 330], [90, 348]] },
    { kind: "leg", side: -1, line: [[160, 348], [135, 340], [120, 355], [112, 377]] },
    { kind: "leg", side: -1, line: [[166, 360], [148, 362], [135, 378], [130, 392]] },
    { kind: "leg", side: 1, line: [[238, 300], [260, 298], [275, 302], [285, 312]] },
    { kind: "leg", side: 1, line: [[238, 322], [260, 326], [278, 332], [285, 342]] },
    { kind: "leg", side: 1, line: [[238, 338], [250, 348], [258, 362], [267, 382]] },
    { kind: "leg", side: 1, line: [[236, 364], [244, 378], [252, 394]] },
    { kind: "still", side: 1, line: [[212, 215], [260, 195], [320, 160], [390, 115]] },
    { kind: "still", side: 1, line: [[214, 218], [280, 210], [340, 190], [398, 170]] }] },
};
/** 이 모델(key)이 쓰는 표 — 새끼 · 어린 것은 다 큰 것과 같은 그림 · 같은 모양 */
export const crabFamilyOf = (key: string) => { const f = key.replace(/^(fry_|juv_)/, ""); return CRAB_ART[f] ? f : null; };

/** 걸음 값 — 다리를 앞뒤로 젓는 각(rad) · 든 다리 끝이 오르는 몫(다리 길이 대비) · 같은 무리 안 앞 → 뒤 다리의 위상 늦음(물결) · 뿌리에서 굽힘이 다 붙는 거리(0~1) */
export const GAIT = { swing: 0.24, lift: 0.18, wave: 0.22, rootBlend: 0.25 } as const;
/** 쉬는 동안의 몫 — 집게는 천천히 흔들고 조금 들었다 놓는다, 꼬리(바닷가재)는 천천히 들썩. 걸을 때도 집게는 이만큼만(걷는 데 안 쓴다) */
export const IDLE = { claw: 0.06, clawRate: 0.8, clawLift: 0.05, tail: 0.06, tailRate: 0.55 } as const;
/** 종류 번호(정점 자료 · 셰이더) */
export const KIND = { none: 0, leg: 1, claw: 2, tail: 3, still: 0 } as const;
/** 가운데 선에서 이만큼(px) 넘게 먼 점은 어느 다리도 아니다(더듬이 · 눈자루 · 등딱지 가시) — 가장 굵은 집게 손바닥의 반폭보다 조금 크게 */
export const LINE_REACH = 40;

const unit = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (a: number, b: number, x: number) => { const t = unit((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 몸통 안인가(그림 픽셀) */
export const inCrabBody = (art: CrabArt, x: number, y: number) => art.body.some(([cx, cy, ax, ay]) => ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 <= 1);
/** 꺾은선 위로 한 점을 내린다 — d: 선까지 거리(px) · s: 뿌리부터 선을 따라 간 거리(px) · total: 선 길이 */
export function lineProject(line: readonly Pt[], x: number, y: number) {
  let acc = 0, total = 0, d = Infinity, s = 0;
  for (let k = 1; k < line.length; k++) {
    const [ax, ay] = line[k - 1], [bx, by] = line[k], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy, seg = Math.sqrt(l2);
    const t = l2 > 0 ? unit(((x - ax) * vx + (y - ay) * vy) / l2) : 0, dd = Math.hypot(x - ax - vx * t, y - ay - vy * t);
    if (dd < d) { d = dd; s = acc + seg * t; }
    acc += seg; total += seg;
  }
  return { d, s, total };
}
/** 그림 픽셀 한 점의 다리 — 몸통이면 -2, 어느 다리도 아니면 -1, 아니면 표의 다리 번호와 뿌리 → 끝 0~1(선을 따라 잰 몫) */
export function crabPartAt(art: CrabArt, x: number, y: number): { part: number; along: number } {
  if (inCrabBody(art, x, y)) return { part: -2, along: 0 };
  let best = -1, bd = LINE_REACH, along = 0;
  art.parts.forEach((p, j) => { const q = lineProject(p.line, x, y); if (q.d < bd) { bd = q.d; best = j; along = q.s / q.total; } });
  return { part: best, along };
}

/** 모델 짓기(crab-build)의 다리 나누기 — 가운데 선까지 거리를 그 다리의 반폭으로 나눈 값이 가장 작은 다리(굵은 집게 위의 가는 더듬이 · 굵은 다리 위의 가는 발끝이
 *  서로 제 몫을 갖는다). radius(j, s): 다리 j 의 뿌리에서 s px 지점의 반폭(그림의 거리 지도에서 잰다). 어느 선에서도 LINE_REACH 밖이면 어느 다리도 아니다 */
export function crabLabeler(art: CrabArt, radius: (j: number, s: number) => number) {
  return (x: number, y: number): { part: number; along: number } => {
    if (inCrabBody(art, x, y)) return { part: -2, along: 0 };
    let best = -1, score = Infinity, along = 0;
    art.parts.forEach((p, j) => { const q = lineProject(p.line, x, y), k = q.d / Math.max(2, radius(j, q.s)); if (q.d <= LINE_REACH && k < score) { score = k; best = j; along = q.s / q.total; } });
    return { part: best, along };
  };
}

/** 걷는 다리의 위상(rad) — 한쪽 앞에서 i 번째(0부터) · 왼쪽(-1)/오른쪽(1). 왼1 · 오2 · 왼3 · 오4 가 한 무리(0), 그 반대가 다른 무리(π) */
export const legPhase = (i: number, side: number) => ((i + (side < 0 ? 0 : 1)) % 2) * Math.PI + i * GAIT.wave;

export type CrabPartInfo = { kind: CrabKind; side: number; index: number; phase: number; vertices: number; pivot: [number, number]; length: number };
/** 정점마다 다리 자료 — a: [종류, 뿌리→끝 0~1, 위상, 옆(-1 · 1)] · b: [뿌리 x, 뿌리 z, 길이, 0] (원본 정점 단위).
 *  P: 원본 정점(x 머리 · y 위 · z 오른쪽) · uv: 그 정점의 그림 좌표 · part: 모델에 구워 둔 다리 번호(_AQUA_PART — 4칸마다 첫 칸, +1 · 0 = 없음).
 *  다리 번호는 모델에 구운 것을 쓴다 — 가려진 다리 채움(crab-build)은 위 다리와 같은 그림 자리라 그림 자리만으로는 어느 다리인지 모른다. 없으면(옛 모델) 그림 자리로.
 *  몸통 정점은 종류 0(안 움직인다), 꼬리(바닷가재)는 3 */
export function crabLegData(key: string, P: ArrayLike<number>, uv: ArrayLike<number>, n: number, part?: ArrayLike<number> | null) {
  const fam = crabFamilyOf(key);
  if (!fam || n < 3) return null;
  const art = CRAB_ART[fam], [W, H] = art.size;
  // 그림 픽셀 자리 — 등 · 배가 같은 자리면 같은 값(다리가 위 · 아래로 갈라지지 않게)
  const px = new Float64Array(n), py = new Float64Array(n);
  for (let i = 0; i < n; i++) { const v0 = uv[i * 2 + 1], v = v0 >= 0.5 ? v0 - 0.5 : v0; px[i] = uv[i * 2] * W; py[i] = v * 2 * H; }
  // 그림 → 원본 정점(최소제곱 — 부풀린 판이라 선형이다: 원본 x 는 그림 y 를, 원본 z 는 그림 x 를 따른다)
  const fit = (src: Float64Array, dst: number) => { let a = 0, b = 0, c = 0, d = 0; for (let i = 0; i < n; i++) { const s = src[i], t = P[i * 3 + dst]; a += s; b += t; c += s * s; d += s * t; } const k = (n * d - a * b) / (n * c - a * a); return [k, (b - k * a) / n] as const; };
  const [kx, bx] = fit(py, 0), [kz, bz] = fit(px, 2);
  if (!Number.isFinite(kx) || !Number.isFinite(kz)) return null;
  const parts: CrabPartInfo[] = art.parts.map((p) => ({ kind: p.kind, side: p.side, index: 0, phase: 0, vertices: 0, pivot: [kx * p.line[0][1] + bx, kz * p.line[0][0] + bz], length: 0 }));
  for (const side of [-1, 1]) {
    // 앞(그림 위 = 작은 y)부터 — 걷는 다리만 센다(뿌리 높이로)
    const legs = art.parts.map((p, j) => ({ p, j })).filter(({ p }) => p.kind === "leg" && p.side === side).sort((a, b) => a.p.line[0][1] - b.p.line[0][1]);
    legs.forEach(({ j }, i) => { parts[j].index = i; parts[j].phase = legPhase(i, side); });
  }
  parts.forEach((p, j) => { if (p.kind === "claw") p.phase = j * 1.7; });
  const A = new Float32Array(n * 4), B = new Float32Array(n * 4), label = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let j: number, along = 0;
    if (part && part.length >= n * 4) {
      j = part[i * 4] > 0 && part[i * 4] <= art.parts.length ? part[i * 4] - 1 : inCrabBody(art, px[i], py[i]) ? -2 : -1;
      if (j >= 0) { const q = lineProject(art.parts[j].line, px[i], py[i]); along = q.s / q.total; }
    } else ({ part: j, along } = crabPartAt(art, px[i], py[i]));
    label[i] = j;
    if (j === -2 || (j === -1 && art.tail && py[i] > art.tail[0])) { // 꼬리 둘레(몸통 타원 밖으로 조금 나온 배 가장자리)도 꼬리와 같이
      if (art.tail && py[i] > art.tail[0]) { A[i * 4] = KIND.tail; A[i * 4 + 1] = unit((py[i] - art.tail[0]) / (art.tail[1] - art.tail[0])); B[i * 4 + 2] = Math.abs(kx) * (art.tail[1] - art.tail[0]); }
      continue;
    }
    if (j < 0 || parts[j].kind === "still") { if (j >= 0) label[i] = -1; continue; }
    const p = parts[j];
    p.vertices++; p.length = Math.max(p.length, Math.hypot(P[i * 3] - p.pivot[0], P[i * 3 + 2] - p.pivot[1]));
    A[i * 4] = KIND[p.kind]; A[i * 4 + 1] = along; A[i * 4 + 2] = p.phase; A[i * 4 + 3] = p.side;
    B[i * 4] = p.pivot[0]; B[i * 4 + 1] = p.pivot[1];
  }
  for (let i = 0; i < n; i++) if (label[i] >= 0) B[i * 4 + 2] = parts[label[i]].length;
  return { a: A, b: B, parts, label };
}

/** 그 순간의 걸음 값 — 화면(glb)이 프레임마다 뼈 텍스처의 남는 칸에 쓴다.
 *  gait: 걸음 위상(rad — 엔진의 박자, 실제 빠르기에 묶여 쌓인다) · walk: 걷는 몫 0~1(쉬면 0) · t: 물속 시계(초) · idle: 집게 · 꼬리 몫(움직임 줄이기면 0) */
export type CrabPose = { gait: number; walk: number; t: number; idle: number };
/** 걷는 몫 — 길(course)의 amp 는 쉴 때 0.2, 옮겨 갈 때 0.8 ~ 1 이다. 쉬는 동안엔 박자가 조금 흘러도(BEAT_IDLE_HZ) 다리가 서 있게 0 */
export const walkOf = (amp: number | undefined) => smooth(0.28, 0.75, amp ?? 0);

/** 한 정점의 변형(원본 정점 단위). out 에 [x, y, z] · 돌린 각(세로축)을 돌려준다(법선도 같은 각으로). 셰이더(crabGlsl)와 같은 식 */
export function crabDisplace(x: number, y: number, z: number, a: ArrayLike<number>, b: ArrayLike<number>, i: number, p: CrabPose, out: number[] | Float32Array) {
  const kind = a[i * 4], r = a[i * 4 + 1], ph = a[i * 4 + 2], side = a[i * 4 + 3], L = b[i * 4 + 2];
  out[0] = x; out[1] = y; out[2] = z;
  if (kind === KIND.none) return 0;
  if (kind === KIND.tail) { out[1] = y + L * IDLE.tail * p.idle * r * r * (0.5 + 0.5 * Math.sin(p.t * IDLE.tailRate)); return 0; }
  let ang = 0, lift = 0;
  const root = smooth(0, GAIT.rootBlend, r);
  if (kind === KIND.leg) {
    const psi = p.gait + ph;
    ang = side * GAIT.swing * p.walk * -Math.cos(psi) * root; // 든 동안(sin > 0) 앞(+x)으로, 짚은 동안 뒤로
    lift = GAIT.lift * p.walk * Math.max(0, Math.sin(psi)) * r ** 1.3;
  } else {
    ang = side * IDLE.claw * p.idle * Math.sin(p.t * IDLE.clawRate + ph) * root;
    lift = IDLE.clawLift * p.idle * (0.5 + 0.5 * Math.sin(p.t * IDLE.clawRate * 0.7 + ph)) * r;
  }
  const px = b[i * 4], pz = b[i * 4 + 1], dx = x - px, dz = z - pz, c = Math.cos(ang), s = Math.sin(ang);
  out[0] = px + dx * c + dz * s; out[2] = pz - dx * s + dz * c; out[1] = y + lift * L;
  return ang;
}

/** 정점 셰이더(ASCII 만 — GLSL ES 1.0 은 주석 속 한글도 컴파일 오류로 보는 기기가 있다). crabDisplace 와 같은 식.
 *  aquaCrab = [kind, r, phase, side] · aquaCrabRoot = [pivot x, pivot z, length, 0] · 걸음 값은 뼈 텍스처 남는 칸 첫 텍셀(gait, walk, t, idle).
 *  상수가 계열마다 같아(다리 자료는 정점마다) 대게 · 킹크랩 · 바닷가재가 같은 프로그램을 나눠 써도 된다 */
export function crabGlsl(slot: number) {
  const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  const pars = `#include <skinning_pars_vertex>
#ifdef USE_SKINNING
vec4 aquaCrabP() { int cS = textureSize( boneTexture, 0 ).x; int cJ = ${slot} * 4; return texelFetch( boneTexture, ivec2( cJ % cS, cJ / cS ), 0 ); }
vec3 aquaCrabMove( vec3 p, out float cA ) {
  cA = 0.0;
  float cK = aquaCrab.x;
  if ( cK < 0.5 ) return p;
  vec4 cP = aquaCrabP();
  float cR = aquaCrab.y, cPh = aquaCrab.z, cSd = aquaCrab.w, cL = aquaCrabRoot.z;
  vec3 o = p;
  if ( cK > 2.5 ) { o.y += cL * ${f(IDLE.tail)} * cP.w * cR * cR * ( 0.5 + 0.5 * sin( cP.z * ${f(IDLE.tailRate)} ) ); return o; }
  float cRoot = smoothstep( 0.0, ${f(GAIT.rootBlend)}, cR );
  float cLift = 0.0;
  if ( cK < 1.5 ) {
    float cPsi = cP.x + cPh;
    cA = cSd * ${f(GAIT.swing)} * cP.y * -cos( cPsi ) * cRoot;
    cLift = ${f(GAIT.lift)} * cP.y * max( 0.0, sin( cPsi ) ) * pow( cR, 1.3 );
  } else {
    cA = cSd * ${f(IDLE.claw)} * cP.w * sin( cP.z * ${f(IDLE.clawRate)} + cPh ) * cRoot;
    cLift = ${f(IDLE.clawLift)} * cP.w * ( 0.5 + 0.5 * sin( cP.z * ${f(IDLE.clawRate * 0.7)} + cPh ) ) * cR;
  }
  vec2 cD = p.xz - aquaCrabRoot.xy;
  float cc = cos( cA ), cs = sin( cA );
  o.x = aquaCrabRoot.x + cD.x * cc + cD.y * cs;
  o.z = aquaCrabRoot.y - cD.x * cs + cD.y * cc;
  o.y += cLift * cL;
  return o;
}
#endif`;
  const normal = `#include <beginnormal_vertex>
#ifdef USE_SKINNING
{ float cA; aquaCrabMove( position, cA ); float cc = cos( cA ), cs = sin( cA ); objectNormal.xz = vec2( objectNormal.x * cc + objectNormal.z * cs, -objectNormal.x * cs + objectNormal.z * cc ); }
#endif`;
  const vertex = `#include <begin_vertex>
#ifdef USE_SKINNING
{ float cA; transformed = aquaCrabMove( transformed, cA ); }
#endif`;
  return { pars, normal, vertex };
}
