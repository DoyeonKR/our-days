// 갈라파고스 물개 · 바다사자과(Otariidae) 수중 비행 모션 회귀 테스트.
// — 단순 1축 펄럭임이 아니라 3축(상하 날갯짓 + 전후 노 젓기 스윕 + 페더링)으로 8자 스트로크를 그리고,
//   유연한 척추 상하 아치가 동반되며, 바위·해변 휴식 시에는 지느러미 펄럭임을 멈추고 고개만 천천히 두리번거린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };

async function loadSeal(key: string) {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => webp as never)
    .parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group();
  holder.add(g.scene);
  const anim = fishMotion(g.scene, key.replace(/^(fry_|juv_)/, ""), key);
  return { holder, scene: g.scene, anim };
}

test("갈라파고스 물개 유영 — 앞지느러미발이 상하(Y) + 전후(X) 3D 8자 스트로크를 그리며 척추가 유연하게 아치를 그린다", async () => {
  const { holder, scene, anim } = await loadSeal("galapagos_fur_seal");
  const tipL = scene.getObjectByName("fin_L_tip")!;
  const spine2 = scene.getObjectByName("spine_2")!;
  assert.ok(tipL && spine2);

  const xs: number[] = [], ys: number[] = [], spineYs: number[] = [];
  for (let k = 0; k < 180; k++) {
    anim(k / 30, 1, { dt: 1 / 30, amp: 1, effort: 1, speed: 0.4, turn: 0, hover: 0, ground: 0 });
    holder.updateMatrixWorld(true);
    const p = holder.worldToLocal(tipL.getWorldPosition(new T.Vector3()));
    xs.push(p.x);
    ys.push(p.y);
    spineYs.push(spine2.rotation.z);
  }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a);
  assert.ok(span(ys) > 0.12, `상하 날갯짓 폭 ${span(ys).toFixed(3)}`);
  assert.ok(span(xs) > 0.12, `전후 노 젓기 스윕 폭 ${span(xs).toFixed(3)}`);
  assert.ok(span(spineYs) > 0.03, `유연한 척추 상하 아치 ${span(spineYs).toFixed(3)}`);
});

test("갈라파고스 물개 휴식 — 바위·해변(amp=0, ground=1)에서는 지느러미 펄럭임을 멈추고 머리가 천천히 두리번거린다", async () => {
  const { holder, scene, anim } = await loadSeal("galapagos_fur_seal");
  const tipL = scene.getObjectByName("fin_L_tip")!;
  const head = scene.getObjectByName("spine_0")!;

  const tipYs: number[] = [], headYaws: number[] = [];
  for (let k = 0; k < 180; k++) {
    anim(k / 30, 0.2, { dt: 1 / 30, amp: 0, effort: 0.05, speed: 0, turn: 0, hover: 1, ground: 1 });
    holder.updateMatrixWorld(true);
    if (k > 30) {
      const p = holder.worldToLocal(tipL.getWorldPosition(new T.Vector3()));
      tipYs.push(p.y);
      headYaws.push(head.rotation.y);
    }
  }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a);
  assert.ok(span(tipYs) < 0.06, `휴식 중 지느러미 펄럭임 정지(${span(tipYs).toFixed(3)})`);
  assert.ok(span(headYaws) > 0.12, `휴식 중 천천히 두리번거림(${span(headYaws).toFixed(3)})`);
});
