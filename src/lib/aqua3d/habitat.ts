import * as T from "three";
import { WORLD, clamp } from "./world.ts";
import { asset } from "../base.ts";

type Theme = { water: number; top: number; sand: number; rock: number; foliage: number; accent: number; density: number; wood: boolean };
export const HABITAT_THEMES: readonly Theme[] = [
  { water: 0x174b50, top: 0x448b88, sand: 0xb6aa87, rock: 0x6e7766, foliage: 0x598245, accent: 0x8c9953, density: 38, wood: false },
  { water: 0x103c3b, top: 0x477e62, sand: 0xc6b88d, rock: 0x4d6356, foliage: 0x426e35, accent: 0x9c654d, density: 95, wood: false },
  { water: 0x173b3d, top: 0x527b6c, sand: 0xab9d76, rock: 0x5a6053, foliage: 0x51784a, accent: 0x899454, density: 70, wood: true },
  { water: 0x103d50, top: 0x4a8d92, sand: 0xc8c5a8, rock: 0x55626a, foliage: 0x426a42, accent: 0x5d7a44, density: 70, wood: false },
  { water: 0x0c273f, top: 0x286579, sand: 0x777e7e, rock: 0x364b57, foliage: 0x3b7371, accent: 0x648ca1, density: 64, wood: false },
  { water: 0x103e48, top: 0x3b8580, sand: 0xb7b293, rock: 0x7e8971, foliage: 0x427c68, accent: 0xa7aa69, density: 68, wood: true },
];
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

/** 모래 — 잔물결 · 색이 다른 낟알 · 작은 조약돌과 조개 조각. 회색 잡음 한 겹이면 시멘트처럼 보였다 */
export function sandMap(size = 512) {
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
  const map = new T.DataTexture(color, size, size), bump = new T.DataTexture(height, size, size);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; }
  return { map, bump };
}

export function surfaceMap(kind: "sand" | "stone" | "wood", size = 256) {
  const color = new Uint8Array(size * size * 4), height = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, grain = random(x + y * size);
    let n: number;
    if (kind === "sand") n = .66 + grain * .28 + .025 * Math.sin(u * 80 + Math.sin(v * 28) * 2);
    else if (kind === "wood") n = .49 + .19 * Math.sin(u * 100 + Math.sin(v * 12) * 3 + Math.sin(v * 31)) + grain * .15;
    else n = .51 + .16 * Math.sin(u * 21 + Math.sin(v * 15) * 2) * Math.sin(v * 32 + u * 6) + grain * .20
      + Math.max(0, 1 - Math.abs(Math.sin(u * 12 + Math.sin(v * 9) * 1.8)) / .055) * .18;
    const i = (y * size + x) * 4;
    color[i] = n * 255; color[i + 1] = n * 253; color[i + 2] = n * 241; color[i + 3] = 255;
    height[i] = height[i + 1] = height[i + 2] = (kind === "sand" ? grain : n) * 255; height[i + 3] = 255;
  }
  const map = new T.DataTexture(color, size, size), bump = new T.DataTexture(height, size, size);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; }
  return { map, bump };
}

/** Curved lance-shaped blade with a raised midrib, not an ellipsoid leaf. */
export function leafGeometry(broad = false): T.BufferGeometry {
  const p: number[] = [], uv: number[] = [], index: number[] = [];
  for (let j = 0; j <= 16; j++) for (let i = 0; i <= 4; i++) {
    const t = j / 16, s = i / 4 * 2 - 1, width = Math.sin(Math.PI * t) ** .65 * (broad ? .21 : .075);
    p.push(s * width + .08 * t * t, t, .18 * t * t + (1 - Math.abs(s)) * .035 * Math.sin(Math.PI * t)); uv.push(i / 4, t);
    if (j < 16 && i < 4) { const k = j * 5 + i; index.push(k, k + 1, k + 5, k + 1, k + 6, k + 5); }
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); return g;
}

export type Habitat = { root: T.Group; floor: T.Mesh; heightAt: (x: number, z: number) => number; setWater: (cleanliness: number) => void; animate: (seconds: number) => void; dispose: () => void };
export function makeHabitat(tierInput: number): Habitat {
  const tier = clamp(Math.round(tierInput), 1, 6), theme = HABITAT_THEMES[tier - 1];
  const root = new T.Group(); root.name = `aquascape-${tier}`;
  // 옆으로 늘리면 root 가 가로로 늘어난다 — 바깥에서 묻는 x 는 늘어난 좌표다
  const time = { value: 0 }, heightAt = (x: number, z: number) => substrateHeight(x / root.scale.x, z, tier);
  const sandTex = sandMap(512), stoneMap = surfaceMap("stone"), woodMap = surfaceMap("wood");
  sandTex.map.repeat.set(3, 1.8); sandTex.bump.repeat.set(3, 1.8);
  const sand = new T.MeshStandardMaterial({ color: theme.sand, map: sandTex.map, bumpMap: sandTex.bump, bumpScale: .05, roughness: .9 });
  sand.onBeforeCompile = shader => {
    shader.uniforms.aquaTime = time;
    shader.uniforms.aquaBankStrength = { value: tier === 1 ? .32 : .94 };
    shader.vertexShader = `varying vec3 vAquaPosition;\n${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAquaPosition = position;");
    shader.fragmentShader = `varying vec3 vAquaPosition; uniform float aquaTime; uniform float aquaBankStrength;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        float bank=smoothstep(1.15,2.7,abs(vAquaPosition.x+.58*sin(vAquaPosition.z*.8)));
        diffuseColor.rgb *= mix(vec3(1.),vec3(.08,.11,.055),bank*aquaBankStrength);
        // 물 밑 모래는 곳곳이 축축하게 짙다 — 넓은 얼룩이 있어야 타일 반복이 안 보인다
        float damp=.5+.5*sin(vAquaPosition.x*.9+sin(vAquaPosition.z*1.3)*1.4)*sin(vAquaPosition.z*1.1+vAquaPosition.x*.35);
        diffuseColor.rgb *= mix(.8,1.06,damp);`)
      .replace("#include <dithering_fragment>", `
      vec2 q=vAquaPosition.xz*2.1;
      float a=sin(q.x+sin(q.y*1.7+aquaTime*.22)*1.3);
      float b=sin(q.y*1.3+cos(q.x*1.2-aquaTime*.18)*1.1);
      float c=pow(max(0.,1.-abs(a*b)),20.);
      gl_FragColor.rgb += vec3(.085,.115,.095)*c;
      #include <dithering_fragment>`);
  };
  const terrain = new T.PlaneGeometry(10, 6, 72, 44); terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  terrain.computeVertexNormals(); const floor = new T.Mesh(terrain, sand); floor.name = "contoured-substrate"; root.add(floor);
  const rockMat = new T.MeshStandardMaterial({ color: theme.rock, map: stoneMap.map, bumpMap: stoneMap.bump, bumpScale: .065, roughness: .92, vertexColors: true });
  const woodMat = new T.MeshStandardMaterial({ color: 0x716146, map: woodMap.map, bumpMap: woodMap.bump, bumpScale: .035, roughness: .86 });
  const add = (geometry: T.BufferGeometry, material: T.Material, name: string, at: number[], scale: number[] = [1, 1, 1]) => {
    const m = new T.Mesh(geometry, material); m.name = name; m.position.set(at[0], at[1], at[2]); m.scale.set(scale[0], scale[1], scale[2]); root.add(m); return m;
  };
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const frame = new T.MeshStandardMaterial({ color: 0x233d40, roughness: .32, metalness: .72 });
  const seam = new T.MeshStandardMaterial({ color: 0x86c3bd, transparent: true, opacity: .20, roughness: .22, metalness: .18, depthWrite: false });
  // Visible substrate cross-section, beneath the actual terrain; no floating slab.
  for (let i = 0; i < 3; i++) add(boxGeometry, new T.MeshStandardMaterial({ color: i === 2 ? theme.sand : i ? 0x494b3d : 0x29372e, map: sandTex.map, roughness: 1 }), `substrate-stratum-${i}`, [0, WORLD.floor - .24 + i * .095, 0], [10, .10, 6]);
  add(boxGeometry, frame, "bottom-plinth", [0, WORLD.floor - .34, 0], [10.14, .10, 6.12]);
  for (const s of [-1, 1]) {
    add(boxGeometry, seam, "glass-corner", [s * 5, .20, 3], [.035, 11.25, .055]);
    add(boxGeometry, seam, "glass-rear-corner", [s * 5, .20, -3], [.035, 11.25, .055]);
    add(boxGeometry, frame, "top-side-rim", [s * 5, 5.82, 0], [.08, .10, 6.12]);
    const glass = add(new T.PlaneGeometry(6, 11.15), new T.MeshPhysicalMaterial({ color: 0xc3e7db, transparent: true, opacity: .045, roughness: .07, metalness: .08, side: T.DoubleSide, depthWrite: false, clearcoat: 1 }), "side-glass", [s * 5, .22, 0]); glass.rotation.y = Math.PI / 2;
    // Narrow reflected highlights, rather than an opaque tint across the fish.
    add(boxGeometry, seam, "glass-reflection", [s * 4.97, .8, 2.6], [.018, 8.8, .12]);
  }
  for (const z of [-3, 3]) { add(boxGeometry, frame, "top-cross-rim", [0, 5.82, z], [10.12, .10, .08]); add(boxGeometry, frame, "base-cross-rim", [0, WORLD.floor - .05, z], [10.12, .055, .045]); }

  const emptyBackdrop = new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);emptyBackdrop.needsUpdate=true;
  let disposed=false,photo:T.Texture|null=null;
  const backdrop = new T.ShaderMaterial({ uniforms: { low: { value: new T.Color(theme.water).multiplyScalar(.48) }, high: { value: new T.Color(theme.top) }, aquaTime: time, scenery:{value:emptyBackdrop},photoReady:{value:0},murk:{value:0} },
    vertexShader: "attribute float wallShade;varying float vWallShade;varying vec2 vUv; void main(){vWallShade=wallShade;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying float vWallShade;varying vec2 vUv;uniform vec3 low;uniform vec3 high;uniform float aquaTime;uniform sampler2D scenery;uniform float photoReady;uniform float murk;
      void main(){float h=smoothstep(0.,1.,vUv.y);vec3 c=mix(low,high,h*.66);
      vec3 farScenery=texture2D(scenery,vUv).rgb*.67;c=mix(c,farScenery,photoReady);c=mix(c,low*.8,murk*.65);
      float shafts=pow(max(0.,sin(vUv.x*18.+vUv.y*1.8+sin(aquaTime*.1)*.1)),12.);
      c+=vec3(.008,.016,.012)*shafts*h; c*=(.78+.22*sin(vUv.x*3.14159))*vWallShade;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` });
  const relief=new T.PlaneGeometry(10.12,11.3,72,88),reliefPos=relief.attributes.position,reliefUv=relief.attributes.uv as T.BufferAttribute;
  for(let i=0;i<reliefPos.count;i++){const x=reliefPos.getX(i),y=reliefPos.getY(i),edge=Math.min(1,Math.abs(x)/5.06);
    reliefPos.setZ(i,-.95*(1-edge*edge)+.08*Math.sin(x*2.8)*Math.sin(y*1.9)*edge);reliefUv.setY(i,.22+reliefUv.getY(i)*.78);}
  relief.setAttribute("wallShade",new T.Float32BufferAttribute(new Float32Array(reliefPos.count).fill(1),1));
  relief.computeVertexNormals();add(relief, backdrop, "deep-water-backdrop", [0, .22, -3.06]);
  for(const side of [-1,1]){
    const wall=new T.PlaneGeometry(6,11.3,28,72),uv=wall.attributes.uv as T.BufferAttribute,p=wall.attributes.position;
    for(let i=0;i<p.count;i++){const u=uv.getX(i);uv.setXY(i,side<0?(1-u)*.16:1-u*.16,.22+uv.getY(i)*.78);p.setZ(i,.035*Math.sin(p.getX(i)*3)*Math.sin(p.getY(i)*2));}
    wall.setAttribute("wallShade",new T.Float32BufferAttribute(new Float32Array(p.count).fill(.48),1));wall.computeVertexNormals();
    add(wall,backdrop,"sculpted-side-scenery",[side*5.015,.22,0]).rotation.y=-side*Math.PI/2;
  }
  if(typeof document!=="undefined")photo=new T.TextureLoader().load(asset(`/aqua/tank/tank_${tier}.webp`),texture=>{
    if(disposed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;backdrop.uniforms.scenery.value=texture;backdrop.uniforms.photoReady.value=1;
  },undefined,()=>{photo?.dispose();photo=null;});
  const water = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, uniforms: { aquaTime: time, tint: { value: new T.Color(theme.top) } },
    vertexShader: "varying vec2 vUv;uniform float aquaTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*3.+aquaTime*.8)*.012+cos(p.y*4.-aquaTime*.6)*.01;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
    fragmentShader: "varying vec2 vUv;uniform float aquaTime;uniform vec3 tint;void main(){float w=pow(.5+.5*sin(vUv.x*95.+sin(vUv.y*25.+aquaTime)*2.),10.);gl_FragColor=vec4(tint+vec3(.20)*w,.09+w*.06);}" });
  const surface = add(new T.PlaneGeometry(9.95, 5.94, 48, 24), water, "rippling-water-surface", [0, 5.56, 0]); surface.rotation.x = -Math.PI / 2;
  add(boxGeometry, new T.MeshBasicMaterial({ color: 0xcce9d8, transparent: true, opacity: .26, depthWrite: false }), "waterline-meniscus", [0, 5.54, 2.98], [9.95, .018, .025]);
  const led = new T.MeshBasicMaterial({ color: 0xe0f6df, toneMapped: false });
  add(boxGeometry, frame, "lighting-canopy", [0, 5.98, -.25], [7.5, .12, .38]);
  for (let i = 0; i < 18; i++) add(boxGeometry, led, "canopy-led", [-3.45 + i * .405, 5.909, -.25], [.20, .012, .17]);

  function stone(at: number[], dimensions: number[], seed: number) {
    const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, colors: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = .91 + .085 * Math.sin(x * 11 + seed) * Math.cos(y * 9 - z * 7) + .045 * Math.sin(z * 17 + x * 6);
      p.setXYZ(i, x * r, y * r, z * r);
      const shade = .70 + .25 * (y + 1) / 2 + .07 * Math.sin(y * 25 + x * 2);
      colors.push(shade, shade, shade * .96);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
    const m = add(g, rockMat, "weathered-hardscape", at, dimensions); m.rotation.set(seed * .04, seed * .71, Math.sin(seed) * .15); return m;
  }
  const stoneCount = tier === 1 ? 9 : tier === 5 ? 16 : 14;
  const shadowPixels = new Uint8Array(64 * 64 * 4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);shadowPixels[i+3]=Math.max(0,1-r)**2*255;}
  const shadowMap=new T.DataTexture(shadowPixels,64,64);shadowMap.needsUpdate=true;shadowMap.magFilter=T.LinearFilter;
  const shadowMat=new T.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shadowGeometry=new T.PlaneGeometry(1,1);shadowGeometry.rotateX(-Math.PI/2);
  const contact=(x:number,z:number,w:number,d:number)=>add(shadowGeometry,shadowMat,"soft-contact-shadow",[x,heightAt(x,z)+.018,z],[w,1,d]);
  for (let i = 0; i < stoneCount; i++) {
    const side = i % 2 ? 1 : -1, r = random(i + tier * 51), z = -2.55 + random(i + 18) * 1.4;
    const h = (tier === 1 ? .4 : tier === 5 ? 1.3 : .8) + r * (side < 0 ? 1.6 : 1.0);
    const x = side * (3.6 + random(i + 77) * .85);
    stone([x, heightAt(x, z) + h * .57, z], [.42 + r * .55, h, .4 + random(i + 33) * .46], i + tier);
    contact(x,z,1.5+r,1.4);
  }
  // Main and supporting stones give the aquascape a deliberate focal composition.
  if(tier!==3){const h=tier===1?1.1:tier===5?3.3:2.5;stone([-2.15,heightAt(-2.15,-2.55)+h*.72,-2.55],[.83,h,.58],19+tier);contact(-2.15,-2.55,2.4,1.6);
    stone([1.8,heightAt(1.8,-2.6)+.58,-2.6],[.70,.85,.65],8+tier);contact(1.8,-2.6,1.9,1.6);}
  const pebble = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({ color: theme.rock, map: stoneMap.map, roughness: .91 }), 260);
  pebble.name = "graded-river-gravel"; const dummy = new T.Object3D();
  for (let i = 0; i < pebble.count; i++) {
    let x = (random(i * 4 + 5) - .5) * 9.6;
    const z = (random(i * 4 + 6) - .5) * 5.8;
    if(Math.abs(x)<1.3&&i%4) x=(i%2?1:-1)*(1.4+random(i+47)*3.2);
    const s = .012 + random(i * 4 + 7) ** 3 * (Math.abs(x)<1.3?.035:.10);
    dummy.position.set(x, heightAt(x, z) + s * .3, z); dummy.scale.set(s * 1.3, s * .6, s); dummy.rotation.set(i, i * .7, i * .2); dummy.updateMatrix(); pebble.setMatrixAt(i, dummy.matrix);
  } root.add(pebble);
  function branch(points: number[][], radius: number) {
    return add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(p[0], p[1], p[2]))), 24, radius, 7, false), woodMat, "gnarled-driftwood", [0, WORLD.floor, 0]);
  }
  if (theme.wood) for (const s of [-1, 1]) {
    branch([[s * 4.1, .3, -2], [s * 3.6, 1.3, -2.5], [s * 2.8, 2.5, -2.65], [s * 2.9, 3.8, -2.8]], .12);
    for (let i = 0; i < 4; i++) branch([[s * 3.8, .4 + i * .6, -2.2], [s * (3.0 - i * .22), 1.2 + i * .65, -2.4], [s * (2.7 - i * .24), 1.35 + i * .78, -2.8]], .045 + i * .009);
  }
  if(tier===3){branch([[-4.2,.3,-2.4],[-2.7,1.0,-2.55],[-1.7,2.2,-2.7],[-.3,3.0,-2.8],[1.1,3.9,-2.85]],.20);
    for(let i=0;i<5;i++)branch([[-3.2+i*.7,.8+i*.5,-2.6],[-2.8+i*.8,1.6+i*.6,-2.75],[-3.5+i*1.1,2.1+i*.65,-2.9]],.07);}
  if (tier === 6) {
    const ruin = new T.MeshStandardMaterial({ color: 0xb1a17b, map: stoneMap.map, bumpMap: stoneMap.bump, bumpScale: .025, roughness: .85 });
    for (const s of [-1, 1]) {
      const x = s * 3.65;
      add(new T.CylinderGeometry(.22, .29, 4.6, 16), ruin, "aged-palace-column", [x, WORLD.floor + 3.1, -2.65]);
      for (const y of [.72, 5.45]) add(boxGeometry, ruin, "column-carved-capital", [x, WORLD.floor + y, -2.65], [.75, .22, .65]);
      add(boxGeometry, ruin, "palace-stone-step", [x, WORLD.floor + .42, -2.55], [.95, .16, 1]);
    }
    add(boxGeometry, ruin, "sunken-lintel", [0, WORLD.floor + 5.7, -2.82], [7.8, .32, .48]);
    for(let i=0;i<13;i++)add(boxGeometry,ruin,"carved-lintel-relief",[-3.3+i*.55,WORLD.floor+5.68,-2.53],[.29,.18,.055]).rotation.z=i%2?.12:-.12;
  }

  function planting(count: number, color: number, seed: number, broad: boolean) {
    const material = new T.MeshStandardMaterial({ color, roughness: .72, side: T.DoubleSide, vertexColors: true });
    const geometry = leafGeometry(broad), colors: number[] = [], uv = geometry.attributes.uv;
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
  const carpetGeometry=leafGeometry(false),carpet=new T.InstancedMesh(carpetGeometry,new T.MeshStandardMaterial({color:theme.foliage,roughness:.9,side:T.DoubleSide}),144);
  carpet.name="foreground-grass-tufts";
  for(let i=0;i<carpet.count;i++){const group=Math.floor(i/6),side=group%2?1:-1,x=side*(1.6+random(group+tier*11)*2.9),z=-2.5+random(group+tier*13)*5.0;
    dummy.position.set(x+(i%6)*.025,heightAt(x,z),z);dummy.scale.set(.65,.18+random(i+55)*.29,.7);dummy.rotation.set(.1,i*2.399,(random(i+19)-.5)*.8);dummy.updateMatrix();carpet.setMatrixAt(i,dummy.matrix);}root.add(carpet);

  // Back-corner filter intake and tubing give the scene a tangible aquarium scale.
  const pipe = new T.MeshStandardMaterial({ color: 0x56746e, roughness: .25, metalness: .25 });
  add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-4.75, WORLD.floor + .7, -2.85), new T.Vector3(-4.75, 4.7, -2.85), new T.Vector3(-4.65, 5.5, -2.6), new T.Vector3(-4.2, 5.5, -2.4)]), 30, .055, 8, false), pipe, "filter-glass-pipe", [0, 0, 0]);
  for (let i = 0; i < 7; i++) add(new T.TorusGeometry(.09, .016, 5, 12), pipe, "filter-intake-ring", [-4.75, WORLD.floor + .45 + i * .075, -2.85]).rotation.x = Math.PI / 2;
  const bubbleMaterial = new T.MeshStandardMaterial({ color: 0xcce9df, transparent: true, opacity: .20, roughness: .12, metalness: .12, depthWrite: false });
  const bubbles = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), bubbleMaterial, 36); bubbles.name = "diffuser-bubbles"; bubbles.frustumCulled = false; root.add(bubbles);
  const dustPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) { dustPositions[i * 3] = (random(i + 908) - .5) * 9.5; dustPositions[i * 3 + 1] = (random(i + 909) - .5) * 10.5; dustPositions[i * 3 + 2] = (random(i + 910) - .5) * 5.6; }
  const dustGeometry = new T.BufferGeometry(); dustGeometry.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
  const dust = new T.Points(dustGeometry, new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { aquaTime: time },
    vertexShader: "uniform float aquaTime;void main(){vec3 p=position;p.x+=sin(aquaTime*.12+p.y)*.08;p.y+=sin(aquaTime*.18+p.z)*.12;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(28./-mv.z,1.,2.5);}",
    fragmentShader: "void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.1,r)*.18;gl_FragColor=vec4(.70,.85,.77,a);}" })); dust.name = "suspended-water-particles"; root.add(dust);
  return { root, floor, heightAt, setWater(cleanliness) {
    const murk=clamp((60-cleanliness)/100,0,.55),algae=new T.Color(0x3d4c37);
    backdrop.uniforms.murk.value=murk;
    backdrop.uniforms.low.value.copy(new T.Color(theme.water).multiplyScalar(.48)).lerp(algae.clone().multiplyScalar(.5),murk);
    backdrop.uniforms.high.value.copy(new T.Color(theme.top)).lerp(algae,murk);
  }, animate(seconds) {
    time.value = seconds;
    for (let i = 0; i < bubbles.count; i++) {
      const side = i % 2 ? -1 : 1, y = WORLD.floor + .2 + ((seconds * (.3 + random(i + 4) * .3) + i * .43) % 10.6);
      dummy.position.set(side * 4.35 + Math.sin(y * 1.5 + i) * .10, y, -1.8 + Math.cos(y + i) * .08);
      dummy.scale.setScalar(.018 + random(i + 37) * .033); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
    } bubbles.instanceMatrix.needsUpdate = true;
  }, dispose(){disposed=true;photo?.dispose();emptyBackdrop.dispose();} };
}
