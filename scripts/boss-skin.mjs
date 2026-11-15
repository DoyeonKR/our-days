// 주인 전용 3D 피부(2026-11-15) [사용자: "산호 여왕과 검은파도 지금 내가 잡아서 수조에 키우고 있는데 모델이 예전과 동일해"]
// 수조의 물고기 GLB 는 옆모습 그림(public/aqua/fish/<종>.webp) 을 그대로 감싼 텍스처를 쓴다(그림 좌표 = uv).
// 주인 그림(public/aqua/fish/boss_<key>.webp)은 같은 자세지만 윤곽이 조금 다르다 — 세로줄마다 주인 그림의 몸 위 · 아래를 종 그림의 몸 위 · 아래에 맞춰 늘려
// 종 모델의 uv 에 그대로 맞는 피부를 굽는다. 몸 밖은 위 · 아래 가장자리 색을 끌어 늘린다(GLB 텍스처의 번짐과 같다 — 밉맵 · 필터가 배경을 끌어오지 않게).
// 실행: node scripts/boss-skin.mjs   → public/aqua/boss/<boss>.webp
import sharp from "sharp";

const JOBS = [{ boss: "boss_geomeun", species: "bluefin_tuna" }];
const N = 512;

async function rgba(file) {
  const { data, info } = await sharp(file).resize(N, N, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(file);
  return data;
}
/** 열마다 몸 위 · 아래(알파 > 128). 몸이 없는 열은 null */
function columns(px) {
  const cols = [];
  for (let x = 0; x < N; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < N; y++) if (px[(y * N + x) * 4 + 3] > 128) { if (t < 0) t = y; b = y; }
    cols.push(t < 0 ? null : [t, b]);
  }
  return cols;
}
/** 지느러미를 걷어 낸 몸 윤곽 — 열마다 위 · 아래를 앞뒤 ±R 열의 가운데값으로(등 · 배지느러미 뾰족한 데가 몸으로 안 들어온다) */
function envelope(cols, R = 28) {
  return cols.map((c, x) => {
    if (!c) return null;
    const ts = [], bs = [];
    for (let d = -R; d <= R; d++) { const o = cols[x + d]; if (o) { ts.push(o[0]); bs.push(o[1]); } }
    ts.sort((a, b) => a - b); bs.sort((a, b) => a - b);
    return [ts[ts.length >> 1], bs[bs.length >> 1]];
  });
}
const range = (cols) => { const xs = cols.map((c, i) => c ? i : -1).filter((i) => i >= 0); return [xs[0], xs[xs.length - 1]]; };

for (const { boss, species } of JOBS) {
  const sp = await rgba(`public/aqua/fish/${species}.webp`), bp = await rgba(`public/aqua/fish/${boss}.webp`);
  const sc = columns(sp), bc = columns(bp), [s0, s1] = range(sc), [b0, b1] = range(bc), se = envelope(sc), be = envelope(bc);
  const out = Buffer.alloc(N * N * 4);
  const sample = (x, y) => { const xi = Math.max(0, Math.min(N - 1, Math.round(x))), yi = Math.max(0, Math.min(N - 1, Math.round(y))), i = (yi * N + xi) * 4; return [bp[i], bp[i + 1], bp[i + 2], bp[i + 3]]; };
  for (let x = 0; x < N; x++) {
    const c = sc[x];
    if (!c) continue;
    // 가로: 종 그림의 몸 범위 ↔ 주인 그림의 몸 범위
    const bx = b0 + (x - s0) / Math.max(1, s1 - s0) * (b1 - b0);
    let bcol = be[Math.round(bx)];
    for (let d = 1; !bcol && d < 20; d++) bcol = be[Math.round(bx) + d] ?? be[Math.round(bx) - d];
    const scol = se[x];
    if (!bcol || !scol) continue;
    // 세로: 종 그림의 몸 윤곽(지느러미 뺀) → 주인 그림의 몸 윤곽. 지느러미는 같은 비율로 윤곽 밖으로 이어진다
    const k = (bcol[1] - bcol[0]) / Math.max(1, scol[1] - scol[0]);
    for (let y = c[0]; y <= c[1]; y++) {
      const by = bcol[0] + (y - scol[0]) * k;
      let [r, g, b, a] = sample(bx, by);
      // 주인 그림에서 비어 있는 자리(지느러미 모양 차이)는 가장 가까운 칠해진 점으로 — 위아래로 찾는다
      for (let d = 1; a < 100 && d < 40; d++) { const up = sample(bx, by - d), dn = sample(bx, by + d); if (up[3] >= 100) { [r, g, b, a] = up; break; } if (dn[3] >= 100) { [r, g, b, a] = dn; break; } }
      if (a < 100) { const i = (y * N + x) * 4; [r, g, b] = [sp[i] * .45, sp[i + 1] * .45, sp[i + 2] * .5]; }
      const o = (y * N + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
    // 몸 위 · 아래는 가장자리 색을 끌어 늘린다
    for (let y = 0; y < c[0]; y++) { const o = (y * N + x) * 4, e = (c[0] * N + x) * 4; out.copyWithin(o, e, e + 4); }
    for (let y = c[1] + 1; y < N; y++) { const o = (y * N + x) * 4, e = (c[1] * N + x) * 4; out.copyWithin(o, e, e + 4); }
  }
  // 몸이 없는 열은 가까운 열을 끌어 온다
  for (let x = 0; x < N; x++) if (!sc[x]) { const src = x < s0 ? s0 : s1; for (let y = 0; y < N; y++) { const o = (y * N + x) * 4, e = (y * N + src) * 4; out.copyWithin(o, e, e + 4); } }
  await sharp(out, { raw: { width: N, height: N, channels: 4 } }).removeAlpha().webp({ quality: 88 }).toFile(`public/aqua/boss/${boss}.webp`);
  console.log(`boss skin ${boss} ← ${species}: species x ${s0}..${s1}, boss x ${b0}..${b1}`);
}
