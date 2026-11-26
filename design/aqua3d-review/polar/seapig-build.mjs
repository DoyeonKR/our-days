// 바다돼지(Scotoplanes) 3D — 기준 도판에서 짓는다(2026-11-25 [사용자: "기준이미지 없이 모델을 만드니 그렇게 허접하게 만들지 너무 다르잖아 실제 어종과"])
// 기준: Lindberg 의 Scotoplanes 도판(퍼블릭 도메인, 옆모습) → ref-art.mjs 가 오려 분홍으로 칠한 model-art/sea_pig-side.png(1375 × 876).
// 몸통: 도판의 위 · 아래 윤곽(아래 표 — 도판 픽셀에서 눈으로 잰 값)을 따라 둥근 관, 옆 폭은 높이의 0.85, 배는 납작. 무늬(가는 세로 결 · 짙은 얼룩)는 도판을 옆에서 투영.
// 돌기 두 쌍: 도판의 자리(뒤 x 380 · 앞 x 890, 등 위)에서 휘어 솟는 굵은 관(뿌리 반지름 38 → 끝 12). 다리 여섯 쌍: 배 양옆에서 아래 · 뒤로 휜 통통한 관.
// 입 촉수: 앞끝 아래의 주름진 짧은 관 열 개. 색은 도판의 그 자리.
// node design/aqua3d-review/polar/seapig-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {Model, bake, spineWeight, clamp, mix, noise, norm, add} from './kit.mjs';

const {data, info} = await sharp('design/aqua3d-review/polar/model-art/sea_pig-side.png').ensureAlpha().raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height;
const near = (() => { const nn = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let a = 0, b = 0; for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 150) { nn[i] = i; q[b++] = i; } while (a < b) { const i = q[a++], x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && nn[j] < 0) { nn[j] = nn[i]; q[b++] = j; } } return nn; })();
const photo = (x, y) => { const k = near[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)] * 4; return [data[k], data[k + 1], data[k + 2]]; };
// 도판의 몸 위 · 아래 윤곽 [x, 위 y, 아래 y]
const OUT = [[40, 470, 500], [100, 330, 600], [250, 232, 660], [430, 205, 690], [650, 220, 692], [850, 290, 672], [950, 360, 640], [1030, 450, 585], [1062, 520, 530]];
const prof = (x) => { let i = 0; while (i < OUT.length - 2 && x > OUT[i + 1][0]) i++; const A = OUT[i], B = OUT[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return [A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; };
const X0 = 40, X1 = 1062;
const STAGE = {sea_pig: {pap: 1, leg: 1, fat: 1}, juv_sea_pig: {pap: .8, leg: .9, fat: 1.04}, fry_sea_pig: {pap: .55, leg: .75, fat: 1.1}};
const bez = (p0, p1, p2, t) => p0.map((v, i) => (1 - t) ** 2 * v + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);

function build(key) {
  const st = STAGE[key], m = new Model();
  const P = (x) => { const [t, b] = prof(x); return {cy: -(t + b) / 2, a: (b - t) / 2 * st.fat, b: (b - t) / 2 * .85 * st.fat}; };
  // 3D 점 → 도판(옆에서 투영). 옆을 벗어난 위 · 아래는 가장자리 색
  const skin = (p) => photo(p[0], -p[1]).map((v) => v * (.96 + .08 * noise(p[0] * .05, p[1] * .05, p[2] * .05)));
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => (Math.cos(th) < 0 ? 1 - .28 * Math.abs(Math.cos(th)) ** 2.4 : 1)}; },
    {ns: 40, nt: 24, capStart: 30, capEnd: 26, capRings: 4, capSpanStart: .04, capSpanEnd: .05, island: [0, 0, 1, .55], bone: 'body', paint: skin});
  let isl = 0; const ISL = (n) => { const cols = 8, c = isl % cols, r = Math.floor(isl / cols); isl++; return [c / cols, .55 + r * .09, (c + 1) / cols - .003, .55 + (r + 1) * .09 - .003]; };
  // 돌기 두 쌍 — 도판의 휘어 솟은 굵은 관
  for (const [bx, ctrl, tip] of [[380, [330, -60], [90, -80]], [890, [900, -110], [1270, -60]]]) for (const sd of [-1, 1]) {
    const p = P(bx), base = [bx, p.cy + p.a * .8, sd * p.b * .34], k = st.pap;
    const c1 = [base[0] + (ctrl[0] - base[0]) * k, base[1] + (ctrl[1] - base[1]) * k, sd * p.b * .5], t1 = [base[0] + (tip[0] - base[0]) * k, base[1] + (tip[1] - base[1]) * k, sd * p.b * .85];
    m.sweep('pap', (s) => ({c: bez(base, c1, t1, s), u: [1, 0, 0], v: [0, 0, 1], a: 56 * (1 - .66 * s) * Math.max(.7, k), b: 56 * (1 - .66 * s) * Math.max(.7, k)}),
      {ns: 14, nt: 10, capStart: 30, capEnd: 8, capRings: 1, island: ISL(), bone: 'body', paint: (q, n, [s]) => photo(bx < 600 ? 330 - 250 * s : 900 + 300 * s, 230 - 150 * s).map((v) => v * (.96 + .08 * noise(s * 7, bx, sd)))});
  }
  // 다리 여섯 쌍 — 배 양옆에서 아래 · 뒤로 휜다
  for (const lx of [140, 270, 420, 580, 740, 890]) for (const sd of [-1, 1]) {
    const p = P(lx), base = [lx, p.cy - p.a * .6, sd * p.b * .62], tip = add(base, [-70, -112 * st.leg, sd * 46]), mid = add(base, [12, -82 * st.leg, sd * 30]);
    m.sweep('leg', (s) => ({c: bez(base, mid, tip, s), u: [1, 0, 0], v: [0, 0, 1], a: 46 * (1 - .35 * s), b: 46 * (1 - .35 * s)}),
      {ns: 8, nt: 10, capEnd: 14, capRings: 2, island: ISL(), bone: 'body', paint: (q, n, [s]) => photo(lx - 10, 700 + 90 * s).map((v) => v * (.95 + .08 * noise(s * 9, lx, 1)))});
  }
  // 입 촉수 열 — 앞끝 아래 둥글게
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, base = [1040, -560 + 60 * Math.cos(a), 60 * Math.sin(a)], dir = norm([1, .25 * Math.cos(a) - .35, .55 * Math.sin(a)]);
    m.sweep('tent', (s) => ({c: add(base, dir, 95 * s), u: [0, 1, 0], v: [0, 0, 1], a: 20 * (1 - .3 * s) * (1 + .25 * Math.sin(s * 14 + i)), b: 20 * (1 - .3 * s)}),
      {ns: 6, nt: 8, capEnd: 10, capRings: 1, island: ISL(), bone: 'head', paint: (q, n, [s]) => photo(1080 + 50 * s, 560 + 80 * Math.cos(a))});
  }
  return m;
}
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGE);
for (const key of keys) {
  const {glb, tris} = await bake(key, build(key), {fins: {L: {root: [700, -560, 120], tip: [660, -700, 160]}, R: {root: [700, -560, -120], tip: [660, -700, -160]}}, source: 'Lindberg, Scotoplanes plate (public domain) — design/aqua3d-review/polar/seapig-build.mjs', roughness: .4,
    weight: (part, g) => (part.bone === 'head' ? spineWeight(Math.max(g[0], .6)) : spineWeight(g[0]))});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
