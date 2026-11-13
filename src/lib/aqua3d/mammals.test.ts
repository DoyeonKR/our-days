// 해양 포유류 6계열(2026-11-13) [사용자: "응 포유류 넣고 배포해"] — 점박이물범 · 물개 · 큰바다사자 · 독도 강치 · 해달 · 수달.
// 헤엄치는 법은 실제 생태대로 셋: 물범은 뒷지느러미를 좌우로(몸 뒤쪽 옆 물결), 물개 · 바다사자는 긴 앞지느러미를 날개처럼 위아래로(몸은 곧게),
// 수달 · 해달은 몸과 꼬리를 위아래로 물결친다. 모두 허파로 숨 쉬어 수면에 오른다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FISH_GLB, fishMotion } from "./glb.ts";
import { MAMMAL, bendProfile, verticalWave } from "./anatomy.ts";
import { habitOf } from "./habits.ts";
import { FAMILIES, FISH_BASE_CM } from "../aquarium.ts";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { FRESH_FAMILIES, SPOTS } from "../fishing.ts";
import { TIMED_FISH } from "../fishingworld.ts";
import approved from "./approved-fish.json" with { type: "json" };

const KEYS = ["spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "sea_otter", "otter"];

test("여섯 계열 · 열여덟 모습이 게임에 다 이어져 있다(계열 · 그림 · 모델 · 승인 · 몸길이 · 낚시터나 때 손님)", () => {
  for (const k of KEYS) {
    assert.ok(FAMILIES.some((f) => f.key === k), k);
    assert.ok(FISH_BASE_CM[k] >= 100, `${k} 몸길이`);
    assert.ok(MAMMAL.test(k), k);
    for (const key of [`fry_${k}`, `juv_${k}`, k]) {
      assert.ok(FISH_IMAGE_KEYS.has(key) && FISH_GLB.has(key) && approved.forms.includes(key), key);
    }
    const inPool = SPOTS.some((s) => s.pool.some(([f]) => f === k)), timed = TIMED_FISH.some((t) => t.species === k);
    assert.ok(inPool || timed, `${k} 낚시로 만난다`);
  }
  assert.ok(FRESH_FAMILIES.has("otter") && !FRESH_FAMILIES.has("spotted_seal"), "수달만 민물");
});

test("헤엄치는 법 — 물범은 몸 뒤쪽 옆 물결, 물개 · 바다사자는 앞지느러미로 크게, 수달 · 해달은 위아래 물결 · 모두 숨 쉬러 오른다", () => {
  const seal = bendProfile("spotted_seal"), lion = bendProfile("steller_sea_lion"), otter = bendProfile("otter");
  assert.ok(seal.amp[5] > seal.amp[1] * 6 && seal.pect === "stiff", "물범: 뒷몸으로 치고 앞지느러미는 젓지 않는다");
  assert.ok(lion.fin >= 0.5 && lion.amp[5] < 0.05, "바다사자: 앞지느러미가 크게, 몸은 곧게");
  assert.ok(verticalWave("otter") && verticalWave("sea_otter") && !verticalWave("spotted_seal"), "수달 · 해달만 위아래");
  assert.ok(otter.amp[2] > 0.04, "수달은 몸 전체가 물결친다");
  for (const k of KEYS) assert.ok((habitOf(k).breathe ?? 0) > 0, `${k} 숨 쉬러 오른다`);
  assert.ok(habitOf("sea_otter").lo > 1.5, "해달은 수면 가까이 산다");
});

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
async function spineSpan(key: string, pose: { amp: number; turn?: number }) {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const tail = g.scene.getObjectByName("spine_5")!, anim = fishMotion(g.scene, key.replace(/^(fry_|juv_)/, ""), key);
  const ys: number[] = [], zs: number[] = [];
  for (let k = 0; k < 60; k++) { anim(k / 15, 1, pose); g.scene.updateMatrixWorld(true); const p = g.scene.worldToLocal(tail.getWorldPosition(new T.Vector3())); ys.push(p.y); zs.push(p.z); }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a);
  return { y: span(ys), z: span(zs) };
}

test("모델 — 수달 꼬리는 위아래로, 물범 꼬리는 좌우로 흔들린다(실제 GLB)", async () => {
  const otter = await spineSpan("otter", { amp: 1 }), seal = await spineSpan("spotted_seal", { amp: 1 });
  assert.ok(otter.y > otter.z * 2, `수달 위아래 ${otter.y.toFixed(3)} · 옆 ${otter.z.toFixed(3)}`);
  assert.ok(seal.z > seal.y * 2, `물범 옆 ${seal.z.toFixed(3)} · 위아래 ${seal.y.toFixed(3)}`);
});
