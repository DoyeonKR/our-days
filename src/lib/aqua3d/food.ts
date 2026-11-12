/** 먹이 알갱이(2026-11-12) — '먹이 주기'를 눌러도 물고기만 수면으로 몰릴 뿐 먹이는 보이지 않았다(scene.feed 는 길 함수의 motion.feed 만 남겼다).
 *  물고기가 모이는 자리(habits 의 먹이 둘레 — 가로 feed.x ± 0.8 · 앞뒤 ± 0.9 × 깊이)에 점 한 묶음(그리기 한 번)을 뿌린다.
 *  - 얇은 조각(70%)은 수면 가까이에서 팔랑이며 아주 천천히 가라앉는다 — 헤엄치는 물고기가 0.2 ~ 8초 동안 수면에서 먹는다.
 *  - 알갱이(30%)는 5.5 ~ 8초에 모래까지 가라앉는다 — 바닥 물고기는 4.2초 뒤부터 바닥에서 먹는다(habits.feedWeight).
 *  - 먹이 창(FOOD_LIFE = habits 의 FEED_END 16초) 끝 3.5초 동안 옅어지고, 물고기 입(머리 앞 0.45 L) 가까이(0.3 L)에 닿은 알은 먹혀 사라진다.
 *  프레임마다 새 객체 · 배열을 만들지 않는다. 셰이더 원문은 ASCII 만(설명은 여기 TS 주석에). */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";

export const FOOD_COUNT = 56;
/** 먹이 창 — habits.ts 의 FEED_END 와 같은 값(물고기가 먹이 쪽으로 오가는 시간) */
export const FOOD_LIFE = 16;
/** 움직임 줄이기 — 시계가 멈춰 있어 한 장면으로만 그린다(이 나이의 모습) */
export const FOOD_STILL_AGE = 2.4;
/** 먹힘 — 입에서 이 거리(몸길이 배) 안이면 먹는다. 아주 작은 물고기도 먹게 바닥값 */
export const EAT_REACH = 0.3, EAT_MIN = 0.12, MOUTH_AHEAD = 0.45;

export const FOOD_VERT = `#include <fog_pars_vertex>
uniform float aquaPointScale;attribute float aAlpha;attribute float aSize;attribute float aTone;varying float vA;varying float vT;
void main(){vA=aAlpha;vT=aTone;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
gl_PointSize=aAlpha>0.?max(1.5,aSize*aquaPointScale/max(.1,-mvPosition.z)):0.;
#include <fog_vertex>
}`;
export const FOOD_FRAG = `#include <common>
#include <fog_pars_fragment>
uniform vec3 cA;uniform vec3 cB;varying float vA;varying float vT;
void main(){vec2 d=gl_PointCoord-.5;d.y*=1.4;float r=length(d)*2.;if(r>1.||vA<=0.)discard;
float f=smoothstep(1.,.62,r);vec3 col=mix(cA,cB,vT)*(.8+.35*(1.-r));gl_FragColor=vec4(col,vA*f);
#include <fog_fragment>
}`;

/** 물고기 쪽 값 — scene 의 motion 그대로(위치 · 머리 방향 · 몸길이 · 이번 프레임 길의 먹이 반응) */
export type FoodFish = { positions: ArrayLike<number>; heading: ArrayLike<number>; lengths: ArrayLike<number>; courses: readonly { feed?: number }[]; count: number };
/** 뿌릴 때의 수조 — 수면 높이(월드) · 앞뒤 깊이 배율 · 그 자리의 바닥 높이(모래 · 터널 · 돔 유리 위) */
export type FoodWorld = { top: number; deep: number; floorAt: (x: number, z: number) => number };
export type Food = {
  points: T.Points;
  /** 먹이를 뿌린다(t0 = 수조 시계) — 앞의 것은 거둔다(한 묶음) */
  drop: (t0: number, x: number, w: FoodWorld) => void;
  /** 한 프레임 — still 이면 움직이지 않는 한 장면(먹지도 않는다). 남은 알 수 */
  step: (now: number, dt: number, fish: FoodFish, still: boolean) => number;
  clear: () => void;
  dispose: () => void;
};

/** 알 번호 · 뿌린 횟수로 정해진 0~1 값(난수 없음 — 같은 먹이는 같은 모습) */
const hash = (i: number, k: number, n: number) => (((Math.imul(i * 92821 + k * 68917 + n * 1013 + 7, 2654435761) >>> 0) % 10007) / 10007);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeFood(): Food {
  const N = FOOD_COUNT;
  const position = new Float32Array(N * 3), alpha = new Float32Array(N), size = new Float32Array(N), tone = new Float32Array(N);
  // 알마다 뿌릴 때 정하는 값 — 퍼질 자리(x · z) · 가라앉는 빠르기 · 팔랑임 박자 · 바닥 높이 · 알갱이인가 · 먹힌 때(−1 = 아직)
  const ox = new Float32Array(N), oz = new Float32Array(N), sink = new Float32Array(N), ph = new Float32Array(N), floorY = new Float32Array(N), pellet = new Uint8Array(N), eatenAt = new Float32Array(N), base = new Float32Array(N);
  const geometry = new T.BufferGeometry();
  const pos = new T.BufferAttribute(position, 3), al = new T.BufferAttribute(alpha, 1), sz = new T.BufferAttribute(size, 1), tn = new T.BufferAttribute(tone, 1);
  pos.setUsage(T.DynamicDrawUsage); al.setUsage(T.DynamicDrawUsage); sz.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position", pos); geometry.setAttribute("aAlpha", al); geometry.setAttribute("aSize", sz); geometry.setAttribute("aTone", tn);
  // 빈 동안엔 그리지 않는다(그리기 호출 0) — 보이지 않게 숨기지 않고 범위만 0 으로 둬서 수조를 열 때 셰이더를 미리 짓는다(첫 먹이에 멈칫하지 않게)
  geometry.setDrawRange(0, 0);
  // 주황 · 갈색 먹이 — 빛을 받지 않는 점이라 물빛보다 너무 밝지 않게 낮춰 둔다(장면 그림은 HDR, 노출 1.3)
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { cA: { value: new T.Color(0.42, 0.15, 0.05) }, cB: { value: new T.Color(0.58, 0.4, 0.14) } }]);
  uniforms.aquaPointScale = WATER_LIGHT.aquaPointScale;
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms, vertexShader: FOOD_VERT, fragmentShader: FOOD_FRAG });
  const points = new T.Points(geometry, material);
  points.name = "fish-food"; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 2;
  let t0 = 0, top = 0, cx = 0, live = 0, drops = 0, wallAt = 0;
  /** 이번 프레임에 이미 먹은 물고기 — 물고기 수가 늘 때만 다시 만든다 */
  let ate = new Uint8Array(64);

  function clear() { live = 0; alpha.fill(0); al.needsUpdate = true; geometry.setDrawRange(0, 0); }
  function drop(start: number, x: number, w: FoodWorld) {
    drops++; t0 = start; top = w.top; cx = x; live = N; wallAt = typeof performance !== "undefined" ? performance.now() : 0;
    for (let i = 0; i < N; i++) {
      const h1 = hash(i, 1, drops), h2 = hash(i, 2, drops), h3 = hash(i, 3, drops), h4 = hash(i, 4, drops);
      // 물고기가 맴도는 자리와 같은 넓이 — 가로 ±0.9 · 앞뒤 ±0.9 × 깊이(타원 안에 고르게)
      const a = h1 * Math.PI * 2, r = Math.sqrt(h2);
      ox[i] = Math.cos(a) * r * 0.95; oz[i] = Math.sin(a) * r * 0.9 * w.deep;
      pellet[i] = h3 < 0.3 ? 1 : 0;
      floorY[i] = w.floorAt(cx + ox[i], oz[i]) + 0.03;
      // 알갱이는 5.5 ~ 8초에 바닥(0.8초 떠 있다가) · 조각은 초당 0.07 ~ 0.2(16초에 1 ~ 3 내려간다)
      sink[i] = pellet[i] ? Math.max(0.2, (top - floorY[i]) / (4.7 + 2.5 * h4)) : 0.07 + 0.13 * h4;
      ph[i] = h4 * 6.283;
      // 점 크기(월드) — 수조 전체에서 보는 거리(약 20)에서 2~4 픽셀이 되게. 실제 먹이보다 조금 크다(안 보이면 없는 것과 같다)
      base[i] = pellet[i] ? 0.11 + 0.04 * h1 : 0.14 + 0.08 * h2;
      tone[i] = pellet[i] ? 0.15 + 0.3 * h2 : 0.45 + 0.55 * h1;
      eatenAt[i] = -1;
    }
    tn.needsUpdate = true; geometry.setDrawRange(0, N);
  }
  function step(now: number, dt: number, fish: FoodFish, still: boolean) {
    if (!live) return 0;
    let age = now - t0;
    if (still) {
      // 움직임 줄이기 — 시계가 멈춰 있다. 한 장면으로 두고, 먹이 창이 지나면(벽시계) 거둔다
      age = FOOD_STILL_AGE;
      if (typeof performance !== "undefined" && performance.now() - wallAt > FOOD_LIFE * 1000) { clear(); return 0; }
    }
    if (age < 0 || age >= FOOD_LIFE) { clear(); return 0; }
    const fadeIn = Math.min(1, age * 5), fadeOut = 1 - smooth(FOOD_LIFE - 3.5, FOOD_LIFE, age), spread = 1 - Math.exp(-age * 2.2);
    let alive = 0;
    if (ate.length < fish.count) ate = new Uint8Array(fish.count * 2);
    ate.fill(0);
    for (let i = 0; i < N; i++) {
      if (eatenAt[i] >= 0 && age - eatenAt[i] > 0.18) { alpha[i] = 0; continue; }
      // 처음 0.8초는 수면에 떠 있다가 가라앉기 시작한다
      const fall = sink[i] * Math.max(0, age - 0.8);
      let y = top - 0.05 - fall;
      const landed = y <= floorY[i];
      if (landed) y = floorY[i];
      // 팔랑임 — 조각은 좌우로 크게 흔들리며 뒤집혀(점 크기가 숨 쉬듯), 알갱이는 조금만
      const flut = landed ? 0 : pellet[i] ? 0.25 : 1;
      const x = cx + ox[i] * spread + Math.sin(age * 1.9 + ph[i]) * 0.07 * flut, z = oz[i] * spread + Math.cos(age * 1.4 + ph[i] * 1.3) * 0.05 * flut;
      position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
      let s = base[i] * (pellet[i] ? 1 : 0.72 + 0.28 * Math.abs(Math.sin(age * 2.6 + ph[i])));
      let a = 0.95 * fadeIn * fadeOut;
      if (eatenAt[i] >= 0) { const k = 1 - (age - eatenAt[i]) / 0.18; s *= k; a *= k; }
      else if (!still && dt > 0 && age > 0.5) {
        // 먹힘 — 먹이 쪽으로 온 물고기(course.feed)의 입 가까이. 한 물고기는 한 프레임에 하나만
        for (let j = 0; j < fish.count; j++) {
          if (ate[j] || (fish.courses[j]?.feed ?? 0) < 0.2) continue;
          const L = fish.lengths[j], hx = fish.heading[j * 3], hy = fish.heading[j * 3 + 1], hz = fish.heading[j * 3 + 2], hl = Math.hypot(hx, hy, hz) || 1;
          const mx = fish.positions[j * 3] + (hx / hl) * L * MOUTH_AHEAD, my = fish.positions[j * 3 + 1] + (hy / hl) * L * MOUTH_AHEAD, mz = fish.positions[j * 3 + 2] + (hz / hl) * L * MOUTH_AHEAD;
          const r = Math.max(EAT_MIN, L * EAT_REACH), dx = x - mx, dy = y - my, dz = z - mz;
          if (dx * dx + dy * dy + dz * dz < r * r) { eatenAt[i] = age; ate[j] = 1; break; }
        }
      }
      alpha[i] = a; size[i] = s;
      if (a > 0) alive++;
    }
    pos.needsUpdate = true; al.needsUpdate = true; sz.needsUpdate = true;
    if (!alive && age > 1) clear();
    return alive;
  }
  return { points, drop, step, clear, dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); } };
}
