// 위에서 본 기준 그림(polar/model-art/<key>-top.png — ref-art.mjs)을 crab-build 로 둥글게 부풀린다(2026-11-25 클리오네 · 남극 대왕등각류)
//   클리오네: 몸 · 날개가 그대로 둥근 입체(날개는 가장자리라 얇다), 처짐 없음, 반투명(BLEND .62).
//   등각류: 등딱지는 낮은 돔, 다리는 몸에서 멀수록 바닥으로 처진다(게와 같다).
// node design/aqua3d-review/polar/top-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {crabGLB} from '../crab-build.mjs';
import sharp from 'sharp';
/** 클리오네 날개 — 줄마다 가운데 열이 든 불투명 구간의 반폭을 재고, 그 폭이 둘레 줄 가운데값의 1.5배를 넘는 줄(날개가 붙은 줄)은 위아래 몸 줄 폭으로 잇는다.
 *  몸 반폭 밖(날개)은 두께를 0.16 배로 — 실제 날개는 얇은 막이다(그대로 부풀리면 둥근 덩어리였다) */
async function wingThin(file) { const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true}), W = info.width, H = info.height; let sx = 0, n = 0; for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 60) { sx += i % W; n++; } const cx = Math.round(sx / n), w = new Float32Array(H).fill(NaN);
  for (let y = 0; y < H; y++) { if (data[(y * W + cx) * 4 + 3] <= 60) continue; let a = cx, b = cx; while (a > 0 && data[(y * W + a - 1) * 4 + 3] > 60) a--; while (b < W - 1 && data[(y * W + b + 1) * 4 + 3] > 60) b++; w[y] = Math.max(cx - a, b - cx); }
  const ok = [...w].filter(Number.isFinite).sort((p, q) => p - q), med = ok[ok.length >> 1], body = Float32Array.from(w, (v) => (Number.isFinite(v) && v < med * 1.5 ? v : NaN));
  for (let y = 0; y < H; y++) if (!Number.isFinite(body[y]) && Number.isFinite(w[y])) { let a = y, b = y; while (a > 0 && !Number.isFinite(body[a])) a--; while (b < H - 1 && !Number.isFinite(body[b])) b++; const va = body[a], vb = body[b]; body[y] = Number.isFinite(va) && Number.isFinite(vb) ? va + (vb - va) * (y - a) / (b - a) : (va || vb || med); }
  return (x, y) => { const bw = body[Math.max(0, Math.min(H - 1, y))]; const d = Math.abs(x - cx) - (bw || med); return d <= 0 ? 1 : d < 6 ? 1 - .84 * d / 6 : .16; }; }
const OPT = {
  clione: {dome: 1, droop: 0, alpha: .62, belly: .12, source: 'NOAA NMFS AFSC photo "Sea angel" (Matt Wilson / Jay Clark, public domain)'},
  giant_isopod: {dome: .62, droop: .55, belly: .45, source: 'W. S. Bruce, Scottish National Antarctic Expedition photo (public domain)'},
};
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OPT).flatMap((k) => ['fry_' + k, 'juv_' + k, k]);
for (const key of keys) { const fam = key.replace(/^(fry|juv)_/, ''), top = `design/aqua3d-review/polar/model-art/${key}-top.png`; const {glb, tris} = await crabGLB(key, top, {...OPT[fam], ...(fam === 'clione' ? {zmul: await wingThin(top)} : {})}); if (tris > 8000 || glb.length > 300000) throw Error(key + ' ' + tris + ' ' + glb.length); await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, glb.length); }
