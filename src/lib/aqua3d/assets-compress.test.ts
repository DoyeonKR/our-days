/* 수조 GLB 배포 형식 잠금 (2026-11-05)
 * 왜: 물고기 219 · 장식 37 GLB 가 42.9MB(gzip 23.2MB)였다 — 물고기 텍스처는 512px 그림을 768px JPEG 로 늘려 담았고, 형상은 float32,
 * 장식 37개는 같은 512px PNG 아틀라스를 하나씩 품었다. 지금은 형상 = KHR_mesh_quantization + EXT_meshopt_compression,
 * 텍스처 = 512px WebP(EXT_texture_webp)다(design/aqua3d-review/glb-compress.mjs). 8.9MB(gzip 6.1MB).
 * 이 테스트는 (1) 모든 파일이 그 형식인지 (2) 게임과 같은 길(three GLTFLoader + MeshoptDecoder)로 실제로 열리고
 * 뼈 · 가중치 · 배율이 맞는지 본다. 원본과 정점 하나하나 대조는 scripts/aqua-model-verify.mjs(git 의 압축 전 파일이 필요해서 테스트 밖).
 * ⚠ 압축본은 glb.ts 가 loader.setMeshoptDecoder 를 불러야 열린다 — 없으면 GLB 가 전부 실패하고 수조가 코드 모델로만 남는다(조용히). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const DEPLOY = ["EXT_meshopt_compression", "EXT_texture_webp", "KHR_mesh_quantization"];
const files = (["fish", "decor"] as const).flatMap((kind) => readdirSync(`public/aqua/models/${kind}`).filter((f) => f.endsWith(".glb")).map((f) => ({ kind, key: f.slice(0, -4), path: `public/aqua/models/${kind}/${f}` })));

type Json = {
  extensionsUsed?: string[]; extensionsRequired?: string[]; buffers: { byteLength: number; uri?: string; extensions?: Record<string, { fallback?: boolean }> }[];
  bufferViews: { buffer: number; byteLength: number; byteStride?: number; extensions?: Record<string, { buffer: number; byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string }> }[];
  accessors: { bufferView: number; componentType: number; count: number; type: string; normalized?: boolean; min?: number[]; max?: number[] }[];
  images: { bufferView?: number; uri?: string; mimeType?: string }[]; textures: { source?: number; extensions?: Record<string, { source: number }> }[];
  meshes: { extras?: { aquaPositionScale?: number }; primitives: { attributes: Record<string, number>; indices: number }[] }[];
  nodes: { mesh?: number; skin?: number; scale?: number[] }[]; skins?: { joints: number[] }[];
};
const parse = (b: Buffer) => {
  assert.equal(b.readUInt32LE(0), 0x46546c67); assert.equal(b.readUInt32LE(4), 2); assert.equal(b.readUInt32LE(8), b.length);
  const jl = b.readUInt32LE(12);
  return { json: JSON.parse(b.toString("utf8", 20, 20 + jl)) as Json, bin: b.subarray(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) };
};
/** WebP 머리에서 가로 · 세로를 읽는다(VP8 · VP8L · VP8X) */
const webpSize = (b: Buffer): [number, number] => {
  assert.equal(b.toString("ascii", 0, 4), "RIFF"); assert.equal(b.toString("ascii", 8, 12), "WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (chunk === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  throw new Error(`모르는 WebP ${chunk}`);
};

test("수조 GLB 418개 전부 배포 형식(meshopt · 양자화 · 512px 이하 WebP 내장)이고 압축을 풀면 뼈 · 가중치 · 위치가 말이 된다", async () => {
  await MeshoptDecoder.ready;
  const mammalKeys=JSON.parse(readFileSync('design/aqua3d-review/mammals-status.json','utf8')).keys as string[];
  assert.equal(new Set(mammalKeys).size,18);
  for(const key of mammalKeys)assert.ok(files.some(f=>f.kind==='fish'&&f.key===key),key);
  assert.equal(files.filter(f=>f.kind==='fish').length,381+mammalKeys.length);
  assert.equal(files.filter(f=>f.kind==='decor').length,37);
  for (const { key, path } of files) {
    const b = readFileSync(path), { json: j, bin } = parse(b);
    assert.deepEqual([...(j.extensionsUsed ?? [])].sort(), DEPLOY, key);
    assert.deepEqual([...(j.extensionsRequired ?? [])].sort(), DEPLOY, key);
    // buffer 0 = GLB BIN, buffer 1 = 풀린 데이터 자리(fallback, 실제 바이트 없음 · uri 없음)
    assert.equal(j.buffers.length, 2, key); assert.equal(j.buffers[0].uri, undefined, key); assert.equal(j.buffers[1].uri, undefined, key);
    assert.equal(j.buffers[1].extensions?.EXT_meshopt_compression?.fallback, true, key);
    // 텍스처: 파일 하나로 완결(외부 uri 없음) · WebP · 512 이하
    assert.equal(j.images.length, 1, key); assert.equal(j.images[0].uri, undefined, key); assert.equal(j.images[0].mimeType, "image/webp", key);
    for (const t of j.textures) { assert.equal(t.source, undefined, key); assert.equal(t.extensions?.EXT_texture_webp?.source, 0, key); }
    const iv = j.bufferViews[j.images[0].bufferView!], img = bin.subarray((iv as { byteOffset?: number }).byteOffset ?? 0, ((iv as { byteOffset?: number }).byteOffset ?? 0) + iv.byteLength);
    const [w, h] = webpSize(Buffer.from(img)); assert.ok(w <= 512 && h <= 512 && w >= 256 && h >= 256, `${key} ${w}x${h}`);
    const decode = (accessor: number) => {
      const a = j.accessors[accessor], ext = j.bufferViews[a.bufferView].extensions?.EXT_meshopt_compression;
      assert.ok(ext, `${key}: 형상 bufferView ${a.bufferView} 가 압축되지 않았다`);
      assert.equal(ext.count, a.count, key);
      const out = new Uint8Array(ext.count * ext.byteStride);
      MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength), ext.mode as "ATTRIBUTES", (ext.filter ?? "NONE") as "NONE");
      return { a, view: new DataView(out.buffer), stride: ext.byteStride };
    };
    j.nodes.forEach((node) => {
      if (node.mesh === undefined) return;
      const s = j.meshes[node.mesh].extras?.aquaPositionScale;
      assert.ok(s && s > 0 && s < 1e-3, `${key}: 위치 배율 ${s}`);
      // 뼈 메시는 배율이 IBM 에 들어가 있어 노드 scale 이 없어야 하고(glTF 규칙상 무시된다), 고정 메시는 노드 scale = 배율(균등)
      if (node.skin !== undefined) assert.equal(node.scale, undefined, key);
      else assert.ok(node.scale && node.scale.every((v) => Math.abs(v - s) < s * 1e-9), `${key}: 노드 scale`);
    });
    for (const mesh of j.meshes) for (const p of mesh.primitives) {
      const pos = decode(p.attributes.POSITION), n = pos.a.count;
      assert.equal(pos.a.componentType, 5122, key);
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
        const v = pos.view.getInt16(i * pos.stride + c * 2, true);
        assert.ok(v >= pos.a.min![c] && v <= pos.a.max![c], `${key}: 위치가 min/max 밖`);
      }
      const idx = decode(p.indices);
      for (let i = 0; i < idx.a.count; i++) { const v = idx.a.componentType === 5125 ? idx.view.getUint32(i * idx.stride, true) : idx.view.getUint16(i * idx.stride, true); assert.ok(v < n, `${key}: index ${v} ≥ 정점 ${n}`); }
      if (p.attributes.JOINTS_0 !== undefined) {
        const bones = j.skins![0].joints.length, jo = decode(p.attributes.JOINTS_0), we = decode(p.attributes.WEIGHTS_0);
        assert.equal(we.a.componentType, 5123, key); assert.equal(we.a.normalized, true, key);
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let c = 0; c < 4; c++) { assert.ok(jo.view.getUint8(i * jo.stride + c) < bones, `${key}: 뼈 번호`); sum += we.view.getUint16(i * we.stride + c * 2, true); }
          assert.equal(sum, 65535, `${key}: 정점 ${i} 가중치 합`); // three 는 합을 다시 맞추지 않는다 — 어긋나면 그 정점이 쪼그라든다
        }
      }
    }
  }
});

/** node 엔 이미지 디코더가 없어서 텍스처만 빈 것으로 — 이름이 EXT_texture_webp 라 내장 WebP 처리기 자리에 들어간다 */
const stub = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (b: Buffer) => new Promise<GLTF>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => stub).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", res, rej));

test("게임과 같은 길(GLTFLoader + MeshoptDecoder)로 모두 열리고 · 물고기는 뼈 10개(불가사리 25)로 휘며 · 크기는 원본과 같은 단위다", async () => {
  for (const { kind, key, path } of files) {
    const g = await open(readFileSync(path));
    g.scene.updateMatrixWorld(true);
    const meshes: T.Mesh[] = []; g.scene.traverse((o) => { if ((o as T.Mesh).isMesh) meshes.push(o as T.Mesh); });
    assert.ok(meshes.length >= 1, key);
    const size = new T.Box3().setFromObject(g.scene).getSize(new T.Vector3());
    // 물고기는 약 2 단위 길이 · 장식은 바닥 가운데 원점으로 4 단위 안쪽 — 배율을 잘못 되돌리면 1000배 넘게 커진다
    assert.ok(size.length() > 0.3 && size.length() < 6, `${key}: 크기 ${size.toArray()}`);
    if (kind === "fish") {
      assert.equal(meshes.length, 1, key);
      const m = meshes[0] as T.SkinnedMesh;
      assert.ok(m.isSkinnedMesh, key);
      // 입체 두족류(v2) — 뼈 10 + 외투막 + 팔마다 여섯 마디(팔 8 → 59, 팔 10 → 71)
      const v2 = m.userData.aquaGeometry === "ceph-volume-v2";
      assert.equal(m.skeleton.bones.length, key.endsWith("starfish") ? 25 : v2 ? 11 + 6 * (m.userData.armCount as number) : 10, key);
      // v2 두족류는 uv 를 float 로 둔다(팔 무늬 좌표가 0 ~ 1 밖까지 간다)
      assert.ok(m.geometry.attributes.skinWeight.normalized && m.geometry.attributes.normal.normalized && (v2 || m.geometry.attributes.uv.normalized), key);
      assert.equal(m.material instanceof T.MeshStandardMaterial && !!m.material.map, true, key);
    }
  }
});

const glbSource = readFileSync("src/lib/aqua3d/glb.ts", "utf8");
const registered = /setMeshoptDecoder\s*\(\s*MeshoptDecoder\s*\)/.test(glbSource);
// ⚠ 엔진 쪽 변경(glb.ts 가 MeshoptDecoder 를 등록)과 같이 merge 해야 한다. 그 전까지는 todo 로 남겨 실패를 알리기만 한다 —
// 등록이 들어오면 todo 가 풀려 진짜 잠금이 된다.
test("glb.ts 가 MeshoptDecoder 를 등록한다 — 없으면 압축 GLB 가 전부 못 열려 수조가 코드 모델로만 남는다", { todo: registered ? false : "glb.ts setMeshoptDecoder 변경(엔진 브랜치)과 함께 merge" }, () => {
  assert.ok(registered);
  assert.match(glbSource, /three\/examples\/jsm\/libs\/meshopt_decoder\.module\.js/);
});
