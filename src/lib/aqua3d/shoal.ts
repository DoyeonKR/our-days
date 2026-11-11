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
  // 한 마리마다 떼 안의 자리(납작한 구 안) · 크기 — 시드 고정. 2026-11-11: 자리를 고른 격자(조금 흔든)에서 골라 이웃끼리 간격이 일정하고,
  // 떼가 다 같이 한 덩어리로 돈다 — 예전엔 구 안의 아무 점이라 붙은 자리가 있었고, 마리마다 도는 빠르기 · 위아래 흔들림이 달라 서로를 뚫고 지나갔다(가장 가까운 이웃 0.15 미만 11%)
  const seat = new Float32Array(count * 4);
  let s = 1234567;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const SQ = 0.7, pts: number[] = [];
  let step = Math.cbrt((4 / 3) * Math.PI * SQ / Math.max(1, count)) * 0.98;
  for (let tries = 0; tries < 8 && pts.length / 3 < count; tries++, step *= 0.94) {
    pts.length = 0;
    const n = Math.ceil(1 / step);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let c = -n; c <= n; c++) {
      // 층마다 반 칸 어긋나게(벌집 비슷) — 같은 간격에 더 많이 들어간다
      const x = (a + (b & 1) * 0.5) * step, y = b * step * 0.87, z = (c + (a & 1) * 0.5) * step;
      if (x * x + (y / SQ) ** 2 + z * z <= 1) pts.push(x, y, z);
    }
  }
  // 고른 순서는 정해진 섞기 — 수가 적어도 떼 전체에 퍼진다
  const total = pts.length / 3, order = Array.from({ length: total }, (_, k) => k).sort((p, q) => ((Math.imul(p + 1, 2654435761) >>> 0) % 10007) - ((Math.imul(q + 1, 2654435761) >>> 0) % 10007));
  for (let i = 0; i < count; i++) {
    const k = order[i % total];
    seat[i * 4] = pts[k * 3] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 1] = pts[k * 3 + 1] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 2] = pts[k * 3 + 2] + (rnd() - 0.5) * step * 0.2;
    seat[i * 4 + 3] = 0.8 + rnd() * 0.5;
  }
  const dummy = new T.Object3D(), here = new T.Vector3(), now = new T.Vector3(), next = new T.Vector3();
  const floor = WORLD.floor, midY = floor + (bounds.top - floor) * 0.5, ampY = (bounds.top - floor) * 0.18;
  // 떼 반지름은 2.6 ± 0.8(숨 쉬듯) — 중심이 도는 폭 + 반지름 + 몸 반이 유리 안에 들도록 가로 · 앞뒤 폭을 줄인다(2026-11-11 — 8단계에서 1% 가 유리 밖이었다)
  const RMAX = 3.4, body = 0.45;
  const swingX = Math.max(0, Math.min(bounds.halfX * 0.42, bounds.halfX - RMAX - body)), kx = Math.min(1, Math.max(0.3, (bounds.halfX - swingX - body) / RMAX));
  const swingZ = Math.max(0, Math.min(bounds.halfZ * 0.55, bounds.halfZ - RMAX * 0.7 - body)), kz = Math.min(1, Math.max(0.3, (bounds.halfZ - swingZ - body) / RMAX));
  /** 떼 중심 — 수조를 크게 도는 8자 */
  const center = (t: number, out: T.Vector3) => out.set(Math.sin(t * 0.11) * swingX, midY + Math.sin(t * 0.07 + 1.3) * ampY, Math.sin(t * 0.22) * swingZ);
  /** i 번째 정어리의 자리(시각 t) — 순수 함수 */
  const at = (i: number, t: number, out: T.Vector3) => {
    const sx = seat[i * 4], sy = seat[i * 4 + 1], sz = seat[i * 4 + 2];
    const R = 2.6 + 0.8 * Math.sin(t * 0.31), w = t * 0.19;
    // 떼 전체가 한 방향으로 소용돌이 — 다 같은 빠르기라 이웃끼리 간격이 유지된다. 위아래 물결도 자리에 따라 이어진다(이웃은 같이 움직인다)
    const ox = (sx * Math.cos(w) - sz * Math.sin(w)) * R * kx, oz = (sx * Math.sin(w) + sz * Math.cos(w)) * R * kz;
    const oy = sy * R + Math.sin(t * 0.9 + sx * 2.1 + sz * 1.7) * 0.05;
    center(t - (sx + 1) * 0.6, here);
    return out.set(here.x + ox, here.y + oy, here.z + oz);
  };
  function place(t: number) {
    for (let i = 0; i < count; i++) {
      // 머리는 제 자리가 실제로 가는 쪽(앞뒤 시각의 자리 차이) — 떼 중심의 방향을 보면 소용돌이 바깥쪽 정어리가 옆으로 기었다
      at(i, t + 0.08, next); at(i, t, now);
      dummy.position.copy(now);
      dummy.lookAt(next.x, next.y, next.z);
      dummy.rotateY(-Math.PI / 2); // 몸은 +x 가 머리 — lookAt 은 +z 를 맞춘다
      const sp = seat[i * 4 + 3], k = 0.62 * sp;
      dummy.scale.set(k, k, k * (1 + 0.15 * Math.sin(t * 0.6 * sp * 6 + i)));
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
