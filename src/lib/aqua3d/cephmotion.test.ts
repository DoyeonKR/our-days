// 두족류의 움직임(2026-11-13) [사용자: "문어도 움직임이 다른 물고기랑 비슷해 연체동물의 움직임을 파악하고 개선해야해"]
// 문어 · 크라켄은 팔로 바닥을 기다가(팔 쪽이 앞) 가끔 외투막을 앞세워 물을 뿜고 미끄러진다. 오징어 · 대왕오징어는 떠 있다가 외투막을 앞세워 뒤로 쏘아 나간다.
// 길(habits)은 물을 뿜을 때 몸을 돌리지 않고 길을 거꾸로 가며(외투막이 앞) 세기(course.jet)와 자세(course.rev)를 넘긴다. 팔 하나하나는 정점 셰이더(cephalopod.ts)가 따로 굽히고 말고 모은다 — 이 시험은 같은 식의 CPU 판을 실제 GLB 정점으로 돌린다.
// 2026-11-18 v3 입체 모델 — 팔은 uv 의 팔 띠에서 읽고 3D 로 돈다(옆 흔들기 · 들기/말기 · 모으기/펴기). 2026-11-13 판의 뜻(팔끼리 따로 · 끝이 크고 늦게 · 몸은 그대로 · 뿜으면 모이고 물결을 끈다 · 끝에 편다 · 지나치게 돌지 않는다)을 같은 문턱으로 잰다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BREATH_S, CEPH_UV, CEPH_V3, breathOf, cephArmData, cephArmDisplace, cephGlsl, type ArmPose } from "./cephalopod.ts";
import { habitOf } from "./habits.ts";
import { fishCourse } from "./world.ts";

test("물 뿜기는 외투막이 앞(가는 쪽과 몸이 반대) · 기기 · 떠 있기는 팔이 앞", () => {
  for (const fam of ["octopus", "kraken", "squid", "giant_squid"]) {
    assert.ok(habitOf(fam).ceph, fam);
    let jets = 0, back = 0, walks = 0, fwd = 0;
    for (const id of [3, 7, 11]) {
      let prev = fishCourse(id, 0, 1.5, fam);
      for (let t = 0.05; t < 600; t += 0.05) {
        const c = fishCourse(id, t, 1.5, fam), vx = c.x - prev.x, vz = c.z - prev.z, v = Math.hypot(vx, vz);
        prev = c;
        if (v < 1e-4) continue;
        const dot = (vx * c.dx + vz * c.dz) / (v * (Math.hypot(c.dx, c.dz) || 1));
        if ((c.jet ?? 0) > 0.5 && (c.rev ?? 0) > 0.95) { jets++; if (dot < -0.5) back++; }
        else if ((c.rev ?? 0) === 0 && (c.jet ?? 0) === 0) { walks++; if (dot > 0.5) fwd++; }
      }
    }
    assert.ok(jets > 10, `${fam} 물 뿜기가 있다(${jets})`);
    assert.ok(back / jets > 0.85, `${fam} 뿜을 땐 외투막이 앞 ${back}/${jets}`);
    assert.ok(walks > 50 && fwd / walks > 0.7, `${fam} 평소엔 팔이 앞 ${fwd}/${walks}`);
  }
});

test("물 뿜기는 출발이 빠르고 미끄러지며 선다 · 문어는 바닥에서 조금만 떠오른다", () => {
  let fast = 0, slow = 0;
  let prev = fishCourse(5, 0, 1.5, "octopus");
  for (let t = 0.05; t < 900; t += 0.05) {
    const c = fishCourse(5, t, 1.5, "octopus"), v = Math.hypot(c.x - prev.x, c.z - prev.z) / 0.05;
    prev = c;
    if ((c.jet ?? 0) > 0.7) fast = Math.max(fast, v);
    if ((c.rev ?? 0) === 0 && (c.jet ?? 0) === 0) slow = Math.max(slow, v);
  }
  assert.ok(fast > slow * 1.5, `뿜는 순간 빠르다 ${fast.toFixed(2)} > 기기 ${slow.toFixed(2)}`);
});


await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (key: string) => {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  return new Promise<T.Group>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", (g) => res(g.scene), rej));
};
const KEYS = ["octopus", "fry_octopus", "juv_octopus", "kraken", "fry_kraken", "juv_kraken", "squid", "fry_squid", "juv_squid", "giant_squid", "fry_giant_squid", "juv_giant_squid"];
type Arm = NonNullable<ReturnType<typeof cephArmData>>;
async function armsOf(key: string) {
  const sc = await open(key); let m: T.SkinnedMesh | null = null; sc.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; });
  const mesh = m as unknown as T.SkinnedMesh, pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, n = pos.count;
  const P = new Float32Array(n * 3), U = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) { P[k * 3] = pos.getX(k); P[k * 3 + 1] = pos.getY(k); P[k * 3 + 2] = pos.getZ(k); U[k * 2] = uv.getX(k); U[k * 2 + 1] = uv.getY(k); }
  const d = cephArmData(P, U, n) as Arm;
  // 팔 몸통 정점(막 아님) · 팔마다 끝(가장 먼 rr) · 가운데(rr .45 ~ .55)
  const web = (k: number) => ((U[k * 2 + 1] - CEPH_UV.band0) / CEPH_UV.bandH) % 1 > CEPH_UV.webFrac;
  const tip = new Map<number, number>(), mid = new Map<number, number>();
  for (let k = 0; k < n; k++) {
    if (d.attr[k * 4] <= 0 || web(k)) continue;
    const a = d.attr[k * 4 + 3], rr = d.attr[k * 4 + 1];
    if (!tip.has(a) || rr > d.attr[tip.get(a)! * 4 + 1]) tip.set(a, k);
    if (Math.abs(rr - 0.5) < 0.05 && !mid.has(a)) mid.set(a, k);
  }
  // 팔 고리 가운데 = 뿌리들의 평균
  const hub = [0, 0, 0]; let c = 0;
  for (const k of tip.values()) { for (let j = 0; j < 3; j++) hub[j] += d.root[k * 3 + j]; c++; }
  for (let j = 0; j < 3; j++) hub[j] /= c;
  return { P, U, n, d, tip, mid, hub, mesh };
}
type Arms = Awaited<ReturnType<typeof armsOf>>;
const pose = (t: number, o: Partial<ArmPose> = {}): ArmPose => ({ t, walk: 0, stream: 0, flare: 0, gain: 1, ...o });
const move = (A: Arms, k: number, p: ArmPose, out: number[]) => cephArmDisplace(A.P[k * 3], A.P[k * 3 + 1], A.P[k * 3 + 2], A.d, k, p, out);
const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));
/** 팔 끝의 옆(그 팔의 옆 축 = 위 × 팔 방향) 변위 — 몸 길이 단위로 */
const sideOf = (A: Arms, k: number, o: number[]) => { const u = [A.d.dir[k * 3], A.d.dir[k * 3 + 1], A.d.dir[k * 3 + 2]], s = [u[2], 0, -u[0]], l = Math.hypot(s[0], s[2]) || 1; return ((o[0] - A.P[k * 3]) * s[0] + (o[2] - A.P[k * 3 + 2]) * s[2]) / l; };
const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length; let ab = 0, aa = 0, bb = 0;
  for (let j = 0; j < a.length; j++) { ab += (a[j] - ma) * (b[j] - mb); aa += (a[j] - ma) ** 2; bb += (b[j] - mb) ** 2; }
  return ab / Math.sqrt(aa * bb);
};

test("v3 입체 모델 — 12모습 모두 팔 띠에서 팔을 찾는다(문어형 8 · 오징어형 10), 문어형은 위에서 보면 팔 끝이 사방(별)", async () => {
  for (const key of KEYS) {
    const A = await armsOf(key);
    assert.equal(A.mesh.userData.aquaGeometry, CEPH_V3, key);
    assert.equal(A.d.arms, /octopus|kraken/.test(key) ? 8 : 10, key);
    if (/octopus|kraken/.test(key)) {
      const oct = new Set<number>();
      for (const k of A.tip.values()) oct.add(Math.floor(((Math.atan2(A.P[k * 3 + 2] - A.hub[2], A.P[k * 3] - A.hub[0]) + Math.PI) / (Math.PI * 2)) * 8) % 8);
      assert.ok(oct.size >= 6, `${key} 위에서 본 팔 끝이 ${oct.size}/8 칸`);
    }
  }
});

test("팔은 저마다 따로 움직인다 — 팔 끝끼리 옆 움직임의 상관이 낮다(하나의 꼬리처럼 같이 휘지 않는다)", async () => {
  for (const key of ["octopus", "kraken", "juv_octopus", "squid"]) {
    const A = await armsOf(key), o = [0, 0, 0], tips = [...A.tip.values()];
    const series = tips.map((k) => Array.from({ length: 200 }, (_, j) => { move(A, k, pose(j * 0.05, { walk: 1 }), o); return sideOf(A, k, o); }));
    let sum = 0, cnt = 0;
    for (let x = 0; x < series.length; x++) for (let y = x + 1; y < series.length; y++) { sum += Math.abs(corr(series[x], series[y])); cnt++; }
    assert.ok(sum / cnt < 0.55, `${key} 팔끼리 평균 |상관| ${(sum / cnt).toFixed(2)}`);
  }
});

test("굽힘은 팔 뿌리에서 끝으로 지나가고, 끝이 가운데보다 훨씬 크게 움직인다 · 외투막 · 머리는 그대로", async () => {
  for (const key of ["octopus", "giant_squid"]) {
    const A = await armsOf(key), o = [0, 0, 0];
    // 팔 여덟만 — 대왕오징어 촉완(팔 8 · 9)은 아래 · 뒤로 U 자로 늘어져 끝이 뿌리 가까이 돌아와 있다(뿌리를 축으로 돌리면 가운데가 끝보다 크게 움직이는 게 맞다)
    for (const [a, tip] of A.tip) {
      const mid = A.mid.get(a); if (mid === undefined || a >= 8) continue;
      const swing = (k: number) => Array.from({ length: 240 }, (_, j) => { move(A, k, pose(j * 0.05, { walk: 1 }), o); return sideOf(A, k, o); });
      const sm = swing(mid), st = swing(tip), amp = (x: number[]) => Math.max(...x) - Math.min(...x);
      assert.ok(amp(st) > amp(sm) * 2, `${key} 팔 ${a} 끝 ${amp(st).toFixed(1)} > 가운데 ${amp(sm).toFixed(1)} × 2`);
      const dm = sm.slice(1).map((v, j) => v - sm[j]), dt2 = st.slice(1).map((v, j) => v - st[j]);
      let best = -Infinity, bestLag = 0;
      for (let lag = 0; lag < 30; lag++) { let c = 0; for (let j = 0; j + lag < dm.length; j++) c += dm[j] * dt2[j + lag]; if (c > best) { best = c; bestLag = lag; } }
      assert.ok(bestLag > 0, `${key} 팔 ${a} 끝이 가운데보다 늦게 따라온다(${(bestLag * 0.05).toFixed(2)}초)`);
    }
    let still = 0;
    for (let k = 0; k < A.n; k++) if (A.d.attr[k * 4] === 0) { move(A, k, pose(3.3, { walk: 1, stream: 1, flare: 1 }), o); still = Math.max(still, Math.hypot(o[0] - A.P[k * 3], o[1] - A.P[k * 3 + 1], o[2] - A.P[k * 3 + 2])); }
    assert.equal(still, 0, `${key} 외투막 · 머리 정점은 안 움직인다`);
  }
});

test("물 뿜기 — 팔을 +X(외투막 반대쪽)로 모으고 물결을 거의 끈다 · 미끄러짐 끝엔 편다 · 어느 팔도 지나치게 돌지 않는다", async () => {
  for (const key of ["octopus", "kraken", "squid", "giant_squid"]) {
    const A = await armsOf(key), o = [0, 0, 0], all = [...A.tip.values()], tips = [...A.tip].filter(([a]) => a < 8).map(([, k]) => k);
    // 퍼진 폭 · 편 각은 팔 여덟로(촉완은 늘어진 자세가 쉬는 모습이라 따로 — 대신 '지나치게 돌지 않는다'는 촉완까지 본다)
    // 퍼진 폭 = 팔 끝들이 팔 고리를 지나는 X 축에서 떨어진 거리(보이는 다발의 굵기)
    const spread = (p: ArmPose) => { let s2 = 0; for (const k of tips) { move(A, k, p, o); s2 += (o[1] - A.hub[1]) ** 2 + (o[2] - A.hub[2]) ** 2; } return Math.sqrt(s2 / tips.length); };
    // 편 각 = 팔 끝 방향이 +X 에서 벌어진 각
    const fan = (p: ArmPose) => { let s = 0; for (const k of tips) { move(A, k, p, o); const v = [o[0] - A.hub[0], o[1] - A.hub[1], o[2] - A.hub[2]]; s += Math.acos(v[0] / Math.hypot(v[0], v[1], v[2])); } return s / tips.length; };
    const rest = spread(pose(0)), jet = spread(pose(0, { stream: 1 })), fan0 = fan(pose(0)), fl = fan(pose(0, { flare: 1 }));
    assert.ok(jet < rest * 0.8, `${key} 모으면 퍼진 폭 ${rest.toFixed(0)} → ${jet.toFixed(0)}`);
    assert.ok(fl > fan0 * 1.05, `${key} 펴면 ${fan0.toFixed(2)} → ${fl.toFixed(2)} rad`);
    let worst = 0;
    for (const k of all) for (const p of [pose(0, { stream: 1 }), pose(0, { flare: 1 }), pose(1.7, { walk: 1 })]) {
      move(A, k, p, o);
      const r = [A.d.root[k * 3], A.d.root[k * 3 + 1], A.d.root[k * 3 + 2]], a = [A.P[k * 3] - r[0], A.P[k * 3 + 1] - r[1], A.P[k * 3 + 2] - r[2]], b = [o[0] - r[0], o[1] - r[1], o[2] - r[2]];
      worst = Math.max(worst, Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b)))));
    }
    assert.ok(worst < 1.2, `${key} 가장 많이 돈 팔 ${worst.toFixed(2)} rad`);
    const wob = (p: Partial<ArmPose>) => { let m = 0; for (const k of tips) { const s: number[] = []; for (let j = 0; j < 80; j++) { move(A, k, pose(j * 0.05, p), o); s.push(sideOf(A, k, o)); } m = Math.max(m, Math.max(...s) - Math.min(...s)); } return m; };
    const wj = wob({ stream: 1 }), ww = wob({ walk: 1 });
    assert.ok(wj < ww / 3, `${key} 뿜을 때 물결 ${wj.toFixed(1)} · 기어갈 때 ${ww.toFixed(1)}`);
  }
});

test("물 뿜기에 몸을 돌리지 않는다 — 머리 방향은 그대로, 길이 거꾸로 가서 외투막이 앞 · 외투막 숨은 2 ~ 3초에 한 번", () => {
  for (const fam of ["octopus", "squid"]) {
    let prev = fishCourse(3, 0, 1.5, fam), worst = 0;
    for (let t = 0.05; t < 600; t += 0.05) {
      const c = fishCourse(3, t, 1.5, fam);
      if ((c.rev ?? 0) > 0) worst = Math.max(worst, Math.abs(wrap(Math.atan2(c.dz, c.dx) - Math.atan2(prev.dz, prev.dx))));
      prev = c;
    }
    assert.ok(worst < 0.2, `${fam} 뿜는 동안 한 프레임에 머리가 ${worst.toFixed(3)} rad 돈다`);
  }
  let peaks = 0;
  for (let j = 1; j < 2000; j++) { const a = breathOf((j - 1) * 0.01), b = breathOf(j * 0.01), c = breathOf((j + 1) * 0.01); if (b > a && b >= c && b > 0.9) peaks++; }
  assert.ok(peaks >= 7 && peaks <= 9, `20초에 숨 ${peaks}번`);
  assert.ok(BREATH_S >= 2 && BREATH_S <= 3);
});


test("셰이더는 CPU 식과 같은 묶음 한계를 쓰고 법선도 같은 회전으로 돌린다 · 키마다 다른 상수가 없다(ASCII 만)", () => {
  const g = cephGlsl(7);
  for (const part of [g.pars, g.normal, g.vertex]) assert.ok(/^[\x00-\x7f]*$/.test(part), "ASCII");
  assert.ok(g.pars.includes("min( 0.75, cA * 0.6 )") && g.pars.includes("clamp( cA, 0.3, 0.6 )"), "묶음 한계");
  assert.ok(g.normal.includes("objectNormal = cM * objectNormal"), "법선도 돈다");
  assert.ok(g.vertex.includes("aquaRoot + cM *"), "뿌리를 축으로");
  assert.equal(cephGlsl(7).pars, g.pars, "같은 칸이면 같은 원문 — 프로그램 하나를 나눠 쓴다");
});
