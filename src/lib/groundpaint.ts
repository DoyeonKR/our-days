/* 모험 바닥 그림 — 지역마다 다른 질감을 한 번 굽는다(2026-11-10 [사용자: "있는 거에서 좀 고퀄리티로"]). README §14.6
 * 예전 전투장은 단색 그라데이션 + 흰 격자 + 가운데 원(운동장 같은 시제품)이었고, 필드는 같은 단색 위에 점 몇 개였다.
 * 여기서는 큰 얼룩(색 흔들림) → 고운 알갱이 → 지역 재료(풀결 · 모래 · 진흙 · 돌바닥 · 눈밭 · 신전 타일) → 가장자리 그늘 순으로 칠한다.
 * 판정과 무관하다(그림만). 같은 지역 · 같은 크기면 늘 같은 그림(해시 난수). 매 프레임 부르지 말고 한 번 구워 쓴다. */

type Ctx = CanvasRenderingContext2D;

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** k > 0 밝게, < 0 어둡게 */
export function tone(hex: string, k: number, a = 1): string {
  const [r, g, b] = hexRgb(hex);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return a >= 1 ? `rgb(${f(r)},${f(g)},${f(b)})` : `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}

function rng(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blob(c: Ctx, x: number, y: number, r: number, color: string, alpha: number, squash = 0.7) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, r, r * squash, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** 풀결 — 몇 가닥씩 모인 덤불. lean 은 바람 쪽 기울기 */
function grass(c: Ctx, R: () => number, w: number, h: number, ground: string, clumps: number, lean: number, long: number) {
  const cols = [tone(ground, -0.32), tone(ground, -0.18), tone(ground, 0.12), tone(ground, 0.26)];
  c.lineCap = "round";
  for (let i = 0; i < clumps; i++) {
    const cx = R() * w;
    const cy = R() * h;
    const n = 4 + Math.floor(R() * 6);
    for (let k = 0; k < n; k++) {
      const x = cx + (R() - 0.5) * 16;
      const y = cy + (R() - 0.5) * 8;
      const len = (6 + R() * 9) * long;
      const bend = lean * len * (0.5 + R() * 0.6) + (R() - 0.5) * 5;
      c.strokeStyle = cols[Math.floor(R() * cols.length)];
      c.lineWidth = 1.3 + R() * 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + bend * 0.3, y - len * 0.6, x + bend, y - len);
      c.stroke();
    }
  }
}

function flowers(c: Ctx, R: () => number, w: number, h: number, n: number, palette: string[]) {
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = R() * h;
    const s = 2.2 + R() * 2;
    c.fillStyle = palette[Math.floor(R() * palette.length)];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + R();
      c.beginPath();
      c.arc(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.8, s * 0.75, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#fff0a0";
    c.beginPath();
    c.arc(x, y, s * 0.55, 0, Math.PI * 2);
    c.fill();
  }
}

function pebbles(c: Ctx, R: () => number, w: number, h: number, n: number, base: string) {
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = R() * h;
    const rx = 2 + R() * 5;
    const ry = rx * (0.55 + R() * 0.25);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.beginPath();
    c.ellipse(x + 1, y + 1.5, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = tone(base, (R() - 0.5) * 0.3);
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.35)";
    c.beginPath();
    c.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function cracks(c: Ctx, R: () => number, w: number, h: number, n: number, color: string) {
  c.strokeStyle = color;
  c.lineCap = "round";
  for (let i = 0; i < n; i++) {
    let x = R() * w;
    let y = R() * h;
    let a = R() * Math.PI * 2;
    c.lineWidth = 0.8 + R() * 1.4;
    c.beginPath();
    c.moveTo(x, y);
    const steps = 4 + Math.floor(R() * 7);
    for (let s = 0; s < steps; s++) {
      a += (R() - 0.5) * 1.3;
      x += Math.cos(a) * (8 + R() * 16);
      y += Math.sin(a) * (8 + R() * 16);
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

/** 신전 돌바닥 — 엇갈린 줄 타일 */
function tiles(c: Ctx, R: () => number, w: number, h: number, base: string) {
  const tw = 96;
  const th = 64;
  for (let row = 0, y = 0; y < h + th; row++, y += th) {
    for (let x = row % 2 ? -tw / 2 : 0; x < w + tw; x += tw) {
      c.fillStyle = tone(base, (R() - 0.5) * 0.09);
      c.fillRect(x + 1, y + 1, tw - 2, th - 2);
      c.fillStyle = "rgba(255,255,255,.07)";
      c.fillRect(x + 1.5, y + 1.5, tw - 3, 4);
      if (R() < 0.18) blob(c, x + R() * tw, y + R() * th, 10 + R() * 14, "#7fae6a", 0.35);
    }
  }
  c.strokeStyle = tone(base, -0.35, 0.3);
  c.lineWidth = 1.5;
  for (let row = 0, y = 0; y < h + th; row++, y += th) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
    for (let x = row % 2 ? -tw / 2 : 0; x < w + tw; x += tw) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + th);
      c.stroke();
    }
  }
}

function sparkles(c: Ctx, R: () => number, w: number, h: number, n: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = R() * h;
    const s = 1.5 + R() * 2.5;
    c.globalAlpha = 0.4 + R() * 0.5;
    c.beginPath();
    c.moveTo(x - s, y);
    c.lineTo(x + s, y);
    c.moveTo(x, y - s);
    c.lineTo(x, y + s);
    c.stroke();
  }
  c.globalAlpha = 1;
}

/** 지역 바닥을 (0,0)~(w,h)에 칠한다. arena 면 가운데 문양 · 가장자리 그늘까지 */
export function paintGround(c: Ctx, key: string, w: number, h: number, ground: string, opts: { arena?: boolean } = {}): void {
  const R = rng(`${key}:${w}x${h}`);
  c.save();
  // 바탕 — 위가 살짝 밝은 결
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tone(ground, 0.08));
  g.addColorStop(1, tone(ground, -0.1));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // 큰 얼룩 — 한 색이 아니라 붓질처럼
  const area = (w * h) / (760 * 1040);
  for (let i = 0; i < 90 * area; i++) {
    blob(c, R() * w, R() * h, 50 + R() * 120, tone(ground, (R() - 0.5) * 0.28), 0.45);
  }
  // 고운 알갱이
  for (let i = 0; i < 4200 * area; i++) {
    c.fillStyle = R() < 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)";
    const s = 1 + R() * 1.6;
    c.fillRect(R() * w, R() * h, s, s);
  }
  // 지역 재료
  if (key === "meadow") {
    for (let i = 0; i < 14 * area; i++) blob(c, R() * w, R() * h, 40 + R() * 50, tone("#b78a55", 0.1), 0.28, 0.5);
    grass(c, R, w, h, ground, 520 * area, 0.1, 1);
    flowers(c, R, w, h, 140 * area, ["#ffb3c9", "#fff3b0", "#d7c2ff", "#ffffff"]);
    pebbles(c, R, w, h, 40 * area, "#b8b0a0");
  } else if (key === "hill") {
    grass(c, R, w, h, ground, 620 * area, 0.55, 1.35);
    flowers(c, R, w, h, 50 * area, ["#fff3b0", "#ffffff"]);
    pebbles(c, R, w, h, 70 * area, "#c4bba8");
  } else if (key === "lake") {
    for (let i = 0; i < 30 * area; i++) blob(c, R() * w, R() * h, 50 + R() * 70, "#efe0b0", 0.35, 0.6);
    for (let i = 0; i < 20 * area; i++) blob(c, R() * w, R() * h, 30 + R() * 50, tone(ground, -0.3), 0.3, 0.55);
    grass(c, R, w, h, ground, 260 * area, 0.05, 0.9);
    pebbles(c, R, w, h, 220 * area, "#d8d2c4");
    // 갈대
    c.lineCap = "round";
    for (let i = 0; i < 26 * area; i++) {
      const x = R() * w;
      const y = R() * h;
      for (let k = 0; k < 6; k++) {
        const bx = x + (R() - 0.5) * 14;
        const len = 18 + R() * 16;
        c.strokeStyle = tone("#4f7d48", (R() - 0.5) * 0.2);
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(bx, y);
        c.lineTo(bx + (R() - 0.5) * 6, y - len);
        c.stroke();
        if (R() < 0.5) {
          c.fillStyle = "#8a5a32";
          c.beginPath();
          c.ellipse(bx, y - len + 3, 2, 5, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  } else if (key === "swamp") {
    for (let i = 0; i < 40 * area; i++) blob(c, R() * w, R() * h, 40 + R() * 70, "#5a4a32", 0.32, 0.6);
    // 물웅덩이 — 어둡고 반들반들
    for (let i = 0; i < 22 * area; i++) {
      const x = R() * w;
      const y = R() * h;
      const r = 14 + R() * 26;
      c.fillStyle = "rgba(28,40,34,.55)";
      c.beginPath();
      c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(220,240,230,.35)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(x - r * 0.15, y - r * 0.12, r * 0.6, r * 0.25, 0, Math.PI * 1.1, Math.PI * 1.7);
      c.stroke();
    }
    for (let i = 0; i < 60 * area; i++) blob(c, R() * w, R() * h, 10 + R() * 18, "#6f9a4e", 0.6, 0.65);
    grass(c, R, w, h, ground, 300 * area, 0, 1.1);
    // 작은 버섯
    for (let i = 0; i < 46 * area; i++) {
      const x = R() * w;
      const y = R() * h;
      c.fillStyle = "#efe6d0";
      c.fillRect(x - 1.2, y - 5, 2.4, 5);
      c.fillStyle = R() < 0.5 ? "#c85a4a" : "#d9b45a";
      c.beginPath();
      c.ellipse(x, y - 5, 4.5, 3, 0, Math.PI, 0);
      c.fill();
    }
  } else if (key === "cave") {
    for (let i = 0; i < 50 * area; i++) blob(c, R() * w, R() * h, 40 + R() * 80, tone(ground, (R() - 0.5) * 0.3), 0.5, 0.75);
    cracks(c, R, w, h, 110 * area, tone(ground, -0.55, 0.7));
    pebbles(c, R, w, h, 160 * area, "#8a8298");
    // 빛나는 결정
    for (let i = 0; i < 20 * area; i++) {
      const x = R() * w;
      const y = R() * h;
      const col = R() < 0.5 ? "#9fe8ff" : "#d2a8ff";
      blob(c, x, y - 6, 26, col, 0.35, 1);
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 6;
        const ht = 10 + R() * 10;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x + ox - 3, y);
        c.lineTo(x + ox, y - ht);
        c.lineTo(x + ox + 3, y);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(255,255,255,.6)";
        c.beginPath();
        c.moveTo(x + ox - 1, y - 2);
        c.lineTo(x + ox, y - ht + 2);
        c.lineTo(x + ox + 0.6, y - 2);
        c.fill();
      }
    }
  } else if (key === "plateau") {
    for (let i = 0; i < 46 * area; i++) blob(c, R() * w, R() * h, 50 + R() * 90, "#ffffff", 0.55, 0.45);
    // 눈더미 그늘 — 파란 초승달
    for (let i = 0; i < 40 * area; i++) {
      const x = R() * w;
      const y = R() * h;
      const r = 20 + R() * 40;
      c.fillStyle = "rgba(120,160,210,.18)";
      c.beginPath();
      c.ellipse(x, y + r * 0.2, r, r * 0.3, 0, 0, Math.PI);
      c.fill();
    }
    for (let i = 0; i < 12 * area; i++) blob(c, R() * w, R() * h, 30 + R() * 40, "#c8e6ff", 0.45, 0.4);
    sparkles(c, R, w, h, 360 * area, "#ffffff");
    pebbles(c, R, w, h, 30 * area, "#9aa4b0");
  } else if (key === "temple") {
    tiles(c, R, w, h, ground);
    cracks(c, R, w, h, 40 * area, tone(ground, -0.5, 0.5));
    sparkles(c, R, w, h, 160 * area, "#ffe9a6");
  } else {
    grass(c, R, w, h, ground, 400 * area, 0.1, 1);
  }
  // 전투장 — 가운데 문양(옛 운동장 선 대신) · 가장자리 그늘
  if (opts.arena) {
    const cx = w / 2;
    const cy = h / 2;
    c.strokeStyle = key === "temple" ? "rgba(255,226,140,.35)" : "rgba(255,255,255,.14)";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy, 150, 104, 0, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(cx, cy, 128, 88, 0, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 88);
      c.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 104);
      c.stroke();
    }
    const v = c.createRadialGradient(cx, cy, Math.min(w, h) * 0.32, cx, cy, Math.max(w, h) * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10,6,20,.42)");
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }
  c.restore();
}

const DIRT: Record<string, string> = {
  meadow: "#c9a46e", hill: "#cdb07a", lake: "#d9c79a", swamp: "#7d6646", cave: "#7b7186", plateau: "#e8eef6", temple: "#b9a98a",
};

/** 굽은 흙길 — 가장자리 그늘 · 바퀴 자국 · 자갈. 점 목록을 부드러운 곡선으로 잇는다 */
export function paintPath(c: Ctx, key: string, pts: { x: number; y: number }[], width: number): void {
  if (pts.length < 2) return;
  const R = rng(`path:${key}:${pts.length}`);
  const dirt = DIRT[key] ?? "#c9a46e";
  const trace = () => {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const m = pts[i];
      const n = pts[i + 1];
      c.quadraticCurveTo(m.x, m.y, (m.x + n.x) / 2, (m.y + n.y) / 2);
    }
    c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // 풀과 맞닿는 흐린 테두리 · 그늘
  c.strokeStyle = "rgba(20,12,4,.18)";
  c.lineWidth = width + 26;
  trace();
  c.stroke();
  c.strokeStyle = tone(dirt, -0.22);
  c.lineWidth = width + 8;
  trace();
  c.stroke();
  c.strokeStyle = dirt;
  c.lineWidth = width;
  trace();
  c.stroke();
  // 가운데가 더 닳아 밝다
  c.strokeStyle = tone(dirt, 0.16, 0.7);
  c.lineWidth = width * 0.45;
  trace();
  c.stroke();
  // 바퀴 자국 두 줄
  c.setLineDash([26, 14]);
  c.strokeStyle = tone(dirt, -0.18, 0.55);
  c.lineWidth = 3;
  for (const off of [-width * 0.2, width * 0.2]) {
    c.save();
    c.translate(off, 0);
    trace();
    c.stroke();
    c.restore();
  }
  c.setLineDash([]);
  // 길 위 알갱이 · 자갈 — 길을 따라 흩뿌린다(점을 길 가까이에만 찍는다)
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    for (let k = 0; k < len / 3; k++) {
      const t = R();
      const off = (R() - 0.5) * width * 0.75;
      const x = a.x + (b.x - a.x) * t + nx * off;
      const y = a.y + (b.y - a.y) * t + ny * off;
      c.fillStyle = R() < 0.5 ? tone(dirt, -0.25, 0.5) : tone(dirt, 0.3, 0.5);
      const sz = 1.2 + R() * 2.2;
      c.fillRect(x, y, sz, sz);
      if (R() < 0.08) {
        c.fillStyle = tone(dirt, -0.35, 0.8);
        c.beginPath();
        c.ellipse(x, y, 3 + R() * 3, 2 + R() * 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,.35)";
        c.beginPath();
        c.ellipse(x - 1, y - 1, 1.5, 1, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.restore();
}

/** 수풀 자리 — 테두리가 딱딱한 타원 대신 짙은 풀이 번지듯 */
export function paintThicket(c: Ctx, key: string, x: number, y: number, rx: number, ry: number, ground: string): void {
  const dark = key === "plateau" ? "#c4d3e4" : tone(ground, -0.3);
  const g = c.createRadialGradient(x, y, Math.min(rx, ry) * 0.2, x, y, Math.max(rx, ry));
  g.addColorStop(0, dark);
  g.addColorStop(0.72, dark);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.save();
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, rx * 1.08, ry * 1.12, 0, 0, Math.PI * 2);
  c.fill();
  const R = rng(`thicket:${key}:${Math.round(x)}:${Math.round(y)}`);
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2;
    const q = Math.sqrt(R()) * 0.8;
    c.globalAlpha = 0.14;
    c.fillStyle = R() < 0.5 ? tone(ground, -0.42) : tone(ground, -0.18);
    c.beginPath();
    c.ellipse(x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q, 14 + R() * 18, 9 + R() * 10, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
