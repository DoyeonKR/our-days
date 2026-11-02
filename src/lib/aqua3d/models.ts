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
  /** One original reference per kit. Only local, repo-owned public assets are loaded. */
  referenceTexture(key: string, ready: (texture: T.Texture) => void) {
    if (!FISH_IMAGE_KEYS.has(key)) throw new Error(`Unknown fish reference: ${key}`);
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
  retainReferences(keys: ReadonlySet<string>) {
    for (const [key, texture] of this.referenceTextures) if (!keys.has(key)) {
      texture.dispose(); this.referenceTextures.delete(key); this.referenceCallbacks.delete(key);
    }
  }
  disposeReferences() {
    this.referenceDisposed = true;
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
