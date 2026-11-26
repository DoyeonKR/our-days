// 북극곰 개헤엄(2026-11-25) — 실제 GLB 와 게임의 fishMotion 으로 잰다.
// 앞발은 좌우가 반 바퀴 어긋나 번갈아 앞뒤(몸 길이 방향 x)로 젓는다 — 옆(z)으로 벌어지지 않는다. 뒤로 밀 때(앞발 끝이 뒤) 팔을 펴고 앞으로 되돌릴 때 굽힌다.
// 몸통(머리)은 거의 흔들리지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";
import { URSID, MAMMAL } from "./anatomy.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
async function run(key: string) {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene);
  const anim = fishMotion(g.scene, "polar_bear", key), L = g.scene.getObjectByName("fin_L_tip")!, R = g.scene.getObjectByName("fin_R_tip")!, head = g.scene.getObjectByName("spine_0")!;
  const ls: T.Vector3[] = [], rs: T.Vector3[] = [], hs: T.Vector3[] = [];
  for (let k = 0; k < 240; k++) {
    holder.position.set(k / 60 * 0.4, 0, 0);
    anim(k / 60, 1, { dt: 1 / 60, effort: 1, amp: 1, speed: 0.4 });
    holder.updateMatrixWorld(true);
    if (k >= 60) { ls.push(g.scene.worldToLocal(L.getWorldPosition(new T.Vector3()))); rs.push(g.scene.worldToLocal(R.getWorldPosition(new T.Vector3()))); hs.push(g.scene.worldToLocal(head.getWorldPosition(new T.Vector3()))); }
  }
  return { ls, rs, hs };
}
const span = (a: T.Vector3[], c: "x" | "y" | "z") => Math.max(...a.map((v) => v[c])) - Math.min(...a.map((v) => v[c]));
const corr = (a: number[], b: number[]) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); };

test("북극곰은 포유류 · 개헤엄(URSID) 갈래다", () => {
  assert.ok(URSID.test("polar_bear") && MAMMAL.test("polar_bear"));
});

test("앞발은 좌우 번갈아 앞뒤로 젓는다 — 옆으로 벌어지지 않고, 몸통 · 머리는 거의 안 흔들린다", async () => {
  for (const key of ["polar_bear", "juv_polar_bear", "fry_polar_bear"]) {
    const { ls, rs, hs } = await run(key);
    const fore = span(ls, "x"), side = span(ls, "z");
    assert.ok(fore > 0.12, `${key} 앞발 끝이 앞뒤로 ${fore.toFixed(3)} 움직인다(몸길이 2 기준)`);
    assert.ok(side < fore * 0.35, `${key} 옆으로는 작게 ${side.toFixed(3)} < 앞뒤 ${fore.toFixed(3)} 의 35%`);
    const c = corr(ls.map((v) => v.x), rs.map((v) => v.x));
    assert.ok(c < -0.6, `${key} 좌우가 번갈아 젓는다(상관 ${c.toFixed(2)})`);
    assert.ok(span(hs, "z") < fore * 0.35, `${key} 머리 옆 흔들림 ${span(hs, "z").toFixed(3)} 작다`);
  }
});

// 2026-11-26 [사용자: "북극곰 벨루가 모두 태초 등급으로 설정하고 획득 확률 2% 미만으로해"] — 벨루가도 같은 잣대로
test("북극곰 · 벨루가는 태초이고 한 번 던질 때 2% 미만으로만 문다(2026-11-26 [사용자: \"무조건 2퍼센트 미만으로 잡히게\"]) — 가장 좋은 미끼 · 행운 · 던지기, 모든 시간 · 날씨 · 낚시터", async () => {
  const { SPOTS, BAITS, rollCatch } = await import("../fishing.ts");
  const { FAMILIES } = await import("../aquarium.ts");
  for (const key of ["polar_bear", "beluga"]) assert.equal(FAMILIES.find((f) => f.key === key)!.finals[0].grade, "태초", key);
  for (const sp of SPOTS) for (const time of ["dawn", "day", "dusk", "night"] as const) for (const wx of [null, "rain", "snow", "clear"] as const) {
    const n: Record<string, number> = { polar_bear: 0, beluga: 0 }; const N = 3000;
    for (let i = 0; i < N; i++) { const f = rollCatch(sp, 50, 1, i * 41 + 7, { bait: BAITS.length - 1, when: { time, wx } }).family; if (f in n) n[f]++; }
    for (const key of Object.keys(n)) assert.ok(n[key] / N < 0.02, `${key} ${sp.key} ${time} ${wx}: ${(n[key] / N * 100).toFixed(2)}%`);
  }
});
