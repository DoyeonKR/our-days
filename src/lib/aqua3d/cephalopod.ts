/* 두족류 팔(2026-11-13) [사용자: "두족류 움직임이 아직 개선되지 않았어 … 문어 류는 움직임이 10점중에 2점이야 실제 움직임을 참고해서 고쳐"]
 * 왜: 두족류 GLB 는 그림 한 장에서 지은 몸이라 뼈가 몸길이(X) 사슬 여섯뿐이다 — 여덟 팔이 하나의 꼬리처럼 같이 휘었고, 문어는 그림이 그대로 미끄러지는 스티커였다.
 * 실제 문어: 팔 여덟이 저마다 따로 움직인다(뇌의 3분의 2 가 팔에 있다). 굽힘은 팔 뿌리에서 끝으로 물결처럼 지나가고, 끝은 늘 말렸다 펴진다.
 * 기어갈 땐 앞쪽 팔이 뻗어 짚고 당기며(팔마다 늘었다 줄었다), 물을 뿜을 땐 팔을 한데 모아 외투막 반대쪽으로 늘어뜨리고, 미끄러짐 끝엔 팔 사이 막을 우산처럼 편다.
 * 그래서 GLB 를 다시 굽지 않고(검수 · 해시 그대로) 정점마다 '팔 뿌리 둘레의 자리'를 한 번 구해 두고, 정점 셰이더가 팔 뿌리(hub)를 축으로 팔마다 다른 박자로 돌리고 늘인다.
 * 그림의 uv 가 곧 정점 자리라(x = a·u + b, y = c·v + d — 오차 3/14000) 팔 뿌리 · 외투막은 그림에서 읽어 표로 둔다(모델 12개).
 * 이 파일은 three 없이 순수 계산만 한다 — 셰이더(glb.ts)와 같은 식이고, 시험이 그대로 부른다. */

/** 그림 좌표(u 오른쪽 · v 아래, 0~1)로 읽은 팔 뿌리 · 머리 반지름 · 외투막 타원(가운데 u v · 반지름 u v) */
export type CephArt = { hub: readonly [number, number]; crown: number; mantle: readonly [number, number, number, number] };
export const CEPH_ART: Readonly<Record<string, CephArt>> = {
  octopus: { hub: [0.56, 0.47], crown: 0.1, mantle: [0.42, 0.25, 0.21, 0.14] },
  fry_octopus: { hub: [0.53, 0.5], crown: 0.1, mantle: [0.43, 0.28, 0.18, 0.15] },
  juv_octopus: { hub: [0.47, 0.5], crown: 0.1, mantle: [0.33, 0.3, 0.19, 0.15] },
  kraken: { hub: [0.65, 0.5], crown: 0.12, mantle: [0.45, 0.27, 0.32, 0.14] },
  fry_kraken: { hub: [0.6, 0.5], crown: 0.12, mantle: [0.43, 0.27, 0.26, 0.14] },
  juv_kraken: { hub: [0.57, 0.5], crown: 0.11, mantle: [0.45, 0.25, 0.23, 0.12] },
  squid: { hub: [0.6, 0.5], crown: 0.06, mantle: [0.32, 0.5, 0.26, 0.09] },
  fry_squid: { hub: [0.52, 0.5], crown: 0.05, mantle: [0.28, 0.5, 0.21, 0.08] },
  juv_squid: { hub: [0.57, 0.49], crown: 0.05, mantle: [0.3, 0.49, 0.23, 0.07] },
  giant_squid: { hub: [0.66, 0.38], crown: 0.06, mantle: [0.33, 0.37, 0.26, 0.1] },
  fry_giant_squid: { hub: [0.62, 0.35], crown: 0.06, mantle: [0.32, 0.33, 0.21, 0.09] },
  juv_giant_squid: { hub: [0.61, 0.38], crown: 0.06, mantle: [0.33, 0.36, 0.24, 0.09] },
};
/** 문어형(팔이 사방으로 퍼진다) — 오징어형은 팔이 앞으로 모여 있어 물결을 작게 */
export const octopusLike = (key: string) => /octopus|kraken/.test(key);

/** 팔 박자(rad/s) · 물결이 팔을 타고 가는 빠르기(뿌리→끝 한 번에 늦는 각) · 팔마다 다른 위상(팔 둘레 각에 곱한다) */
export const ARM = {
  /** 쉬는 동안 팔 물결 박자 · 기어갈 때 박자 */ idleRate: 1.1, walkRate: 2.6,
  /** 뿌리에서 끝까지 늦는 위상 — 1 이 넘으면 팔 하나에 물결이 반 번 넘게 보인다 */ lag: 2.6,
  /** 팔 둘레 각 1 rad 마다 위상 차(팔 사이 약 0.6 rad → 이웃 팔이 약 2.4 rad 어긋난다) */ spread: 4.0,
  /** 끝의 굽힘(rad) — 쉼 · 기어감 */ idle: 0.16, walk: 0.3,
  /** 끝이 말렸다 펴지는 몫(rad, 끝 쪽 세제곱) · 박자 배율 */ curl: 0.22, curlRate: 0.55,
  /** 기어갈 때 팔이 늘었다 줄었다(뻗어 짚고 당기기) */ reach: 0.12,
  /** 물 뿜기 때 팔을 모으는 몫 · 미끄러짐 끝에 펴는 몫 */ bundle: 0.85, flare: 0.45,
  /** 옆(z) 흔들림 — 몸 단위가 아니라 뿌리에서 거리의 비율 */ z: 0.08,
} as const;

/** 외투막 숨(0~1) — 천천히 부풀었다(들숨) 빨리 오므린다(날숨). 주기 BREATH_S 초 */
export const BREATH_S = 2.6;
export function breathOf(t: number, ph = 0) { const x = ((t / BREATH_S + ph / 6.283) % 1 + 1) % 1; return x < 0.7 ? Math.sin((x / 0.7) * Math.PI * 0.5) ** 2 : Math.cos(((x - 0.7) / 0.3) * Math.PI * 0.5) ** 2; }
const unit = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (a: number, b: number, x: number) => { const t = unit((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 정점마다 팔 자료 — out: [팔 몫 w, 뿌리→끝 0~1 rr, 팔 위상 φ, 팔 둘레 각 θ] · 그리고 원본 정점 단위의 팔 뿌리 · 모으는 방향 · 머리 반지름.
 *  P: 원본(raw) 정점 x y · uv: 그 정점의 그림 좌표. 같은 식이 셰이더에도 있다 */
export function cephArmData(key: string, P: ArrayLike<number>, uv: ArrayLike<number>, n: number, index?: ArrayLike<number> | null) {
  const art = CEPH_ART[key];
  if (!art) return null;
  // uv → 정점 자리(최소제곱 — 그림을 그대로 세운 판이라 선형이다)
  let su = 0, sx = 0, suu = 0, sux = 0, sv = 0, sy = 0, svv = 0, svy = 0;
  for (let i = 0; i < n; i++) { const u = uv[i * 2], v = uv[i * 2 + 1], x = P[i * 3], y = P[i * 3 + 1]; su += u; sx += x; suu += u * u; sux += u * x; sv += v; sy += y; svv += v * v; svy += v * y; }
  const a = (n * sux - su * sx) / (n * suu - su * su), b = (sx - a * su) / n, c = (n * svy - sv * sy) / (n * svv - sv * sv), d = (sy - c * sv) / n;
  if (!Number.isFinite(a) || !Number.isFinite(c) || Math.abs(a) < 1e-9) return null;
  const hx = a * art.hub[0] + b, hy = c * art.hub[1] + d, unitLen = Math.abs(a); // 그림 1 = 정점 unitLen
  const crown = art.crown * unitLen;
  const mx = a * art.mantle[0] + b, my = c * art.mantle[1] + d, mrx = art.mantle[2] * unitLen, mry = art.mantle[3] * Math.abs(c);
  // 모으는 방향 — 외투막에서 팔 뿌리 쪽(물을 뿜으면 외투막이 앞, 팔은 그 반대로 늘어진다)
  const sdir = Math.atan2(hy - my, hx - mx);
  const out = new Float32Array(n * 4);
  let R = crown * 1.5, arms = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, Math.hypot(P[i * 3] - hx, P[i * 3 + 1] - hy));
  for (let i = 0; i < n; i++) {
    const dx = P[i * 3] - hx, dy = P[i * 3 + 1] - hy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const ex = (P[i * 3] - mx) / mrx, ey = (P[i * 3 + 1] - my) / mry, inMantle = 1 - smooth(0.85, 1.25, Math.hypot(ex, ey));
    // 오징어형은 외투막 끝의 지느러미(팔 뿌리에서 가장 먼 쪽)도 빼야 한다 — 뿌리에서 멀어 조금만 돌려도 크게 휘둘렸다
    const fx = (P[i * 3] - (mx - Math.sign(hx - mx) * mrx * 0.72)) / (mrx * 0.5), fy = (P[i * 3 + 1] - my) / (mry * 2.6);
    const inFin = octopusLike(key) ? 0 : 1 - smooth(0.85, 1.25, Math.hypot(fx, fy));
    const w = smooth(crown, crown * 1.9, r) * (1 - inMantle) * (1 - inFin);
    out[i * 4] = w; out[i * 4 + 1] = unit((r - crown) / Math.max(1e-6, R - crown)); out[i * 4 + 3] = th;
    out[i * 4 + 2] = phaseOf(th);
  }
  // 팔 하나 = 위상 하나 — 팔은 휘어 있어 팔을 따라가면 둘레 각이 바뀐다. 정점마다 제 각으로 위상을 주면 한 팔 안에서 물결이 제멋대로 흘렀다.
  // 뿌리 둘레(rr 0.3 안)의 정점을 씨앗으로 메시 표면을 따라 가장 가까운 씨앗을 찾아(다익스트라) 그 씨앗의 둘레 각으로 위상을 정한다.
  // 그림에서 팔끼리 닿아 메시가 이어져 있어도(크라켄 · 오징어) 제 팔을 따라 뿌리로 가는 길이 더 짧아 팔마다 따로 묶인다
  if (index && index.length) {
    const nb: number[][] = Array.from({ length: n }, () => []);
    const edge = (x: number, y: number) => { nb[x].push(y); nb[y].push(x); };
    for (let t = 0; t + 2 < index.length; t += 3) { edge(index[t], index[t + 1]); edge(index[t + 1], index[t + 2]); edge(index[t], index[t + 2]); }
    const same = new Map<string, number>();
    for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3]) + "," + Math.round(P[i * 3 + 1]) + "," + Math.round(P[i * 3 + 2]); const j = same.get(k); if (j === undefined) same.set(k, i); else edge(i, j); }
    const dist = new Float64Array(n).fill(Infinity), label = new Float64Array(n), done = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (out[i * 4 + 1] < 0.3) { dist[i] = 0; label[i] = out[i * 4 + 3]; }
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const v of nb[u]) {
        const dd = best + Math.hypot(P[u * 3] - P[v * 3], P[u * 3 + 1] - P[v * 3 + 1], P[u * 3 + 2] - P[v * 3 + 2]);
        if (dd < dist[v]) { dist[v] = dd; label[v] = label[u]; }
      }
    }
    // 팔 뿌리가 좁은 각에 모인 몸(오징어 · 크라켄)은 둘레 각 차가 작아 위상이 거의 같았다 — 팔 끝들이 퍼진 폭에 맞춰 위상을 넓힌다(최대 3배)
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) if (out[i * 4] > 0.9 && out[i * 4 + 1] > 0.5 && Number.isFinite(dist[i])) { const d2 = wrapPi(label[i] - sdir); lo = Math.min(lo, d2); hi = Math.max(hi, d2); }
    const k = hi > lo ? Math.min(3, Math.max(1, 2.6 / (hi - lo))) : 1;
    const roots = new Set<number>();
    for (let i = 0; i < n; i++) if (Number.isFinite(dist[i])) {
      const th2 = sdir + wrapPi(label[i] - sdir) * k;
      out[i * 4 + 2] = phaseOf(th2);
      if (out[i * 4] > 0.9 && out[i * 4 + 1] > 0.5) roots.add(Math.round(out[i * 4 + 2] * 2));
    }
    arms = roots.size;
  }
  return { attr: out, hub: [hx, hy] as const, sdir, crown, R, arms };
}

/** 그 순간의 팔 자세 값 — 화면(glb)이 프레임마다 뼈 텍스처의 남는 칸에 쓴다 */
export type ArmPose = { t: number; walk: number; stream: number; flare: number; gain: number };
/** 팔마다 다른 위상(팔 뿌리의 둘레 각에서) — 둘레 각에 곱하고 조금 흩는다(이웃 팔이 같이 움직이지 않게) */
export const phaseOf = (th: number) => th * ARM.spread + Math.sin(th * 7.0) * 0.9;
/** 팔마다 다른 빠르기(0.65 ~ 1.35 배, 위상에서) — 같은 빠르기에 위상만 다르면 팔끼리 늘 같은 박자로 움직여 보인다(실제 팔은 저마다 따로 논다) */
export const armRate = (ph: number) => 1 + 0.35 * Math.sin(ph * 1.3 + 1.1);
const wrapPi = (x: number) => { x = (x + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
/** 한 정점의 팔 변형(원본 정점 단위). out 에 [x, y, z]. 셰이더(CEPH_GLSL)와 같은 식 */
export function cephArmDisplace(x: number, y: number, z: number, at: ArrayLike<number>, i: number, hub: readonly [number, number], sdir: number, crown: number, p: ArmPose, out: number[] | Float32Array) {
  const w = at[i * 4], rr = at[i * 4 + 1], ph = at[i * 4 + 2], th = at[i * 4 + 3];
  out[0] = x; out[1] = y; out[2] = z;
  if (w <= 0) return out;
  const dx = x - hub[0], dy = y - hub[1], r = Math.hypot(dx, dy);
  const rate = (ARM.idleRate + (ARM.walkRate - ARM.idleRate) * p.walk) * armRate(ph), calm = 1 - 0.85 * p.stream;
  const bend = (ARM.idle + (ARM.walk - ARM.idle) * p.walk) * calm * p.gain;
  // 뿌리에서 끝으로 지나가는 물결(끝일수록 크게) + 끝 말기(세제곱) + 모으기 · 펴기
  let ang = bend * rr ** 1.4 * Math.sin(p.t * rate - rr * ARM.lag + ph)
    + ARM.curl * calm * p.gain * rr ** 3 * (0.6 + 0.4 * Math.sin(p.t * rate * ARM.curlRate + ph * 1.7));
  // 모으기 · 펴기는 각을 묶는다 — 외투막 쪽 팔까지 다 돌리면 팔이 외투막을 뚫고 지나가 납작한 판으로 꼬였다
  const to = wrapPi(sdir - th), side = smooth(1.9, 1.3, Math.abs(to)); // 외투막 쪽(뒤)의 팔은 돌리지 않고 몸 뒤로 끌어당긴다(돌리면 외투막을 가로지르는 판이 됐다)
  ang += ARM.bundle * p.stream * Math.max(-0.75, Math.min(0.75, to * 0.6)) * side * smooth(0, 0.35, rr);
  ang -= ARM.flare * p.flare * Math.max(-0.6, Math.min(0.6, to)) * rr;
  ang *= w;
  // 뻗었다 당기기 — 기어갈 때 팔마다 늘었다 줄었다(뿌리 쪽은 그대로)
  const stretch = (1 + w * ARM.reach * p.walk * calm * Math.sin(p.t * rate * 0.8 + ph + 1.3) * smooth(0, 0.5, rr)) * (1 - 0.4 * p.stream * (1 - side) * w * smooth(0, 0.4, rr));
  const k = r > 1e-9 ? (crown + (r - crown) * stretch) / r : 1;
  const c = Math.cos(ang), s = Math.sin(ang), ux = dx * k, uy = dy * k;
  out[0] = hub[0] + ux * c - uy * s; out[1] = hub[1] + ux * s + uy * c;
  out[2] = z + w * r * ARM.z * p.gain * calm * rr * Math.sin(p.t * rate * 0.9 + ph + 2.1);
  return out;
}

/** 정점 셰이더(ASCII 만 — GLSL ES 1.0 은 주석 속 한글도 컴파일 오류로 보는 기기가 있다). cephArmDisplace 와 같은 식.
 *  aquaArm = [w, rr, ph, th] · 팔 값은 뼈 텍스처의 남는 칸 첫 텍셀(t, walk, stream, flare) · 둘째 텍셀 x(gain).
 *  pars: 함수(뼈 텍스처 선언 뒤에 넣는다) · normal: 법선도 같은 각만큼 돌린다(안 돌리면 팔을 돌려도 빛이 옛 방향이라 팔이 검게 보였다) · vertex: 자리 */
export function cephGlsl(slot: number, hub: readonly [number, number], sdir: number, crown: number) {
  const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  const pars = `#include <skinning_pars_vertex>
#ifdef USE_SKINNING
vec4 aquaArmP() { int cS = textureSize( boneTexture, 0 ).x; int cJ = ${slot} * 4; return texelFetch( boneTexture, ivec2( cJ % cS, cJ / cS ), 0 ); }
vec4 aquaArmQ() { int cS = textureSize( boneTexture, 0 ).x; int cJ = ${slot} * 4 + 1; return texelFetch( boneTexture, ivec2( cJ % cS, cJ / cS ), 0 ); }
vec3 aquaArmMove( vec3 p, out float cA ) {
  cA = 0.0;
  if ( aquaArm.x <= 0.0 ) return p;
  vec4 cP = aquaArmP(); vec4 cQ = aquaArmQ();
  float cW = aquaArm.x, cR = aquaArm.y, cPh = aquaArm.z, cTh = aquaArm.w;
  vec2 cH = vec2( ${f(hub[0])}, ${f(hub[1])} );
  vec2 cD = p.xy - cH;
  float cr = length( cD );
  float cRate = ( ${f(ARM.idleRate)} + ${f(ARM.walkRate - ARM.idleRate)} * cP.y ) * ( 1.0 + 0.35 * sin( cPh * 1.3 + 1.1 ) );
  float cCalm = 1.0 - 0.85 * cP.z;
  float cBend = ( ${f(ARM.idle)} + ${f(ARM.walk - ARM.idle)} * cP.y ) * cCalm * cQ.x;
  cA = cBend * pow( cR, 1.4 ) * sin( cP.x * cRate - cR * ${f(ARM.lag)} + cPh )
    + ${f(ARM.curl)} * cCalm * cQ.x * cR * cR * cR * ( 0.6 + 0.4 * sin( cP.x * cRate * ${f(ARM.curlRate)} + cPh * 1.7 ) );
  float cTo = ${f(sdir)} - cTh; cTo = cTo - 6.2831853 * floor( ( cTo + 3.14159265 ) / 6.2831853 );
  float cSide = 1.0 - smoothstep( 1.3, 1.9, abs( cTo ) );
  cA += ${f(ARM.bundle)} * cP.z * clamp( cTo * 0.6, -0.75, 0.75 ) * cSide * smoothstep( 0.0, 0.35, cR );
  cA -= ${f(ARM.flare)} * cP.w * clamp( cTo, -0.6, 0.6 ) * cR;
  cA *= cW;
  float cSt = ( 1.0 + cW * ${f(ARM.reach)} * cP.y * cCalm * sin( cP.x * cRate * 0.8 + cPh + 1.3 ) * smoothstep( 0.0, 0.5, cR ) ) * ( 1.0 - 0.4 * cP.z * ( 1.0 - cSide ) * cW * smoothstep( 0.0, 0.4, cR ) );
  float cK = cr > 1e-6 ? ( ${f(crown)} + ( cr - ${f(crown)} ) * cSt ) / cr : 1.0;
  vec2 cU = cD * cK;
  float cc = cos( cA ), cs = sin( cA );
  vec3 o = p;
  o.xy = cH + vec2( cU.x * cc - cU.y * cs, cU.x * cs + cU.y * cc );
  o.z += cW * cr * ${f(ARM.z)} * cQ.x * cCalm * cR * sin( cP.x * cRate * 0.9 + cPh + 2.1 );
  return o;
}
#endif`;
  const normal = `#include <beginnormal_vertex>
#ifdef USE_SKINNING
{ float cA; aquaArmMove( position, cA ); float cc = cos( cA ), cs = sin( cA ); objectNormal.xy = vec2( objectNormal.x * cc - objectNormal.y * cs, objectNormal.x * cs + objectNormal.y * cc ); }
#endif`;
  const vertex = `#include <begin_vertex>
#ifdef USE_SKINNING
{ float cA; transformed = aquaArmMove( transformed, cA ); }
#endif`;
  return { pars, normal, vertex };
}
