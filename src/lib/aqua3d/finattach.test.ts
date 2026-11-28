// 영구 런타임 지느러미 · 부위 이탈 회귀 테스트(2026-11-27).
// 실제 수조 파이프라인(GLTFLoader → prepareFishSource → fishMotion 헤엄 포즈)을 거친 뒤
// 스키닝된 정점의 3D 연결 성분을 검사해 몸통에서 떨어진 부위(floating parts)가 0개임을 잠근다.
// — 갈라파고스 50종 · 리빌드 포유류 6종 · 12본 펭귄 5종 · 키싱구라미 · v3 크라켄 성체 전체.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { prepareFishSource, fishMotion } from "./glb.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };

const GALAPAGOS_50 = [
  "amberjack", "blacktip_reef_shark", "blue_marlin", "blue_ringed_octopus", "brydes_whale",
  "bumphead_parrotfish", "clown_triggerfish", "galapagos_damselfish", "galapagos_fur_seal", "galapagos_lobster",
  "galapagos_penguin", "galapagos_sea_lion", "galapagos_shark", "garden_eel", "giant_clam",
  "giant_trevally", "golden_cownose_ray", "goliath_grouper", "hawksbill_turtle", "king_angelfish",
  "leafy_seadragon", "leatherback_turtle", "loggerhead_turtle", "mandarinfish", "marble_ray",
  "marine_iguana", "mobula_ray", "moorish_idol", "napoleon_wrasse", "nautilus",
  "picasso_triggerfish", "pilot_whale", "porcupinefish", "pygmy_seahorse", "red_lipped_batfish",
  "red_snapper", "ribbon_eel", "sailfish", "sally_lightfoot_crab", "scalloped_hammerhead",
  "silky_shark", "skipjack_tuna", "spanish_hogfish", "spotted_dolphin", "spotted_eagle_ray",
  "spotted_trumpetfish", "tiger_shark", "wahoo", "whitetip_reef_shark", "yellowfin_tuna",
];

const UPGRADED_SPECIES = [
  "spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "otter", "sea_otter",
  "emperor_penguin", "gentoo_penguin", "chinstrap_penguin", "adelie_penguin",
  "kissing_gourami", "kraken",
];

const ALL_TARGETS = [...new Set([...GALAPAGOS_50, ...UPGRADED_SPECIES])];

/** 3D 정점 근접 연결 성분 검사 — 주 몸통에서 떨어져 떠 있는 부품(>= 8 정점) 수를 센다 */
function countFloatingParts(mesh: T.SkinnedMesh, posed: boolean): number {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const n = pos.count;
  const pts = new Float32Array(n * 3);
  const v = new T.Vector3();
  if (posed) {
    mesh.updateMatrixWorld(true);
    mesh.skeleton.update();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
    }
  } else {
    for (let i = 0; i < n; i++) {
      pts[i * 3] = pos.getX(i); pts[i * 3 + 1] = pos.getY(i); pts[i * 3 + 2] = pos.getZ(i);
    }
  }

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-4);
  const eps = span * 0.022;
  const inv = 1 / eps;

  // Union-Find with spatial grid + index adjacency
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const idx = geom.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      unite(a, b); unite(b, c);
    }
  }

  const grid = new Map<string, number[]>();
  const keyOf = (cx: number, cy: number, cz: number) => `${cx},${cy},${cz}`;
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(pts[i * 3] * inv), cy = Math.floor(pts[i * 3 + 1] * inv), cz = Math.floor(pts[i * 3 + 2] * inv);
    const k = keyOf(cx, cy, cz);
    const arr = grid.get(k);
    if (arr) arr.push(i); else grid.set(k, [i]);
  }
  const eps2 = eps * eps;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(keyOf(cx + dx, cy + dy, cz + dz));
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const o = list[j];
        if (o <= i || find(i) === find(o)) continue;
        const ddx = pts[o * 3] - x, ddy = pts[o * 3 + 1] - y, ddz = pts[o * 3 + 2] - z;
        if (ddx * ddx + ddy * ddy + ddz * ddz <= eps2) unite(i, o);
      }
    }
  }

  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const sizes = [...counts.values()].sort((a, b) => b - a);
  return sizes.slice(1).filter((s) => s >= 8).length;
}

test("런타임 파이프라인(prepareFishSource + fishMotion 헤엄 포즈) 후 지느러미·부위 이탈이 0이다", async () => {
  const failures: string[] = [];
  for (const key of ALL_TARGETS) {
    const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
    const g = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .register(() => webp as never)
      .parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
    prepareFishSource(g.scene, key);
    const holder = new T.Group();
    holder.add(g.scene);
    const anim = fishMotion(g.scene, key, key);
    anim(1.2, 1, { dt: 1 / 60, amp: 1, effort: 1, speed: 0.4, upright: 0, hover: 0, ground: 0 } as never);
    holder.updateMatrixWorld(true);

    let skinned: T.SkinnedMesh | null = null;
    g.scene.traverse((o) => { if (o instanceof T.SkinnedMesh && !skinned) skinned = o; });
    assert.ok(skinned, `${key} has SkinnedMesh`);
    const fPrep = countFloatingParts(skinned, false);
    const fPosed = countFloatingParts(skinned, true);
    if (fPrep > 0 || fPosed > 0) failures.push(`${key}(prep=${fPrep}, posed=${fPosed})`);
  }
  assert.deepEqual(failures, [], `지느러미·부위 이탈 감지: ${failures.join(", ")}`);
});
