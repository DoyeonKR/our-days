import * as T from "three";
import { WORLD } from "./world.ts";

/** 정어리 떼(2026-11-10) [사용자: "더 웅장하게 다듬어"] — 대수족관(터널)의 배경 손님. 내 물고기가 아니라 바다의 분위기다(누를 수 없고 저장도 없다).
 *  한 묶음(InstancedMesh)으로 수백 마리를 그린다 — 그리기 호출 하나. 떼의 중심이 터널 둘레를 크게 돌고(리사주 곡선),
 *  한 마리 한 마리는 중심 둘레의 제자리를 맴돌며 숨 쉬듯 모였다 퍼진다(먹이 공처럼). 같은 시각 = 같은 자리(순수 함수, 할당 없음).
 *  2026-11-12 [사용자: 정어리가 물고기가 아니라 흰 눈 · 비 줄기처럼 보인다] — 고친 것:
 *   ① 몸이 빛을 내는 흰색(emissive 0.9) 한 가지 + 두께만 부풀었다 줄었다(scale) → 등은 짙은 청회색 · 옆은 은빛 · 배는 흰 정점 색, 작은 검은 눈.
 *      스스로 내는 빛은 몸 색에 비례해 조금만(등이 어두운 채로 남는다) — 예전엔 등까지 하얗게 떠서 빗줄기처럼 보였다.
 *   ② 꼬리가 안 휘었다 → 정점 셰이더에서 몸이 머리 → 꼬리로 물결친다(마리마다 박자 · 빠르기 · 폭이 다르다 — 묶음 속성 aquaSwim, 그리기 호출은 그대로 하나).
 *      휜 만큼 법선도 기울여 몸을 타고 빛이 흐른다.
 *   ③ 다 같은 방향 · 같은 간격이었다 → 마리마다 머리를 조금씩 다르게 두고, 제자리 안에서 천천히 떠돈다. 가끔 한 마리씩 휙 돌며 옆으로 눕는데,
 *      그때 옆구리가 빛을 받아 번쩍인다(누운 만큼만 — 정어리 떼의 반짝임이 이렇다). */
export type Shoal = { mesh: T.InstancedMesh; animate: (t: number) => void; dispose: () => void };

/** 몸 단면 — 등 · 위옆 · 아래옆 · 배 · 아래옆 · 위옆(위에서 시계 방향). 정점 색도 이 순서 */
const RING = [[0, 1], [0.85, 0.5], [0.85, -0.55], [0, -1], [-0.85, -0.55], [-0.85, 0.5]] as const;
/** 머리 → 꼬리자루 마디(x · 반높이 · 반폭) — 방추형(아가미 뒤가 가장 두껍다). 마디가 있어야 셰이더가 몸을 휠 수 있다 */
const STATIONS = [[0.42, 0.045, 0.03], [0.3, 0.075, 0.045], [0.12, 0.085, 0.05], [-0.08, 0.07, 0.04], [-0.24, 0.04, 0.022], [-0.32, 0.018, 0.01]] as const;
const BACK = new T.Color(0x1f3646), UPPER = new T.Color(0x6a8798), SILVER = new T.Color(0xc6d2da), BELLY = new T.Color(0xe8eef0), EYE = new T.Color(0x0a0d10);
const RING_COLOR = [BACK, UPPER, SILVER, BELLY, SILVER, UPPER];

/** 한 마리 몸 — 길이 1, 머리가 +x. 뾰족한 주둥이 + 여섯 마디 몸통 + 갈라진 꼬리 + 양옆 눈(삼각형 몇 장, 약 80장) */
function sardineGeometry(): T.BufferGeometry {
  const p: number[] = [], c: number[] = [];
  const put = (x: number, y: number, z: number, col: T.Color) => { p.push(x, y, z); c.push(col.r, col.g, col.b); };
  const ringAt = (s: number, k: number): [number, number, number] => { const [x, h, w] = STATIONS[s]; return [x, RING[k][1] * h, RING[k][0] * w]; };
  const tri = (a: [number, number, number], ca: T.Color, b: [number, number, number], cb: T.Color, d: [number, number, number], cd: T.Color) => { put(...a, ca); put(...b, cb); put(...d, cd); };
  const n = RING.length;
  // 주둥이(한 점) → 첫 마디
  for (let k = 0; k < n; k++) tri([0.5, 0, 0], SILVER, ringAt(0, k), RING_COLOR[k], ringAt(0, (k + 1) % n), RING_COLOR[(k + 1) % n]);
  // 마디 사이 — 감기는 방향은 바깥을 보게(양면 재질이지만 법선이 바깥이어야 빛이 맞다)
  for (let s = 0; s < STATIONS.length - 1; s++) for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n, a = ringAt(s, k), b = ringAt(s, k2), d = ringAt(s + 1, k), e = ringAt(s + 1, k2);
    tri(a, RING_COLOR[k], d, RING_COLOR[k], b, RING_COLOR[k2]);
    tri(b, RING_COLOR[k2], d, RING_COLOR[k], e, RING_COLOR[k2]);
  }
  // 꼬리자루 끝을 닫는다
  const last = STATIONS.length - 1;
  for (let k = 0; k < n; k++) tri([-0.33, 0, 0], UPPER, ringAt(last, (k + 1) % n), RING_COLOR[(k + 1) % n], ringAt(last, k), RING_COLOR[k]);
  // 갈라진 꼬리(두 장 — 위 · 아래 갈래, 세로 판)
  tri([-0.31, 0.014, 0], UPPER, [-0.5, 0.115, 0], UPPER, [-0.44, 0, 0], SILVER);
  tri([-0.31, -0.014, 0], SILVER, [-0.44, 0, 0], SILVER, [-0.5, -0.1, 0], SILVER);
  // 눈 — 머리 옆의 작은 검은 삼각형(몸 표면에서 살짝 띄운다)
  for (const sd of [-1, 1]) {
    const z = sd * 0.04;
    if (sd > 0) tri([0.405, 0.022, z], EYE, [0.375, 0.006, z], EYE, [0.375, 0.034, z], EYE);
    else tri([0.405, 0.022, z], EYE, [0.375, 0.034, z], EYE, [0.375, 0.006, z], EYE);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}

/** 셰이더 원문(ASCII 만 — 설명은 TS 주석에). 시험이 ASCII 인지 본다
 *  aquaSwim = (박자 위상, 꼬리 빠르기 rad/s, 폭, 이번 프레임 번쩍임) — 마리마다 하나(InstancedBufferAttribute) */
export const SARDINE_GLSL = {
  vertexCommon: "#include <common>\nattribute vec4 aquaSwim;\nuniform float aquaClock;\nvarying float vAquaFlash;",
  // 머리(u=0)는 거의 그대로 · 꼬리(u=1)로 갈수록 제곱으로 크게, 물결이 머리 -> 꼬리로 지나간다. 휜 기울기만큼 법선도 돌린다
  vertexNormal: `#include <beginnormal_vertex>
  float aquaU = clamp( ( 0.38 - position.x ) / 0.88, 0.0, 1.0 );
  float aquaA = aquaSwim.z * ( 0.012 + 0.13 * aquaU * aquaU );
  float aquaArg = aquaClock * aquaSwim.y + aquaSwim.x - aquaU * 4.2;
  float aquaBend = aquaA * sin( aquaArg );
  float aquaSlope = -( aquaSwim.z * 0.26 * aquaU * sin( aquaArg ) - aquaA * 4.2 * cos( aquaArg ) ) / 0.88;
  objectNormal = normalize( vec3( objectNormal.x - aquaSlope * objectNormal.z, objectNormal.y, objectNormal.z ) );`,
  vertexBegin: "#include <begin_vertex>\n  transformed.z += aquaBend;\n  vAquaFlash = aquaSwim.w;",
  fragmentCommon: "#include <common>\nvarying float vAquaFlash;",
  // 스스로 내는 빛은 몸 색에 비례(등은 어둡게 남는다) + 누운 옆구리가 이쪽을 볼수록 번쩍인다
  fragmentEmissive: `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.07, 0.11, 0.13 );
  float aquaSide = abs( dot( normal, normalize( vViewPosition ) ) );
  totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.8, 0.9, 1.0 ) * vAquaFlash * aquaSide * aquaSide;`,
};

/** 한 마리가 휙 도는 순간(0~1 — 0 이면 평소). 마리마다 6~14초에 한 번, 0.9초 동안. 순수 함수 */
export function sardineTurn(period: number, offset: number, t: number): number {
  const u = ((((t + offset) % period) + period) % period) / 0.9;
  return u < 1 ? Math.sin(Math.PI * u) : 0;
}

export function makeShoal(count: number, bounds: { halfX: number; halfZ: number; top: number }): Shoal {
  const geo = sardineGeometry();
  // 은빛은 금속감 + 환경광(scene.environment)에서 — 스스로 내는 빛은 셰이더가 몸 색에 비례해 조금만 더한다
  const mat = new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.3, side: T.DoubleSide });
  const clock = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.aquaClock = clock;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", SARDINE_GLSL.vertexCommon)
      .replace("#include <beginnormal_vertex>", SARDINE_GLSL.vertexNormal)
      .replace("#include <begin_vertex>", SARDINE_GLSL.vertexBegin);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", SARDINE_GLSL.fragmentCommon)
      .replace("#include <emissivemap_fragment>", SARDINE_GLSL.fragmentEmissive);
  };
  mat.customProgramCacheKey = () => "aqua-sardine-v2";
  const mesh = new T.InstancedMesh(geo, mat, count);
  mesh.name = "ambient-sardine-shoal";
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  // 한 마리마다 떼 안의 자리(납작한 구 안) · 크기 — 시드 고정. 2026-11-11: 자리를 고른 격자(조금 흔든)에서 골라 이웃끼리 간격이 일정하고,
  // 떼가 다 같이 한 덩어리로 돈다 — 예전엔 구 안의 아무 점이라 붙은 자리가 있었고, 마리마다 도는 빠르기 · 위아래 흔들림이 달라 서로를 뚫고 지나갔다(가장 가까운 이웃 0.15 미만 11%)
  const seat = new Float32Array(count * 4);
  let s = 1234567;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const SQ = 0.7, pts: number[] = [];
  let step = Math.cbrt((4 / 3) * Math.PI * SQ / Math.max(1, count)) * 0.98;
  for (let tries = 0; tries < 8 && pts.length / 3 < count; tries++, step *= 0.94) {
    pts.length = 0;
    const n = Math.ceil(1 / step);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let c = -n; c <= n; c++) {
      // 층마다 반 칸 어긋나게(벌집 비슷) — 같은 간격에 더 많이 들어간다
      const x = (a + (b & 1) * 0.5) * step, y = b * step * 0.87, z = (c + (a & 1) * 0.5) * step;
      if (x * x + (y / SQ) ** 2 + z * z <= 1) pts.push(x, y, z);
    }
  }
  // 고른 순서는 정해진 섞기 — 수가 적어도 떼 전체에 퍼진다
  const total = pts.length / 3, order = Array.from({ length: total }, (_, k) => k).sort((p, q) => ((Math.imul(p + 1, 2654435761) >>> 0) % 10007) - ((Math.imul(q + 1, 2654435761) >>> 0) % 10007));
  for (let i = 0; i < count; i++) {
    const k = order[i % total];
    seat[i * 4] = pts[k * 3] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 1] = pts[k * 3 + 1] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 2] = pts[k * 3 + 2] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 3] = 0.8 + rnd() * 0.5;
  }
  // 마리마다 다른 것(시드 고정): 꼬리 박자 · 빠르기 · 폭(셰이더), 머리 틀어짐 · 떠도는 박자 · 휙 도는 주기와 방향(CPU)
  const swim = new Float32Array(count * 4), habit = new Float32Array(count * 8), tint = new T.Color();
  for (let i = 0; i < count; i++) {
    swim[i * 4] = rnd() * Math.PI * 2; swim[i * 4 + 1] = 8 + rnd() * 4; swim[i * 4 + 2] = 0.8 + rnd() * 0.4;
    habit[i * 8] = (rnd() - 0.5) * 0.16; habit[i * 8 + 1] = (rnd() - 0.5) * 0.1; // 머리 좌우 · 위아래 틀어짐(rad)
    habit[i * 8 + 2] = rnd() * Math.PI * 2; habit[i * 8 + 3] = 0.25 + rnd() * 0.3; // 떠도는 위상 · 빠르기
    habit[i * 8 + 4] = 6 + rnd() * 8; habit[i * 8 + 5] = rnd() * 14; habit[i * 8 + 6] = rnd() < 0.5 ? -1 : 1; // 휙 도는 주기 · 어긋남 · 방향
    mesh.setColorAt(i, tint.setScalar(0.86 + rnd() * 0.18)); // 마리마다 밝기가 조금씩 — 한 장의 무늬처럼 안 보이게
  }
  const swimAttr = new T.InstancedBufferAttribute(swim, 4);
  swimAttr.setUsage(T.DynamicDrawUsage); // 번쩍임(w)만 프레임마다 바뀐다
  geo.setAttribute("aquaSwim", swimAttr);
  const dummy = new T.Object3D(), here = new T.Vector3(), now = new T.Vector3(), next = new T.Vector3();
  const floor = WORLD.floor, midY = floor + (bounds.top - floor) * 0.5, ampY = (bounds.top - floor) * 0.18;
  // 떼 반지름은 2.6 ± 0.8(숨 쉬듯) — 중심이 도는 폭 + 반지름 + 몸 반이 유리 안에 들도록 가로 · 앞뒤 폭을 줄인다(2026-11-11 — 8단계에서 1% 가 유리 밖이었다)
  const RMAX = 3.4, body = 0.45;
  const swingX = Math.max(0, Math.min(bounds.halfX * 0.42, bounds.halfX - RMAX - body)), kx = Math.min(1, Math.max(0.3, (bounds.halfX - swingX - body) / RMAX));
  const swingZ = Math.max(0, Math.min(bounds.halfZ * 0.55, bounds.halfZ - RMAX * 0.7 - body)), kz = Math.min(1, Math.max(0.3, (bounds.halfZ - swingZ - body) / RMAX));
  // 제자리 안에서 떠도는 폭 — 격자 한 칸의 이만큼(이웃끼리 서로 반대로 떠돌아도 안 닿게 작게)
  const drift = step * 0.12;
  /** 떼 중심 — 수조를 크게 도는 8자 */
  const center = (t: number, out: T.Vector3) => out.set(Math.sin(t * 0.11) * swingX, midY + Math.sin(t * 0.07 + 1.3) * ampY, Math.sin(t * 0.22) * swingZ);
  /** i 번째 정어리의 자리(시각 t) — 순수 함수 */
  const at = (i: number, t: number, out: T.Vector3) => {
    const wp = habit[i * 8 + 2], ws = habit[i * 8 + 3];
    const sx = seat[i * 4] + Math.sin(t * ws + wp) * drift, sy = seat[i * 4 + 1] + Math.sin(t * ws * 0.8 + wp * 1.7) * drift * 0.6, sz = seat[i * 4 + 2] + Math.cos(t * ws * 1.1 + wp) * drift;
    const R = 2.6 + 0.8 * Math.sin(t * 0.31), w = t * 0.19;
    // 떼 전체가 한 방향으로 소용돌이 — 다 같은 빠르기라 이웃끼리 간격이 유지된다. 위아래 물결도 자리에 따라 이어진다(이웃은 같이 움직인다)
    const ox = (sx * Math.cos(w) - sz * Math.sin(w)) * R * kx, oz = (sx * Math.sin(w) + sz * Math.cos(w)) * R * kz;
    const oy = sy * R + Math.sin(t * 0.9 + sx * 2.1 + sz * 1.7) * 0.05;
    center(t - (seat[i * 4] + 1) * 0.6, here);
    return out.set(here.x + ox, here.y + oy, here.z + oz);
  };
  function place(t: number) {
    clock.value = t;
    for (let i = 0; i < count; i++) {
      // 머리는 제 자리가 실제로 가는 쪽(앞뒤 시각의 자리 차이) — 떼 중심의 방향을 보면 소용돌이 바깥쪽 정어리가 옆으로 기었다
      at(i, t + 0.08, next); at(i, t, now);
      dummy.position.copy(now);
      dummy.lookAt(next.x, next.y, next.z);
      dummy.rotateY(-Math.PI / 2); // 몸은 +x 가 머리 — lookAt 은 +z 를 맞춘다
      // 휙 도는 순간 — 머리를 최대 25° 틀고 옆으로 50° 눕는다(눕는 만큼 번쩍인다). 평소엔 제 버릇대로 조금 틀어진 채 살짝 흔들린다
      const e = sardineTurn(habit[i * 8 + 4], habit[i * 8 + 5], t), dir = habit[i * 8 + 6];
      dummy.rotateY(habit[i * 8] + Math.sin(t * 0.7 + habit[i * 8 + 2]) * 0.05 + dir * 0.44 * e);
      dummy.rotateZ(habit[i * 8 + 1]);
      dummy.rotateX(dir * 0.9 * e + Math.sin(t * 1.3 + habit[i * 8 + 2] * 2) * 0.08);
      swim[i * 4 + 3] = e * e;
      const k = 0.62 * seat[i * 4 + 3];
      dummy.scale.set(k, k, k);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    swimAttr.needsUpdate = true;
  }
  place(0);
  return {
    mesh,
    animate: place,
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); mesh.removeFromParent(); },
  };
}
