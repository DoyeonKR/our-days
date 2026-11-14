/** 만지면 놀란다(2026-11-14) [사용자: "모든 수조에 동물들은 유저가 탭하거나 만지면 놀라거나 특성 애니메이션을 취하면서 빠르게 움직인다"]
 *  수조에서 물고기를 누르면 그 종다운 몸짓으로 놀라 쏜살같이 달아났다가 원래 길로 돌아온다. 화면 전용 — 저장 · 길 함수는 그대로다.
 *  · dart(대부분의 물고기) — 몸을 C 자로 확 꺾었다가(C-start) 꼬리를 세게 쳐서 옆으로 튀어 나간다
 *  · inflate(복어) — 물을 들이켜 몸을 부풀리고 조금 물러선다
 *  · ink(문어 · 오징어 · 크라켄) — 먹물을 뿜고 외투막 쪽(뒤)으로 쏘아 나간다
 *  · burrow(광어 · 가오리 · 홍어 …바닥에 붙은 납작한 몸) — 모래를 일으키며 낮게 튀어 나간다
 *  · pulse(해파리) — 갓을 세게 오므려 위로 솟구친다
 *  · roll(해양 포유류) — 몸을 한 바퀴 굴리며 휙 헤엄쳐 간다(바위에서 쉬던 중이면 미끄러져 내려간다)
 *  · tuck(바다거북 · 불가사리) — 움찔하고 조금 물러선다
 *  순수 · three 없음. 시간(초)만으로 모습을 정한다. */

export type StartleKind = "dart" | "inflate" | "ink" | "burrow" | "pulse" | "roll" | "tuck";
/** 한 번 놀라는 데 걸리는 시간(초) — 끝나면 원래 길 그대로 */
export const STARTLE_S = 3.6;

const MAMMALS = new Set(["spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "sea_otter", "otter"]);
const CEPH = new Set(["octopus", "squid", "giant_squid", "kraken", "cuttlefish"]);
const FLAT = new Set(["flounder", "ray", "skate", "manta", "stingray", "eagle_ray"]);
const INFLATE = new Set(["puffer"]);
const TUCK = new Set(["sea_turtle", "starfish"]);
const JELLY = new Set(["jellyfish", "moon_jelly"]);

export function startleKind(family: string, key = family): StartleKind {
  if (INFLATE.has(family)) return "inflate";
  if (CEPH.has(family)) return "ink";
  if (MAMMALS.has(family)) return "roll";
  if (TUCK.has(family)) return "tuck";
  if (JELLY.has(family) || JELLY.has(key)) return "pulse";
  if (FLAT.has(family)) return "burrow";
  return "dart";
}

/** 얼마나 멀리(몸길이 배) · 얼마나 높이 튀는가 */
// 2026-11-14 [사용자: "반응이 너무 빨라"] — 덜 멀리 · 더 천천히(튀어 나가기 0.45 → 1초, 전체 2.4 → 3.6초)
const PEAK: Record<StartleKind, number> = { dart: 1.7, inflate: 0.4, ink: 2.2, burrow: 1, pulse: 1, roll: 1.6, tuck: 0.25 };
/** 튀어 나가 가장 멀리 닿는 때(초) */
const OUT_S = 1;
const ease = (x: number) => { const v = x < 0 ? 0 : x > 1 ? 1 : x; return v * v * (3 - 2 * v); };

export type StartlePose = {
  /** 달아난 거리(몸길이 배) — 방향은 화면이 정한다(startleDir) */
  dash: number;
  /** 꼬리 박자 배수(1 = 평소) */
  beat: number;
  /** 몸 부풀기(1 = 평소) — 복어 */
  puff: number;
  /** 몸 굴리기(rad) — 포유류 */
  roll: number;
  /** C 자 꺾기(길의 turn 에 더한다) — 처음 0.3초 */
  bend: number;
  /** 지금 달아나는 빠르기(0~1) — 머리를 달아나는 쪽으로 돌리는 정도 */
  rush: number;
};
const REST: StartlePose = { dash: 0, beat: 1, puff: 1, roll: 0, bend: 0, rush: 0 };

/** 놀란 지 t초의 모습. side 는 꺾는 쪽(±1) */
export function startlePose(kind: StartleKind, t: number, side = 1): StartlePose {
  if (!(t >= 0) || t >= STARTLE_S) return REST;
  const peak = PEAK[kind];
  // 튀어 나가기(0 ~ OUT_S, 빠르게) → 원래 길로 천천히 돌아오기(OUT_S ~ 끝)
  const out = t < OUT_S ? 1 - (1 - t / OUT_S) ** 3 : 1 - ease((t - OUT_S) / (STARTLE_S - OUT_S));
  const rush = t < OUT_S ? 1 - t / OUT_S * 0.4 : Math.max(0, 0.6 * (1 - (t - OUT_S) / 1.2));
  const p: StartlePose = { dash: peak * out, beat: 1 + 1.3 * rush, puff: 1, roll: 0, bend: 0, rush };
  // C-start — 0.12초에 몸을 한쪽으로 확 꺾고, 다음 0.18초에 반대로 튕긴다
  if (kind === "dart" || kind === "burrow") p.bend = side * (t < 0.22 ? 2 * (t / 0.22) : t < 0.55 ? 2 - 3.2 * ((t - 0.22) / 0.33) : -1.2 * Math.max(0, 1 - (t - 0.55) / 0.5));
  if (kind === "inflate") { p.puff = 1 + 0.75 * (t < 0.7 ? ease(t / 0.7) : t < 2.6 ? 1 : 1 - ease((t - 2.6) / 1)); p.beat = 1 + 0.8 * rush; }
  if (kind === "roll") p.roll = side * 2 * Math.PI * ease(t / 1.8);
  if (kind === "pulse") p.beat = 1 + 1.8 * Math.max(0, 1 - t / 2);
  if (kind === "tuck") p.beat = 1 + 0.3 * rush;
  return p;
}

/** 달아나는 방향(가로 · 세로 · 앞뒤, 길이 1) — 카메라에서 물고기 쪽(cx · cz = 카메라 → 물고기 수평 방향)을 기준으로
 *  옆으로 튀고 조금 멀어진다. 먹물은 머리 반대쪽(외투막 쪽), 해파리는 위로, 바닥 물고기는 낮게 */
export function startleDir(kind: StartleKind, cx: number, cz: number, hx: number, hz: number, side: number): { x: number; y: number; z: number } {
  const cl = Math.hypot(cx, cz) || 1, ax = cx / cl, az = cz / cl;
  if (kind === "pulse") return { x: ax * 0.2, y: 0.98, z: az * 0.2 };
  if (kind === "ink") { const hl = Math.hypot(hx, hz) || 1; return { x: -hx / hl * 0.9 + ax * 0.3, y: 0.15, z: -hz / hl * 0.9 + az * 0.3 }; }
  // 옆(카메라에서 본 좌우) + 조금 멀어지기
  const sx = -az * side, sz = ax * side;
  const x = sx * 0.85 + ax * 0.45, z = sz * 0.85 + az * 0.45, y = kind === "burrow" ? 0.05 : kind === "roll" ? 0.25 : 0.12;
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}
