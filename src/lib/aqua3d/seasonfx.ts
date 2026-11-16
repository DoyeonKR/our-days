/** 계절 수조 행사의 3D 그림(2026-11-13, lib/aquaevent) — 물 위 꽃잎 · 빗방울 물결 · 낙엽 · 살얼음 반짝임 · 명절 장식 빛 · 한정 장식 빛깔.
 *
 *  murk.ts 와 같은 방식: 점 한 묶음(그리기 한 번), 자리는 지을 때 한 번 정하고 떠도는 건 정점 셰이더가 물 시계(WATER_LIGHT.aquaTime)로 한다 —
 *  프레임마다 CPU 일이 없고, 움직임 줄이기면 시계가 멈춰 저절로 멈춘 그림이다(빗방울 물결은 scene 이 움직임 줄이기면 숨긴다).
 *  알의 자리 · 모양은 알 번호로만 정한다(난수 없음 — 같은 시각 = 같은 그림). 셰이더 원문은 ASCII 만(GLSL ES 1.0 — 주석 속 한글도 오류로 보는 기기가 있다).
 *  한정 장식 빛깔은 morphlook 과 같은 방법 — (원본 재질, 행사)마다 한 번 복제해 색 한 줄을 달고 같은 장식끼리 나눠 쓴다. 떼어 낼 때 지우지 않고(userData.aquaMorph) 수조를 닫을 때 한 번에. */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";
import { eventDef, type AquaEventFx, type AquaEventKey } from "../aquaevent.ts";

/** 물 위 그림 종류 — 거품(heat)은 bubbles.ts, 장식 빛(glow)은 makeDecorGlow */
export type SurfaceFx = Extract<AquaEventFx, "petal" | "rain" | "leaf" | "frost">;
const KIND: Readonly<Record<SurfaceFx, number>> = { petal: 0, rain: 1, leaf: 2, frost: 3 };
export const SURFACE_COUNT: Readonly<Record<SurfaceFx, number>> = { petal: 150, rain: 70, leaf: 90, frost: 140 };

export const SURFACE_VERT = `#include <fog_pars_vertex>
uniform float aquaTime;uniform float aquaPointScale;uniform float uTop;uniform float uBottom;uniform vec2 uHalf;
attribute float aSeed;varying float vA;varying float vSeed;varying float vPhase;
float h1(float n){return fract(sin(n*127.1+31.7)*43758.5453);}
void main(){vec3 p=position;float t=aquaTime;float s=aSeed;float size=.1;vSeed=s;vPhase=0.;vA=1.;
#if KIND==0||KIND==2
float leaf=float(KIND==2);
float per=mix(34.,46.,h1(s*3.1))+leaf*10.;
float cyc=fract(t/per+s);
float sinks=step(mix(.55,.62,leaf),h1(s*7.7));
float depth=sinks*cyc*cyc*(uTop-uBottom)*mix(.55,.8,leaf);
p.y=uTop-.05-depth+sin(t*1.3+s*40.)*.015;
p.x+=sin(t*.19+s*40.)*.55+sin(t*.07+s*9.)*.35;
p.z+=cos(t*.15+s*23.)*.4;
p.x+=sinks*sin(t*.9+s*12.)*.25*cyc;
vA=smoothstep(0.,.06,cyc)*(1.-sinks*smoothstep(.75,1.,cyc));
size=mix(.28,.4,h1(s*5.3))*(1.+leaf*.4);
vPhase=t*mix(.2,.9,h1(s*2.2))*(.3+sinks)+s*6.283;
#elif KIND==1
float per=1.7+h1(s*13.)*1.6;float k=t/per+s;float cyc=fract(k);float n=floor(k);
p.x=(h1(n*1.37+s*91.)*2.-1.)*uHalf.x;p.z=(h1(n*2.11+s*57.)*2.-1.)*uHalf.y;p.y=uTop-.02;
vPhase=cyc;vA=(1.-cyc)*smoothstep(0.,.08,cyc);
size=.25+1.1*cyc;
#else
p.y=uTop-.04-h1(s*17.)*.45;
vA=.4+.6*pow(.5+.5*sin(t*(.6+h1(s*3.)*.9)+s*30.),3.);
size=mix(.12,.24,h1(s*11.));
#endif
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
vA*=smoothstep(.3,1.4,-mvPosition.z);
gl_PointSize=vA>.003?max(1.,size*aquaPointScale/max(.1,-mvPosition.z)):0.;
#include <fog_vertex>
}`;
export const SURFACE_FRAG = `#include <common>
#include <fog_pars_fragment>
uniform vec3 uColorA;uniform vec3 uColorB;uniform vec3 uColorC;varying float vA;varying float vSeed;varying float vPhase;
void main(){vec2 d=gl_PointCoord-.5;if(vA<=0.)discard;
#if KIND==0||KIND==2
float c=cos(vPhase),sn=sin(vPhase);vec2 q=vec2(c*d.x-sn*d.y,sn*d.x+c*d.y);
#if KIND==0
float r=length(q*vec2(1.,1.75))*2.;float notch=smoothstep(.1,0.,abs(q.x))*smoothstep(.25,.5,q.y);
if(r>1.||notch>.5)discard;
vec3 col=mix(uColorA,uColorB,smoothstep(.0,.9,r));float a=vA*.85*(1.-smoothstep(.8,1.,r));
#else
float r=length(q*vec2(1.,1.35))*2.;float lobes=.75+.25*cos(atan(q.y,q.x)*5.);
if(r>lobes)discard;
float pick=fract(vSeed*7.31);vec3 col=pick<.4?uColorA:pick<.75?uColorB:uColorC;
col*=.82+.18*smoothstep(.1,0.,abs(q.x));float a=vA*.9;
#endif
#elif KIND==1
float r=length(d)*2.;float w=.1+.08*(1.-vPhase);
float ring=smoothstep(1.-w*2.,1.-w,r)*(1.-smoothstep(1.-w,1.,r));
if(ring<=.01)discard;vec3 col=uColorA;float a=ring*vA*.55;
#else
float r=length(d)*2.;float star=max(smoothstep(.16,0.,abs(d.x))*smoothstep(1.,.2,r),smoothstep(.16,0.,abs(d.y))*smoothstep(1.,.2,r));
float core=exp(-r*r*6.);float g=max(star*.7,core);if(g<.02)discard;
vec3 col=mix(uColorA,uColorB,core);float a=g*vA;
#endif
gl_FragColor=vec4(col,a);
#include <fog_fragment>
}`;

/** 물 위 그림 색 — A · B(· C) */
const COLORS: Readonly<Record<SurfaceFx, readonly number[]>> = {
  petal: [0xffe4ec, 0xf59ab5],
  rain: [0xd8f1ff],
  leaf: [0xf29a3a, 0xe8662a, 0xf2c94c],
  frost: [0xcfefff, 0xffffff],
};

export type SurfaceBox = { halfX: number; halfZ: number; bottom: number; top: number };
export type SeasonLayer = { points: T.Points; kind: SurfaceFx; dispose: () => void };

/** 물 위 그림 한 묶음 — skip: 알을 두지 않을 자리(터널 · 돔 안의 공기, murk.ts 와 같다) */
export function makeSurfaceFx(kind: SurfaceFx, box: SurfaceBox, skip?: (x: number, z: number) => boolean): SeasonLayer {
  const N = SURFACE_COUNT[kind], position = new Float32Array(N * 3), seed = new Float32Array(N);
  const u = (i: number, k: number) => (((Math.imul(i * 7919 + k * 104729 + 17, 2654435761) >>> 0) % 10007) / 10007);
  for (let i = 0; i < N; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 6; tries++) {
      x = (u(i, 1 + tries * 10) * 2 - 1) * box.halfX * .92;
      z = (u(i, 2 + tries * 10) * 2 - 1) * box.halfZ * .92;
      if (!skip?.(x, z)) break;
    }
    position[i * 3] = x; position[i * 3 + 1] = box.top; position[i * 3 + 2] = z;
    seed[i] = u(i, 3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.setAttribute("aSeed", new T.BufferAttribute(seed, 1));
  const c = COLORS[kind];
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, {
    uTop: { value: box.top }, uBottom: { value: box.bottom }, uHalf: { value: new T.Vector2(box.halfX * .92, box.halfZ * .92) },
    uColorA: { value: new T.Color(c[0]) }, uColorB: { value: new T.Color(c[1] ?? c[0]) }, uColorC: { value: new T.Color(c[2] ?? c[0]) },
  }]);
  uniforms.aquaTime = WATER_LIGHT.aquaTime; uniforms.aquaPointScale = WATER_LIGHT.aquaPointScale;
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms, defines: { KIND: KIND[kind] },
    vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG,
    ...(kind === "frost" || kind === "rain" ? { blending: T.AdditiveBlending } : {}) });
  const points = new T.Points(geometry, material);
  points.name = `season-${kind}`; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 3;
  return { points, kind, dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); } };
}

/* ── 명절 장식 빛 — 놓인 장식마다 부드러운 빛무리 하나 + 반짝임 ── */
export const GLOW_MAX = 32;
export const GLOW_VERT = `uniform float aquaTime;uniform float aquaPointScale;attribute float aSize;attribute float aSeed;varying float vA;varying float vSeed;
void main(){float t=aquaTime;vSeed=aSeed;vA=.8+.2*sin(t*1.4+aSeed*20.);
vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
gl_PointSize=aSize>0.?max(2.,aSize*aquaPointScale/max(.1,-mv.z)):0.;}`;
export const GLOW_FRAG = `uniform vec3 uColorA;uniform vec3 uColorB;varying float vA;varying float vSeed;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.)discard;
float halo=exp(-r*r*2.4)*.9+exp(-r*r*18.)*.6;float pick=step(.5,fract(vSeed*3.7));vec3 col=mix(uColorA,uColorB,pick);
gl_FragColor=vec4(col,halo*clamp(vA,.6,1.));}`;
export type DecorGlow = { points: T.Points; setSpots: (spots: readonly (readonly [number, number, number, number])[]) => void; dispose: () => void };
/** colors — 명절 빛깔 둘(행사 표의 tint · glow) */
export function makeDecorGlow(colors: readonly [number, number]): DecorGlow {
  const position = new Float32Array(GLOW_MAX * 3), size = new Float32Array(GLOW_MAX), seed = new Float32Array(GLOW_MAX);
  for (let i = 0; i < GLOW_MAX; i++) seed[i] = ((i * 0.618034) % 1);
  const geometry = new T.BufferGeometry();
  const pos = new T.BufferAttribute(position, 3), sz = new T.BufferAttribute(size, 1);
  geometry.setAttribute("position", pos); geometry.setAttribute("aSize", sz); geometry.setAttribute("aSeed", new T.BufferAttribute(seed, 1));
  geometry.setDrawRange(0, 0);
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { aquaTime: WATER_LIGHT.aquaTime, aquaPointScale: WATER_LIGHT.aquaPointScale, uColorA: { value: new T.Color(colors[0]) }, uColorB: { value: new T.Color(colors[1]) } },
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG });
  const points = new T.Points(geometry, material);
  // 투명한 것들 가운데 맨 마지막(빛줄기 3 · 해파리 갓 4 뒤)에 그린다. 빛무리는 장식 위로 올리고 크게(scene 의 spots) — 처음엔 장식 크기만 해서 장식 뒤에 가려 거의 안 보였다
  points.name = "season-glow"; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 5;
  return {
    points,
    setSpots(spots) {
      const n = Math.min(GLOW_MAX, spots.length);
      for (let i = 0; i < n; i++) { const [x, y, z, s] = spots[i]; position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z; size[i] = s; }
      pos.needsUpdate = true; sz.needsUpdate = true; geometry.setDrawRange(0, n);
    },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}

/* ── 한정 장식 빛깔 ── */
const f3 = (n: number) => n.toFixed(3);
/** 색 한 줄 — 밝기는 남기고 빛깔을 행사 색 쪽으로(반쯤) 옮긴다. 상수가 박혀 캐시 키도 행사마다 다르다 */
export function tintChunk(key: AquaEventKey): string {
  const def = eventDef(key);
  const c = new T.Color(def?.decor.tint ?? 0xffffff);
  return `
{ float tintY = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(tintY) * vec3(${f3(c.r * 1.25)}, ${f3(c.g * 1.25)}, ${f3(c.b * 1.25)}), 0.6); }
`;
}
export type DecorTints = { apply: (root: T.Object3D, key: AquaEventKey | null) => void; dispose: () => void; readonly size: number };
export function decorTints(): DecorTints {
  const cache = new Map<string, T.Material>();
  function tinted(src: T.MeshStandardMaterial, key: AquaEventKey): T.Material {
    const id = `${src.uuid}:${key}`;
    const hit = cache.get(id);
    if (hit) return hit;
    const c = src.clone();
    const prev = src.onBeforeCompile, prevKey = src.customProgramCacheKey.bind(src);
    const chunk = tintChunk(key);
    c.onBeforeCompile = (shader, r) => {
      prev.call(c, shader, r);
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>${chunk}`);
    };
    c.customProgramCacheKey = () => `${prevKey()}|etint:${key}`;
    const glow = eventDef(key)?.decor.glow;
    if (glow !== undefined) { c.emissive.setHex(glow); c.emissiveIntensity = Math.max(c.emissiveIntensity, .22); }
    c.userData = { ...c.userData, aquaMorph: `tint:${key}` };
    cache.set(id, c);
    return c;
  }
  const swap = (x: T.Material, key: AquaEventKey): T.Material => (x instanceof T.MeshStandardMaterial && !x.userData.aquaMorph ? tinted(x, key) : x);
  return {
    apply(root, key) {
      if (!key) return;
      const walk = (o: T.Object3D) => {
        if (o.userData.aquaKeep) return; // 거품
        const mesh = o as T.Mesh;
        if (mesh.isMesh && mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => swap(x, key)) : swap(mesh.material, key);
        for (const ch of o.children) walk(ch);
      };
      walk(root);
    },
    dispose() { for (const m of cache.values()) m.dispose(); cache.clear(); },
    get size() { return cache.size; },
  };
}
