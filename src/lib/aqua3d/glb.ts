/* 제작한 3D 모델(GLB) — 있는 모델은 코드로 지은 임시 모델을 곧바로 갈아 끼운다. 받는 동안 · 실패해도 임시 모델이 그대로 보여서 수조가 비지 않는다.
 * 파일은 public/aqua/models(물고기 81 · 장식 37, 2026-11-03 사용자 승인 — design/aqua3d-review/stage-status.json). 바다거북 셋은 전용 코드 모델이라 없다. 목록이 파일과 같은지 gamepolish.test 가 본다.
 * 좌표: 위 +Y · 물고기 앞 +X(몸 가운데 원점) · 장식 앞 +Z(바닥 가운데 원점). 같은 물고기 여러 마리는 형상 · 재질을 나눠 쓴다(userData.glbShared — 한 마리 떠날 때 지우면 안 된다).
 * 2026-11-05 — 받아 푼 모델은 모듈 하나가 key 마다 세어 들고 있다(glbCache). 수조 탭을 오갈 때마다 전부 다시 받아 풀었고,
 *   치어 → 어린 → 다 큰 모습으로 자라며 안 쓰는 key(텍스처 768px ≈ 3MB)가 수조를 닫을 때까지 쌓였다.
 *   쓰는 곳이 0 이 되면 잠깐(IDLE_MS) 두었다가 지운다 — 탭을 바로 다시 열면 그대로 쓰고, 안 열면 메모리를 돌려준다. */
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneRig } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "../base.ts";
import { anatomy, bendProfile, finGain, flatBody, flutterGain, hoverPitch, jellyPulse, stepSwim, swimAngles, swimClock, turnCurl, type SwimPose } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { FLUTTER_AMP, lurePoint, membraneWeights } from "./fins.ts";
import { topViewWidths } from "./topview.ts";
import { invertebrateMotion } from "./invertebrates.ts";
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";
export const FISH_GLB: ReadonlySet<string> = new Set(["crucian", "fry_crucian", "juv_crucian", "pale_chub", "fry_pale_chub", "juv_pale_chub", "chinese_minnow", "fry_chinese_minnow", "juv_chinese_minnow", "smelt", "fry_smelt", "juv_smelt", "bullhead", "fry_bullhead", "juv_bullhead", "common_carp", "fry_common_carp", "juv_common_carp", "masu_salmon", "fry_masu_salmon", "juv_masu_salmon", "snakehead", "fry_snakehead", "juv_snakehead", "mandarin_fish", "fry_mandarin_fish", "juv_mandarin_fish", "perch_kkeokji", "fry_perch_kkeokji", "juv_perch_kkeokji", "eel", "fry_eel", "juv_eel", "lenok", "fry_lenok", "juv_lenok", "mackerel", "fry_mackerel", "juv_mackerel", "rockfish_bollak", "fry_rockfish_bollak", "juv_rockfish_bollak", "black_seabream", "fry_black_seabream", "juv_black_seabream", "hairtail", "fry_hairtail", "juv_hairtail", "barred_knifejaw", "fry_barred_knifejaw", "juv_barred_knifejaw", "cutlassfish_pollock", "fry_cutlassfish_pollock", "juv_cutlassfish_pollock", "sailfin_sandfish", "fry_sailfin_sandfish", "juv_sailfin_sandfish", "puffer", "fry_puffer", "juv_puffer", "starfish", "fry_starfish", "juv_starfish", "squid", "fry_squid", "juv_squid", "octopus", "fry_octopus", "juv_octopus", "gulper_eel", "fry_gulper_eel", "juv_gulper_eel", "anglerfish", "fry_anglerfish", "juv_anglerfish", "oarfish", "fry_oarfish", "juv_oarfish", "coelacanth", "fry_coelacanth", "juv_coelacanth", "giant_squid", "fry_giant_squid", "juv_giant_squid", "kraken", "fry_kraken", "juv_kraken", "nurse_shark", "fry_nurse_shark", "juv_nurse_shark", "leopard_shark", "fry_leopard_shark", "juv_leopard_shark", "blue_shark", "fry_blue_shark", "juv_blue_shark", "hammerhead", "fry_hammerhead", "juv_hammerhead", "great_white", "fry_great_white", "juv_great_white", "megamouth", "fry_megamouth", "juv_megamouth", "flounder", "fry_flounder", "juv_flounder", "rockfish", "fry_rockfish", "juv_rockfish", "sea_bream", "fry_sea_bream", "juv_sea_bream", "sea_bass", "fry_sea_bass", "juv_sea_bass", "salmon", "fry_salmon", "juv_salmon", "yellowtail", "fry_yellowtail", "juv_yellowtail", "croaker", "fry_croaker", "juv_croaker", "striped_jack", "fry_striped_jack", "juv_striped_jack", "catfish", "fry_catfish", "juv_catfish", "sweetfish", "fry_sweetfish", "juv_sweetfish", "jellyfish", "fry_jellyfish", "juv_jellyfish", "altum_angel", "aurora_ray", "azure_dragonfish", "black_ray", "blackice_clown", "blue_discus", "bluefin_tuna", "cardinal_tetra", "cobra_guppy", "comet_gold", "crown_betta", "diamond_tetra", "fry_angel", "fry_arowana", "fry_astral", "fry_betta", "fry_bluefin", "fry_clown", "fry_discus", "fry_goldfish", "fry_guppy", "fry_koi", "fry_manta", "fry_ray", "fry_rising", "fry_tetra", "fry_whale_shark", "fullred_guppy", "galaxy_fish", "genesis_fish", "glowlight_tetra", "golden_arowana", "golden_dragonfish", "halfmoon_betta", "imugi_fish", "juv_angel", "juv_arowana", "juv_astral", "juv_betta", "juv_bluefin", "juv_clown", "juv_discus", "juv_goldfish", "juv_guppy", "juv_koi", "juv_manta", "juv_ray", "juv_rising", "juv_tetra", "juv_whale_shark", "kohaku_koi", "koi_betta", "leopard_discus", "marble_angel", "moon_jelly", "mosaic_guppy", "motoro_ray", "neon_tetra", "oceanic_manta", "ocellaris_clown", "ogon_koi", "oranda_gold", "pearl_carp", "pearl_ray", "percula_clown", "pigeon_discus", "platinum_angel", "platinum_arowana", "polka_ray", "ranchu_gold", "red_arowana", "ryukin_gold", "sanke_koi", "showa_koi", "silver_angel", "silver_arowana", "snowflake_clown", "turquoise_discus", "tuxedo_guppy", "veil_betta", "whale_shark"]);
export const DECOR_GLB: ReadonlySet<string> = new Set(["anubias", "coral", "crystal", "diver", "dragon_palace", "driftwood", "feeder_1", "feeder_2", "feeder_3", "filter_1", "filter_2", "filter_3", "glow_kelp", "hanok", "heart_bubbler", "heater_1", "heater_2", "heater_3", "java_fern", "lava_rock", "mailbox", "mermaid", "moon_stone", "moss_ball", "pearl_clam", "pebbles", "red_rotala", "sand_castle", "star_gate", "stone_arch", "stone_pagoda", "sunken_ship", "treasure", "turtle_ship", "vallisneria", "water_lily", "windmill"]);

type Source = (url: string) => Promise<T.Group>;
/** 압축 해제기(meshopt)는 처음 받을 때만 불러온다 — 수조 첫 조각을 키우지 않는다. 압축 안 된 파일도 그대로 읽는다. WebP 텍스처(EXT_texture_webp)는 GLTFLoader 가 기본으로 읽는다 */
let loader: Promise<GLTFLoader> | null = null;
const gltfSource: Source = async (url) => {
  loader ??= import("three/examples/jsm/libs/meshopt_decoder.module.js").then(({ MeshoptDecoder }) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
  return (await (await loader).loadAsync(url)).scene;
};
let source: Source = gltfSource;
/** 시험용 — 파일 대신 만든 모델을 넘긴다(glb.test) */
export function setGlbSource(next: Source | null) { source = next ?? gltfSource; }

type Entry = { promise: Promise<T.Group | null>; scene: T.Group | null; refs: number; idleSince: number };
const entries = new Map<string, Entry>();
/** 아무도 안 쓰는 모델을 들고 있는 시간 · 개수 */
export const GLB_IDLE_MS = 45000, GLB_IDLE_MAX = 64; // 수조 하나(물고기 20 · 장식 32)가 통째로 들어가야 탭을 오가도 다시 안 받는다
let sweepTimer: ReturnType<typeof setTimeout> | null = null;

/** GLB 하나의 형상 · 재질 · 텍스처를 지운다. ⚠ ImageBitmap 은 dispose 로 안 풀린다 — close 해야 디코딩된 픽셀이 돌아간다 */
export function disposeGlbScene(root: T.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const v of Object.values(m)) if (v instanceof T.Texture) {
        if (typeof ImageBitmap !== "undefined" && v.image instanceof ImageBitmap) v.image.close();
        v.dispose();
      }
      m.dispose();
    }
  });
}
function sweep(now = Date.now(), all = false) {
  const idle = [...entries].filter(([, e]) => e.refs <= 0).sort((a, b) => a[1].idleSince - b[1].idleSince);
  idle.forEach(([id, e], i) => {
    if (!all && now - e.idleSince < GLB_IDLE_MS && idle.length - i <= GLB_IDLE_MAX) return;
    entries.delete(id);
    if (e.scene) disposeGlbScene(e.scene); // 받는 중이면 도착할 때 load 가 지운다
  });
  if (sweepTimer) clearTimeout(sweepTimer);
  sweepTimer = null;
  if ([...entries.values()].some((e) => e.refs <= 0) && typeof setTimeout !== "undefined") {
    sweepTimer = setTimeout(() => sweep(), GLB_IDLE_MS + 50);
    (sweepTimer as { unref?: () => void }).unref?.(); // 시험 프로세스를 붙잡지 않는다
  }
}
/** 시험 · 진단용 — 지금 들고 있는 모델과 쓰는 곳 수 */
export const glbCacheState = () => [...entries].map(([id, e]) => ({ id, refs: e.refs, loaded: !!e.scene }));
/** 시험용 — 쓰지 않는 모델을 바로 지운다(시간을 기다리지 않는다) */
export const flushGlbCache = () => sweep(Date.now(), true);

/** 수조 · 미리보기 하나가 쥔 몫. load 한 만큼 release 하고, 닫을 때 dispose 가 남은 몫을 모두 놓는다 */
export class GlbLibrary {
  private held = new Map<string, number>();
  load(kind: "fish" | "decor", key: string): Promise<T.Group | null> {
    const id = `${kind}/${key}`;
    let e = entries.get(id);
    if (!e) {
      const entry: Entry = { scene: null, refs: 0, idleSince: 0, promise: Promise.resolve(null) };
      entry.promise = source(asset(`/aqua/models/${id}.glb`)).then((scene) => {
        // 받는 사이 지워졌다(아무도 안 쓴 채 오래) — 바로 돌려준다
        if (entries.get(id) !== entry) { disposeGlbScene(scene); return null; }
        // 물속 빛 — 물고기는 가장자리 테까지, 장식은 일렁이는 빛만. 원본 재질에 한 번만 단다(복제본이 나눠 쓴다)
        waterLitTree(scene, kind === "fish");
        if (kind === "fish") prepareFishSource(scene, key);
        entry.scene = scene;
        return scene;
      }).catch(() => null); // 못 받으면 임시 모델로 남는다
      e = entry;
      entries.set(id, e);
    }
    e.refs++;
    this.held.set(id, (this.held.get(id) ?? 0) + 1);
    return e.promise;
  }
  /** 이 key 를 쓰던 물고기 · 장식이 떠났다 */
  release(kind: "fish" | "decor", key: string) {
    const id = `${kind}/${key}`, n = this.held.get(id) ?? 0;
    if (n <= 0) return;
    if (n === 1) this.held.delete(id); else this.held.set(id, n - 1);
    const e = entries.get(id);
    if (e && --e.refs <= 0) { e.refs = 0; e.idleSince = Date.now(); sweep(); }
  }
  instance(src: T.Group): T.Group {
    const copy = cloneRig(src) as T.Group;
    copy.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.userData.glbShared = true;
        // 뼈로 휘는 꼬리가 경계 상자 밖으로 나간다 — 원본에서 넉넉한 경계 구를 한 번 잰 물고기만(prepareFishSource) 화면 밖에서 안 그린다.
        // SkinnedMesh.copy 가 그 구를 복제본에 그대로 옮긴다(예전엔 전부 끄고 수조 밖 물고기까지 매 프레임 그렸다). 장식 · 구가 없는 것은 예전처럼
        o.frustumCulled = o instanceof T.SkinnedMesh && !!o.userData.aquaCull && !!o.boundingSphere;
      }
    });
    return copy;
  }
  dispose() {
    const now = Date.now();
    for (const [id, n] of this.held) {
      const e = entries.get(id);
      if (e) { e.refs = Math.max(0, e.refs - n); if (!e.refs) e.idleSince = now; }
    }
    this.held.clear();
    sweep(now);
  }
}

/** 뼈로 휘는 몸의 경계 구 여유 — 쉬는 자세의 구 × 1.3(꼬리 · 팔 · C 자가 휘는 몫) + 막 흔들림 · 갓 숨쉬기 몫(몸 단위, GLB 물고기 길이 약 2) */
export const CULL_PAD = 1.3, CULL_EXTRA = 0.12;
const materialsOf = (o: T.Mesh) => (Array.isArray(o.material) ? o.material : [o.material]);
/** 물고기 원본 한 번(복제본이 나눠 쓴다) —
 *  ① 투명(BLEND) 재질도 깊이를 쓴다: GLTFLoader 는 BLEND 에 depthWrite=false 를 걸어, 따라가며 보는 해파리가 깊이 그림에 없어 피사계 심도가 배경처럼 흐렸다.
 *     양면 투명은 three 가 뒷면 → 앞면 두 번에 나눠 그려(forceSinglePass=false) 갓 안쪽이 깊이에 가려지지 않는다.
 *  ② 쉬는 자세에서 뼈를 거친 경계 구를 재고(SkinnedMesh.computeBoundingSphere) 여유를 준다 — 화면 밖 물고기를 안 그리게(instance) */
export function prepareFishSource(scene: T.Object3D, key = "") {
  scene.updateMatrixWorld(true);
  // ③ 위에서 본 윤곽을 실제 물고기처럼(방추형) — 옆 폭만 한 번 고친다(topview.ts)
  if (fusiform(key)) scene.traverse((o) => { if (o instanceof T.SkinnedMesh) reshapeTopView(o); });
  scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    // 깊이를 쓰는 투명 갓은 뒤의 빛줄기(renderOrder 3) · 유리를 가린다 — 투명한 것들 가운데 맨 마지막에 그려 이미 그려진 뒤쪽은 그대로 두게
    if (materialsOf(o).some((m) => m.transparent)) {
      for (const m of materialsOf(o)) if (m.transparent) m.depthWrite = true;
      o.renderOrder = 4;
    }
    if (o instanceof T.SkinnedMesh) {
      o.computeBoundingSphere();
      const s = o.boundingSphere!;
      s.radius = s.radius * CULL_PAD + CULL_EXTRA;
      o.userData.aquaCull = true;
    }
  });
}

/** 위에서 본 윤곽을 방추형으로 고칠 물고기 — 납작하게 누운 것(광어 · 가오리 · 만타) · 리본(뱀장어 · 갈치 · 산갈치) · 해파리 · 불가사리 · 두족류 · 부푼 복어 · 둥근 난주 · 머리 혹 오란다 · 상상의 물고기는 그대로 */
const NOT_FUSIFORM = /flounder|ray|manta|jelly|starfish|octopus|squid|kraken|eel|oarfish|hairtail|cutlassfish|imugi|puffer|ranchu|oranda|dragonfish|galaxy|genesis|astral|rising/;
export const fusiform = (key: string) => !!key && !NOT_FUSIFORM.test(key);
/** 형상 하나의 옆 폭을 고친다(topview.ts) — 원본 정점 단위로 쓴다(압축본은 int16 · 배율이 역바인드 행렬에). 법선도 같은 비율로(옆으로 줄이면 법선은 옆으로 더 눕는다) */
function reshapeTopView(mesh: T.SkinnedMesh) {
  const g = mesh.geometry;
  if (g.userData.aquaTop) return;
  g.userData.aquaTop = true;
  const pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
  const P = new Float32Array(n * 3), finBone = new Float32Array(n), v = new T.Vector3();
  let rawMin = Infinity, rawMax = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    const x = pos.getX(i);
    if (x < rawMin) rawMin = x;
    if (x > rawMax) rawMax = x;
    if (si && sw) for (let c = 0; c < 4; c++) if (si.getComponent(i, c) >= 6) finBone[i] += sw.getComponent(i, c);
  }
  const s = (maxX - minX) / Math.max(1e-9, rawMax - rawMin);
  if (!(s > 0) || !Number.isFinite(s)) return;
  const uvA = g.attributes.uv, UV = uvA ? new Float32Array(n * 2) : undefined;
  if (uvA && UV) for (let i = 0; i < n; i++) { UV[i * 2] = uvA.getX(i); UV[i * 2 + 1] = uvA.getY(i); }
  const out = topViewWidths(P, finBone, UV);
  if (!out) return;
  if (out.v && uvA) { for (let i = 0; i < n; i++) uvA.setY(i, out.v[i]); uvA.needsUpdate = true; }
  for (let i = 0; i < n; i++) {
    const dz = out.z[i] - P[i * 3 + 2];
    if (dz) pos.setZ(i, pos.getZ(i) + dz / s);
    const k = out.k[i];
    if (nor && k !== 1) { const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i) / k, l = Math.hypot(nx, ny, nz) || 1; nor.setXYZ(i, nx / l, ny / l, nz / l); }
  }
  pos.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
  g.boundingBox = null; g.boundingSphere = null;
}

/** 수조가 크기를 잴 때 쓰는 값 — scene.ts 의 물고기 길이 계산과 같은 식 */
export const measure = (box: T.Box3) => {
  const size = box.getSize(new T.Vector3());
  return Math.max(size.x, size.z, size.y * 1.25);
};
/** 몸과 따로 다는 것(거품 · 왕관) — 몸을 갈아 끼울 때 재지도 지우지도 않는다 */
const kept = (root: T.Object3D) => root.children.filter((c) => c.userData.aquaKeep);

/** root 좌표계에서 잰 몸의 경계(거품 · 왕관 빼고) */
export function bodyBounds(root: T.Object3D): T.Box3 {
  const position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone(), parent = root.parent;
  parent?.remove(root);
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
  const keep = kept(root); for (const k of keep) root.remove(k);
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root);
  for (const k of keep) root.add(k);
  root.position.copy(position); root.quaternion.copy(quaternion); root.scale.copy(scale);
  parent?.add(root);
  root.updateMatrixWorld(true);
  return box;
}

/** root 의 몸을 inner 로 바꾼다 — 크기 · 가운데를 옛 몸에 맞춘다. 떼어 낸 옛 몸(지울 것)을 돌려준다.
 *  ⚠ 거품 · 왕관(userData.aquaKeep)은 남긴다 — 예전엔 장식 거품이 옛 몸과 함께 지워졌고, 왕관까지 재서 왕관 쓴 물고기가 작고 높게 앉았다
 *  measureOf: 몸길이를 재는 식 — 물고기는 엔진이 코드 모델을 키울 때 쓴 것과 같아야 한다(`(s) => bodyMeasure(family, key, s)`).
 *  2026-11-11: 예전엔 늘 max(x, z, 1.25·높이)로 재서, 엔진이 키(y)로 키운 해파리가 갈아 끼우는 순간 0.57~0.76 배로 줄었다 */
export function swapBody(root: T.Group, inner: T.Group, keep: "center" | "base", measureOf: (size: T.Vector3) => number = (s) => Math.max(s.x, s.z, s.y * 1.25)): T.Group {
  const position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.setScalar(1);
  const extras = kept(root);
  for (const k of extras) root.remove(k);
  root.updateMatrixWorld(true);
  const oldBox = new T.Box3().setFromObject(root), before = measureOf(oldBox.getSize(new T.Vector3()));
  const old = new T.Group();
  for (const child of [...root.children]) old.add(child);
  inner.updateMatrixWorld(true);
  inner.scale.setScalar(before / Math.max(0.001, measureOf(new T.Box3().setFromObject(inner).getSize(new T.Vector3()))));
  inner.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(inner), a = oldBox.getCenter(new T.Vector3()), b = box.getCenter(new T.Vector3());
  inner.position.set(a.x - b.x, keep === "center" ? a.y - b.y : oldBox.min.y - box.min.y, a.z - b.z);
  root.add(inner);
  for (const k of extras) root.add(k);
  root.position.copy(position);
  root.quaternion.copy(quaternion);
  root.scale.copy(scale);
  return old;
}

/* ── 지느러미 막 흔들림(2026-11-11) ──────────────────────────────────────────────
 * 막 정점(fins.membraneWeights)만 셰이더에서 옆(z)으로 떤다. 정점 셰이더 몇 줄 — 뼈를 더하지도 GLB 를 다시 굽지도 않는다.
 * ① 정점마다 값 하나(aquaFin: 떠는 폭 · 몸 앞뒤 자리)를 형상마다 한 번 계산해 둔다(같은 key 복제본이 나눠 쓴다 — glbShared).
 *    폭은 '원본 정점 단위'로 담는다: 압축본(KHR_mesh_quantization)은 위치가 int16 정수이고 배율 s 가 역바인드 행렬에 들어 있어서,
 *    뼈를 거치기 전(begin_vertex 바로 뒤)에 더하는 값도 정수 단위여야 몸 단위로 맞다(몸 단위 폭 ÷ s). 그래서 뼈로 휘는 것과도 그대로 겹친다.
 * ② 물고기마다 다른 박자 · 세기는 그 물고기 뼈대의 뼈 텍스처 남는 칸에 쓴다 — 재질이 같은 key 끼리 공유라 재질 uniform 은
 *    물고기마다 못 바꾼다(three 는 같은 재질이 이어지면 uniform 을 다시 안 올린다 — uniformsNeedUpdate 는 ShaderMaterial 전용).
 *    뼈 10개 뼈대의 뼈 텍스처는 8×8(행렬 16개 자리)이라 11번째 행렬 자리가 빈다(three r187 Skeleton.computeBoneTexture — 시험이 잠근다).
 *    세기 0 = 꺼짐(칸이 비어 있으면 0 이라 떨지 않는다). */
const FIN_KEY = "aqua-fin-v1";
const FIN_PHASE_ALONG = 6; // 막을 따라 물결이 머리 → 꼬리로 지나가는 몫(rad, 몸 전체)
/** 형상 하나에 막 값을 단다 — 이미 있으면 그대로. 막이 거의 없으면(가중치 합이 작다) 달지 않는다 */
function ensureFinAttribute(mesh: T.SkinnedMesh): boolean {
  const g = mesh.geometry;
  if (g.userData.aquaFin !== undefined) return g.userData.aquaFin as boolean;
  const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
  const P = new Float32Array(n * 3), finBone = new Float32Array(n), v = new T.Vector3();
  let rawMin = Infinity, rawMax = -Infinity;
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    const x = pos.getX(i); if (x < rawMin) rawMin = x; if (x > rawMax) rawMax = x;
    if (si && sw) for (let c = 0; c < 4; c++) if (si.getComponent(i, c) >= 6) finBone[i] += sw.getComponent(i, c);
  }
  const { w, u } = membraneWeights(P, finBone);
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, P[i * 3]); maxX = Math.max(maxX, P[i * 3]); }
  const L = maxX - minX, s = L / Math.max(1e-9, rawMax - rawMin); // 몸 단위 ÷ 원본 정점 단위(압축본은 int16 배율)
  let total = 0;
  const data = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { data[i * 2] = (w[i] * FLUTTER_AMP * L) / s; data[i * 2 + 1] = u[i]; total += w[i]; }
  const ok = total > 4 && Number.isFinite(s) && s > 0;
  if (ok) g.setAttribute("aquaFin", new T.BufferAttribute(data, 2));
  g.userData.aquaFin = ok;
  return ok;
}
/** 재질 하나에 막 흔들림을 단다(물속 빛 waterLit 의 onBeforeCompile · 캐시 키를 감싼다 — 바꿔 끼우지 않는다) */
function patchFinMaterial(material: T.Material, slot: number) {
  if (!(material instanceof T.MeshStandardMaterial) || material.userData.aquaFin) return;
  material.userData.aquaFin = slot;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aquaFin;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_SKINNING
        {
          int aquaS = textureSize( boneTexture, 0 ).x;
          int aquaJ = ${slot} * 4;
          vec4 aquaNow = texelFetch( boneTexture, ivec2( aquaJ % aquaS, aquaJ / aquaS ), 0 );
          transformed.z += aquaFin.x * aquaNow.y * sin( aquaNow.x + aquaFin.y * ${FIN_PHASE_ALONG.toFixed(1)} );
        }
        #endif`);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|${FIN_KEY}|${slot}`;
  material.needsUpdate = true;
}
/** 뼈 텍스처의 남는 칸(뼈 수번째 행렬 자리) — 없으면 null(그땐 막이 안 떤다) */
function finSlot(sk: T.Skeleton) {
  if (!sk.boneTexture) sk.computeBoneTexture(); // 그리기 전에 만든다 — 렌더러가 늦게 만들면 그 전의 쓰기는 배열 밖이라 조용히 버려진다
  return sk.boneMatrices && sk.boneMatrices.length >= (sk.bones.length + 1) * 16 ? sk.bones.length * 16 : -1;
}
/** 셰이더가 읽는 막 값 — CPU 에서 같은 식(시험 · 측정용). 정점 i 의 옆(z) 변위, 몸 단위 */
export function finDisplacement(weight: number, along: number, phase: number, gain: number) {
  return weight * FLUTTER_AMP * gain * Math.sin(phase + along * FIN_PHASE_ALONG);
}

/* ── 아귀 초롱(2026-11-11) ─────────────────────────────────────────────────────
 * 예전엔 GLB 가 바탕 그림 전체를 빛 그림(emissiveMap)으로 써서 몸 전체가 은은히 빛나고 초롱은 따로 안 빛났다.
 * 몸의 빛은 끄고(materialTweak 에 빛이 없으면 재질의 빛 색을 검게 — 그림은 그대로라 셰이더를 다시 안 짓는다),
 * 유인돌기 끝(fins.lurePoint)에 작은 더하기 빛 스프라이트를 머리 뼈에 붙인다. 후처리 빛 번짐이 둘레를 번지게 한다. */
let lureMaterial: T.SpriteMaterial | null = null;
function lureGlow() {
  if (lureMaterial) return lureMaterial;
  const N = 32, px = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2), a = Math.max(0, 1 - r) ** 1.5, i = (y * N + x) * 4;
    px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = Math.round(a * 255);
  }
  const tex = new T.DataTexture(px, N, N); tex.needsUpdate = true; tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter;
  lureMaterial = new T.SpriteMaterial({ map: tex, color: 0xa8fff0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false }); // 더하기 빛에 안개를 섞으면 멀리서 안개 색이 더해져 뿌옇게 뜬다
  return lureMaterial;
}
function attachLure(inner: T.Group, mesh: T.SkinnedMesh): T.Sprite | null {
  const g = mesh.geometry;
  if (g.userData.aquaLure === undefined) {
    const n = g.attributes.position.count, P = new Float32Array(n * 3), v = new T.Vector3();
    for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    g.userData.aquaLure = lurePoint(P);
  }
  const at = g.userData.aquaLure as [number, number, number] | null, head = inner.getObjectByName("spine_0");
  if (!at || !head) return null;
  inner.updateMatrixWorld(true);
  const sprite = new T.Sprite(lureGlow());
  sprite.name = "anglerfish-lure"; sprite.userData.glbShared = true; sprite.raycast = () => {};
  sprite.position.copy(head.worldToLocal(mesh.localToWorld(new T.Vector3(...at))));
  // 크기는 몸 단위로(몸 길이 약 2 의 15% — 빛무리까지, 가운데만 밝다) — 뼈의 월드 배율을 되돌려 몸 단위로 맞춘다
  const k = mesh.getWorldScale(new T.Vector3()).x / Math.max(1e-6, head.getWorldScale(new T.Vector3()).x);
  sprite.scale.setScalar(0.3 * k); sprite.userData.base = 0.3 * k;
  head.add(sprite);
  return sprite;
}

type Rig = { bone: T.Object3D; base: T.Quaternion; pos: T.Vector3; scale: T.Vector3 };
/** 물고기 헤엄 — 코드 모델과 같은 박자 · 크기. 뼈의 처음 자세 위에 더한다.
 *  갈아 끼운 순간 한 번 불린다 — 그때 이 물고기의 몸 준비(막 흔들림 · 초롱 · 몸 빛 끄기)도 한다.
 *  pose 는 전부 선택이다 — 엔진이 지금처럼 course 만 넘겨도 된다(hover 는 course 에 이미 있다).
 *  빠르기: pose.speed 가 없으면 몸이 실제로 움직인 거리 ÷ 물속 시계(WATER_LIGHT.aquaTime — 엔진이 프레임마다 elapsed 로 맞춘다)로 잰다. 시계가 안 가면(시험) 옛 박자 그대로 */
export function fishMotion(inner: T.Group, family: string, key: string): (time: number, effort: number, pose?: SwimPose) => void {
  const a = anatomy(family, key);
  if (a.kind === "star") return invertebrateMotion(inner, family, key);
  const jelly = a.kind === "jelly", ceph = a.kind === "cephalopod", flat = flatBody(family, key);
  const rig = (name: string): Rig | null => {
    const bone = inner.getObjectByName(name);
    return bone ? { bone, base: bone.quaternion.clone(), pos: bone.position.clone(), scale: bone.scale.clone() } : null;
  };
  const spine = [0, 1, 2, 3, 4, 5].map((i) => rig(`spine_${i}`));
  const fins = ["fin_L", "fin_L_tip", "fin_R", "fin_R_tip"].map(rig);
  const q = new T.Quaternion(), q2 = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);
  const turn = (r: Rig | null, axis: T.Vector3, angle: number, axis2?: T.Vector3, angle2 = 0) => {
    if (!r) return;
    r.bone.quaternion.copy(r.base).multiply(q.setFromAxisAngle(axis, angle));
    if (axis2 && angle2) r.bone.quaternion.multiply(q2.setFromAxisAngle(axis2, angle2));
  };
  let mesh: T.SkinnedMesh | null = null;
  inner.traverse((o) => { if (!mesh && o instanceof T.SkinnedMesh) mesh = o; });
  const body = mesh as T.SkinnedMesh | null;
  // 몸 빛 — 표에 빛이 없는 종은 GLB 가 넣어 둔 빛(아귀: 몸 전체)을 끈다. 색만 검게(그림은 그대로 — 셰이더를 다시 안 짓는다)
  const tweak = materialTweak(family, key);
  if (body && tweak.emissiveIntensity === 0 && !tweak.emissiveFromMap) for (const m of materialsOf(body)) if (m instanceof T.MeshStandardMaterial) m.emissive.setHex(0);
  // 막 흔들림 — 몸통 물고기 · 용만(해파리 갓 · 가오리 날개 · 두족류 팔 · 누운 광어의 가장자리는 이미 뼈로 움직인다)
  let finData: Float32Array | null = null, finAt = -1;
  const sk = body?.skeleton;
  if (body && sk && (a.kind === "fish" || a.kind === "dragon") && !flat) {
    inner.updateMatrixWorld(true);
    if (ensureFinAttribute(body)) {
      finAt = finSlot(sk);
      if (finAt >= 0) { for (const m of materialsOf(body)) patchFinMaterial(m, sk.bones.length); finData = sk.boneMatrices as Float32Array; }
    }
  }
  const lure = body && family === "anglerfish" ? attachLure(inner, body) : null;

  // 몸 물결은 코드 모델과 같은 표(anatomy.bendProfile · swimAngles) — 예전엔 GLB 만 모든 종이 같은 물결이라 장어도 참치처럼 헤엄쳤다
  const wave = bendProfile(family, key), angles = new Float32Array(10), bell = { x: 1, y: 1, z: 1 }, clock = swimClock();
  const sp: SwimPose = {}, lastP = new T.Vector3(), scaleW = new T.Vector3();
  let lastT = -1, bodyLength = 0;
  // 두족류: 외투막 앞 마디(spine_3) 자리를 제자리에 묶는다 — 뼈 사슬의 뿌리(spine_0)가 팔 끝이라 팔을 흔들면 외투막이 통째로 옆으로 밀린다
  const offsets = spine.map((r) => (r ? { x: r.pos.x, z: r.pos.z } : { x: 0, z: 0 }));
  return (time, effort, pose) => {
    const t = time * Math.max(0.2, effort);
    if (jelly) {
      const phase = t * a.frequency;
      spine.forEach((r, i) => turn(r, Z, Math.sin(phase - i * 0.6) * (0.045 + i * 0.012)));
      // GLB 해파리는 갓의 축이 +X 다(코드 모델은 Y) — 그 축으로 오므렸다 편다. 몸은 엔진이 glbUpright 로 세운다
      if (spine[0]) {
        jellyPulse(pose?.pulse ?? Math.sin(phase), "x", bell);
        spine[0].bone.scale.set(bell.x, bell.y, bell.z);
      }
      return;
    }
    // 이번 프레임 초 · 실제 빠르기(몸길이/초)
    const now = WATER_LIGHT.aquaTime.value, dt = pose?.dt ?? (lastT >= 0 ? now - lastT : 0);
    lastT = now;
    let speed = pose?.speed;
    const holder = inner.parent;
    if (speed === undefined && holder && dt > 0 && dt < 0.25) {
      if (!bodyLength) bodyLength = 2 * (body ? body.getWorldScale(scaleW).x : holder.scale.x); // GLB 물고기는 몸 단위 길이 약 2
      const v = holder.position.distanceTo(lastP) / dt / Math.max(1e-6, bodyLength);
      if (v < 20) speed = v; // 순간이동(처음 · 수조 바뀜)은 빼고
    }
    if (holder) lastP.copy(holder.position);
    sp.turn = pose?.turn; sp.effort = pose?.effort; sp.amp = pose?.amp; sp.pulse = pose?.pulse; sp.hover = pose?.hover; sp.ground = pose?.ground; sp.feed = pose?.feed; sp.speed = speed;
    stepSwim(clock, a, wave, t, dt, sp);
    const phase = clock.beat;
    swimAngles(wave, phase, sp, angles, !flat);
    if (wave.kind !== "ray") {
      // 가슴지느러미 — 떠 있으면 작게 빨리 젓고(노 젓기), 급히 돌거나 먹이에 몰리면 활짝
      const g = finGain(clock, sp);
      for (let s = 0; s < 2; s++) { const sign = s ? 1 : -1; angles[6 + s * 2] = sign * Math.sin(clock.fin) * wave.fin * g; angles[7 + s * 2] = sign * Math.sin(clock.fin - 0.7) * wave.fin * 1.3 * g; }
    }
    if (ceph) {
      // angles 는 마디의 절대 방향 — 이웃 마디와의 차이로 돌리고, 외투막 앞 마디가 제자리에 오게 뿌리를 옮긴다
      let px = 0, pz = 0, rx = 0, rz = 0;
      for (let i = 0; i < 6; i++) {
        turn(spine[i], Y, angles[i] - (i ? angles[i - 1] : 0));
        if (i >= 1 && i <= 3) {
          const o = offsets[i], f = angles[i - 1], c = Math.cos(f), s = Math.sin(f);
          px += o.x * c + o.z * s; pz += -o.x * s + o.z * c; rx += o.x; rz += o.z;
        }
      }
      const root = spine[0];
      if (root) root.bone.position.set(root.pos.x + rx - px, root.pos.y, root.pos.z + rz - pz);
      // 물 뿜기 — 외투막이 천천히 부풀었다 빠르게 오므리며 길어진다(코드 모델 invertebrateMotion 과 같은 뜻)
      const mantle = spine[3];
      if (mantle) { const j = Math.max(0, Math.sin(phase * 0.5)) ** 3; mantle.bone.scale.set(mantle.scale.x * (1 + 0.05 * j), mantle.scale.y * (1 - 0.08 * j), mantle.scale.z * (1 - 0.08 * j)); }
    } else if (flat) {
      // 누운 몸 — 물결은 Z 축(위아래), 도는 C 자는 Y 축(모래 평면)
      spine.forEach((r, i) => turn(r, Z, angles[i], Y, turnCurl(wave, sp, i)));
    } else {
      spine.forEach((r, i) => turn(r, Y, angles[i], i === 0 ? Z : undefined, i === 0 ? hoverPitch(clock, sp) : 0));
    }
    fins.forEach((r, i) => turn(r, X, angles[6 + i]));
    if (finData && body) {
      if (body.skeleton.boneMatrices !== finData) { finAt = finSlot(body.skeleton); finData = finAt >= 0 ? (body.skeleton.boneMatrices as Float32Array) : null; }
      if (finData) { finData[finAt] = clock.flutter; finData[finAt + 1] = flutterGain(clock, sp); }
    }
    if (lure) lure.scale.setScalar((lure.userData.base as number) * (1 + 0.12 * Math.sin(clock.bob * 3.1)));
  };
}

/** 움직이는 부품 — 풍차 날개는 돌고, 뚜껑은 살짝 여닫힌다 */
export function decorMotion(inner: T.Group): (time: number) => void {
  const blades = inner.getObjectByName("moving_windmill_blades");
  const lids = [inner.getObjectByName("moving_treasure_lid"), inner.getObjectByName("moving_clam_lid")].filter((o): o is T.Object3D => !!o);
  const lidBase = lids.map((o) => o.rotation.x);
  // 움직이는 노드 표시 — 수조가 묶어 그릴 때 이 밑만 매 프레임 행렬을 올린다
  for (const o of [blades, ...lids]) if (o) o.userData.moving = true;
  return (time) => {
    if (blades) blades.rotation.z = time * 0.22; // 노드 원점이 곧 축이다
    lids.forEach((o, i) => { o.rotation.x = lidBase[i] + Math.sin(time * 0.8) * 0.03; });
  };
}
