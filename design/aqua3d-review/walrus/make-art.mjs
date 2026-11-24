// 바다코끼리 2D 원화(2026-11-24 [사용자: "바다코끼리도 이미지 찾아서 모델 만들어줘"])
// 바탕 = 우리 게임의 큰바다사자 그림(자체 제작물 public/aqua/fish/*steller_sea_lion.webp) — 헤엄치는 옆모습 · 큰 앞지느러미가 바다코끼리와 같다.
// 그 위에: 몸통을 위아래로 두껍게(가슴 · 배가 가장 굵다) · 머리는 상대적으로 작게 → 계피빛 분홍 갈색으로 다시 칠하기 → 지방 주름 →
// 수염 난 넓은 주둥이(수염 돌기 점) · 엄니(어른 길게 · 어린 짧게 · 새끼 거의 없음).
// 피부색은 USFWS 퍼블릭 도메인 사진(Walrus 2 · Bull walrus swimming — reference/)에서 고른 값이다. 사용자 참고 사진 · 조형물 · 시트는 비율만 봤다(저작권).
// node design/aqua3d-review/walrus/make-art.mjs  → public/aqua/fish/{walrus,juv_walrus,fry_walrus}.webp (512, 머리 오른쪽, 투명)
import sharp from 'sharp';

const STAGES = [
  // key, 바탕, 몸 부풀림, 머리 줄임, 엄니 길이(몸 높이 배), 색(그림자 · 중간 · 밝은), 주름 세기
  { key: 'walrus', src: 'spotted_seal', fat: 1.55, head: .9, tusk: .8, pal: [[78, 40, 30], [168, 104, 82], [226, 170, 145]], fold: 1 },
  { key: 'juv_walrus', src: 'juv_spotted_seal', fat: 1.45, head: .92, tusk: .38, pal: [[84, 48, 36], [160, 104, 84], [214, 164, 140]], fold: .75 },
  { key: 'fry_walrus', src: 'fry_spotted_seal', fat: 1.4, head: 1, tusk: .06, muz: .66, pal: [[62, 42, 34], [128, 88, 70], [190, 150, 128]], fold: .45 },
];
const S = 512;

async function make(st) {
  const { data, info } = await sharp(`public/aqua/fish/${st.src}.webp`).resize(S, S).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blur = (await sharp(`public/aqua/fish/${st.src}.webp`).resize(S, S).flatten({ background: '#808080' }).blur(7).raw().toBuffer());
  const W = info.width, H = info.height, A = i => data[i * 4 + 3];
  // 열마다 몸 위 · 아래(가장 긴 이어진 불투명 구간)
  const top = new Float32Array(W).fill(NaN), bot = new Float32Array(W).fill(NaN);
  for (let x = 0; x < W; x++) { let t = -1, bt = -1, bb = -1; for (let y = 0; y <= H; y++) { const on = y < H && A(y * W + x) > 60; if (on && t < 0) t = y; if (!on && t >= 0) { if (y - 1 - t > bb - bt) [bt, bb] = [t, y - 1]; t = -1; } } if (bt >= 0) { top[x] = bt; bot[x] = bb; } }
  let x0 = W, x1 = 0; for (let x = 0; x < W; x++) if (!isNaN(top[x])) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const L = x1 - x0;
  // 중심선(부드럽게)
  const cyRaw = x => isNaN(top[x]) ? NaN : (top[x] + bot[x]) / 2;
  const cy = new Float32Array(W);
  for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -20; k <= 20; k++) { const v = cyRaw(Math.min(W - 1, Math.max(0, x + k))); if (!isNaN(v)) { s += v; n++; } } cy[x] = n ? s / n : H / 2; }
  // 몸 부풀림 — u = 꼬리 0 → 머리 1. 가슴(0.55~0.78)이 가장 굵고, 머리 끝 · 꼬리로 줄어든다
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const scaleAt = x => { const u = (x - x0) / L; const body = smooth(.12, .5, u) * (1 - smooth(.8, .9, u)); const head = smooth(.86, .95, u); return 1 + (st.fat - 1) * body - (1 - st.head) * head; };
  // 뒤로 매핑: 출력 (x,y) ← 원본 (x, cy + (y - cy) / s)
  const out = Buffer.alloc(W * H * 4);
  const pal = st.pal;
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = scaleAt(x), sy = cy[x] + (y - cy[x]) / s;
    const yi = Math.floor(sy), f = sy - yi; if (yi < 0 || yi >= H - 1) continue;
    const i0 = (yi * W + x) * 4, i1 = ((yi + 1) * W + x) * 4;
    const a = data[i0 + 3] * (1 - f) + data[i1 + 3] * f; if (a < 2) continue;
    const j0 = (yi * W + x) * 3, j1 = ((yi + 1) * W + x) * 3;
    const mix = (k) => .72 * (blur[j0 + k] * (1 - f) + blur[j1 + k] * f) + .28 * (data[i0 + k] * (1 - f) + data[i1 + k] * f);
    const r = mix(0), g = mix(1), b = mix(2);
    // 밝기 → 바다코끼리 색(밝기 그대로)
    let l = (.3 * r + .59 * g + .11 * b) / 255; l = Math.min(1, Math.max(0, .35 + (l - .5) * 1.1));
    const c = l < .5 ? pal[0].map((v, k) => lerp(v, pal[1][k], l / .5)) : pal[1].map((v, k) => lerp(v, pal[2][k], (l - .5) / .5));
    const o = (y * W + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = a;
  }
  // 새 윤곽(엄니 · 주둥이 자리를 잡으려고)
  const nt = new Float32Array(W).fill(NaN), nb = new Float32Array(W).fill(NaN);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (out[(y * W + x) * 4 + 3] > 60) { if (isNaN(nt[x])) nt[x] = y; nb[x] = y; }
  let front = 0; for (let x = 0; x < W; x++) if (!isNaN(nt[x])) front = x;
  // 주름 · 결 — 몸 둘레를 감는 세로 고랑(조금 휘고 끊긴다) + 잔 주름 얼룩
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const headX = x0 + L * .86;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; if (out[o + 3] < 30) continue;
    const u = (x - x0) / L, k = st.fold * (1 - smooth(.9, .97, u));
    const t = isNaN(nt[x]) ? .5 : (y - nt[x]) / Math.max(1, nb[x] - nt[x]);
    // 고랑 — 둘레를 따라 휜다(가운데가 앞으로)
    const warp = 9 * (noise(x * .03, y * .03) - .5) + 7 * Math.sin(t * Math.PI);
    const sp = 11 + 8 * noise(x * .02 + 9, y * .02);
    const ph = (x + warp) / sp + 2.3 * noise(x * .015, y * .015);
    const g = Math.pow(Math.abs(Math.sin(ph * Math.PI)), 9) * smooth(.25, .85, noise(x * .06 + 3, y * .09));
    const ph2 = (y + 6 * noise(x * .04 + 5, y * .04)) / 9 + noise(x * .02, 1) * 3;
    const g2 = Math.pow(Math.abs(Math.sin(ph2 * Math.PI)), 12) * smooth(.5, .9, noise(x * .07, y * .07 + 4)) * .7;
    const deep = .45 + .55 * smooth(.45, .8, u);
    const blot = noise(x * .1, y * .1) * .55 + noise(x * .4, y * .4) * .45;
    const dark = 1 - k * (deep * (.5 * g + .3 * g2) + .16 * (blot - .5));
    // 등 위 밝게 · 배 쪽 어둡게(둥근 몸)
    const tc = Math.min(1, Math.max(0, t)), shade = .86 + .26 * Math.cos(tc * Math.PI) - .18 * Math.pow(Math.abs(tc - .45) * 2, 6);
    for (let c = 0; c < 3; c++) out[o + c] = Math.min(255, Math.max(0, out[o + c] * dark * shade));
  }
  const img = sharp(out, { raw: { width: W, height: H, channels: 4 } }).png();
  // 머리 기하
  const hx = front - 6, mcy = nb[Math.round(front - L * .03)] ?? cy[front];
  const bodyH = Math.max(...[...Array(W).keys()].filter(x => !isNaN(nt[x])).map(x => nb[x] - nt[x]));
  const mx = front - L * .055, my = (nt[Math.round(mx)] + nb[Math.round(mx)]) / 2 + (nb[Math.round(mx)] - nt[Math.round(mx)]) * .12;
  const mr = (nb[Math.round(mx)] - nt[Math.round(mx)]) * .62 * (st.muz ?? 1);
  const tuskLen = bodyH * st.tusk * .7, tuskW = Math.max(2.2, mr * .26);
  const [pr, pg, pb] = st.pal[1];
  // 주둥이 패드 + 수염 돌기(밝은 점) + 짧은 수염 + 엄니 + 눈
  let dots = '';
  for (let i = 0; i < 150; i++) { const a = hash(i, 3) * Math.PI * 1.1 - Math.PI * .1, rr = Math.sqrt(hash(i, 7)) * mr * .9; const dx = mx + Math.cos(a) * rr * .8 + mr * .1, dy = my + Math.sin(a) * rr * .75; dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${(mr * .03 + 0.5).toFixed(2)}" fill="#e9d6bd" opacity=".75"/>`; }
  let bristles = '';
  for (let i = 0; i < 22; i++) { const a = Math.PI * (.15 + .7 * i / 21), sx = mx + Math.cos(a) * mr * .7 + mr * .15, sy = my + Math.sin(a) * mr * .55; const ex = sx + Math.cos(a - .5) * mr * .35, ey = sy + Math.sin(a - .3) * mr * .4; bristles += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="#e6d4ba" stroke-width="${Math.max(.6, mr * .035).toFixed(2)}" opacity=".8"/>`; }
  const tusk = (ox, w) => { if (tuskLen < 4) return ''; const sx = mx - mr * .15 + ox, sy = my + mr * .45, ex = sx - tuskLen * .28, ey = sy + tuskLen; return `<path d="M${(sx - w).toFixed(1)} ${sy.toFixed(1)} Q${(sx - w * .6 + tuskLen * .05).toFixed(1)} ${(sy + tuskLen * .55).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} Q${(sx + w * .9 + tuskLen * .08).toFixed(1)} ${(sy + tuskLen * .5).toFixed(1)} ${(sx + w).toFixed(1)} ${sy.toFixed(1)} Z" fill="url(#iv)" stroke="#8a7458" stroke-width=".8"/>`; };
  const ex = front - L * .1, ey = nt[Math.round(front - L * .1)] + (nb[Math.round(front - L * .1)] - nt[Math.round(front - L * .1)]) * .3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="pad" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="rgb(${Math.min(255, pr + 30)},${Math.min(255, pg + 22)},${Math.min(255, pb + 14)})"/><stop offset="1" stop-color="rgb(${pr - 30},${pg - 30},${pb - 26})"/></radialGradient>
  <linearGradient id="iv" x1="0" x2="1"><stop offset="0" stop-color="#cdb894"/><stop offset=".45" stop-color="#fbf3e2"/><stop offset="1" stop-color="#d8c4a2"/></linearGradient></defs>
  ${tusk(-mr * .12, tuskW)}
  <ellipse cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" rx="${(mr * 1.02).toFixed(1)}" ry="${(mr * .86).toFixed(1)}" fill="url(#pad)"/>
  ${dots}${bristles}
  ${tusk(mr * .1, tuskW * 1.05)}
  <ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${Math.max(2, mr * .14).toFixed(1)}" ry="${Math.max(1.6, mr * .11).toFixed(1)}" fill="#1d120d"/>
  <circle cx="${(ex + mr * .04).toFixed(1)}" cy="${(ey - mr * .03).toFixed(1)}" r="${Math.max(.7, mr * .04).toFixed(2)}" fill="#fff" opacity=".7"/>
  </svg>`;
  // 엄니 마스크 — 3D 빌더(mammal-tube-build)가 엄니를 몸 · 지느러미 판에서 빼고 원뿔로 짓는다
  const tmask = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="iv"><stop offset="0" stop-color="#fff"/></linearGradient></defs>${tusk(-mr * .12, tuskW)}${tusk(mr * .1, tuskW * 1.05)}</svg>`.replace(/stroke="[^"]*"/g, 'stroke="#fff"').replace(/url(#iv)/g, '#fff');
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: Buffer.from(tmask) }]).png().toFile(`design/aqua3d-review/walrus/${st.key}-tusk.png`);
  // 주둥이 · 엄니 · 눈 그림은 2판부터 쓰지 않는다 — 머리는 photo-head.mjs 가 사진에서 붙인다(svg 는 옛 그림 참고용으로 남긴다)
  void svg;
  await sharp(await img.toBuffer()).webp({ quality: 90, alphaQuality: 100 }).toFile(`public/aqua/fish/${st.key}.webp`);
  console.log(st.key, 'front', front, 'mr', mr.toFixed(1), 'tusk', tuskLen.toFixed(1));
}
for (const st of STAGES) if (!process.argv[2] || process.argv.slice(2).includes(st.key)) await make(st);
