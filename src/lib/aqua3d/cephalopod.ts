/* 두족류 팔(2026-11-13 → 2026-11-18 v3 입체 모델) [사용자: "두족류 움직임이 아직 개선되지 않았어 … 문어 류는 움직임이 10점중에 2점이야 실제 움직임을 참고해서 고쳐"]
 * 실제 문어: 팔 여덟이 저마다 따로 움직인다(뇌의 3분의 2 가 팔에 있다). 굽힘은 팔 뿌리에서 끝으로 물결처럼 지나가고, 끝은 늘 말렸다 펴진다.
 * 기어갈 땐 팔마다 들었다 짚으며 뻗었다 당기고, 물을 뿜을 땐 팔을 한데 모아 외투막 반대쪽(+X)으로 늘어뜨리고, 미끄러짐 끝엔 팔 사이 막을 우산처럼 편다.
 * 2026-11-13 판은 옆모습 그림을 세운 판 모델이라 '그림 uv = 정점 자리'를 써서 팔 뿌리 둘레로 옆면(XY) 안에서만 돌렸다.
 * 2026-11-18 v3 모델(design/aqua3d-review/ceph-v3-build.mjs)은 진짜 입체라 그 가정이 깨진다 — 팔은 사방(문어 · 위에서 별)이나 앞(오징어)으로 뻗는다.
 * 그래서 팔 번호 · 뿌리→끝을 uv 의 '팔 띠'(CEPH_UV)에서 읽고, 팔마다 뿌리 자리 · 방향을 정점에서 한 번 재서(정점 속성 셋), 셰이더가 팔마다
 *   ① 옆으로 흔들기(팔 방향 · 옆 축에 수직인 축) ② 들기 · 끝 말기(옆 축) ③ 모으기 · 펴기(+X 쪽으로) 를 뿌리를 축으로 돌린다. 법선도 같은 회전.
 * 키마다 다른 상수가 셰이더에 없다(전부 정점 속성) — 재질이 key 마다 따로여도 프로그램 하나를 같이 쓴다.
 * 이 파일은 three 없이 순수 계산만 한다 — 셰이더(glb.ts)와 같은 식이고, 시험이 그대로 부른다. */

/** v3 모델의 uv 배치 — 위 body 몫은 몸 둘레로 굽은 그림, band0 부터 팔마다 띠 하나(bandH).
 *  띠 안: u = 뿌리(u0) → 끝(u1), 아래 webFrac 몫 = 팔 둘레(margin 은 띠 경계에서 비운 몫), 그 위 = 팔 사이 막. 압축기의 uv 12비트(1/4095)에서도 띠가 갈린다 */
export const CEPH_UV = { body: 0.4, band0: 0.45, bandH: 0.055, u0: 0.01, u1: 0.99, margin: 0.06, webFrac: 0.8, arms: 10 } as const;
/** v3 모델 표시(메시 노드 extras.aquaGeometry → three 의 userData) — 옛 판 모델은 uv 가 그림 전체라 띠로 읽으면 엉뚱한 팔이 된다 */
export const CEPH_V3 = "cephalopod-v3";

/** 문어형(팔이 사방으로 퍼진다) — 오징어형은 팔이 앞으로 모여 있어 물결을 작게 */
export const octopusLike = (key: string) => /octopus|kraken/.test(key);

/** 팔 박자(rad/s) · 물결이 팔을 타고 가는 빠르기(뿌리→끝 한 번에 늦는 각) */
export const ARM = {
  /** 쉬는 동안 팔 물결 박자 · 기어갈 때 박자 */ idleRate: 0.95, walkRate: 2.6,
  /** 뿌리에서 끝까지 늦는 위상 — 1 이 넘으면 팔 하나에 물결이 반 번 넘게 보인다 */ lag: 2.6,
  /** 끝의 옆 굽힘(rad) — 쉼 · 기어감 */ idle: 0.26, walk: 0.3,
  /** 끝이 말렸다 펴지는 몫(rad, 끝 쪽 세제곱) · 박자 배율 */ curl: 0.32, curlRate: 0.55,
  /** 기어갈 때 팔을 들었다 짚는 몫(rad) */ lift: 0.22,
  /** 기어갈 때 팔이 늘었다 줄었다(뻗어 짚고 당기기) */ reach: 0.12,
  /** 물 뿜기 때 팔을 모으는 몫 · 미끄러짐 끝에 펴는 몫 · 펼 때 드는 몫(우산) */ bundle: 0.85, flare: 0.45, flareLift: 0.3,
} as const;

/** 외투막 숨(0~1) — 천천히 부풀었다(들숨) 빨리 오므린다(날숨). 주기 BREATH_S 초 */
export const BREATH_S = 2.6;
export function breathOf(t: number, ph = 0) { const x = ((t / BREATH_S + ph / 6.283) % 1 + 1) % 1; return x < 0.7 ? Math.sin((x / 0.7) * Math.PI * 0.5) ** 2 : Math.cos(((x - 0.7) / 0.3) * Math.PI * 0.5) ** 2; }
const unit = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (a: number, b: number, x: number) => { const t = unit((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 팔마다 다른 위상(팔 번호에서 — 황금각 간격 + 흩기). 이웃 팔이 같이 움직이지 않게 */
export const phaseOf = (arm: number) => arm * 2.39996 + Math.sin(arm * 7.0) * 0.9;
/** 팔마다 다른 빠르기(0.65 ~ 1.35 배, 위상에서) — 같은 빠르기에 위상만 다르면 팔끼리 늘 같은 박자로 움직여 보인다(실제 팔은 저마다 따로 논다) */
export const armRate = (ph: number) => 1 + 0.35 * Math.sin(ph * 1.3 + 1.1);

export type CephArms = {
  /** 정점마다 [팔 몫 w, 뿌리→끝 rr, 팔 위상 ph, 팔 번호] */ attr: Float32Array;
  /** 정점마다 그 팔의 뿌리 자리(원본 정점 단위) */ root: Float32Array;
  /** 정점마다 그 팔의 쉬는 방향(뿌리 → 팔 가운데, 단위 벡터) */ dir: Float32Array;
  /** 찾은 팔 수 */ arms: number;
};

/** uv 의 팔 띠에서 정점마다 팔 자료를 만든다. P: 원본 정점 x y z · uv: 그 정점의 uv. v3 모델이 아니면(팔 띠가 없으면) null */
export function cephArmData(P: ArrayLike<number>, uv: ArrayLike<number>, n: number): CephArms | null {
  const attr = new Float32Array(n * 4), root = new Float32Array(n * 3), dir = new Float32Array(n * 3);
  const armOf = new Int8Array(n).fill(-1), web = new Uint8Array(n);
  const R = Array.from({ length: CEPH_UV.arms }, () => [0, 0, 0, 0]), Mid = Array.from({ length: CEPH_UV.arms }, () => [0, 0, 0, 0]);
  for (let i = 0; i < n; i++) {
    const v = uv[i * 2 + 1];
    if (v < CEPH_UV.band0) continue;
    const k = (v - CEPH_UV.band0) / CEPH_UV.bandH, a = Math.min(CEPH_UV.arms - 1, Math.floor(k)), f = k - a, rr = unit((uv[i * 2] - CEPH_UV.u0) / (CEPH_UV.u1 - CEPH_UV.u0));
    armOf[i] = a; web[i] = f > CEPH_UV.webFrac ? 1 : 0;
    attr[i * 4 + 1] = rr;
    if (web[i]) continue;
    // 뿌리 = 팔 둘레의 첫 고리(rr 0), 방향 = 팔의 앞쪽 반(rr .2 ~ .45)의 무게중심 쪽
    const acc = rr < 0.02 ? R[a] : rr > 0.2 && rr < 0.45 ? Mid[a] : null;
    if (acc) { acc[0] += P[i * 3]; acc[1] += P[i * 3 + 1]; acc[2] += P[i * 3 + 2]; acc[3]++; }
  }
  let arms = 0;
  const roots: number[][] = [], dirs: number[][] = [];
  for (let a = 0; a < CEPH_UV.arms; a++) {
    if (!R[a][3] || !Mid[a][3]) { roots.push([0, 0, 0]); dirs.push([1, 0, 0]); continue; }
    arms++;
    const r = [R[a][0] / R[a][3], R[a][1] / R[a][3], R[a][2] / R[a][3]], m = [Mid[a][0] / Mid[a][3] - r[0], Mid[a][1] / Mid[a][3] - r[1], Mid[a][2] / Mid[a][3] - r[2]], l = Math.hypot(m[0], m[1], m[2]) || 1;
    roots.push(r); dirs.push([m[0] / l, m[1] / l, m[2] / l]);
  }
  if (!arms) return null;
  for (let i = 0; i < n; i++) {
    const a = armOf[i];
    if (a < 0 || !R[a][3]) continue;
    // 뿌리는 몸에 박혀 있다 — 뿌리 8% 는 안 움직이게 서서히. 막은 팔보다 조금 덜(팔 사이에서 찢어지지 않게)
    attr[i * 4] = smooth(0, 0.08, attr[i * 4 + 1]) * (web[i] ? 0.85 : 1);
    attr[i * 4 + 2] = phaseOf(a); attr[i * 4 + 3] = a;
    root.set(roots[a], i * 3); dir.set(dirs[a], i * 3);
  }
  return { attr, root, dir, arms };
}

/** 그 순간의 팔 자세 값 — 화면(glb)이 프레임마다 뼈 텍스처의 남는 칸에 쓴다 */
export type ArmPose = { t: number; walk: number; stream: number; flare: number; gain: number };

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3, fb: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-4 ? [a[0] / l, a[1] / l, a[2] / l] : fb; };
/** 로드리게스 — v 를 단위 축 k 둘레로 a 만큼 */
const rot = (v: V3, k: V3, a: number): V3 => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]; };

/** 한 팔 정점의 세 각(옆 흔들기 · 들기/말기 · 모으기/펴기)과 늘이기 — 셰이더의 aquaArmFrame 과 같은 식 */
export function cephArmAngles(w: number, rr: number, ph: number, u: V3, p: ArmPose) {
  const rate = (ARM.idleRate + (ARM.walkRate - ARM.idleRate) * p.walk) * armRate(ph), calm = 1 - 0.85 * p.stream;
  const bend = (ARM.idle + (ARM.walk - ARM.idle) * p.walk) * calm * p.gain;
  // ① 옆 흔들기 — 뿌리에서 끝으로 지나가는 물결(끝일수록 크게)
  const sway = bend * rr ** 1.4 * Math.sin(p.t * rate - rr * ARM.lag + ph);
  // ② 들기 · 끝 말기(− 가 위) — 끝 세제곱 말기 · 기어갈 때 들었다 짚기 · 펼 때 우산처럼 들기.
  //   말기 · 우산은 옆으로 뻗은 팔(문어형)만 — 앞으로 모인 오징어 팔은 옆 축이 다 같아 여덟 팔이 한꺼번에 위로 들렸다(q 가 0 쪽)
  const q = 1 - smooth(0.75, 0.95, u[0]);
  const lift = (-ARM.curl * calm * p.gain * rr ** 3 * (0.6 + 0.4 * Math.sin(p.t * rate * ARM.curlRate + ph * 1.7)) - ARM.flareLift * p.flare * rr) * (0.2 + 0.8 * q)
    + ARM.lift * p.walk * calm * p.gain * rr * Math.sin(p.t * rate * 0.8 + ph + 1.3);
  // ③ 모으기(+X 로) · 펴기(반대로) — 각을 묶는다(외투막 쪽 팔까지 다 돌리면 외투막을 뚫고 지나간다). 뒤로 뻗은 팔은 돌리지 않고 당긴다
  const A = Math.acos(Math.max(-1, Math.min(1, u[0]))), side = 1 - smooth(1.3, 1.9, A);
  const gather = ARM.bundle * p.stream * Math.min(0.75, A * 0.6) * side * smooth(0, 0.35, rr) - ARM.flare * p.flare * Math.min(0.6, Math.max(0.3, A)) * rr;
  const stretch = (1 + w * ARM.reach * p.walk * calm * Math.sin(p.t * rate * 0.8 + ph + 1.3) * smooth(0, 0.5, rr)) * (1 - 0.4 * p.stream * (1 - side) * w * smooth(0, 0.4, rr));
  return { sway: sway * w, lift: lift * w, gather: gather * w, stretch };
}

/** 팔 정점의 축 셋: s = 옆(위 × 팔), n = 팔 × 옆(흔드는 축), k = 팔 × X(모으는 축) */
function axes(u: V3): { s: V3; n: V3; k: V3 } {
  const s = norm(cross([0, 1, 0], u), [0, 0, 1]), n = norm(cross(u, s), [0, 1, 0]), k = norm(cross(u, [1, 0, 0]), s);
  return { s, n, k };
}

/** 한 정점의 팔 변형(원본 정점 단위). out 에 [x, y, z]. 셰이더(cephGlsl)와 같은 식 */
export function cephArmDisplace(x: number, y: number, z: number, d: CephArms, i: number, p: ArmPose, out: number[] | Float32Array) {
  const w = d.attr[i * 4];
  out[0] = x; out[1] = y; out[2] = z;
  if (w <= 0) return out;
  const R: V3 = [d.root[i * 3], d.root[i * 3 + 1], d.root[i * 3 + 2]], u: V3 = [d.dir[i * 3], d.dir[i * 3 + 1], d.dir[i * 3 + 2]];
  const a = cephArmAngles(w, d.attr[i * 4 + 1], d.attr[i * 4 + 2], u, p), { s, n, k } = axes(u);
  let D: V3 = [(x - R[0]) * a.stretch, (y - R[1]) * a.stretch, (z - R[2]) * a.stretch];
  D = rot(rot(rot(D, n, a.sway), s, a.lift), k, a.gather);
  out[0] = R[0] + D[0]; out[1] = R[1] + D[1]; out[2] = R[2] + D[2];
  return out;
}

/** 정점 셰이더(ASCII 만 — GLSL ES 1.0 은 주석 속 한글도 컴파일 오류로 보는 기기가 있다). cephArmDisplace 와 같은 식.
 *  aquaArm = [w, rr, ph, arm] · aquaRoot · aquaDir · 팔 값은 뼈 텍스처의 남는 칸 첫 텍셀(t, walk, stream, flare) · 둘째 텍셀 x(gain).
 *  pars: 함수(뼈 텍스처 선언 뒤에 넣는다) · normal: 법선도 같은 회전(안 돌리면 팔을 돌려도 빛이 옛 방향이라 팔이 검게 보였다) · vertex: 자리 */
export function cephGlsl(slot: number) {
  const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  const pars = `#include <skinning_pars_vertex>
#ifdef USE_SKINNING
vec4 aquaArmP() { int cS = textureSize( boneTexture, 0 ).x; int cJ = ${slot} * 4; return texelFetch( boneTexture, ivec2( cJ % cS, cJ / cS ), 0 ); }
vec4 aquaArmQ() { int cS = textureSize( boneTexture, 0 ).x; int cJ = ${slot} * 4 + 1; return texelFetch( boneTexture, ivec2( cJ % cS, cJ / cS ), 0 ); }
mat3 aquaRotM( vec3 k, float a ) {
  float c = cos( a ), s = sin( a );
  return mat3( c ) + s * mat3( vec3( 0.0, k.z, -k.y ), vec3( -k.z, 0.0, k.x ), vec3( k.y, -k.x, 0.0 ) ) + ( 1.0 - c ) * mat3( k * k.x, k * k.y, k * k.z );
}
vec3 aquaSafe( vec3 v, vec3 fb ) { float l = length( v ); return l > 1e-4 ? v / l : fb; }
float aquaArmFrame( out mat3 cM ) {
  cM = mat3( 1.0 );
  float cW = aquaArm.x;
  if ( cW <= 0.0 ) return 1.0;
  vec4 cP = aquaArmP(); vec4 cQ = aquaArmQ();
  float cR = aquaArm.y, cPh = aquaArm.z;
  vec3 cU = aquaDir;
  float cRate = ( ${f(ARM.idleRate)} + ${f(ARM.walkRate - ARM.idleRate)} * cP.y ) * ( 1.0 + 0.35 * sin( cPh * 1.3 + 1.1 ) );
  float cCalm = 1.0 - 0.85 * cP.z;
  float cBend = ( ${f(ARM.idle)} + ${f(ARM.walk - ARM.idle)} * cP.y ) * cCalm * cQ.x;
  float cSway = cBend * pow( cR, 1.4 ) * sin( cP.x * cRate - cR * ${f(ARM.lag)} + cPh );
  float cQq = 1.0 - smoothstep( 0.75, 0.95, cU.x );
  float cLift = ( -${f(ARM.curl)} * cCalm * cQ.x * cR * cR * cR * ( 0.6 + 0.4 * sin( cP.x * cRate * ${f(ARM.curlRate)} + cPh * 1.7 ) ) - ${f(ARM.flareLift)} * cP.w * cR ) * ( 0.2 + 0.8 * cQq )
    + ${f(ARM.lift)} * cP.y * cCalm * cQ.x * cR * sin( cP.x * cRate * 0.8 + cPh + 1.3 );
  float cA = acos( clamp( cU.x, -1.0, 1.0 ) );
  float cSide = 1.0 - smoothstep( 1.3, 1.9, cA );
  float cGather = ${f(ARM.bundle)} * cP.z * min( 0.75, cA * 0.6 ) * cSide * smoothstep( 0.0, 0.35, cR ) - ${f(ARM.flare)} * cP.w * clamp( cA, 0.3, 0.6 ) * cR;
  float cSt = ( 1.0 + cW * ${f(ARM.reach)} * cP.y * cCalm * sin( cP.x * cRate * 0.8 + cPh + 1.3 ) * smoothstep( 0.0, 0.5, cR ) ) * ( 1.0 - 0.4 * cP.z * ( 1.0 - cSide ) * cW * smoothstep( 0.0, 0.4, cR ) );
  vec3 cS = aquaSafe( cross( vec3( 0.0, 1.0, 0.0 ), cU ), vec3( 0.0, 0.0, 1.0 ) );
  vec3 cN = aquaSafe( cross( cU, cS ), vec3( 0.0, 1.0, 0.0 ) );
  vec3 cK = aquaSafe( cross( cU, vec3( 1.0, 0.0, 0.0 ) ), cS );
  cM = aquaRotM( cK, cGather * cW ) * aquaRotM( cS, cLift * cW ) * aquaRotM( cN, cSway * cW );
  return cSt;
}
#endif`;
  const normal = `#include <beginnormal_vertex>
#ifdef USE_SKINNING
{ mat3 cM; aquaArmFrame( cM ); objectNormal = cM * objectNormal; }
#endif`;
  const vertex = `#include <begin_vertex>
#ifdef USE_SKINNING
{ mat3 cM; float cSt = aquaArmFrame( cM ); if ( aquaArm.x > 0.0 ) transformed = aquaRoot + cM * ( ( transformed - aquaRoot ) * cSt ); }
#endif`;
  return { pars, normal, vertex };
}
