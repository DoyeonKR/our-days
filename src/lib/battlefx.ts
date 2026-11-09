/* 모험 전투 이펙트 — 캔버스 한 장에 직접 그리는 입자 연출. [사용자 2026-11-08 "공격기술이나 움직임이 너무 허접해"]
 *
 * 기술마다 '오는 길'(travel: 쏘기 · 광선 · 쏟아짐 · 물결 · 소용돌이 · 베기 · 몸통 · 모으기)과
 * 속성마다 '재료'(불꽃 · 물방울 · 잎 · 번개 · 얼음 조각 · 독침 · 어둠 · 혼령 · 별 · 충격)를 따로 정해 곱한다.
 * 맞는 순간(impact)은 충격파 고리 + 파편, 급소는 흰 섬광 줄기를 더한다.
 * ⚠ 판정은 없다 — 화면이 엔진의 사건을 받아 부른다. shadowBlur · filter 는 쓰지 않는다(폰 프레임).
 * ⚠ 움직임 줄이기면 오는 길을 건너뛰고 고리 하나만 그린다. */
import type { FxStyle, MonType } from "./adventure";

export type Pt = { x: number; y: number };

type Kind = "glow" | "flame" | "leaf" | "spark" | "shard" | "bubble" | "smoke" | "wisp" | "star" | "ring" | "bolt" | "slash" | "line";
type P = {
  kind: Kind; x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  rot: number; vr: number; g: number; drag: number; grow: number;
  pts?: Pt[]; to?: Pt; width?: number;
};

export const FX_PAL: Record<MonType, [string, string, string]> = {
  노말: ["#ffffff", "#f3ead8", "#b9ad97"],
  불꽃: ["#fff1a8", "#ff8a2a", "#e0391f"],
  물: ["#e2f6ff", "#4aa8ff", "#1c63c9"],
  풀: ["#e6ff9e", "#5cc94a", "#24803a"],
  전기: ["#fffde0", "#ffe14a", "#f0a800"],
  얼음: ["#ffffff", "#bff3ff", "#4fb8d6"],
  벌레: ["#f2ff9a", "#a5c72a", "#5f7f12"],
  악: ["#cdb6e6", "#6a4f86", "#20142c"],
  고스트: ["#f0e6ff", "#a585ff", "#5132b4"],
  페어리: ["#fff3fb", "#ff9fd2", "#e2549e"],
  땅: ["#f2dfb6", "#c49a58", "#7b5a2c"],
  에스퍼: ["#ffe6f2", "#f07fb6", "#a83a78"],
};

const BODY: Record<MonType, Kind> = {
  노말: "glow", 불꽃: "flame", 물: "bubble", 풀: "leaf", 전기: "spark",
  얼음: "shard", 벌레: "spark", 악: "smoke", 고스트: "wisp", 페어리: "star", 땅: "shard", 에스퍼: "wisp",
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 전투 · 필드 캔버스의 배율 — 2배까지 · 한 장 약 220만 칸까지(2026-11-09). 3배 · 340만 칸 캔버스를 최대 셋(전투 · 입자 · 필드) 들고
 *  120Hz 로 그리면 배터리와 iOS 캔버스 메모리가 먼저 바닥났다. 움직이는 그림이라 2배와 3배의 차이는 거의 안 보인다 */
export const BATTLE_DPR_MAX = 2;
export const BATTLE_PIXELS_MAX = 2_200_000;
export function battleDpr(w: number, h: number): number {
  const want = Math.min(BATTLE_DPR_MAX, window.devicePixelRatio || 1);
  const cap = Math.sqrt(BATTLE_PIXELS_MAX / Math.max(1, w * h));
  return Math.max(1, Math.min(want, cap));
}

export class BattleFx {
  private ctx: CanvasRenderingContext2D | null;
  private ps: P[] = [];
  private beams: { a: Pt; b: Pt; color: string; core: string; t0: number; grow: number; hold: number; width: number }[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private dead = false;
  readonly still: boolean;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    this.still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = battleDpr(r.width, r.height);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ps = [];
    this.beams = [];
  }

  private add(p: Partial<P> & Pick<P, "kind" | "x" | "y" | "color">) {
    if (this.ps.length > 420) return;
    this.ps.push({ vx: 0, vy: 0, life: 0, max: 600, size: 6, rot: rand(0, Math.PI * 2), vr: 0, g: 0, drag: 0.985, grow: 0, ...p });
    this.kick();
  }

  private kick() {
    if (this.raf || this.dead) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.dead || !this.ctx) return;
    const dt = Math.min(48, now - this.last);
    this.last = now;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = "lighter";
    // 광선
    this.beams = this.beams.filter((bm) => {
      const t = now - bm.t0;
      const end = bm.grow + bm.hold;
      if (t > end + 160) return false;
      const k = Math.min(1, t / bm.grow);
      const fade = t > end ? 1 - (t - end) / 160 : 1;
      const x = bm.a.x + (bm.b.x - bm.a.x) * k;
      const y = bm.a.y + (bm.b.y - bm.a.y) * k;
      const wob = 1 + Math.sin(t / 30) * 0.18;
      c.lineCap = "round";
      c.globalAlpha = 0.35 * fade;
      c.strokeStyle = bm.color;
      c.lineWidth = bm.width * 2.4 * wob;
      line(c, bm.a, { x, y });
      c.globalAlpha = 0.8 * fade;
      c.lineWidth = bm.width * wob;
      line(c, bm.a, { x, y });
      c.globalAlpha = fade;
      c.strokeStyle = bm.core;
      c.lineWidth = bm.width * 0.38;
      line(c, bm.a, { x, y });
      return true;
    });
    // 입자
    const keep: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = dt / 16.67;
      p.vy += p.g * k;
      p.vx *= Math.pow(p.drag, k);
      p.vy *= Math.pow(p.drag, k);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      p.size = Math.max(0.2, p.size + p.grow * k);
      draw(c, p);
      keep.push(p);
    }
    this.ps = keep;
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    if (this.ps.length || this.beams.length) this.raf = requestAnimationFrame(this.tick);
    else c.clearRect(0, 0, this.w, this.h);
  };

  /** 속성 재료 한 알 */
  private bit(type: MonType, at: Pt, v: Pt, life = 520, size = 1) {
    const [hi, mid, lo] = FX_PAL[type];
    const kind = BODY[type];
    const color = pick([hi, mid, mid, lo]);
    switch (kind) {
      case "flame":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y - 0.6, color: pick([hi, mid, mid, lo]), size: rand(6, 11) * size, grow: -0.12, max: life, g: -0.05, drag: 0.96 });
        break;
      case "leaf":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y, color: pick([mid, lo, hi]), size: rand(5, 8) * size, vr: rand(-0.25, 0.25), max: life + 120, g: 0.04, drag: 0.97 });
        break;
      case "spark":
        this.add({ kind, x: at.x, y: at.y, vx: v.x * 1.5, vy: v.y * 1.5, color, size: rand(2, 3.4) * size, max: life * 0.7, drag: 0.93 });
        break;
      case "shard":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y, color: pick([hi, mid, lo]), size: rand(5, 9) * size, vr: rand(-0.2, 0.2), max: life, g: 0.12, drag: 0.97 });
        break;
      case "bubble":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y, color: pick([hi, mid]), size: rand(4, 9) * size, max: life, g: -0.02, drag: 0.95 });
        break;
      case "smoke":
        this.add({ kind, x: at.x, y: at.y, vx: v.x * 0.6, vy: v.y * 0.6, color: pick([mid, lo, hi]), size: rand(9, 16) * size, grow: 0.25, max: life + 200, drag: 0.94 });
        break;
      case "wisp":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y - 0.3, color: pick([hi, mid, mid]), size: rand(5, 9) * size, grow: -0.06, max: life + 200, g: -0.03, drag: 0.96 });
        break;
      case "star":
        this.add({ kind, x: at.x, y: at.y, vx: v.x, vy: v.y, color: pick([hi, mid, "#ffe9a8"]), size: rand(5, 9) * size, vr: rand(-0.15, 0.15), max: life, drag: 0.95 });
        break;
      default:
        this.add({ kind: "glow", x: at.x, y: at.y, vx: v.x, vy: v.y, color, size: rand(4, 8) * size, grow: -0.08, max: life, drag: 0.94 });
    }
  }

  private burstAt(type: MonType, at: Pt, n: number, speed: number, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(0.4, 1) * speed;
      this.bit(type, at, { x: Math.cos(a) * s, y: Math.sin(a) * s }, rand(380, 700), size);
    }
  }

  private ring(at: Pt, color: string, size: number, max = 420, width = 4) {
    this.add({ kind: "ring", x: at.x, y: at.y, color, size, grow: size / (max / 16.67) * 2.4, max, width });
  }

  private bolt(a: Pt, b: Pt, color: string, max = 220) {
    const pts: Pt[] = [a];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push({ x: a.x + (b.x - a.x) * t + rand(-14, 14), y: a.y + (b.y - a.y) * t + rand(-14, 14) });
    }
    pts.push(b);
    this.add({ kind: "bolt", x: a.x, y: a.y, color, pts, max, width: 3.5 });
  }

  /** 날아가는 탄 · 돌진이 남기는 꼬리 */
  trail(type: MonType, at: Pt, vx: number, vy: number, n = 1, size = 1) {
    if (this.still) return;
    for (let i = 0; i < n; i++) this.bit(type, { x: at.x + rand(-7, 7), y: at.y + rand(-7, 7) }, { x: -vx * 0.2 + rand(-0.6, 0.6), y: -vy * 0.2 + rand(-0.6, 0.6) }, rand(240, 420), size);
  }

  /** 시전 중 — 빛이 몸으로 빨려 든다 */
  charge(type: MonType, at: Pt, k: number) {
    if (this.still) return;
    const [hi, mid] = FX_PAL[type];
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(44, 92) * (1.15 - k * 0.45);
      this.add({ kind: "glow", x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r, vx: (-Math.cos(a) * r) / 13, vy: (-Math.sin(a) * r) / 13, color: pick([hi, mid]), size: rand(3, 6.5), max: 220, grow: -0.05, drag: 1 });
    }
  }

  /** 부채꼴을 쓸고 가는 재료 */
  sweep(type: MonType, c: Pt, ang: number, half: number, r: number) {
    if (this.still) return;
    for (let i = 0; i < 28; i++) {
      const t = ang + rand(-half, half);
      const d = r * rand(0.35, 1);
      this.bit(type, { x: c.x + Math.cos(t) * d, y: c.y + Math.sin(t) * d }, { x: Math.cos(t) * 2.4, y: Math.sin(t) * 2.4 }, rand(260, 480), 1.15);
    }
  }

  /** 땅을 흔드는 큰 충격파 */
  shockwave(type: MonType, at: Pt, r: number) {
    if (this.still) return;
    const [hi, mid, lo] = FX_PAL[type];
    this.ring(at, hi, r * 0.3, 420, 8);
    this.ring(at, mid, r * 0.18, 560, 12);
    this.ring(at, lo, r * 0.08, 700, 5);
    this.burstAt(type, at, 30, 8, 1.3);
  }

  /** 기술이 나가는 순간 손끝의 번쩍임 */
  flare(type: MonType, at: Pt) {
    if (this.still) return;
    this.ring(at, FX_PAL[type][0], 16, 240, 5);
    this.burstAt(type, at, 10, 4.5, 0.9);
  }

  /** 맵 사건 — 줍기 · 낙하 · 막힘 */
  pop(type: MonType, at: Pt, n = 14) {
    if (this.still) return;
    this.burstAt(type, at, n, 5, 1);
  }

  /** 기술이 상대에게 닿기까지. 닿는 순간 돌아온다. */
  async travel(style: FxStyle, type: MonType, from: Pt, to: Pt): Promise<void> {
    if (this.still || !this.ctx) return;
    const [hi, mid] = FX_PAL[type];
    if (style === "contact") {
      return wait(170);
    }
    if (style === "self" || style === "debuff") {
      const at = style === "self" ? from : to;
      if (style === "debuff") await this.stream(type, from, to, 380, 0.9);
      this.aura(type, at, style === "self");
      return wait(420);
    }
    if (style === "shot") return this.stream(type, from, to, 320, 1.1, true);
    if (style === "beam") {
      this.beams.push({ a: from, b: to, color: mid, core: hi, t0: performance.now(), grow: 200, hold: 260, width: 14 });
      this.kick();
      for (let i = 0; i < 10; i++) setTimeout(() => this.bit(type, lerp(from, to, Math.random()), { x: rand(-1, 1), y: rand(-1, 1) }, 380), i * 30);
      return wait(210);
    }
    if (style === "rain") {
      for (let i = 0; i < 26; i++) {
        setTimeout(() => {
          const x = to.x + rand(-60, 60);
          const at = { x, y: to.y - rand(140, 220) };
          if (type === "전기") this.bolt(at, { x: to.x + rand(-20, 20), y: to.y + rand(-10, 20) }, pick([hi, mid]), 180);
          else this.bit(type, at, { x: rand(-0.5, 0.5), y: rand(7, 10) }, 420, 1.2);
        }, i * 16);
      }
      return wait(380);
    }
    if (style === "wave") {
      const n = 22;
      for (let i = 0; i < n; i++) setTimeout(() => {
        const p = lerp(from, to, i / n);
        for (let j = 0; j < 3; j++) this.bit(type, { x: p.x + rand(-14, 14), y: p.y + rand(-24, 24) }, { x: (to.x - from.x) / 60, y: (to.y - from.y) / 60 - rand(0, 1.4) }, 520, 1.15);
      }, i * 17);
      return wait(n * 17);
    }
    if (style === "spiral") {
      const n = 34;
      for (let i = 0; i < n; i++) setTimeout(() => {
        const a = i * 0.55;
        const r = 90 - i * 2.3;
        const at = { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r * 0.55 };
        this.bit(type, at, { x: -Math.sin(a) * 2.4, y: Math.cos(a) * 1.3 }, 460, 1.1);
      }, i * 13);
      return wait(n * 13);
    }
    if (style === "slash") {
      for (let i = 0; i < 3; i++) setTimeout(() => {
        const s = 1 - i * 0.18;
        this.add({ kind: "slash", x: to.x + rand(-12, 12), y: to.y + rand(-10, 10), color: i % 2 ? hi : mid, size: 62 * s, rot: rand(-0.7, -0.3) + i * 0.5, max: 260, width: 9 * s });
      }, i * 70);
      return wait(150);
    }
    if (style === "burst") {
      // 모으기 — 내 자리로 빨려 들어오는 알갱이
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(55, 80);
        this.bit(type, { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r }, { x: -Math.cos(a) * r / 16, y: -Math.sin(a) * r / 16 }, 280);
      }
      this.ring(from, mid, 70, 260, 3);
      await wait(240);
      this.ring(to, hi, 20, 300, 6);
      return wait(90);
    }
    return wait(120);
  }

  /** 알갱이 줄기가 from → to 로 날아간다(머리는 큰 빛). */
  private stream(type: MonType, from: Pt, to: Pt, ms: number, size: number, head = false): Promise<void> {
    const [hi, mid] = FX_PAL[type];
    const t0 = performance.now();
    const lift = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.18);
    return new Promise((done) => {
      const step = () => {
        if (this.dead) return done();
        const t = Math.min(1, (performance.now() - t0) / ms);
        const p = lerp(from, to, t);
        p.y -= Math.sin(t * Math.PI) * lift;
        for (let i = 0; i < 3; i++) this.bit(type, { x: p.x + rand(-5, 5), y: p.y + rand(-5, 5) }, { x: rand(-0.6, 0.6), y: rand(-0.6, 0.6) }, 300, size);
        if (head) {
          this.add({ kind: "glow", x: p.x, y: p.y, color: hi, size: 14, max: 60, grow: -0.2 });
          this.add({ kind: "glow", x: p.x, y: p.y, color: mid, size: 22, max: 60, grow: -0.3 });
        }
        if (type === "전기" && Math.random() < 0.5) this.bolt(from, p, hi, 90);
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }

  /** 맞는 순간 — power 0~1(기술 위력), eff 상성, crit 급소 */
  impact(type: MonType, at: Pt, opt: { power?: number; eff?: number; crit?: boolean; small?: boolean } = {}) {
    if (!this.ctx) return;
    const [hi, mid] = FX_PAL[type];
    const pw = opt.small ? 0.35 : Math.max(0.4, Math.min(1.4, (opt.power ?? 0.6) * (opt.eff && opt.eff > 1 ? 1.35 : opt.eff && opt.eff < 1 ? 0.7 : 1)));
    if (this.still) {
      this.ring(at, mid, 30, 260, 3);
      return;
    }
    this.ring(at, hi, 18 * pw, 360, 5 * pw + 1);
    this.ring(at, mid, 30 * pw, 480, 3);
    this.burstAt(type, at, Math.round(14 + 26 * pw), 4 + 5 * pw, 0.8 + pw * 0.5);
    for (let i = 0; i < Math.round(6 + 8 * pw); i++) {
      const a = rand(0, Math.PI * 2);
      this.add({ kind: "line", x: at.x, y: at.y, vx: Math.cos(a) * rand(6, 11) * pw, vy: Math.sin(a) * rand(6, 11) * pw, color: hi, size: rand(8, 16), max: 240, drag: 0.86, width: 2.4 });
    }
    if (type === "전기") for (let i = 0; i < 3; i++) this.bolt({ x: at.x + rand(-50, 50), y: at.y - 70 }, { x: at.x + rand(-16, 16), y: at.y + rand(-8, 12) }, pick([hi, mid]), 200);
    if (opt.crit) {
      this.add({ kind: "glow", x: at.x, y: at.y, color: "#ffffff", size: 60, grow: -1.4, max: 220 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
        this.add({ kind: "line", x: at.x, y: at.y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, color: "#ffffff", size: 26, max: 200, drag: 0.82, width: 4 });
      }
    }
  }

  /** 능력이 오르내릴 때 · 변화 기술 — up 이면 위로 솟는 빛, 아니면 아래로 가라앉는 빛 */
  aura(type: MonType, at: Pt, up: boolean) {
    if (!this.ctx || this.still) return;
    const [hi, mid] = FX_PAL[type];
    const color = up ? hi : "#8fb4ff";
    for (let i = 0; i < 22; i++) setTimeout(() => {
      const x = at.x + rand(-48, 48);
      this.add({ kind: "line", x, y: at.y + (up ? 40 : -50), vx: 0, vy: up ? -rand(3, 5) : rand(3, 5), color: Math.random() < 0.5 ? color : mid, size: rand(10, 18), max: 520, drag: 0.99, width: 3 });
    }, i * 18);
    this.ring(at, mid, 40, 520, 3);
  }

  /** 흡수 — 상대 자리에서 빛 알갱이가 내 쪽으로 */
  async drain(type: MonType, from: Pt, to: Pt) {
    if (!this.ctx || this.still) return;
    const [, mid] = FX_PAL[type];
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const a = { x: from.x + rand(-20, 20), y: from.y + rand(-20, 20) };
        const t = 34;
        this.add({ kind: "glow", x: a.x, y: a.y, vx: (to.x - a.x) / t, vy: (to.y - a.y) / t, color: pick(["#b8ff9e", mid, "#ffffff"]), size: rand(4, 7), max: t * 16.67, drag: 1 });
      }, i * 35);
    }
    await wait(620);
    this.heal(to);
  }

  heal(at: Pt) {
    if (!this.ctx || this.still) return;
    for (let i = 0; i < 16; i++) setTimeout(() => {
      this.add({ kind: "star", x: at.x + rand(-40, 40), y: at.y + rand(-10, 40), vx: 0, vy: -rand(1.2, 2.4), color: pick(["#b8ff9e", "#7be38f", "#ffffff"]), size: rand(4, 7), max: 700, drag: 0.99 });
    }, i * 25);
    this.ring(at, "#7be38f", 36, 520, 3);
  }

  /** 상태이상 — 화상 불씨 · 독 거품 · 마비 번개 · 잠듦 거품 */
  status(st: "burn" | "poison" | "para" | "sleep", at: Pt) {
    if (!this.ctx || this.still) return;
    if (st === "burn") this.burstAt("불꽃", at, 18, 3, 0.9);
    else if (st === "poison") for (let i = 0; i < 16; i++) this.add({ kind: "bubble", x: at.x + rand(-40, 40), y: at.y + rand(0, 40), vx: 0, vy: -rand(1, 2.2), color: pick(["#c47bff", "#9b55c9", "#e2b8ff"]), size: rand(4, 9), max: 700, drag: 0.98 });
    else if (st === "para") for (let i = 0; i < 4; i++) this.bolt({ x: at.x + rand(-50, 50), y: at.y - 40 }, { x: at.x + rand(-50, 50), y: at.y + 40 }, "#ffe14a", 260);
    else for (let i = 0; i < 6; i++) setTimeout(() => this.add({ kind: "bubble", x: at.x + 30 + i * 4, y: at.y - 30, vx: 0.4, vy: -1.2, color: "#cfe2ff", size: 4 + i, max: 800, drag: 0.99 }), i * 90);
  }
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function line(c: CanvasRenderingContext2D, a: Pt, b: Pt) {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}

function draw(c: CanvasRenderingContext2D, p: P) {
  const t = p.life / p.max;
  const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
  c.globalAlpha = Math.max(0, Math.min(1, alpha));
  c.fillStyle = p.color;
  c.strokeStyle = p.color;
  switch (p.kind) {
    case "glow":
    case "wisp": {
      c.globalAlpha *= 0.35;
      dot(c, p.x, p.y, p.size * 1.9);
      c.globalAlpha = Math.max(0, alpha);
      dot(c, p.x, p.y, p.size);
      if (p.kind === "wisp") {
        c.globalAlpha = Math.max(0, alpha) * 0.4;
        dot(c, p.x - p.vx * 3, p.y - p.vy * 3, p.size * 0.7);
      }
      break;
    }
    case "flame": {
      c.globalAlpha *= 0.4;
      dot(c, p.x, p.y, p.size * 1.7);
      c.globalAlpha = Math.max(0, alpha);
      c.beginPath();
      c.moveTo(p.x, p.y - p.size * 1.5);
      c.quadraticCurveTo(p.x + p.size, p.y, p.x, p.y + p.size * 0.8);
      c.quadraticCurveTo(p.x - p.size, p.y, p.x, p.y - p.size * 1.5);
      c.fill();
      break;
    }
    case "leaf": {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha *= 0.6;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-p.size, 0);
      c.lineTo(p.size, 0);
      c.stroke();
      c.restore();
      break;
    }
    case "spark":
    case "line": {
      const len = p.kind === "line" ? p.size : p.size * 3;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      c.lineWidth = p.width ?? p.size;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
      c.stroke();
      break;
    }
    case "shard": {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      c.moveTo(0, -p.size * 1.4);
      c.lineTo(p.size * 0.5, 0);
      c.lineTo(0, p.size * 1.4);
      c.lineTo(-p.size * 0.5, 0);
      c.closePath();
      c.fill();
      c.restore();
      break;
    }
    case "bubble": {
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha *= 0.25;
      dot(c, p.x, p.y, p.size);
      c.globalAlpha = Math.max(0, alpha);
      c.fillStyle = "#ffffff";
      dot(c, p.x - p.size * 0.35, p.y - p.size * 0.35, Math.max(1, p.size * 0.22));
      break;
    }
    case "smoke": {
      c.globalAlpha *= 0.32;
      dot(c, p.x, p.y, p.size);
      break;
    }
    case "star": {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? p.size * 0.35 : p.size;
        const a = (i / 8) * Math.PI * 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.restore();
      break;
    }
    case "ring": {
      c.lineWidth = (p.width ?? 3) * (1 - t);
      c.beginPath();
      c.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case "bolt": {
      if (!p.pts) break;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.globalAlpha *= 0.4;
      c.lineWidth = (p.width ?? 3) * 3;
      poly(c, p.pts);
      c.globalAlpha = Math.max(0, alpha);
      c.lineWidth = p.width ?? 3;
      poly(c, p.pts);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.2;
      poly(c, p.pts);
      break;
    }
    case "slash": {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      const grow = Math.min(1, t * 3);
      c.lineCap = "round";
      c.lineWidth = (p.width ?? 6) * (1 - t * 0.7);
      c.beginPath();
      c.arc(0, 0, p.size, -0.9, -0.9 + 1.8 * grow);
      c.stroke();
      c.strokeStyle = "#ffffff";
      c.lineWidth = (p.width ?? 6) * 0.35;
      c.beginPath();
      c.arc(0, 0, p.size, -0.9, -0.9 + 1.8 * grow);
      c.stroke();
      c.restore();
      break;
    }
  }
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  c.fill();
}

function poly(c: CanvasRenderingContext2D, pts: Pt[]) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}
