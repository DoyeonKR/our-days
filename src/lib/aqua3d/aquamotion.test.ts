// 수조 움직임 다듬기(2026-11-11) — 화면과 같은 한 프레임(fishstep.stepFish)을 깊은 · 높은 · 터널 · 돔 수조에서 돌려 성질을 잠근다.
// 시뮬레이션으로 잰 결함(31c1908): 장애물 탓 순간 이동 1,167번/2분 · 가운데 장식 속 바닥 물고기 25% · 깊은 수조 겹침 90% · 터널 속 바닥 물고기 50% ·
// 먹이 돌진 평소의 7배 · 무리 순간 이동 · 높은 수조에서 뜨는 바닥 물고기 · 불가사리 순간 이동 · 수면 1.3 아래에서 멈추는 거북 · 유리 밖 정어리 · 뒤 유리를 뚫는 고래 지느러미.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import * as T from "three";
import { FISH_BASE_CM } from "../aquarium.ts";
import { FISH_HABITS, habitOf, type Course, type Feed, type Hall, type Obstacle } from "./habits.ts";
import { WORLD, feedSpot, fishCourse, fishLength, followerLag, hallFrom, schoolCourse, schoolsOf, separate, tallY, tankTall, wideScale } from "./world.ts";
import { anatomy, bendProfile, turnCurl } from "./anatomy.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { hardscapeStones, rockObstacles, substrateHeight } from "./habitat.ts";
import { TUNNEL_R, tankDeep, tunnelObstacles, tunnelSpan } from "./tunnel.ts";
import { DOME_R, domeObstacles } from "./dome.ts";
import { starCourse } from "./invertebrates.ts";
import { makeShoal } from "./shoal.ts";
import { makeGiants } from "./giants.ts";
import { makeSandPuffs } from "./sandpuff.ts";

const FLOOR_FAMS = Object.keys(FISH_HABITS).filter((k) => FISH_HABITS[k].hug !== undefined && k !== "starfish");
const adult = (family: string) => fishLength(FISH_BASE_CM[family] ?? 20, family);

/** 화면(scene.refreshObstacles)과 같은 장애물 — 장식(월드 원) → 길 좌표, 터널 · 돔, 바닥 바위 */
function tankOf(tier: number, wideStep = 0, decor: { x: number; z: number; r: number; h: number }[] = []) {
  const wide = wideScale(wideStep), tall = tankTall(tier), deep = tankDeep(tier), sub = Math.min(tier, 6);
  const tunnel = tier === 10, dome = tier >= 11;
  const obstacles: Obstacle[] = decor.map((o) => ({ ...o, z: o.z / deep, h: o.h / tall }));
  const hallObs = tunnel ? tunnelObstacles(deep, tall) : dome ? domeObstacles(tall) : [];
  const hall: Hall | null = hallFrom(tunnel ? "tunnel" : "dome", hallObs[0]);
  for (const o of hallObs) obstacles.push({ ...o, kind: "hall" });
  obstacles.push(...rockObstacles(tier, wide, deep));
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, sub) - WORLD.floor) * tall;
  return { tier, wide, tall, deep, obstacles, hall, heightAt, world: decor };
}
type Tank = ReturnType<typeof tankOf>;
type Fish = { id: number; family: string; length: number };
/** 화면의 draw 한 번 = stepFish 한 번. 매 프레임 visit(자리 · 길) */
function run(tank: Tank, fish: Fish[], seconds: number, visit: (t: number, pos: Float32Array, courses: Course[], feed: Feed | null) => void, feeds: Feed[] = [], hz = 30) {
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0 };
  let feed: Feed | null = null;
  for (let k = 0, t = 0; t < seconds; k++, t = k / hz) {
    for (const f of feeds) if (t >= f.t && (!feed || feed.t < f.t)) feed = f;
    if (feed && t - feed.t >= 40) feed = null;
    stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / hz : 0, { wide: tank.wide, tall: tank.tall, deep: tank.deep, heightAt: tank.heightAt, obstacles: tank.obstacles, feed, hall: tank.hall }, b);
    visit(t, b.positions, b.courses, feed);
  }
}
const inTunnel = (tank: Tank, x: number, y: number, z: number) => { const s = tunnelSpan(tank.deep); return z > s.back && z < s.front && x * x + (y - WORLD.floor) ** 2 < TUNNEL_R * TUNNEL_R; };
const inDome = (x: number, y: number, z: number) => x * x + (y - WORLD.floor) ** 2 + z * z < DOME_R * DOME_R;

test("장애물이 한 방향에 여럿 — 가운데 장식을 비켜 돈 자리가 옆 장식이어도 바닥 물고기가 어느 장식 속에도 머물지 않는다(옛 식은 마지막 장애물이 이겨 25%)", () => {
  // 2단계 수조의 흔한 배치: 가운데 낮은 유목 · 양옆 · 뒤 구석
  const decor = [{ x: -3, z: -1.5, r: 1.07, h: 1.58 }, { x: 2.47, z: -1.74, r: 0.7, h: 1.35 }, { x: 0, z: 0.45, r: 0.86, h: 0.95 }, { x: -2.0, z: 1.63, r: 0.83, h: 1.16 }, { x: 3.48, z: 1.25, r: 0.51, h: 0.92 }, { x: -3.8, z: 0.1, r: 0.78, h: 1.46 }];
  const tank = tankOf(2, 0, decor);
  let inside = 0, n = 0;
  for (const family of ["flounder", "catfish", "ray", "megamouth", "croaker", "bullhead"]) for (const id of [40, 77, 114]) {
    const L = adult(family);
    run(tank, [{ id, family, length: L }], 120, (t, p) => {
      n++;
      if (decor.some((o) => p[1] - L * 0.16 < WORLD.floor + o.h && Math.hypot(p[0] - o.x, p[2] - o.z) < o.r)) inside++;
    }, [], 10);
  }
  assert.ok(inside / n < 0.01, `장식 속 ${(100 * inside / n).toFixed(2)}%`);
});

test("순간 이동이 없다 — 장식 · 바위가 빽빽한 깊은 수조(1.6배 · 위로 1.5배)에서 먹이를 줘도, 고리 위 점마다 비킬 쪽이 뒤집히지 않는다", () => {
  const decor = [{ x: -3.2, z: -3.4, r: 1, h: 1.6 }, { x: 0, z: 0.6, r: 0.9, h: 1 }, { x: 2.6, z: -2.4, r: 0.7, h: 1.3 }, { x: -2.1, z: 2.6, r: 0.8, h: 1.2 }, { x: 3.4, z: 2, r: 0.5, h: 0.9 }, { x: -3.9, z: 0.2, r: 0.8, h: 1.5 }];
  const tank = tankOf(9, 0, decor);
  for (const family of [...FLOOR_FAMS, "goldfish", "clown", "sea_bream", "sea_turtle", "koi"]) for (const id of [7, 40]) {
    const L = adult(family), prev = [NaN, NaN, NaN];
    run(tank, [{ id, family, length: L }], 90, (t, p) => {
      if (!Number.isNaN(prev[0])) {
        const d = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
        assert.ok(d < Math.max(0.25 * L, 0.3), `${family} id${id} t${t.toFixed(2)} 한 프레임 ${d.toFixed(3)}`);
      }
      prev[0] = p[0]; prev[1] = p[1]; prev[2] = p[2];
    }, [{ t: 30, x: 0 }, { t: 60, x: 3 }]);
  }
});

test("바닥 바위도 장애물 — 흰동가리 · 우럭이 바위 속을 지나지 않는다(옛 식은 12~19%)", () => {
  // 흔한 장식 여섯과 함께(제자리 물고기의 집이 장식에 밀려 바위 쪽으로 간다)
  const decor = [{ x: -3, z: -1.5, r: 1.07, h: 1.58 }, { x: 2.47, z: -1.74, r: 0.7, h: 1.35 }, { x: 0, z: 0.45, r: 0.86, h: 0.95 }, { x: -2.0, z: 1.63, r: 0.83, h: 1.16 }, { x: 3.48, z: 1.25, r: 0.51, h: 0.92 }, { x: -3.8, z: 0.1, r: 0.78, h: 1.46 }];
  for (const tier of [2, 6]) {
  const tank = tankOf(tier, 0, decor), stones = hardscapeStones(tier);
  const m = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), inv = stones.map((s) => m.compose(new T.Vector3(...s.at), q.setFromEuler(new T.Euler(s.seed * 0.04, s.seed * 0.71, Math.sin(s.seed) * 0.15)), new T.Vector3(...s.size).multiplyScalar(0.92)).clone().invert());
  const inRock = (x: number, y: number, z: number) => inv.some((mi) => v.set(x, y, z).applyMatrix4(mi).lengthSq() < 1);
  assert.ok(tank.obstacles.filter((o) => o.kind === "rock").length >= stones.length, "바위마다 장애물");
  let hit = 0, n = 0;
  for (const family of ["clown", "rockfish", "mandarin_fish", "perch_kkeokji", "barred_knifejaw"]) for (const id of [40, 77, 114, 151]) {
    const L = adult(family);
    run(tank, [{ id, family, length: L }], 120, (t, p, c) => {
      // 몸 가운데 · 머리 · 꼬리 중 하나라도 바위 속이면
      n++;
      const hl = Math.hypot(c[0].dx, c[0].dz) || 1, hx = (c[0].dx / hl) * L * 0.5, hz = (c[0].dz / hl) * L * 0.5;
      if (inRock(p[0], p[1], p[2]) || inRock(p[0] + hx, p[1], p[2] + hz) || inRock(p[0] - hx, p[1], p[2] - hz)) hit++;
    }, [], 10);
  }
  assert.ok(hit / n < 0.03, `${tier}단계 바위 속 ${(100 * hit / n).toFixed(2)}%`);
  }
});

test("깊은 수조의 겹침 밀기 — 앞뒤 유리가 ±3·깊이라 겹친 두 마리를 앞뒤로도 떼어 놓는다(옛 식은 ±3 으로 눌러 가운데로 끌었다)", () => {
  const deep = 2.4, pos = [0, 0, 5.2, 0.05, 0, 5.25], L = [1.5, 1.5], off = new Float32Array(6);
  for (let i = 0; i < 300; i++) separate(pos, L, off, 1 / 30, { deep });
  assert.ok(5.2 + off[2] > 4 && 5.25 + off[5] > 4, `깊은 수조 앞쪽 자리를 지킨다 ${off[2]} ${off[5]}`);
  assert.ok(Math.hypot(pos[0] + off[0] - pos[3] - off[3], pos[2] + off[2] - pos[5] - off[5]) > 0.4, "떼어 놓는다");
  for (const z of [5.2 + off[2], 5.25 + off[5]]) assert.ok(Math.abs(z) + 0.75 <= 3 * deep + 1e-6, "앞유리 안");
  // 깊이를 안 주면 예전과 같다
  const flat = new Float32Array(6);
  for (let i = 0; i < 300; i++) separate([4, 0, 0, 3.9, 0, 0], [1.2, 1.2], flat, 1 / 30);
  assert.ok(4 + flat[0] + 0.6 <= 5 + 1e-6 && 3.9 + flat[3] + 0.6 <= 5 + 1e-6, "유리 안");
});

test("터널 수족관 — 낮게 사는 물고기 · 불가사리는 터널 속으로 안 들어간다(가운데에 먹이를 줘도) · 불가사리가 x = 0 에서 순간 이동하지 않는다", () => {
  for (const wideStep of [0, 3]) {
    const tank = tankOf(10, wideStep);
    let inside = 0, n = 0;
    for (const family of [...FLOOR_FAMS, "starfish", "clown", "goldfish"]) for (const id of [40, 77]) {
      const L = adult(family), prev = [NaN, NaN];
      run(tank, [{ id, family, length: L }], 60, (t, p) => {
        n++; if (inTunnel(tank, p[0], p[1], p[2])) inside++;
        if (family === "starfish" && !Number.isNaN(prev[0])) assert.ok(Math.hypot(p[0] - prev[0], p[2] - prev[1]) < 0.2, `불가사리 순간 이동 t${t.toFixed(2)}`);
        prev[0] = p[0]; prev[1] = p[2];
      }, [{ t: 10, x: 0 }, { t: 35, x: 0.5 }], 15);
    }
    assert.ok(inside / n < 0.01, `넓히기 ${wideStep}: 터널 속 ${(100 * inside / n).toFixed(2)}%`);
  }
});

test("돔 궁전 — 낮게 사는 물고기는 돔 속으로 안 들어간다(돔 한가운데에 먹이를 줘도) · 제자리 물고기의 집도 돔 밖", () => {
  const tank = tankOf(11, 0);
  let inside = 0, n = 0;
  for (const family of [...FLOOR_FAMS, "starfish", "clown"]) for (const id of [40, 77]) {
    const L = adult(family);
    run(tank, [{ id, family, length: L }], 60, (t, p) => { n++; if (inDome(p[0], p[1], p[2])) inside++; }, [{ t: 10, x: 0 }, { t: 35, x: -0.4 }], 15);
  }
  assert.ok(inside / n < 0.01, `돔 속 ${(100 * inside / n).toFixed(2)}%`);
});

test("제자리 물고기의 집 — 장식이 구석에 있어도 터널 축 · 돔 한가운데로 옮기지 않는다", () => {
  for (const tier of [10, 11]) {
    const tank = tankOf(tier, 0, [{ x: 3.9, z: -4.5, r: 1, h: 1.5 }, { x: -3.9, z: 4.4, r: 1, h: 1.5 }]);
    // 흰동가리는 터널 꼭대기보다 높이 살아 터널 위를 지나도 된다 — 돔은 그보다 높아 흰동가리도 돔 밖
    for (const family of tier === 10 ? ["rockfish", "mandarin_fish"] : ["rockfish", "mandarin_fish", "clown"]) for (let id = 1; id <= 12; id++) {
      const L = adult(family);
      let sx = 0, sz = 0, k = 0;
      for (let t = 0; t < 120; t += 1) { const c = fishCourse(id, t, L, family, 1, { obstacles: tank.obstacles, deep: tank.deep, tall: tank.tall, hall: tank.hall }); sx += c.x; sz += c.z * tank.deep; k++; }
      sx /= k; sz /= k;
      if (tier === 10) assert.ok(Math.abs(sx) > TUNNEL_R, `${family} id${id} 집이 터널 축 ${sx.toFixed(2)}`);
      else assert.ok(Math.hypot(sx, sz) > DOME_R, `${family} id${id} 집이 돔 가운데 ${sx.toFixed(2)},${sz.toFixed(2)}`);
    }
  }
});

test("먹이 — 멀수록 천천히 온다(가장 빠를 때 평소 가장 빠른 빠르기의 2배 안 — 옛 식은 7배) · 다 먹고 돌아설 때 머리가 한 프레임에 뒤집히지 않는다 · 뿌리는 자리가 먹이마다 다르다", () => {
  const tank = tankOf(6, 3), ratios: number[] = [];
  let flips = 0, feedFrames = 0;
  for (const family of ["guppy", "tetra", "koi", "goldfish", "angel", "salmon", "flounder", "catfish"]) for (const id of [40, 77]) {
    const L = adult(family), peak = [0, 0];
    for (const fed of [0, 1]) {
      const prev = [NaN, NaN, NaN], ph = [NaN, NaN];
      run(tank, [{ id, family, length: L }], 60, (t, p, c, feed) => {
        if (!Number.isNaN(prev[0]) && t > 20) {
          const v = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) * 30;
          peak[fed] = Math.max(peak[fed], v);
          const hl = Math.hypot(c[0].dx, c[0].dz), hx = c[0].dx / hl, hz = c[0].dz / hl;
          if (feed && !Number.isNaN(ph[0])) { feedFrames++; if (hx * ph[0] + hz * ph[1] < -0.2) flips++; }
          ph[0] = hx; ph[1] = hz;
        }
        prev[0] = p[0]; prev[1] = p[1]; prev[2] = p[2];
      }, fed ? [{ t: 30, x: 3 * tank.wide }] : []);
    }
    ratios.push(peak[1] / Math.max(1e-6, peak[0]));
  }
  // 31c1908 은 먹이가 끝날 때 머리가 한 프레임에 180° 돌았다(87 rad/s) — 이제 그런 프레임이 거의 없다
  assert.ok(flips / feedFrames < 0.002, `먹이 동안 머리가 한 프레임에 뒤집힌 비율 ${flips}/${feedFrames}`);
  ratios.sort((a, b) => a - b);
  assert.ok(ratios[Math.floor(ratios.length * 0.9)] < 2, `먹이 때 / 평소 가장 빠른 빠르기 ${ratios.map((r) => r.toFixed(2)).join(" ")}`);
  const spots = new Set([0, 1, 2, 3, 4, 5].map((n) => feedSpot(n).toFixed(2)));
  assert.ok(spots.size >= 5 && [...spots].every((s) => Math.abs(+s) <= 3), "먹이마다 다른 자리 · 수조 안");
  assert.equal(feedSpot(7, 2), feedSpot(7, 2), "같은 횟수 = 같은 자리");
  const ui = readFileSync(join(import.meta.dirname, "../../components/AquariumGame.tsx"), "utf8");
  assert.match(ui, /feedX=\{feedSpot\(feedN, a\.wide\)\}/, "화면이 먹이 자리를 넘긴다");
});

test("무리 — 대장이 멈춰 구경하거나 먹이 둘레를 맴돌아도 따라가는 물고기가 한 프레임에 튀지 않는다(자리는 대장이 실제로 가는 쪽 기준)", () => {
  const obstacles: Obstacle[] = [{ x: 0, z: 0.5, r: 0.8, h: 1.2 }, { x: -3, z: -1.5, r: 1, h: 1.6 }];
  for (const family of ["guppy", "tetra", "koi", "goldfish", "discus", "cutlassfish_pollock"]) {
    const L = adult(family);
    for (let slot = 1; slot <= 6; slot++) {
      let prev: { x: number; y: number; z: number } | null = null;
      for (let t = 0; t < 140; t += 1 / 30) {
        const c = schoolCourse(1, slot, slot + 1, t, L, family, 1, { obstacles, feed: { t: 50, x: 1.5 }, leaderLength: L });
        if (prev) assert.ok(Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z) < Math.max(0.25 * L, 0.3), `${family} slot${slot} t${t.toFixed(2)}`);
        prev = { x: c.x, y: c.y, z: c.z };
      }
    }
  }
});

test("높은 수조의 바닥 물고기 — 몸 높이(hug)는 늘리지 않는다(6단계에서 1.5배 떠 있었다) · 헤엄치는 물고기는 그대로 늘린다", () => {
  const lift = (tier: number, family: string) => {
    const tank = tankOf(tier), L = adult(family); let s = 0, k = 0;
    run(tank, [{ id: 40, family, length: L }], 40, (t, p) => { s += p[1] - tank.heightAt(p[0], p[2]); k++; }, [], 5);
    return s / k;
  };
  for (const family of ["flounder", "megamouth", "octopus", "catfish"]) {
    const a = lift(1, family), b = lift(6, family);
    assert.ok(Math.abs(a - b) < 0.12, `${family} 1단계 ${a.toFixed(3)} · 6단계 ${b.toFixed(3)}`);
  }
  const step = readFileSync(join(import.meta.dirname, "fishstep.ts"), "utf8");
  assert.match(step, /const k = tall \+ \(1 - tall\) \* c\.ground/);
});

test("불가사리 — 장식을 비켜 기어가고(옛 식은 장식을 뚫었다) · 옵션 없이는 예전 그대로", () => {
  const obstacles: Obstacle[] = [{ x: 0, z: 1.2, r: 0.9, h: 0.8 }, { x: -3.6, z: 0.4, r: 0.8, h: 1 }];
  let raw = 0, avoided = 0, n = 0;
  for (const id of [1, 7, 13, 40]) for (let t = 0; t < 1200; t += 2) {
    const L = 1.3, a = starCourse(id, t, L, 1), b = starCourse(id, t, L, 1, { obstacles });
    n++;
    if (obstacles.some((o) => Math.hypot(a.x - o.x, a.z - o.z) < o.r)) raw++;
    if (obstacles.some((o) => Math.hypot(b.x - o.x, b.z - o.z) < o.r)) avoided++;
    assert.equal(b.dy, 0); assert.ok(b.y > WORLD.floor && b.y < WORLD.floor + 0.2);
  }
  assert.ok(raw / n > 0.02, `장애물이 없으면 지나간다 ${raw / n}`);
  assert.ok(avoided / n < 0.005, `장식 속 불가사리 ${avoided / n}`);
});

test("거북 — 위로 늘린 수조에서도 수면 바로 밑까지 올라가 숨 쉰다(옛 식은 6단계에서 수면 1.3 아래에서 멈췄다) · 1단계는 그대로", () => {
  for (const tier of [1, 3, 6]) {
    const tall = tankTall(tier), L = fishLength(95, "sea_turtle"), surface = tallY(5.56, tall);
    let top = -9;
    for (let t = 0; t < 600; t += 0.25) top = Math.max(top, tallY(fishCourse(5, t, L, "sea_turtle", 1, { tall }).y, tall));
    assert.ok(surface - top < 0.56 + L * 0.12 + 0.12, `${tier}단계 수면까지 ${(surface - top).toFixed(2)}`);
    assert.ok(top < surface, "수면 위로 안 나간다");
  }
});

test("정어리 떼 — 유리 밖으로 안 나가고(8단계 1%) · 서로 뚫지 않고 · 머리가 제가 가는 쪽을 본다", () => {
  for (const [deep, wide] of [[1.4, 1], [2.4, 1.5]] as const) {
    const halfX = 4.4 * wide, halfZ = 3 * deep - 0.8, s = makeShoal(200, { halfX, halfZ, top: tallY(5.2, 1.5) });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(), f = new T.Vector3();
    const prev = new Float32Array(600);
    let out = 0, close = 0, pairs = 0, crab = 0, moving = 0;
    for (let k = 0; k < 120; k++) {
      const t = k * 0.5;
      s.animate(t);
      const pos: number[] = [];
      for (let i = 0; i < 200; i++) {
        s.mesh.getMatrixAt(i, m); m.decompose(p, q, sc); f.set(1, 0, 0).applyQuaternion(q);
        for (const e of [-0.5, 0.5]) if (Math.abs(p.x + f.x * e * sc.x) > 5 * wide || Math.abs(p.z + f.z * e * sc.x) > 3 * deep) { out++; break; }
        pos.push(p.x, p.y, p.z);
        if (k) { const v = new T.Vector3(p.x - prev[i * 3], p.y - prev[i * 3 + 1], p.z - prev[i * 3 + 2]); if (v.length() > 0.02) { moving++; if (v.normalize().dot(f) < Math.SQRT1_2) crab++; } }
        prev[i * 3] = p.x; prev[i * 3 + 1] = p.y; prev[i * 3 + 2] = p.z;
      }
      if (k % 10 === 0) for (let i = 0; i < 200; i++) { let best = 1e9; for (let j = 0; j < 200; j++) if (j !== i) best = Math.min(best, Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2])); pairs++; if (best < 0.15) close++; }
    }
    assert.equal(out, 0, `유리 밖 ${out}`);
    assert.ok(close / pairs < 0.03, `0.15 보다 가까운 이웃 ${(100 * close / pairs).toFixed(1)}%`);
    assert.ok(crab / moving < 0.1, `옆으로 기는 정어리 ${(100 * crab / moving).toFixed(1)}%`);
    s.dispose();
  }
});

test("고래 — 넓힌 9단계에서도 가슴지느러미까지 뒤 유리 안(옛 식은 넓히기 3에서 뚫었다)", () => {
  for (const wide of [1, 1.5]) {
    const deep = tankDeep(9), g = makeGiants({ halfX: 4.6 * wide, backZ: -3 * deep + 1.6, glassZ: -3 * deep, top: tallY(5.4, 1.5), whale: true });
    const box = new T.Box3();
    for (let t = 0; t < 200; t += 0.5) {
      g.animate(t); const w = g.root.children[0]; if (!w.visible) continue;
      g.root.updateMatrixWorld(true); box.setFromObject(w);
      assert.ok(box.min.z >= -3 * deep - 1e-6, `넓히기 ×${wide} t${t}: 뒤 ${box.min.z.toFixed(2)} < ${(-3 * deep).toFixed(2)}`);
    }
    g.dispose();
  }
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
  assert.match(scene, /glassZ:-3\*deep/);
});

test("같은 계열 바닥 물고기는 저마다 다른 고리 — 겹쳐 돌지 않는다(옛 식은 고리 크기가 8% 만 달랐다)", () => {
  for (const family of ["flounder", "catfish", "ray", "megamouth"]) {
    const L = adult(family), radii = [3, 17, 40, 77, 114, 151].map((id) => { let m = 0; for (let t = 0; t < 900; t += 2) m = Math.max(m, Math.abs(fishCourse(id, t, L, family).x)); return m; }).sort((a, b) => a - b);
    assert.ok(radii[radii.length - 1] - radii[0] > 0.6, `${family} 고리 ${radii.map((r) => r.toFixed(2)).join(" ")}`);
  }
});

test("같은 고리를 되풀이하지 않는다 — 고래상어가 한 바퀴 뒤 같은 길로 돌아오지 않는다(옛 식은 68.5초마다 몸길이의 2% 안)", () => {
  const L = adult("whale_shark");
  for (const id of [40, 77]) {
    const at = (t: number) => fishCourse(id, t, L, "whale_shark");
    let best = Infinity;
    for (let lag = 40; lag <= 140; lag += 0.5) { let d = 0; for (let t = 100; t < 160; t += 2) { const a = at(t), b = at(t + lag); d += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); } best = Math.min(best, d / 30); }
    assert.ok(best > 0.04 * L, `가장 비슷한 되풀이 ${(best / L).toFixed(3)} L`);
  }
});

test("모래 먼지 — 내려앉은 바닥 물고기 둘레에 점 60 알 안에서 피어오르고(같은 값 = 같은 모습) · 움직임 줄이기면 안 그린다", () => {
  const heightAt = () => WORLD.floor, puffs = makeSandPuffs(heightAt);
  const c = (puff: number): Course => ({ x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, turn: 0, amp: 1, pulse: 0, ground: 1, puff, hover: 1 });
  const courses = [c(0.3), c(-1), c(1.0), c(0.1), c(0.5), c(0.7), c(0.9), c(1.2)], pos = new Float32Array(courses.length * 3), len = new Float32Array(courses.length).fill(2);
  puffs.update(courses, pos, len, courses.length, false);
  const a = [...(puffs.points.geometry.getAttribute("aAlpha").array as Float32Array)];
  assert.equal(puffs.points.geometry.getAttribute("position").count, 60, "알은 60 개를 돌려 쓴다");
  assert.ok(a.filter((v) => v > 0).length === 60, "막 내려앉은 여섯 마리 몫");
  puffs.update(courses, pos, len, courses.length, false);
  assert.deepEqual([...(puffs.points.geometry.getAttribute("aAlpha").array as Float32Array)], a, "같은 값 = 같은 모습");
  puffs.update(courses, pos, len, courses.length, true);
  assert.equal(puffs.points.visible, false);
  puffs.update([c(-1)], pos, len, 1, false);
  assert.ok([...(puffs.points.geometry.getAttribute("aAlpha").array as Float32Array)].every((v) => v === 0), "내려앉은 물고기가 없으면 없다");
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
  assert.match(scene, /puffs\.update\(motion\.courses,motion\.positions,motion\.lengths,motion\.count,reduced\.matches\)/);
});

test("위로 늘린 수조에선 윗물 물고기가 위쪽도 쓴다 — 5단계에서 위 1/3 이 비어 보였다 · 1단계는 습성표 그대로", () => {
  const tall = tankTall(5), surface = tallY(5.56, tall), third = WORLD.floor + (surface - WORLD.floor) * (2 / 3);
  for (const family of ["guppy", "arowana", "betta", "sweetfish"]) {
    let up = 0, upBase = 0, n = 0;
    for (const id of [3, 40, 77]) for (let t = 0; t < 300; t += 1) {
      n++;
      if (tallY(fishCourse(id, t, 1.2, family, 1, { tall }).y, tall) > third) up++;
      if (tallY(fishCourse(id, t, 1.2, family).y, tall) > third) upBase++;
      assert.ok(tallY(fishCourse(id, t, 1.2, family, 1, { tall }).y, tall) < surface - 0.4, "수면 밑");
    }
    assert.ok(up > upBase * 1.15 || up / n > 0.6, `${family} 위 1/3 ${(100 * up / n).toFixed(0)}% (늘리기만 ${(100 * upBase / n).toFixed(0)}%)`);
  }
  assert.ok(habitOf("guppy").hi <= 3.6, "습성표는 그대로");
});

// 2026-11-12 측정(실제 stepFish · 60Hz · 2단계 수조 + 장식): C 자 뒤집힘 한 프레임 최대 0.84 rad(분에 13~18번) · 한 번 칠 때 나아가는 거리 몸길이의 0.15 ~ 1.1 · 무리 effort 상관 1.000
const DECOR6 = [{ x: -3, z: -1.5, r: 1.07, h: 1.58 }, { x: 2.47, z: -1.74, r: 0.7, h: 1.35 }, { x: 0, z: 0.45, r: 0.86, h: 0.95 }, { x: -2.0, z: 1.63, r: 0.83, h: 1.16 }, { x: 3.48, z: 1.25, r: 0.51, h: 0.92 }, { x: -3.8, z: 0.1, r: 0.78, h: 1.46 }];
test("turn 을 고른다 — 장애물 가장자리에서도 C 자가 한 프레임에 크게 안 뒤집힌다(옛 식은 0.84 rad)", () => {
  const tank = tankOf(2, 0, DECOR6);
  for (const family of ["rockfish", "catfish", "bullhead", "flounder", "sea_bass"]) {
    const p = bendProfile(family); let prev = NaN, worst = 0;
    run(tank, [{ id: 40, family, length: adult(family) }], 120, (t, pos, cs) => {
      let c = 0; for (let i = 0; i < 6; i++) c += turnCurl(p, cs[0], i);
      if (!Number.isNaN(prev)) worst = Math.max(worst, Math.abs(c - prev));
      prev = c;
    }, [], 60);
    assert.ok(worst < 0.15, `${family} C 자 한 프레임 ${worst.toFixed(3)} rad`);
  }
});
test("꼬리 박자는 실제 빠르기를 따른다 — 한 번 칠 때 몸길이의 0.3 ~ 1.05 배 나아간다(옛 식은 0.15 ~ 1.1)", () => {
  const tank = tankOf(2, 0, DECOR6);
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const family of ["guppy", "bluefin", "sea_bass", "anglerfish", "mandarin_fish", "eel", "squid", "clown", "oarfish", "coelacanth"]) {
    const L = adult(family), freq = anatomy(family, family).frequency; let px = NaN, py = 0, pz = 0; const strides: number[] = [];
    run(tank, [{ id: 40, family, length: L }], 150, (t, pos, cs) => {
      const v = Number.isNaN(px) ? 0 : Math.hypot(pos[0] - px, pos[1] - py, pos[2] - pz) * 30 / L;
      const hz = (freq * cs[0].effort) / (2 * Math.PI);
      if (t > 5 && v > 0.04 && cs[0].hover < 0.3) strides.push(v / hz);
      px = pos[0]; py = pos[1]; pz = pos[2];
    });
    assert.ok(strides.length > 300, `${family} 움직인 프레임 ${strides.length}`);
    const m = med(strides), want = bendProfile(family).stride;
    assert.ok(m > 0.3 && m < 1.05 && Math.abs(m - want) < 0.2, `${family} 한 번에 ${m.toFixed(2)} L (보폭 ${want})`);
  }
});
test("무리 — 따라가는 물고기는 제 빠르기 · 제 박자 · 제 turn(대장과 상관 1 이 아니다) · 같은 시각이면 같은 자리 · 늦음은 대장 길을 거꾸로 가지 않는다", () => {
  const tank = tankOf(2, 0, DECOR6), L = adult("guppy") * 0.8;
  const fish = Array.from({ length: 5 }, (_, i) => ({ id: 10 + i * 7, family: "guppy", length: L }));
  const ef: number[][] = fish.map(() => []), tu: number[][] = fish.map(() => []);
  run(tank, fish, 200, (t, pos, cs) => { for (let i = 0; i < fish.length; i++) { ef[i].push(cs[i].effort); tu[i].push(cs[i].turn); } });
  const corr = (a: number[], b: number[]) => { const n = a.length; let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0; for (let k = 0; k < n; k++) { sa += a[k]; sb += b[k]; sab += a[k] * b[k]; saa += a[k] ** 2; sbb += b[k] ** 2; } return (sab / n - sa * sb / n / n) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2)); };
  for (let i = 2; i < fish.length; i++) {
    assert.ok(corr(ef[1], ef[i]) < 0.95, `slot${i} effort 상관 ${corr(ef[1], ef[i]).toFixed(3)}`);
    assert.ok(corr(tu[1], tu[i]) < 0.97, `slot${i} turn 상관 ${corr(tu[1], tu[i]).toFixed(3)}`);
  }
  for (let t = 0; t < 400; t += 0.05) {
    const g = 1 - (followerLag(17, 3, t + 0.01) - followerLag(17, 3, t - 0.01)) / 0.02;
    assert.ok(g > 0.05 && g < 1.7, `대장 길 시각이 흐르는 빠르기 ${g.toFixed(3)} at ${t}`);
  }
  const a = schoolCourse(1, 3, 17, 77.7, 1, "guppy"), b = schoolCourse(1, 3, 17, 77.7, 1, "guppy");
  assert.deepEqual({ ...a }, { ...b });
});

test("무리 — 대장이 쉬는 동안 따라가는 물고기는 일부만 같이 쉬고(창마다 다른 물고기) 나머지는 대장 둘레를 천천히 헤엄친다(첫판은 다 같이 굳었다 — 겹침 80~92%, 둘째 판은 아무도 안 쉬었다 — 0~4%) · 머리는 제가 가는 쪽", () => {
  const tank = tankOf(2, 0, DECOR6), wrap = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
  for (const family of ["guppy", "koi", "angel"]) {
    const L = adult(family), fish = Array.from({ length: 6 }, (_, i) => ({ id: 10 + i * 7, family, length: L }));
    const prev = new Float32Array(18).fill(NaN);
    let rest = 0, slow = 0, hov = 0, both = 0, mov = 0, crab = 0, swimHov = 0;
    run(tank, fish, 240, (t, pos, cs) => {
      const sp: number[] = [];
      for (let i = 0; i < 6; i++) {
        const vx = (pos[i * 3] - prev[i * 3]) * 30, vz = (pos[i * 3 + 2] - prev[i * 3 + 2]) * 30, v = Math.hypot(vx, (pos[i * 3 + 1] - prev[i * 3 + 1]) * 30, vz) / L;
        sp.push(v);
        if (i > 0 && Math.hypot(vx, vz) / L > 0.08) { mov++; if (Math.abs(wrap(Math.atan2(-vz, vx) - Math.atan2(-cs[i].dz, cs[i].dx))) > Math.PI / 3) crab++; }
        prev[i * 3] = pos[i * 3]; prev[i * 3 + 1] = pos[i * 3 + 1]; prev[i * 3 + 2] = pos[i * 3 + 2];
      }
      if (cs[0].hover > 0.5) for (let i = 1; i < 6; i++) { hov++; if (cs[i].hover > 0.5) both++; if (sp[i] > 0.15) swimHov++; }
      if (sp[0] < 0.05) for (let i = 1; i < 6; i++) { rest++; if (sp[i] < 0.03) slow++; }
    });
    assert.ok(rest > 100 && hov > 100, `${family} 대장이 쉬는 프레임 ${rest} · ${hov}`);
    assert.ok(slow / rest < 0.08, `${family} 대장이 쉴 때 굳은 따라가는 물고기 ${(100 * slow / rest).toFixed(1)}%`);
    assert.ok(both / hov > 0.4 && both / hov < 0.75, `${family} 같이 떠 있는 겹침 ${(100 * both / hov).toFixed(1)}% (일부만)`);
    assert.ok(swimHov / hov > 0.2, `${family} 대장이 떠 있는 동안 헤엄치는 따라가는 물고기 ${(100 * swimHov / hov).toFixed(1)}%`);
    assert.ok(crab / mov < 0.08, `${family} 옆으로 기는 따라가는 물고기 ${(100 * crab / mov).toFixed(1)}%`);
  }
});

test("바닥 무리 — 명태 여섯 마리가 나란히 누워도 서로 안 포갠다(옛 식은 해바라기 자리의 위아래 몫을 버려 한 줄로 겹쳤고 · 장식 너머 자리를 대장 위까지 당겼다)", () => {
  const L = adult("cutlassfish_pollock"), N = 6, obstacles: Obstacle[] = [{ x: 0, z: 0.4, r: 0.85, h: 1 }, { x: -3, z: -1.5, r: 1, h: 1.5 }, { x: 2.5, z: -1.7, r: 0.7, h: 1.3 }];
  // 몸통 선분(반길이 0.45L, 수평) 사이 가장 가까운 거리
  const seg = (a: Course, b: Course) => {
    const ua = Math.hypot(a.dx, a.dz) || 1, ub = Math.hypot(b.dx, b.dz) || 1;
    let m = Infinity;
    for (let s = -1; s <= 1; s += 0.25) for (let u = -1; u <= 1; u += 0.25) m = Math.min(m, Math.hypot(a.x + (a.dx / ua) * 0.45 * L * s - b.x - (b.dx / ub) * 0.45 * L * u, a.z + (a.dz / ua) * 0.45 * L * s - b.z - (b.dz / ub) * 0.45 * L * u));
    return m;
  };
  for (const obs of [[], obstacles]) {
    let close = 0, n = 0;
    for (let t = 0; t < 240; t += 0.5) {
      const ps = Array.from({ length: N }, (_, slot) => ({ ...schoolCourse(10, slot, 10 + slot * 7, t, L, "cutlassfish_pollock", 1, { obstacles: obs, leaderLength: L }) }));
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { n++; if (seg(ps[i], ps[j]) < 0.2 * L) close++; }
    }
    // 옛 식 25% · 86%(2026-11-12) — 남은 것은 따라가는 물고기마다 늦는 정도가 달라 대장이 돌 때 칸이 잠깐 엇갈리는 몫
    assert.ok(close / n < (obs.length ? 0.35 : 0.18), `장애물 ${obs.length}: 몸통이 0.2L 안으로 붙은 쌍 ${(100 * close / n).toFixed(1)}%`);
  }
});
