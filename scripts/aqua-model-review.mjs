/** Local CPU geometry/texture proof renders. No browser, remote API or paid service.
 * Not a substitute for final WebGL/PBR/mobile QA and never auto-approves a model.
 * node scripts/aqua-model-review.mjs [output-directory]
 */
import * as T from "three";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { makeAnimal, ModelKit } from "../src/lib/aqua3d/models.ts";
import { FAMILIES } from "../src/lib/aquarium.ts";
import { anatomy } from "../src/lib/aqua3d/anatomy.ts";

const output = path.resolve(process.argv[2] || ".local/aqua-review");
await mkdir(output, { recursive: true });
const size = process.argv.includes("--all") ? 320 : 768;
const light = new T.Vector3(-.3, 1, 1).normalize();
const edge = (a, b, x, y) => (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
const views = [
  ["oblique", [2.7, 4.3, 6.1]],
  ["side", [0, 1.1, 7.5]],
  ["front", [7, 1.8, 1.8]],
  ["top", [0, 7.5, .01]],
];

function render(root, eye) {
  const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 50);
  camera.position.set(...eye); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  root.updateMatrixWorld(true);
  const pixels = new Uint8Array(size * size * 4), depth = new Float32Array(size * size).fill(Infinity);
  const project = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  root.traverse(mesh => {
    if (!(mesh instanceof T.Mesh) || !mesh.visible) return;
    const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const material = mesh.material;
    if (Array.isArray(material)) throw new Error("Review renderer requires one material per mesh");
    const normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const vertices = [];
    for (let i = 0; i < p.count; i++) {
      const local = new T.Vector3().fromBufferAttribute(p, i);
      if (mesh instanceof T.SkinnedMesh) mesh.applyBoneTransform(i, local);
      const world = local.applyMatrix4(mesh.matrixWorld), clip = world.clone().applyMatrix4(project);
      const normal = n ? new T.Vector3().fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize() : new T.Vector3(0, 1, 0);
      vertices.push({ x: (clip.x + 1) * size / 2, y: (1 - clip.y) * size / 2, z: clip.z, u: uv?.getX(i) ?? 0, v: uv?.getY(i) ?? 0, normal });
    }
    const count = g.index?.count ?? p.count;
    const base = (material.color || new T.Color(1, 1, 1)).clone().convertLinearToSRGB();
    const texture = material.map?.image;
    for (let j = 0; j < count; j += 3) {
      const ids = [0, 1, 2].map(k => g.index ? g.index.getX(j + k) : j + k);
      const [a, b, c] = ids.map(i => vertices[i]);
      const area = edge(a, b, c.x, c.y); if (Math.abs(area) < .001) continue;
      // Front faces use clockwise screen coordinates (screen Y is downward).
      if (material.side !== T.DoubleSide && area < 0) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxX = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxY = Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const w0 = edge(b, c, x + .5, y + .5) / area, w1 = edge(c, a, x + .5, y + .5) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = a.z * w0 + b.z * w1 + c.z * w2, i = y * size + x;
        if (d >= depth[i]) continue;
        const normal = a.normal.clone().multiplyScalar(w0).addScaledVector(b.normal, w1).addScaledVector(c.normal, w2).normalize();
        const diffuse = .45 + .60 * Math.max(0, normal.dot(light));
        let r = base.r * 255, green = base.g * 255, blue = base.b * 255;
        if (texture?.data) {
          const u = Math.max(0, Math.min(1, a.u * w0 + b.u * w1 + c.u * w2));
          const v = Math.max(0, Math.min(1, a.v * w0 + b.v * w1 + c.v * w2));
          const offset = (Math.min(texture.height - 1, Math.floor(v * texture.height)) * texture.width + Math.min(texture.width - 1, Math.floor(u * texture.width))) * 4;
          if (texture.data[offset + 3] / 255 < (material.alphaTest || 0)) continue;
          r *= texture.data[offset] / 255; green *= texture.data[offset + 1] / 255; blue *= texture.data[offset + 2] / 255;
        }
        depth[i] = d;
        pixels[i * 4] = Math.min(255, r * diffuse); pixels[i * 4 + 1] = Math.min(255, green * diffuse);
        pixels[i * 4 + 2] = Math.min(255, blue * diffuse); pixels[i * 4 + 3] = 255;
      }
    }
  });
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } });
}

const all = process.argv.includes("--all");
const forms = FAMILIES.flatMap(f => [`fry_${f.key}`, `juv_${f.key}`, ...f.finals.map(s => s.key)].map(key => ({ family: f.key, key })));
const selected = all ? forms : forms.filter(f => f.key === "green_sea_turtle");
const cards = [];
for (const { family, key } of selected) {
  const kit = new ModelKit();
  const source = await sharp(`public/aqua/${family === "sea_turtle" ? "fish" : "skin"}/${key}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const original = new T.DataTexture(source.data, source.info.width, source.info.height);
  original.colorSpace = T.SRGBColorSpace; original.needsUpdate = true;
  kit.referenceTextures.set(key, original);
  const model = makeAnimal(kit, family, key);
  const ray = family === "ray" || family === "manta" || key === "aurora_ray";
  const reviewViews = ray ? [["oblique", [2.7, 5.8, 4]], ["side", [0, 7.5, .01]], views[2], views[3]] : views;
  const stills = [];
  for (const [name, eye] of reviewViews) {
    model.animate(0, 1);
    const file = path.join(output, `${key}-${name}.png`);
    await render(model.root, eye).png().toFile(file); stills.push(file);
  }
  const frames = [], animation = [];
  const frequency = family === "sea_turtle" ? 2.1 : anatomy(family, key).frequency;
  for (let i = 0; i < 12; i++) {
    model.animate(i / 12 * Math.PI * 2 / frequency, 1);
    const bytes = await render(model.root, reviewViews[0][1]).resize(384, 384).png().toBuffer();
    frames.push({ input: bytes, left: i % 4 * 384, top: Math.floor(i / 4) * 384 });
    animation.push(await sharp(bytes).ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(animation), { raw: { width: 384, height: 384 * animation.length, channels: 4, pageHeight: 384 } })
    .webp({ quality: 88, delay: 250, loop: 0 }).toFile(path.join(output, `${key}-motion.webp`));
  await sharp({ create: { width: 1536, height: 1152, channels: 4, background: "#172e35" } }).composite(frames).png().toFile(path.join(output, `${key}-motion-sheet.png`));
  const reference = await sharp(`public/aqua/fish/${key}.webp`).resize(size, size).png().toBuffer();
  const composites = [{ input: reference, left: 0, top: 0 }];
  for (let i = 0; i < stills.length; i++) composites.push({ input: await sharp(stills[i]).png().toBuffer(), left: (i + 1) % 3 * size, top: Math.floor((i + 1) / 3) * size });
  await sharp({ create: { width: size * 3, height: size * 2, channels: 4, background: "#172e35" } }).composite(composites).png().toFile(path.join(output, `${key}-comparison.png`));
  const tiles = [`public/aqua/fish/${key}.webp`, stills[1], stills[0]];
  const cardParts = [];
  for (let i = 0; i < tiles.length; i++) cardParts.push({ input: await sharp(tiles[i]).resize(128, 128).png().toBuffer(), left: i * 128, top: 0 });
  cardParts.push({ input: Buffer.from(`<svg width="384" height="32"><text x="8" y="21" fill="white" font-size="14">${key}</text></svg>`), left: 0, top: 128 });
  cards.push(await sharp({ create: { width: 384, height: 160, channels: 4, background: "#172e35" } }).composite(cardParts).png().toBuffer());
  console.log(`Rendered ${key} (4 views + articulated cycle)`);
}
for (let page = 0; page < Math.ceil(cards.length / 21); page++) {
  const parts = cards.slice(page * 21, (page + 1) * 21).map((input, i) => ({ input, left: i % 3 * 384, top: Math.floor(i / 3) * 160 }));
  await sharp({ create: { width: 1152, height: Math.ceil(parts.length / 3) * 160, channels: 4, background: "#172e35" } }).composite(parts).png().toFile(path.join(output, `all-models-${page + 1}.png`));
}
console.log(`Local renders (not numerical similarity ratings): ${output}`);
