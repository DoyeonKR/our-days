// 계보 도트 제작 도구 — 도형으로 몸통을 뜨고(자동 명암 + 외곽선) PNG 로 굽는다.
// README §10.8 의 교훈: 숫자로만 맞춘 그림은 '규격은 맞는데 못생긴' 걸 못 잡는다 → 반드시 눈으로 본다.
// 결과물은 pixellineage.ts 에 들어갈 몸통 행(48칸 × 44행)이다. 다리(44~47행)는 공용 feet() 가 채운다.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

export const W = 48;
export const H = 44;

/* ── 명암 글자 집합 ─────────────────────────────────────────────
 * 몸 램프: H 하이라이트 · b 밝음 · B 기본 · d 그늘 · D 깊은그늘 · o 외곽선
 * 배 램프: c 밝음 · C 그늘.  마킹: A · a.  강조 3종: (f F h) (r R t) (u U v) — 밝음 · 기본 · 어둠. */
export const T = {
  body: { H: "H", b: "b", B: "B", d: "d", D: "D" },
  belly: { H: "c", b: "c", B: "c", d: "C", D: "C" },
  mark: { H: "A", b: "A", B: "A", d: "a", D: "a" },
  a1: { H: "f", b: "f", B: "F", d: "h", D: "h" },
  a2: { H: "r", b: "r", B: "R", d: "t", D: "t" },
  a3: { H: "u", b: "u", B: "U", d: "v", D: "v" },
};
const flat = (ch) => ({ H: ch, b: ch, B: ch, d: ch, D: ch });
export const F = flat;

/** 광원 좌상단 — 법선 · 빛 내적을 5톤으로 자른다(임계값은 눈으로 맞췄다). */
const LIGHT = (() => { const v = [-0.55, -0.65, 0.55]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
export function tone(u, v, th = TH) {
  const r2 = u * u + v * v;
  let nx = u, ny = v, nz;
  if (r2 >= 1) { const r = Math.sqrt(r2); nx = u / r; ny = v / r; nz = 0; } else nz = Math.sqrt(1 - r2);
  const I = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return I >= th[0] ? "H" : I >= th[1] ? "b" : I >= th[2] ? "B" : I >= th[3] ? "d" : "D";
}
const TH = [0.9, 0.38, -0.02, -0.5];

export class Cv {
  constructor() {
    this.g = Array.from({ length: H }, () => Array(W).fill(null));
    this.id = Array.from({ length: H }, () => Array(W).fill(0));
    this.n = 0; // 레이어 번호(나중에 그린 도형이 위)
  }
  inb(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
  put(x, y, ch, layer = this.n) {
    x = Math.round(x); y = Math.round(y);
    if (!this.inb(x, y)) return;
    this.g[y][x] = ch; this.id[y][x] = layer;
  }
  get(x, y) { return this.inb(x, y) ? this.g[y][x] : null; }
  /** 레이어 태그 — ring() 이 태그로 경계선을 긋는다. */
  tag(name) { this.n++; this.tags ??= {}; this.tags[name] = this.n; return this.n; }

  /** 채워진 타원. letters 로 명암 글자를 고르고, shade=false 면 한 글자(letters.B)로 민다. */
  ellipse(cx, cy, rx, ry, letters, o = {}) {
    const layer = o.tag ? this.tag(o.tag) : ++this.n;
    const sh = o.shade !== false;
    const th = o.th ?? TH;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x - cx) / rx, v = (y - cy) / ry;
        if (u * u + v * v > 1.0001) continue;
        if (o.clip && !o.clip(x, y)) continue;
        const k = sh ? tone(u, v, th) : "B";
        this.put(x, y, letters[k], layer);
      }
    return layer;
  }
  /** 다각형(스캔라인). 명암은 외접 타원 기준 법선 근사 — o.grad 가 있으면 축 방향 띠로 칠한다. */
  poly(pts, letters, o = {}) {
    const layer = o.tag ? this.tag(o.tag) : ++this.n;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(1, (x1 - x0) / 2 + 0.5), ry = Math.max(1, (y1 - y0) / 2 + 0.5);
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (!inPoly(x, y, pts)) continue;
        let ch;
        if (o.grad) {
          const { from, to, letters: L } = o.grad;
          const dx = to[0] - from[0], dy = to[1] - from[1];
          const t = Math.max(0, Math.min(0.9999, ((x - from[0]) * dx + (y - from[1]) * dy) / (dx * dx + dy * dy)));
          ch = L[Math.floor(t * L.length)];
        } else if (o.shade === false) ch = letters.B;
        else ch = letters[tone((x - cx) / rx, (y - cy) / ry, o.th ?? TH)];
        this.put(x, y, ch, layer);
      }
    return layer;
  }
  rect(x0, y0, x1, y1, letters, o = {}) {
    return this.poly([[x0 - 0.5, y0 - 0.5], [x1 + 0.5, y0 - 0.5], [x1 + 0.5, y1 + 0.5], [x0 - 0.5, y1 + 0.5]], letters, o);
  }
  /** 굵은 선(브레젠햄) — 다리·가시·더듬이용. */
  line(x0, y0, x1, y1, ch, th = 1, o = {}) {
    const layer = o.tag ? this.tag(o.tag) : ++this.n;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); // 소수 좌표는 끝점에 안 닿아 무한 루프가 된다
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (let guard = 0; guard < 400; guard++) {
      for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) this.put(x + a - Math.floor(th / 2), y + b - Math.floor(th / 2), ch, layer);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return layer;
  }
  /** 문자판 찍기. '.' 은 투명, 공백도 투명. map 이 있으면 글자를 바꾼다. */
  stamp(x0, y0, rows, map = {}, o = {}) {
    const layer = o.keep ? this.n : ++this.n;
    rows.forEach((r, j) => [...r].forEach((c, i) => {
      if (c === "." || c === " ") return;
      this.put(x0 + i, y0 + j, map[c] ?? c, layer);
    }));
  }
  /** 좌우 대칭 복사 — 중심선 cx(소수 가능) 기준으로 왼쪽을 오른쪽에 비춘다(layer 유지). */
  mirror(cx = 23.5, fromLeft = true) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const mx = Math.round(2 * cx - x);
        if (!this.inb(mx, y)) continue;
        if (fromLeft ? x < cx : x > cx) { if (this.g[y][x] != null) { this.g[y][mx] = this.g[y][x]; this.id[y][mx] = this.id[y][x]; } }
      }
  }
  /** 바깥 외곽선 — 잉크에 4방향으로 닿는 빈 칸을 o 로. */
  outline(ch = "o") {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.g[y][x] != null) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) != null)) add.push([x, y]);
    }
    for (const [x, y] of add) this.put(x, y, ch, 0);
  }
  /** 태그 도형의 경계 안쪽 한 줄을 ch 로 — 팔·귀·날개가 몸에서 갈리게(다른 레이어와 맞닿은 곳만). */
  ring(tagName, ch = "o", only = null) {
    const id = this.tags?.[tagName];
    if (!id) throw new Error("ring: tag ?" + tagName);
    const todo = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.id[y][x] !== id || this.g[y][x] == null) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (!this.inb(nx, ny) || this.g[ny][nx] == null) return false; // 빈 칸 쪽은 바깥 외곽선이 맡는다
        if (this.id[ny][nx] === id) return false;
        return only ? only.includes(this.id[ny][nx]) : true;
      })) todo.push([x, y]);
    }
    for (const [x, y] of todo) this.put(x, y, ch, id);
  }
  /** 아래로 dy 칸(음수면 위로) 옮긴다 — 잉크가 판 밖으로 나가면 던진다. */
  shiftY(dy) {
    if (!dy) return;
    const g = Array.from({ length: H }, () => Array(W).fill(null));
    const id = Array.from({ length: H }, () => Array(W).fill(0));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.g[y][x] == null) continue;
      const ny = y + dy;
      if (ny < 0 || ny >= H) throw new Error(`shiftY: 잉크가 판 밖으로 (y=${y}→${ny})`);
      g[ny][x] = this.g[y][x]; id[ny][x] = this.id[y][x];
    }
    this.g = g; this.id = id;
  }
  /** 가장 아래 잉크 행(없으면 -1). */
  floor() { for (let y = H - 1; y >= 0; y--) if (this.g[y].some((c) => c != null)) return y; return -1; }
  /** 가장 위 잉크 행. */
  top() { for (let y = 0; y < H; y++) if (this.g[y].some((c) => c != null)) return y; return -1; }
  /** 사방 바닥 정렬 검사 — 마지막 행(43)에 잉크가 있어야 다리와 이어진다. */
  rows() {
    return this.g.map((r) => r.map((c) => c ?? ".").join(""));
  }
}

function inPoly(px, py, pts) {
  let c = false;
  const x = px, y = py;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 표준 눈 7×7(공용 BODY 와 같은 문법: 흰자 w · 광택 L · 동공 e · 윤곽 o). */
export const EYE = [
  ".ooooo.",
  "oowwwoo",
  "owLLwwo",
  "owLeewo",
  "owweeeo",
  ".oweeo.",
  "..ooo..",
];
/** 작은 눈 5×5 — 아기용. */
export const EYE_S = [
  ".ooo.",
  "owLwo",
  "oweeo",
  "owEeo".replace("E", "e"),
  ".ooo.",
];
/** 점눈 3×3 — 눈사람·유령처럼 단순한 얼굴. */
export const EYE_DOT = [
  "oLo",
  "oeo",
  "ooo",
];

/* ── 팔레트 ─────────────────────────────────────────────────── */
import { ramp, paint, feet } from "./deps.mjs";
export function palette(spec) {
  const B = ramp(spec.body);
  const C = ramp(spec.belly ?? spec.body);
  const M = ramp(spec.mark ?? spec.body);
  const out = {
    o: B.o, H: B.H, b: B.b, B: B.B, d: B.d, D: B.D,
    c: C.b, C: C.d,
    i: (spec.inner ?? ["#ffd9c2", "#ffb894", "#e08a63"])[1],
    e: spec.eye ?? "#2b2440", w: "#fffdf7", L: "#ffffff", p: spec.blush ?? "#ff9fb8",
    n: B.D, m: B.o, y: C.d,
    A: M.B, a: M.D,
    q: "#ffc93f", Q: "#e0a02e",
    k: "#ffd75e", K: "#c8901c", g: "#8fe3ff", s: "#fff3b0",
  };
  for (const [k, names] of [["a1", "fFh"], ["a2", "rRt"], ["a3", "uUv"]]) {
    const tri = spec[k];
    if (!tri) continue;
    const R = ramp(tri);
    out[names[0]] = tri[0]; out[names[1]] = tri[1]; out[names[2]] = tri[2];
    void R;
  }
  if (spec.beak) { const Q = ramp(spec.beak); out.q = Q.B; out.Q = Q.d; }
  return out;
}

/* ── PNG ────────────────────────────────────────────────────── */
function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let c = 0xffffffff; for (const b of td) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BGS = [[255, 243, 217], [26, 22, 32]];

/** 스프라이트({w,h,pal,rows}) 여러 장을 한 줄로, 배경 둘(밝은 · 어두운)로 굽는다. */
export function sheet(items, file, { scale = 5, pad = 4, gridLines = false } = {}) {
  const cw = Math.max(...items.map((s) => s.w)) * scale + pad * 2;
  const ch = Math.max(...items.map((s) => s.h)) * scale + pad * 2;
  const Wd = cw * items.length, Hd = ch * BGS.length;
  const buf = Buffer.alloc(Wd * Hd * 4);
  for (let bi = 0; bi < BGS.length; bi++) {
    const [br, bg, bb] = BGS[bi];
    for (let y = bi * ch; y < (bi + 1) * ch; y++) for (let x = 0; x < Wd; x++) { const o = (y * Wd + x) * 4; buf[o] = br; buf[o + 1] = bg; buf[o + 2] = bb; buf[o + 3] = 255; }
    items.forEach((sp, i) => {
      for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
        const c = sp.rows[y]?.[x];
        if (!c || c === "." || c === " ") continue;
        const col = sp.pal[c];
        if (!col || col[0] !== "#") continue;
        const [r, g, b] = hex(col);
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
          const px = i * cw + pad + x * scale + dx, py = bi * ch + pad + y * scale + dy;
          const o = (py * Wd + px) * 4; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
        }
      }
      if (gridLines) { /* 좌표 확인용 눈금: 8칸마다 */ }
    });
  }
  writeFileSync(file, png(Wd, Hd, buf));
  return { w: Wd, h: Hd };
}

/** 몸통 행(44) + 팔레트 → 공용 다리(feet)까지 붙인 48×48 스프라이트(0번 걸음). */
export const EMPTY48 = ".".repeat(48);
export function toSprite(bodyRows, pal, fur = "b", padCh = "y", phase = 0) {
  if (bodyRows.length !== 44) throw new Error("몸통은 44행이어야 한다: " + bodyRows.length);
  const base = [...bodyRows, EMPTY48, EMPTY48, EMPTY48, EMPTY48];
  return { w: 48, h: 48, pal, rows: paint(base, feet(phase, fur, padCh)) };
}

/** 여러 스프라이트를 cols 열 격자로 한 장에(배경 한 가지). */
export function grid(items, cols, file, { scale = 4, pad = 3, bg = [255, 243, 217] } = {}) {
  const cw = 48 * scale + pad * 2, ch = 48 * scale + pad * 2;
  const rowsN = Math.ceil(items.length / cols);
  const Wd = cw * cols, Hd = ch * rowsN;
  const buf = Buffer.alloc(Wd * Hd * 4);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const o = (y * Wd + x) * 4; buf[o] = bg[0]; buf[o + 1] = bg[1]; buf[o + 2] = bg[2]; buf[o + 3] = 255; }
  items.forEach((sp, i) => {
    const gx = (i % cols) * cw, gy = Math.floor(i / cols) * ch;
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const c = sp.rows[y]?.[x];
      if (!c || c === "." || c === " ") continue;
      const col = sp.pal[c];
      if (!col || col[0] !== "#") continue;
      const [r, g, b] = hex(col);
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const px = gx + pad + x * scale + dx, py = gy + pad + y * scale + dy;
        const o = (py * Wd + px) * 4; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
      }
    }
  });
  writeFileSync(file, png(Wd, Hd, buf));
  return { w: Wd, h: Hd };
}
