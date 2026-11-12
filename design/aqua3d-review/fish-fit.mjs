/** 몸통을 기준 그림의 윤곽에 맞춘다 [사용자: "모델 자체가 기준 이미지와 비슷할 수 있도록"]
 * 옛 몸통은 계열마다 같은 타원이라 주둥이 · 등 · 꼬리자루가 그림과 달랐다. 세로줄마다 그림에서 몸의 위 · 아래를 재어 고리를 쌓는다.
 * 지느러미는 몸 두께가 없으므로 깎아 내고 잰다(열림 연산) — 얇은 곳은 fish-sculpt 의 지느러미 막이 맡는다. */
export function fitBody(ref, N = 200, coreFraction = .34) {
  const [l, t, r, b] = ref.bounds, w = r - l, h = b - t, rows = Math.max(8, Math.round(N * h / w));
  const at = (i, j) => { const x = Math.min(ref.info.width - 1, Math.round(l + (i + .5) / N * w)), y = Math.min(ref.info.height - 1, Math.round(t + (j + .5) / rows * h)); return ref.data[(y * ref.info.width + x) * 4 + 3] > 96; };
  const full = new Uint8Array(N * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) full[j * N + i] = at(i, j) ? 1 : 0;
  // 칸마다 '바깥까지 거리'를 잰다(챔퍼 거리)
  const distance = (inside) => {
    const d = new Float32Array(N * rows).fill(1e6), D = 1.414;
    for (let k = 0; k < d.length; k++) if (!inside[k]) d[k] = 0;
    const edge = (i, j) => (i < 0 || j < 0 || i >= N || j >= rows ? 0 : d[j * N + i]);
    for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (d[k]) d[k] = Math.min(d[k], edge(i - 1, j) + 1, edge(i, j - 1) + 1, edge(i - 1, j - 1) + D, edge(i + 1, j - 1) + D); }
    for (let j = rows - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const k = j * N + i; if (d[k]) d[k] = Math.min(d[k], edge(i + 1, j) + 1, edge(i, j + 1) + 1, edge(i + 1, j + 1) + D, edge(i - 1, j + 1) + D); }
    return d;
  };
  const inner = distance(full);
  let dmax = 0; for (const v of inner) dmax = Math.max(dmax, v);
  const R = Math.max(1.5, dmax * coreFraction);
  // 깎았다가(>= R) 다시 불린다(< R) — 지느러미는 사라지고 몸만 남는다
  const notCore = new Uint8Array(N * rows); for (let k = 0; k < notCore.length; k++) notCore[k] = inner[k] >= R ? 0 : 1;
  const toCore = distance(notCore);
  const open = new Uint8Array(N * rows); for (let k = 0; k < open.length; k++) open[k] = full[k] && toCore[k] < R + .5 ? 1 : 0;
  // 가장 큰 덩어리만
  const label = new Int32Array(N * rows), sizes = [0];
  for (let k = 0; k < open.length; k++) if (open[k] && !label[k]) { const id = sizes.length, q = [k]; label[k] = id; let n = 0; while (q.length) { const c = q.pop(); n++; const i = c % N; for (const m of [i ? c - 1 : -1, i < N - 1 ? c + 1 : -1, c - N, c + N]) if (m >= 0 && m < open.length && open[m] && !label[m]) { label[m] = id; q.push(m); } } sizes.push(n); }
  const main = sizes.indexOf(Math.max(...sizes));
  // i 줄에서 near 를 지나는 칸 묶음(near 가 없으면 가장 긴 묶음)
  const span = (mask, i, near) => {
    let best = null;
    for (let j = 0; j < rows;) { if (!mask(i, j)) { j++; continue; } let e = j; while (e + 1 < rows && mask(i, e + 1)) e++; const hit = near === undefined ? e - j : (near >= j - 1 && near <= e + 1 ? 1e6 : -Math.min(Math.abs(near - j), Math.abs(near - e))); if (!best || hit > best.hit) best = { lo: j, hi: e, hit }; j = e + 1; }
    return best;
  };
  const inMain = (i, j) => label[j * N + i] === main, inFull = (i, j) => full[j * N + i] === 1;
  const cols = new Array(N).fill(null);
  for (let i = 0; i < N; i++) { const s = span(inMain, i); if (s) cols[i] = { c: (s.lo + s.hi + 1) / 2, h: (s.hi - s.lo + 1) / 2 }; }
  let a = cols.findIndex(Boolean), z = N - 1 - [...cols].reverse().findIndex(Boolean);
  // 양 끝은 지느러미가 벌어지기 전까지 원래 윤곽을 따라간다 — 꼬리자루와 주둥이
  for (const [dir, start] of [[-1, a], [1, z]]) {
    let prev = cols[start];
    for (let i = start + dir; i >= 0 && i < N; i += dir) {
      const s = span(inFull, i, prev.c); if (!s || s.hit < 1e6) break;
      const half = (s.hi - s.lo + 1) / 2; if (half > prev.h * 1.25) break;
      prev = { c: (s.lo + s.hi + 1) / 2, h: half }; cols[i] = prev; if (dir < 0) a = i; else z = i;
    }
  }
  for (let i = a; i <= z; i++) if (!cols[i]) cols[i] = { ...cols[i - 1] };
  // 울퉁불퉁한 칸을 고른다
  for (let pass = 0; pass < 3; pass++) { const copy = cols.map((c) => c && { ...c }); for (let i = a + 1; i < z; i++) { for (const k of ['c', 'h']) cols[i][k] = (copy[i - 1][k] + 2 * copy[i][k] + copy[i + 1][k]) / 4; } }
  let hMax = 0, mid = a; for (let i = a; i <= z; i++) if (cols[i].h > hMax) { hMax = cols[i].h; mid = i; }
  const u = (i) => (i + .5) / N;
  const sample = (s) => { const f = a + s * (z - a), i = Math.min(z - 1, Math.floor(f)), g = f - i, A = cols[i], B = cols[Math.min(z, i + 1)]; return { u: u(f), center: (A.c * (1 - g) + B.c * g) / rows, half: (A.h * (1 - g) + B.h * g) / rows }; };
  return { sample, s0: u(a), s1: u(z), cMid: cols[mid].c / rows, hMax: hMax / rows, uMid: u(mid) };
}
