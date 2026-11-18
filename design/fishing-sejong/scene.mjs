// 남극 세종기지 앞바다(마리안 소만) 낚시터 배경 — 2026-11-18 [사용자: "빙하지역을 하나 만들고 싶어 맵과 낚시터 만들어줄 수 있어 ?"]
// 다른 낚시터 배경은 그림 세션이 그린 손그림(design/FISHING-ART.md · scripts/fishing-art.mjs 의 SPOT_STYLE)이다. 이 장면은 그 그림이 올 때까지 쓰는
// 코드 그림 — 마리안 소만의 실제 모습(물로 떨어지는 빙벽 · 떠 있는 빙산과 유빙 · 눈 덮인 바턴 반도 산줄기 · 맑은 남극 하늘)을 같은 구도로 그린다.
// 구도는 다른 낚시터와 같다: 1024×1280 세로, 수평선은 위에서 약 30%(fishingfx 의 horizon), 아래 70% 는 물(찌 · 루어가 그 위에 그려진다).
// node design/fishing-sejong/scene.mjs → design/fishing-sejong/out/spot_sejong.png (sync: node scripts/fishing-art.mjs sync design/fishing-sejong/out)
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';

const W = 1024, H = 1280, HZ = Math.round(H * 0.3);
// 결정적 난수 — 같은 그림이 다시 나온다
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const f = (n) => n.toFixed(1);

// 산줄기 — 위가 눈, 바위가 군데군데 드러난다
function ridge(y0, amp, step, jag) {
  const pts = []; let y = y0;
  for (let x = -20; x <= W + 20; x += step) { y = y0 - amp * (0.55 + 0.45 * Math.sin(x / 170 + jag)) - rnd() * amp * 0.35; pts.push([x, y]); }
  return pts;
}
const poly = (pts, close = true) => 'M' + pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L') + (close ? ' Z' : '');
const far = ridge(HZ - 70, 120, 34, 1.3), mid = ridge(HZ - 30, 70, 26, 4.1);
// 빙벽(마리안 소만 빙하 끝) — 왼쪽 반에서 물로 떨어지는 흰 · 푸른 절벽, 세로 금(크레바스)
const cliffTop = []; for (let x = 0; x <= 600; x += 12) cliffTop.push([x, HZ - 64 + Math.sin(x / 40) * 5 + rnd() * 6 + (x > 470 ? (x - 470) * 0.42 : 0)]);
const cliff = poly([...cliffTop, [600, HZ + 2], [0, HZ + 2]]);
let crev = ''; for (let i = 0; i < 46; i++) { const x = 8 + i * 12.8 + rnd() * 6, top = HZ - 58 + rnd() * 18 + (x > 470 ? (x - 470) * 0.42 : 0), w = 1.4 + rnd() * 2.6; crev += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(HZ - top)}" fill="#6fa6c8" opacity="${f(0.25 + rnd() * 0.35)}"/>`; }
// 빙산 — 각진 흰 덩어리와 물에 잠긴 푸른 아랫부분
function berg(cx, by, w, h) {
  const top = [[cx - w / 2, by], [cx - w * 0.42, by - h * 0.6], [cx - w * 0.2, by - h], [cx + w * 0.15, by - h * 0.92], [cx + w * 0.38, by - h * 0.55], [cx + w / 2, by]];
  const under = [[cx - w / 2, by], [cx + w / 2, by], [cx + w * 0.4, by + h * 0.55], [cx - w * 0.35, by + h * 0.5]];
  return `<path d="${poly(under)}" fill="#3f8fb6" opacity=".55"/><path d="${poly(top)}" fill="url(#ice)"/>` +
    `<path d="${poly([[cx - w * 0.2, by - h], [cx + w * 0.15, by - h * 0.92], [cx + w * 0.38, by - h * 0.55], [cx + w * 0.05, by - h * 0.5]])}" fill="#bfe0f2" opacity=".7"/>`;
}
// 유빙 — 물 위 납작한 얼음 조각(가까울수록 크게)
let floes = ''; for (let i = 0; i < 22; i++) {
  const t = Math.pow(rnd(), 1.6), y = HZ + 14 + t * (H - HZ - 120), s = 5 + t * 52, x = rnd() * W, n = 7, pts = [];
  // 불규칙한 얼음 조각 — 각 꼭짓점의 반지름을 흔들고, 원근으로 위아래를 눌러 납작하게
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, r = s * (0.65 + rnd() * 0.5); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.26]); }
  floes += `<path d="${poly(pts.map(([px, py]) => [px + s * 0.08, py + s * 0.12]))}" fill="#174f78" opacity=".35"/><path d="${poly(pts)}" fill="#eef8ff" opacity="${f(0.8 + t * 0.15)}"/>`;
}
// 물결 반짝임 — 가로로 짧은 밝은 줄
let glints = ''; for (let i = 0; i < 260; i++) { const t = rnd(), y = HZ + 6 + t * (H - HZ), w = 6 + t * 40; glints += `<rect x="${f(rnd() * W)}" y="${f(y)}" width="${f(w)}" height="${f(1 + t * 2)}" rx="1" fill="#dff2ff" opacity="${f(0.08 + 0.18 * (1 - t))}"/>`; }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
 <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4e6"/><stop offset=".7" stop-color="#cfe6f7"/><stop offset="1" stop-color="#f2f8fc"/></linearGradient>
 <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e9fc4"/><stop offset=".25" stop-color="#2f7aa8"/><stop offset="1" stop-color="#123f63"/></linearGradient>
 <linearGradient id="snowfar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9dcec"/></linearGradient>
 <linearGradient id="snowmid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fbff"/><stop offset="1" stop-color="#b3cde2"/></linearGradient>
 <linearGradient id="cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#d9eefa"/><stop offset="1" stop-color="#7fbad9"/></linearGradient>
 <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3f2fb"/><stop offset="1" stop-color="#a8d2ea"/></linearGradient>
 <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f5ff" stop-opacity=".45"/><stop offset="1" stop-color="#e8f5ff" stop-opacity="0"/></linearGradient>
 <filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter>
 <filter id="haze"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="${W}" height="${HZ + 4}" fill="url(#sky)"/>
<ellipse cx="760" cy="80" rx="260" ry="60" fill="#ffffff" opacity=".35" filter="url(#haze)"/>
<ellipse cx="240" cy="140" rx="200" ry="40" fill="#ffffff" opacity=".3" filter="url(#haze)"/>
<path d="${poly([...far, [W + 20, HZ], [-20, HZ]])}" fill="url(#snowfar)" opacity=".9" filter="url(#soft)"/>
<path d="${poly([...mid, [W + 20, HZ], [-20, HZ]])}" fill="url(#snowmid)"/>
<path d="${cliff}" fill="url(#cliff)"/>${crev}
<rect x="0" y="${HZ - 2}" width="${W}" height="${H - HZ + 2}" fill="url(#sea)"/>
<path d="${poly([[0, HZ], [600, HZ], [560, HZ + 70], [0, HZ + 90]])}" fill="url(#refl)"/>
${berg(760, HZ + 10, 150, 58)}${berg(905, HZ + 6, 70, 26)}${berg(640, HZ + 4, 46, 16)}${berg(250, HZ + 120, 220, 64)}
${floes}${glints}
<rect x="0" y="${H - 150}" width="${W}" height="150" fill="#0b2f4c" opacity=".25" filter="url(#haze)"/>
</svg>`;
await mkdir('design/fishing-sejong/out', {recursive: true});
await sharp(Buffer.from(svg)).png().toFile('design/fishing-sejong/out/spot_sejong.png');
console.log('design/fishing-sejong/out/spot_sejong.png');
