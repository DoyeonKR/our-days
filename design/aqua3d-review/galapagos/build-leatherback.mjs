// 장수거북(leatherback_turtle · juv_leatherback_turtle · fry_leatherback_turtle) 전용 박물관급 정밀 3D 조각 빌더
// 실물 해부학(Dermochelys coriacea):
//   1. 유선형 눈물방울 가죽 등껍질 + 실제 3D 입체 7개 세로 용골(ridge)과 골짜기(flute) + 뾰족한 후미(supracaudal point)
//   2. 5개 얕은 능선이 있는 연분홍·크림 얼룩 배딱지(plastron)
//   3. 목주름과 두툼한 파충류 머리 · 정수리 고유 분홍 반점(pink pineal spot) · W자 갈고리 부리 · 눈두덩 · 콧구멍
//   4. 몸길이 대비 초대형 유체역학 날개형 앞지느러미발(발톱 없음, 앞전 두껍고 뒷전 얇은 에어포일, 흰·분홍 반점)
//   5. 넓은 방향타형 뒷지느러미발 + 뾰족한 짧은 꼬리
//   6. 치어(fry)는 실물 특유의 7줄 선명한 흰 구슬 용골선과 흰 지느러미 테두리 구현
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import sharp from 'sharp';
import { Model, bake, spineWeight, fbm, noise, mix, smooth, clamp, norm } from '../polar/kit.mjs';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');
const OUT_DIR = resolve(ROOT, 'design/aqua3d-review/galapagos');
mkdirSync(GLB_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mul = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];

// 7개 세로 용골 각도 위치와 강도 (정중앙 + 2쌍 등 용골은 또렷하게, 좌우 가장자리 1쌍은 매끈한 옆날로)
const KEEL_SPECS = [
  [0, 1.0],
  [0.44, 0.96], [-0.44, 0.96],
  [0.88, 0.92], [-0.88, 0.92],
  [1.30, 0.62], [-1.30, 0.62],
];

function keelIntensity(th) {
  let k = 0;
  for (const [a, amp] of KEEL_SPECS) {
    const d = Math.abs(th - a);
    k = Math.max(k, amp * Math.exp(-(d * d) / (0.095 * 0.095)));
  }
  return k;
}

function ventralKeel(th) {
  // 배쪽 5개 얕은 능선
  const a = Math.abs(th);
  if (a < 1.75) return 0;
  let k = 0;
  for (const t of [Math.PI, Math.PI - 0.38, Math.PI - 0.78]) {
    const d = Math.abs(a - t);
    k = Math.max(k, Math.exp(-(d * d) / (0.11 * 0.11)));
  }
  return k;
}

function buildLeatherback(stage) {
  // stage: 0=fry(치어), 1=juv(준성체), 2=adult(성체)
  const isFry = stage === 0, isJuv = stage === 1;
  const m = new Model();

  const cObsidian = isFry ? hex('#14171c') : isJuv ? hex('#1b2028') : hex('#1e242c');
  const cSlate    = isFry ? hex('#242a34') : isJuv ? hex('#323c4a') : hex('#384352');
  const cKeel     = isFry ? hex('#e8eef4') : isJuv ? hex('#7c8da0') : hex('#5f6d7d');
  const cSpotW    = isFry ? hex('#eef2f6') : hex('#cbd6e0');
  const cSpotPink = hex('#d9a2a8');
  const cPlastron = isFry ? hex('#cfd6dc') : hex('#dcd2cc');
  const cThroat   = isFry ? hex('#b8bfc8') : hex('#d6b8b6');
  const cPineal   = hex('#e29aa4'); // 장수거북 성체 정수리 고유 분홍 반점!

  // ── 1. 유선형 눈물방울 등껍질(carapace) + 배딱지(plastron) — 실제 3D 7개 용골 조형 ──
  // x: +0.58(앞 목깃) -> -0.82(뾰족한 후미 supracaudal point), 총 등딱지 길이 1.40
  const X_FRONT = 0.58, X_BACK = -0.82;
  m.sweep('carapace', (s) => {
    const x = X_FRONT + (X_BACK - X_FRONT) * s;
    // 앞 어깨(s≈0.24)가 넓고 듬직하며 뒤로 갈수록 길고 우아한 눈물방울로 좁아짐
    const shoulder = Math.sin(Math.pow(clamp(s, 0.004, 0.996), 0.62) * Math.PI);
    const tailPoint = Math.pow(1 - s, 0.42);
    const width = (isFry ? 0.44 : 0.47) * Math.pow(shoulder, 0.72) * (0.72 + 0.28 * tailPoint);
    // 등 아치: 앞~중간이 둥글게 솟고 뒤로 갈수록 유선형으로 내려감
    const heightTop = (isFry ? 0.19 : 0.215) * Math.pow(shoulder, 0.76);
    const cy = 0.025 * Math.sin(s * Math.PI) - 0.03 * s;
    // 용골 강도: 앞·뒤 끝에서는 부드럽게 사라지고 등 본체에서 선명하게 솟음
    const keelEnv = smooth(0.04, 0.16, s) * smooth(0.98, 0.84, s);

    return {
      c: [x, cy, 0],
      u: [0, 1, 0],
      v: [0, 0, 1],
      a: Math.max(0.014, heightTop),
      b: Math.max(0.018, width),
      e: 2.15,
      // ★ 실제 3D 기하학적 용골 + 골짜기 변형 (r(theta))!
      r: (th) => {
        // polar/kit.mjs 에서 cos(th)=u(+Y 위), sin(th)=v(+Z 옆)
        const ang = Math.atan2(Math.sin(th), Math.cos(th)); // -PI..PI, 0=+Y
        const cosT = Math.cos(ang);
        const topMask = smooth(-0.22, 0.15, cosT);
        const botMask = smooth(0.15, -0.35, cosT);
        // 등쪽 7개 용골: 능선은 +0.105 솟고 골짜기는 -0.045 들어감
        const kTop = keelIntensity(ang);
        const flute = topMask * keelEnv * (kTop * 0.115 - (1 - kTop) * 0.038);
        // 배쪽(plastron)은 약간 평평하게 + 5개 얕은 배 능선
        const flatBelly = botMask * (-0.28 + ventralKeel(ang) * 0.035 * keelEnv);
        // 앞 목깃(nuchal notch) 살짝 오목하게
        const nuchal = s < 0.08 && Math.abs(ang) < 0.5 ? -0.06 * (1 - s / 0.08) : 0;
        return 1.0 + flute + flatBelly + nuchal;
      },
    };
  }, {
    ns: 36, nt: 36, capStart: 0.025, capEnd: 0.02, capRings: 3,
    island: [0.01, 0.01, 0.62, 0.56], bone: 'body',
    paint: (P, n, [s, t]) => {
      const ang = (t - 0.5) * Math.PI * 2; // kit.mjs t in [0,1] -> angle
      const cosA = Math.cos(t * Math.PI * 2 + Math.PI); // +1 at top(+Y), -1 at bottom(-Y)
      const th = Math.atan2(P[2], P[1] - 0.01); // 실제 위치 기준 각도(0=+Y)
      const kTop = keelIntensity(th);
      const isBelly = n[1] < -0.32 || P[1] < -0.085;
      const grain = 0.90 + 0.18 * fbm([P[0] * 26, P[1] * 26, P[2] * 26], 3);

      if (isBelly) {
        // 배딱지(plastron): 크림·연분홍 바탕 + 어두운 회색 얼룩
        const mot = fbm([P[0] * 8, P[2] * 8, 3.1], 3);
        let col = mix(cPlastron, cSlate, smooth(0.50, 0.78, mot) * 0.45);
        col = mix(col, cSpotPink, smooth(0.35, 0.65, fbm([P[0] * 5, P[2] * 5, 1.7], 2)) * 0.32);
        return mul(col, grain);
      }

      // 가죽 등껍질(carapace): 깊은 젖은 흑청색 + 용골 하이라이트 + 별빛 흰/연청/분홍 반점
      const broad = fbm([P[0] * 6, P[1] * 6, P[2] * 6], 3);
      let col = mix(cObsidian, cSlate, smooth(0.32, 0.75, broad) * 0.62);

      // 용골 능선 강조 (치어는 선명한 흰 구슬선, 성체는 밝은 은회·연분홍 마모 하이라이트)
      const bead = isFry ? (0.65 + 0.35 * Math.sin(P[0] * 62)) : (0.55 + 0.45 * fbm([P[0] * 18, P[2] * 18, 2], 2));
      col = mix(col, cKeel, kTop * (isFry ? 0.92 : isJuv ? 0.58 : 0.42) * bead);

      // 장수거북 고유의 불규칙한 흰/연하늘/연분홍 얼룩 반점 (자연스러운 다중 스케일)
      const sp1 = fbm([P[0] * 17, P[1] * 17, P[2] * 17], 3);
      const sp2 = noise(P[0] * 38, P[1] * 38, P[2] * 38);
      if (sp1 > 0.66) {
        const spotCol = sp2 > 0.62 ? cSpotPink : cSpotW;
        col = mix(col, spotCol, smooth(0.66, 0.78, sp1) * (isFry ? 0.35 : 0.72));
      }
      if (sp2 > 0.86 && !isFry) col = mix(col, cSpotW, 0.55);

      // 골짜기 오목 음영(ambient occlusion 느낌)
      if (kTop < 0.15) col = mul(col, 0.86);
      return mul(col, grain);
    },
  });

  // ── 2. 근육질 목(neck) — 주름진 가죽 피부 + 연분홍·흰 목구멍 ──
  m.sweep('neck', (s) => {
    const x = 0.50 + s * 0.24;
    const cy = 0.015 + s * 0.035;
    const wrinkle = 1 + 0.045 * Math.sin(s * Math.PI * 5);
    return {
      c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1],
      a: (0.125 - s * 0.018) * wrinkle,
      b: (0.135 - s * 0.016) * wrinkle,
      e: 2.1,
    };
  }, {
    ns: 12, nt: 16, capStart: 0.02, capEnd: 0.015,
    island: [0.64, 0.01, 0.98, 0.20], bone: 0,
    paint: (P, n) => {
      const grain = 0.90 + 0.18 * fbm([P[0] * 32, P[1] * 32, P[2] * 32], 3);
      let col = n[1] < -0.18 ? mix(cThroat, cSlate, 0.28) : mix(cObsidian, cSlate, 0.45);
      const sp = fbm([P[0] * 18, P[1] * 18, P[2] * 18], 2);
      if (sp > 0.62) col = mix(col, n[1] < 0 ? cSpotPink : cSpotW, smooth(0.62, 0.78, sp) * 0.75);
      return mul(col, grain);
    },
  });

  // ── 3. 정밀 파충류 머리(head) — 정수리 분홍 반점 + W자 윗부리 + 아래턱 + 콧구멍 ──
  m.sweep('head', (s) => {
    // s=0 뒤통수(0.70) -> s=1 주둥이 끝(1.04)
    const x = 0.70 + s * 0.34;
    const dome = Math.sin(Math.pow(clamp(s, 0.02, 0.98), 0.72) * Math.PI);
    const a = 0.032 + 0.092 * Math.pow(dome, 0.72) * (1 - 0.18 * s);
    const b = 0.028 + 0.098 * Math.pow(dome, 0.68) * (1 - 0.24 * s);
    // 이마에서 주둥이로 부드럽게 내려오는 각도
    const cy = 0.052 + 0.018 * Math.sin(s * Math.PI * 0.7) - 0.036 * Math.pow(s, 1.5);
    return {
      c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15,
      r: (th) => {
        // 뺨과 눈두덩 미세 굴곡 + 아래턱 윤곽
        const ang = Math.atan2(Math.sin(th), Math.cos(th));
        const brow = s > 0.35 && s < 0.72 ? 0.06 * Math.exp(-((Math.abs(ang) - 0.78) ** 2) / 0.08) : 0;
        return 1.0 + brow;
      },
    };
  }, {
    ns: 18, nt: 20, capStart: 0.02, capEnd: 0.018, capRings: 3,
    island: [0.64, 0.22, 0.98, 0.46], bone: 0,
    paint: (P, n, [s]) => {
      const grain = 0.92 + 0.16 * fbm([P[0] * 36, P[1] * 36, P[2] * 36], 3);
      let col = n[1] < -0.28 ? mix(cThroat, cSlate, 0.32) : mix(cObsidian, cSlate, 0.42);
      // 뺨·이마 흰/분홍 반점
      const sp = fbm([P[0] * 22, P[1] * 22, P[2] * 22], 2);
      if (sp > 0.64) col = mix(col, cSpotW, smooth(0.64, 0.80, sp) * 0.68);
      // ★ 장수거북의 상징: 정수리 분홍 반점 (pink pineal spot)
      if (!isFry) {
        const dp = Math.hypot((P[0] - 0.83) * 1.1, P[2] * 1.4);
        if (n[1] > 0.45 && dp < 0.055) {
          col = mix(col, cPineal, smooth(0.055, 0.018, dp) * 0.88);
        }
      }
      // W자 윗부리 입선 (mouth line)
      if (P[0] > 0.80 && Math.abs(n[2]) > 0.25) {
        const mouthY = 0.012 - (P[0] - 0.80) * 0.08 + 0.008 * Math.sin((P[0] - 0.86) * 42);
        const md = Math.abs(P[1] - mouthY);
        if (md < 0.009) col = mix(col, [10, 10, 14], (1 - md / 0.009) * 0.85);
      }
      // 콧구멍 2개 (주둥이 끝 위쪽)
      for (const sd of [1, -1]) {
        if (Math.hypot(P[0] - 1.005, P[1] - 0.042, P[2] - sd * 0.022) < 0.011) col = [10, 10, 12];
      }
      return mul(col, grain);
    },
  });

  // 눈 + 두툼한 파충류 눈두덩(eyelids)
  for (const sd of [1, -1]) {
    const ec = [0.895, 0.068, sd * 0.072];
    m.sphere('eyelid' + sd, [ec[0] - 0.004, ec[1] + 0.004, ec[2] * 0.94], 0.031, { ns: 8, nt: 10, island: [0.82, 0.48, 0.98, 0.60], bone: 0, paint: () => cSlate });
    m.sphere('eye' + sd, ec, 0.023, {
      ns: 8, nt: 10, island: [0.88, 0.88, 0.99, 0.99], bone: 0,
      paint: (P, n) => {
        const glint = Math.exp(-((n[0] - 0.35) ** 2 + (n[1] - 0.48) ** 2) * 28);
        return mix([12, 14, 18], [242, 246, 255], clamp(glint * 0.92));
      },
    });
  }

  // ── 4. 초대형 유체역학 날개형 앞지느러미발 (fin_L · fin_R) ──
  // 어깨 뿌리를 등딱지 소켓 안쪽(z=±0.22)에 깊고 매끄럽게 심어 배/위에서 봐도 자연스러운 근육질 연결!
  const fins = {};
  const wingSpan = isFry ? 1.08 : 1.24;
  for (const sd of [1, -1]) {
    const root = [0.34, -0.025, sd * 0.22];
    const tip  = [-0.26, -0.095, sd * (0.22 + wingSpan)];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      // 어깨(s<0.18)는 둥근 상완골, 중간(s=0.2..0.8)은 넓고 우아하게 휘어진 에어포일 날개
      const sweepFwd = Math.sin(s * Math.PI) * 0.24 * (1 - 0.42 * s);
      const cx = root[0] + (tip[0] - root[0]) * Math.pow(s, 1.15) + sweepFwd;
      const cy = root[1] + (tip[1] - root[1]) * s + Math.sin(s * Math.PI) * 0.042;
      const cz = root[2] + (tip[2] - root[2]) * s;
      const shoulderPinch = 0.62 + 0.38 * smooth(0.0, 0.22, s);
      const chord = (isFry ? 0.19 : 0.215) * shoulderPinch * (0.76 + 0.42 * Math.sin(Math.pow(s, 0.62) * Math.PI)) * (1 - 0.72 * Math.pow(s, 1.35));
      const thick = 0.052 * Math.pow(1 - s * 0.78, 1.12);
      return {
        c: [cx, cy, cz],
        u: [1, -0.08, 0],
        v: [0, 1, 0],
        a: Math.max(0.022, chord),
        b: Math.max(0.008, thick),
        e: 2.2,
      };
    }, {
      ns: 18, nt: 14, capStart: 0.02, capEnd: 0.018, capRings: 2,
      island: sd > 0 ? [0.01, 0.58, 0.48, 0.98] : [0.50, 0.58, 0.98, 0.98],
      bone: sd > 0 ? 6 : 8,
      paint: (P, n, [s, t]) => {
        const grain = 0.91 + 0.16 * fbm([P[0] * 24, P[1] * 24, P[2] * 24], 3);
        const isUnder = n[1] < -0.22;
        let col = isUnder ? mix(cSlate, cPlastron, 0.45) : mix(cObsidian, cSlate, 0.35 + 0.25 * s);
        if (isFry && Math.abs(Math.cos(t * Math.PI * 2)) > 0.72) col = mix(col, cSpotW, 0.85);
        const sp = fbm([P[0] * 16, P[1] * 16, P[2] * 16], 3);
        if (sp > 0.63) col = mix(col, isUnder ? cSpotPink : cSpotW, smooth(0.63, 0.78, sp) * 0.76);
        return mul(col, grain);
      },
    });
    fins[sd > 0 ? 'L' : 'R'] = { root, tip };
  }

  // ── 5. 넓은 부채꼴 방향타형 뒷지느러미발(hind flippers) + 짧은 뾰족 꼬리 ──
  for (const sd of [1, -1]) {
    m.sweep('hind' + sd, (s) => {
      const cx = -0.52 - s * 0.48;
      const cy = -0.052 - s * 0.02;
      const cz = sd * (0.10 + Math.pow(s, 0.85) * 0.36);
      const chord = 0.165 * (0.52 + 0.68 * Math.sin(Math.pow(s, 0.75) * Math.PI)) * (1 - 0.35 * s);
      const thick = 0.028 * (1 - 0.65 * s);
      return { c: [cx, cy, cz], u: [1, 0, 0], v: [0, 1, 0], a: Math.max(0.024, chord), b: Math.max(0.007, thick), e: 2.15 };
    }, {
      ns: 12, nt: 10, capEnd: 0.016,
      island: [0.64, 0.48, 0.80, 0.57], bone: 5,
      paint: (P, n) => {
        let col = n[1] < -0.25 ? mix(cSlate, cPlastron, 0.4) : cObsidian;
        const sp = fbm([P[0] * 18, P[2] * 18, 2], 2);
        if (sp > 0.65) col = mix(col, cSpotW, 0.65);
        return col;
      },
    });
  }
  // 짧은 뾰족 꼬리
  m.sweep('tail', (s) => ({
    c: [-0.74 - s * 0.26, -0.045 - s * 0.01, 0], u: [0, 1, 0], v: [0, 0, 1],
    a: Math.max(0.008, 0.042 * (1 - 0.82 * s)), b: Math.max(0.008, 0.038 * (1 - 0.82 * s)),
  }), { ns: 8, nt: 8, capEnd: 0.006, island: [0.64, 0.48, 0.80, 0.57], bone: 5, paint: () => cObsidian });

  return {
    m, fins,
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') return [[6, 1 - s * 0.70], [7, s * 0.70]];
      if (part.name === 'fin_R') return [[8, 1 - s * 0.70], [9, s * 0.70]];
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

// ── 고해상도 6면 정밀 검수 렌더러 (옆 · 3/4 정면위 · 위 · 정면 · 후면 3/4 · 배딱지) ──
async function renderInspect6(glbPath, outPath) {
  await MeshoptDecoder.ready;
  const buf = readFileSync(glbPath);
  const jl = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const bin = buf.subarray(20 + jl + 8);
  const iv = j.bufferViews[j.images[0].bufferView];
  const imgBytes = bin.subarray(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
  const { data: texData, info: texInfo } = await sharp(imgBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const stub = { name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new T.Texture()) };
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => stub)
      .parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const geom = mesh.geometry;
  const pos = geom.attributes.position, nor = geom.attributes.normal, uv = geom.attributes.uv, idx = geom.index;
  const nV = pos.count, P = new Array(nV), N = new Array(nV), UV = new Array(nV);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < nV; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    P[i] = [x, y, z]; N[i] = norm([nor.getX(i), nor.getY(i), nor.getZ(i)]); UV[i] = [uv.getX(i), uv.getY(i)];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  const L1 = norm([0.42, 0.72, 0.55]), L2 = norm([-0.55, -0.30, 0.60]);
  const S = 384, W = S * 3, H = S * 2;
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 236; rgba[i * 4 + 1] = 242; rgba[i * 4 + 2] = 248; rgba[i * 4 + 3] = 255; }

  const views = [
    { label: 'SIDE',         yaw: 0,    pitch: 4,   ox: 0,     oy: 0 },
    { label: '3/4 HERO',     yaw: 38,   pitch: 24,  ox: S,     oy: 0 },
    { label: 'TOP (7 KEELS)',yaw: 0,    pitch: 88,  ox: S * 2, oy: 0 },
    { label: 'FRONT HEAD',   yaw: 90,   pitch: 10,  ox: 0,     oy: S },
    { label: 'REAR 3/4',     yaw: -140, pitch: 26,  ox: S,     oy: S },
    { label: 'BELLY',        yaw: 0,    pitch: -88, ox: S * 2, oy: S },
  ];

  const tw = texInfo.width, th = texInfo.height;
  for (const { yaw, pitch, ox, oy } of views) {
    const cyaw = Math.cos(yaw * Math.PI / 180), syaw = Math.sin(yaw * Math.PI / 180);
    const cp = Math.cos(pitch * Math.PI / 180), sp = Math.sin(pitch * Math.PI / 180);
    const rotP = (v) => { const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz; const xr = dx * cyaw - dz * syaw, zr = dx * syaw + dz * cyaw; return [xr, dy * cp - zr * sp, dy * sp + zr * cp]; };
    const rotN = (n) => { const xr = n[0] * cyaw - n[2] * syaw, zr = n[0] * syaw + n[2] * cyaw; return [xr, n[1] * cp - zr * sp, n[1] * sp + zr * cp]; };
    let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
    const RP = P.map(rotP), RN = N.map(rotN);
    for (const r of RP) { if (r[0] < px0) px0 = r[0]; if (r[0] > px1) px1 = r[0]; if (r[1] < py0) py0 = r[1]; if (r[1] > py1) py1 = r[1]; }
    const scale = (S * 0.84) / Math.max(px1 - px0, py1 - py0, 0.001);
    const pcx = (px0 + px1) * 0.5, pcy = (py0 + py1) * 0.5;
    const R = RP.map((r) => [S * 0.5 + (r[0] - pcx) * scale, S * 0.5 - (r[1] - pcy) * scale, r[2]]);
    const zbuf = new Float32Array(S * S).fill(-1e9);

    for (let t = 0; t < idx.count; t += 3) {
      const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
      const p0 = R[i0], p1 = R[i1], p2 = R[i2];
      const den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
      if (Math.abs(den) < 1e-4) continue;
      const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
      const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / den;
        const w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
        const z = p0[2] * w0 + p1[2] * w1 + p2[2] * w2;
        if (z <= zbuf[y * S + x]) continue;
        zbuf[y * S + x] = z;
        const rn = norm([RN[i0][0] * w0 + RN[i1][0] * w1 + RN[i2][0] * w2, RN[i0][1] * w0 + RN[i1][1] * w1 + RN[i2][1] * w2, RN[i0][2] * w0 + RN[i1][2] * w1 + RN[i2][2] * w2]);
        if (rn[2] < 0) { rn[0] = -rn[0]; rn[1] = -rn[1]; rn[2] = -rn[2]; }
        const u = clamp(UV[i0][0] * w0 + UV[i1][0] * w1 + UV[i2][0] * w2);
        const v = clamp(UV[i0][1] * w0 + UV[i1][1] * w1 + UV[i2][1] * w2);
        const tx = Math.min(tw - 1, Math.floor(u * tw)), ty = Math.min(th - 1, Math.floor(v * th));
        const to = (ty * tw + tx) * 4;
        // 젖은 가죽 스페큘러 + 확산광
        const ndl = Math.max(0, rn[0] * L1[0] + rn[1] * L1[1] + rn[2] * L1[2]);
        const spec = Math.pow(Math.max(0, rn[0] * 0.25 + rn[1] * 0.55 + rn[2] * 0.79), 18) * 32;
        const l = 0.44 + ndl * 0.58 + Math.max(0, rn[0] * L2[0] + rn[1] * L2[1] + rn[2] * L2[2]) * 0.16;
        const o = ((oy + y) * W + (ox + x)) * 4;
        rgba[o]     = clamp(Math.round(texData[to]     * l + spec), 0, 255);
        rgba[o + 1] = clamp(Math.round(texData[to + 1] * l + spec), 0, 255);
        rgba[o + 2] = clamp(Math.round(texData[to + 2] * l + spec), 0, 255);
        rgba[o + 3] = 255;
      }
    }
  }
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${views.map((v) => `<text x="${v.ox + 10}" y="${v.oy + 22}" font-family="monospace" font-size="16" font-weight="bold" fill="#1e293b">${v.label}</text>`).join('')}</svg>`);
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).composite([{ input: svg, top: 0, left: 0 }]).webp({ quality: 92 }).toFile(outPath);
}

const STAGES = [
  { key: 'leatherback_turtle', stage: 2 },
  { key: 'juv_leatherback_turtle', stage: 1 },
  { key: 'fry_leatherback_turtle', stage: 0 },
];

for (const { key, stage } of STAGES) {
  const { m, fins, weight } = buildLeatherback(stage);
  const { glb, tris } = await bake(key, m, {
    fins, weight,
    source: 'leatherback-turtle-museum-v2 (2026-11-27)',
    atlas: 1024,
    roughness: 0.42, // 젖은 가죽 등딱지 질감
    compress: { webpQuality: 93 },
  });
  if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
  const out = resolve(GLB_DIR, `${key}.glb`);
  writeFileSync(out, glb);
  console.log(`Built ${key}.glb: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
  if (stage === 2) await renderInspect6(out, resolve(OUT_DIR, 'leatherback_inspect_adult.webp'));
  if (stage === 0) await renderInspect6(out, resolve(OUT_DIR, 'leatherback_inspect_fry.webp'));
}
