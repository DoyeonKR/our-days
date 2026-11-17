// 뼈 기준 자세(바인드) 검사 — 2026-11-17 [사용자: "해파리도 지금 다리와 몸통이 분리되어있잖아 그러면 실패한 glb라고"]
// 새로 지은 해파리 · 새우의 바인드 행렬이 단위 행렬로 저장돼(뼈 world 행렬을 계산하지 않고 packAsset 에 넘겼다), 게임이 뼈를 입히는 순간
// 입팔 · 꼬리가 그 뼈 자리만큼 밀려 몸과 떨어졌다. 정지 자세에서 '뼈 world 행렬 × 역바인드 = 단위 행렬'이어야 모델이 저장된 모양 그대로 그려진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as T from "three";
import { parseGLB, readDecoded } from "../../../design/aqua3d-review/glb-compress.mjs";

const local = (n: { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }) => {
  const m = new T.Matrix4();
  if (n.matrix) m.fromArray(n.matrix);
  else m.compose(new T.Vector3(...((n.translation ?? [0, 0, 0]) as [number, number, number])), new T.Quaternion(...((n.rotation ?? [0, 0, 0, 1]) as [number, number, number, number])), new T.Vector3(...((n.scale ?? [1, 1, 1]) as [number, number, number])));
  return m;
};

test("every skinned GLB stores bind matrices that match its rest skeleton (parts stay where they were built)", async () => {
  const bad: string[] = [];
  for (const kind of ["fish", "boss"]) {
    let files: string[] = [];
    try { files = readdirSync(`public/aqua/models/${kind}`).filter((f) => f.endsWith(".glb")); } catch { continue; }
    for (const f of files) {
      const { json, bin } = parseGLB(readFileSync(`public/aqua/models/${kind}/${f}`));
      if (!json.skins?.length) continue;
      const parent = new Map<number, number>();
      json.nodes.forEach((n: { children?: number[] }, i: number) => n.children?.forEach((c) => parent.set(c, i)));
      const world = (i: number): T.Matrix4 => { const p = parent.get(i); const m = local(json.nodes[i]); return p === undefined ? m : world(p).multiply(m); };
      for (const skin of json.skins) {
        const ibm = await readDecoded(json, bin, skin.inverseBindMatrices);
        let worst = 0;
        skin.joints.forEach((j: number, k: number) => {
          const m = world(j).multiply(new T.Matrix4().fromArray(Array.from(ibm.slice(k * 16, k * 16 + 16)) as number[]));
          // 단위 행렬과의 차이 — 위치 몫(12 · 13 · 14)은 모델 크기 대비
          const e = m.elements;
          const s = Math.hypot(e[0], e[1], e[2]) || 1; // 노드 배율(양자화)은 IBM 에 곱해져 있다 — 회전 · 이동만 본다
          for (const [a, want] of [[12, 0], [13, 0], [14, 0]] as const) worst = Math.max(worst, Math.abs(e[a] / s - want));
        });
        if (worst > 0.02) bad.push(`${kind}/${f} ${worst.toFixed(3)}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
