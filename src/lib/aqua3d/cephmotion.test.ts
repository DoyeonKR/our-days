// 두족류의 움직임(2026-11-13) [사용자: "문어도 움직임이 다른 물고기랑 비슷해 연체동물의 움직임을 파악하고 개선해야해"]
// 문어 · 크라켄은 팔로 바닥을 기다가(팔 쪽이 앞) 가끔 외투막을 앞세워 물을 뿜고 미끄러진다. 오징어 · 대왕오징어는 떠 있다가 외투막을 앞세워 뒤로 쏘아 나간다.
// 길(habits)은 물을 뿜을 때 몸을 돌리지 않고 길을 거꾸로 가며(외투막이 앞) 세기(course.jet)와 자세(course.rev)를 넘긴다. 팔 하나하나는 정점 셰이더(cephalopod.ts)가 따로 굽히고 말고 모은다 — 이 시험은 같은 식의 CPU 판을 실제 GLB 정점으로 돌린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BREATH_S, breathOf, cephArmData, cephArmDisplace, cephGlsl, type ArmPose } from "./cephalopod.ts";
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

type Arm = NonNullable<ReturnType<typeof cephArmData>>;
async function armsOf(key: string) {
  const sc = await open(key); let m: T.SkinnedMesh | null = null; sc.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; });
  const mesh = m as unknown as T.SkinnedMesh, pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, n = pos.count;
  const P = new Float32Array(n * 3), U = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) { P[k * 3] = pos.getX(k); P[k * 3 + 1] = pos.getY(k); P[k * 3 + 2] = pos.getZ(k); U[k * 2] = uv.getX(k); U[k * 2 + 1] = uv.getY(k); }
  return { P, U, n, d: cephArmData(key, P, U, n, mesh.geometry.index ? (mesh.geometry.index.array as ArrayLike<number>) : null) as Arm };
}
type Arms = Awaited<ReturnType<typeof armsOf>>;
const pose = (t: number, o: Partial<ArmPose> = {}): ArmPose => ({ t, walk: 0, stream: 0, flare: 0, gain: 1, ...o });
const move = (A: Arms, k: number, p: ArmPose, out: number[]) => cephArmDisplace(A.P[k * 3], A.P[k * 3 + 1], A.P[k * 3 + 2], A.d.attr, k, A.d.hub, A.d.sdir, A.d.crown, p, out);
const ang = (A: Arms, x: number, y: number) => Math.atan2(y - A.d.hub[1], x - A.d.hub[0]);
const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));

test("팔은 저마다 따로 움직인다 — 팔 끝끼리 움직임의 상관이 낮다(하나의 꼬리처럼 같이 휘지 않는다)", async () => {
  for (const key of ["octopus", "kraken", "juv_octopus"]) {
    const A = await armsOf(key), o = [0, 0, 0];
    // 팔 하나 = 위상 하나(cephArmData 가 이어진 정점을 한 팔로 묶는다) — 팔마다 가장 먼 정점을 끝으로
    const byArm = new Map<number, number>();
    for (let k = 0; k < A.n; k++) { if (A.d.attr[k * 4] < 0.9 || A.d.attr[k * 4 + 1] < 0.5) continue; const id = Math.round(A.d.attr[k * 4 + 2] * 20); const b = byArm.get(id); if (b === undefined || A.d.attr[k * 4 + 1] > A.d.attr[b * 4 + 1]) byArm.set(id, k); }
    const tips = [...byArm.values()];
    assert.ok(tips.length >= 4, `${key} 팔 끝 ${tips.length}개`);
    const series = tips.map((k) => { move(A, k, pose(0, { walk: 1 }), o); const a0 = ang(A, o[0], o[1]); return Array.from({ length: 200 }, (_, j) => { move(A, k, pose(j * 0.05, { walk: 1 }), o); return wrap(ang(A, o[0], o[1]) - a0); }); });
    const corr = (a: number[], b: number[]) => {
      const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length; let ab = 0, aa = 0, bb = 0;
      for (let j = 0; j < a.length; j++) { ab += (a[j] - ma) * (b[j] - mb); aa += (a[j] - ma) ** 2; bb += (b[j] - mb) ** 2; }
      return ab / Math.sqrt(aa * bb);
    };
    let sum = 0, cnt = 0;
    for (let x = 0; x < series.length; x++) for (let y = x + 1; y < series.length; y++) { sum += Math.abs(corr(series[x], series[y])); cnt++; }
    assert.ok(sum / cnt < 0.55, `${key} 팔끼리 평균 |상관| ${(sum / cnt).toFixed(2)}`);
  }
});

test("굽힘은 팔 뿌리에서 끝으로 지나가고, 끝이 뿌리 쪽보다 훨씬 크게 움직인다 · 외투막 · 머리는 그대로", async () => {
  const A = await armsOf("octopus"), o = [0, 0, 0];
  let mid = -1, tip = -1;
  // 같은 팔(같은 위상) — 가운데쯤(rr 0.45 ~ 0.55)과 그 팔의 가장 먼 끝
  for (let k = 0; k < A.n; k++) if (A.d.attr[k * 4] > 0.95 && Math.abs(A.d.attr[k * 4 + 1] - 0.5) < 0.05) { mid = k; break; }
  const ph0 = A.d.attr[mid * 4 + 2];
  for (let k = 0; k < A.n; k++) if (A.d.attr[k * 4] > 0.95 && Math.abs(A.d.attr[k * 4 + 2] - ph0) < 1e-4 && (tip < 0 || A.d.attr[k * 4 + 1] > A.d.attr[tip * 4 + 1])) tip = k;
  assert.ok(mid >= 0 && tip >= 0 && A.d.attr[tip * 4 + 1] > 0.6, "같은 팔의 가운데 · 끝");
  const swing = (k: number) => { const a: number[] = []; move(A, k, pose(0, { walk: 1 }), o); const a0 = ang(A, o[0], o[1]); for (let j = 0; j < 240; j++) { move(A, k, pose(j * 0.05, { walk: 1 }), o); a.push(wrap(ang(A, o[0], o[1]) - a0)); } return a; };
  const sm = swing(mid), st = swing(tip), amp = (a: number[]) => Math.max(...a) - Math.min(...a);
  assert.ok(amp(st) > amp(sm) * 2, `끝 ${amp(st).toFixed(3)} > 가운데 ${amp(sm).toFixed(3)} × 2`);
  // 프레임 사이 변화로 본다(끝의 느린 말기를 걸러 낸다)
  const dm = sm.slice(1).map((v, j) => v - sm[j]), dt2 = st.slice(1).map((v, j) => v - st[j]);
  let best = -Infinity, bestLag = 0;
  for (let lag = 0; lag < 30; lag++) { let c = 0; for (let j = 0; j + lag < dm.length; j++) c += dm[j] * dt2[j + lag]; if (c > best) { best = c; bestLag = lag; } }
  assert.ok(bestLag > 0, `끝이 가운데보다 늦게 따라온다(${(bestLag * 0.05).toFixed(2)}초)`);
  let still = 0;
  for (let k = 0; k < A.n; k++) if (A.d.attr[k * 4] === 0) { move(A, k, pose(3.3, { walk: 1, stream: 1, flare: 1 }), o); still = Math.max(still, Math.hypot(o[0] - A.P[k * 3], o[1] - A.P[k * 3 + 1], o[2] - A.P[k * 3 + 2])); }
  assert.equal(still, 0, "외투막 · 머리 정점은 안 움직인다");
});

test("물 뿜기 — 팔을 외투막 반대쪽으로 모으고 물결을 거의 끈다 · 미끄러짐 끝엔 편다 · 어느 팔도 외투막을 뚫고 돌지 않는다", async () => {
  for (const key of ["octopus", "squid", "giant_squid"]) {
    const A = await armsOf(key), o = [0, 0, 0];
    const tips = Array.from({ length: A.n }, (_, k) => k).filter((k) => A.d.attr[k * 4] > 0.9 && A.d.attr[k * 4 + 1] > 0.55);
    // 퍼진 폭 = 팔 끝들이 '늘어뜨리는 축'에서 옆으로 떨어진 거리(보이는 다발의 굵기). 외투막 쪽 팔은 돌리지 않고 몸 뒤로 끌어당기므로 각이 아니라 거리로 잰다
    const ex = Math.cos(A.d.sdir), ey = Math.sin(A.d.sdir);
    const spread = (p: ArmPose) => { let s2 = 0; for (const k of tips) { move(A, k, p, o); const dx = o[0] - A.d.hub[0], dy = o[1] - A.d.hub[1]; s2 += (dx * ey - dy * ex) ** 2; } return Math.sqrt(s2 / tips.length); };
    // 펴기는 각으로(팔이 늘어뜨리는 축에서 우산처럼 벌어진다)
    const fan = (p: ArmPose) => { let s2 = 0; for (const k of tips) { move(A, k, p, o); s2 += wrap(ang(A, o[0], o[1]) - A.d.sdir) ** 2; } return Math.sqrt(s2 / tips.length); };
    const rest = spread(pose(0)), jet = spread(pose(0, { stream: 1 })), flare = fan(pose(0, { flare: 1 })), fan0 = fan(pose(0));
    assert.ok(jet < rest * 0.8, `${key} 모으면 퍼진 폭 ${rest.toFixed(2)} → ${jet.toFixed(2)}`);
    assert.ok(flare > fan0 * 1.05, `${key} 펴면 ${fan0.toFixed(2)} → ${flare.toFixed(2)}`);
    let worst = 0;
    for (const k of tips) { move(A, k, pose(0, { stream: 1 }), o); worst = Math.max(worst, Math.abs(wrap(ang(A, o[0], o[1]) - A.d.attr[k * 4 + 3]))); }
    assert.ok(worst < 1.2, `${key} 가장 많이 돈 팔 ${worst.toFixed(2)} rad`);
    const wob = (p: Partial<ArmPose>) => { let m = 0; for (const k of tips.slice(0, 30)) { const a: number[] = []; move(A, k, pose(0, p), o); const a0 = ang(A, o[0], o[1]); for (let j = 0; j < 80; j++) { move(A, k, pose(j * 0.05, p), o); a.push(wrap(ang(A, o[0], o[1]) - a0)); } m = Math.max(m, Math.max(...a) - Math.min(...a)); } return m; };
    const wj = wob({ stream: 1 }), ww = wob({ walk: 1 });
    assert.ok(wj < ww / 3, `${key} 뿜을 때 물결 ${wj.toFixed(3)} · 기어갈 때 ${ww.toFixed(3)}`);
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

test("셰이더는 CPU 식과 같은 묶음 한계를 쓰고 법선도 돌린다(ASCII 만)", () => {
  const g = cephGlsl(7, [1, 2], 0.5, 3);
  for (const part of [g.pars, g.normal, g.vertex]) assert.ok(/^[\x00-\x7f]*$/.test(part), "ASCII");
  assert.ok(g.pars.includes("clamp( cTo * 0.6, -0.75, 0.75 )") && g.pars.includes("clamp( cTo, -0.6, 0.6 )"));
  assert.ok(g.normal.includes("objectNormal.xy"), "법선도 돌린다");
});
