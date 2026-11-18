// 그림에서 따라 그린 팔 중심선(ceph-v3-build.mjs traceArms)을 그림 위에 겹쳐 본다 — 검수용. 짧은 선은 빨판 쪽(밝은 가장자리)을 가리킨다.
// node design/aqua3d-review/ceph-v3/trace-viz.mjs <out.png> [key...]
import sharp from 'sharp';
import {traceArms} from '../ceph-v3-build.mjs';
import {loadArt} from '../relief-build.mjs';
const [out, ...keys] = process.argv.slice(2), cols = ['#ff2d55', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff', '#ffffff'], tiles = [];
for (const key of keys) {
  const art = await loadArt(`public/aqua/fish/${key}.webp`), arms = traceArms(art, key);
  const tick = (a, k) => a.pts.map((p, i) => { if (i % 12) return ''; const n = a.pts[Math.min(a.pts.length - 1, i + 1)], m = a.pts[Math.max(0, i - 1)], t = [n[0] - m[0], n[1] - m[1]], l = Math.hypot(...t) || 1, s = a.side * a.w[i]; return `<line stroke="${cols[k]}" stroke-width="1" x1="${p[0]}" y1="${p[1]}" x2="${p[0] - t[1] / l * s}" y2="${p[1] + t[0] / l * s}"/>`; }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${arms.map((a, k) => `<polyline fill="none" stroke="${cols[k]}" stroke-width="2" points="${a.pts.map((p) => p.join(',')).join(' ')}"/>${tick(a, k)}`).join('')}<text x="6" y="18" fill="#000" font-size="16">${key} ${arms.length}</text></svg>`;
  tiles.push(await sharp({create: {width: 512, height: 512, channels: 3, background: '#8fa9b4'}}).composite([{input: await sharp(`public/aqua/fish/${key}.webp`).resize(512, 512).png().toBuffer()}, {input: Buffer.from(svg)}]).png().toBuffer());
  console.log(key, arms.map((a) => `${Math.round(a.length)}/${a.side}`).join(' '));
}
const c = Math.min(3, tiles.length), r = Math.ceil(tiles.length / c);
await sharp({create: {width: 512 * c, height: 512 * r, channels: 3, background: '#8fa9b4'}}).composite(tiles.map((t, i) => ({input: t, left: (i % c) * 512, top: Math.floor(i / c) * 512}))).png().toFile(out);
