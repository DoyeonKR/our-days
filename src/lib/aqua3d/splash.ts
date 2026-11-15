/** 물보라(2026-11-15) — 범고래가 수면을 박차고 나갈 때 · 다시 들어올 때(breach.ts).
 *  점 입자 한 묶음(그리기 한 번) + 수면에 퍼지는 물결 고리. 입자마다 터진 때 · 처음 자리 · 처음 속도만 두고 자리는 시각으로 계산한다(쌓이는 상태 없음).
 *  · drop — 위로 튀어 오르는 물방울(중력으로 떨어져 수면에 닿으면 사라진다)
 *  · crown — 들어갈 때 둘레로 솟는 물기둥(곧게 위로)
 *  · mist — 크고 옅은 물안개
 *  · bubble — 물속 거품(천천히 오르며 흔들리다 수면에서 터진다)
 *  ⚠ 셰이더 원문은 ASCII 만. */
import * as T from "three";

const MAX = 640;
type Kind = 0 | 1 | 2 | 3; // drop · crown · mist · bubble

export type Splash = {
  points: T.Points;
  rings: T.Group;
  /** x · z — 수면 위 자리, surface — 수면 높이, size — 몸길이, enter — 들어가는 물보라(더 크다) */
  burst(x: number, z: number, surface: number, size: number, now: number, enter: boolean, dir?: number): void;
  /** 물속 거품 줄 — 몸이 지나간 자리에 */
  trail(x: number, y: number, z: number, size: number, now: number, surface: number): void;
  step(now: number, pxScale: number): void;
  clear(): void;
  dispose(): void;
  readonly active: boolean;
};

export function makeSplash(): Splash {
  const pos = new Float32Array(MAX * 3), alpha = new Float32Array(MAX), size = new Float32Array(MAX), tone = new Float32Array(MAX);
  const t0 = new Float32Array(MAX).fill(-1e9), p0 = new Float32Array(MAX * 3), v0 = new Float32Array(MAX * 3), s0 = new Float32Array(MAX), life = new Float32Array(MAX), kind = new Uint8Array(MAX), top = new Float32Array(MAX);
  let next = 0, live = 0;
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  g.setAttribute("alpha", new T.BufferAttribute(alpha, 1));
  g.setAttribute("size", new T.BufferAttribute(size, 1));
  g.setAttribute("tone", new T.BufferAttribute(tone, 1));
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { scale: { value: 1 } }]),
    vertexShader: "#include <fog_pars_vertex>\nattribute float alpha;attribute float size;attribute float tone;uniform float scale;varying float vA;varying float vT;void main(){vA=alpha;vT=tone;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=size*scale/max(.1,-mvPosition.z);\n#include <fog_vertex>\n}",
    // tone: 0 = droplet (crisp bead with a glint), .5 = mist (soft), 1 = bubble (bright rim, clear middle)
    fragmentShader: "#include <common>\n#include <fog_pars_fragment>\nvarying float vA;varying float vT;void main(){vec2 d=(gl_PointCoord-.5)*2.;float r=length(d);if(r>1.)discard;vec2 g=d+vec2(.3,-.3);float glint=exp(-dot(g,g)*18.);float drop=(1.-smoothstep(.6,1.,r))*(.75+.25*glint);float soft=exp(-r*r*2.6)*(1.-smoothstep(.75,1.,r));float rim=smoothstep(.55,.85,r)*(1.-smoothstep(.85,1.,r))+.15*glint;float f=vT<.25?drop:vT<.75?soft:rim*1.4;vec3 c=vT<.75?vec3(.9,.97,1.)+vec3(.1)*glint:vec3(.8,.94,1.);gl_FragColor=vec4(c,vA*f);\n#include <fog_fragment>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
  const points = new T.Points(g, mat);
  points.frustumCulled = false; points.raycast = () => {}; points.renderOrder = 3;
  g.setDrawRange(0, 0);

  // 물결 고리 — 수면에 퍼지며 옅어진다(고리마다 재질 하나, 많아야 넷)
  const rings = new T.Group(), ringGeo = new T.RingGeometry(.82, 1, 48, 1);
  ringGeo.rotateX(-Math.PI / 2);
  type Ring = { m: T.Mesh; t0: number; r: number; life: number };
  let ringList: Ring[] = [];

  // 결정적인 잡음(같은 입자 번호 = 같은 흩어짐)
  const h = (i: number, k: number) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  let seq = 0;
  function add(k: Kind, now: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, sz: number, lf: number, surface: number) {
    const i = next; next = (next + 1) % MAX; live = Math.min(MAX, live + 1);
    kind[i] = k; t0[i] = now; p0[i * 3] = x; p0[i * 3 + 1] = y; p0[i * 3 + 2] = z; v0[i * 3] = vx; v0[i * 3 + 1] = vy; v0[i * 3 + 2] = vz; s0[i] = sz; life[i] = lf; top[i] = surface;
    tone[i] = k === 3 ? 1 : k === 2 ? .5 : 0;
  }
  return {
    points, rings,
    get active() { return live > 0 || ringList.length > 0; },
    burst(x, z, surface, L, now, enter, dir = 0) {
      const big = enter ? 1.35 : 1;
      // 물방울 — 둘레에서 위 · 바깥으로(가는 쪽으로 조금 더)
      const nd = enter ? 170 : 120;
      for (let n = 0; n < nd; n++) {
        const s = seq++, a = h(s, 1) * Math.PI * 2, r = (.15 + .45 * h(s, 2)) * L, up = (1.6 + 3.2 * h(s, 3)) * Math.sqrt(L) * big, out = (.5 + 1.8 * h(s, 4)) * Math.sqrt(L) * big;
        add(0, now + h(s, 5) * .12, x + Math.cos(a) * r, surface + .02, z + Math.sin(a) * r * .7, Math.cos(a) * out + dir * .8 * Math.sqrt(L), up, Math.sin(a) * out * .7, (.022 + .035 * h(s, 6)) * L, 2.4, surface);
      }
      // 물기둥 — 들어갈 때 둘레로 곧게 솟는다
      if (enter) for (let n = 0; n < 46; n++) {
        const s = seq++, a = n / 46 * Math.PI * 2 + h(s, 1) * .2, r = (.45 + .12 * h(s, 2)) * L;
        add(1, now + .05 + h(s, 3) * .1, x + Math.cos(a) * r, surface + .02, z + Math.sin(a) * r * .7, Math.cos(a) * .5, (3.4 + 2.2 * h(s, 4)) * Math.sqrt(L), Math.sin(a) * .35, (.03 + .03 * h(s, 5)) * L, 2.2, surface);
      }
      // 물안개
      for (let n = 0; n < (enter ? 22 : 16); n++) {
        const s = seq++, a = h(s, 1) * Math.PI * 2, r = h(s, 2) * .6 * L;
        add(2, now + h(s, 3) * .2, x + Math.cos(a) * r, surface + .1 + h(s, 4) * .3 * L, z + Math.sin(a) * r * .6, Math.cos(a) * .4, .5 + .8 * h(s, 5), Math.sin(a) * .3, (.16 + .18 * h(s, 6)) * L, 1.6, surface);
      }
      // 물속 거품 구름 — 들어갈 때 크게
      for (let n = 0; n < (enter ? 90 : 40); n++) {
        const s = seq++, a = h(s, 1) * Math.PI * 2, r = h(s, 2) * .7 * L, dy = (enter ? 1.6 : .5) * L * h(s, 3);
        add(3, now + h(s, 4) * .4, x + Math.cos(a) * r + dir * h(s, 6) * L * .6, surface - .1 - dy, z + Math.sin(a) * r * .6, Math.cos(a) * .25, .6 + 1.1 * h(s, 5), Math.sin(a) * .2, (.03 + .06 * h(s, 7)) * L, 3.2, surface);
      }
      // 물결 고리 둘
      for (const [delay, rr, lf] of [[0, 1.5, 2.2], [.3, .95, 1.8]] as const) {
        const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: true }));
        m.position.set(x, surface + .015, z); m.raycast = () => {}; m.renderOrder = 3; m.scale.setScalar(.01);
        rings.add(m); ringList.push({ m, t0: now + delay, r: rr * L * big, life: lf });
      }
      if (ringList.length > 6) { for (const o of ringList.splice(0, ringList.length - 6)) { o.m.removeFromParent(); (o.m.material as T.Material).dispose(); } }
    },
    trail(x, y, z, L, now, surface) {
      for (let n = 0; n < 4; n++) {
        const s = seq++;
        add(3, now + h(s, 1) * .05, x + (h(s, 2) - .5) * .3 * L, y + (h(s, 3) - .5) * .2 * L, z + (h(s, 4) - .5) * .3 * L, (h(s, 5) - .5) * .2, .5 + .8 * h(s, 6), (h(s, 7) - .5) * .2, (.025 + .045 * h(s, 8)) * L, 2.6, surface);
      }
    },
    step(now, pxScale) {
      mat.uniforms.scale.value = pxScale;
      let alive = 0, hi = 0;
      for (let i = 0; i < MAX; i++) {
        const age = now - t0[i];
        if (age < 0 && age > -1) { alpha[i] = 0; hi = i + 1; alive++; continue; }
        if (!(age >= 0) || age > life[i]) { alpha[i] = 0; size[i] = 0; continue; }
        const x0 = p0[i * 3], y0 = p0[i * 3 + 1], z0 = p0[i * 3 + 2], vx = v0[i * 3], vy = v0[i * 3 + 1], vz = v0[i * 3 + 2], k = kind[i], s = s0[i];
        let x: number, y: number, z: number, a: number, sz = s;
        if (k === 0 || k === 1) {
          // 공기 속 포물선 — 수면 아래로 떨어지면 끝(작은 물결 대신 그냥 사라진다)
          const gr = k === 1 ? 7.5 : 9.8;
          x = x0 + vx * age; z = z0 + vz * age; y = y0 + vy * age - .5 * gr * age * age;
          if (y < top[i] - .05 && age > .1) { alpha[i] = 0; size[i] = 0; continue; }
          a = Math.min(1, age * 12) * (k === 1 ? .85 : .95) * Math.max(0, 1 - age / life[i]);
          sz = s * (k === 1 ? 1 + age * .8 : 1);
        } else if (k === 2) {
          const sp = 1 - Math.exp(-age * 1.6);
          x = x0 + vx * sp; z = z0 + vz * sp; y = y0 + vy * sp * .8;
          a = Math.min(.22, age * 2) * Math.max(0, 1 - age / life[i]); sz = s * (.6 + sp * 1.2);
        } else {
          // 거품 — 오르며 빨라지고 흔들린다, 수면에서 터진다
          const rise = vy * age + .35 * age * age;
          x = x0 + vx * age + Math.sin(age * 6 + i) * .04 * s * 20; z = z0 + vz * age + Math.cos(age * 5 + i) * .03 * s * 20; y = y0 + rise;
          if (y > top[i] - .02) { alpha[i] = 0; size[i] = 0; continue; }
          a = Math.min(.9, age * 5) * Math.max(0, 1 - age / life[i]); sz = s * (1 + age * .25);
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; alpha[i] = a; size[i] = sz; alive++; hi = i + 1;
      }
      live = alive;
      g.setDrawRange(0, hi);
      (g.getAttribute("position") as T.BufferAttribute).needsUpdate = true;
      (g.getAttribute("alpha") as T.BufferAttribute).needsUpdate = true;
      (g.getAttribute("size") as T.BufferAttribute).needsUpdate = true;
      (g.getAttribute("tone") as T.BufferAttribute).needsUpdate = true;
      ringList = ringList.filter((o) => {
        const age = now - o.t0, mm = o.m.material as T.MeshBasicMaterial;
        if (age > o.life) { o.m.removeFromParent(); mm.dispose(); return false; }
        if (age < 0) { mm.opacity = 0; return true; }
        const k = age / o.life, e = 1 - (1 - k) ** 3;
        o.m.scale.set(.15 * o.r + e * o.r, 1, .15 * o.r + e * o.r);
        mm.opacity = .38 * (1 - k) * Math.min(1, age * 8);
        return true;
      });
    },
    clear() {
      t0.fill(-1e9); alpha.fill(0); size.fill(0); live = 0; g.setDrawRange(0, 0);
      for (const o of ringList) { o.m.removeFromParent(); (o.m.material as T.Material).dispose(); }
      ringList = [];
    },
    dispose() {
      this.clear(); points.removeFromParent(); rings.removeFromParent(); g.dispose(); mat.dispose(); ringGeo.dispose();
    },
  };
}
