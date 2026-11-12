import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AnimalModel, ModelKit } from "./models.ts";
import type { SwimPose } from "./anatomy.ts";
import { WATER_LIGHT, waterLit } from "./waterlight.ts";

type Seed = readonly [number, number];
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Five vertebral scutes, paired costal rows and a separate marginal ring.
// This layout is anatomical rather than the old repeated sine-grid pattern.
const scutes: Seed[] = Array.from({ length: 5 }, (_, i) => [-.68 + i * .34, 0] as const);
for (const side of [-1, 1]) {
  for (let i = 0; i < 4; i++) scutes.push([-.55 + i * .37, side * .34]);
  for (let i = 0; i < 12; i++) {
    const a = (i + .5) / 12 * Math.PI;
    scutes.push([Math.cos(a) * .96, Math.sin(a) * .65 * side]);
  }
}

function nearestScute(x: number, z: number) {
  let first = Infinity, second = Infinity, index = 0;
  for (let i = 0; i < scutes.length; i++) {
    const d = Math.hypot((x - scutes[i][0]) * .9, z - scutes[i][1]);
    if (d < first) { second = first; first = d; index = i; } else if (d < second) second = d;
  }
  return { index, distance: first, seam: second - first };
}

/** Authored procedural surface maps; no uploaded images, AI service or image planes. */
export function turtleSurface(kind: "shell" | "skin", size = kind === "shell" ? 1024 : 512) {
  const pixels = new Uint8Array(size * size * 4), heights = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1), grain = noise(x, y);
    let r: number, g: number, b: number, height: number;
    if (kind === "shell") {
      const sx = (u - .5) * 2, sz = (v - .5) * 1.4, cell = nearestScute(sx, sz);
      const center = scutes[cell.index], a = Math.atan2(sz - center[1], sx - center[0]);
      const streak = Math.sin(a * 47 + cell.distance * 18) * .5 + Math.sin(a * 83) * .25;
      const ring = Math.sin(cell.distance * 135 + Math.sin(a * 5) * .8);
      const tone = noise(cell.index, 4), edge = 1 - clamp01(cell.seam / .009);
      const pale = 1 - clamp01(Math.abs(cell.seam - .011) / .004);
      r = 84 + tone * 40 + streak * 22 + ring * 5 + grain * 17;
      g = 79 + tone * 30 + streak * 17 + ring * 4 + grain * 15;
      b = 49 + tone * 22 + streak * 10 + grain * 11;
      r = r * (1 - edge * .65) + pale * 65;
      g = g * (1 - edge * .65) + pale * 58;
      b = b * (1 - edge * .65) + pale * 37;
      height = 155 - edge * 90 + ring * 8 + grain * 14;
    } else {
      // Irregular interlocking scales with pale skin separating dark keratin plates.
      const sx = u * 23, sy = v * 15;
      let d1 = Infinity, d2 = Infinity, id = 0;
      for (let iy = Math.floor(sy) - 1; iy <= Math.floor(sy) + 1; iy++) {
        for (let ix = Math.floor(sx) - 1; ix <= Math.floor(sx) + 1; ix++) {
          const cx = ix + .5 + (noise(ix, iy) - .5) * .65;
          const cy = iy + .5 + (noise(iy, ix + 9) - .5) * .65;
          const d = Math.hypot(sx - cx, sy - cy);
          if (d < d1) { d2 = d1; d1 = d; id = noise(ix + 8, iy); } else if (d < d2) d2 = d;
        }
      }
      const border = 1 - clamp01((d2 - d1) / .10), speckle = grain * 14;
      r = 48 + id * 37 + border * 105 + speckle;
      g = 56 + id * 29 + border * 93 + speckle;
      b = 40 + id * 20 + border * 66 + speckle;
      height = 165 - border * 60 + speckle;
    }
    const i = (y * size + x) * 4;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
    heights[i] = heights[i + 1] = heights[i + 2] = height; heights[i + 3] = 255;
  }
  const color = new T.DataTexture(pixels, size, size), bump = new T.DataTexture(heights, size, size);
  color.colorSpace = T.SRGBColorSpace;
  for (const map of [color, bump]) {
    map.needsUpdate = true; map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter; map.generateMipmaps = true;
  }
  return { color, bump };
}

/** 그린 무늬는 수조(kit)마다 한 번만 — 1024² 등딱지(약 450ms) · 512² 피부(약 90ms)를 거북이 생길 때마다 메인 스레드에서 다시 그렸다.
 *  등딱지는 원본 사진(webp)이 곧바로 덮으므로 사진을 못 받았을 때만 그린다. */
const SURFACES = new WeakMap<ModelKit, { shell?: ReturnType<typeof turtleSurface>; skin?: ReturnType<typeof turtleSurface> }>();
function surfaceOf(kit: ModelKit, kind: "shell" | "skin") {
  let cache = SURFACES.get(kit);
  if (!cache) { cache = {}; SURFACES.set(kit, cache); }
  return (cache[kind] ??= turtleSurface(kind));
}

// 등딱지 격자(2026-11-12 GPU 점검) — 예전엔 위 · 아래 모두 36고리 × 96칸(13,824 삼각형)으로 거북 한 마리 22.5k 의 60% 였다.
// ① 고리 간격을 sin 으로(가운데는 성기게 · 가장자리는 촘촘히) — 돔 높이 √(1−r²) 는 가장자리에서만 가파르게 꺾여서,
//    고른 간격 36고리보다 sin 간격 16고리가 옆 실루엣을 더 둥글게 잡는다(가운데 평평한 곳에 고리를 쓰지 않는다).
// ② 아랫면은 6고리 — 가운데는 배딱지(plastron)가 덮고, 보이는 건 가장자리 띠뿐이다.
// ③ 둘레는 72칸 = 가장자리 물결(cos 24a) 한 마디에 정확히 3점 — 64 같은 수는 마디마다 다르게 찍혀 둘레가 고르지 않게 울렁인다.
//    위 · 아래 둘레 칸 수가 같아야 가장자리 점이 같은 자리라 틈이 안 생긴다.
// 홈(groove)은 예전과 같은 식 — 폭(.009)이 원래 격자보다 좁아 예전에도 꼭짓점에 걸린 곳만 패였다(사진 · 범프가 이음매를 그린다)
const SHELL_RINGS = [16, 6] as const, SHELL_AROUND = 72;
function carapace() {
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  const around = SHELL_AROUND, q = around + 1;
  const starts = [0, (SHELL_RINGS[0] + 1) * q];
  // Top dome and underside close at the same scalloped marginal rim.
  for (let side = 0; side < 2; side++) for (let i = 0, rings = SHELL_RINGS[side]; i <= rings; i++) {
    const radius = Math.sin(i / rings * Math.PI / 2);
    for (let j = 0; j <= around; j++) {
      const a = j / around * Math.PI * 2;
      const scallop = 1 + .009 * Math.cos(a * 24) * radius ** 12;
      const x = Math.cos(a) * radius * .95 * scallop;
      const z = Math.sin(a) * radius * .65 * (1 - .13 * Math.cos(a)) * scallop;
      const dome = Math.sqrt(Math.max(0, 1 - radius ** 2));
      const groove = Math.max(0, 1 - nearestScute(x, z).seam / .009);
      const y = side === 0 ? .035 + dome * .30 - groove * .008 * dome : .035 - dome * .12;
      pos.push(x, y, z); uv.push(x / 2 + .5, z / 1.4 + .5);
      if (i < rings && j < around) {
        const k = starts[side] + i * q + j;
        if (side === 0) indices.push(k, k + 1, k + q, k + 1, k + q + 1, k + q);
        else indices.push(k, k + q, k + 1, k + 1, k + q, k + q + 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  const normals = g.attributes.normal as T.BufferAttribute;
  for (let side = 0; side < 2; side++) {
    const start = starts[side];
    for (let j = 0; j <= around; j++) normals.setXYZ(start + j, 0, side ? -1 : 1, 0);
    for (let ring = 1; ring <= SHELL_RINGS[side]; ring++) {
      const first = start + ring * q, last = first + around;
      const n = new T.Vector3().fromBufferAttribute(normals, first).add(new T.Vector3().fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, n.x, n.y, n.z); normals.setXYZ(last, n.x, n.y, n.z);
    }
  }
  return g;
}

/** A closed airfoil-like flipper, swept back and narrowing to a rounded tip. */
function flipper(side: number, rear: boolean) {
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  // 32마디 × 12칸(지느러미 넷 3.1k) → 앞 18 × 10 · 뒤 12 × 8 — 휨은 sin 반 파장 하나라 18마디로 충분하고,
  // 끝(√(1−t) 로 둥글게 닫히는 곳)에만 마디를 모은다(t = 1 − (1−u)^1.4). 단면은 납작한 날개꼴이라 10칸이면 앞뒤 날이 둥글다.
  // 정점이 적어 매 프레임 휨 · 세 프레임마다 법선도 같이 가벼워진다
  const span = rear ? 12 : 18, around = rear ? 8 : 10, length = rear ? .46 : 1.11;
  for (let i = 0; i <= span; i++) {
    const t = 1 - (1 - i / span) ** 1.4, chord = (rear ? .24 : .235) * Math.sqrt(Math.max(0, 1 - t)) * (1 + .65 * Math.sin(t * Math.PI));
    const sweep = -(rear ? .28 : .65) * t + .08 * Math.sin(t * Math.PI);
    for (let j = 0; j <= around; j++) {
      const a = j / around * Math.PI * 2;
      pos.push(sweep + Math.cos(a) * chord, Math.sin(a) * chord * .16, side * length * t);
      uv.push((sweep + Math.cos(a) * chord + 1) / 1.5, t);
      if (i < span && j < around) {
        const k = i * (around + 1) + j, q = around + 1;
        if (side > 0) indices.push(k, k + 1, k + q, k + 1, k + q + 1, k + q);
        else indices.push(k, k + q, k + 1, k + 1, k + q, k + q + 1);
      }
    }
  }
  // Close the shoulder cross section; span tip already tapers to zero.
  for (let j = 1; j < around - 1; j++) indices.push(0, j + 1, j);
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function makeDetailedTurtle(kit: ModelKit, key = "green_sea_turtle"): AnimalModel {
  const root = new T.Group(); root.name = key;
  const skinMap = surfaceOf(kit, "skin");
  // 등딱지는 처음엔 단색 — 사진이 오면 사진, 못 받으면(아래 animate) 그때 그린 무늬
  const shell = new T.MeshStandardMaterial({ color: 0x6b6440, bumpScale: .013, roughness: .48, metalness: 0 });
  const skin = new T.MeshStandardMaterial({ map: skinMap.color, bumpMap: skinMap.bump, bumpScale: .008, roughness: .64, metalness: 0 });
  // 물고기 가장자리 테(rim) — 거북만 테가 없어 다른 물고기 옆에서 물 밖 사진처럼 떠 보였다(엔진이 코드 모델에 caustic 만 단다).
  // 거북 것인 등딱지 · 피부에만 단다 — 배딱지 · 턱 · 눈은 키트 공용 재질(장식도 쓴다)이라 테를 두르면 돌이 유리처럼 보인다. 먼저 달면 엔진의 waterLitTree 는 건너뛴다
  waterLit(shell, true); waterLit(skin, true);
  const body = new T.Mesh(carapace(), shell); body.name = "sculpted-carapace"; root.add(body);
  // Project the original carapace pixels onto the sculpted solid, not onto a plane.
  // Projection is authored for this reference only. Underside retains the plastron.
  const shellUv = body.geometry.attributes.uv as T.BufferAttribute;
  const projectedUv = new Float32Array(shellUv.array.length);
  const points = body.geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    const young = key !== "green_sea_turtle";
    projectedUv[i * 2] = ((young ? 246 : 238) + x / .95 * (young ? 98 : 113) + z / .65 * 17) / 512;
    projectedUv[i * 2 + 1] = ((young ? 236 : 225) - x / .95 * (young ? 13 : 22) + z / .65 * (young ? 55 : 64)) / 512;
  }
  let photo = false;
  kit.referenceTexture(key, texture => {
    photo = true;
    shell.map = texture; shell.color.set(0xffffff);
    // The photographic map has its own details; the sculpted geometry supplies relief.
    shell.bumpMap = null;
    shellUv.copyArray(projectedUv); shellUv.needsUpdate = true; shell.needsUpdate = true;
  });
  // 사진을 못 받았으면(목록에서 지워졌거나 브라우저가 아니면) 그때 한 번 무늬를 그린다 — 같은 수조의 다른 거북과 나눠 쓴다
  const fallback = () => {
    if (photo || shell.map || kit.referenceTextures.has(key)) return;
    const m = surfaceOf(kit, "shell");
    shell.map = m.color; shell.bumpMap = m.bump; shell.color.set(0xffffff); shell.needsUpdate = true;
  };
  // 타원체 세분(2026-11-12) — 예전엔 콧구멍(.007) · 눈(.03)까지 모두 키트 공용 구(20 × 12 = 440 삼각형)라 얼굴 조각 열 개가 5.3k 였다.
  // 화면에서 크게 보이는 배딱지 · 머리뼈만 키트 구 그대로, 목 · 아래턱은 중간, 부리 · 꼬리 · 눈은 작은 구, 콧구멍은 아주 작은 구.
  // 이 구들은 거북마다 새로 만든다 — 키트 구는 장식이 같이 쓰고 수조가 '키트 것이면 지우지 않는다'로 가르므로(scene.ts),
  // 거북 것은 거북이 떠날 때 함께 지워지는 게 맞다(한 거북 안에선 같은 구를 나눠 쓴다)
  const mid = new T.SphereGeometry(1, 16, 10), small = new T.SphereGeometry(1, 12, 8), tiny = new T.SphereGeometry(1, 6, 4);
  const ellipsoid = (parent: T.Object3D, name: string, at: [number, number, number], scale: [number, number, number], material: T.Material, shape: T.BufferGeometry = kit.sphere) => {
    const mesh = new T.Mesh(shape, material); mesh.name = name; mesh.position.set(...at); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  };
  // 좌우 한 쌍(눈 · 눈두덩 · 콧구멍 · 입 주름)은 재질이 같아 한 형상으로 굽는다 — 그리기 8번 → 4번. 둘 다 목 관절에 붙어 같이 움직인다
  const pair = (parent: T.Object3D, name: string, parts: T.BufferGeometry[], material: T.Material) => {
    const mesh = new T.Mesh(mergeGeometries(parts), material); mesh.name = name; parent.add(mesh); parts.forEach(g => g.dispose()); return mesh;
  };
  const baked = (shape: T.BufferGeometry, at: [number, number, number], scale: [number, number, number]) => shape.clone().scale(...scale).translate(...at);
  ellipsoid(root, "plastron", [0, -.065, 0], [.83, .125, .56], kit.material(0xb8aa7e, 0, .75));
  const neck = new T.Group(); neck.name = "neck-joint"; neck.position.set(.72, -.015, 0); root.add(neck);
  if (key.startsWith("fry_")) neck.scale.setScalar(1.12);
  ellipsoid(neck, "neck", [.13, 0, 0], [.28, .13, .145], skin, mid);
  ellipsoid(neck, "skull", [.43, .018, 0], [.28, .16, .192], skin);
  ellipsoid(neck, "jaw", [.48, -.069, 0], [.23, .064, .17], kit.material(0xa29a72, 0, .70), mid);
  ellipsoid(neck, "beak", [.663, -.018, 0], [.052, .074, .115], kit.material(0x837d54, 0, .55), small);
  const sides = [-1, 1] as const;
  pair(neck, "eye-socket", sides.map(s => baked(small, [.50, .069, s * .165], [.057, .046, .028])), kit.material(0x828266, 0, .72));
  pair(neck, "eye", sides.map(s => baked(small, [.513, .072, s * .187], [.027, .029, .012])), kit.material(0x151c18, 0, .13));
  pair(neck, "nostril", sides.map(s => baked(tiny, [.674, .032, s * .059], [.007, .005, .008])), kit.material(0x1c241c, 0, .8)); tiny.dispose(); // 굽기에만 쓴 원본(메시에 안 달렸다)
  // Narrow mouth crease follows the jaw rather than a cartoon facial expression.
  pair(neck, "mouth-crease", sides.map(s => new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.66, -.049, s * .10), new T.Vector3(.54, -.073, s * .163), new T.Vector3(.36, -.062, s * .153)]), 12, .003, 4, false)), kit.material(0x34382b, 0, .8));
  const limbs: { joint: T.Group; geometry: T.BufferGeometry; rest: Float32Array; side: number; rear: boolean }[] = [];
  for (const rear of [false, true]) for (const side of [-1, 1]) {
    const joint = new T.Group(); joint.name = `${rear ? "rear" : "front"}-flipper-${side}`;
    joint.position.set(rear ? -.64 : .48, -.065, side * (rear ? .38 : .43)); root.add(joint);
    const geometry = flipper(side, rear); joint.add(new T.Mesh(geometry, skin));
    // 경계 구는 한 번 — 지느러미 끝이 위아래로 최대 .105 휘는 몫을 더해 둔다(예전엔 매 프레임 다시 쟀다)
    geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += .11;
    limbs.push({ joint, geometry, rest: new Float32Array(geometry.attributes.position.array), side, rear });
  }
  const tail = ellipsoid(root, "tail", [-.95, -.04, 0], [.17, .037, .045], skin, small);
  let frame = 0;
  // 젓는 세기 · 빠르기(2026-11-12) — 예전엔 pose 를 안 봐서 모래 위에 앉아 쉬는 동안에도 지느러미를 다 저었다.
  // 엔진이 넘기는 time 은 쌓인 헤엄 박자(phase += dt·effort)라 쉬면 저절로 느려지지만, 폭은 그대로였다.
  // 폭: pose.amp(쉬면 작다 · 1 을 넘기지 않는다 — 경계 구가 휘는 몫 .105 까지만 잡아 두었다) × 모래에 앉은 만큼(ground) · 물에 멈춰 뜬 만큼(hover) 줄인다 — 앉으면 거의 멈추고 숨 쉬듯 조금만, 떠 있으면 살살 젓는다.
  // 빠르기: 폭이 줄면 박자도 같이 늦춘다 — 박자를 직접 곱하면 값이 튀므로 프레임마다 늘어난 몫에만 곱해 쌓는다(stroke).
  // 바뀌는 것은 실제 초(pose.dt · 물속 시계)로 0.8초에 걸쳐 섞는다 — 내려앉고 떠오를 때 툭 끊기지 않는다. pose 가 없으면 예전과 같다(폭 1 · 박자 그대로)
  let stroke = 0, lastTime = 0, lastClock = -1, power = -1;
  return { root, animate(time, effort, pose?: SwimPose) {
    frame++;
    if (!shell.map) fallback();
    const rate = 2.1 * Math.max(.2, effort);
    const grounded = clamp01(pose?.ground ?? 0), hover = clamp01(pose?.hover ?? 0) * (1 - grounded);
    const target = Math.max(.04, Math.min(1, pose?.amp ?? 1) * (1 - .85 * grounded) * (1 - .55 * hover));
    const clock = WATER_LIGHT.aquaTime.value, dt = pose?.dt ?? (lastClock >= 0 ? clock - lastClock : 0);
    lastClock = clock;
    if (power < 0) power = target;
    else if (dt > 0 && dt < 1) power += (target - power) * (1 - Math.exp(-dt / .8));
    const step = time - lastTime;
    if (frame === 1) stroke = time * rate;
    else if (step >= 0 && step < 10) stroke += step * rate * (.25 + .75 * power); // 거꾸로 · 크게 뛴 박자(수조 바뀜)는 쌓지 않는다
    lastTime = time;
    const phase = stroke, k = power;
    neck.rotation.y = Math.sin(phase * .45) * .035;
    neck.rotation.z = Math.sin(phase * .6) * .018;
    tail.rotation.y = Math.sin(phase - 1) * .09 * (.3 + .7 * k);
    limbs.forEach((limb, li) => {
      // Both front limbs drive down together; elbow/tip lag prevents rigid paddles.
      const p = phase - (limb.rear ? 1.1 : 0);
      limb.joint.rotation.x = limb.side * Math.sin(p) * (limb.rear ? .12 : .45) * k;
      limb.joint.rotation.y = limb.side * Math.cos(p + .5) * (limb.rear ? .10 : .16) * k;
      const positions = limb.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const t = Math.abs(limb.rest[i * 3 + 2]) / (limb.rear ? .46 : 1.11);
        positions.setY(i, limb.rest[i * 3 + 1] + Math.sin(p - t * 1.8) * .105 * t * t * k);
      }
      positions.needsUpdate = true;
      // 법선은 세 프레임에 한 번(지느러미마다 엇갈려 한 프레임엔 하나 남짓) — 휨이 느려 눈에 안 띄고, 거북 셋 × 지느러미 넷이 매 프레임 법선을 다시 쟀다
      if ((frame + li) % 3 === 0) limb.geometry.computeVertexNormals();
    });
  } };
}
