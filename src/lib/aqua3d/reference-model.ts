import * as T from "three";
import profiles from "./profiles.json" with { type: "json" };
import { anatomy, bendProfile, flatBody, jellyPulse, swimAngles, turnCurl, type SwimPose } from "./anatomy.ts";
import { appearance, materialTweak } from "./appearance.ts";
import { makeInvertebrateAnimal } from "./invertebrates.ts";
import type { AnimalModel, ModelKit } from "./models.ts";

type Profile = { sourceHash: string; grid: number; bounds: number[]; image: number[]; rows: number[][] };
export const REFERENCE_PROFILES: Readonly<Record<string, Profile>> = profiles;
const unit = (n: number) => Math.max(0, Math.min(1, n));

/** Source-specific closed surface with an anatomical body volume and thin fins.
 * Both sides are real geometry, joined along every silhouette boundary. This is
 * a single-image reconstruction, not a photogrammetric scan or a billboard.
 */
export function makeReferenceAnimal(kit: ModelKit, family: string, key: string): AnimalModel {
  const profile = REFERENCE_PROFILES[key];
  if (!profile) throw new Error(`No authored source profile: ${key}`);
  const a = anatomy(family, key), p = appearance(family, key);
  if (a.kind === "star" || a.kind === "cephalopod") return makeInvertebrateAnimal(kit, family, key);
  const root = new T.Group(); root.name = key; root.userData.model = "source-volume-v3";
  const { grid, bounds, image } = profile;
  const [left, top, right, bottom] = bounds, width = right - left, height = bottom - top;
  const scale = 3 / Math.max(width, height);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], weights: number[] = [], skinIds: number[] = [];
  const points = new Map<number, number>();
  const bones: T.Bone[] = [];
  const jelly = a.kind === "jelly", ray = a.kind === "ray";
  // 누운 몸(광어) — GLB 와 같이 옆면이 위(+Y)를 보게 눕힌다(가오리와 같은 회전). 서서 지었다가 GLB 로 갈아 끼우면 몸이 90° 뒤집혔다
  const flat = flatBody(family, key);
  // Seven body/tail joints plus two two-joint fin chains.
  for (let i = 0; i < 7; i++) {
    const bone = new T.Bone(); bone.name = `body-${i}`;
    if (jelly) bone.position.y = i ? -.42 : 1.15;
    else bone.position.x = i ? -.42 : 1.15;
    if (i) bones[i - 1].add(bone); bones.push(bone);
  }
  for (let side = 0; side < 2; side++) {
    const fin = new T.Bone(), tip = new T.Bone(); fin.name = `fin-${side}`; tip.name = `fin-tip-${side}`;
    if (ray) { fin.position.set(-.15, 0, side ? .15 : -.15); tip.position.z = side ? .55 : -.55; }
    else if (flat) { fin.position.set(-.20, 0, side ? .15 : -.15); tip.position.z = side ? .30 : -.30; }
    else { fin.position.set(-.20, side ? -.15 : .15, 0); tip.position.y = side ? -.30 : .30; }
    bones[2].add(fin); fin.add(tip); bones.push(fin, tip);
  }
  const valid = new Set<number>();
  for (let j = 0; j <= grid; j++) for (let r = 0; r < profile.rows[j].length; r += 2) {
    for (let i = profile.rows[j][r]; i <= profile.rows[j][r + 1]; i++) valid.add(j * (grid + 1) + i);
  }
  for (const id of valid) {
    const j = Math.floor(id / (grid + 1)), i = id % (grid + 1), u = i / grid, v = j / grid;
    const x = (u - .5) * width * scale, y = (.5 - v) * height * scale;
    const ellipse = ((u - a.cx) / a.rx) ** 2 + ((v - a.cy) / a.ry) ** 2;
    const flesh = Math.sqrt(Math.max(0, 1 - ellipse));
    // Fin membranes have thickness but never inherit the body's inflated volume.
    const thickness = .008 + a.depth * flesh;
    let boneT = jelly ? (1.15 - y) / .42 : (1.15 - x) / .42;
    boneT = Math.max(0, Math.min(5.999, boneT));
    const b = Math.floor(boneT), f = boneT - b;
    const finWeight = jelly ? unit((v - .35) * 1.5) * .65
      : ray ? unit(Math.abs(v - a.cy) / .35) * unit((u - .30) * 5)
      : unit((ellipse - .65) * 1.5) * unit((u - a.tail) * 8);
    const side = (ray || !jelly ? v > a.cy : u > a.cx) ? 1 : 0;
    const finRoot = 7 + side * 2, finTip = finRoot + 1;
    const tipWeight = unit(ray ? (Math.abs(v - a.cy) - .15) * 4 : (Math.abs(v - a.cy) - a.ry * .5) * 4);
    points.set(id, positions.length / 3);
    for (const sign of [1, -1]) {
      if (ray || flat) positions.push(x, sign * thickness, -y);
      else positions.push(x, y, sign * thickness);
      uvs.push((left + u * width) / image[0], (top + v * height) / image[1]);
      skinIds.push(b, b + 1, finRoot, finTip);
      weights.push((1 - f) * (1 - finWeight), f * (1 - finWeight), finWeight * (1 - tipWeight), finWeight * tipWeight);
    }
  }
  const boundary = new Map<string, [number, number]>();
  function triangle(ids: number[]) {
    if (!ids.every(id => points.has(id))) return;
    // Ray coordinates are a proper rotation of the side-view frame, preserving winding.
    const face = ids;
    const [a, b, c] = face.map(id => points.get(id)!);
    indices.push(a, b, c, a + 1, c + 1, b + 1);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const edge = `${Math.min(from, to)}:${Math.max(from, to)}`;
      if (boundary.has(edge)) boundary.delete(edge); else boundary.set(edge, [from, to]);
    }
  }
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    const k = j * (grid + 1) + i, q = grid + 1;
    triangle([k, k + q, k + 1]); triangle([k + 1, k + q, k + q + 1]);
  }
  // Close all cutout boundaries, including gaps between forked tails/fin rays.
  for (const [from, to] of boundary.values()) indices.push(from, from + 1, to, to, from + 1, to + 1);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(skinIds, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // 재질은 GLB 와 같은 표(materialTweak) — 갈아 끼울 때 광택 · 빛이 달라지지 않게
  const tweak = materialTweak(family, key);
  const material = new T.MeshStandardMaterial({ color: p.base, roughness: tweak.roughness, metalness: tweak.metalness,
    emissive: tweak.emissiveIntensity > 0 ? (tweak.emissive ?? p.base) : 0, emissiveIntensity: Math.max(0, tweak.emissiveIntensity) });
  const mesh = new T.SkinnedMesh(geometry, material); mesh.name = "reference-sculpt";
  mesh.add(bones[0]); mesh.bind(new T.Skeleton(bones)); mesh.frustumCulled = false; root.add(mesh);
  kit.referenceTexture(key, texture => {
    material.map = texture; material.color.set(0xffffff);
    // 빛나는 종은 무늬대로 빛난다(한 색으로 빛나면 그림이 바랜다)
    if (tweak.emissiveFromMap) { material.emissiveMap = texture; material.emissive.set(0xffffff); }
    material.needsUpdate = true;
  });
  // 몸 물결은 종마다 다르다(장어 · 다랑어 · 가오리 · 엔젤 — anatomy.bendProfile). GLB 도 같은 함수를 쓴다
  const wave = bendProfile(family, key), angles = new Float32Array(10), bell = { x: 1, y: 1, z: 1 };
  const curl = [0, 0, 0, 0, 0, 0];
  return { root, animate(time: number, effort: number, pose?: SwimPose) {
    const phase = time * a.frequency * Math.max(.2, effort);
    if (jelly) {
      for (let i = 1; i < 7; i++) { bones[i].rotation.z = Math.sin(phase - i * .6) * (.045 + i * .012); bones[i].rotation.x = Math.cos(phase - i * .5) * .035; }
      // 갓 — 엔진이 해파리 course.pulse 를 넘기면 그 박자(오므리면 솟는 길과 맞는다), 없으면 옛 사인
      jellyPulse(pose?.pulse ?? Math.sin(phase), "y", bell); bones[0].scale.set(bell.x, bell.y, bell.z);
      return;
    }
    // 누운 몸은 물결을 Z 축(위아래)으로, 도는 C 자는 Y 축(모래 평면)으로 따로 — GLB(fishMotion)와 같은 규칙(anatomy.flatBody)
    swimAngles(wave, phase, pose, angles, !flat);
    if (flat) for (let i = 0; i < 6; i++) curl[i] = turnCurl(wave, pose, i);
    for (let i = 1; i < 7; i++) { if (flat) { bones[i].rotation.z = angles[i - 1]; bones[i].rotation.y = curl[i - 1]; } else bones[i].rotation.y = angles[i - 1]; }
    for (let side = 0; side < 2; side++) { bones[7 + side * 2].rotation.x = angles[6 + side * 2]; bones[8 + side * 2].rotation.x = angles[7 + side * 2]; }
  } };
}
