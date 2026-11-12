import * as T from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD, clamp } from "./world.ts";
import { asset } from "../base.ts";
import { CAUSTIC_GLSL, WATER_LIGHT } from "./waterlight.ts";
import { bubbleStream } from "./bubbles.ts";

type Theme = { water: number; top: number; sand: number; rock: number; foliage: number; accent: number; density: number; wood: boolean };
export const HABITAT_THEMES: readonly Theme[] = [
  { water: 0x174b50, top: 0x448b88, sand: 0xb6aa87, rock: 0x6e7766, foliage: 0x598245, accent: 0x8c9953, density: 38, wood: false },
  { water: 0x103c3b, top: 0x477e62, sand: 0xc6b88d, rock: 0x4d6356, foliage: 0x426e35, accent: 0x9c654d, density: 95, wood: false },
  { water: 0x173b3d, top: 0x527b6c, sand: 0xab9d76, rock: 0x5a6053, foliage: 0x51784a, accent: 0x899454, density: 70, wood: true },
  { water: 0x103d50, top: 0x4a8d92, sand: 0xc8c5a8, rock: 0x55626a, foliage: 0x426a42, accent: 0x5d7a44, density: 70, wood: false },
  { water: 0x0c273f, top: 0x286579, sand: 0x777e7e, rock: 0x364b57, foliage: 0x3b7371, accent: 0x648ca1, density: 64, wood: false },
  { water: 0x103e48, top: 0x3b8580, sand: 0xb7b293, rock: 0x7e8971, foliage: 0x427c68, accent: 0xa7aa69, density: 68, wood: true },
  { water: 0x1d4a66, top: 0x5aa0b8, sand: 0xd8b9a0, rock: 0x7a5a5a, foliage: 0xd0705e, accent: 0xf0a070, density: 110, wood: false },
  { water: 0x081f3a, top: 0x1e4f7e, sand: 0x6f7f8e, rock: 0x2c3e50, foliage: 0x2b8f8a, accent: 0x5fe0d0, density: 90, wood: false },
  { water: 0x2a2263, top: 0x7a6bd6, sand: 0xd9cfe8, rock: 0x6a5f96, foliage: 0xa98be0, accent: 0xf2d27a, density: 120, wood: false },
  // 10 해저 터널 · 11 심연 돔 궁전(2026-11-11) — 그림은 9단계 것을 쓰고(배경 그림 파일은 9장뿐) 물빛만 다르다
  { water: 0x0a3550, top: 0x3f8fb0, sand: 0xcfc7ad, rock: 0x4b5c66, foliage: 0x3f8a7a, accent: 0x7fe3ff, density: 120, wood: false },
  { water: 0x06132e, top: 0x274d8f, sand: 0x8e8aa6, rock: 0x3a3a5c, foliage: 0x5f4fb0, accent: 0xffd77a, density: 130, wood: false },
];
/** 배경 그림 파일은 9장 — 그 위 단계는 9 를 쓴다 */
export const TANK_ART_MAX = 9;
const random = (n: number) => { const x = Math.sin(n * 127.13 + 31.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** The center remains low and open; planting banks rise at the sides/back. */
export function substrateHeight(x: number, z: number, tier: number): number {
  const bank = smooth(2.3, 4.8, Math.abs(x)) * (.19 + .05 * clamp(tier, 1, 6));
  const back = smooth(.5, 2.9, -z) * (.14 + .05 * tier);
  return WORLD.floor + .025 + bank + back + .012 * Math.sin(x * 3 + z) * Math.sin(z * 4);
}

/** 이음새 없는 값 잡음(0~1) — 타일이 반복돼도 줄이 안 보인다 */
function tileNoise(u: number, v: number, cells: number, seed: number): number {
  const x = u * cells, y = v * cells, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (i: number, j: number) => random(((i + cells) % cells) + ((j + cells) % cells) * cells * 1.37 + seed * 91.7);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
}

/** 텍스처 픽셀은 모듈에 한 번만 굽는다 — 탭을 오갈 때마다 수조가 새로 열리며 512² 잡음을 다시 계산했다(2026-11-05).
 *  텍스처 객체는 매번 새로 만든다(수조를 닫으면 지우므로). 같은 배열을 여러 텍스처가 읽기만 한다. */
const pixelCache = new Map<string, { color: Uint8Array; height: Uint8Array }>();
function cachedPixels(key: string, bake: () => { color: Uint8Array; height: Uint8Array }) {
  let px = pixelCache.get(key);
  if (!px) { px = bake(); pixelCache.set(key, px); }
  return px;
}
function dataMaps(px: { color: Uint8Array; height: Uint8Array }, size: number) {
  const map = new T.DataTexture(px.color, size, size), bump = new T.DataTexture(px.height, size, size);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; }
  return { map, bump };
}

/** 모래 — 잔물결 · 색이 다른 낟알 · 작은 조약돌과 조개 조각. 회색 잡음 한 겹이면 시멘트처럼 보였다 */
export function sandMap(size = 512) {
  return dataMaps(cachedPixels(`sand/${size}`, () => bakeSand(size)), size);
}
function bakeSand(size: number) {
  const color = new Uint8Array(size * size * 4), height = new Uint8Array(color.length);
  const hs = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, grain = random(x + y * size), fine = random(x * 3.1 + y * size * 1.7 + 11);
    const patch = tileNoise(u, v, 5, 1) * .6 + tileNoise(u, v, 13, 2) * .4;
    const ripple = Math.sin((v * 9 + tileNoise(u, v, 4, 3) * 2.4) * Math.PI * 2) * .5 + .5;
    const tone = .63 + patch * .2 + ripple * .1 + (grain - .5) * .26;
    // 낟알마다 살짝 다른 색 — 따뜻한 석영 · 푸른 회색 · 짙은 광물
    const warm = fine - .5, dark = grain < .028 ? .46 : 1, bright = grain > .988 ? 1.24 : 1;
    const i = (y * size + x) * 4;
    color[i] = clamp(tone * (1 + warm * .14) * dark * bright, 0, 1) * 255;
    color[i + 1] = clamp(tone * (1 + warm * .03) * dark * bright, 0, 1) * 255;
    color[i + 2] = clamp(tone * (1 - warm * .16) * .95 * dark * bright, 0, 1) * 255;
    color[i + 3] = 255;
    hs[y * size + x] = ripple * .34 + grain * .22 + patch * .14;
  }
  // 작은 돌 · 조개 조각 — 타일 경계를 넘어가도 이어지게 감는다
  for (let n = 0; n < 150; n++) {
    const cx = random(n * 3.3 + 5) * size, cy = random(n * 7.7 + 9) * size, r = 2 + random(n + 3) ** 2 * 7, flat = .6 + random(n + 21) * .4;
    const shade = .34 + random(n * 1.9 + 2) * .62, tint = random(n + 77) - .5, rot = random(n + 15) * 6.28, cos = Math.cos(rot), sin = Math.sin(rot);
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const a = (dx * cos + dy * sin) / r, b = (dy * cos - dx * sin) / (r * flat), d = a * a + b * b;
      if (d > 1) continue;
      const px = (Math.round(cx) + dx + size) % size, py = (Math.round(cy) + dy + size) % size, i = (py * size + px) * 4;
      const dome = Math.sqrt(1 - d), lit = shade * (.68 + dome * .4 + (b < 0 ? .1 : -.07));
      color[i] = clamp(lit * (1 + tint * .25), 0, 1) * 255; color[i + 1] = clamp(lit, 0, 1) * 255; color[i + 2] = clamp(lit * (1 - tint * .25), 0, 1) * 255;
      hs[py * size + px] = .5 + dome * .5;
    }
  }
  for (let k = 0; k < hs.length; k++) { const i = k * 4; height[i] = height[i + 1] = height[i + 2] = hs[k] * 255; height[i + 3] = 255; }
  return { color, height };
}

/** rock = 수조 바위 — stone 무늬를 밝은 쪽으로 눌렀다. stone(평균 sRGB .51 → 선형 .22)에 짙은 바위색까지 곱하면
 *  큰 바위 둘이 거의 검정(선형 .03)이라 구멍처럼 보였다(2026-11-05 화면). */
export function surfaceMap(kind: "sand" | "stone" | "wood" | "rock", size = 256) {
  return dataMaps(cachedPixels(`${kind}/${size}`, () => bakeSurface(kind, size)), size);
}
function bakeSurface(kind: "sand" | "stone" | "wood" | "rock", size: number) {
  const color = new Uint8Array(size * size * 4), height = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, grain = random(x + y * size);
    let n: number;
    if (kind === "sand") n = .66 + grain * .28 + .025 * Math.sin(u * 80 + Math.sin(v * 28) * 2);
    else if (kind === "wood") n = .49 + .19 * Math.sin(u * 100 + Math.sin(v * 12) * 3 + Math.sin(v * 31)) + grain * .15;
    else n = .51 + .16 * Math.sin(u * 21 + Math.sin(v * 15) * 2) * Math.sin(v * 32 + u * 6) + grain * .20
      + Math.max(0, 1 - Math.abs(Math.sin(u * 12 + Math.sin(v * 9) * 1.8)) / .055) * .18;
    if (kind === "rock") n = clamp(.8 + (n - .51) * .55, 0, 1);
    const i = (y * size + x) * 4;
    color[i] = n * 255; color[i + 1] = n * 253; color[i + 2] = n * 241; color[i + 3] = 255;
    height[i] = height[i + 1] = height[i + 2] = (kind === "sand" ? grain : n) * 255; height[i + 3] = 255;
  }
  return { color, height };
}

/** 부드러운 접지 그림자(64² 원) — 바닥 돌 · 물고기 그림자가 같이 쓴다.
 *  ⚠ DataTexture 기본 축소 필터는 Nearest 라 멀리서 보면 반짝였다 — Linear 로 둔다. */
export function softShadowTexture(): T.DataTexture {
  const px = cachedPixels("shadow/64", () => {
    const color = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5); color[i + 3] = Math.max(0, 1 - r) ** 2 * 255; }
    return { color, height: color };
  });
  const t = new T.DataTexture(px.color, 64, 64);
  t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.needsUpdate = true;
  return t;
}

/** Curved lance-shaped blade with a raised midrib, not an ellipsoid leaf.
 *  rows · cols 는 잎 하나의 격자 — 기본(16 × 4)은 장식 · 시험이 쓰는 고운 잎이다.
 *  수조는 화면에서 작은 만큼 거칠게 쓴다(2026-11-12 GPU 점검): 곡선은 2차식이라 몇 칸이면 휜 모양이 그대로고, 잎 하나가 수백 개 인스턴스로 곱해져 삼각형이 쌓였다.
 *  ⚠ cols 는 짝수 — 가운데 열(u=.5)이 잎맥 색 · 잎맥 솟음 자리다. */
export function leafGeometry(broad = false, rows = 16, cols = 4): T.BufferGeometry {
  const p: number[] = [], uv: number[] = [], index: number[] = [], q = cols + 1;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const t = j / rows, s = i / cols * 2 - 1, width = Math.sin(Math.PI * t) ** .65 * (broad ? .21 : .075);
    p.push(s * width + .08 * t * t, t, .18 * t * t + (1 - Math.abs(s)) * .035 * Math.sin(Math.PI * t)); uv.push(i / cols, t);
    if (j < rows && i < cols) { const k = j * q + i; index.push(k, k + 1, k + q, k + 1, k + q + 1, k + q); }
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); return g;
}

/** 바닥 바위 한 개 — 수조 root 안의 좌표(넓히기 · 깊이 · 높이 늘리기 전). at 은 가운데, size 는 반지름(정이십면체 1 → 이 크기), seed 는 굴곡 · 기울기 */
export type HardStone = { at: [number, number, number]; size: [number, number, number]; seed: number; shadow: [number, number] };
/** 단계별 바닥 바위 — 그리기(makeHabitat)와 물고기 장애물(rockObstacles)이 같은 표를 쓴다(2026-11-11 — 예전엔 바위가 장애물이 아니어서 흰동가리 · 우럭이 12~19% 시간 바위 속을 지났다) */
export function hardscapeStones(tierInput: number): HardStone[] {
  const tier = Math.min(clamp(Math.round(tierInput), 1, HABITAT_THEMES.length), 6), out: HardStone[] = [];
  const ground = (x: number, z: number) => substrateHeight(x, z, tier);
  const stoneCount = tier === 1 ? 9 : tier === 5 ? 16 : 14;
  for (let i = 0; i < stoneCount; i++) {
    const side = i % 2 ? 1 : -1, r = random(i + tier * 51), z = -2.55 + random(i + 18) * 1.4;
    const h = (tier === 1 ? .4 : tier === 5 ? 1.3 : .8) + r * (side < 0 ? 1.6 : 1.0);
    const x = side * (3.6 + random(i + 77) * .85);
    out.push({ at: [x, ground(x, z) + h * .57, z], size: [.42 + r * .55, h, .4 + random(i + 33) * .46], seed: i + tier, shadow: [1.5 + r, 1.4] });
  }
  // Main and supporting stones give the aquascape a deliberate focal composition.
  if (tier !== 3) {
    const h = tier === 1 ? 1.1 : tier === 5 ? 3.3 : 2.5;
    out.push({ at: [-2.15, ground(-2.15, -2.55) + h * .72, -2.55], size: [.83, h, .58], seed: 19 + tier, shadow: [2.4, 1.6] });
    out.push({ at: [1.8, ground(1.8, -2.6) + .58, -2.6], size: [.70, .85, .65], seed: 8 + tier, shadow: [1.9, 1.6] });
  }
  return out;
}
/** 바닥 바위 → 물고기 길이 비켜 갈 원기둥(Obstacle — x · r 은 월드, z · h 는 물고기 길 좌표). wide · deep 은 수조를 늘린 배율.
 *  바위는 돌린 타원체라 바닥에서 본 발자국을 월드에서 재고, 앞뒤로 긴 발자국(깊은 수조)은 원 몇 개로 나눈다 — 원 하나로 덮으면 깊은 수조에서 앞뒤로 너무 부풀었다.
 *  꼭짓점 굴곡이 .91 안팎이라 반지름은 .92 배로 잰다. 같은 단계 = 같은 값(순수). */
export function rockObstacles(tierInput: number, wide = 1, deep = 1): { x: number; z: number; r: number; h: number; kind: "rock" }[] {
  const out: { x: number; z: number; r: number; h: number; kind: "rock" }[] = [];
  for (const st of hardscapeStones(tierInput)) {
    const yaw = st.seed * .71, c = Math.cos(yaw), s = Math.sin(yaw), sx = st.size[0] * .92, sz = st.size[2] * .92;
    // 돌린 타원의 월드 반폭(가로 · 앞뒤)
    const hx = Math.hypot(sx * c, sz * s) * wide, hz = Math.hypot(sx * s, sz * c) * deep;
    const top = st.at[1] + st.size[1] * .9 - WORLD.floor;
    if (top <= .05) continue;
    const x = st.at[0] * wide, z = st.at[2] * deep;
    const long = Math.max(hx, hz), short = Math.min(hx, hz), n = long > short * 1.5 ? Math.ceil(long / short) : 1;
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (-1 + (2 * k + 1) / n) * (long - short);
      const r = n === 1 ? long : short * 1.08;
      out.push({ x: x + (hx >= hz ? off : 0), z: (z + (hx >= hz ? 0 : off)) / deep, r, h: top, kind: "rock" });
    }
  }
  return out;
}
export type Habitat = { root: T.Group; floor: T.Mesh; heightAt: (x: number, z: number) => number; setWater: (cleanliness: number) => void; animate: (seconds: number) => void; dispose: () => void };
/** 받아 둔 배경 그림(아직이면 null) — 11단계 돔의 앞 바다 벽이 같은 tank_9 를 한 번 더 받지 않고 빌려 쓴다(2026-11-11). 지우는 건 수조 몫 */
export const habitatScenery = (h: Habitat | null): T.Texture | null => (h as (Habitat & { scenery?: () => T.Texture | null }) | null)?.scenery?.() ?? null;
/** anisotropy: 모래를 비스듬히 볼 때 뭉개지지 않게(렌더러 최대값 — 4 를 넘기지 않는다) */
export function makeHabitat(tierInput: number, opts: { anisotropy?: number } = {}): Habitat {
  // 상위 어항은 6단계 지형을 공유하되, 각 단계 전용 배경과 색을 사용한다.
  const artTier = clamp(Math.round(tierInput), 1, HABITAT_THEMES.length);
  const tier = Math.min(artTier, 6), theme = HABITAT_THEMES[artTier - 1];
  const root = new T.Group(); root.name = `aquascape-${tier}`;
  // 옆으로 늘리면 root 가 가로로 늘어난다 — 바깥에서 묻는 x 는 늘어난 좌표다
  const time = { value: 0 }, heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / root.scale.x, z / root.scale.z, tier) - WORLD.floor) * root.scale.y;
  const sandTex = sandMap(512), woodMap = surfaceMap("wood");
  sandTex.map.repeat.set(3, 1.8); sandTex.bump.repeat.set(3, 1.8);
  if (opts.anisotropy) sandTex.map.anisotropy = sandTex.bump.anisotropy = Math.min(4, opts.anisotropy);
  const rockMap = surfaceMap("rock");
  const sand = new T.MeshStandardMaterial({ color: theme.sand, map: sandTex.map, bumpMap: sandTex.bump, bumpScale: .05, roughness: .9 });
  sand.onBeforeCompile = shader => {
    shader.uniforms.aquaTime = time;
    // 물이 더러우면 모래 위 일렁임도 흐려진다(장면이 물 상태로 aquaClarity 를 내린다 — 2026-11-12)
    shader.uniforms.aquaClarity = WATER_LIGHT.aquaClarity;
    shader.uniforms.aquaBankStrength = { value: tier === 1 ? .32 : .94 };
    shader.vertexShader = `varying vec3 vAquaPosition;\n${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAquaPosition = position;");
    shader.fragmentShader = `varying vec3 vAquaPosition; uniform float aquaTime; uniform float aquaClarity; uniform float aquaBankStrength;\n${CAUSTIC_GLSL}\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        float bank=smoothstep(1.15,2.7,abs(vAquaPosition.x+.58*sin(vAquaPosition.z*.8)));
        diffuseColor.rgb *= mix(vec3(1.),vec3(.08,.11,.055),bank*aquaBankStrength);
        // 물 밑 모래는 곳곳이 축축하게 짙다 — 넓은 얼룩이 있어야 타일 반복이 안 보인다
        float damp=.5+.5*sin(vAquaPosition.x*.9+sin(vAquaPosition.z*1.3)*1.4)*sin(vAquaPosition.z*1.1+vAquaPosition.x*.35);
        diffuseColor.rgb *= mix(.8,1.06,damp);`)
      .replace("#include <dithering_fragment>", `
      gl_FragColor.rgb += vec3(.085,.115,.095)*aquaCaustic(vAquaPosition.xz,aquaTime)*aquaClarity;
      #include <dithering_fragment>`);
  };
  const terrain = new T.PlaneGeometry(10, 6, 72, 44); terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  terrain.computeVertexNormals(); const floor = new T.Mesh(terrain, sand); floor.name = "contoured-substrate"; root.add(floor);
  // 바위 — 밝힌 무늬 + 색을 밝은 회갈색 쪽으로 당긴다(짙은 테마도 바위로 읽히게). 꼭대기엔 이끼 · 밑동엔 앙금(정점 색)
  const rockMat = new T.MeshStandardMaterial({ color: new T.Color(theme.rock).lerp(new T.Color(0xc9c6b4), .32), map: rockMap.map, bumpMap: rockMap.bump, bumpScale: .07, roughness: .9, vertexColors: true });
  const woodMat = new T.MeshStandardMaterial({ color: 0x716146, map: woodMap.map, bumpMap: woodMap.bump, bumpScale: .035, roughness: .86 });
  const add = (geometry: T.BufferGeometry, material: T.Material, name: string, at: number[], scale: number[] = [1, 1, 1]) => {
    const m = new T.Mesh(geometry, material); m.name = name; m.position.set(at[0], at[1], at[2]); m.scale.set(scale[0], scale[1], scale[2]); root.add(m); return m;
  };
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const frame = new T.MeshStandardMaterial({ color: 0x233d40, roughness: .32, metalness: .72 });
  const seam = new T.MeshStandardMaterial({ color: 0x86c3bd, transparent: true, opacity: .20, roughness: .22, metalness: .18, depthWrite: false });
  // 같은 재질 조각을 한 형상으로 굽는 도우미 — 돌 · 그림자 · 유목 · 지층 · 옆 유리 · 옆벽이 쓴다
  const place = new T.Object3D();
  const bake = (g: T.BufferGeometry, at: number[], scale: number[], rot: number[] = [0, 0, 0]) => {
    place.position.set(at[0], at[1], at[2]); place.scale.set(scale[0], scale[1], scale[2]); place.rotation.set(rot[0], rot[1], rot[2]); place.updateMatrix();
    return g.applyMatrix4(place.matrix);
  };
  const merged = (parts: T.BufferGeometry[], material: T.Material, name: string) => {
    const m = new T.Mesh(mergeGeometries(parts), material); m.name = name; root.add(m); parts.forEach(g => g.dispose()); return m;
  };
  // Visible substrate cross-section, beneath the actual terrain; no floating slab.
  // 지층 셋은 색만 달랐다(재질 셋 = 그리기 셋) — 정점 색으로 한 덩어리 · 한 번 그리기(2026-11-12). 정점 색은 선형이라 Color(hex) 값을 그대로 넣으면 예전 재질 색과 같다
  const strata: T.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = bake(boxGeometry.clone(), [0, WORLD.floor - .24 + i * .095, 0], [10, .10, 6]), c = new T.Color(i === 2 ? theme.sand : i ? 0x494b3d : 0x29372e);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < col.length; k += 3) col.set([c.r, c.g, c.b], k);
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    strata.push(g);
  }
  merged(strata, new T.MeshStandardMaterial({ map: sandTex.map, roughness: 1, vertexColors: true }), "substrate-strata");
  add(boxGeometry, frame, "bottom-plinth", [0, WORLD.floor - .34, 0], [10.14, .10, 6.12]);
  const sideGlass: T.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    add(boxGeometry, seam, "glass-corner", [s * 5, .20, 3], [.035, 11.25, .055]);
    add(boxGeometry, seam, "glass-rear-corner", [s * 5, .20, -3], [.035, 11.25, .055]);
    add(boxGeometry, frame, "top-side-rim", [s * 5, 5.82, 0], [.08, .10, 6.12]);
    sideGlass.push(bake(new T.PlaneGeometry(6, 11.15), [s * 5, .22, 0], [1, 1, 1], [0, Math.PI / 2, 0]));
    // Narrow reflected highlights, rather than an opaque tint across the fish.
    add(boxGeometry, seam, "glass-reflection", [s * 4.97, .8, 2.6], [.018, 8.8, .12]);
  }
  // 옆 유리 — 4.5% 불투명에 클리어코트 물리 재질(양면 = 두 번 그리기)은 보이는 것에 비해 비쌌다. 기본 재질 · 한 번 그리기.
  // 양쪽 판은 한 형상(2026-11-12) — 같은 색 · 같은 불투명도라 겹치는 순서가 결과를 안 바꾼다(깊이도 안 쓴다)
  merged(sideGlass, new T.MeshBasicMaterial({ color: 0xc3e7db, transparent: true, opacity: .045, side: T.DoubleSide, forceSinglePass: true, depthWrite: false }), "side-glass");
  for (const z of [-3, 3]) { add(boxGeometry, frame, "top-cross-rim", [0, 5.82, z], [10.12, .10, .08]); add(boxGeometry, frame, "base-cross-rim", [0, WORLD.floor - .05, z], [10.12, .055, .045]); }

  const emptyBackdrop = new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);emptyBackdrop.needsUpdate=true;
  let disposed=false,photo:T.Texture|null=null;
  // 먼 물 — 깊이 안개를 받는다(fog). 안개 거리는 장면이 매 프레임 카메라 거리에 맞춰 옮긴다
  const backdrop = new T.ShaderMaterial({ fog: true, uniforms: { ...T.UniformsUtils.clone(T.UniformsLib.fog), low: { value: new T.Color(theme.water).multiplyScalar(.48) }, high: { value: new T.Color(theme.top) }, aquaTime: time, scenery:{value:emptyBackdrop},photoReady:{value:0},murk:{value:0} },
    vertexShader: "#include <fog_pars_vertex>\nattribute float wallShade;varying float vWallShade;varying vec2 vUv; void main(){vWallShade=wallShade;vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}",
    fragmentShader: `#include <fog_pars_fragment>
      varying float vWallShade;varying vec2 vUv;uniform vec3 low;uniform vec3 high;uniform float aquaTime;uniform sampler2D scenery;uniform float photoReady;uniform float murk;
      void main(){float h=smoothstep(0.,1.,vUv.y);vec3 c=mix(low,high,h*.66);
      vec3 farScenery=texture2D(scenery,vUv).rgb*.67;c=mix(c,farScenery,photoReady);c=mix(c,low*.8,murk*.65);
      float shafts=pow(max(0.,sin(vUv.x*18.+vUv.y*1.8+sin(aquaTime*.1)*.1)),12.);
      c+=vec3(.008,.016,.012)*shafts*h; c*=(.78+.22*sin(vUv.x*3.14159))*vWallShade;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #ifdef USE_FOG
      // 먼 벽은 안개에 3/4 만 묻는다 — 사진 배경이 통째로 물색이 되면 깊이가 아니라 벽이 사라진다
      gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogNear,fogFar,vFogDepth)*.75);
      #endif
      }` });
  // 배경 그림의 바깥 10% 는 둥근 어항 유리 테두리라 옆벽에 늘어나면 검은 얼룩이 됐다(2026-11-10) — 뒷벽은 그 안쪽만, 옆벽은 모서리에서 안쪽으로 되비춰 이음매가 이어진다
  const SCENE_U0 = .1;
  // 격자 40 × 36(예전 72 × 88 = 12.7k 삼각형) — 이 재질은 빛을 안 받아(법선을 안 쓴다) 모양은 굽은 정도만 보이는데,
  // 휘는 식이 느린 포물선 + 진폭 .08 물결이라 이 칸이면 칸 안 오차가 .004 안쪽이다(2026-11-12 GPU 점검). 가운데(x=0)에 정점이 있어야 가장 깊은 .95 가 남는다 — 가로 칸은 짝수
  const relief=new T.PlaneGeometry(10.12,11.3,40,36),reliefPos=relief.attributes.position,reliefUv=relief.attributes.uv as T.BufferAttribute;
  for(let i=0;i<reliefPos.count;i++){const x=reliefPos.getX(i),y=reliefPos.getY(i),edge=Math.min(1,Math.abs(x)/5.06);
    reliefPos.setZ(i,-.95*(1-edge*edge)+.08*Math.sin(x*2.8)*Math.sin(y*1.9)*edge);reliefUv.setXY(i,SCENE_U0+reliefUv.getX(i)*(1-2*SCENE_U0),.22+reliefUv.getY(i)*.78);}
  relief.setAttribute("wallShade",new T.Float32BufferAttribute(new Float32Array(reliefPos.count).fill(1),1));
  relief.computeVertexNormals();add(relief, backdrop, "deep-water-backdrop", [0, .22, -3.06]);
  // 옆벽 둘은 같은 재질이라 한 형상으로 굽는다(그리기 둘 → 하나, 2026-11-12). 격자 20 × 36(예전 28 × 72) — 물결 진폭 .035 라 칸 안 오차가 .002 안쪽
  const walls: T.BufferGeometry[] = [];
  for(const side of [-1,1]){
    const wall=new T.PlaneGeometry(6,11.3,20,36),uv=wall.attributes.uv as T.BufferAttribute,p=wall.attributes.position;
    for(let i=0;i<p.count;i++){const u=uv.getX(i);uv.setXY(i,side<0?SCENE_U0+(1-u)*.16:1-SCENE_U0-u*.16,.22+uv.getY(i)*.78);p.setZ(i,.035*Math.sin(p.getX(i)*3)*Math.sin(p.getY(i)*2));}
    wall.setAttribute("wallShade",new T.Float32BufferAttribute(new Float32Array(p.count).fill(.48),1));wall.computeVertexNormals();
    // 유리(x = ±5) 바깥에 둔다 — 5.015 에 ±.035 로 굽이치면 벽이 유리 앞으로 튀어나온 자리마다 유리 빛이 빠져 검은 타원 격자가 보였다(2026-11-10)
    walls.push(bake(wall,[side*5.06,.22,0],[1,1,1],[0,-side*Math.PI/2,0]));
  }
  merged(walls,backdrop,"sculpted-side-scenery");
  if(typeof document!=="undefined")photo=new T.TextureLoader().load(asset(`/aqua/tank/tank_${Math.min(artTier, TANK_ART_MAX)}.webp`),texture=>{
    if(disposed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;backdrop.uniforms.scenery.value=texture;backdrop.uniforms.photoReady.value=1;
  },undefined,()=>{photo?.dispose();photo=null;});
  // 수면 밑면 — 똑바로 올려다볼수록 밝고(스넬의 창) 비스듬하면 어둡게 비친다 + 흐르는 물결 반짝임.
  // ⚠ 톤 매핑 · 색 공간 변환이 없으면 선형 색이 그대로 나가 수면만 탁했다. 양면이지만 한 번에 그린다(forceSinglePass)
  const water = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, forceSinglePass: true, depthWrite: false, uniforms: { aquaTime: time, tint: { value: new T.Color(theme.top) } },
    vertexShader: "varying vec2 vUv;varying vec3 vWorld;uniform float aquaTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*3.+aquaTime*.8)*.012+cos(p.y*4.-aquaTime*.6)*.01;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: `varying vec2 vUv;varying vec3 vWorld;uniform float aquaTime;uniform vec3 tint;
      void main(){float w=pow(.5+.5*sin(vUv.x*95.+sin(vUv.y*25.+aquaTime)*2.),10.);
        vec3 v=normalize(cameraPosition-vWorld);float win=smoothstep(.12,.75,abs(v.y));
        vec2 q=vWorld.xz;float n1=sin(q.x*3.1+aquaTime*.7+sin(q.y*2.3-aquaTime*.4)*1.5),n2=sin(q.y*3.7-aquaTime*.5+sin(q.x*1.9+aquaTime*.3)*1.2);
        float sparkle=pow(max(0.,n1*n2),14.);
        vec3 c=mix(tint*.55,tint*1.25+vec3(.10,.14,.12),win)+vec3(.35,.38,.32)*sparkle*(.3+win)+vec3(.20)*w;
        gl_FragColor=vec4(c,.07+win*.10+sparkle*.16+w*.06);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  // 격자 32 × 20(예전 48 × 24) — 물결이 면 수직으로 ±.02 남짓이라 칸 차이가 안 보이고, 짧은 쪽 물결(약 1.6)에도 5칸이 남는다. 빛 · 반짝임은 픽셀마다 계산한다
  const surface = add(new T.PlaneGeometry(9.95, 5.94, 32, 20), water, "rippling-water-surface", [0, 5.56, 0]); surface.rotation.x = -Math.PI / 2;
  add(boxGeometry, new T.MeshBasicMaterial({ color: 0xcce9d8, transparent: true, opacity: .26, depthWrite: false }), "waterline-meniscus", [0, 5.54, 2.98], [9.95, .018, .025]);
  const led = new T.MeshBasicMaterial({ color: 0xe0f6df, toneMapped: false });
  add(boxGeometry, frame, "lighting-canopy", [0, 5.98, -.25], [7.5, .12, .38]);
  for (let i = 0; i < 18; i++) add(boxGeometry, led, "canopy-led", [-3.45 + i * .405, 5.909, -.25], [.20, .012, .17]);

  // 돌 · 접지 그림자 · 유목은 재질마다 한 덩어리로 굽는다 — 돌 16 · 그림자 18 · 유목 10 이 따로 그리기 호출이었다(2026-11-05)
  const stones: T.BufferGeometry[] = [], shadows: T.BufferGeometry[] = [], woods: T.BufferGeometry[] = [];
  function stone(at: number[], dimensions: number[], seed: number) {
    // 꼭짓점을 이어 붙여 매끈한 법선으로(2026-11-10) — 정이십면체는 면마다 꼭짓점이 따로라 법선을 계산하면 면이 각져 보였다(돌이 아니라 다면체).
    // 매끈해진 만큼 굴곡은 한 겹 더(작은 패임) 얹는다. 무늬 좌표는 위치에서 — 원래 uv 는 이음매에서 꼭짓점을 갈라 놓는다.
    const ico = new T.IcosahedronGeometry(1, 3); ico.deleteAttribute("normal"); ico.deleteAttribute("uv");
    const g = mergeVertices(ico); ico.dispose();
    const p = g.attributes.position, colors: number[] = [], uvs: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = .91 + .085 * Math.sin(x * 11 + seed) * Math.cos(y * 9 - z * 7) + .045 * Math.sin(z * 17 + x * 6) + .03 * Math.sin(x * 23 - y * 19 + seed * 2) * Math.cos(z * 21);
      p.setXYZ(i, x * r, y * r, z * r);
      uvs.push(.5 + x * .5 + z * .22, .5 + y * .5 - z * .12);
      const shade = .80 + .22 * (y + 1) / 2 + .07 * Math.sin(y * 25 + x * 2), moss = smooth(.45, .9, y) * (.5 + .5 * Math.sin(x * 7 + z * 5 + seed)), silt = 1 - smooth(-.95, -.55, y);
      colors.push(shade * (1 - moss * .16) * (1 - silt * .18), shade * (1 + moss * .04) * (1 - silt * .12), shade * .96 * (1 - moss * .22) * (1 - silt * .05));
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
    stones.push(bake(g, at, dimensions, [seed * .04, seed * .71, Math.sin(seed) * .15]));
  }
  const shadowMat=new T.MeshBasicMaterial({map:softShadowTexture(),transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const contact=(x:number,z:number,w:number,d:number)=>{const g=new T.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);shadows.push(bake(g,[x,heightAt(x,z)+.018,z],[w,1,d]));};
  // 돌 자리는 hardscapeStones 한 곳 — 물고기 길의 장애물(rockObstacles)도 같은 표를 읽는다
  for (const st of hardscapeStones(tier)) { stone(st.at, st.size, st.seed); contact(st.at[0], st.at[2], st.shadow[0], st.shadow[1]); }
  root.add(Object.assign(new T.Mesh(mergeGeometries(stones), rockMat), { name: "weathered-hardscape" }));
  root.add(Object.assign(new T.Mesh(mergeGeometries(shadows), shadowMat), { name: "soft-contact-shadow" }));
  stones.forEach(g => g.dispose()); shadows.forEach(g => g.dispose());
  // 자갈 — 한 알이 화면에서 몇 픽셀(반지름 .012~.11)이라 세분 1(80면 × 260 = 20.8k 삼각형)은 보이지 않는 면이었다 → 세분 0(20면, 2026-11-12 GPU 점검).
  // 세분 0 은 면마다 꼭짓점이 따로라 그대로면 각진 주사위가 된다 — 꼭짓점을 이어 매끈한 법선으로(바위와 같은 방법) 둥근 조약돌로 읽히게. 무늬 좌표는 위치에서
  const pebbleIco = new T.IcosahedronGeometry(1, 0); pebbleIco.deleteAttribute("normal"); pebbleIco.deleteAttribute("uv");
  const pebbleGeometry = mergeVertices(pebbleIco); pebbleIco.dispose();
  { const p = pebbleGeometry.attributes.position, uvs: number[] = []; for (let i = 0; i < p.count; i++) uvs.push(.5 + p.getX(i) * .5 + p.getZ(i) * .22, .5 + p.getY(i) * .5 - p.getZ(i) * .12);
    pebbleGeometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); pebbleGeometry.computeVertexNormals(); }
  const pebble = new T.InstancedMesh(pebbleGeometry, new T.MeshStandardMaterial({ color: new T.Color(theme.rock).lerp(new T.Color(0xc9c6b4), .25), map: rockMap.map, roughness: .91 }), 260);
  pebble.name = "graded-river-gravel"; const dummy = new T.Object3D();
  for (let i = 0; i < pebble.count; i++) {
    let x = (random(i * 4 + 5) - .5) * 9.6;
    const z = (random(i * 4 + 6) - .5) * 5.8;
    if(Math.abs(x)<1.3&&i%4) x=(i%2?1:-1)*(1.4+random(i+47)*3.2);
    const s = .012 + random(i * 4 + 7) ** 3 * (Math.abs(x)<1.3?.035:.10);
    dummy.position.set(x, heightAt(x, z) + s * .3, z); dummy.scale.set(s * 1.3, s * .6, s); dummy.rotation.set(i, i * .7, i * .2); dummy.updateMatrix(); pebble.setMatrixAt(i, dummy.matrix);
  } root.add(pebble);
  // 뒷벽 유목 — 가지마다 24마디 × 7칸(336)이라 3단계 16가지가 5.4k 였다(2026-11-12 GPU 점검). 가지는 점 3~5개를 잇는 완만한 곡선이고
  // 뒷벽(z ≈ −2.5 ~ −2.9) 앞이라 화면에서 멀다 → 마디는 점 하나에 4개(3점 12 · 4점 16 · 5점 20), 단면은 굵은 줄기 6칸 · 잔가지 5칸
  function branch(points: number[][], radius: number) {
    woods.push(bake(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(p[0], p[1], p[2]))), points.length * 4, radius, radius >= .1 ? 6 : 5, false), [0, WORLD.floor, 0], [1, 1, 1]));
  }
  if (theme.wood) for (const s of [-1, 1]) {
    branch([[s * 4.1, .3, -2], [s * 3.6, 1.3, -2.5], [s * 2.8, 2.5, -2.65], [s * 2.9, 3.8, -2.8]], .12);
    for (let i = 0; i < 4; i++) branch([[s * 3.8, .4 + i * .6, -2.2], [s * (3.0 - i * .22), 1.2 + i * .65, -2.4], [s * (2.7 - i * .24), 1.35 + i * .78, -2.8]], .045 + i * .009);
  }
  if(tier===3){branch([[-4.2,.3,-2.4],[-2.7,1.0,-2.55],[-1.7,2.2,-2.7],[-.3,3.0,-2.8],[1.1,3.9,-2.85]],.20);
    for(let i=0;i<5;i++)branch([[-3.2+i*.7,.8+i*.5,-2.6],[-2.8+i*.8,1.6+i*.6,-2.75],[-3.5+i*1.1,2.1+i*.65,-2.9]],.07);}
  if (woods.length) { root.add(Object.assign(new T.Mesh(mergeGeometries(woods), woodMat), { name: "gnarled-driftwood" })); woods.forEach(g => g.dispose()); }
  if (tier === 6) {
    const stoneMap = surfaceMap("stone"), ruin = new T.MeshStandardMaterial({ color: 0xb1a17b, map: stoneMap.map, bumpMap: stoneMap.bump, bumpScale: .025, roughness: .85 });
    // 기둥 둘은 형상이 따로라(새 원기둥 둘) 묶음 그리기에도 안 잡혀 그리기가 둘이었다 — 한 형상으로(2026-11-12)
    const columns: T.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const x = s * 3.65;
      columns.push(bake(new T.CylinderGeometry(.22, .29, 4.6, 16), [x, WORLD.floor + 3.1, -2.65], [1, 1, 1]));
      for (const y of [.72, 5.45]) add(boxGeometry, ruin, "column-carved-capital", [x, WORLD.floor + y, -2.65], [.75, .22, .65]);
      add(boxGeometry, ruin, "palace-stone-step", [x, WORLD.floor + .42, -2.55], [.95, .16, 1]);
    }
    merged(columns, ruin, "aged-palace-column");
    add(boxGeometry, ruin, "sunken-lintel", [0, WORLD.floor + 5.7, -2.82], [7.8, .32, .48]);
    for(let i=0;i<13;i++)add(boxGeometry,ruin,"carved-lintel-relief",[-3.3+i*.55,WORLD.floor+5.68,-2.53],[.29,.18,.055]).rotation.z=i%2?.12:-.12;
  }

  function planting(count: number, color: number, seed: number, broad: boolean) {
    const material = new T.MeshStandardMaterial({ color, roughness: .72, side: T.DoubleSide, vertexColors: true });
    // 잎 격자 12 × 4(기본 16 × 4) — 큰 단계엔 잎이 200장 넘게 인스턴스로 곱해진다. 키 큰 잎(최대 4.4)도 2차 곡선이라 12칸이면 휜 선이 매끈하다
    const geometry = leafGeometry(broad, 12, 4), colors: number[] = [], uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const midrib = Math.abs(uv.getX(i) - .5) < .05 ? 1.1 : .73 + uv.getY(i) * .27; colors.push(midrib, midrib, midrib * .86); }
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    material.onBeforeCompile = shader => {
      shader.uniforms.aquaTime = time;
      shader.vertexShader = `uniform float aquaTime;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.x += sin(aquaTime*.65+position.y*2.2+instanceMatrix[3].x*3.)*.055*pow(uv.y,1.7);
        transformed.z += cos(aquaTime*.45+instanceMatrix[3].z*2.)*.04*pow(uv.y,1.5);`);
    };
    const leaves = new T.InstancedMesh(geometry, material, count); leaves.name = broad ? "broadleaf-planting" : "ribbon-planting"; leaves.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? -1 : 1, rear = i % 3 === 0;
      const x = rear ? (random(i + seed) - .5) * 7.2 : side * (3.55 + random(i + seed) * .95);
      const z = rear ? -2.85 + random(i + seed * 2) * .55 : -2.8 + random(i + seed * 2) * 3.7;
      const h = (broad ? .35 : .8) + random(i + seed * 3) * (broad ? .9 : rear ? 2.8 : 3.6);
      dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set((random(i + seed * 4) - .5) * .45, i * 2.399, (random(i + seed * 5) - .5) * .55);
      dummy.scale.set(broad ? .5 + random(i + 8) * .6 : 1, h, 1); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    } root.add(leaves);
  }
  planting(theme.density, theme.foliage, tier * 31, false);
  planting(Math.round(theme.density * .65), theme.accent, tier * 43, true);
  // 앞쪽 잔디 — 한 잎이 높이 .18~.47 · 폭 .05 라 고운 잎(128 삼각형 × 144 = 18.4k)은 화면에서 한두 픽셀 폭이었다 → 6 × 2(24 삼각형, 2026-11-12). 가운데 열이 남아 잎맥 솟음은 그대로
  const carpetGeometry=leafGeometry(false,6,2),carpet=new T.InstancedMesh(carpetGeometry,new T.MeshStandardMaterial({color:theme.foliage,roughness:.9,side:T.DoubleSide}),144);
  carpet.name="foreground-grass-tufts";
  for(let i=0;i<carpet.count;i++){const group=Math.floor(i/6),side=group%2?1:-1,x=side*(1.6+random(group+tier*11)*2.9),z=-2.5+random(group+tier*13)*5.0;
    dummy.position.set(x+(i%6)*.025,heightAt(x,z),z);dummy.scale.set(.65,.18+random(i+55)*.29,.7);dummy.rotation.set(.1,i*2.399,(random(i+19)-.5)*.8);dummy.updateMatrix();carpet.setMatrixAt(i,dummy.matrix);}root.add(carpet);

  // Back-corner filter intake and tubing give the scene a tangible aquarium scale.
  const pipe = new T.MeshStandardMaterial({ color: 0x56746e, roughness: .25, metalness: .25 });
  // 관과 흡입구 고리 일곱은 한 덩어리 — 고리마다 새 형상 · 그리기 호출이었다. 고리 형상 하나를 옮겨 붙인다
  const ring = new T.TorusGeometry(.09, .016, 5, 12), intake: T.BufferGeometry[] = [new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-4.75, WORLD.floor + .7, -2.85), new T.Vector3(-4.75, 4.7, -2.85), new T.Vector3(-4.65, 5.5, -2.6), new T.Vector3(-4.2, 5.5, -2.4)]), 30, .055, 8, false)];
  for (let i = 0; i < 7; i++) intake.push(bake(ring.clone(), [-4.75, WORLD.floor + .45 + i * .075, -2.85], [1, 1, 1], [Math.PI / 2, 0, 0]));
  root.add(Object.assign(new T.Mesh(mergeGeometries(intake), pipe), { name: "filter-glass-pipe" }));
  ring.dispose(); intake.forEach(g => g.dispose());
  // 산소 거품 — 점 입자 한 묶음(그리기 한 번). 양쪽 뒤 모서리에서 수면까지 올라가 톡 터진다
  const bubbles = bubbleStream({ count: 160, origin: i => [(i % 2 ? -1 : 1) * 4.35 + (random(i + 3) - .5) * .08, -1.8 + (random(i + 9) - .5) * .08],
    bottom: WORLD.floor + .2, top: 5.5, size: [.045, .11], speed: [.3, .6], opacity: .5, wobble: .09, seed: tier });
  bubbles.points.name = "diffuser-bubbles"; root.add(bubbles.points);
  // 빛줄기 — 조명 밑에서 바닥으로 내려가는 얇은 판 다섯(인스턴스 한 묶음 · 더하기 섞기). 세로축만 카메라 쪽으로 돈다
  const shaftGeometry = new T.PlaneGeometry(1, 1, 1, 6); shaftGeometry.translate(0, -.5, 0);
  const shaftMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { aquaTime: time, uColor: { value: new T.Color(0xfff0c8) }, uStrength: { value: .11 } },
    vertexShader: `uniform float aquaTime;varying vec2 vUv;varying float vSeed;
      void main(){vUv=uv;vec3 c=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float w=length(instanceMatrix[0].xyz),h=length(instanceMatrix[1].xyz);vSeed=instanceMatrix[3].x;
        vec3 toCam=cameraPosition-c;toCam.y=0.;toCam=normalize(toCam+vec3(0.,0.,.0001));vec3 right=vec3(toCam.z,0.,-toCam.x);
        float sway=sin(aquaTime*.23+vSeed*1.7)*.35*(1.-uv.y);
        vec3 p=c+right*(position.x*w+sway)+vec3(0.,position.y*h,0.);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float aquaTime;uniform vec3 uColor;uniform float uStrength;varying vec2 vUv;varying float vSeed;
      void main(){float edge=pow(sin(vUv.x*3.14159),2.);float fall=pow(vUv.y,1.6)*smoothstep(0.,.15,vUv.y);float flicker=.75+.25*sin(aquaTime*.6+vSeed*3.);
        gl_FragColor=vec4(uColor,edge*fall*flicker*uStrength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const shafts = new T.InstancedMesh(shaftGeometry, shaftMaterial, 5); shafts.name = "light-shafts"; shafts.frustumCulled = false; shafts.raycast = () => {};
  for (let i = 0; i < shafts.count; i++) {
    dummy.position.set(-3 + i * 1.5 + (random(i + 61) - .5) * .6, 5.5, -.25 + (random(i + 67) - .5) * 2.2); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(.35 + random(i + 71) * .4, 8.2 + random(i + 73) * 2, 1); dummy.updateMatrix(); shafts.setMatrixAt(i, dummy.matrix);
  } root.add(shafts);
  const dustPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) { dustPositions[i * 3] = (random(i + 908) - .5) * 9.5; dustPositions[i * 3 + 1] = (random(i + 909) - .5) * 10.5; dustPositions[i * 3 + 2] = (random(i + 910) - .5) * 5.6; }
  const dustGeometry = new T.BufferGeometry(); dustGeometry.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
  const dust = new T.Points(dustGeometry, new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { aquaTime: time },
    vertexShader: "uniform float aquaTime;void main(){vec3 p=position;p.x+=sin(aquaTime*.12+p.y)*.08;p.y+=sin(aquaTime*.18+p.z)*.12;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(28./-mv.z,1.,2.5);}",
    // 색은 선형 값 — 예전 화면 색(.70,.85,.77)이 색 공간 변환 뒤에도 같게 보이도록 되돌렸다
    fragmentShader: "void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.1,r)*.18;gl_FragColor=vec4(.45,.69,.55,a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" })); dust.name = "suspended-water-particles"; dust.raycast = () => {}; root.add(dust);
  // 수조 안 물건은 안 움직인다 — 행렬을 한 번 계산해 두고 매 프레임 다시 짜지 않는다(넓히면 scene 이 root 만 다시 계산한다)
  root.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  const ALGAE=new T.Color(0x3d4c37),algaeLow=ALGAE.clone().multiplyScalar(.5),waterLow=new T.Color(theme.water).multiplyScalar(.48),waterHigh=new T.Color(theme.top);
  return { root, floor, heightAt, setWater(cleanliness) {
    // 물이 갈리는 동안 프레임마다 불린다 — 색을 새로 만들지 않는다(2026-11-12)
    const murk=clamp((60-cleanliness)/100,0,.55);
    backdrop.uniforms.murk.value=murk;
    backdrop.uniforms.low.value.copy(waterLow).lerp(algaeLow,murk);
    backdrop.uniforms.high.value.copy(waterHigh).lerp(ALGAE,murk);
  }, animate(seconds) {
    time.value = seconds;
    bubbles.update(seconds);
  }, dispose(){disposed=true;photo?.dispose();emptyBackdrop.dispose();},
  scenery: () => (backdrop.uniforms.photoReady.value ? backdrop.uniforms.scenery.value as T.Texture : null) } as Habitat;
}
