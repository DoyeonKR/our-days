/** 물 속 부유물(2026-11-12) — 물이 0 이어도 100 과 거의 같아 보였다(안개 색만 조금 탁해졌다). 물이 더러워질수록 떠다니는 찌꺼기 알이 늘어난다.
 *  점 한 묶음(그리기 한 번), 자리는 지을 때 한 번 정하고 떠도는 건 정점 셰이더가 물 시계(WATER_LIGHT.aquaTime)로 한다 — 프레임마다 CPU 일이 없고,
 *  움직임 줄이기면 시계가 멈춰 있어 저절로 멈춘 그림이다. 셰이더 원문은 ASCII 만.
 *  2026-11-20 [사용자: "수조도 실제 물이 움직이는 것과 같이 반영해야해"] — 예전엔 맑은 물(평소)엔 알이 하나도 없고, 탁할 때도 알마다 제자리에서만 흔들려
 *  물이 멈춘 그림처럼 보였다. 이제 ① 맑은 물에도 옅은 미세 입자(MOTE_CLEAR 몫)가 떠 있고 위쪽일수록 빛을 받아 반짝인다 ② 모든 알이 수조 하나의 물살(MOTE_FLOW_GLSL —
 *  가로로 흐르며 세졌다 약해진다)에 실려 흘러가고, 자리마다 다른 작은 소용돌이가 겹친다 ③ 수조 끝에 닿으면 반대편에서 다시 들어온다(끝 가까이에서 흐려져 순간 이동이 안 보인다).
 *  터널 · 돔(공기 방이 있다)은 흘러가면 공기 속으로 들어가므로 예전처럼 제자리 흔들림만(uFlow 0). 탁할수록 알이 늘고 초록 갈색으로 짙어진다. */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";

export const MOTE_COUNT = 320;
/** 맑은 물에도 보이는 몫(알의 앞쪽 이만큼) — 나머지는 탁할수록 나타난다 */
export const MOTE_CLEAR = 0.4;
/** 물살 — 시각 t 까지 흘러간 거리(월드). 늘 한쪽(+x)으로 가되 세졌다 약해진다(돌아 흐르지 않는다: 미분 0.11 - 0.0455 - 0.0475 > 0). CPU 짝 moteFlow */
export const MOTE_FLOW_GLSL = "float moteFlow(float t){return .11*t+.65*sin(t*.07)+.25*sin(t*.19+1.3);}";
export function moteFlow(t: number): number { return 0.11 * t + 0.65 * Math.sin(t * 0.07) + 0.25 * Math.sin(t * 0.19 + 1.3); }
export const MOTE_VERT = `#include <fog_pars_vertex>
uniform float aquaTime;uniform float aquaPointScale;uniform float uMurk;uniform float uFlow;uniform vec4 uBox;attribute float aSeed;attribute float aSize;varying float vA;varying float vLit;
${MOTE_FLOW_GLSL}
void main(){vec3 p=position;float t=aquaTime;float w=uBox.y-uBox.x;
float sp=.6+.8*fract(aSeed*7.13);
p.x+=uFlow*moteFlow(t)*sp;
float edge=1.;if(uFlow>.5){float u=fract((p.x-uBox.x)/w);p.x=uBox.x+u*w;edge=smoothstep(0.,.06,u)*smoothstep(1.,.94,u);}
p.y+=sin(p.x*.9+t*.37+aSeed*6.283)*.14+sin(t*.09+aSeed*12.1)*.22-uFlow*.012*fract(t*.004+aSeed)*(uBox.w-uBox.z);
p.z+=cos(p.x*.7-t*.29+aSeed*9.3)*.22+cos(t*.11+aSeed*9.3)*.18;
p.x+=sin(p.y*1.1+t*.41+aSeed*4.)*.12;
p.y=clamp(p.y,uBox.z,uBox.w);
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
float clear=step(aSeed,${MOTE_CLEAR.toFixed(2)});float show=max(clear*.8,smoothstep(aSeed*.85,aSeed*.85+.15,uMurk));float tw=.65+.35*sin(t*.5+aSeed*20.);
vLit=smoothstep(uBox.z,uBox.w,p.y)*(1.-uMurk);
vA=show*tw*edge*(.28+.47*uMurk+.12*vLit)*smoothstep(.3,1.6,-mvPosition.z);
gl_PointSize=vA>.003?max(1.,aSize*(1.-.15*clear*(1.-uMurk))*aquaPointScale/max(.1,-mvPosition.z)):0.;
#include <fog_vertex>
}`;
export const MOTE_FRAG = `#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;uniform vec3 uClear;uniform float uMurk;varying float vA;varying float vLit;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.||vA<=0.)discard;vec3 c=mix(uClear*(1.+.6*vLit),uColor,smoothstep(0.,.5,uMurk));gl_FragColor=vec4(c,vA*exp(-r*r*3.));
#include <fog_fragment>
}`;

export type Motes = { points: T.Points; setMurk: (murk: number) => void; dispose: () => void };
/** 수조 안 상자 — 가로 반폭 · 앞뒤 반폭(월드) · 바닥 · 수면 높이. skip — 알을 두지 않을 자리(터널 · 돔 안의 공기), 걸리면 다른 자리를 몇 번 더 뽑는다 */
export function makeMotes(box: { halfX: number; halfZ: number; bottom: number; top: number }, skip?: (x: number, y: number, z: number) => boolean): Motes {
  // 공기 방이 있는 수조(skip 이 있다)는 물살에 싣지 않는다 — 흘러가면 공기 속으로 들어간다
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
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { uMurk: { value: 0 }, uColor: { value: new T.Color(0.34, 0.36, 0.2) }, uClear: { value: new T.Color(0.62, 0.74, 0.72) },
    uFlow: { value: skip ? 0 : 1 }, uBox: { value: new T.Vector4(-box.halfX, box.halfX, box.bottom, box.top) } }]);
  uniforms.aquaTime = WATER_LIGHT.aquaTime; uniforms.aquaPointScale = WATER_LIGHT.aquaPointScale;
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG });
  const points = new T.Points(geometry, material);
  points.name = "water-motes"; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 2;
  return {
    points,
    setMurk(m) { uniforms.uMurk.value = m; },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
