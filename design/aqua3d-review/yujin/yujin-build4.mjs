// 유진 3D — 4차 업그레이드(2026-11-27):
//   · 얼굴/머리: 기존 3차 스캔 머리 + 2048 고해상도 얼굴 아틀라스에서 무손실 추출 후
//     (1) 얼굴-스캔 경계 검은 실선 및 튀어나온 회색 조각 제거(경계 z-정합 + 외곽 어두운 선 클린업)
//     (2) 머리카락 아틀라스의 밝은 살구색 점 얼룩 완전 제거 및 자연스러운 결 보강
//   · 몸통 조형:
//     (1) 어깨-소매 직각 분리 해소(어깨 안쪽에서 부드럽게 이어지는 드롭숄더 베지어 경로 + 둥근 델토이드 캡 + 스무스 웨이트)
//     (2) 골반(hips) 하단 둥근 덩어리 노출 제거 — 와이드 청바지 상단과 매끈하게 통합 + 데님 워싱/솔기 디테일
//     (3) 크로스백 끈(strap)이 쇄골에서 끊기던 문제 해결 — 앞가슴 → 어깨 위 → 등 뒤 → 가방 뒤쪽까지 완전한 폐루프 + 연결 고리
//     (4) 손 비율 자연스럽게 보정 + 손톱 셰이딩 버그(smooth(..., 0) → st[0]) 수정
//     (5) 검은 플리스 재킷 입체 음영(목깃·겨드랑이·지퍼·밑단 AO + 하이라이트) 강화
//   · 126개 관절 구조 100% 유지(기존 테스트 호환)
// 실행: node design/aqua3d-review/yujin/yujin-build4.mjs [--debug]
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import sharp from 'sharp';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, norm, add, cross} from '../polar/kit.mjs';

const HERE = new URL('./', import.meta.url);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a, b, t) => a + (b - a) * t;
const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1, 2].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};

// ── 비율(사람 좌표 — y 위 · 얼굴 +z · 오른쪽 -x) ──
const B = {
  chin: .765, floor: -.76, neck: [-.01, -.235], bodyZ: -.235,
  shoulderY: .655, hemY: .15, crotchY: .07,
  sh: [.175, .60], el: [.228, .40], wr: [.242, .20],
  legX: .094, legR: .088,
};
const FE = {x: -.009, y: .846, rx: .058, rxR: .066, ry: .082, ryUp: .112};
const feOf = (x, y) => Math.hypot((x - FE.x) / (x > FE.x ? FE.rxR : FE.rx), (y - FE.y) / (y > FE.y ? FE.ryUp : FE.ry));
const FACE_MODEL = [[-.046, .884], [.031, .883], [-.012, .829], [-.011, .792], [-.008, .765]];
const FEAT = [
  [FACE_MODEL[0][0], FACE_MODEL[0][1], .025, .013],
  [FACE_MODEL[1][0], FACE_MODEL[1][1], .025, .013],
  [FACE_MODEL[0][0], FACE_MODEL[0][1] + .022, .031, .01],
  [FACE_MODEL[1][0], FACE_MODEL[1][1] + .022, .031, .01],
  [-.012, .83, .022, .015],
  [-.011, .8, .036, .021],
];
const featW = (x, y) => Math.max(...FEAT.map(([cx, cy, rx, ry]) => smooth(1.25, .88, Math.hypot((x - cx) / rx, (y - cy) / ry))));
const lum = (c) => .3 * c[0] + .59 * c[1] + .11 * c[2];

const ATLAS = 4096;
const HAIR_N = 12, HAIR_SEG = 6, HAIR_TOP = .79, HAIR_BOT = .46, HAIR_X = .16, HAIR_Z = -.39;

function sampleRaw(img, u, v) {
  const fu = clamp(u, 0, .9999) * (img.w - 1);
  const fv = clamp(v, 0, .9999) * (img.h - 1);
  const x = Math.floor(fu), y = Math.floor(fv), fx = fu - x, fy = fv - y;
  const x1 = Math.min(img.w - 1, x + 1), y1 = Math.min(img.h - 1, y + 1);
  const o00 = (y * img.w + x) * 3, o10 = (y * img.w + x1) * 3, o01 = (y1 * img.w + x) * 3, o11 = (y1 * img.w + x1) * 3;
  return [0, 1, 2].map((c) =>
    (img.d[o00 + c] * (1 - fx) + img.d[o10 + c] * fx) * (1 - fy) +
    (img.d[o01 + c] * (1 - fx) + img.d[o11 + c] * fx) * fy
  );
}

// ── 3차 원본 GLB(3e9ded87)에서 머리 · 얼굴 메시와 2048px 아틀라스 무손실 추출 ──
async function loadBaseHead() {
  const glbBuf = execFileSync('git', ['show', '3e9ded87:public/aqua/models/fish/yujin.glb'], {maxBuffer: 20 * 1024 * 1024});
  // 내장 WebP 아틀라스 추출
  const jsonLen = glbBuf.readUInt32LE(12);
  const gltf = JSON.parse(glbBuf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bv = gltf.bufferViews[gltf.images[0].bufferView];
  const webpBuf = glbBuf.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
  const {data, info} = await sharp(webpBuf).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const atlas = {d: data, w: info.width, h: info.height};

  // Three.js GLTFLoader로 디코딩 (Meshopt 복원)
  await MeshoptDecoder.ready;
  const webpExt = {name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new T.Texture())};
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webpExt)
    .parseAsync(glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength), '');
  g.scene.updateMatrixWorld(true);

  const wp = (n) => g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
  const hBone = wp('head'), lBone = wp('leg_L');
  const S = (hBone.x - lBone.x) / (0.735 - 0.13);
  const M0 = 0.735 - hBone.x / S;
  const M1 = 0.235 - hBone.y / S;
  const toH = (vx, vy, vz) => [-(vz / S), vx / S + M0, -(vy / S + M1)];

  let mesh;
  g.scene.traverse((o) => { if (o.isMesh) mesh = o; });
  const uv = mesh.geometry.attributes.uv;
  const idx = mesh.geometry.index;

  const extractSub = (pred, u0, v0, u1, v1) => {
    const P = [], ST = [], I = [], map = new Map();
    const pad = 6 / ATLAS;
    const iu0 = u0 + pad, iv0 = v0 + pad, iu1 = u1 - pad, iv1 = v1 - pad;
    const tmp = new T.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const mu = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
      const mv = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
      if (!pred(mu, mv)) continue;
      for (const k of [a, b, c]) {
        if (!map.has(k)) {
          map.set(k, P.length);
          mesh.getVertexPosition(k, tmp).applyMatrix4(mesh.matrixWorld);
          P.push(toH(tmp.x, tmp.y, tmp.z));
          const s = clamp((uv.getX(k) - iu0) / (iu1 - iu0));
          const t = clamp((uv.getY(k) - iv0) / (iv1 - iv0));
          ST.push([s, t]);
        }
        I.push(map.get(k));
      }
    }
    return {P, ST, I};
  };

  const face = extractSub((u, v) => v <= 0.601 && u <= 0.401, 0, 0, .4, .6);
  const head = extractSub((u, v) => v <= 0.601 && u > 0.401, .4, 0, 1, .6);

  // ── 얼굴-머리 경계 정합 (검은 틈 & 튀어나온 회색 스캔 조각 제거) ──
  // 1) 얼굴 면의 2D 깊이 격자 구축
  const G = 0.004, x0 = -0.10, y0 = 0.74, nx = 50, ny = 65;
  const fz = new Float32Array(nx * ny).fill(-9);
  for (const p of face.P) {
    const i = Math.round((p[0] - x0) / G), j = Math.round((p[1] - y0) / G);
    if (i >= 0 && j >= 0 && i < nx && j < ny) fz[j * nx + i] = Math.max(fz[j * nx + i], p[2]);
  }
  const faceZ = (x, y) => {
    const i = clamp(Math.round((x - x0) / G), 0, nx - 1), j = clamp(Math.round((y - y0) / G), 0, ny - 1);
    return fz[j * nx + i];
  };

  // 2) 스캔 머리(head)에서 얼굴 타원 안쪽/경계로 삐져나온 회색 조각 정점을 얼굴 뒤로 매끄럽게 밀기
  for (const p of head.P) {
    const e = feOf(p[0], p[1]);
    if (e < 1.02 && p[2] > -0.215 && p[1] > B.chin + 0.005) {
      const zf = faceZ(p[0], p[1]);
      if (zf > -8 && p[2] > zf - 0.0014) {
        const push = smooth(1.02, 0.93, e);
        p[2] = lerp(p[2], zf - 0.0018, push);
      }
    }
  }

  // 3) 얼굴 패치(face) 가장자리 — 이마/턱 경계가 톱니처럼 뜨지 않게 스캔 머리카락 속으로 부드럽게 수렴
  for (const p of face.P) {
    const e = feOf(p[0], p[1]);
    if (e > 0.96) {
      p[2] -= 0.0005 * smooth(0.96, 1.07, e);
    }
  }

  return {atlas, face, head};
}

function skeleton(arms, legs, bagTop) {
  const E = [{name: 'head', parent: 'spine_0', at: [B.neck[0], .735, B.neck[1]]}];
  for (let h = 0; h < HAIR_N; h++) {
    const x = lerp(-HAIR_X, HAIR_X, h / (HAIR_N - 1)) + B.neck[0];
    for (let k = 0; k < HAIR_SEG; k++) {
      E.push({name: `hair_${h}_${k}`, parent: k ? `hair_${h}_${k - 1}` : 'head', at: [x, lerp(HAIR_TOP, HAIR_BOT, k / HAIR_SEG), HAIR_Z + .01 * k]});
    }
  }
  for (const [side, fin] of [['R', 'fin_L'], ['L', 'fin_R']]) {
    const a = arms[side];
    E.push({name: 'wrist_' + side, parent: fin + '_tip', at: a.wr}, {name: 'palm_' + side, parent: 'wrist_' + side, at: a.hand0});
    a.fingers.forEach((fg, fi) => fg.joints.forEach((j, k) => E.push({name: `f${fi}_${k}_${side}`, parent: k ? `f${fi}_${k - 1}_${side}` : 'palm_' + side, at: j})));
  }
  for (const [side, leg] of [['R', 'leg_L'], ['L', 'leg_R']]) {
    const l = legs[side];
    E.push({name: 'knee_' + side, parent: leg, at: l.knee}, {name: 'ankle_' + side, parent: 'knee_' + side, at: l.ank}, {name: 'toe_' + side, parent: 'ankle_' + side, at: l.toe});
  }
  E.push({name: 'bag', parent: 'spine_1', at: bagTop});
  return E;
}

async function build() {
  const {atlas, face: FM, head: HM} = await loadBaseHead();
  // 기본 색상 팔레트 (기존 3차 아틀라스 피부톤 기준 샘플링)
  const SKIN = sampleRaw(atlas, 0.21, 0.24); // 볼 중앙 피부톤
  const SKL = lum(SKIN);
  const JACKET = [24, 24, 29];
  const JEANS = [110, 123, 134], JEANS_LT = [162, 173, 182];
  const BAG = [216, 208, 186];
  const HAIR = [22, 19, 18];

  const m = new Model();
  const n3 = (p, f, o = 3) => fbm([p[0] * f, p[1] * f, p[2] * f], o);
  const hairCol = (p) => {
    const strand = fbm([p[0] * 220, p[1] * 16, p[2] * 220], 3);
    const sheen = smooth(.58, .92, fbm([p[0] * 28, p[1] * 4, p[2] * 28], 2));
    return HAIR.map((v, k) => v * (.72 + .65 * strand) + [34, 27, 24][k] * sheen * .38);
  };
  const fleece = (p, n) => {
    const g = n3(p, 165, 3), cl = n3(p, 22, 2);
    // 목깃 아래 · 겨드랑이 · 밑단 AO 및 상단 부드러운 하이라이트
    const neckAO = 1 - .22 * smooth(.72, .66, p[1]) * smooth(.15, .08, Math.hypot(p[0] - B.neck[0], p[2] - B.bodyZ));
    const hemAO = 1 - .18 * smooth(.21, .15, p[1]);
    const topHi = .92 + .22 * smooth(-.3, .85, n[1]) + .08 * smooth(.2, .9, n[2]);
    return JACKET.map((v, k) =>
      v * (.76 + .48 * g + .22 * (cl - .5)) * topHi * neckAO * hemAO +
      [8, 8, 11][k] * smooth(.58, .95, g)
    );
  };

  // ── 1) 얼굴 면 (기존 고해상도 아틀라스 + 외곽 검은 실선 클린업) ──
  const pad = 6 / ATLAS;
  m.parts.push({
    name: 'face', P: FM.P, ST: FM.ST, I: FM.I,
    island: [0, 0, .4, .6],
    paint: (p, n, st) => {
      const u = pad + (.4 - 2 * pad) * st[0], v = pad + (.6 - 2 * pad) * st[1];
      let c = sampleRaw(atlas, u, v);
      const e = feOf(p[0], p[1]);
      // 외곽(뺨 끝 · 이마 끝)에서 눈/눈썹/코/입 밖의 어두운 실선/그늘 제거
      if (e > 0.84) {
        const r = lum(c) / SKL;
        const dark = smooth(.72, .45, r) * smooth(.84, .96, e) * (1 - featW(p[0], p[1]));
        if (dark > 0) {
          // 안쪽 방향으로 살짝 당겨 샘플링한 피부톤과 자연스럽게 블렌딩
          const uIn = lerp(u, .20, .06), vIn = lerp(v, .28, .04);
          const cleanSkin = mix(sampleRaw(atlas, uIn, vIn), SKIN, .35);
          c = mix(c, cleanSkin, dark * .92);
        }
      }
      return c;
    },
    bone: 'face', B: [], keepWinding: true, weld: 'face',
  });

  // ── 2) 스캔 머리/머리카락 (아틀라스 살구색 점 얼룩 완전 제거 + 자연스러운 결) ──
  m.parts.push({
    name: 'head', P: HM.P, ST: HM.ST, I: HM.I,
    island: [.4, 0, 1, .6],
    paint: (p, n, st) => {
      const dn = Math.hypot(p[0] - B.neck[0], p[2] - B.neck[1]);
      if (p[1] < B.chin - .008 && dn < .125 && p[2] > -.33) return fleece(p, n);
      const u = .4 + pad + (.6 - 2 * pad) * st[0], v = pad + (.6 - 2 * pad) * st[1];
      let c = sampleRaw(atlas, u, v);
      const e = feOf(p[0], p[1]), L = lum(c);
      // 머리카락 영역(얼굴 외곽 충분히 바깥 · 뒤통수 · 옆머리)에 박힌 살구색/밝은 점 얼룩 제거
      const isHairZone = e > 1.18 || p[2] < -.248 || n[2] < .10 || p[1] > .965;
      if (isHairZone && L > 78) {
        const blotch = smooth(78, 120, L);
        c = mix(c, hairCol(p), blotch);
      }
      return c;
    },
    bone: 'head', B: [], keepWinding: true, weld: 'head',
  });

  // ── 3) 지은 몸통 부위 슬롯 ──
  let slot = 0;
  const SLOTS = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) SLOTS.push([c / 10, .6 + r * .4 / 5, (c + 1) / 10, .6 + (r + 1) * .4 / 5]);
  const isl = () => SLOTS[slot++];
  const big = (n = 2) => { const a = SLOTS[slot], b = SLOTS[slot + n - 1]; slot += n; return [a[0], a[1], b[2], b[3]]; };

  const zip = (p) => smooth(.0065, .0022, Math.abs(p[0] - B.neck[0])) * (p[2] > B.bodyZ ? 1 : 0);
  const zipShadow = (p) => smooth(.018, .006, Math.abs(p[0] - B.neck[0])) * (p[2] > B.bodyZ ? 1 : 0);
  const jacketPaint = (p, n) => {
    let col = fleece(p, n);
    // 지퍼 양옆 미세 음영 + 중앙 메탈 지퍼 라인
    col = col.map((v) => v * (1 - .14 * zipShadow(p)));
    return mix(col, [92, 92, 98], zip(p) * .92);
  };

  // 몸통 — 자연스러운 드롭숄더 어깨 경사 & 허리 실루엣
  const torsoW = (y) => {
    const t = clamp((B.shoulderY - y) / (B.shoulderY - B.hemY));
    return {
      a: .205 + .010 * Math.sin(t * Math.PI) - .008 * smooth(.7, 1, t),
      b: lerp(.118, .128, t) + .012 * Math.sin(t * Math.PI * .8),
      dz: .012 * Math.sin(t * Math.PI),
    };
  };
  m.sweep('torso', (s) => {
    const y = lerp(B.shoulderY + .055, B.hemY, s);
    const w = torsoW(y);
    const k = smooth(B.shoulderY + .055, B.shoulderY - .055, y);
    return {
      c: [B.neck[0], y, B.bodyZ + w.dz],
      u: [0, 0, 1], v: [1, 0, 0],
      a: lerp(.082, w.b, Math.pow(k, .55)),
      b: lerp(.088, w.a, Math.sin(k * Math.PI / 2)),
      e: lerp(2.0, 2.5, k),
      r: (th) => 1 + k * .014 * Math.sin(th * 9 + y * 22) * smooth(.45, .18, y),
    };
  }, {ns: 34, nt: 48, capStart: .02, capRings: 3, island: big(4), bone: 'body', paint: jacketPaint});

  m.sweep('collar', (s) => ({
    c: [B.neck[0], lerp(B.shoulderY + .005, B.chin - .02, s), B.neck[1] + .005],
    u: [0, 0, 1], v: [1, 0, 0],
    a: .085 - .008 * s, b: .088 - .01 * s, e: 2.2,
    r: (th) => 1 + .02 * Math.sin(th * 14),
  }), {ns: 6, nt: 36, capEnd: .01, capRings: 2, island: isl(), bone: 'body', paint: jacketPaint});

  // 지퍼 손잡이 — 메탈릭 대비 강화
  {
    const zc = [B.neck[0], B.chin - .044, B.neck[1] + .094];
    m.sweep('zipper', (s) => ({
      c: add(zc, [0, -.024 * s, .0025 * s]),
      u: [0, 0, 1], v: [1, 0, 0],
      a: .0028, b: .006 * (1 - .3 * s) + .0012, e: 3,
    }), {ns: 4, nt: 8, capStart: .002, capEnd: .002, capRings: 1, island: isl(), bone: 'body', paint: () => [175, 178, 185]});
  }

  // 밑단 시보리
  m.sweep('hem', (s) => {
    const w = torsoW(B.hemY);
    return {
      c: [B.neck[0], lerp(B.hemY + .03, B.hemY - .015, s), B.bodyZ + w.dz],
      u: [0, 0, 1], v: [1, 0, 0],
      a: w.b - .006 * s, b: w.a - .01 * s, e: 2.5,
      r: (th) => 1 + .006 * Math.sin(th * 120),
    };
  }, {ns: 4, nt: 96, island: isl(), bone: 'body', paint: (p, n) => fleece(p, n).map((v) => v * (.84 + .22 * Math.max(0, Math.sin(Math.atan2(p[0], p[2] - B.bodyZ) * 120))))});

  // ── 4) 팔 · 어깨 드롭숄더 연결 · 손 · 손가락 ──
  const arms = {};
  const skin = (p) => SKIN.map((v, k) => v * (.89 + .09 * n3(p, 140, 2)) * [.94, .86, .80][k]);
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    // 어깨 안쪽 깊숙이 시작 → 둥근 어깨선 → 팔꿈치 → 손목 (직각 분리 제거!)
    const shIn = [sd * .128, .615, B.bodyZ + .004];
    const shMid = [sd * .198, .585, B.bodyZ + .006];
    const el = [sd * B.el[0], B.el[1], B.bodyZ + .012];
    const wr = [sd * B.wr[0], B.wr[1], B.bodyZ + .046];
    const sh = [sd * B.sh[0], B.sh[1], B.bodyZ]; // 본 기준점 유지

    const path = (s) => (s < .5
      ? cubic(shIn, [sd * .175, .615, B.bodyZ + .005], shMid, el, s / .5)
      : mix(el, wr, (s - .5) / .5));

    m.sweep('sleeve' + side, (s) => {
      const c = path(s);
      // 어깨 상단(s=0..0.18)을 둥글고 자연스럽게 부풀려 몸통과 매끄럽게 접합
      const shCap = .012 * Math.sin(clamp(s / .22) * Math.PI);
      const r = lerp(.076, .064, s) + shCap + .005 * Math.sin(s * Math.PI * 2) * (1 - s);
      const d = norm(sub(path(Math.min(1, s + .02)), path(Math.max(0, s - .02))));
      let u = norm(cross(d, [1, 0, 0]));
      if (u[2] < 0) u = u.map((x) => -x);
      const v = cross(d, u);
      return {
        c, u, v, a: r * .94, b: r, e: 2,
        r: (th) => 1 + .03 * Math.sin(th * 3 + s * 30) * Math.exp(-(((s - .5) / .12) ** 2)),
      };
    }, {ns: 32, nt: 24, capStart: .042, capRings: 4, island: big(2), bone: 'sleeve' + side, paint: jacketPaint});

    const cuffD = norm(sub(wr, el));
    m.sweep('cuff' + side, (s) => ({
      c: add(wr, cuffD, lerp(-.01, .044, s)),
      u: [0, 0, 1], v: [1, 0, 0],
      a: .056 - .01 * s, b: .058 - .01 * s, e: 2,
      r: (th) => 1 + .02 * Math.max(0, Math.sin(th * 18)),
    }), {ns: 4, nt: 36, island: isl(), bone: 'cuff' + side, paint: (p, n) => fleece(p, n).map((v) => v * (.82 + .22 * Math.max(0, Math.sin(Math.atan2(p[0] - wr[0], p[2] - wr[2]) * 18))))});

    // 손 — 1.08배 비율 보정 + 손톱 셰이딩 버그 수정
    const hand0 = add(wr, cuffD, .038), hd = norm(add(cuffD, [0, -.45, .05], 1)), hx = [sd, 0, 0], hw = norm(cross(hd, hx));
    m.sweep('palm' + side, (s) => ({
      c: add(hand0, hd, s * .060),
      u: hx, v: hw,
      a: .015 - .002 * s, b: .031 + .004 * Math.sin(s * Math.PI), e: 2.4,
    }), {ns: 8, nt: 14, capStart: .009, capEnd: .006, capRings: 2, island: isl(), bone: 'palm' + side, paint: skin});

    const fingers = [];
    for (let fi = 0; fi < 5; fi++) {
      const thumb = fi === 0;
      const off = thumb ? .030 : lerp(.022, -.024, (fi - 1) / 3);
      const len = thumb ? .044 : [0, .056, .062, .058, .048][fi];
      const r0 = thumb ? .0092 : .0074;
      const base = thumb ? add(add(hand0, hd, .020), hw, .030) : add(add(hand0, hd, .056), hw, off);
      const dir = thumb ? norm(add(hd, hw, .6)) : norm(add(hd, hx, -.12 * sd));
      const curl = (s) => add(add(base, dir, s * len), hx, -sd * .006 * s * s);
      fingers.push({joints: [base, curl(.38), curl(.72)]});
      m.sweep(`finger${fi}${side}`, (s) => ({
        c: curl(s), u: hx, v: hw,
        a: r0 * (1 - .25 * s), b: r0 * (1.05 - .25 * s), e: 2,
      }), {
        ns: 6, nt: 8, capEnd: r0 * .8, capRings: 2, island: isl(), bone: `finger${fi}${side}`,
        // 버그 수정: st[0] 사용으로 손끝 손톱 톤 정상 표현
        paint: (p, n, st) => mix(skin(p), [232, 198, 192], smooth(.74, .95, st[0]) * .75),
      });
    }
    arms[side] = {sh, el, wr, hand0, fingers};
  }

  // ── 5) 와이드 청바지 · 골반 통합(기저귀 덩어리 제거) · 신발 ──
  const denim = (p, n, light = 0) => {
    const tw = Math.sin(p[1] * 1100 + p[0] * 1100 + p[2] * 360) * .5 + .5;
    const g = n3(p, 70, 3);
    // 재킷 밑단 아래 은은한 그림자(AO)
    const waistAO = 1 - .14 * smooth(.09, .16, p[1]);
    const base = mix(JEANS, JEANS_LT, clamp(light + .32 * (g - .5)));
    return base.map((v) => v * (.88 + .1 * tw + .09 * (n3(p, 9, 2) - .5)) * (.92 + .1 * smooth(-.6, .6, n[1])) * waistAO);
  };
  // hips: 바지통 상단 안쪽으로 매끄럽게 수렴(앞면 둥근 캡 노출 제거!)
  m.sweep('hips', (s) => ({
    c: [0, lerp(B.hemY + .05, B.crotchY + .048, s), B.bodyZ],
    u: [0, 0, 1], v: [1, 0, 0],
    a: lerp(.088, .068, s),
    b: lerp(.158, .132, s),
    e: 2.2,
  }), {ns: 8, nt: 36, capEnd: .010, capRings: 2, island: isl(), bone: 'hips', paint: (p, n) => denim(p, n, .16)});

  const legs = {};
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    const top = [sd * B.legX, B.crotchY + .085, B.bodyZ];
    const ank = [sd * (B.legX + .008), B.floor + .042, B.bodyZ + .01];
    const knee = mix(top, ank, .5);
    const toe = [sd * (B.legX + .01), B.floor + .03, B.bodyZ + .132];
    const heel = [sd * (B.legX + .008), B.floor + .035, B.bodyZ - .07];
    legs[side] = {root: [sd * B.legX, B.crotchY + .06, B.bodyZ], knee, ank: [ank[0], B.floor + .06, ank[2]], toe: mix(heel, toe, .7)};

    // 와이드 청바지 — 상단이 골반에 자연스럽게 맞물리고 무릎·발목 주름과 데님 워싱 강화
    m.sweep('leg' + side, (s) => {
      const c = mix(top, ank, s);
      // 최상단(s < 0.16)에서 안쪽으로 살짝 모여 가랑이 틈 없이 이어짐
      c[0] -= sd * .010 * smooth(.18, 0, s);
      const topFlare = .008 * smooth(.18, 0, s);
      const r = B.legR + topFlare + .005 * Math.sin(s * Math.PI) + .007 * smooth(.84, 1, s);
      return {
        c, u: [0, 0, 1], v: [1, 0, 0],
        a: r * .94, b: r, e: 2.15,
        r: (th) => 1 + .028 * Math.sin(th * 4 + s * 38) * (Math.exp(-(((s - .5) / .08) ** 2)) + smooth(.82, .97, s)) + .01 * Math.sin(th * 7 + s * 13),
      };
    }, {
      ns: 40, nt: 26, capStart: .028, capRings: 2, island: big(3), bone: 'leg' + side,
      paint: (p, n) => {
        const thighFade = Math.exp(-(((p[1] - (B.floor + .62)) / .14) ** 2)) * smooth(.1, .7, n[2]);
        const kneeFade = Math.exp(-(((p[1] - (B.floor + .46)) / .09) ** 2)) * smooth(0, .55, n[2]);
        const sideSeam = smooth(.022, .005, Math.abs(Math.abs(p[0]) - (B.legX + B.legR * .97)));
        const hemStitch = smooth(.008, .002, Math.abs(p[1] - (B.floor + .055)));
        let col = denim(p, n, .12 + .28 * thighFade + .42 * kneeFade);
        col = mix(col, JEANS.map((v) => v * .76), sideSeam * .65);
        col = mix(col, [178, 165, 138], hemStitch * .45);
        return col;
      },
    });

    m.sweep('shoe' + side, (s) => {
      const c = mix(heel, toe, s);
      const w = .046 * Math.sin(Math.PI * (.08 + .84 * s)) ** .5 + .006;
      return {c: add(c, [0, -.008 * s * s, 0]), u: [0, 1, 0], v: [1, 0, 0], a: .034 * (1 - .35 * s) + .004, b: w, e: 2.6};
    }, {
      ns: 14, nt: 16, capStart: .02, capEnd: .025, capRings: 3, island: isl(), bone: 'shoe' + side,
      paint: (p) => {
        const sole = smooth(B.floor + .018, B.floor + .008, p[1]);
        const lace = smooth(.82, .95, Math.sin(p[2] * 900)) * smooth(B.floor + .045, B.floor + .06, p[1]) * smooth(.025, .01, Math.abs(Math.abs(p[0]) - B.legX - .01));
        return mix(mix([58, 58, 64], [212, 209, 202], sole), [196, 196, 202], lace).map((v) => v * (.92 + .1 * n3(p, 80, 2)));
      },
    });
  }

  // ── 6) 크로스백 + 어깨를 넘어 등 뒤까지 이어지는 완전 폐루프 스트랩 ──
  const frontZ = (x, y) => {
    const w = torsoW(y), ex = clamp((x - B.neck[0]) / (w.a + .01), -.99, .99);
    return B.bodyZ + w.dz + (w.b + .011) * (1 - Math.abs(ex) ** 2.5) ** (1 / 2.5);
  };
  const backZ = (x, y) => {
    const w = torsoW(y), ex = clamp((x - B.neck[0]) / (w.a + .01), -.99, .99);
    return B.bodyZ + w.dz - (w.b + .011) * (1 - Math.abs(ex) ** 2.5) ** (1 / 2.5);
  };
  const bagC = [-.215, .22, B.bodyZ + .085];
  const strapPt = (s) => {
    // 0.00 ~ 0.44: 가방 앞쪽 → 앞가슴 사선 → 왼쪽 쇄골
    // 0.44 ~ 0.56: 왼쪽 어깨 위를 둥글게 넘음
    // 0.56 ~ 1.00: 등 뒤 사선 → 가방 뒤쪽
    if (s <= .44) {
      const t = s / .44;
      const x = lerp(-.20, .112, t), y = lerp(.29, B.shoulderY - .005, t);
      return [x, y, frontZ(x, y) + .005];
    }
    if (s <= .56) {
      const t = (s - .44) / .12;
      const x = .112 + .005 * Math.sin(t * Math.PI);
      const y = B.shoulderY - .005 + .032 * Math.sin(t * Math.PI);
      const zF = frontZ(.112, B.shoulderY - .005) + .005;
      const zB = backZ(.112, B.shoulderY - .005) - .005;
      return [x, y, lerp(zF, zB, t)];
    }
    const t = (s - .56) / .44;
    const x = lerp(.112, -.212, t), y = lerp(B.shoulderY - .005, .28, t);
    return [x, y, backZ(x, y) - .005];
  };
  m.sweep('strap', (s) => {
    const c = strapPt(s);
    const d = norm(sub(strapPt(Math.min(1, s + .01)), strapPt(Math.max(0, s - .01))));
    // 법선 방향(몸통 바깥쪽)을 얇게, 띠 폭을 넓게
    const out = norm([c[0] - B.neck[0], s > .42 && s < .58 ? .6 : 0, c[2] - B.bodyZ]);
    let v = norm(cross(d, out));
    if (Math.hypot(...v) < .1) v = [1, 0, 0];
    const u = norm(cross(v, d));
    return {c, u, v, a: .0055, b: .0155, e: 3};
  }, {
    ns: 56, nt: 8, island: isl(), bone: 'strap',
    paint: (p) => {
      const d = Math.sin(p[0] * 300) * Math.sin(p[1] * 300);
      return mix(BAG, [32, 32, 36], smooth(.62, .92, d));
    },
  });

  // 가방 본체 + 상단 연결 고리
  const bagPaint = (p) => {
    const q = [(p[0] - bagC[0]) * 46, (p[1] - bagC[1]) * 46];
    const quilt = Math.abs(Math.sin(q[0] + q[1]) * Math.sin(q[0] - q[1]));
    const dots = smooth(.75, .9, Math.sin(p[0] * 380) * Math.sin(p[1] * 380 + 1));
    return mix(BAG.map((v) => v * (.82 + .22 * quilt)), [26, 26, 28], dots);
  };
  m.sweep('bag', (s) => ({
    c: add(bagC, [0, lerp(.075, -.075, s), 0]),
    u: [0, 0, 1], v: [1, 0, 0],
    a: .035 * Math.sin(Math.PI * (.1 + .8 * s)) ** .5 + .006,
    b: .07 * Math.sin(Math.PI * (.08 + .84 * s)) ** .4 + .008,
    e: 2.4,
    r: (th) => 1 + .03 * Math.abs(Math.sin(th * 4 + s * 12)),
  }), {ns: 14, nt: 24, capStart: .01, capEnd: .01, capRings: 2, island: isl(), bone: 'bag', paint: bagPaint});

  m.sweep('bagRing', (s) => ({
    c: add(bagC, [.008, .078 + .018 * s, 0]),
    u: [0, 0, 1], v: [1, 0, 0],
    a: .012, b: .015, e: 2.4,
  }), {ns: 4, nt: 10, capStart: .004, capEnd: .004, capRings: 1, island: isl(), bone: 'bag', paint: () => [165, 160, 148]});

  console.log('slots used', slot, '/', SLOTS.length);

  // ── 7) 게임 좌표 · 126개 본 스켈레톤 ──
  const G = (p) => [p[1], -p[2], -p[0]], H = (g) => [-g[2], g[0], -g[1]];
  for (const part of m.parts) {
    part.H = part.P;
    part.P = part.P.map(G);
    const f = part.paint;
    part.paint = (p, n, st) => f(H(p), H(n), st);
  }
  const fins = {L: {root: G(arms.R.sh), tip: G(arms.R.el)}, R: {root: G(arms.L.sh), tip: G(arms.L.el)}};
  const legsG = {L: {root: G(legs.R.root)}, R: {root: G(legs.L.root)}, parent: 3};
  const E = skeleton(arms, legs, [bagC[0], bagC[1] + .08, bagC[2]]).map((e) => ({...e, at: G(e.at)}));
  return {m, fins, legs: legsG, E};
}

const debug = process.argv.includes('--debug');
const {m, fins, legs, E} = await build();
const NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip', 'leg_L', 'leg_R', ...E.map((e) => e.name)];
const BI = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const FIN = {R: 'fin_L', L: 'fin_R'}, LEG = {R: 'leg_L', L: 'leg_R'};
const W2 = (a, b, t) => [[BI[a], 1 - t + 1e-4], [BI[b], t + 1e-4]];

const {glb, tris} = await bake('yujin', m, {
  fins, legs, extraBones: E, atlas: ATLAS, roughness: .60,
  compress: {textureSize: 2048, uvBits: 14},
  source: 'design/aqua3d-review/yujin/yujin-build4.mjs (4차 업그레이드 — 얼굴 경계 정합 · 머리 얼룩 제거 · 드롭숄더 · 와이드팬츠 통합 · 폐루프 크로스백 · 관절 126)',
  weight: (part, g, st, k) => {
    const s = st[0], h = part.H?.[k];
    const sideOf = (nm) => nm.slice(-1);
    if (part.name.startsWith('sleeve')) {
      const sd = sideOf(part.name);
      const w = smooth(.42, .58, s);
      // 어깨 안쪽(s=0..0.28)은 몸통 척추와 부드럽게 블렌딩해 팔을 들어올려도 꺾임/분리 방지
      const sw = smooth(.05, .28, s);
      return [
        [BI[FIN[sd] + '_tip'], w * sw + 1e-4],
        [BI[FIN[sd]], (1 - w) * sw + 1e-4],
        ...spineWeight(g[0]).slice(0, 2).map(([b, x]) => [b, x * (1 - sw) + 1e-5]),
      ];
    }
    if (part.name.startsWith('cuff')) { const sd = sideOf(part.name); return W2(FIN[sd] + '_tip', 'wrist_' + sd, smooth(.2, .9, s)); }
    if (part.name.startsWith('palm')) { const sd = sideOf(part.name); return W2('wrist_' + sd, 'palm_' + sd, smooth(.1, .6, s)); }
    if (part.name.startsWith('finger')) {
      const fi = +part.name[6], sd = sideOf(part.name);
      const j = s < .38 ? 0 : s < .72 ? 1 : 2;
      const t = j === 0 ? smooth(.28, .42, s) : j === 1 ? smooth(.62, .76, s) : 1;
      return j === 2 ? [[BI[`f${fi}_2_${sd}`], 1]] : W2(`f${fi}_${j}_${sd}`, `f${fi}_${j + 1}_${sd}`, t);
    }
    if (part.name.startsWith('leg')) {
      const sd = sideOf(part.name), top = smooth(0, .14, s);
      if (s < .42) return [[BI[LEG[sd]], top + 1e-4], [3, 1 - top + 1e-4]];
      return s < .58 ? W2(LEG[sd], 'knee_' + sd, smooth(.42, .58, s)) : s < .92 ? [[BI['knee_' + sd], 1]] : W2('knee_' + sd, 'ankle_' + sd, smooth(.92, 1, s));
    }
    if (part.name.startsWith('shoe')) { const sd = sideOf(part.name); return W2('ankle_' + sd, 'toe_' + sd, smooth(.55, .8, s)); }
    if (part.name === 'bag' || part.name === 'bagRing') return [[BI.bag, 1]];
    if (part.name === 'strap') {
      // 가방에 가까운 양 끝(s < 0.16 또는 s > 0.84)만 bag 본과 부드럽게 블렌딩, 어깨/몸통 구간은 spine_1 고정
      const nearBag = Math.max(smooth(.20, 0, s), smooth(.80, 1, s));
      return W2('spine_1', 'bag', nearBag * .7);
    }
    if ((part.name === 'head' || part.name === 'face') && h) {
      const neckW = smooth(.725, .755, h[1]);
      if (h[2] < -.27 && h[1] < HAIR_TOP + .01 && h[1] > HAIR_BOT - .05) {
        const fx = clamp((h[0] - B.neck[0] + HAIR_X) / (2 * HAIR_X)) * (HAIR_N - 1);
        const a = Math.min(HAIR_N - 2, Math.floor(fx)), ta = fx - a;
        const fy = clamp((HAIR_TOP - h[1]) / (HAIR_TOP - HAIR_BOT)) * HAIR_SEG;
        const kk = Math.min(HAIR_SEG - 1, Math.floor(fy)), k2 = Math.min(HAIR_SEG - 1, kk + 1), tk = fy - kk, root = smooth(0, .6, fy);
        const w = [
          [BI[`hair_${a}_${kk}`], (1 - ta) * (1 - tk) * root],
          [BI[`hair_${a + 1}_${kk}`], ta * (1 - tk) * root],
          [BI[`hair_${a}_${k2}`], (1 - ta) * tk * root],
          [BI[`hair_${a + 1}_${k2}`], ta * tk * root],
        ];
        return root < .999 ? [[BI.head, 1 - root + 1e-4], ...w.slice(0, 3)] : w;
      }
      return [[BI.head, neckW + 1e-4], [0, 1 - neckW + 1e-4]];
    }
    return spineWeight(g[0]);
  },
});

console.log('bones', NAMES.length, 'tris', tris, 'bytes', glb.length);
if (tris > 45000 || glb.length > 3000000) throw Error(`yujin ${tris} tris ${glb.length} bytes`);
if (debug) await writeFile(new URL('source/debug-yujin.glb', HERE), glb);
else for (const key of ['yujin', 'juv_yujin', 'fry_yujin']) await writeFile(`public/aqua/models/fish/${key}.glb`, glb);
console.log('Saved yujin / juv_yujin / fry_yujin GLB successfully.');
