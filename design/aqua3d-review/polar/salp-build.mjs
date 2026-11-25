// 살프 사슬 3D — 기준 도판에서 짓는다(2026-11-25 [사용자: "기준이미지 없이 모델을 만드니 그렇게 허접하게 만들지 너무 다르잖아 실제 어종과"])
// 기준: 사슬 사진은 퍼블릭 도메인으로 찾지 못했다. 낱개 개체 도판 Salpa maxima(Bevalet 그림, 퍼블릭 도메인) → ref-art.mjs 의 model-art/salp-side.png.
// 통(개체) 하나: 도판의 비율(높이 = 길이의 0.4) · 왼쪽 입 쪽이 조금 좁고 오른쪽 끝이 둥근 통. 도판(근육 띠 · 내장 줄 · 주황 핵)을 통 옆에서 투영한다.
// 사슬: 통 여덟이 지그재그로 겹쳐 이어진다(실제 군체는 개체가 비스듬히 두 줄로 붙는다). 핵(주황갈)은 도판 자리(오른쪽 끝 위)에 작은 공으로도 둔다. 반투명(BLEND .5).
// node design/aqua3d-review/polar/salp-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {Model, bake, spineWeight, clamp, mix, noise, add} from './kit.mjs';

const {data, info} = await sharp('design/aqua3d-review/polar/model-art/salp-side.png').ensureAlpha().raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height, CLEAR = [214, 232, 240];
// 도판 색 — 바탕 종이가 남은 곳(투명)은 맑은 물빛
const tex = (u, v) => { const x = clamp(Math.round(u * (W - 1)), 0, W - 1), y = clamp(Math.round(v * (H - 1)), 0, H - 1), k = (y * W + x) * 4; return data[k + 3] < 100 ? CLEAR : [data[k], data[k + 1], data[k + 2]]; };
const STAGE = {salp: 8, juv_salp: 6, fry_salp: 4};

function build(key) {
  const m = new Model(), n = STAGE[key], len = 1.6, rad = .32, gap = len * .78;
  const centers = []; for (let i = 0; i < n; i++) centers.push([(i - (n - 1) / 2) * gap, i % 2 ? .2 : -.2, i % 2 ? .1 : -.1]);
  const isl = (i) => [(i % 6) / 6, Math.floor(i / 6) * .25, (i % 6 + 1) / 6 - .003, (Math.floor(i / 6) + 1) * .25 - .003];
  // 핵 먼저(반투명 껍질 너머로 비친다) — 도판의 자리: 오른쪽 끝(78~92%) 위쪽, 껍질 안벽에 닿는다
  centers.forEach((c, i) => m.sphere('nucleus', add(c, [len * .3, rad * .42 + (i % 2 ? .16 : -.16) * len * .3, 0]), rad * .46, {island: isl(n + i), bone: 'body', paint: (q) => mix([196, 108, 48], [140, 70, 30], noise(q[0] * 20, q[1] * 20, q[2] * 20))}));
  centers.forEach((c, i) => {
    const tilt = i % 2 ? .16 : -.16;
    m.sweep('zooid', (s) => { const x = (s - .5) * len, r = rad * (.52 + .48 * Math.sin(Math.PI * clamp(s * .92 + .06, 0, 1)) ** .5) * (s < .15 ? .85 + s : 1); return {c: add(c, [x, tilt * x, 0]), u: [0, 1, 0], v: [0, 0, 1], a: r, b: r * .92}; },
      {ns: 18, nt: 16, capStart: .1, capEnd: .14, capRings: 2, island: isl(i), bone: 'body', paint: (q, nn, [s]) => {
        const ycen = c[1] + tilt * (q[0] - c[0]), v = .5 - (q[1] - ycen) / rad * .46;
        return mix(tex(clamp(s * .92 + .02), clamp(v)), CLEAR, .15).map((x) => x * (.97 + .06 * noise(q[0] * 9, q[1] * 9, q[2] * 9)));
      }});
  });
  return m;
}
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGE);
for (const key of keys) {
  const {glb, tris} = await bake(key, build(key), {fins: {L: {root: [0, 0, .3], tip: [0, 0, .6]}, R: {root: [0, 0, -.3], tip: [0, 0, -.6]}}, alpha: .5, roughness: .2,
    source: 'Bevalet, Salpa maxima plate (public domain) — design/aqua3d-review/polar/salp-build.mjs', weight: (part, g) => spineWeight(g[0])});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
