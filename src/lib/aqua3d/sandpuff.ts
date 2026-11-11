/** 모래 먼지(2026-11-11) — 바닥에서 쉬던 물고기(광어 · 가오리 · 문어 …)가 옮겨 갔다 내려앉으면 모래가 살짝 피어올랐다 가라앉는다.
 *  길 함수가 내려앉은 뒤 지난 초(course.puff)를 이미 주고 있었는데 아무도 안 그렸다. 점 입자 한 묶음(그리기 한 번), 먼지 6 개 × 10 알 = 60 알을 돌려 쓴다.
 *  알의 자리는 (물고기 칸 · 알 번호 · 지난 초)만으로 정한다 — 난수 없음, 같은 시각 = 같은 모습. 움직임 줄이기면 안 그린다. */
import * as T from "three";
import { WATER_LIGHT } from "./waterlight.ts";
import type { Course } from "./habits.ts";

const SLOTS = 6, GRAINS = 10, LIFE = 1.6;
export type SandPuffs = { points: T.Points; update: (courses: readonly Course[], positions: ArrayLike<number>, lengths: ArrayLike<number>, count: number, still: boolean) => void };

export function makeSandPuffs(heightAt: (x: number, z: number) => number): SandPuffs {
  const n = SLOTS * GRAINS, position = new Float32Array(n * 3), alpha = new Float32Array(n), size = new Float32Array(n);
  const geometry = new T.BufferGeometry();
  const pos = new T.BufferAttribute(position, 3), al = new T.BufferAttribute(alpha, 1), sz = new T.BufferAttribute(size, 1);
  pos.setUsage(T.DynamicDrawUsage); al.setUsage(T.DynamicDrawUsage); sz.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position", pos); geometry.setAttribute("aAlpha", al); geometry.setAttribute("aSize", sz);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { aquaPointScale: WATER_LIGHT.aquaPointScale, uColor: { value: new T.Color(0xd8c9a4) } },
    vertexShader: `uniform float aquaPointScale;attribute float aAlpha;attribute float aSize;varying float vA;
      void main(){vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aAlpha>0.?max(1.,aSize*aquaPointScale/max(.1,-mv.z)):0.;}`,
    fragmentShader: `uniform vec3 uColor;varying float vA;
      void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.||vA<=0.)discard;gl_FragColor=vec4(uColor,vA*(1.-r*r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new T.Points(geometry, material);
  points.name = "sand-puffs"; points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 2;
  const pick = new Int32Array(SLOTS), age = new Float32Array(SLOTS);
  function update(courses: readonly Course[], positions: ArrayLike<number>, lengths: ArrayLike<number>, count: number, still: boolean) {
    points.visible = !still;
    if (still) return;
    // 막 내려앉은 바닥 물고기 중 가장 최근 것부터 여섯
    let m = 0;
    for (let k = 0; k < count; k++) {
      const c = courses[k];
      if (c.puff < 0 || c.puff >= LIFE || c.ground < 0.99) continue;
      if (m < SLOTS) { pick[m] = k; age[m] = c.puff; m++; continue; }
      let old = 0; for (let s = 1; s < SLOTS; s++) if (age[s] > age[old]) old = s;
      if (c.puff < age[old]) { pick[old] = k; age[old] = c.puff; }
    }
    for (let s = 0; s < SLOTS; s++) for (let g = 0; g < GRAINS; g++) {
      const i = s * GRAINS + g;
      if (s >= m) { alpha[i] = 0; continue; }
      const k = pick[s], a = age[s], L = lengths[k], x = positions[k * 3], z = positions[k * 3 + 2];
      // 알마다 정해진 방향 · 빠르기 — 몸 둘레로 퍼지며 조금 떠올랐다 가라앉는다
      const th = g * 2.399 + k * 1.7, sp = 0.55 + 0.45 * ((g * 7 + k * 3) % 5) / 4, out = 1 - Math.exp(-2.6 * a);
      const r = L * (0.22 + 0.42 * sp * out), rise = Math.max(0.02, L * 0.14 * sp * out - 0.08 * a * a);
      const px = x + Math.cos(th) * r, pz = z + Math.sin(th) * r * 0.8;
      position[i * 3] = px; position[i * 3 + 1] = heightAt(px, pz) + rise; position[i * 3 + 2] = pz;
      const fade = 1 - a / LIFE;
      alpha[i] = 0.5 * fade * fade * Math.min(1, a * 8);
      size[i] = (0.05 + 0.05 * sp) * Math.min(2, L) * (1 + a * 0.6);
    }
    pos.needsUpdate = true; al.needsUpdate = true; sz.needsUpdate = true;
  }
  return { points, update };
}
