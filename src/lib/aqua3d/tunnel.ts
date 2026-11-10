import * as T from "three";
import { WORLD } from "./world.ts";
import type { Obstacle } from "./habits.ts";

/** 터널 수족관(2026-11-10) [사용자: "어항이 아니고 정말 하나의 수족관 같이 최종형태는 터널 형태처럼 엄청 웅장했으면"]
 *  대수족관(7단계 이상)은 앞뒤로 깊다(TUNNEL_DEEP 배). 앞유리에서 안쪽으로 반원 유리 터널이 뻗고 — 금속 갈비뼈 · 바닥 길과 양옆 빛 띠 —
 *  카메라가 그 안을 천천히 걸으며 양옆 · 머리 위로 지나가는 물고기를 본다. 터널 끝 너머엔 수조 뒤쪽 바위가 보인다.
 *  유리는 가장자리일수록 짙게 비치는 셰이더 한 장(투과 재질은 폰에서 비싸다). 물고기는 터널 둘레를 장애물로 보고 비켜 간다(tunnelObstacles). */
export const TUNNEL_R = 2.3;
/** 대수족관의 앞뒤 깊이 배율 — 수조 · 바닥 · 물고기 길 · 장식 자리가 모두 이 배율로 깊어진다 */
export const TUNNEL_DEEP = 2.4;
export const tankDeep = (tier: number) => (tier >= 7 ? TUNNEL_DEEP : 1);
/** 터널 앞 · 뒤 끝(월드 z) — 앞유리(z = 3 × 깊이)에서 시작해 뒤 바위 앞에서 끝난다 */
export const tunnelSpan = (deep: number) => ({ front: 3 * deep, back: -3 * deep + 2.6 });
/** 물고기가 비켜 갈 기둥들 — 터널 축(x = 0)을 따라. 물고기 길의 좌표(앞뒤 · 높이를 늘리기 전)로 준다 */
export function tunnelObstacles(deep: number, tall: number): Obstacle[] {
  const { front, back } = tunnelSpan(deep), out: Obstacle[] = [];
  for (let z = back + 0.6; z < front; z += 1.4) out.push({ x: 0, z: z / deep, r: TUNNEL_R * 0.95, h: (TUNNEL_R + 0.25) / tall });
  return out;
}

export type Tunnel = { root: T.Group; dispose: () => void; animate: (t: number) => void };

export function makeTunnel(deep: number): Tunnel {
  const root = new T.Group();
  root.name = "tunnel-aquarium";
  const { front, back } = tunnelSpan(deep), L = front - back, mid = (front + back) / 2, R = TUNNEL_R, floor = WORLD.floor;
  const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [];
  const time = { value: 0 };

  // 반원 유리관 — 축은 z, 바닥에서 솟는다. 뒤 끝은 둥근 유리 마개
  const segA = 48, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segA; i++) {
    const a = (i / segA) * Math.PI, cx = Math.cos(a), cy = Math.sin(a);
    for (const [j, z] of [back, front].entries()) {
      pos.push(R * cx, floor + R * cy, z);
      nor.push(cx, cy, 0);
      uv.push(j, i / segA);
    }
  }
  for (let i = 0; i < segA; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const tube = new T.BufferGeometry();
  tube.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  tube.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  tube.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  tube.setIndex(idx);
  const cap = new T.CircleGeometry(R, 48, 0, Math.PI);
  cap.translate(0, floor, back);
  geometries.push(tube, cap);
  const glass = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, forceSinglePass: true,
    uniforms: { aquaTime: time },
    vertexShader: "varying vec3 vN;varying vec3 vW;varying vec2 vUv;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: `varying vec3 vN;varying vec3 vW;varying vec2 vUv;uniform float aquaTime;
      void main(){vec3 v=normalize(cameraPosition-vW);float f=pow(1.-abs(dot(normalize(vN),v)),3.);
        float streak=pow(max(0.,sin(vW.z*.45+vUv.y*7.-aquaTime*.25)),40.);
        vec3 c=mix(vec3(.55,.85,.9),vec3(.9,1.,1.),f);
        gl_FragColor=vec4(c,.03+f*.28+streak*.08);
        #include <colorspace_fragment>
      }`,
  });
  materials.push(glass);
  for (const g of [tube, cap]) {
    const m = new T.Mesh(g, glass);
    m.name = "tunnel-glass";
    m.renderOrder = 2;
    m.raycast = () => {};
    root.add(m);
  }

  // 갈비뼈 — 1.8 칸마다 금속 아치(은은히 빛나는 테)
  const metal = new T.MeshStandardMaterial({ color: 0x2c3e44, metalness: 0.8, roughness: 0.32, emissive: 0x0d3640, emissiveIntensity: 0.7 });
  materials.push(metal);
  const rib = new T.TorusGeometry(R + 0.04, 0.055, 6, 40, Math.PI);
  geometries.push(rib);
  for (let z = back; z <= front + 1e-6; z += 1.8) {
    const m = new T.Mesh(rib, metal);
    m.position.set(0, floor, z);
    m.raycast = () => {};
    root.add(m);
  }

  // 바닥 길 — 어두운 돌판 · 양옆의 푸른 빛 띠(관람객 길) · 밑동을 받치는 낮은 벽
  const walk = new T.PlaneGeometry(R * 1.7, L);
  walk.rotateX(-Math.PI / 2);
  const strip = new T.BoxGeometry(0.07, 0.05, L);
  const curb = new T.BoxGeometry(0.16, 0.34, L);
  geometries.push(walk, strip, curb);
  const stone = new T.MeshStandardMaterial({ color: 0x35505c, roughness: 0.35, metalness: 0.35, emissive: 0x0b2a33, emissiveIntensity: 0.5 });
  const glow = new T.MeshBasicMaterial({ color: 0x5fe8ff });
  materials.push(stone, glow);
  const put = (g: T.BufferGeometry, mat: T.Material, x: number, y: number) => {
    const m = new T.Mesh(g, mat);
    m.position.set(x, y, mid);
    m.raycast = () => {};
    root.add(m);
  };
  put(walk, stone, 0, floor + 0.32);
  for (const s of [-1, 1]) {
    put(strip, glow, s * R * 0.86, floor + 0.36);
    put(curb, metal, s * (R + 0.02), floor + 0.17);
  }

  return {
    root,
    animate(t) { time.value = t; },
    dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); root.removeFromParent(); },
  };
}
