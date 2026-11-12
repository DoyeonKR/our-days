/** 수조 한 프레임의 물고기 자리(2026-11-11) — scene.ts 의 draw 가 부르던 길 → 늘리기 → 겹침 밀기 → 모래에 앉히기를 한 함수로 뺐다.
 *  화면과 테스트(motion.test · aquamotion.test)가 같은 식을 쓰게 하려고(예전엔 테스트가 화면 식을 흉내 내다 깊이 · 높이 변환이 어긋난 채 통과했다).
 *  three 를 쓰지 않는다. 결과는 buffers 에 쓴다(할당 없음). 같은 입력 = 같은 자리(겹침 밀기 보정값만 프레임마다 이어진다). */
import { habitKey, habitOf, hyp2, hyp3, roomX, type Course, type Feed, type Hall, type Obstacle } from "./habits.ts";
import { anatomy, bendProfile } from "./anatomy.ts";
import { starCourse } from "./invertebrates.ts";
import { WORLD, floorPose, schoolCourse, separate } from "./world.ts";
import { tunnelSpan } from "./tunnel.ts";

export type StepFish = { family: string; key: string; length: number; phase: number; course: Course;
  /** 프레임 사이에 이어 가는 값 — stepFish 가 처음 볼 때 만든다(엔진은 안 넘겨도 된다). 물고기가 바뀌면 새 객체라 새로 시작한다 */
  swim?: SwimState };
/** 한 마리의 프레임 사이 값 — 지난 화면 자리(빠르기 재기) · 고른 빠르기 · 지난 머리 방향(무리 따라가는 물고기의 turn) */
export type SwimState = { x: number; y: number; z: number; v: number; yaw: number; ready: boolean;
  /** 물고기마다 한 번 정하는 값(처음 볼 때) — 프레임마다 표를 찾지 않는다(문자열 키 · 새 객체를 안 만든다) */
  stride: number; freq: number; own: boolean; school: boolean; idlePace: number };
const swimStateOf = (m: StepFish): SwimState => {
  const a = anatomy(m.family, m.key), h = habitOf(habitKey(m.family, m.key));
  return {
    x: 0, y: 0, z: 0, v: 0, yaw: 0, ready: false,
    stride: bendProfile(m.family, m.key).stride, freq: a.frequency,
    // 박자를 빠르기로 바꾸지 않는 몸 — 해파리(갓 박자는 길의 jet) · 불가사리 · 거북(turtle.ts 가 따로 젓는다 — 쉬는 동안은 habits 가 effort 를 줄인다)
    own: m.family === "starfish" || m.family === "sea_turtle" || a.kind === "jelly",
    school: m.family !== "starfish" && !!h.school,
    idlePace: h.idle ? (h.pace ?? 1) * h.idle * 1.2 : 0,
  };
};
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
/** turn(몸을 C 자로 굽히고 기울이는 값)을 고르는 시간 상수(초) — 길의 turn 은 장애물로 휜 길 점의 두 번 차분이라, 장애물 가장자리에서 한 프레임에
 *  0.84 rad 만큼 C 자가 뒤집혔다(우럭 · 메기 · 둑중개 · 광어 · 농어가 분에 13~18번 — 2026-11-12 측정). 프레임 빠르기와 상관없게 1 − exp(−dt/τ) 로 섞는다 */
export const TURN_TAU = 0.2;
/** 화면 빠르기를 고르는 시간 상수(초) — 겹침 밀기 · 모래 앉히기가 자리를 조금씩 흔들어 프레임마다 잰 빠르기가 떨린다 */
export const SPEED_TAU = 0.25;
/** 꼬리 한 번에 나아가는 거리(몸길이) 위 · 아래 박자(Hz) — 화면에서 또렷이 보이는 만큼만 빠르게, 떠 있어도 꼬리가 아예 서지는 않게 */
export const BEAT_MAX_HZ = 4.5, BEAT_IDLE_HZ = 0.35;
const wrapA = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
/** 꼬리 박자를 실제 빠르기에 묶는다(2026-11-12) — 옛 effort 는 습성표의 빠르기와 anatomy.frequency 가 따로 놀아, 한 번 칠 때 나아가는 거리가
 *  몸길이의 0.15 ~ 1.1 배였다(참다랑어는 1.8Hz 로 치며 0.29 L/s — 제자리 헤엄, 농어 · 아귀 · 오징어는 1 L 넘게 미끄러졌다. 실제 물고기는 약 0.6, 장어 약 0.35).
 *  이제 박자(Hz) = 화면 빠르기(몸길이/초) ÷ 몸 모양별 보폭(bendProfile.stride) 이고, effort 는 그 박자를 anatomy.frequency 로 나눈 값이다
 *  (GLB · 코드 모델이 phase · frequency 로 박자를 낸다). 멈추면 BEAT_IDLE_HZ(큰 몸일수록 느리게, 모래 위에선 거의 0), 두족류처럼 쉬어도 팔을 움직이는 종은 습성표의 idle 만큼 */
function beatEffort(st: SwimState, length: number, habitEffort: number, ground: number) {
  const idleHz = (BEAT_IDLE_HZ / Math.sqrt(Math.max(0.5, length))) * (1 - 0.8 * Math.max(0, Math.min(1, ground)));
  const hz = Math.max(idleHz, Math.min(BEAT_MAX_HZ, st.v / st.stride));
  let e = (2 * Math.PI * hz) / st.freq;
  if (st.idlePace) e = Math.max(e, Math.min(habitEffort, st.idlePace));
  return e;
}

const STEP_FISH: StepFish[] = [];
// 길 옵션 — 프레임마다 · 물고기마다 새 객체를 안 만든다(2026-11-12)
const OPTS = { obstacles: undefined as readonly Obstacle[] | undefined, feed: null as Feed | null, deep: 1, tall: 1, hall: null as Hall | null, leaderLength: 0 as number | undefined, out: undefined as Course | undefined };
/** 한 프레임 — swimmers 의 순서가 buffers 의 순서다. elapsed 는 수조 시계(초), dt 는 이번 프레임(초, 0 이면 멈춘 그리기) */
export function stepFish(swimmers: Iterable<[number, StepFish]>, schools: ReadonlyMap<number, { leader: number; slot: number }>, lengthOf: (id: number) => number | undefined,
  elapsed: number, dt: number, w: StepWorld, b: StepBuffers) {
  const { wide, tall, deep, hall } = w;
  const opts = OPTS;
  opts.obstacles = w.obstacles; opts.feed = w.feed; opts.deep = deep; opts.tall = tall; opts.hall = hall; opts.leaderLength = 0; opts.out = undefined;
  const span = hall?.kind === "tunnel" ? tunnelSpan(deep) : null;
  let n = 0;
  const fishes = STEP_FISH;
  // 1) 이번 프레임 길 — 모두의 자리를 먼저 채운다
  for (const [id, m] of swimmers) {
    const sc = schools.get(id), c = m.course, prevTurn = c.turn;
    // 길 — 장식 · 바위 · 터널 · 돔을 피하고(obstacles · hall) 먹이에 모인다(feed). 무리는 대장 몸으로 길을 계산해야 같은 길을 따라간다
    if (m.family === 'starfish') { const s = starCourse(id, elapsed, m.length, wide, { obstacles: w.obstacles, deep, tall, hall }); c.x = s.x; c.y = s.y; c.z = s.z; c.dx = s.dx; c.dy = s.dy; c.dz = s.dz; c.effort = s.effort; c.turn = 0; c.amp = 1; c.pulse = 0; c.ground = 1; c.puff = -1; c.hover = 0; c.feed = 0; }
    else { opts.leaderLength = lengthOf(sc?.leader ?? id); opts.out = c; schoolCourse(sc?.leader ?? id, sc?.slot ?? 0, id, elapsed, m.length, habitKey(m.family, m.key), wide, opts); }
    // 위로 늘리기 — 바닥에 붙은 만큼(ground)은 모래 높이만 따르고 몸 높이(hug)는 안 늘린다(2026-11-11 — 6단계에서 바닥 물고기가 몸 높이의 1.5배 떠 있었다). 헤엄치는 물고기는 그대로 tallY
    if (tall !== 1) { const k = tall + (1 - tall) * c.ground; c.y = WORLD.floor + (c.y - WORLD.floor) * k; c.dy *= k; }
    if (deep !== 1) { c.z *= deep; c.dz *= deep; }
    // 몸이 도는 빠르기 — 무리 따라가는 물고기는 대장 길의 turn 이 아니라 제 머리 방향이 실제로 돈 빠르기(예전엔 대장의 C 자를 그대로 따라 했다)
    const st = (m.swim ??= swimStateOf(m));
    const yaw = Math.atan2(-c.dz, c.dx), follower = !!sc && sc.slot > 0 && st.school;
    let raw = c.turn;
    if (follower) raw = st.ready && dt > 0 && dt < 0.25 ? Math.max(-3, Math.min(3, wrapA(yaw - st.yaw) / dt)) : 0;
    st.yaw = yaw;
    if (Number.isFinite(prevTurn) && st.ready) c.turn = dt > 0 ? prevTurn + (raw - prevTurn) * (1 - Math.exp(-Math.min(dt, 0.25) / TURN_TAU)) : prevTurn;
    else c.turn = raw;
    b.courses[n] = c; fishes[n] = m;
    b.positions[n * 3] = c.x; b.positions[n * 3 + 1] = c.y; b.positions[n * 3 + 2] = c.z;
    b.heading[n * 3] = c.dx; b.heading[n * 3 + 1] = c.dy; b.heading[n * 3 + 2] = c.dz;
    b.lengths[n] = m.length; b.pinned[n] = c.ground;
    n++;
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
      else { const d = hyp2(x, z); if (d < want) { const ux = d > 1e-3 ? x / d : 1, uz = d > 1e-3 ? z / d : 0; x = ux * want; z = uz * want; } }
    }
    FP.roll = 0;
    // 바닥 물고기 — 머리 · 꼬리 · 양옆의 모래 높이로 앉고 기운다(비탈에서 몸 끝이 묻히지 않게). 쉬는 거북도 ground 동안
    if (c.ground > 0) { floorPose(w.heightAt, x, z, c.dx, c.dz, L, FP); y += c.ground * (FP.ground - WORLD.floor); dy += c.ground * FP.slope * hyp2(c.dx, c.dz); FP.roll *= c.ground; }
    b.positions[k * 3] = x; b.positions[k * 3 + 1] = y; b.positions[k * 3 + 2] = z; b.heading[k * 3 + 1] = dy; b.rolls[k] = FP.roll;
    // 4) 꼬리 박자 — 화면에 실제로 그린 자리가 움직인 빠르기(몸길이/초)를 골라 박자로(beatEffort). 처음 · 순간 이동(수조가 바뀜)은 잇기만 한다
    const m = fishes[k], st = m.swim!;
    if (dt > 0 && dt < 0.25 && st.ready) {
      const v = hyp3(x - st.x, y - st.y, z - st.z) / dt / Math.max(0.05, L);
      if (v < 20) st.v += (v - st.v) * (1 - Math.exp(-dt / SPEED_TAU));
    }
    const first = !st.ready;
    st.x = x; st.y = y; st.z = z; st.ready = true;
    if (!st.own && !first) c.effort = beatEffort(st, L, c.effort, c.ground);
    m.phase += dt * c.effort;
  }
  fishes.length = 0;
  return n;
}
