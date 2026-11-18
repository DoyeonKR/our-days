// 범고래 새끼 · 어린 개체 모델(2026-11-18) [사용자: 업그레이드 후보 "범고래 새끼·어린 개체 전용 모델 … 모두 진행해"]
// 왜: fry_orca · juv_orca 는 다 큰 범고래와 같은 파일이었다(scene.ts 가 몸통만 1.2 · 1.1 배 부풀려 흉내 냈다). 실제 새끼 범고래는
//   몸이 짧고 둥글며 머리 · 앞지느러미가 몸에 비해 크고, 등지느러미가 작고 휘어 있으며, 흰 무늬가 연한 살구빛이다(design/AQUARIUM-ART.md 의 fry_orca · juv_orca 줄).
// 어떻게: 원본 Tripo 메시(orca-color/orca-colored.glb)는 레포에 없어 배포된 다 큰 모델(public/aqua/models/fish/orca.glb)을 되풀어
//   같은 정점 · UV · 뼈 가중치 위에서 모양만 바꾼다 — ① 등지느러미를 몸 윗선 쪽으로 눌러 낮춘다 ② 몸 위아래 · 좌우를 부풀리되 머리 쪽을 더(몸이 짧고 머리가 커 보인다,
//   꼬리 지느러미는 옆으로 안 넓힌다) ③ 앞지느러미를 뿌리 둘레로 키운다. 뼈 자리도 같은 식으로 옮겨 역바인드를 다시 만든다(bindpose.test).
//   새끼는 텍스처의 흰 곳을 살구빛으로. 길이 2 · 뼈 10개 · 삼각형 수는 다 큰 것과 같다.
// 실행: node design/aqua3d-review/orca-young-build.mjs   (레포 뿌리에서) — public/aqua/models/fish/fry_orca.glb · juv_orca.glb 를 쓴다
import * as T from 'three';
import sharp from 'sharp';
import {readFile, writeFile} from 'node:fs/promises';
import {parseGLB, expandGLB, compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (lo, hi, x) => { const t = clamp((x - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
/** 단계별 비율 — 몸 굵기(base) · 머리 쪽 더 굵기(head) · 등지느러미 높이(fin) · 앞지느러미 크기(flipper) · 흰 곳 살구빛(peach) */
export const YOUNG = {
  fry_orca: {base: 1.22, head: 0.2, fin: 0.36, flipper: 1.18, peach: 0.45},
  juv_orca: {base: 1.08, head: 0.08, fin: 0.68, flipper: 1.07, peach: 0},
};
// 다 큰 모델(길이 2)에서 잰 값 — 몸 가운데 높이 · 등지느러미 구간의 몸 윗선 · 등지느러미 x 구간(zz 측정: 윗선 .13 ~ .15, 지느러미 x -.3 ~ .2 · 꼭대기 .40)
const AXIS_Y = -0.06, BACK_Y = 0.14, FIN_X0 = -0.36, FIN_X1 = 0.24;

const {json, bin} = parseGLB(await expandGLB(await readFile('public/aqua/models/fish/orca.glb')));
const f32 = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return new Float32Array(bin.buffer.slice(bin.byteOffset + (v.byteOffset ?? 0), bin.byteOffset + (v.byteOffset ?? 0) + v.byteLength)); };
const u16 = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return new Uint16Array(bin.buffer.slice(bin.byteOffset + (v.byteOffset ?? 0), bin.byteOffset + (v.byteOffset ?? 0) + v.byteLength)); };
const prim = json.meshes[0].primitives[0];
const P0 = f32(prim.attributes.POSITION), UV = f32(prim.attributes.TEXCOORD_0), J = u16(prim.attributes.JOINTS_0), W = f32(prim.attributes.WEIGHTS_0), IDX = u16(prim.indices);
const img = json.images[0], iv = json.bufferViews[img.bufferView];
const tex = Buffer.from(bin.buffer.slice(bin.byteOffset + (iv.byteOffset ?? 0), bin.byteOffset + (iv.byteOffset ?? 0) + iv.byteLength));
const joints = json.skins[0].joints.map((i) => json.nodes[i]);
const NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'];
if (joints.map((n) => n.name).join() !== NAMES.join()) throw new Error('bone order ' + joints.map((n) => n.name));
// 뼈 world 자리(다 큰 모델) — 부모 사슬을 따라 더한다(회전 없음)
const parent = new Map(); json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
const worldOf = (ni) => { const out = new T.Vector3(); for (let k = ni; k !== undefined; k = parent.get(k)) { const t = json.nodes[k].translation ?? [0, 0, 0]; out.add(new T.Vector3(...t)); } return out; };
const boneWorld = json.skins[0].joints.map(worldOf);

export function deform(x, y, z, s, flipperW = 0, root = null) {
  // ① 등지느러미 — 몸 윗선 위쪽을 낮춘다(지느러미 구간에서만, 가장자리는 부드럽게)
  const inFin = smooth(FIN_X0, FIN_X0 + 0.1, x) * (1 - smooth(FIN_X1 - 0.1, FIN_X1, x));
  if (y > BACK_Y && inFin > 0) y = BACK_Y + (y - BACK_Y) * (1 - inFin * (1 - s.fin));
  // ③ 앞지느러미 — 뿌리 둘레로 키운다(부풀리기 전, 원래 자리 기준)
  if (flipperW > 0 && root) { const k = 1 + (s.flipper - 1) * flipperW; x = root.x + (x - root.x) * k; y = root.y + (y - root.y) * k; z = root.z + (z - root.z) * k; }
  // ② 몸 부풀리기 — 머리 쪽을 더, 꼬리 지느러미는 옆으로 안 넓힌다
  const k = s.base * (1 + s.head * smooth(0.15, 0.95, x)), kz = 1 + (k - 1) * smooth(-0.82, -0.62, x);
  return [x, AXIS_Y + (y - AXIS_Y) * k, z * kz];
}

for (const [key, s] of Object.entries(YOUNG)) {
  const n = P0.length / 3, P = new Float32Array(P0.length);
  // 앞지느러미 몫 — fin_* 뼈(6..9)에 실린 가중치
  const finW = (i) => { let w = 0; for (let k = 0; k < 4; k++) if (J[i * 4 + k] >= 6) w += W[i * 4 + k]; return w; };
  const rootL = boneWorld[6], rootR = boneWorld[8];
  for (let i = 0; i < n; i++) {
    const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], fw = finW(i);
    P.set(deform(x, y, z, s, fw, z >= 0 ? rootL : rootR), i * 3);
  }
  // 길이 2 · 가운데로 다시 맞춘다
  let x0 = Infinity, x1 = -Infinity; for (let i = 0; i < n; i++) { x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]); }
  const S = 2 / (x1 - x0), mx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) { P[i * 3] = (P[i * 3] - mx) * S; P[i * 3 + 1] *= S; P[i * 3 + 2] *= S; }
  // 뼈 — 같은 식으로 옮긴다(지느러미 끝은 지느러미 키우기도). 회전은 없어 자리만
  const bw = boneWorld.map((p, b) => { const fw = b === 7 || b === 9 ? 1 : 0, r = b === 7 ? rootL : rootR; const [x, y, z] = deform(p.x, p.y, p.z, s, fw, r); return new T.Vector3((x - mx) * S, y * S, z * S); });
  const bones = NAMES.map((name) => { const b = new T.Bone(); b.name = name; return b; });
  const par = [-1, 0, 1, 2, 3, 4, 1, 6, 1, 8]; // 다 큰 모델과 같은 사슬(앞지느러미는 spine_1 에 붙는다)
  for (let b = 0; b < 10; b++) {
    const pb = par[b], local = pb < 0 ? bw[b] : bw[b].clone().sub(bw[pb]);
    bones[b].position.copy(local); if (pb >= 0) bones[pb].add(bones[b]);
  }
  bones[0].updateMatrixWorld(true);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3));
  g.setAttribute('uv', new T.BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new T.BufferAttribute(W, 4));
  g.setIndex(new T.Uint16BufferAttribute(IDX, 1));
  g.computeVertexNormals();
  // 텍스처 — 새끼는 흰 곳(밝고 색이 거의 없는 칸)을 살구빛으로
  const {data, info} = await sharp(tex).removeAlpha().raw().toBuffer({resolveWithObject: true});
  if (s.peach > 0) for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3], gg = data[i * 3 + 1], b = data[i * 3 + 2], lum = (r + gg + b) / 3, chroma = Math.max(r, gg, b) - Math.min(r, gg, b);
    const wgt = smooth(150, 215, lum) * (1 - smooth(18, 40, chroma)) * s.peach;
    const peach = [250, 205, 170];
    for (let c = 0; c < 3; c++) data[i * 3 + c] = Math.round(data[i * 3 + c] * (1 - wgt) + peach[c] * wgt * (lum / 235));
  }
  const png = await sharp(data, {raw: {width: info.width, height: info.height, channels: 3}}).png().toBuffer();
  const bytes = await compressGLB(packAsset(key, [{name: key, geometry: g}], png, bones));
  if (bytes.length > 300000) throw new Error('size ' + bytes.length);
  await writeFile(`public/aqua/models/fish/${key}.glb`, bytes);
  if (s.peach > 0) await writeFile(`design/aqua3d-review/orca-young/${key}-texture.png`, png);
  console.log(key, IDX.length / 3, 'tris', bytes.length, 'bytes', 'fin root', bw[6].toArray().map((v) => v.toFixed(2)).join(','));
}
