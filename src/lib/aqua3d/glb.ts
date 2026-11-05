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
import { anatomy, bendProfile, jellyPulse, swimAngles, type SwimPose } from "./anatomy.ts";
import { invertebrateMotion } from "./invertebrates.ts";
import { waterLitTree } from "./waterlight.ts";
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
        o.frustumCulled = false; // 뼈로 휘는 꼬리가 경계 상자 밖으로 나간다
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
 *  ⚠ 거품 · 왕관(userData.aquaKeep)은 남긴다 — 예전엔 장식 거품이 옛 몸과 함께 지워졌고, 왕관까지 재서 왕관 쓴 물고기가 작고 높게 앉았다 */
export function swapBody(root: T.Group, inner: T.Group, keep: "center" | "base"): T.Group {
  const position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.setScalar(1);
  const extras = kept(root);
  for (const k of extras) root.remove(k);
  root.updateMatrixWorld(true);
  const oldBox = new T.Box3().setFromObject(root), before = measure(oldBox);
  const old = new T.Group();
  for (const child of [...root.children]) old.add(child);
  inner.updateMatrixWorld(true);
  inner.scale.setScalar(before / Math.max(0.001, measure(new T.Box3().setFromObject(inner))));
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

/** 물고기 헤엄 — 코드 모델과 같은 박자 · 크기. 뼈의 처음 자세 위에 더한다. */
export function fishMotion(inner: T.Group, family: string, key: string): (time: number, effort: number, pose?: SwimPose) => void {
  if (anatomy(family, key).kind === "star") return invertebrateMotion(inner, family, key);
  const a = anatomy(family, key), jelly = a.kind === "jelly";
  const rig = (name: string) => {
    const bone = inner.getObjectByName(name);
    return bone ? { bone, base: bone.quaternion.clone() } : null;
  };
  const spine = [0, 1, 2, 3, 4, 5].map((i) => rig(`spine_${i}`));
  const fins = ["fin_L", "fin_L_tip", "fin_R", "fin_R_tip"].map(rig);
  const q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);
  const turn = (r: { bone: T.Object3D; base: T.Quaternion } | null, axis: T.Vector3, angle: number) => {
    if (r) r.bone.quaternion.copy(r.base).multiply(q.setFromAxisAngle(axis, angle));
  };
  // 몸 물결은 코드 모델과 같은 표(anatomy.bendProfile · swimAngles) — 예전엔 GLB 만 모든 종이 같은 물결이라 장어도 참치처럼 헤엄쳤다
  const wave = bendProfile(family, key), angles = new Float32Array(10), bell = { x: 1, y: 1, z: 1 };
  return (time, effort, pose) => {
    const phase = time * a.frequency * Math.max(0.2, effort);
    if (jelly) {
      spine.forEach((r, i) => turn(r, Z, Math.sin(phase - i * 0.6) * (0.045 + i * 0.012)));
      // GLB 해파리는 갓의 축이 +X 다(코드 모델은 Y) — 그 축으로 오므렸다 편다. 몸은 엔진이 glbUpright 로 세운다
      if (spine[0]) {
        jellyPulse(pose?.pulse ?? Math.sin(phase), "x", bell);
        spine[0].bone.scale.set(bell.x, bell.y, bell.z);
      }
      return;
    }
    swimAngles(wave, phase, pose, angles);
    spine.forEach((r, i) => turn(r, Y, angles[i]));
    fins.forEach((r, i) => turn(r, X, angles[6 + i]));
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
