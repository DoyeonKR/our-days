// 남극성게 3D — 기준 사진에서 짓는다(2026-11-25 [사용자: "기준이미지 없이 모델을 만드니 그렇게 허접하게 만들지 너무 다르잖아 실제 어종과"])
// 기준: 스미스소니언 표본 사진 USNM E21812(CC0, 옆모습) → ref-art.mjs 가 오린 model-art/antarctic_urchin-side.png.
// 껍데기: 사진의 줄마다 반폭(가시 끝까지)의 0.86 배를 반지름으로 세운 회전체(납작한 공 · 바닥이 평평하다). 무늬는 사진을 그대로 앞뒤로 투영한다.
// 가시: 황금각으로 고루 420 개(세모 원뿔, 바닥 쪽은 짧다) — 길이는 사진에서 잰 가시 띠(반폭 − 껍데기), 색은 뿌리 자리의 사진 색에서 끝으로 밝게.
// node design/aqua3d-review/polar/urchin-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {Model, bake, spineWeight, clamp, mix, noise, norm, add} from './kit.mjs';

const {data, info} = await sharp('design/aqua3d-review/polar/model-art/antarctic_urchin-side.png').ensureAlpha().raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
// 줄마다 왼쪽 · 오른쪽 끝(가시 끝까지)
const L = new Float32Array(H), Rt = new Float32Array(H); let cxs = 0, cn = 0;
for (let y = 0; y < H; y++) { let a = -1, b = -1; for (let x = 0; x < W; x++) if (A(x, y) > 90) { if (a < 0) a = x; b = x; } L[y] = a; Rt[y] = b; if (a >= 0) { cxs += (a + b) / 2; cn++; } }
const CX = cxs / cn, HW = Math.max(...Array.from(L, (a, y) => (a >= 0 ? (Rt[y] - a) / 2 : 0)));
let y0 = 0, y1 = H - 1; while (L[y0] < 0) y0++; while (L[y1] < 0) y1--;
const S = 1 / HW; // 모델 단위: 가장 넓은 반폭 = 1
// 반폭을 고르게(가시 털이 줄마다 들쭉날쭉)
const hw = (y) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { const j = Math.round(y) + k; if (j < y0 || j > y1 || L[j] < 0) continue; s += (Rt[j] - L[j]) / 2; n++; } return n ? s / n : 0; };
const TEST = .86, near = (() => { const nn = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let a = 0, b = 0; for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 150) { nn[i] = i; q[b++] = i; } while (a < b) { const i = q[a++], x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && nn[j] < 0) { nn[j] = nn[i]; q[b++] = j; } } return nn; })();
const photo = (px, py) => { const x = clamp(Math.round(px), 0, W - 1), y = clamp(Math.round(py), 0, H - 1), k = near[y * W + x] * 4; return [data[k], data[k + 1], data[k + 2]]; };
// 3D 점 → 사진 자리(앞에서 본 투영 — 뒤쪽은 같은 자리를 거울로)
const STAGE = {antarctic_urchin: {tint: 0, n: 520, len: 1}, juv_antarctic_urchin: {tint: .1, n: 460, len: .9}, fry_antarctic_urchin: {tint: .25, n: 380, len: .8}};

function build(key) {
  const st = STAGE[key], m = new Model(), tint = (c, k = st.tint) => c.map((v, i) => v * (1 - k) + [226, 190, 160][i] * k);
  // 껍데기 무늬 — 사진을 앞에서만 투영하면 옆 · 위가 한 줄로 늘어난다. 둘레 각 φ 를 사진 가로(반폭 × sin φ)로, 높이는 그대로 — 어느 쪽이든 사진 안의 자리를 쓴다.
  //   사진에 구워진 그늘은 3D 빛과 겹치므로 밝기를 평균 쪽으로 30% 당긴다
  const MEAN = [178, 86, 46], skin = (p) => { const r = Math.hypot(p[0], p[2]) || 1e-6, ph = Math.atan2(p[2], p[0]), py = y0 - p[1] / S, xr = hw(py) * Math.sin(ph * 1 + .3) * (r / (rOf((py - y0) / (y1 - y0)) || r)); return tint(mix(photo(CX + xr, py), MEAN, .3)); };
  const yOf = (s) => y0 + (y1 - y0) * s, rOf = (s) => hw(yOf(s)) * TEST * S, Y = (s) => -(yOf(s) - y0) * S;
  // 껍데기(회전체) — 위(s 0)에서 바닥(s 1)으로
  m.sweep('test', (s) => ({c: [0, Y(s), 0], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(.02, rOf(s)), b: Math.max(.02, rOf(s))}),
    {ns: 24, nt: 30, island: [0, 0, 1, .45], bone: 'body', paint: (p) => skin(p)});
  // 가시
  const n = st.n, cols = 24, rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, s = clamp(Math.acos(1 - 2 * t) / Math.PI * .98 + .01, .01, .97), az = i * 2.39996, r = rOf(s), base = [Math.cos(az) * r * .97, Y(s), Math.sin(az) * r * .97];
    const dr = (rOf(Math.min(.99, s + .01)) - rOf(Math.max(.01, s - .01))) / .02, dy = (Y(Math.min(.99, s + .01)) - Y(Math.max(.01, s - .01))) / .02;
    const nrm = norm([Math.cos(az) * -dy, dr, Math.sin(az) * -dy]), dir = norm(add(nrm, [0, .25, 0], 1 - s));
    const len = (1 / TEST - 1) * 1.35 * st.len * (s > .8 ? .45 : 1) * (.7 + .6 * noise(i * .73, 1, 2));
    const col = skin(base), tip = mix(col, [250, 214, 178], .55);
    const side = norm([-dir[2], 0, dir[0]].map((v, k) => v + (k === 1 ? .001 : 0))), side2 = norm([dir[1] * side[2] - dir[2] * side[1], dir[2] * side[0] - dir[0] * side[2], dir[0] * side[1] - dir[1] * side[0]]);
    const ci = i % cols, ri = Math.floor(i / cols);
    m.sweep('spine', (q) => ({c: add(base, dir, len * q - .02), u: side, v: side2, a: .028 * (1 - .85 * q) * st.len, b: .028 * (1 - .85 * q) * st.len}),
      {ns: 1, nt: 3, island: [ci / cols, .45 + .55 * ri / rows, (ci + 1) / cols - .002, .45 + .55 * (ri + 1) / rows - .002], bone: 'body', paint: (p, nn, [q]) => mix(col, tip, clamp(q))});
  }
  return m;
}
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGE);
for (const key of keys) {
  const {glb, tris} = await bake(key, build(key), {fins: {L: {root: [0, -.3, .9], tip: [0, -.4, 1.2]}, R: {root: [0, -.3, -.9], tip: [0, -.4, -1.2]}}, source: 'USNM E21812 photo (Smithsonian, CC0) — design/aqua3d-review/polar/urchin-build.mjs', roughness: .65, weight: (part, g) => spineWeight(g[0])});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
