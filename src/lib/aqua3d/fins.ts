/* 지느러미 막 · 아귀 초롱 자리(2026-11-11) — GLB 정점에서 순수 계산만 한다(three 없음 · 시험이 그대로 부른다).
 * 왜: 등 · 뒷 · 꼬리지느러미 막이 GLB 약 200종에서 한 번도 안 떨렸다. 제작 파이프라인(fish-sculpt)이 지느러미 뼈에 묶는 건 옆으로 튀어나온
 * 가슴지느러미(|z| > 몸 두께)뿐이라 위아래로 붙은 막은 몸통 뼈만 따라갔다(지느러미 뼈 가중치 중앙값 0.9%).
 * GLB 를 다시 굽지 않고(같은 key 를 다시 빌드하면 텍스처 바이트 · 해시가 바뀌어 검수 사진 · 승인이 전부 다시 필요하다) 화면에서 막 정점만 떨게 한다.
 * 막 판정: reference-model 의 타원 규칙(unit((ellipse − .65)·1.5))을 그대로 쓰면 GLB 정점의 70~90% 가 걸렸다(GLB 몸통은 그림에서 잰 윤곽이라 타원보다 크다).
 * 그래서 GLB 모양에서 직접 잰다 — 막은 얇은 판(|z| 거의 0)이고, 같은 x 칸의 두꺼운 정점들(몸통 부피)의 위아래 범위 밖에 있다. 몸통 밖으로 멀수록 크게 떤다. */
const unit = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const BINS = 24;
/** 몸통 부피의 칸별 위아래 범위 — 두꺼운(|z| > thick) 정점만 센다. 빈 칸은 이웃 칸으로 메운다 */
function bodyBands(P: ArrayLike<number>, n: number, minX: number, L: number, thick: number) {
  const lo = new Float64Array(BINS).fill(Infinity), hi = new Float64Array(BINS).fill(-Infinity);
  const bin = (x: number) => Math.min(BINS - 1, Math.max(0, Math.floor(((x - minX) / L) * BINS)));
  for (let i = 0; i < n; i++) if (Math.abs(P[i * 3 + 2]) > thick) { const b = bin(P[i * 3]); lo[b] = Math.min(lo[b], P[i * 3 + 1]); hi[b] = Math.max(hi[b], P[i * 3 + 1]); }
  let first = -1, last = -1;
  for (let b = 0; b < BINS; b++) if (lo[b] <= hi[b]) { if (first < 0) first = b; last = b; }
  for (let b = first + 1; b < last; b++) if (!(lo[b] <= hi[b])) {
    const l = b - 1; let r = b + 1; while (!(lo[r] <= hi[r])) r++;
    const f = (b - l) / (r - l); lo[b] = lo[l] + (lo[r] - lo[l]) * f; hi[b] = hi[l] + (hi[r] - hi[l]) * f;
  }
  return { lo, hi, first, last, bin };
}
function extent(P: ArrayLike<number>, n: number) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, maxX, minY, maxY, L: Math.max(1e-6, maxX - minX) };
}
/** 막 흔들림 최대 폭 — 몸길이의 비율(GLB 물고기는 길이 약 2라 0.045 단위). 셰이더가 세기(1 보통 · 펼치면 2 남짓)를 곱한다 */
export const FLUTTER_AMP = 0.0225;
/** 정점마다 막 가중치(0~1)와 몸 앞뒤 자리(0 꼬리 끝 ~ 1 주둥이).
 *  P: 쉬는 자세의 정점 위치(x 앞 · y 위 · z 옆, 몸 단위) · finBone: 그 정점이 지느러미 뼈(fin_*)에 묶인 몫 — 이미 뼈로 펄럭이는 가슴지느러미는 겹쳐 떨지 않게 뺀다 */
export function membraneWeights(P: ArrayLike<number>, finBone: ArrayLike<number>) {
  const n = Math.floor(P.length / 3), { minX, L } = extent(P, n);
  const thin = 0.012 * L, thick = 0.02 * L, root = 0.02 * L, reach = 0.1 * L;
  const { lo, hi, first, last, bin } = bodyBands(P, n, minX, L, thick);
  const w = new Float32Array(n), u = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    u[i] = (x - minX) / L;
    if (first < 0 || Math.abs(z) >= thin) continue;
    let b = bin(x), dx = 0;
    if (b < first) { dx = ((first - b) / BINS) * L; b = first; } else if (b > last) { dx = ((b - last) / BINS) * L; b = last; }
    const d = Math.max(dx, lo[b] - y, y - hi[b], 0);
    w[i] = unit((d - root) / reach) * (1 - unit(finBone[i] ?? 0));
  }
  return { w, u };
}
/** 아귀 초롱(유인돌기 끝) 자리 — 머리 위로 솟은 얇은 판(막과 같은 판정) 가운데 가장 높은 곳에서 앞으로 가장 나온 점.
 *  주둥이 쪽 가장 앞 정점은 치어에선 아래턱이라(y −0.41) '가장 앞'만으로는 안 된다. 없으면 null */
export function lurePoint(P: ArrayLike<number>): [number, number, number] | null {
  const n = Math.floor(P.length / 3), { minX, minY, maxY, L } = extent(P, n), H = Math.max(1e-6, maxY - minY);
  const { hi, first, last, bin } = bodyBands(P, n, minX, L, 0.02 * L);
  if (first < 0) return null;
  let top = -Infinity;
  const ok = (i: number) => {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], b = Math.min(last, Math.max(first, bin(x)));
    return (x - minX) / L > 0.55 && Math.abs(z) < 0.012 * L && y > hi[b] + 0.03 * L;
  };
  for (let i = 0; i < n; i++) if (ok(i)) top = Math.max(top, P[i * 3 + 1]);
  if (!Number.isFinite(top)) return null;
  // 꼭대기 띠(높이의 12% 안)에서 가장 앞 — 유인돌기는 앞으로 휘어 끝에 초롱이 달린다
  let best = -1;
  for (let i = 0; i < n; i++) if (ok(i) && P[i * 3 + 1] > top - 0.12 * H && (best < 0 || P[i * 3] > P[best * 3])) best = i;
  return best < 0 ? null : [P[best * 3], P[best * 3 + 1], P[best * 3 + 2]];
}
