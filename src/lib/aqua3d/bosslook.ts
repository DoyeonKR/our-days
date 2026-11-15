/** 수조의 주인 모습(2026-11-15) [사용자: "산호 여왕과 검은파도 지금 내가 잡아서 수조에 키우고 있는데 모델이 예전과 동일해"]
 *  주인을 잡으면 왕관을 쓰고 1.3배로 수조에 들어오지만 몸은 그 종 그대로였다. 전용 그림(fishingworld 의 BOSSES.art)이 있는 주인은 수조에서도 그 모습으로.
 *  · 산호 여왕(바다거북 — 코드 모델) — 등딱지에 주인 그림을 투영하고(투영 자리는 그림에서 잰 등딱지 타원), 등 위에 3D 산호 · 부채산호 · 해초 · 따개비를 세운다
 *  · 검은 파도(참다랑어 — GLB) — 종 모델의 uv 에 맞춰 구운 주인 피부(public/aqua/boss/, scripts/boss-skin.mjs)로 갈아 끼운다
 *  어느 주인인지는 왕관 이름(AquaFish.crown = 주인 이름) + 종으로 찾는다. 순수 표 + 산호 형상(three) — 저장은 그대로다. */
import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOSSES } from "../fishingworld.ts";
import { asset } from "../base.ts";

export type BossLook = {
  /** 주인 그림 key(public/aqua/fish/<art>.webp) */
  art: string;
  /** 거북 등딱지 투영 — 그림 좌표(512)의 등딱지 가운데 · 몸 앞쪽 축(x = .95) · 옆 축(z = .65) */
  shell?: { c: [number, number]; ax: [number, number]; side: [number, number] };
  /** GLB 피부(public/aqua/boss/<file>.webp) — 종 모델의 uv 에 맞춰 구운 것 */
  skin?: string;
  /** 등 위 산호 */
  coral?: boolean;
};

const LOOKS: Record<string, BossLook> = {
  sanho: { art: "boss_sanho", shell: { c: [220, 238], ax: [114, -24], side: [18, 66] }, coral: true },
  geomeun: { art: "boss_geomeun", skin: "boss_geomeun" },
};

/** 수조 물고기의 주인 모습 — 왕관 이름과 종(모습 key)이 맞는 주인이 전용 모습을 가졌으면 */
export function bossLookOf(crown: string | undefined, key: string): BossLook | null {
  if (!crown) return null;
  const b = BOSSES.find((x) => x.name === crown && x.species === key);
  return (b && LOOKS[b.key]) || null;
}
export const BOSS_LOOK_KEYS = Object.keys(LOOKS);

/** 등딱지 위 높이(turtle.ts carapace 와 같은 식 — 홈은 뺀다) */
export function shellTop(x: number, z: number): number {
  const a = Math.atan2(z / .65, x / .95), r2 = (x / .95) ** 2 + (z / (.65 * (1 - .13 * Math.cos(a)))) ** 2;
  return .035 + Math.sqrt(Math.max(0, 1 - r2)) * .30;
}

// 결정적인 잡음 — 같은 주인은 늘 같은 산호
const rnd = (i: number, k: number) => { const v = Math.sin(i * 91.7 + k * 47.3) * 43758.5453; return v - Math.floor(v); };

function painted(g: T.BufferGeometry, c: T.Color, shade = .25): T.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const pos = ng.getAttribute("position") as T.BufferAttribute, col = new Float32Array(pos.count * 3);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (let i = 0; i < pos.count; i++) {
    const k = y1 > y0 ? (pos.getY(i) - y0) / (y1 - y0) : 1, s = 1 - shade + shade * k;
    col[i * 3] = c.r * s; col[i * 3 + 1] = c.g * s; col[i * 3 + 2] = c.b * s;
  }
  ng.setAttribute("color", new T.BufferAttribute(col, 3));
  return ng;
}
const at = (g: T.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) =>
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(s, s, s)));

/** 가지 산호 — 줄기에서 두세 번 갈라지는 가는 원기둥(끝은 둥근 알) */
function branching(parts: T.BufferGeometry[], x: number, z: number, h: number, color: T.Color, seed: number) {
  const base = new T.Vector3(x, shellTop(x, z) - .01, z);
  const grow = (from: T.Vector3, dir: T.Vector3, len: number, r: number, depth: number, s: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const cyl = new T.CylinderGeometry(r * .7, r, len, 5, 1);
    cyl.translate(0, len / 2, 0);
    cyl.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir));
    cyl.translate(from.x, from.y, from.z);
    parts.push(painted(cyl, color, .35));
    if (depth <= 0) { const tip = new T.SphereGeometry(r * .95, 6, 4); tip.translate(to.x, to.y, to.z); parts.push(painted(tip, color.clone().offsetHSL(0, 0, .08), 0)); return; }
    const n = 2 + (rnd(s, 1) > .55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(s, i + 2) * 1.4, tilt = .35 + rnd(s, i + 7) * .4;
      const d = new T.Vector3(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).add(dir.clone().multiplyScalar(.6)).normalize();
      grow(to, d, len * (.62 + rnd(s, i + 11) * .2), r * .72, depth - 1, s * 3 + i + 1);
    }
  };
  grow(base, new T.Vector3(0, 1, 0), h * .38, h * .07, 2, seed);
}

/** 부채산호 — 몸 옆쪽을 향해 선 얇은 부채(양면) + 그 위에 가는 갈비 줄기 */
function seaFan(parts: T.BufferGeometry[], x: number, z: number, h: number, color: T.Color, yaw: number) {
  const y = shellTop(x, z) - .01;
  const fan = new T.CircleGeometry(h * .8, 16, 0, Math.PI);
  // 가장자리를 들쭉날쭉하게
  const p = fan.getAttribute("position") as T.BufferAttribute;
  for (let i = 1; i < p.count; i++) { const k = .82 + rnd(i, 3) * .3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, (rnd(i, 5) - .5) * h * .06); }
  fan.scale(1, 1.15, 1);
  parts.push(at(painted(fan, color, .3), x, y, z, 0, yaw, 0));
  for (let i = 0; i < 5; i++) {
    const a = .25 + i / 4 * (Math.PI - .5), len = h * .85;
    const rib = new T.CylinderGeometry(h * .012, h * .02, len, 4, 1);
    rib.translate(0, len / 2, 0);
    rib.rotateZ(Math.PI / 2 - a);
    parts.push(at(painted(rib, color.clone().offsetHSL(0, -.1, -.12), .2), x, y, z, 0, yaw, 0));
  }
}

let coralGeo: T.BufferGeometry | null = null;
/** 산호 여왕의 등 위 산호 한 덩어리(형상은 수조마다 하나를 나눠 쓴다 — 그림의 자리에 맞춰 등 뒤쪽 · 위쪽 가장자리에 몰린다) */
export function coralCrownGeometry(): T.BufferGeometry {
  if (coralGeo) return coralGeo;
  const parts: T.BufferGeometry[] = [];
  const pink = new T.Color(0xec6f92), orange = new T.Color(0xf08a3a), coral = new T.Color(0xf27f6e), purple = new T.Color(0xa24bc0), green = new T.Color(0x6f9a3a), bone = new T.Color(0xe8dfc6);
  seaFan(parts, -.42, -.28, .46, purple, .35);
  seaFan(parts, -.66, -.06, .32, purple.clone().offsetHSL(.02, 0, .06), -.2);
  branching(parts, .12, -.34, .5, pink, 1);
  branching(parts, -.05, -.3, .42, coral, 2);
  branching(parts, .36, -.24, .4, orange, 3);
  branching(parts, -.22, .22, .3, pink.clone().offsetHSL(0, 0, .05), 4);
  branching(parts, .2, .12, .24, orange.clone().offsetHSL(.02, 0, .06), 5);
  // 해초 다발 — 작은 원뿔이 모인 덤불
  for (let i = 0; i < 26; i++) {
    const a = rnd(i, 1) * Math.PI * 2, r = .2 + rnd(i, 2) * .5, x = Math.cos(a) * r * .9, z = Math.sin(a) * r * .55;
    const h = .05 + rnd(i, 3) * .06, cone = new T.ConeGeometry(.012, h, 4);
    parts.push(at(painted(cone, green.clone().offsetHSL(0, 0, (rnd(i, 4) - .5) * .12), .4), x, shellTop(x, z) + h / 2 - .005, z, (rnd(i, 5) - .5) * .6, 0, (rnd(i, 6) - .5) * .6));
  }
  // 따개비 — 등딱지 가장자리 쪽의 작은 고깔
  for (let i = 0; i < 18; i++) {
    const a = rnd(i, 8) * Math.PI * 2, r = .55 + rnd(i, 9) * .3, x = Math.cos(a) * r * .9, z = Math.sin(a) * r * .58;
    const cone = new T.CylinderGeometry(.008, .022, .025, 6);
    parts.push(at(painted(cone, bone, .3), x, shellTop(x, z) + .008, z));
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error("coral");
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  coralGeo = merged;
  return merged;
}

/** 주인 피부(GLB 용) — public/aqua/boss/<file>.webp. GLB 텍스처처럼 뒤집지 않는다 */
export function loadBossSkin(file: string, ready?: () => void): T.Texture {
  const tex = new T.TextureLoader().load(asset(`/aqua/boss/${file}.webp`), () => ready?.());
  tex.colorSpace = T.SRGBColorSpace; tex.flipY = false;
  return tex;
}
