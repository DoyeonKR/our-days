import * as T from "three";
import { WORLD } from "./world.ts";

/** 정어리 떼(2026-11-10) [사용자: "더 웅장하게 다듬어"] — 대수족관(터널)의 배경 손님. 내 물고기가 아니라 바다의 분위기다(누를 수 없고 저장도 없다).
 *  한 묶음(InstancedMesh)으로 수백 마리를 그린다 — 그리기 호출 하나. 떼의 중심이 터널 둘레를 크게 돌고(리사주 곡선),
 *  한 마리 한 마리는 중심 둘레의 제자리를 맴돌며 숨 쉬듯 모였다 퍼진다(먹이 공처럼). 같은 시각 = 같은 자리(순수 함수, 할당 없음). */
export type Shoal = { mesh: T.InstancedMesh; animate: (t: number) => void; dispose: () => void };

/** 한 마리 몸 — 은빛 마름모 몸통 + 갈라진 꼬리(삼각형 몇 장). 길이 1, 머리가 +x */
function sardineGeometry(): T.BufferGeometry {
  const p = [
    // 몸통(위 · 아래 · 양옆 면)
    0.5, 0, 0, -0.25, 0.09, 0, -0.25, 0, 0.05,
    0.5, 0, 0, -0.25, 0, 0.05, -0.25, -0.07, 0,
    0.5, 0, 0, -0.25, -0.07, 0, -0.25, 0, -0.05,
    0.5, 0, 0, -0.25, 0, -0.05, -0.25, 0.09, 0,
    // 꼬리자루 → 꼬리
    -0.25, 0.09, 0, -0.5, 0.12, 0, -0.25, -0.07, 0,
    -0.25, -0.07, 0, -0.5, -0.1, 0, -0.25, 0.09, 0,
  ];
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

export function makeShoal(count: number, bounds: { halfX: number; halfZ: number; top: number }): Shoal {
  const geo = sardineGeometry();
  const mat = new T.MeshStandardMaterial({ color: 0xe4eef5, metalness: 0.55, roughness: 0.25, emissive: 0x3a6b80, emissiveIntensity: 0.9, side: T.DoubleSide });
  const mesh = new T.InstancedMesh(geo, mat, count);
  mesh.name = "ambient-sardine-shoal";
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  // 한 마리마다 떼 안의 자리(구 안의 고른 점) · 맴도는 빠르기 · 크기 — 시드 고정
  const seat = new Float32Array(count * 4);
  let s = 1234567;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.cbrt(rnd());
    const q = Math.sqrt(1 - u * u);
    seat[i * 4] = q * Math.cos(a) * r;
    seat[i * 4 + 1] = u * r * 0.6;
    seat[i * 4 + 2] = q * Math.sin(a) * r;
    seat[i * 4 + 3] = 0.8 + rnd() * 0.5;
  }
  const dummy = new T.Object3D(), ahead = new T.Vector3(), here = new T.Vector3();
  const floor = WORLD.floor, midY = floor + (bounds.top - floor) * 0.5, ampY = (bounds.top - floor) * 0.18;
  /** 떼 중심 — 수조를 크게 도는 8자. 떼 반지름도 숨 쉬듯 */
  const center = (t: number, out: T.Vector3) => out.set(Math.sin(t * 0.11) * bounds.halfX * 0.42, midY + Math.sin(t * 0.07 + 1.3) * ampY, Math.sin(t * 0.22) * bounds.halfZ * 0.55);
  function place(t: number) {
    const R = 2.6 + 0.8 * Math.sin(t * 0.31);
    for (let i = 0; i < count; i++) {
      const sx = seat[i * 4], sy = seat[i * 4 + 1], sz = seat[i * 4 + 2], sp = seat[i * 4 + 3];
      // 제자리 둘레를 맴돈다 — 떼 전체가 한 방향으로 소용돌이
      const w = t * 0.6 * sp + i;
      const ox = (sx * Math.cos(w * 0.3) - sz * Math.sin(w * 0.3)) * R, oz = (sx * Math.sin(w * 0.3) + sz * Math.cos(w * 0.3)) * R, oy = sy * R + Math.sin(w) * 0.08;
      const lag = t - (sx + 1) * 0.6;
      center(lag, here);
      center(lag + 0.15, ahead);
      const x = here.x + ox, y = here.y + oy, z = here.z + oz;
      dummy.position.set(x, y, z);
      dummy.lookAt(x + (ahead.x - here.x) - Math.sin(w * 0.3) * 0.02, y + (ahead.y - here.y), z + (ahead.z - here.z) + Math.cos(w * 0.3) * 0.02);
      dummy.rotateY(-Math.PI / 2); // 몸은 +x 가 머리 — lookAt 은 +z 를 맞춘다
      const k = 0.62 * sp;
      dummy.scale.set(k, k, k * (1 + 0.15 * Math.sin(w * 6)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  place(0);
  return {
    mesh,
    animate: place,
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); mesh.removeFromParent(); },
  };
}
