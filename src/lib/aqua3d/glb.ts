/* 제작한 3D 모델(GLB) — 있는 모델은 코드로 지은 임시 모델을 곧바로 갈아 끼운다. 받는 동안 · 실패해도 임시 모델이 그대로 보여서 수조가 비지 않는다.
 * 파일은 public/aqua/models(물고기 81 · 장식 37, 2026-11-03 사용자 승인 — design/aqua3d-review/stage-status.json). 바다거북 셋은 전용 코드 모델이라 없다. 목록이 파일과 같은지 gamepolish.test 가 본다.
 * 좌표: 위 +Y · 물고기 앞 +X(몸 가운데 원점) · 장식 앞 +Z(바닥 가운데 원점). 같은 물고기 여러 마리는 형상 · 재질을 나눠 쓴다(userData.glbShared — 한 마리 떠날 때 지우면 안 된다). */
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneRig } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "../base.ts";
import { anatomy } from "./anatomy.ts";

export const FISH_GLB: ReadonlySet<string> = new Set(["nurse_shark", "fry_nurse_shark", "juv_nurse_shark", "leopard_shark", "fry_leopard_shark", "juv_leopard_shark", "blue_shark", "fry_blue_shark", "juv_blue_shark", "hammerhead", "fry_hammerhead", "juv_hammerhead", "great_white", "fry_great_white", "juv_great_white", "megamouth", "fry_megamouth", "juv_megamouth", "flounder", "fry_flounder", "juv_flounder", "rockfish", "fry_rockfish", "juv_rockfish", "sea_bream", "fry_sea_bream", "juv_sea_bream", "sea_bass", "fry_sea_bass", "juv_sea_bass", "salmon", "fry_salmon", "juv_salmon", "yellowtail", "fry_yellowtail", "juv_yellowtail", "croaker", "fry_croaker", "juv_croaker", "striped_jack", "fry_striped_jack", "juv_striped_jack", "catfish", "fry_catfish", "juv_catfish", "sweetfish", "fry_sweetfish", "juv_sweetfish", "jellyfish", "fry_jellyfish", "juv_jellyfish", "altum_angel", "aurora_ray", "azure_dragonfish", "black_ray", "blackice_clown", "blue_discus", "bluefin_tuna", "cardinal_tetra", "cobra_guppy", "comet_gold", "crown_betta", "diamond_tetra", "fry_angel", "fry_arowana", "fry_astral", "fry_betta", "fry_bluefin", "fry_clown", "fry_discus", "fry_goldfish", "fry_guppy", "fry_koi", "fry_manta", "fry_ray", "fry_rising", "fry_tetra", "fry_whale_shark", "fullred_guppy", "galaxy_fish", "genesis_fish", "glowlight_tetra", "golden_arowana", "golden_dragonfish", "halfmoon_betta", "imugi_fish", "juv_angel", "juv_arowana", "juv_astral", "juv_betta", "juv_bluefin", "juv_clown", "juv_discus", "juv_goldfish", "juv_guppy", "juv_koi", "juv_manta", "juv_ray", "juv_rising", "juv_tetra", "juv_whale_shark", "kohaku_koi", "koi_betta", "leopard_discus", "marble_angel", "moon_jelly", "mosaic_guppy", "motoro_ray", "neon_tetra", "oceanic_manta", "ocellaris_clown", "ogon_koi", "oranda_gold", "pearl_carp", "pearl_ray", "percula_clown", "pigeon_discus", "platinum_angel", "platinum_arowana", "polka_ray", "ranchu_gold", "red_arowana", "ryukin_gold", "sanke_koi", "showa_koi", "silver_angel", "silver_arowana", "snowflake_clown", "turquoise_discus", "tuxedo_guppy", "veil_betta", "whale_shark"]);
export const DECOR_GLB: ReadonlySet<string> = new Set(["anubias", "coral", "crystal", "diver", "dragon_palace", "driftwood", "feeder_1", "feeder_2", "feeder_3", "filter_1", "filter_2", "filter_3", "glow_kelp", "hanok", "heart_bubbler", "heater_1", "heater_2", "heater_3", "java_fern", "lava_rock", "mailbox", "mermaid", "moon_stone", "moss_ball", "pearl_clam", "pebbles", "red_rotala", "sand_castle", "star_gate", "stone_arch", "stone_pagoda", "sunken_ship", "treasure", "turtle_ship", "vallisneria", "water_lily", "windmill"]);

export class GlbLibrary {
  private cache = new Map<string, Promise<T.Group | null>>();
  private loaded: T.Group[] = [];
  private loader = new GLTFLoader();
  load(kind: "fish" | "decor", key: string): Promise<T.Group | null> {
    const id = `${kind}/${key}`;
    let p = this.cache.get(id);
    if (!p) {
      p = this.loader.loadAsync(asset(`/aqua/models/${id}.glb`)).then((g) => {
        this.loaded.push(g.scene);
        return g.scene;
      }).catch(() => null); // 못 받으면 임시 모델로 남는다
      this.cache.set(id, p);
    }
    return p;
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
    for (const root of this.loaded) root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(m)) if (v instanceof T.Texture) v.dispose();
        m.dispose();
      }
    });
    this.loaded = [];
    this.cache.clear();
  }
}

/** 수조가 크기를 잴 때 쓰는 값 — scene.ts 의 물고기 길이 계산과 같은 식 */
const measure = (o: T.Object3D) => {
  const size = new T.Box3().setFromObject(o).getSize(new T.Vector3());
  return Math.max(size.x, size.z, size.y * 1.25);
};

/** root 의 몸을 inner 로 바꾼다 — 크기 · 가운데를 옛 몸에 맞춘다. 떼어 낸 옛 몸(지울 것)을 돌려준다. */
export function swapBody(root: T.Group, inner: T.Group, keep: "center" | "base"): T.Group {
  const position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  const before = measure(root), oldBox = new T.Box3().setFromObject(root);
  const old = new T.Group();
  for (const child of [...root.children]) old.add(child);
  inner.updateMatrixWorld(true);
  inner.scale.setScalar(before / Math.max(0.001, measure(inner)));
  inner.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(inner), a = oldBox.getCenter(new T.Vector3()), b = box.getCenter(new T.Vector3());
  inner.position.set(a.x - b.x, keep === "center" ? a.y - b.y : oldBox.min.y - box.min.y, a.z - b.z);
  root.add(inner);
  root.position.copy(position);
  root.quaternion.copy(quaternion);
  root.scale.copy(scale);
  return old;
}

/** 물고기 헤엄 — 코드 모델과 같은 박자 · 크기. 뼈의 처음 자세 위에 더한다. */
export function fishMotion(inner: T.Group, family: string, key: string): (time: number, effort: number) => void {
  const a = anatomy(family, key), jelly = a.kind === "jelly", ray = a.kind === "ray";
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
  return (time, effort) => {
    const phase = time * a.frequency * Math.max(0.2, effort);
    spine.forEach((r, i) => {
      if (jelly) turn(r, Z, Math.sin(phase - i * 0.6) * (0.045 + i * 0.012));
      else if (ray) turn(r, Y, Math.sin(phase - i * 0.62) * 0.025);
      else turn(r, Y, Math.sin(phase - i * 0.62) * (0.02 + i * 0.018));
    });
    fins.forEach((r, i) => {
      const sign = i < 2 ? -1 : 1, tip = i % 2 === 1;
      const amp = ray ? (tip ? 0.3 : 0.34) : a.flex * (tip ? 1.3 : 1);
      turn(r, X, sign * Math.sin(phase - (tip ? 0.7 : 0)) * amp);
    });
    if (jelly && spine[0]) {
      const s = Math.sin(phase);
      spine[0].bone.scale.set(1 + s * 0.055, 1 - s * 0.065, 1 + s * 0.055);
    }
  };
}

/** 움직이는 부품 — 풍차 날개는 돌고, 뚜껑은 살짝 여닫힌다 */
export function decorMotion(inner: T.Group): (time: number) => void {
  const blades = inner.getObjectByName("moving_windmill_blades");
  const lids = [inner.getObjectByName("moving_treasure_lid"), inner.getObjectByName("moving_clam_lid")].filter((o): o is T.Object3D => !!o);
  const lidBase = lids.map((o) => o.rotation.x);
  return (time) => {
    if (blades) blades.rotation.z = time * 0.22; // 노드 원점이 곧 축이다
    lids.forEach((o, i) => { o.rotation.x = lidBase[i] + Math.sin(time * 0.8) * 0.03; });
  };
}
