// 범고래 새끼 · 어린 개체 수조 그림(2026-11-18) — 다 큰 그림(public/aqua/fish/orca.webp)을 3D 와 같은 비율로 휜다.
// 왜: 줄인 3D 모델을 다시 그리면 원본 고해상도 메시로 그린 다 큰 그림보다 거칠다(design/aqua3d-review/orca-young/art-compare.webp).
//   그래서 그림은 다 큰 그림 위에서 orca-young-build.mjs 의 YOUNG 비율을 그대로 쓴다 — 등지느러미를 몸 윗선 쪽으로 낮추고,
//   몸 가운데 선을 축으로 위아래를 부풀리되 머리 쪽을 더, 새끼는 흰 곳을 살구빛으로. 결과를 폴더에 쓰고 scripts/aqua-art-sync.mjs 가 512 · 192 사본을 굽는다.
// 실행: node design/aqua3d-review/orca-young-art.mjs && node scripts/aqua-art-sync.mjs design/aqua3d-review/orca-young/art
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (lo, hi, x) => { const t = clamp((x - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
// orca-young-build.mjs 의 YOUNG 과 같은 값(그 파일은 실행되면 모델을 쓰므로 여기에 옮겨 둔다 — 바꾸면 둘 다)
const YOUNG = {
  fry_orca: {base: 1.22, head: 0.2, fin: 0.36, peach: 0.45},
  juv_orca: {base: 1.08, head: 0.08, fin: 0.68, peach: 0},
};
// 다 큰 그림(512)에서 잰 자리 — 꼬리 끝 · 주둥이 끝 x, 몸 가운데 선 y(꼬리 → 머리), 등지느러미 구간의 몸 윗선
const TAIL_X = 52, HEAD_X = 461, AXIS = [[52, 283], [120, 278], [200, 272], [320, 266], [440, 265], [461, 266]], BACK_Y = 227, FIN_X0 = 205, FIN_X1 = 320;
const axisY = (x) => { for (let i = 1; i < AXIS.length; i++) if (x <= AXIS[i][0]) { const [x0, y0] = AXIS[i - 1], [x1, y1] = AXIS[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return AXIS[AXIS.length - 1][1]; };

const {data, info} = await sharp('public/aqua/fish/orca.webp').ensureAlpha().raw().toBuffer({resolveWithObject: true});
const N = info.width;
await mkdir('design/aqua3d-review/orca-young/art', {recursive: true});
for (const [key, s] of Object.entries(YOUNG)) {
  const out = Buffer.alloc(N * N * 4);
  for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {
    const mx = (X - TAIL_X) / (HEAD_X - TAIL_X) * 2 - 1, k = s.base * (1 + s.head * smooth(0.15, 0.95, mx)), ay = axisY(X);
    // 부풀리기를 되돌린 자리
    let y = ay + (Y - ay) / k;
    // 등지느러미 — 낮춘 것을 되돌린다(지느러미 구간 · 몸 윗선 위만)
    const inFin = smooth(FIN_X0, FIN_X0 + 40, X) * (1 - smooth(FIN_X1 - 40, FIN_X1, X)), squash = 1 - inFin * (1 - s.fin);
    if (y < BACK_Y && inFin > 0) y = BACK_Y - (BACK_Y - y) / squash;
    // 쌍선형으로 읽는다
    const x0 = Math.floor(X), y0 = Math.floor(y), fy = y - y0, o = (Y * N + X) * 4;
    if (y0 < 0 || y0 + 1 >= N) continue;
    for (let c = 0; c < 4; c++) out[o + c] = Math.round(data[(y0 * N + x0) * 4 + c] * (1 - fy) + data[((y0 + 1) * N + x0) * 4 + c] * fy);
    // 새끼 — 흰 곳을 살구빛으로(3D 텍스처와 같은 식)
    if (s.peach > 0 && out[o + 3] > 0) {
      const r = out[o], g = out[o + 1], b = out[o + 2], lum = (r + g + b) / 3, chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const w = smooth(150, 215, lum) * (1 - smooth(18, 40, chroma)) * s.peach, peach = [250, 205, 170];
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(out[o + c] * (1 - w) + peach[c] * w * (lum / 235));
    }
  }
  await sharp(out, {raw: {width: N, height: N, channels: 4}}).png().toFile(`design/aqua3d-review/orca-young/art/${key}.png`);
  console.log(key);
}
