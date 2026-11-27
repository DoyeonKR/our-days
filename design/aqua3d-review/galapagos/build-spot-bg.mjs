// 갈라파고스 제도 낚시터 배경(1024×1280 WebP) 제작기
// 실제 갈라파고스 제도(산크리스토발 키커 록 León Dormido · 화산 현무암 절벽 · 적도 태평양 에메랄드-코발트 해수면)
// 수평선 y = 34% (0.34), 아래 66%는 찌·줄·물고기 그림자가 잘 보이는 넓고 맑은 수면.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const W = 1024, H = 1280;
const HORIZON = Math.round(H * 0.34); // 435

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { const k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    a *= 0.5; f *= 2.04;
  }
  return s / (1 - Math.pow(0.5, oct));
}
function ridge(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * (1 - Math.abs(noise2(x * f, y * f) * 2 - 1));
    a *= 0.5; f *= 2.12;
  }
  return s / (1 - Math.pow(0.5, oct));
}

// 지형 프로파일 (x = 0..1)
function volcanoFar(u) {
  // 멀리 아른거리는 이사벨라 화산 능선
  const dome = Math.exp(-Math.pow((u - 0.24) / 0.22, 2)) * 0.085 + Math.exp(-Math.pow((u - 0.72) / 0.18, 2)) * 0.055;
  return dome + fbm(u * 6.5, 2.3, 4) * 0.025;
}
function basaltLeft(u) {
  // 왼쪽 먼 현무암 해안 절벽 (바르톨로메 / 산타크루즈)
  const mask = smooth(0.36, 0.08, u);
  const plateau = 0.068 * Math.pow(mask, 0.85);
  const crag = ridge(u * 14, 1.2, 4) * 0.032 * mask;
  return plateau + crag;
}
function kickerRock(u) {
  // 상징적인 갈라파고스 키커 록 (León Dormido — 중앙 오른쪽의 두 갈래 화산 바위섬)
  const mainPeak = Math.exp(-Math.pow((u - 0.72) / 0.055, 2)) * 0.165;
  const sideSpire = Math.exp(-Math.pow((u - 0.815) / 0.028, 2)) * 0.118;
  // 가운데 좁은 해협 틈새(키커 록의 상징적인 수직 절단면)
  const cleft = Math.exp(-Math.pow((u - 0.778) / 0.011, 2));
  const raw = Math.max(mainPeak, sideSpire) * (1 - cleft * 0.92);
  const rock = raw > 0.008 ? raw + (ridge(u * 26, 4.1, 4) - 0.5) * 0.022 * smooth(0.01, 0.05, raw) : 0;
  return Math.max(0, rock);
}

// 태양 위치 (적도 오후의 맑고 따뜻한 햇빛)
const SUN_U = 0.38, SUN_V = 0.16;

function skyColor(u, v) {
  // v: 0(천정) .. 0.34(수평선)
  const t = clamp(v / 0.34);
  const zenith = [24, 96, 178];
  const mid = [72, 162, 224];
  const horiz = [196, 232, 246];
  let col = t < 0.55 ? mix(zenith, mid, t / 0.55) : mix(mid, horiz, (t - 0.55) / 0.45);

  // 따뜻한 태양 후광
  const sd = Math.hypot((u - SUN_U) * 1.15, (v - SUN_V) * 1.4);
  const sunGlow = Math.exp(-sd * 4.2) * 0.42 + Math.exp(-sd * 16) * 0.55;
  col = mix(col, [255, 248, 222], clamp(sunGlow, 0, 0.85));

  // 적도 무역풍 적운 구름
  const cloudBase = smooth(0.03, 0.25, v) * smooth(0.34, 0.22, v);
  const c1 = fbm(u * 4.2 + 1.1, v * 11.5, 5);
  const c2 = fbm(u * 8.5 + 3.4, v * 18.0, 4);
  const cloud = smooth(0.47, 0.72, c1 * 0.75 + c2 * 0.25) * cloudBase;
  const lit = smooth(0.42, 0.68, c1 - (v - 0.16) * 0.8);
  const cCol = mix([168, 198, 224], [254, 252, 245], clamp(lit * 0.85 + 0.15));
  col = mix(col, cCol, cloud * 0.86);
  return col;
}

function sampleSceneAboveHorizon(u, v) {
  let col = skyColor(u, v);
  const hFromHoriz = 0.34 - v;

  // 1. 먼 화산 능선 (대기 원근)
  const vf = volcanoFar(u);
  if (hFromHoriz < vf) {
    const shade = 0.78 + 0.22 * ridge(u * 18, v * 28, 3);
    const farCol = mix([112, 152, 186], [148, 184, 210], clamp(hFromHoriz / Math.max(0.01, vf)));
    col = [farCol[0] * shade, farCol[1] * shade, farCol[2] * shade];
  }

  // 2. 왼쪽 현무암 절벽 + 초록 선인장/관목 지대
  const bl = basaltLeft(u);
  if (hFromHoriz < bl) {
    const topK = clamp(hFromHoriz / Math.max(0.01, bl));
    const tex = ridge(u * 42, v * 58, 4);
    const veg = smooth(0.52, 0.82, topK) * smooth(0.38, 0.65, fbm(u * 24, v * 32, 3));
    const rockDark = [48, 46, 44];
    const rockWarm = [96, 84, 72];
    const scrub = [74, 102, 58];
    let rCol = mix(rockDark, rockWarm, clamp(tex * 0.85 + (0.4 - u) * 0.5));
    rCol = mix(rCol, scrub, veg * 0.68);
    // 해안선 흰 파도 포말
    const foam = smooth(0.009, 0.0, hFromHoriz) * (0.6 + 0.4 * noise2(u * 80, 1.5));
    rCol = mix(rCol, [238, 248, 252], foam * 0.8);
    col = mix(rCol, [175, 212, 232], 0.18);
  }

  // 3. 상징적인 키커 록 (León Dormido) — 가파른 화산 응회암 절벽
  const kr = kickerRock(u);
  if (hFromHoriz < kr) {
    const tex = ridge(u * 55, v * 65, 4);
    const strata = Math.sin(v * 240 + fbm(u * 25, v * 25, 3) * 4) * 0.5 + 0.5;
    // 왼쪽(태양 쪽) 면이 따뜻하게 빛나고 오른쪽은 푸른 그림자
    const sunFace = smooth(0.75, 0.67, u) * 0.65 + smooth(0.83, 0.79, u) * 0.35;
    const shadowCol = [46, 56, 70];
    const litCol = [128, 106, 82];
    const guano = smooth(0.55, 0.9, hFromHoriz / Math.max(0.01, kr)) * smooth(0.52, 0.75, fbm(u * 40, v * 40, 3));
    let kCol = mix(shadowCol, litCol, clamp(sunFace * 0.75 + tex * 0.35));
    kCol = mix(kCol, [92, 82, 70], strata * 0.22);
    kCol = mix(kCol, [214, 210, 196], guano * 0.42); // 바닷새 둥지 흰 암반 질감
    const foam = smooth(0.011, 0.0, hFromHoriz) * (0.65 + 0.35 * noise2(u * 95, 2.7));
    kCol = mix(kCol, [242, 250, 255], foam * 0.88);
    col = mix(kCol, [160, 206, 228], 0.12);
  }

  return col;
}

const rgb = Buffer.alloc(W * H * 3);

for (let y = 0; y < H; y++) {
  const v = y / H;
  for (let x = 0; x < W; x++) {
    const u = x / W;
    let col;
    if (y <= HORIZON) {
      col = sampleSceneAboveHorizon(u, v);
    } else {
      // 아래 66%: 갈라파고스 적도 태평양 — 멀리는 깊은 코발트, 가까울수록 맑고 투명한 에메랄드 터콰이즈
      const wd = clamp((y - HORIZON) / (H - HORIZON)); // 0(수평선) .. 1(발밑)
      const persp = 1 / (wd + 0.065);
      // 잔물결 노말 섭동
      const w1 = fbm(u * 14 + persp * 0.35, persp * 1.6, 4);
      const w2 = fbm(u * 28 - persp * 0.2, persp * 3.4, 3);
      const ripple = (w1 - 0.5) * 0.022 + (w2 - 0.5) * 0.012;

      // 수면 반사 (수평선 근처 프레넬 강함)
      const reflV = clamp(0.34 - (v - 0.34) * 0.72 + ripple, 0.005, 0.339);
      const reflU = clamp(u + ripple * 1.4, 0, 1);
      const reflCol = sampleSceneAboveHorizon(reflU, reflV);

      // 수중 투과 색 (깊은 태평양 청록 → 맑은 산호초 에메랄드)
      const deepSea = [14, 78, 128];
      const midTurq = [16, 128, 152];
      const shallowEmer = [28, 162, 168];
      let waterCol = wd < 0.48 ? mix(deepSea, midTurq, wd / 0.48) : mix(midTurq, shallowEmer, (wd - 0.48) / 0.52);

      // 가까운 수면 아래 은은한 용암 암초 & 햇빛 코스틱(수면이 지저분하지 않게 부드럽게)
      const caustic = ridge(u * 9 + w1 * 1.2, wd * 10 + w2 * 0.8, 3);
      const reefHint = smooth(0.32, 0.95, wd) * smooth(0.54, 0.84, caustic);
      waterCol = mix(waterCol, [82, 212, 206], reefHint * 0.24);

      // 프레넬 반사 비율 (수평선 0.62 → 발밑 0.14)
      const fresnel = 0.14 + 0.48 * Math.pow(1 - wd, 2.2);
      col = mix(waterCol, reflCol, fresnel);

      // 잔물결 햇빛 반짝임 (글린트 — 태양 아래 부드러운 반짝임 띠)
      const sunBand = Math.exp(-Math.pow((u - SUN_U) / (0.12 + wd * 0.28), 2));
      const sparkle = smooth(0.62, 0.86, w1 * 0.55 + w2 * 0.45) * sunBand * (0.45 + 0.55 * (1 - wd));
      col = mix(col, [255, 250, 224], clamp(sparkle * 0.58, 0, 0.65));

      // 수평선 부드러운 대기 블렌드
      const hBlend = smooth(0.018, 0.0, wd);
      col = mix(col, [186, 226, 242], hBlend * 0.55);
    }
    const o = (y * W + x) * 3;
    rgb[o] = clamp(Math.round(col[0]), 0, 255);
    rgb[o + 1] = clamp(Math.round(col[1]), 0, 255);
    rgb[o + 2] = clamp(Math.round(col[2]), 0, 255);
  }
}

const outPath = resolve(process.cwd(), 'public/fishing/spot_galapagos.webp');
const buf = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
  .webp({ quality: 90 })
  .toBuffer();
writeFileSync(outPath, buf);
console.log(`Generated ${outPath} (${(buf.length / 1024).toFixed(1)} KB, ${W}x${H})`);
