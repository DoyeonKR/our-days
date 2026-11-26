import {readFileSync} from 'node:fs';
export function loadSource() {
  const f = readFileSync(new URL('./source/tripo-yujin.glb', import.meta.url)), jl = f.readUInt32LE(12), j = JSON.parse(f.subarray(20, 20 + jl)), bin = f.subarray(20 + jl + 8);
  const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], C = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array, n = {VEC3: 3, SCALAR: 1}[a.type], o = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0); return new C(bin.buffer.slice(o, o + a.count * n * C.BYTES_PER_ELEMENT)); };
  const pr = j.meshes[0].primitives[0], P0 = acc(pr.attributes.POSITION), I0 = acc(pr.indices);
  const map = new Map(), rep = new Int32Array(P0.length / 3), P = [];
  for (let i = 0; i < P0.length / 3; i++) { const v = [P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]], key = v.map((c) => Math.round(c * 1e5)).join(); if (!map.has(key)) { map.set(key, P.length); P.push(v); } rep[i] = map.get(key); }
  const I = []; for (let t = 0; t < I0.length; t += 3) { const a = rep[I0[t]], b = rep[I0[t + 1]], c = rep[I0[t + 2]]; if (a !== b && b !== c && a !== c) I.push(a, b, c); }
  return {P, I};
}
