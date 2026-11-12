/** 물 속 부유물(2026-11-12) — 물이 0 이어도 100 과 거의 같아 보였다(안개 색만 조금 탁해졌다). 물이 더러워질수록 떠다니는 찌꺼기 알이 늘어난다.
 *  점 한 묶음(그리기 한 번), 자리는 지을 때 한 번 정하고 떠도는 건 정점 셰이더가 물 시계(WATER_LIGHT.aquaTime)로 한다 — 프레임마다 CPU 일이 없고,
 *  움직임 줄이기면 시계가 멈춰 있어 저절로 멈춘 그림이다. 탁한 정도(0~1)가 커질수록 더 많은 알이 나타나고(알마다 나타나는 문턱이 다르다) 짙어진다.
 *  깨끗하면(0) 범위를 0 으로 둬 그리지 않는다. 셰이더 원문은 ASCII 만. */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";

export const MOTE_COUNT = 260;
export const MOTE_VERT = `#include <fog_pars_vertex>
uniform float aquaTime;uniform float aquaPointScale;uniform float uMurk;attribute float aSeed;attribute float aSize;varying float vA;
void main(){vec3 p=position;float t=aquaTime;
p.x+=sin(t*.13+aSeed*6.283)*.35;p.y+=sin(t*.09+aSeed*12.1)*.28+sin(t*.31+aSeed*3.7)*.05;p.z+=cos(t*.11+aSeed*9.3)*.3;
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
float show=smoothstep(aSeed*.85,aSeed*.85+.15,uMurk);float tw=.65+.35*sin(t*.5+aSeed*20.);
vA=show*tw*(.35+.4*uMurk)*smoothstep(.3,1.6,-mvPosition.z);
gl_PointSize=vA>.003?max(1.,aSize*aquaPointScale/max(.1,-mvPosition.z)):0.;
#include <fog_vertex>
}`;
export const MOTE_FRAG = `#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;varying float vA;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.||vA<=0.)discard;gl_FragColor=vec4(uColor,vA*exp(-r*r*3.));
#include <fog_fragment>
}`;

export type Motes = { points: T.Points; setMurk: (murk: number) => void; dispose: () => void };
/** 수조 안 상자 — 가로 반폭 · 앞뒤 반폭(월드) · 바닥 · 수면 높이. skip — 알을 두지 않을 자리(터널 · 돔 안의 공기), 걸리면 다른 자리를 몇 번 더 뽑는다 */
export function makeMotes(box: { halfX: number; halfZ: number; bottom: number; top: number }, skip?: (x: number, y: number, z: number) => boolean): Motes {
  const N = MOTE_COUNT, position = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  const u = (i: number, k: number) => (((Math.imul(i * 7919 + k * 104729 + 13, 2654435761) >>> 0) % 10007) / 10007);
  for (let i = 0; i < N; i++) {
    let x = 0, y = 0, z = 0;
    for (let tries = 0; tries < 6; tries++) {
      x = (u(i, 1 + tries * 10) * 2 - 1) * box.halfX;
      // 아래쪽에 조금 더 많이 — 찌꺼기는 바닥 쪽에 고인다
      y = box.bottom + (box.top - box.bottom) * Math.pow(u(i, 2 + tries * 10), 1.35);
      z = (u(i, 3 + tries * 10) * 2 - 1) * box.halfZ;
      if (!skip?.(x, y, z)) break;
      // 여섯 번 다 걸리면 수면 가까이로(공기 속엔 두지 않는다)
      if (tries === 5) y = box.top;
    }
    position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
    seed[i] = u(i, 4);
    size[i] = 0.05 + 0.09 * u(i, 5) ** 2;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.setAttribute("aSeed", new T.BufferAttribute(seed, 1));
  geometry.setAttribute("aSize", new T.BufferAttribute(size, 1));
  geometry.setDrawRange(0, 0);
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { uMurk: { value: 0 }, uColor: { value: new T.Color(0.34, 0.36, 0.2) } }]);
  uniforms.aquaTime = WATER_LIGHT.aquaTime; uniforms.aquaPointScale = WATER_LIGHT.aquaPointScale;
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG });
  const points = new T.Points(geometry, material);
  points.name = "water-motes"; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 2;
  return {
    points,
    setMurk(m) { uniforms.uMurk.value = m; geometry.setDrawRange(0, m > 0.005 ? N : 0); },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
