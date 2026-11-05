/* 거품 (2026-11-05) — 점 입자 한 묶음 = 그리기 한 번. 예전엔 공 모양 메시 36개(인스턴스)를 CPU 가 매 프레임 옮겨 올렸고,
 * 장식 거품은 장식마다 또 공 12개였다. 이제 위치는 셰이더가 시간으로 계산한다(매 프레임 GPU 로 올리는 것은 시간 하나).
 * 올라가며 좌우로 흔들리고, 수면(top)에 닿으면 살짝 부풀었다가 톡 사라진다. */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";

const rand = (n: number) => { const x = Math.sin(n * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x); };

export type BubbleOptions = {
  count: number;
  /** i 번째 거품이 올라오는 자리(x, z) */
  origin: (i: number) => readonly [number, number];
  bottom: number;
  top: number;
  /** 지름(world) 범위 */
  size: readonly [number, number];
  /** 초당 오르는 거리 범위 */
  speed: readonly [number, number];
  color?: number;
  opacity?: number;
  wobble?: number;
  seed?: number;
};
export type BubbleStream = { points: T.Points; update: (seconds: number) => void };

export function bubbleStream(o: BubbleOptions): BubbleStream {
  const n = o.count, seed = o.seed ?? 1;
  const position = new Float32Array(n * 3), data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const [x, z] = o.origin(i);
    position.set([x, o.bottom, z], i * 3);
    data.set([
      o.speed[0] + rand(i + seed * 13) * (o.speed[1] - o.speed[0]),
      o.size[0] + rand(i * 1.7 + seed * 29) ** 2 * (o.size[1] - o.size[0]),
      rand(i * 3.1 + seed * 7),
      rand(i * 5.3 + seed) * 6.283,
    ], i * 4);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.setAttribute("aBubble", new T.BufferAttribute(data, 4));
  const time = { value: 0 };
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: time, uBottom: { value: o.bottom }, uTop: { value: o.top }, uWobble: { value: o.wobble ?? .06 },
      uColor: { value: new T.Color(o.color ?? 0xcfeee6) }, uOpacity: { value: o.opacity ?? .55 }, aquaPointScale: WATER_LIGHT.aquaPointScale },
    vertexShader: `uniform float uTime,uBottom,uTop,uWobble,aquaPointScale;attribute vec4 aBubble;varying float vFade;
      void main(){float span=uTop-uBottom;float t=fract(aBubble.z+uTime*aBubble.x/span);vec3 p=position;p.y=uBottom+t*span;
        float rise=t*span;p.x+=sin(rise*3.1+aBubble.w)*uWobble*(.35+t);p.z+=cos(rise*2.7+aBubble.w*1.7)*uWobble*.8*(.35+t);
        float pop=smoothstep(.955,1.,t);vFade=smoothstep(0.,.03,t)*(1.-pop);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.5,aBubble.y*(1.+t*.3)*(1.+pop*1.4)*aquaPointScale/max(.1,-mv.z));}`,
    fragmentShader: `uniform vec3 uColor;uniform float uOpacity;varying float vFade;
      void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.)discard;
        float ring=smoothstep(.5,.92,r)*(1.-smoothstep(.92,1.,r));float glint=smoothstep(.32,0.,length(d-vec2(-.17,-.17)));
        gl_FragColor=vec4(uColor+glint*.35,(ring*.75+.12+glint*.8)*uOpacity*vFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  // 위치는 셰이더가 정한다 — CPU 좌표로 누르기 판정을 하면 엉뚱한 곳이 걸린다
  points.raycast = () => {};
  points.userData.aquaKeep = true;
  return { points, update: (seconds) => { time.value = seconds; } };
}
