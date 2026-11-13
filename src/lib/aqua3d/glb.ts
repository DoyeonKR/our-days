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
import { breathOf, cephArmData, cephGlsl, octopusLike } from "./cephalopod.ts";
import { MAMMAL, RIBBON_FIN, SHARKS, anatomy, verticalWave, bendProfile, finGain, flatBody, flutterGain, hoverPitch, jellyPulse, stepSwim, swimAngles, swimClock, turnCurl, type SwimPose } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { FLUTTER_AMP, lurePoint, membraneWeights } from "./fins.ts";
import { topViewWidths } from "./topview.ts";
import { invertebrateMotion } from "./invertebrates.ts";
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";
import {createFishFace} from './faces.ts';
import {fishRevisionQuery} from './model-revisions.ts';
export const FISH_GLB: ReadonlySet<string> = new Set(["fry_spotted_seal", "juv_spotted_seal", "spotted_seal", "fry_fur_seal", "juv_fur_seal", "fur_seal", "fry_steller_sea_lion", "juv_steller_sea_lion", "steller_sea_lion", "fry_japanese_sea_lion", "juv_japanese_sea_lion", "japanese_sea_lion", "fry_sea_otter", "juv_sea_otter", "sea_otter", "fry_otter", "juv_otter", "otter", "bitterling", "fry_bitterling", "juv_bitterling", "hatchetfish", "fry_hatchetfish", "juv_hatchetfish", "gourami", "fry_gourami", "juv_gourami", "boxfish", "fry_boxfish", "juv_boxfish", "butterflyfish", "fry_butterflyfish", "juv_butterflyfish", "mudskipper", "fry_mudskipper", "juv_mudskipper", "sleeper", "fry_sleeper", "juv_sleeper", "gudgeon", "fry_gudgeon", "juv_gudgeon", "scorpionfish", "fry_scorpionfish", "juv_scorpionfish", "halfbeak", "fry_halfbeak", "juv_halfbeak", "pleco", "fry_pleco", "juv_pleco", "shiri", "fry_shiri", "juv_shiri", "blue_tang", "fry_blue_tang", "juv_blue_tang", "filefish", "fry_filefish", "juv_filefish", "oscar", "fry_oscar", "juv_oscar", "largemouth_bass", "fry_largemouth_bass", "juv_largemouth_bass", "rainbow_trout", "fry_rainbow_trout", "juv_rainbow_trout", "skygazer", "fry_skygazer", "juv_skygazer", "cod", "fry_cod", "juv_cod", "spanish_mackerel", "fry_spanish_mackerel", "juv_spanish_mackerel", "seahorse", "fry_seahorse", "juv_seahorse", "viperfish", "fry_viperfish", "juv_viperfish", "goosefish", "fry_goosefish", "juv_goosefish", "grouper", "fry_grouper", "juv_grouper", "dolphinfish", "fry_dolphinfish", "juv_dolphinfish", "redtail_catfish", "fry_redtail_catfish", "juv_redtail_catfish", "sturgeon", "fry_sturgeon", "juv_sturgeon", "ricefish", "fry_ricefish", "juv_ricefish", "zebra_danio", "fry_zebra_danio", "juv_zebra_danio", "corydoras", "fry_corydoras", "juv_corydoras", "platy", "fry_platy", "juv_platy", "lanternfish", "fry_lanternfish", "juv_lanternfish", "molly", "fry_molly", "juv_molly", "anchovy", "fry_anchovy", "juv_anchovy", "dark_chub", "fry_dark_chub", "juv_dark_chub", "goby", "fry_goby", "juv_goby", "loach", "fry_loach", "juv_loach", "bluegill", "fry_bluegill", "juv_bluegill", "saury", "fry_saury", "juv_saury", "blobfish", "fry_blobfish", "juv_blobfish", "lionfish", "fry_lionfish", "juv_lionfish", "piranha", "fry_piranha", "juv_piranha", "char", "fry_char", "juv_char", "parrotfish", "fry_parrotfish", "juv_parrotfish", "moray", "fry_moray", "juv_moray", "barracuda", "fry_barracuda", "juv_barracuda", "grass_carp", "fry_grass_carp", "juv_grass_carp", "skate", "fry_skate", "juv_skate", "electric_eel", "fry_electric_eel", "juv_electric_eel", "frilled_shark", "fry_frilled_shark", "juv_frilled_shark", "arapaima", "fry_arapaima", "juv_arapaima", "sunfish", "fry_sunfish", "juv_sunfish", "marlin", "fry_marlin", "juv_marlin", "swordfish", "fry_swordfish", "juv_swordfish", "crucian", "fry_crucian", "juv_crucian", "pale_chub", "fry_pale_chub", "juv_pale_chub", "chinese_minnow", "fry_chinese_minnow", "juv_chinese_minnow", "smelt", "fry_smelt", "juv_smelt", "bullhead", "fry_bullhead", "juv_bullhead", "common_carp", "fry_common_carp", "juv_common_carp", "masu_salmon", "fry_masu_salmon", "juv_masu_salmon", "snakehead", "fry_snakehead", "juv_snakehead", "mandarin_fish", "fry_mandarin_fish", "juv_mandarin_fish", "perch_kkeokji", "fry_perch_kkeokji", "juv_perch_kkeokji", "eel", "fry_eel", "juv_eel", "lenok", "fry_lenok", "juv_lenok", "mackerel", "fry_mackerel", "juv_mackerel", "rockfish_bollak", "fry_rockfish_bollak", "juv_rockfish_bollak", "black_seabream", "fry_black_seabream", "juv_black_seabream", "hairtail", "fry_hairtail", "juv_hairtail", "barred_knifejaw", "fry_barred_knifejaw", "juv_barred_knifejaw", "cutlassfish_pollock", "fry_cutlassfish_pollock", "juv_cutlassfish_pollock", "sailfin_sandfish", "fry_sailfin_sandfish", "juv_sailfin_sandfish", "puffer", "fry_puffer", "juv_puffer", "starfish", "fry_starfish", "juv_starfish", "squid", "fry_squid", "juv_squid", "octopus", "fry_octopus", "juv_octopus", "gulper_eel", "fry_gulper_eel", "juv_gulper_eel", "anglerfish", "fry_anglerfish", "juv_anglerfish", "oarfish", "fry_oarfish", "juv_oarfish", "coelacanth", "fry_coelacanth", "juv_coelacanth", "giant_squid", "fry_giant_squid", "juv_giant_squid", "kraken", "fry_kraken", "juv_kraken", "nurse_shark", "fry_nurse_shark", "juv_nurse_shark", "leopard_shark", "fry_leopard_shark", "juv_leopard_shark", "blue_shark", "fry_blue_shark", "juv_blue_shark", "hammerhead", "fry_hammerhead", "juv_hammerhead", "great_white", "fry_great_white", "juv_great_white", "megamouth", "fry_megamouth", "juv_megamouth", "flounder", "fry_flounder", "juv_flounder", "rockfish", "fry_rockfish", "juv_rockfish", "sea_bream", "fry_sea_bream", "juv_sea_bream", "sea_bass", "fry_sea_bass", "juv_sea_bass", "salmon", "fry_salmon", "juv_salmon", "yellowtail", "fry_yellowtail", "juv_yellowtail", "croaker", "fry_croaker", "juv_croaker", "striped_jack", "fry_striped_jack", "juv_striped_jack", "catfish", "fry_catfish", "juv_catfish", "sweetfish", "fry_sweetfish", "juv_sweetfish", "jellyfish", "fry_jellyfish", "juv_jellyfish", "altum_angel", "aurora_ray", "azure_dragonfish", "black_ray", "blackice_clown", "blue_discus", "bluefin_tuna", "cardinal_tetra", "cobra_guppy", "comet_gold", "crown_betta", "diamond_tetra", "fry_angel", "fry_arowana", "fry_astral", "fry_betta", "fry_bluefin", "fry_clown", "fry_discus", "fry_goldfish", "fry_guppy", "fry_koi", "fry_manta", "fry_ray", "fry_rising", "fry_tetra", "fry_whale_shark", "fullred_guppy", "galaxy_fish", "genesis_fish", "glowlight_tetra", "golden_arowana", "golden_dragonfish", "halfmoon_betta", "imugi_fish", "juv_angel", "juv_arowana", "juv_astral", "juv_betta", "juv_bluefin", "juv_clown", "juv_discus", "juv_goldfish", "juv_guppy", "juv_koi", "juv_manta", "juv_ray", "juv_rising", "juv_tetra", "juv_whale_shark", "kohaku_koi", "koi_betta", "leopard_discus", "marble_angel", "moon_jelly", "mosaic_guppy", "motoro_ray", "neon_tetra", "oceanic_manta", "ocellaris_clown", "ogon_koi", "oranda_gold", "pearl_carp", "pearl_ray", "percula_clown", "pigeon_discus", "platinum_angel", "platinum_arowana", "polka_ray", "ranchu_gold", "red_arowana", "ryukin_gold", "sanke_koi", "showa_koi", "silver_angel", "silver_arowana", "snowflake_clown", "turquoise_discus", "tuxedo_guppy", "veil_betta", "whale_shark"]);
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
      entry.promise = source(asset(`/aqua/models/${id}.glb`)+(kind==='fish'?fishRevisionQuery(key):'')).then((scene) => {
        // 받는 사이 지워졌다(아무도 안 쓴 채 오래) — 바로 돌려준다
        if (entries.get(id) !== entry) { disposeGlbScene(scene); return null; }
        // 물속 빛 — 물고기는 가장자리 테까지, 장식은 일렁이는 빛만. 원본 재질에 한 번만 단다(복제본이 나눠 쓴다)
        waterLitTree(scene, kind === "fish");
        if (kind === "fish") prepareFishSource(scene, key);
        else { prepareDecorSource(scene); prepareDecorBounds(scene); }
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
        // SkinnedMesh.copy 가 그 구를 복제본에 그대로 옮긴다(예전엔 전부 끄고 수조 밖 물고기까지 매 프레임 그렸다).
        // 장식(2026-11-12)은 형상의 경계 구 — 복제본이 형상을 나눠 쓰니 원본에서 한 번 잰 구(물풀은 흔들림만큼 넓힌 것, prepareDecorBounds)를 그대로 쓴다.
        // 예전엔 장식 GLB 를 전부 화면 밖에서도 그려, 물고기를 따라 다가가면 뒤의 궁전 · 배(5~12k 삼각형)를 매 프레임 그렸다. 구를 안 잰 것은 예전처럼 끈다
        o.frustumCulled = !!o.userData.aquaCull && !!(o instanceof T.SkinnedMesh ? o.boundingSphere : o.geometry.boundingSphere);
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
const NOT_FUSIFORM = /seal|sea_lion|otter|loach|pleco|electric_eel|moray|seahorse|sunfish|boxfish|goosefish|skate|frilled_shark|blobfish|flounder|ray|manta|jelly|starfish|octopus|squid|kraken|eel|oarfish|hairtail|imugi|puffer|ranchu|oranda|dragonfish|galaxy|genesis|astral|rising/;
export const fusiform = (key: string) => !!key && !NOT_FUSIFORM.test(key);
/** 형상 하나의 옆 폭을 고친다(topview.ts) — 원본 정점 단위로 쓴다(압축본은 int16 · 배율이 역바인드 행렬에). 법선도 같은 비율로(옆으로 줄이면 법선은 옆으로 더 눕는다) */
/** 물고기 텍스처를 작게(64²) 그려 밝기를 읽는다 — 등에 찍을 높이를 고를 때(topview.ts). 못 읽으면(그림이 아직 · 캔버스 없음 · 시험) undefined */
function texLuma(mesh: T.Mesh): ((u: number, v: number) => number) | undefined {
  try {
    const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as T.MeshStandardMaterial | undefined;
    const img = m?.map?.image as CanvasImageSource | undefined;
    if (!img || typeof document === "undefined") return undefined;
    const N = 64, c = document.createElement("canvas");
    c.width = N; c.height = N;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data, flip = !!m?.map?.flipY;
    return (u, v) => {
      const x = Math.min(N - 1, Math.max(0, Math.floor(u * N))), yy = Math.min(N - 1, Math.max(0, Math.floor((flip ? 1 - v : v) * N))), o = (yy * N + x) * 4;
      return (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255;
    };
  } catch { return undefined; }
}
function reshapeTopView(mesh: T.SkinnedMesh) {
  // V3 assets already contain a sculpted width profile and a radial UV atlas.
  // The legacy image-plate repair would flatten their fins and rewrite the
  // new atlas coordinates, recreating the very streaks it was meant to fix.
  if (mesh.userData.aquaGeometry === "closed-volume-v3") return;
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
  const out = topViewWidths(P, finBone, UV, texLuma(mesh));
  if (!out) return;
  if (out.v && uvA) { for (let i = 0; i < n; i++) uvA.setY(i, out.v[i]); uvA.needsUpdate = true; }
  for (let i = 0; i < n; i++) {
    const dz = out.z[i] - P[i * 3 + 2], dy = out.y[i] - P[i * 3 + 1], dx = out.x[i] - P[i * 3];
    if (dx) pos.setX(i, pos.getX(i) + dx / s);
    if (dz) pos.setZ(i, pos.getZ(i) + dz / s);
    if (dy) pos.setY(i, pos.getY(i) + dy / s);
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
/* ── 두족류 팔(2026-11-13, lib/aqua3d/cephalopod) — 팔마다 따로 굽고 말고 뻗는다. 정점 자료는 형상마다 한 번, 재질은 key 마다 한 번 ── */
const ARM_KEY = "aqua-arm-v1";
type ArmInfo = { hub: readonly [number, number]; sdir: number; crown: number };
function ensureArmAttribute(mesh: T.SkinnedMesh, key: string): ArmInfo | null {
  const g = mesh.geometry;
  if (g.userData.aquaArm !== undefined) return g.userData.aquaArm as ArmInfo | null;
  const pos = g.attributes.position, uv = g.attributes.uv, n = pos.count;
  let info: ArmInfo | null = null;
  if (uv) {
    const P = new Float32Array(n * 3), U = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); }
    const d = cephArmData(key, P, U, n, g.index ? (g.index.array as ArrayLike<number>) : null);
    if (d) { g.setAttribute("aquaArm", new T.BufferAttribute(d.attr, 4)); info = { hub: d.hub, sdir: d.sdir, crown: d.crown }; }
  }
  g.userData.aquaArm = info;
  return info;
}
function patchArmMaterial(material: T.Material, slot: number, info: ArmInfo) {
  if (!(material instanceof T.MeshStandardMaterial) || material.userData.aquaArm) return;
  material.userData.aquaArm = slot;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    const g = cephGlsl(slot, info.hub, info.sdir, info.crown);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aquaArm;").replace("#include <skinning_pars_vertex>", g.pars).replace("#include <beginnormal_vertex>", g.normal).replace("#include <begin_vertex>", g.vertex);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|${ARM_KEY}|${slot}`;
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
  const jelly = a.kind === "jelly", ceph = a.kind === "cephalopod", flat = flatBody(family, key), vert = verticalWave(family);
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
  if (body && sk && (a.kind === "fish" || a.kind === "dragon") && !flat && !MAMMAL.test(family)) { // 포유류는 털가죽 · 두꺼운 지느러미발이라 막 떨림이 없다
    inner.updateMatrixWorld(true);
    if (ensureFinAttribute(body)) {
      finAt = finSlot(sk);
      if (finAt >= 0) { for (const m of materialsOf(body)) patchFinMaterial(m, sk.bones.length); finData = sk.boneMatrices as Float32Array; }
    }
  }
  // 두족류 팔 — 팔마다 따로 움직이는 정점 변형(뼈 사슬은 몸통 전체의 방향 · 외투막만)
  let armData: Float32Array | null = null, armAt = -1;
  if (ceph && body && sk) {
    const info = ensureArmAttribute(body, key);
    if (info) { armAt = finSlot(sk); if (armAt >= 0) { for (const m of materialsOf(body)) patchArmMaterial(m, sk.bones.length, info); armData = sk.boneMatrices as Float32Array; } }
  }
  const armOct = octopusLike(key), breathPh = (Math.sin(key.length * 12.9898 + (inner.id % 97) * 78.233) * 43758.5453) % 1 * 6.283;
  const lure = body && family === "anglerfish" ? attachLure(inner, body) : null;
  const face = createFishFace(inner, family, key);

  // 몸 물결은 코드 모델과 같은 표(anatomy.bendProfile · swimAngles) — 예전엔 GLB 만 모든 종이 같은 물결이라 장어도 참치처럼 헤엄쳤다
  const wave = bendProfile(family, key), angles = new Float32Array(10), bell = { x: 1, y: 1, z: 1 }, clock = swimClock();
  const sp: SwimPose = {}, lastP = new T.Vector3(), scaleW = new T.Vector3();
  let lastT = -1, bodyLength = 0;
  // 두족류: 외투막 앞 마디(spine_3) 자리를 제자리에 묶는다 — 뼈 사슬의 뿌리(spine_0)가 팔 끝이라 팔을 흔들면 외투막이 통째로 옆으로 밀린다
  const offsets = spine.map((r) => (r ? { x: r.pos.x, z: r.pos.z } : { x: 0, z: 0 }));
  const vlift = new Float32Array(6);
  // 굳은 가슴지느러미(상어 · 다랑어 · 새치, bendProfile.pect) — 몸 기준 세 축(앞 X · 위 Y · 옆 Z)을 지느러미 뼈마다 그 뼈의 쉬는 자세 좌표로 바꿔 둔다.
  // 몸 X 축으로 + 돌리면 왼쪽(+Z) 끝이 내려가고 오른쪽(−Z) 끝이 오른다(같은 각 = 몸을 기울이기, 반대 각 = 둘 다 오르내리기), Z 축 + 는 앞쪽을 들기, Y 축은 앞뒤로 접기
  const stiff = wave.pect === "stiff" || wave.pect === "fold";
  const finAxes = fins.map((r) => {
    if (!r || !stiff) return null;
    inner.updateMatrixWorld(true);
    const rel = inner.getWorldQuaternion(new T.Quaternion()).invert().multiply(r.bone.getWorldQuaternion(new T.Quaternion())).invert();
    return { x: X.clone().applyQuaternion(rel), y: Y.clone().applyQuaternion(rel), z: Z.clone().applyQuaternion(rel) };
  });
  const q3 = new T.Quaternion();
  let pitchS = 0, turnS = 0, lastY = 0, rollS = 0;
  // 해달(2026-11-13) — 쉬는 동안 수면에서 배를 위로 하고 떠 있다(몸 축으로 뒤집는다). 뿌리 뼈 좌표의 몸 축(모델 X)
  const otterRoll = family === "sea_otter" && spine[0] ? (() => { inner.updateMatrixWorld(true); const rel = inner.getWorldQuaternion(new T.Quaternion()).invert().multiply(spine[0]!.bone.getWorldQuaternion(new T.Quaternion())).invert(); return X.clone().applyQuaternion(rel); })() : null;
  // 귀상어 — 헤엄치며 머리를 좌우로 천천히 휘저어 바닥을 살핀다(머리 마디만, 몸은 그대로)
  const sweepPh = family === "hammerhead" ? (inner.id % 17) * 0.7 : -1;
  return (time, effort, pose) => {
    // Respiration uses elapsed water time, not the locomotion beat (resting fish still ventilate).
    face?.animate(WATER_LIGHT.aquaTime.value || time);
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
    if (stiff && holder && dt > 0 && dt < 0.25) {
      if (!bodyLength) bodyLength = 2 * (body ? body.getWorldScale(scaleW).x : holder.scale.x);
      // 오르내리는 기울기 — 몸이 실제로 움직인 방향(위아래 ÷ 옆)에서. 천천히 따른다(지느러미가 떨지 않게)
      const vx = holder.position.x - lastP.x, vz = holder.position.z - lastP.z, vy = holder.position.y - lastY, h = Math.hypot(vx, vz);
      // 거의 제자리(옆으로 몸길이의 0.12 배/초 아래)면 위아래 들썩임만 남아 atan2 가 ±90° 로 튄다 — 그때는 0 쪽으로 줄인다
      const still = Math.min(1, h / dt / Math.max(1e-6, (bodyLength || 2) * 0.12)), target = h + Math.abs(vy) > 1e-5 ? Math.atan2(vy, h) * still : 0, k = 1 - Math.exp(-dt / 0.35);
      pitchS += (target - pitchS) * k; turnS += ((pose?.turn ?? 0) - turnS) * k;
    }
    if (holder) { lastP.copy(holder.position); lastY = holder.position.y; }
    sp.turn = pose?.turn; sp.effort = pose?.effort; sp.amp = pose?.amp; sp.pulse = pose?.pulse; sp.hover = pose?.hover; sp.ground = pose?.ground; sp.feed = pose?.feed; sp.speed = speed;
    stepSwim(clock, a, wave, t, dt, sp);
    const phase = clock.beat;
    swimAngles(wave, phase, sp, angles, !flat && !vert);
    if (wave.kind !== "ray") {
      // 가슴지느러미 — 떠 있으면 작게 빨리 젓고(노 젓기), 급히 돌거나 먹이에 몰리면 활짝
      const g = finGain(clock, sp);
      for (let s = 0; s < 2; s++) { const sign = s && wave.pect !== "alt" ? 1 : -1; angles[6 + s * 2] = sign * Math.sin(clock.fin) * wave.fin * g; angles[7 + s * 2] = sign * Math.sin(clock.fin - 0.7) * wave.fin * 1.3 * g; }
    }
    if (ceph) {
      // 두족류의 몸짓(2026-11-13) — 물고기처럼 팔을 꼬리 삼아 흔들던 것을 셋으로 갈랐다
      //  · 물 뿜기(rev · jet): 외투막을 앞세워 나가는 동안 팔을 한데 모아 곧게 뒤로 늘어뜨린다(물결을 거의 끈다), 외투막은 세게 오므렸다 편다
      //  · 미끄러진 끝(rev 인데 jet 이 작다): 팔을 위 · 바깥으로 펴 낙하산처럼 내려앉는다
      //  · 기기(문어 · 크라켄, 팔 쪽이 앞): 팔이 바닥을 짚듯 위아래로 차례로 물결친다(팔 끝에서 뿌리로). 떠 있는 오징어는 팔 끝만 살랑인다
      const rev = Math.max(0, Math.min(1, pose?.rev ?? 0)), jet = Math.max(0, Math.min(1, pose?.jet ?? 0));
      const stream = rev * (0.35 + 0.65 * Math.min(1, jet * 3)), flare = rev * (1 - Math.min(1, jet * 4));
      const crawlFam = family === "octopus" || family === "kraken";
      const walk = crawlFam ? (1 - rev) * (0.15 + 0.85 * Math.max(0, Math.min(1, ((sp.amp ?? 1) - 0.2) / 0.8))) : 0; // 옮겨 가는 동안(amp) 크게, 쉬는 동안엔 살짝
      const wt = WATER_LIGHT.aquaTime.value || time;
      // angles 는 마디의 절대 방향 — 이웃 마디와의 차이로 돌리고, 외투막 앞 마디가 제자리에 오게 뿌리를 옮긴다
      // 팔 하나하나는 셰이더(armData)가 굽힌다 — 뼈 사슬로 팔 전체를 한 꼬리처럼 흔들던 몫은 문어형에서 크게 줄인다
      const boneArm = armData ? (armOct ? 0.25 : 0.6) : 1;
      for (let i = 0; i < 3; i++) angles[i] *= (1 - 0.85 * stream) * boneArm;
      if (armData) {
        if (body && body.skeleton.boneMatrices !== armData) { armAt = finSlot(body.skeleton); armData = armAt >= 0 ? (body.skeleton.boneMatrices as Float32Array) : null; }
        if (armData) {
          // 기어가기 몫 — 문어형은 옮겨 가는 동안(amp), 오징어형은 지느러미로 떠 있는 동안 팔 끝만 살랑(작게)
          armData[armAt] = wt; armData[armAt + 1] = armOct ? walk : 0.25 * (1 - rev); armData[armAt + 2] = stream; armData[armAt + 3] = flare;
          armData[armAt + 4] = armOct ? 1 : 0.55;
        }
      }
      // 위아래(Z) — 팔(0 ~ 2)만: 기기 물결 · 내려앉을 때 펴기 · 떠 있을 때 팔 끝 살랑임. 옆 물결(angles)과 같이 '마디의 절대 방향'이라
      // 이웃 마디와의 차이로 돌리고, 사슬 뿌리(spine_0)가 팔 끝이라 외투막이 따라 들리지 않게 뿌리 높이도 옮긴다(아래 py)
      for (let i = 0; i < 6; i++) {
        const arm = i < 3 ? 1 - i / 3 : 0;
        vlift[i] = arm * (armData && armOct ? 0.35 : 1) * (walk * 0.26 * Math.sin(wt * 2.4 - i * 1.15) + flare * 0.32 + (crawlFam ? 0 : (1 - rev) * 0.08 * Math.sin(wt * 1.3 - i * 0.9)));
      }
      let px = 0, pz = 0, rx = 0, rz = 0, py = 0;
      for (let i = 0; i < 6; i++) {
        turn(spine[i], Y, angles[i] - (i ? angles[i - 1] : 0), Z, vlift[i] - (i ? vlift[i - 1] : 0));
        if (i >= 1 && i <= 3) {
          const o = offsets[i], f = angles[i - 1], c = Math.cos(f), s = Math.sin(f), v = vlift[i - 1];
          px += (o.x * c + o.z * s) * Math.cos(v); pz += -o.x * s + o.z * c; rx += o.x; rz += o.z; py += o.x * Math.sin(v);
        }
      }
      const root = spine[0];
      if (root) root.bone.position.set(root.pos.x + rx - px, root.pos.y - py, root.pos.z + rz - pz);
      // 물 뿜기 — 외투막이 천천히 부풀었다 빠르게 오므리며 길어진다(코드 모델 invertebrateMotion 과 같은 뜻)
      const mantle = spine[3];
      if (mantle) {
        // 뿜을 땐 빠르고 세게(물을 내뿜는 한 번 한 번이 보이게), 평소엔 숨 쉬듯 천천히
        const jj = jet > 0.02 ? Math.max(0, Math.sin(wt * 9)) ** 2 * (0.4 + 0.6 * jet) : 0, j = breathOf(wt, breathPh) * (1 - Math.min(1, jet * 4)); // 숨(외투막 환기) — 헤엄 박자와 따로, 2.6초에 한 번(실제 문어 · 오징어는 2 ~ 3초)
        mantle.bone.scale.set(mantle.scale.x * (1 + 0.05 * j + 0.1 * jj), mantle.scale.y * (1 - 0.08 * j - 0.18 * jj), mantle.scale.z * (1 - 0.08 * j - 0.18 * jj));
      }
    } else if (flat || vert) {
      // 누운 광어 · 수달 · 해달 — 물결은 Z 축(위아래), 도는 C 자는 Y 축
      // 누운 몸 — 물결은 Z 축(위아래), 도는 C 자는 Y 축(모래 평면)
      spine.forEach((r, i) => turn(r, Z, angles[i], Y, turnCurl(wave, sp, i)));
      if (otterRoll && spine[0]) {
        // 쉬는 동안(amp 가 낮다) 0.8초에 걸쳐 뒤집고, 다시 헤엄치면 바로 선다
        const target = Math.max(0, Math.min(1, 1 - ((sp.amp ?? 1) - 0.25) / 0.4)), k = dt > 0 && dt < 0.5 ? 1 - Math.exp(-dt / 0.8) : 0;
        rollS += (target - rollS) * k;
        if (rollS > 0.001) spine[0].bone.quaternion.multiply(q3.setFromAxisAngle(otterRoll, Math.PI * rollS * rollS * (3 - 2 * rollS)));
      }
    } else {
      if (sweepPh >= 0) { const sw = 0.13 * Math.sin((WATER_LIGHT.aquaTime.value || time) * 0.8 + sweepPh); angles[0] += sw; angles[1] -= sw * 0.6; }
      spine.forEach((r, i) => turn(r, Y, angles[i], i === 0 ? Z : undefined, i === 0 ? hoverPitch(clock, sp) : 0));
    }
    if (stiff) {
      // 굳은 날개 — 꼬리 박자에 맞춰 젓지 않는다. 펴 둔 채(상어는 조금 아래로) 오를 땐 앞쪽을 들고 내려갈 땐 숙이고, 돌 땐 안쪽 지느러미를 내려 몸을 기울인다.
      // 바닥에 앉은 상어(수염상어)는 지느러미를 모래에 짚는다. 다랑어 · 새치는 빨리 갈수록 몸 옆에 접어 붙이고, 급히 돌 땐 다시 편다
      const ground = Math.max(0, Math.min(1, sp.ground ?? 0)), shark = SHARKS.test(family);
      const turnNow = sp.turn ?? turnS, bank = Math.max(-0.38, Math.min(0.38, -turnS * 0.32));
      const attack = Math.max(-0.4, Math.min(0.4, pitchS * 0.9)) * (1 - ground);
      const fold = wave.pect === "fold" ? Math.max(0, Math.min(1, ((speed ?? 0.5) - 0.55) / 0.8)) * (1 - Math.min(1, Math.abs(turnNow) / 0.8)) * 0.9 : 0;
      const droop = (shark ? -0.1 : 0) - 0.22 * ground, jiggle = 0.018 * Math.sin(clock.beat - 2.2) * (sp.amp ?? 1);
      for (let s = 0; s < 2; s++) {
        const side = s ? 1 : -1, root = fins[s * 2], tip = fins[s * 2 + 1], ax = finAxes[s * 2], tx = finAxes[s * 2 + 1];
        if (root && ax) {
          root.bone.quaternion.copy(root.base).multiply(q.setFromAxisAngle(ax.x, side * (droop + jiggle) + bank)).multiply(q2.setFromAxisAngle(ax.z, attack)).multiply(q3.setFromAxisAngle(ax.y, side * fold));
        }
        // 끝은 뿌리를 조금 더 따라 휜다(굳은 날개라 조금만)
        if (tip && tx) tip.bone.quaternion.copy(tip.base).multiply(q.setFromAxisAngle(tx.x, side * 0.25 * (droop + jiggle) + 0.2 * bank));
      }
    } else fins.forEach((r, i) => turn(r, X, angles[6 + i]));
    if (finData && body) {
      if (body.skeleton.boneMatrices !== finData) { finAt = finSlot(body.skeleton); finData = finAt >= 0 ? (body.skeleton.boneMatrices as Float32Array) : null; }
      if (finData) { finData[finAt] = clock.flutter; finData[finAt + 1] = flutterGain(clock, sp) * (RIBBON_FIN.test(family) ? 2.2 : 1); } // 전기뱀장어 · 산갈치 · 갈치는 긴 지느러미 물결로 나간다
    }
    if (lure) lure.scale.setScalar((lure.userData.base as number) * (1 + 0.12 * Math.sin(clock.bob * 3.1)));
  };
}

/* ── 물풀 흔들림(2026-11-12) ────────────────────────────────────────────────────
 * 코드로 지은 물풀은 줄기 묶음이 흔들렸는데(decor.ts tree, 0.07 rad), 물풀 여섯 종(바나 · 아누비아스 · 발리스네리아 · 로탈라 · 켈프 · 수련)이
 * 전부 GLB 로 갈아 끼워지면서 decorMotion 이 풍차 · 뚜껑만 돌려 수조의 풀이 모두 얼어 있었다.
 * 정점 셰이더에서 휜다 — 바닥은 그대로, 위로 갈수록 제곱으로 더 휘고(뿌리 박힌 풀처럼), 물결이 줄기를 타고 올라간다.
 *  - 행렬을 안 바꾼다: 노드를 돌리면(userData.moving) 수조의 묶음 그리기(scene.ts batches)가 '움직인다'가 되어 매 프레임 행렬을 다시 올린다.
 *    시계는 WATER_LIGHT.aquaTime(수조 · 상점 미리보기가 프레임마다 맞춘다) 하나 — 묶음이든 따로든 같은 식이다.
 *  - 한 그루마다 박자가 다르다: 박자는 그 그루 뿌리(GLB 원점)의 월드 xz 에서 — 묶음은 modelMatrix 가 단위 · instanceMatrix 가 원본 matrixWorld 라
 *    (modelMatrix*instanceMatrix)[원점] 이 곧 그 그루 자리다. 따로 그릴 땐 instanceMatrix 가 없다(#ifdef). 그루 안의 줄기 · 꽃은 같은 원점이라 같이 흔들린다.
 *  - 재질 · 형상은 같은 key 끼리 나눠 쓴다(glbShared) — 재질 uniform 으로 그루마다 값을 못 준다. 그래서 정점마다 값(aquaSway)을 형상에 한 번 굽는다:
 *    x = 휘는 폭(그 메시 '원본 정점 단위' — 압축본 위치는 int16 이고 노드 배율이 아주 작다), y = 0~1 높이(물결이 타고 오르는 몫),
 *    aquaRoot = 그 메시 좌표로 본 GLB 원점(뿌리). 수련의 꽃(static_ornament)도 줄기와 같은 재질이라 같은 식으로 굽는다 — 줄기 끝과 함께 움직인다.
 *  - 노드에 회전이 있는 GLB 는 굽지 않는다(로컬 x · z 가 GLB 의 x · z 라고 가정한다 — 지금 파일은 전부 회전 없음). */
const SWAY_KEY = "aqua-sway-v1";
/** 끝이 그루 높이의 몇 배만큼 휘나 — 코드 물풀의 0.07 rad 통째 돌림과 끝 이동이 비슷하게 */
export const SWAY_TIP = 0.085;
/** 줄기 노드(GLB 이름) — 이것이 있는 장식만 물풀로 친다 */
const isStem = (o: T.Object3D) => /^moving_stem/.test(o.name);
/** 정점 셰이더 몇 줄(ASCII) — begin_vertex 뒤에 넣어 물속 빛(waterLit vAquaWorld)도 휜 자리를 따른다 */
export const SWAY_VERTEX = `#include <begin_vertex>
  {
    vec4 aquaO = vec4( aquaRoot, 1.0 );
    #ifdef USE_INSTANCING
    aquaO = instanceMatrix * aquaO;
    #endif
    aquaO = modelMatrix * aquaO;
    float aquaPh = dot( aquaO.xz, vec2( 1.9, 1.3 ) );
    transformed.x += aquaSway.x * sin( aquaTime * 0.8 + aquaPh - aquaSway.y * 1.1 );
    transformed.z += aquaSway.x * 0.55 * sin( aquaTime * 0.57 + aquaPh * 1.3 + 2.0 - aquaSway.y * 0.9 );
  }`;
/** CPU 에서 같은 식 — 시험용. 뿌리 월드 xz(ox, oz) · 높이 u(0~1) · 폭 w 일 때 (x, z) 변위 */
export function swayOffset(w: number, u: number, ox: number, oz: number, time: number): [number, number] {
  const ph = ox * 1.9 + oz * 1.3;
  return [w * Math.sin(time * 0.8 + ph - u * 1.1), w * 0.55 * Math.sin(time * 0.57 + ph * 1.3 + 2 - u * 0.9)];
}
function patchSwayMaterial(material: T.Material) {
  if (!(material instanceof T.MeshStandardMaterial) || material.userData.aquaSway) return;
  material.userData.aquaSway = true;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.aquaTime = WATER_LIGHT.aquaTime;
    // aquaTime 은 정점 셰이더에만 선언한다 — 조각 셰이더엔 물속 빛(waterLit)이 이미 선언했다(같은 이름 · 같은 형이면 두 단계가 나눠 쓴다)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aquaSway;\nattribute vec3 aquaRoot;\nuniform float aquaTime;")
      .replace("#include <begin_vertex>", SWAY_VERTEX);
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|${SWAY_KEY}`;
  material.needsUpdate = true;
}
/** 장식 원본 한 번(복제본이 나눠 쓴다) — 줄기가 있는 GLB(물풀)의 모든 메시에 흔들림 값을 굽고 재질에 흔들림을 단다. 물풀이 아니면 아무것도 안 한다 */
export function prepareDecorSource(scene: T.Object3D): boolean {
  let plant = false;
  scene.traverse((o) => { if (isStem(o)) plant = true; });
  if (!plant) return false;
  scene.updateMatrixWorld(true);
  const toRoot = new T.Matrix4().copy(scene.matrixWorld).invert(), rel = new T.Matrix4(), inv = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(), at = new T.Vector3();
  const meshes: T.Mesh[] = [];
  let minY = Infinity, maxY = -Infinity;
  scene.traverse((o) => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    rel.multiplyMatrices(toRoot, o.matrixWorld); rel.decompose(at, q, sc);
    // 회전이 있거나 배율이 고르지 않으면 로컬 x · z 가 GLB 의 x · z 가 아니다 — 굽지 않는다(그 메시만 그대로)
    if (Math.abs(q.w) < 0.9999 || Math.abs(sc.x - sc.y) > 1e-6 * Math.abs(sc.x) || Math.abs(sc.x - sc.z) > 1e-6 * Math.abs(sc.x)) return;
    meshes.push(o);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rel); if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; }
  });
  const H = maxY - minY;
  if (!(H > 0) || !meshes.length) return false;
  for (const o of meshes) {
    const g = o.geometry;
    if (g.userData.aquaSway) continue; // 한 형상을 두 노드가 쓰면 처음 것으로
    rel.multiplyMatrices(toRoot, o.matrixWorld); inv.copy(rel).invert(); rel.decompose(at, q, sc);
    const pos = g.attributes.position, n = pos.count, s = sc.x;
    const sway = new Float32Array(n * 2), root = new Float32Array(n * 3);
    v.set(0, 0, 0).applyMatrix4(inv); // 그 메시 좌표로 본 GLB 원점(뿌리)
    for (let i = 0; i < n; i++) {
      const u = Math.max(0, Math.min(1, (at.y + pos.getY(i) * s - minY) / H));
      sway[i * 2] = (SWAY_TIP * H * u * u) / s; sway[i * 2 + 1] = u;
      root[i * 3] = v.x; root[i * 3 + 1] = v.y; root[i * 3 + 2] = v.z;
    }
    g.setAttribute("aquaSway", new T.BufferAttribute(sway, 2));
    g.setAttribute("aquaRoot", new T.BufferAttribute(root, 3));
    g.userData.aquaSway = true;
  }
  // 재질은 굽은 메시가 쓰는 것만 — 값이 없는 메시가 흔들림 재질을 쓰면 안 된다(빈 속성은 기기마다 아무 값이나 읽는다)
  const swayMats = new Set<T.Material>(), plainMats = new Set<T.Material>();
  scene.traverse((o) => { if (o instanceof T.Mesh) for (const m of materialsOf(o)) (o.geometry.userData.aquaSway ? swayMats : plainMats).add(m); });
  for (const m of swayMats) if (!plainMats.has(m)) patchSwayMaterial(m);
  return true;
}

/** 흔들림 변위의 최대 길이 ÷ aquaSway.x — x 는 폭 그대로, z 는 .55 배라 둘이 같이 가장 클 때 √(1 + .55²) */
export const SWAY_REACH = Math.hypot(1, 0.55);
/** 장식 원본 한 번 — 메시마다 화면 밖 빼기(frustum culling)에 쓸 경계 구를 잰다(instance 가 켠다).
 *  ① 형상의 경계 구는 메시 자기 좌표라, 노드 행렬(풍차 날개가 도는 것까지)은 three 가 그릴 때 matrixWorld 로 옮긴다 — 장식은 뼈가 없어 그대로 맞는다.
 *  ② 물풀은 셰이더가 정점을 옆으로 민다(SWAY_VERTEX — 노드 행렬 앞, 메시의 원본 정점 단위) → 구를 그 최대 변위만큼 넓힌다. 같은 단위라 그대로 더하면 된다.
 *  ③ 구만 넓힌다 — 경계 상자는 그대로(swapBody · seatDecor · 장애물이 상자로 크기와 바닥을 잰다).
 *  ⚠ 형상의 구를 null 로 되돌리면 three 가 넓히지 않은 구를 다시 잰다 — 흔들리는 풀 끝이 화면 가장자리에서 잘린다. 묶음(InstancedMesh)도 이 구를 쓴다 */
export function prepareDecorBounds(scene: T.Object3D) {
  scene.traverse((o) => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    const g = o.geometry;
    if (!g.userData.aquaBounds) {
      g.computeBoundingSphere();
      const sway = g.attributes.aquaSway;
      if (sway && g.boundingSphere) {
        let reach = 0;
        for (let i = 0; i < sway.count; i++) reach = Math.max(reach, Math.abs(sway.getX(i)));
        g.boundingSphere.radius += reach * SWAY_REACH * 1.02; // 2% 여유 — GPU 의 sin · 반정밀 계산 차이 몫(넓히지 않으면 물풀 끝이 구를 18% 넘는다 — decor-cull.test)
      }
      g.userData.aquaBounds = true;
    }
    if (g.boundingSphere && Number.isFinite(g.boundingSphere.radius)) o.userData.aquaCull = true;
  });
}

/** 움직이는 부품 — 풍차 날개는 돌고, 뚜껑은 살짝 여닫힌다(물풀은 셰이더가 흔든다 — prepareDecorSource) */
export function decorMotion(inner: T.Group): (time: number) => void {
  const blades = inner.getObjectByName("moving_windmill_blades");
  // 먹이 조개(feeder_3)의 뚜껑도 — GLB 이름이 moving_feeder_clam_lid 라 예전 목록에서 빠져 멈춰 있었다
  const lids = [inner.getObjectByName("moving_treasure_lid"), inner.getObjectByName("moving_clam_lid"), inner.getObjectByName("moving_feeder_clam_lid")].filter((o): o is T.Object3D => !!o);
  const lidBase = lids.map((o) => o.rotation.x);
  // 움직이는 노드 표시 — 수조가 묶어 그릴 때 이 밑만 매 프레임 행렬을 올린다
  for (const o of [blades, ...lids]) if (o) o.userData.moving = true;
  return (time) => {
    if (blades) blades.rotation.z = time * 0.22; // 노드 원점이 곧 축이다
    lids.forEach((o, i) => { o.rotation.x = lidBase[i] + Math.sin(time * 0.8) * 0.03; });
  };
}
