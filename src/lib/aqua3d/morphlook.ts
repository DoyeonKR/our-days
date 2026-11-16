/** 색 변이 품종의 3D 모습(2026-11-13) — 새 모델 없이 재질 색만 바꾼다.
 *
 *  물고기 재질은 같은 모습(key)끼리 나눠 쓴다(GLB 캐시 · 키트). 변이 물고기는 그 재질을 (원본 재질, 변이)마다 한 번 복제해
 *  색 바꾸기 셰이더 한 줄을 붙이고, 같은 모습 · 같은 변이 물고기끼리 그 복제를 다시 나눠 쓴다(물고기마다 복제하지 않는다).
 *  · 복제는 onBeforeCompile · customProgramCacheKey 를 옮겨 단다(Material.clone 은 안 옮긴다 — addJaw · faces 와 같은 방법).
 *    이미 달린 물빛 · 몸 둘레 빛 · 지느러미 떨림 셰이더가 그대로 돈다. 그래서 다른 셰이더를 다 단 **뒤에** 부른다.
 *  · 색 바꾸기는 그림 색(diffuseColor)에서: 회색으로 빼기(desat) → 색 곱하기(tint) → 밝히기(lift). 알비노는 곱하기만으로는
 *    밝힐 수 없어 회색으로 뺀 뒤 들어 올린다. 셰이더 문자열은 ASCII 만(GLSL ES 1.0 — 주석 속 한글도 오류로 보는 기기가 있다).
 *  · 복제는 이 등록부가 들고 지운다 — 물고기를 떼어 낼 때(release) 지우지 않는다(userData.aquaMorph, 다른 물고기가 같이 쓴다).
 *  · 왕관(userData.aquaKeep)은 건드리지 않는다. */
import * as T from "three";
import type { Morph } from "../aquamorph.ts";

export type MorphLook = { desat: number; tint: readonly [number, number, number]; lift: readonly [number, number, number]; emissive?: number; emissiveIntensity?: number; metalness?: number; roughness?: number };
export const MORPH_LOOK: Readonly<Record<Morph, MorphLook>> = {
  // 알비노 — 색소가 빠져 희고 분홍빛이 돈다
  albino: { desat: 0.85, tint: [1.05, 0.93, 0.95], lift: [0.32, 0.27, 0.28] },
  // 황금 — 밝기를 금빛으로 옮긴다
  golden: { desat: 0.9, tint: [1.45, 1.08, 0.38], lift: [0.06, 0.04, 0], emissive: 0x5a3c00, emissiveIntensity: 0.3, metalness: 0.45, roughness: 0.35 },
  // 흑색 — 짙은 먹빛
  melanistic: { desat: 0.55, tint: [0.3, 0.3, 0.34], lift: [0.01, 0.01, 0.015] },
  // 오로라 — 푸른 보랏빛에 은은한 빛(무지갯빛은 몸 둘레 빛 fishShading 이 가장자리에서 더한다)
  aurora: { desat: 0.4, tint: [0.82, 1.02, 1.22], lift: [0.04, 0.02, 0.08], emissive: 0x3a2a8a, emissiveIntensity: 0.35, roughness: 0.4 },
};

const f = (n: number) => n.toFixed(3);
/** 색 바꾸기 셰이더 한 줄 — 변이마다 상수가 박힌다(캐시 키도 변이마다 다르다) */
export function morphChunk(m: Morph): string {
  const l = MORPH_LOOK[m];
  return `
{ float morphY = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(morphY), ${f(l.desat)}) * vec3(${l.tint.map(f).join(", ")}) + vec3(${l.lift.map(f).join(", ")}); }
`;
}

export type MorphMaterials = {
  /** 물고기 몸에 변이 재질을 단다(null 이면 아무것도 안 한다) */
  apply(root: T.Object3D, morph: Morph | null): void;
  /** 복제를 다 지운다(수조를 닫을 때) */
  dispose(): void;
  readonly size: number;
};
export function morphMaterials(): MorphMaterials {
  const cache = new Map<string, T.Material>();
  function tinted(src: T.MeshStandardMaterial, m: Morph): T.Material {
    const key = `${src.uuid}:${m}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const look = MORPH_LOOK[m];
    const c = src.clone();
    const prev = src.onBeforeCompile, prevKey = src.customProgramCacheKey.bind(src);
    c.onBeforeCompile = (shader, r) => {
      prev.call(c, shader, r);
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>${morphChunk(m)}`);
    };
    c.customProgramCacheKey = () => `${prevKey()}|morph:${m}`;
    if (look.emissive !== undefined) { c.emissive.setHex(look.emissive); c.emissiveIntensity = Math.max(c.emissiveIntensity, look.emissiveIntensity ?? 0); }
    if (m === "albino" || m === "melanistic") c.emissiveIntensity *= 0.5; // 빛나는 종(신화)의 빛도 변이 색을 덮지 않게
    if (look.metalness !== undefined) c.metalness = Math.max(c.metalness, look.metalness);
    if (look.roughness !== undefined) c.roughness = Math.max(c.roughness, look.roughness);
    c.userData = { ...c.userData, aquaMorph: m };
    cache.set(key, c);
    return c;
  }
  const swap = (x: T.Material, m: Morph): T.Material => (x instanceof T.MeshStandardMaterial && !x.userData.aquaMorph ? tinted(x, m) : x);
  return {
    apply(root, morph) {
      if (!morph) return;
      const walk = (o: T.Object3D) => {
        if (o.userData.aquaKeep) return; // 왕관 · 거품
        const mesh = o as T.Mesh;
        if (mesh.isMesh && mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => swap(x, morph)) : swap(mesh.material, morph);
        for (const c of o.children) walk(c);
      };
      walk(root);
    },
    dispose() { for (const m of cache.values()) m.dispose(); cache.clear(); },
    get size() { return cache.size; },
  };
}
