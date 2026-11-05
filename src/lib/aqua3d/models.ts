import * as T from "three";
import { makeDetailedTurtle } from "./turtle.ts";
import { asset } from "../base.ts";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { makeReferenceAnimal } from "./reference-model.ts";

type XYZ = readonly [number, number, number];
export class ModelKit {
  readonly sphere = new T.SphereGeometry(1, 20, 12);
  readonly box = new T.BoxGeometry(1, 1, 1);
  readonly cylinder = new T.CylinderGeometry(1, 1, 1, 16);
  readonly materials = new Map<string, T.MeshStandardMaterial>();
  readonly referenceTextures = new Map<string, T.Texture>();
  private referenceCallbacks = new Map<string, Set<(texture: T.Texture) => void>>();
  private referenceDisposed = false;
  /** 제작 모델(GLB)이 곧 올 key — 임시 코드 모델에 512px 피부 그림을 받지 않는다(바탕색 그대로 잠깐 보인다).
   *  예전엔 갈아 끼운 뒤에도 그림이 그대로 남아 텍스처 메모리가 1.5배였고 내려받기도 한 번 더 했다(2026-11-05). */
  skinless: ReadonlySet<string> = new Set();
  private deferred = new Map<string, ((texture: T.Texture) => void)[]>();
  /** One original reference per kit. Only local, repo-owned public assets are loaded. */
  referenceTexture(key: string, ready: (texture: T.Texture) => void) {
    if (!FISH_IMAGE_KEYS.has(key)) throw new Error(`Unknown fish reference: ${key}`);
    if (this.skinless.has(key) && !this.unskinned.has(key) && !this.referenceTextures.has(key)) {
      // 제작 모델을 못 받으면(loadDeferred) 그때 그림을 받는다
      this.deferred.set(key, [...(this.deferred.get(key) ?? []), ready]);
      return;
    }
    const existing = this.referenceTextures.get(key);
    if (existing) {
      if (existing.image) ready(existing);
      else this.referenceCallbacks.get(key)?.add(ready);
      return;
    }
    if (typeof document === "undefined") return;
    this.referenceCallbacks.set(key, new Set([ready]));
    const directory = key.includes("sea_turtle") ? "fish" : "skin";
    const texture = new T.TextureLoader().load(asset(`/aqua/${directory}/${key}.webp`), loaded => {
      if (this.referenceDisposed || this.referenceTextures.get(key) !== loaded) { loaded.dispose(); return; }
      loaded.colorSpace = T.SRGBColorSpace; loaded.flipY = false;
      for (const callback of this.referenceCallbacks.get(key) ?? []) callback(loaded);
      this.referenceCallbacks.delete(key);
    }, undefined, () => {
      if (this.referenceTextures.get(key) === texture) { this.referenceTextures.delete(key); this.referenceCallbacks.delete(key); }
      texture.dispose();
    });
    texture.colorSpace = T.SRGBColorSpace; texture.flipY = false;
    this.referenceTextures.set(key, texture);
  }
  /** 제작 모델을 못 받은 key — 이제 피부 그림을 받는다 */
  private unskinned = new Set<string>();
  loadDeferred(key: string) {
    this.unskinned.add(key);
    const waiting = this.deferred.get(key) ?? [];
    this.deferred.delete(key);
    for (const ready of waiting) this.referenceTexture(key, ready);
  }
  /** 제작 모델로 갈아 끼웠다 — 미뤄 둔 콜백(옛 몸의 재질)을 버린다 */
  dropDeferred(key: string) { this.deferred.delete(key); }
  /** keys = 아직 코드 모델로 보이는 물고기의 key 만. 갈아 끼운 key 의 그림은 지운다 */
  retainReferences(keys: ReadonlySet<string>) {
    for (const [key, texture] of this.referenceTextures) if (!keys.has(key)) {
      texture.dispose(); this.referenceTextures.delete(key); this.referenceCallbacks.delete(key);
    }
    for (const key of this.deferred.keys()) if (!keys.has(key)) this.deferred.delete(key);
  }
  disposeReferences() {
    this.referenceDisposed = true;
    this.deferred.clear();
    this.referenceCallbacks.clear();
    for (const texture of this.referenceTextures.values()) texture.dispose();
    this.referenceTextures.clear();
  }
  material(color: number, metal = 0.05, rough = 0.58) {
    const key = `${color}/${metal}/${rough}`;
    if (!this.materials.has(key)) this.materials.set(key, new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    return this.materials.get(key)!;
  }
  mesh(parent: T.Object3D, kind: "sphere" | "box" | "cylinder", color: number, at: XYZ, scale: XYZ, metal = 0.05) {
    const mesh = new T.Mesh(this[kind], this.material(color, metal));
    mesh.position.set(...at); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
}

export type AnimalModel = { root: T.Group; animate: (time: number, effort: number) => void };

export function makeAnimal(kit: ModelKit, family: string, key: string): AnimalModel {
  if (family === "sea_turtle" && ["green_sea_turtle", "fry_sea_turtle", "juv_sea_turtle"].includes(key)) return makeDetailedTurtle(kit, key);
  return makeReferenceAnimal(kit, family, key);
}
