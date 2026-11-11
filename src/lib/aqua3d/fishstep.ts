/** 수조 한 프레임의 물고기 자리(2026-11-11) — scene.ts 의 draw 가 부르던 길 → 늘리기 → 겹침 밀기 → 모래에 앉히기를 한 함수로 뺐다.
 *  화면과 테스트(motion.test · aquamotion.test)가 같은 식을 쓰게 하려고(예전엔 테스트가 화면 식을 흉내 내다 깊이 · 높이 변환이 어긋난 채 통과했다).
 *  three 를 쓰지 않는다. 결과는 buffers 에 쓴다(할당 없음). 같은 입력 = 같은 자리(겹침 밀기 보정값만 프레임마다 이어진다). */
import { habitKey, roomX, type Course, type Feed, type Hall, type Obstacle } from "./habits.ts";
import { starCourse } from "./invertebrates.ts";
import { WORLD, floorPose, schoolCourse, separate } from "./world.ts";
import { tunnelSpan } from "./tunnel.ts";

export type StepFish = { family: string; key: string; length: number; phase: number; course: Course };
export type StepWorld = {
  wide: number; tall: number; deep: number;
  heightAt: (x: number, z: number) => number;
  obstacles: readonly Obstacle[]; feed: Feed | null; hall: Hall | null;
};
export type StepBuffers = {
  positions: Float32Array; heading: Float32Array; lengths: Float32Array; pinned: Float32Array; offsets: Float32Array; rolls: Float32Array;
  courses: Course[]; count: number;
};
const FP = { pitch: 0, roll: 0, slope: 0, ground: 0 };

/** 한 프레임 — swimmers 의 순서가 buffers 의 순서다. elapsed 는 수조 시계(초), dt 는 이번 프레임(초, 0 이면 멈춘 그리기) */
export function stepFish(swimmers: Iterable<[number, StepFish]>, schools: ReadonlyMap<number, { leader: number; slot: number }>, lengthOf: (id: number) => number | undefined,
  elapsed: number, dt: number, w: StepWorld, b: StepBuffers) {
  const { wide, tall, deep, hall } = w;
  const opts = { obstacles: w.obstacles, feed: w.feed, deep, tall, hall, leaderLength: 0 as number | undefined, out: undefined as Course | undefined };
  const span = hall?.kind === "tunnel" ? tunnelSpan(deep) : null;
  let n = 0;
  // 1) 이번 프레임 길 — 모두의 자리를 먼저 채운다
  for (const [id, m] of swimmers) {
    const sc = schools.get(id), c = m.course;
    // 길 — 장식 · 바위 · 터널 · 돔을 피하고(obstacles · hall) 먹이에 모인다(feed). 무리는 대장 몸으로 길을 계산해야 같은 길을 따라간다
    if (m.family === 'starfish') { const s = starCourse(id, elapsed, m.length, wide, { obstacles: w.obstacles, deep, tall, hall }); c.x = s.x; c.y = s.y; c.z = s.z; c.dx = s.dx; c.dy = s.dy; c.dz = s.dz; c.effort = s.effort; c.turn = 0; c.amp = 1; c.pulse = 0; c.ground = 1; c.puff = -1; c.hover = 0; c.feed = 0; }
    else { opts.leaderLength = lengthOf(sc?.leader ?? id); opts.out = c; schoolCourse(sc?.leader ?? id, sc?.slot ?? 0, id, elapsed, m.length, habitKey(m.family, m.key), wide, opts); }
    // 위로 늘리기 — 바닥에 붙은 만큼(ground)은 모래 높이만 따르고 몸 높이(hug)는 안 늘린다(2026-11-11 — 6단계에서 바닥 물고기가 몸 높이의 1.5배 떠 있었다). 헤엄치는 물고기는 그대로 tallY
    if (tall !== 1) { const k = tall + (1 - tall) * c.ground; c.y = WORLD.floor + (c.y - WORLD.floor) * k; c.dy *= k; }
    if (deep !== 1) { c.z *= deep; c.dz *= deep; }
    b.courses[n] = c;
    b.positions[n * 3] = c.x; b.positions[n * 3 + 1] = c.y; b.positions[n * 3 + 2] = c.z;
    b.heading[n * 3] = c.dx; b.heading[n * 3 + 1] = c.dy; b.heading[n * 3 + 2] = c.dz;
    b.lengths[n] = m.length; b.pinned[n] = c.ground;
    m.phase += dt * c.effort; n++;
  }
  b.count = n;
  // 2) 물고기끼리 깊이 겹치지 않게 — 보정값이 천천히 따라간다(떨림 없음, world.separate). 깊은 수조는 앞뒤 유리도 깊다
  const off = b.offsets.length >= n * 3 ? b.offsets : null;
  if (off) separate(b.positions, b.lengths, off, dt, { n, pinned: b.pinned, scale: wide, deep });
  // 3) 모래에 앉히기 · 터널 · 돔 밖에 두기
  const hallTop = hall ? WORLD.floor + hall.h * tall : 0;
  for (let k = 0; k < n; k++) {
    const c = b.courses[k], L = b.lengths[k];
    let x = c.x + (off ? off[k * 3] : 0), z = c.z + (off ? off[k * 3 + 2] : 0), y = c.y + (off ? off[k * 3 + 1] : 0), dy = c.dy;
    // 겹침 밀기가 터널 · 돔 속으로 밀지 않게 — 낮은 물고기만, 길이 있던 쪽으로(가운데에서 좌우가 안 뒤집힌다)
    if (hall && y - L * 0.16 < hallTop) {
      // 유리보다 바깥으로는 안 민다(몸이 커서 터널 옆에 다 안 들어가면 유리 쪽이 먼저)
      const want = Math.min(hall.r + L * 0.275 + 0.1, roomX(L / 2, wide) + 0.15 * wide);
      if (hall.kind === "tunnel") { if (span && z > span.back - 0.3 && Math.abs(x) < want) x = (c.x < 0 ? -1 : 1) * want; }
      else { const d = Math.hypot(x, z); if (d < want) { const ux = d > 1e-3 ? x / d : 1, uz = d > 1e-3 ? z / d : 0; x = ux * want; z = uz * want; } }
    }
    FP.roll = 0;
    // 바닥 물고기 — 머리 · 꼬리 · 양옆의 모래 높이로 앉고 기운다(비탈에서 몸 끝이 묻히지 않게). 쉬는 거북도 ground 동안
    if (c.ground > 0) { floorPose(w.heightAt, x, z, c.dx, c.dz, L, FP); y += c.ground * (FP.ground - WORLD.floor); dy += c.ground * FP.slope * Math.hypot(c.dx, c.dz); FP.roll *= c.ground; }
    b.positions[k * 3] = x; b.positions[k * 3 + 1] = y; b.positions[k * 3 + 2] = z; b.heading[k * 3 + 1] = dy; b.rolls[k] = FP.roll;
  }
  return n;
}
