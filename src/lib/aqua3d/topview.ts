/* 위에서 본 몸 윤곽(2026-11-12) [사용자: "모델들 탑뷰에서 보면 각이 라운드져 있어 어색해 실제 물고기의 탑뷰와 비교해서 업그레이드해"]
 * 왜: 모델(fish-sculpt)의 몸은 두 겹이다 — ① 고리를 쌓은 몸통 튜브(정점 앞쪽에 고리 41개 × 17) ② 그림 실루엣 모양의 판(지느러미까지, 가운데가 두툼한 렌즈).
 *  튜브의 옆 폭(z)은 그림의 몸 높이를 그대로 따라서(side = depth · (half / hMax)^.85) 위에서 보면
 *   · 꼬리지느러미가 높은 붕어 · 잉어 · 연어는 꼬리 쪽이 다시 부풀어 병 모양,
 *   · 렌즈 판의 두툼한 가운데가 튜브 위로 삐져나와 등에 어두운 원판(고등어 · 연어 · 백상아리의 '구슬 · 움푹 팬 그릇')이 보였다.
 *  실제 물고기를 위에서 보면 주둥이는 둥글고, 아가미 뒤(몸길이의 약 30% 자리)가 가장 넓고, 꼬리자루로 매끈하게 가늘어진 뒤 꼬리지느러미는 얇은 판이다(방추형).
 *  그래서 ① 튜브 고리마다 옆 폭을 방추형 목표에 맞추고 ② 판은 몸 단면(타원) 안으로 넣고, 몸통 위아래 밖(등 · 뒷지느러미)은 얇은 판으로 편다.
 *  ③ 몸 밖으로 튀어나온 것(가슴지느러미 · 혹)은 몸 표면이 옮겨 간 만큼 함께 옮긴다.
 * GLB 를 다시 굽지 않는다(같은 key 를 다시 빌드하면 텍스처 · 해시가 바뀌어 검수를 다시 해야 한다 — fins.ts 와 같은 이유). 몸 높이 · 옆모습은 그대로(z 만 움직인다).
 * three 없음 — 시험이 그대로 부른다. */
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** 꼬리자루 폭 / 가장 넓은 폭 — 실제 방추형 물고기(붕어 · 고등어 · 연어)는 0.15~0.3 */
export const PEDUNCLE = 0.24;
/** 지느러미 판 두께(몸길이 비율) — 위에서 보면 선 하나 */
const FIN_HALF = 0.003;
/** 등 꼭대기에서 그림을 찍는 높이 — 몸 반 높이의 이만큼 안쪽 */
export const TOP_PULL = 0.3;

type Ring = { x: number; yc: number; half: number; side: number; k: number; top: number; bot: number; w: number };
/** 지느러미 혹을 깎아 내는 창(고리 수, 한쪽) — 등 · 뒷지느러미는 몸길이의 10~20% 라 이보다 좁은 혹은 몸이 아니라 지느러미로 본다 */
const FIN_WINDOW = 4;
/** 열기(최소 → 최대 거름) — 창보다 좁게 솟은 봉우리를 깎는다 */
function opening(a: number[], w: number): number[] {
  const n = a.length, lo = a.map((_, i) => Math.min(...a.slice(Math.max(0, i - w), Math.min(n, i + w + 1))));
  return lo.map((_, i) => Math.max(...lo.slice(Math.max(0, i - w), Math.min(n, i + w + 1))));
}

/** 정점 앞쪽의 튜브 고리 — x 가 같은 정점 R 개가 이어지는 묶음이 몇 개 연달아 있나. 없으면 null */
export function tubeRings(P: ArrayLike<number>, L: number): { R: number; count: number } | null {
  const n = Math.floor(P.length / 3), tol = 1e-4 * L;
  let R = 1;
  while (R < n && Math.abs(P[R * 3] - P[0]) <= tol) R++;
  if (R < 8 || R > 64) return null;
  let count = 0;
  for (let r = 0; (r + 1) * R <= n; r++) {
    const x0 = P[r * R * 3];
    let same = true;
    for (let j = 1; j < R && same; j++) same = Math.abs(P[(r * R + j) * 3] - x0) <= tol;
    if (!same || (r + 1) * R < n && Math.abs(P[(r + 1) * R * 3] - x0) <= tol) break;
    count++;
  }
  return count >= 16 ? { R, count } : null;
}

/** 방추형 목표 폭 — u: 0 꼬리 끝 ~ 1 주둥이, um 가장 넓은 자리, up 꼬리자루 */
export function fusiformWidth(u: number, um: number, up: number): number {
  if (u >= um) { const t = (u - um) / (1 - um); return Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.55); } // 둥근 주둥이
  if (u >= up) { const s = (u - up) / (um - up), e = s * s * (3 - 2 * s); return PEDUNCLE + (1 - PEDUNCLE) * e; } // 꼬리자루로 매끈하게
  return PEDUNCLE * (0.35 + 0.65 * (u / Math.max(1e-6, up))); // 꼬리지느러미 쪽은 얇게
}

/** 정점마다 새 옆 폭(z, 몸 단위)과 튜브 정점의 폭 배율(법선용, 그 밖은 1). P: 쉬는 자세 위치(x 앞 · y 위 · z 옆) · finBone: 지느러미 뼈에 묶인 몫.
 *  튜브가 없거나 바뀌는 게 없으면 null */
export function topViewWidths(P: ArrayLike<number>, finBone: ArrayLike<number>, UV?: ArrayLike<number>): { z: Float32Array; y: Float32Array; k: Float32Array; v: Float32Array | null } | null {
  const n = Math.floor(P.length / 3);
  if (n < 60) return null;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < n; i++) { const x = P[i * 3]; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const L = maxX - minX;
  if (!(L > 1e-6)) return null;
  const tube = tubeRings(P, L);
  if (!tube) return null;
  const { R, count } = tube;
  // 고리마다 가운데 높이 · 위아래 반 높이 · 옆 반 폭
  const rings: Ring[] = [];
  for (let r = 0; r < count; r++) {
    let y0 = Infinity, y1 = -Infinity, side = 0;
    for (let j = 0; j < R; j++) { const i = r * R + j, y = P[i * 3 + 1], z = Math.abs(P[i * 3 + 2]); if (y < y0) y0 = y; if (y > y1) y1 = y; if (z > side) side = z; }
    rings.push({ x: P[r * R * 3], yc: (y0 + y1) / 2, half: (y1 - y0) / 2, side, k: 1, top: y1, bot: y0, w: side });
  }
  rings.sort((a, b) => a.x - b.x);
  // 몸통 튜브는 등 · 뒷지느러미 자리까지 솟아 있다(그림 윤곽을 그대로 따서) — 위에서 보면 지느러미가 몸처럼 두꺼운 원판이었다.
  // 위 · 아래 윤곽에서 좁은 봉우리를 깎아 '몸' 높이를 얻고, 몸의 폭은 몸 가운데 높이에서 잰다
  const tops = opening(rings.map((g) => g.top), FIN_WINDOW), bots = opening(rings.map((g) => -g.bot), FIN_WINDOW).map((v) => -v);
  rings.forEach((g, i) => {
    g.top = Math.min(g.top, tops[i]); g.bot = Math.max(g.bot, bots[i]);
    const dy = g.half > 1e-9 ? ((g.top + g.bot) / 2 - g.yc) / g.half : 0;
    g.w = g.side * Math.sqrt(Math.max(0.05, 1 - dy * dy));
  });
  const x0 = rings[0].x, x1 = rings[rings.length - 1].x, span = Math.max(1e-6, x1 - x0);
  const uOf = (x: number) => clamp((x - x0) / span, 0, 1);
  let wMax = 0, uMax = 0.66;
  for (const g of rings) if (g.w > wMax) { wMax = g.w; uMax = uOf(g.x); }
  if (!(wMax > 1e-6)) return null;
  const um = clamp(uMax, 0.6, 0.75);
  // 꼬리자루 — 뒤쪽 12~38% 에서 가장 가는 고리(꼬리가 다시 부푸는 모델은 그 잘록한 곳)
  let up = 0.25, wp = Infinity;
  for (const g of rings) { const u = uOf(g.x); if (u >= 0.12 && u <= 0.38 && g.w < wp) { wp = g.w; up = u; } }
  for (const g of rings) {
    if (!(g.w > 1e-6)) continue;
    const u = uOf(g.x);
    let k = clamp((wMax * fusiformWidth(u, um, up)) / g.w, 0.3, 1.3); // 넓히기는 조금만 — 원래 얇은 물고기(디스커스 · 엔젤)가 두꺼워지지 않게
    if (u < up) k = Math.min(1, k); // 꼬리 쪽은 줄이기만
    g.k = k;
  }
  // 고리 사이 값(x 로 보간)
  const at = (x: number) => {
    if (x <= rings[0].x) return rings[0];
    if (x >= rings[rings.length - 1].x) return rings[rings.length - 1];
    let lo = 0, hi = rings.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rings[m].x <= x) lo = m; else hi = m; }
    const a = rings[lo], b = rings[hi], f = (x - a.x) / Math.max(1e-9, b.x - a.x);
    const mix = (p: number, q: number) => p + (q - p) * f;
    return { x, yc: mix(a.yc, b.yc), half: mix(a.half, b.half), side: mix(a.side, b.side), k: mix(a.k, b.k), top: mix(a.top, b.top), bot: mix(a.bot, b.bot), w: mix(a.w, b.w) };
  };
  const z = new Float32Array(n), y = new Float32Array(n), kOut = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) y[i] = P[i * 3 + 1];
  /** 판의 테두리 띠 — 튜브 꼭대기 · 바닥 바로 밖(몸길이의 이만큼 안)은 몸 윤곽선이다. 위에서 보면 등을 따라 가는 줄(밝고 어두운 테두리 색)로 보였다 */
  const rim = 0.05 * L, tuck = 0.004 * L;
  const tubeN = count * R, fin = FIN_HALF * L;
  let changed = false;
  for (let i = 0; i < n; i++) {
    const zi = P[i * 3 + 2], a = Math.abs(zi), sg = zi < 0 ? -1 : 1;
    z[i] = zi;
    const g = at(P[i * 3]);
    if (i < tubeN) {
      // 몸 위아래 밖(깎아 낸 지느러미 혹)은 끝으로 갈수록 얇은 판으로
      const y = P[i * 3 + 1], hiY = g.yc + g.half, loY = g.yc - g.half;
      const e = y > g.top ? (y - g.top) / Math.max(1e-9, hiY - g.top) : y < g.bot ? (g.bot - y) / Math.max(1e-9, g.bot - loY) : 0;
      const taper = e > 0 ? Math.pow(1 - clamp(e, 0, 1), 1.6) : 1;
      z[i] = (zi < 0 ? -1 : 1) * Math.max(a * g.k * taper, Math.min(a, fin));
      kOut[i] = g.k;
    }
    else if ((finBone[i] ?? 0) >= 0.3 || a > g.side * 1.02) z[i] = zi + sg * g.side * (g.k - 1); // 몸 밖으로 튀어나온 것 — 몸 표면을 따라 옮긴다
    else {
      // 판의 테두리 띠는 튜브 안으로 접어 넣는다(진짜 지느러미는 띠보다 길어 남는다) — 옆모습 윤곽은 몸길이의 0.5% 안쪽으로 줄 뿐이다
      const hiY = g.yc + g.half, loY = g.yc - g.half, yi = P[i * 3 + 1];
      if (yi > hiY && yi - hiY < rim) { y[i] = hiY - tuck; changed = true; }
      else if (yi < loY && loY - yi < rim) { y[i] = loY + tuck; changed = true; }
      // 판 — 몸 단면(타원) 안으로. 몸통 위아래 밖(등 · 뒷지느러미 자리)은 얇은 지느러미 판
      const dy = g.half > 1e-6 ? (y[i] - g.yc) / g.half : 2;
      const inside = g.side * g.k * 0.97 * Math.sqrt(Math.max(0, 1 - dy * dy));
      z[i] = sg * Math.max(Math.min(a * g.k, inside), Math.min(a, fin));
    }
    if (Math.abs(z[i] - zi) > 1e-7 * L) changed = true;
  }
  // 등의 그림 자리 — 튜브 윗면은 그림의 몸 테두리 · 등지느러미 자리에 닿아, 지느러미 · 번진 테두리 색을 찍었다(위에서 보면 등 한가운데 원판).
  // 예전엔 위쪽 끝만 한 줄로 눌러서, 위에서 보면 같은 몇 줄을 넓게 늘인 '줄무늬 · 번진 결'이 됐다(2026-11-12 사용자: 탑뷰 어색).
  // 이제 고리의 윗반쪽을 각도에 고르게 펴서 몸 가운데 높이 → 몸 꼭대기 조금 안쪽(지느러미 혹을 깎은 높이)까지 찍는다. 옆 가운데(각도 0)는 그대로라 아랫반쪽과 이어진다
  let v: Float32Array | null = null;
  if (UV && UV.length >= tubeN * 2) {
    v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = UV[i * 2 + 1];
    for (let rr = 0; rr < count; rr++) {
      let iLo = rr * R, iHi = rr * R;
      for (let j = 0; j < R; j++) { const i = rr * R + j; if (P[i * 3 + 1] < P[iLo * 3 + 1]) iLo = i; if (P[i * 3 + 1] > P[iHi * 3 + 1]) iHi = i; }
      const y0 = P[iLo * 3 + 1], y1 = P[iHi * 3 + 1], dyR = y1 - y0;
      if (!(dyR > 1e-9)) continue;
      const slope = (UV[iHi * 2 + 1] - UV[iLo * 2 + 1]) / dyR, g = at(P[rr * R * 3]);
      const ycR = (y0 + y1) / 2, halfR = dyR / 2;
      // 고리 위쪽 55% 아래는 찍지 않는다 — 주둥이 끝은 혹 깎기(열기)가 꼭대기를 너무 낮춰 흰 배 쪽을 찍었다(백상아리 머리 위 흰 무늬)
      const yIn = Math.max(ycR + 0.55 * halfR, g.top - TOP_PULL * (g.top - g.bot) / 2);
      if (!(yIn > ycR)) continue;
      for (let j = 0; j < R; j++) {
        const i = rr * R + j, yy = P[i * 3 + 1], c = (yy - ycR) / halfR;
        if (c <= 0) continue;
        const f = 1 - Math.acos(Math.min(1, c)) / (Math.PI / 2); // 0 옆 가운데 ~ 1 꼭대기, 각도에 고르게
        const ys = ycR + f * (yIn - ycR);
        v[i] = UV[i * 2 + 1] + slope * (ys - yy);
      }
    }
    changed = true;
  }
  return changed ? { z, y, k: kOut, v } : null;
}
