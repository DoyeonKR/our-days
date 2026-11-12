/* 어탁 카드 그리기(1080×1350 PNG, 2026-11-12) — 브라우저 전용. 배치는 fishtrophy.printLayout(테스트가 겹침을 잰다), 여기는 붓질만.
 *
 * 왜 이렇게 그리나
 *  - 어탁은 물고기 몸에 먹을 바르고 한지를 눌러 뜬다 — 윤곽은 몸 그대로, 속은 비늘 · 지느러미 결만큼 먹이 덜 묻는다.
 *    그래서 물고기 그림의 알파를 틀로 쓰고, 그림이 밝은 곳(배 · 비늘 반짝임)일수록 먹을 옅게 둔다. 결은 그림에서 오고 색은 먹 하나다.
 *  - 번짐 · 얼룩 · 낙관의 닳은 자리는 key + cm 씨앗의 난수 — 같은 어탁은 언제 내보내도 같은 한 장이어야 한다(공유할 때마다 달라지면 '인증'이 아니다).
 *  - shadowBlur · ctx.filter 는 쓰지 않는다(사파리 · 폰 — 낚시 연출과 같은 규칙). 번짐은 겹쳐 찍기와 multiply 로만.
 *  - 서체는 시스템 서체뿐(받는 서체 없음). 명조가 있는 기기는 붓글씨에 가깝고, 없으면 serif 로 떨어진다. */
import { FISH_IMAGE_KEYS } from "./aquaimages.ts";
import { asset } from "./base.ts";
import { fmtCm, fmtKg, kgOf } from "./fishingworld.ts";
import { PRINT_H, PRINT_W, printLayout, printLines, printSeed, sealChar, type Box, type TrophyCard } from "./fishtrophy.ts";

const SERIF = `"Nanum Myeongjo", "AppleMyungjo", "Batang", "Noto Serif KR", "Noto Serif CJK KR", serif`;
const INK: readonly [number, number, number] = [26, 22, 20];
const PAPER = "#efe4cb";
const SEAL = "#b3322a";

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
/** 물고기 그림 — 카드는 크게 찍으니 원본(512px)을 먼저, 없으면 화면용(192px). 그림이 없는 key 는 null(대신 그린 실루엣) */
async function fishSource(key: string): Promise<CanvasImageSource & { width: number; height: number } | null> {
  if (!FISH_IMAGE_KEYS.has(key)) return null;
  return (await loadImage(asset(`/aqua/fish/${key}.webp`))) ?? (await loadImage(asset(`/aqua/fish/sm/${key}.webp`)));
}
/** 그림이 없을 때 — 수조의 임시 그림(AquaArt)과 같은 머리가 오른쪽인 물고기 모양 */
function fallbackFish(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 400;
  const g = c.getContext("2d")!;
  g.scale(4, 4);
  g.fillStyle = "#333";
  g.beginPath();
  g.moveTo(22, 50); g.lineTo(4, 30); g.lineTo(9, 50); g.lineTo(4, 70); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(55, 50, 38, 24, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(50, 30); g.quadraticCurveTo(60, 12, 72, 30); g.closePath(); g.fill();
  g.fillStyle = "#bbb";
  g.beginPath(); g.arc(77, 44, 4, 0, Math.PI * 2); g.fill();
  return c;
}

/** 알파가 있는 곳의 테두리 — 그림마다 여백이 달라서, 몸만 잘라 칸에 맞춘다 */
function alphaBox(src: CanvasImageSource & { width: number; height: number }): { x: number; y: number; w: number; h: number } {
  const w = Math.max(1, Math.round(src.width)), h = Math.max(1, Math.round(src.height));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < 24) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  c.width = 0;
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** 한지 — 바탕색 · 가장자리 그을림 · 닥나무 섬유 · 티끌 */
function drawPaper(g: CanvasRenderingContext2D, r: () => number) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, PRINT_W, PRINT_H);
  const v = g.createRadialGradient(PRINT_W / 2, PRINT_H * 0.45, PRINT_W * 0.3, PRINT_W / 2, PRINT_H / 2, PRINT_W * 0.95);
  v.addColorStop(0, "rgba(255,250,235,0.35)");
  v.addColorStop(1, "rgba(120,88,48,0.22)");
  g.fillStyle = v;
  g.fillRect(0, 0, PRINT_W, PRINT_H);
  g.lineCap = "round";
  for (let i = 0; i < 1100; i++) {
    const x = r() * PRINT_W, y = r() * PRINT_H, len = 6 + r() * (r() < 0.08 ? 70 : 24), a = r() * Math.PI * 2;
    g.strokeStyle = `rgba(${130 + Math.round(r() * 40)},${100 + Math.round(r() * 30)},${60 + Math.round(r() * 20)},${(0.04 + r() * 0.08).toFixed(3)})`;
    g.lineWidth = 0.5 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(90,64,36,${(0.05 + r() * 0.12).toFixed(3)})`;
    g.beginPath();
    g.arc(r() * PRINT_W, r() * PRINT_H, 0.6 + r() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  // 표구 가장자리처럼 옅은 테 — 공유된 사진만 봐도 '한 장의 종이'로 읽히게
  g.strokeStyle = "rgba(110,74,38,0.22)";
  g.lineWidth = 2;
  g.strokeRect(34, 34, PRINT_W - 68, PRINT_H - 68);
}

/** 먹으로 찍은 실루엣 — 알파 = 몸, 밝기 = 먹이 덜 묻는 결. 큰 얼룩(먹이 안 닿은 자리)과 고운 결을 곱한다 */
function inkFish(src: CanvasImageSource, crop: { x: number; y: number; w: number; h: number }, w: number, h: number, r: () => number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  // 큰 얼룩 — 40×40 값 격자를 부드럽게 늘린다(더 굵으면 얼룩무늬 위장복처럼 보였다)
  const N = 40, grid = Array.from({ length: (N + 1) * (N + 1) }, () => r());
  const blot = (x: number, y: number) => {
    const gx = (x / w) * N, gy = (y / h) * N, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const at = (i: number, j: number) => grid[Math.min(N, j) * (N + 1) + Math.min(N, i)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = d[i + 3] / 255;
    if (a <= 0.02) { d[i + 3] = 0; continue; }
    const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const body = 0.6 + 0.4 * Math.pow(1 - L, 0.8); // 어두운 무늬 · 윤곽은 짙게, 밝은 배는 옅게(그래도 먹이다 — 회색으로 뜨면 수묵화가 아니라 사진이다)
    const m = 0.84 + 0.22 * blot(x, y); // 먹이 고르게 안 묻은 자리
    const grain = 0.86 + 0.14 * r(); // 한지 결
    const v = Math.min(1, a * body * m * grain * 1.18);
    d[i] = INK[0]; d[i + 1] = INK[1]; d[i + 2] = INK[2];
    d[i + 3] = Math.round(v * 255);
  }
  g.putImageData(img, 0, 0);
  // 종이가 덜 닿은 하얀 자리 몇 군데
  g.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 7; k++) {
    const rad = Math.max(4, Math.min(w, h) * (0.02 + r() * 0.05));
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
    gr.addColorStop(0, "rgba(0,0,0,0.55)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save();
    g.translate(w * (0.15 + r() * 0.7), h * (0.2 + r() * 0.6));
    g.scale(1.6, 1);
    g.fillStyle = gr;
    g.fillRect(-rad, -rad, rad * 2, rad * 2);
    g.restore();
  }
  g.globalCompositeOperation = "source-over";
  return c;
}

/** 칸 폭에 맞춰 글자 크기를 줄인다 — 이름이 긴 물고기(넓은주둥이상어 · 금붕어 어린 물고기)도 낙관을 넘지 않게 */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number, min = 22): number {
  let s = size;
  for (;;) {
    g.font = `${weight} ${s}px ${SERIF}`;
    if (g.measureText(text).width <= maxW || s <= min) return s;
    s -= 2;
  }
}
/** 붓글씨 맛 — 살짝 어긋나게 옅게 세 번 찍고 진하게 한 번(번짐) */
function brush(g: CanvasRenderingContext2D, text: string, x: number, y: number, r: () => number, alpha = 0.92) {
  g.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.22)`;
  for (let k = 0; k < 3; k++) g.fillText(text, x + (r() - 0.5) * 2.6, y + (r() - 0.5) * 2.6);
  g.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${alpha})`;
  g.fillText(text, x, y);
}

/** 낙관 — 붉은 인주, 흰 테 · 이름 첫 글자, 닳은 자리. 살짝 기울여 찍는다(칸 = 기운 뒤의 테두리) */
function drawSeal(g: CanvasRenderingContext2D, box: Box, ch: string, r: () => number) {
  const side = box.w / 1.08; // 기울인 만큼 칸 안에
  const c = document.createElement("canvas");
  c.width = Math.ceil(side);
  c.height = Math.ceil(side);
  const s = c.getContext("2d")!;
  s.fillStyle = SEAL;
  s.beginPath();
  s.roundRect(2, 2, side - 4, side - 4, 16);
  s.fill();
  s.strokeStyle = "rgba(250,236,226,0.92)";
  s.lineWidth = 5;
  s.beginPath();
  s.roundRect(13, 13, side - 26, side - 26, 9);
  s.stroke();
  s.fillStyle = "rgba(250,236,226,0.95)";
  s.textAlign = "center";
  s.textBaseline = "middle";
  s.font = `900 ${Math.round(side * 0.58)}px ${SERIF}`;
  s.fillText(ch, side / 2, side / 2 + side * 0.03);
  s.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 160; k++) {
    s.fillStyle = `rgba(0,0,0,${(0.25 + r() * 0.6).toFixed(2)})`;
    s.beginPath();
    s.arc(r() * side, r() * side, 0.6 + r() * (r() < 0.1 ? 5 : 2), 0, Math.PI * 2);
    s.fill();
  }
  g.save();
  g.translate(box.x + box.w / 2, box.y + box.h / 2);
  g.rotate(-0.035);
  g.globalAlpha = 0.93;
  g.globalCompositeOperation = "multiply";
  g.drawImage(c, -side / 2, -side / 2);
  g.restore();
  c.width = 0;
}

/** 어탁 한 장을 PNG 로 — 그림을 못 받으면 대신 그린 실루엣으로라도 찍는다(빈 카드는 없다) */
export async function renderGyotaku(t: TrophyCard): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const r = rng(printSeed(t.key, t.cm));
  const src = (await fishSource(t.key)) ?? fallbackFish();
  const crop = alphaBox(src);
  const lines = printLines(t);
  const L = printLayout({ ratio: t.ratio, aspect: crop.w / crop.h, lines });

  const canvas = document.createElement("canvas");
  canvas.width = PRINT_W;
  canvas.height = PRINT_H;
  const g = canvas.getContext("2d");
  if (!g) return null;
  drawPaper(g, r);

  // 실루엣 — 기울여 multiply 로 얹는다(종이 결이 먹 사이로 비친다). 먹방울 몇 개는 칸 안에서만
  const fw = Math.max(8, Math.round(L.fish.w)), fh = Math.max(8, Math.round(L.fish.h));
  const ink = inkFish(src, crop, fw, fh, r);
  g.save();
  g.translate(L.fish.x + L.fish.w / 2, L.fish.y + L.fish.h / 2);
  g.rotate(L.tilt);
  g.globalCompositeOperation = "multiply";
  g.drawImage(ink, -fw / 2, -fh / 2);
  g.restore();
  ink.width = 0;
  g.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.55)`;
  for (let k = 0; k < 14; k++) {
    const x = L.fishBounds.x + r() * L.fishBounds.w, y = L.fishBounds.y + r() * L.fishBounds.h;
    if (x < L.fishArea.x + 6 || x > L.fishArea.x + L.fishArea.w - 6 || y < L.fishArea.y + 6 || y > L.fishArea.y + L.fishArea.h - 6) continue;
    g.beginPath();
    g.arc(x, y, 0.8 + r() * 2.4, 0, Math.PI * 2);
    g.fill();
  }

  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  // 머리글 — 왼쪽 갈래 이름, 오른쪽 '보통의 N배'(대물일 때만)
  g.font = `600 30px ${SERIF}`;
  brush(g, "어탁 · 대물 인증", L.head.x, L.head.y + 36, r, 0.72);
  if (t.ratio >= 1.05) {
    const big = `보통 길이의 ${t.ratio.toFixed(1)}배`;
    g.textAlign = "right";
    g.font = `600 28px ${SERIF}`;
    g.fillStyle = "rgba(150,40,32,0.85)";
    g.fillText(big, L.head.x + L.head.w, L.head.y + 36);
    g.textAlign = "left";
  }
  // 이름 · 길이
  fit(g, t.name, 800, 96, L.name.w);
  brush(g, t.name, L.name.x, L.name.y + L.name.h - 22, r);
  const len = `${fmtCm(t.cm)} · ${fmtKg(kgOf(t.cm))}`;
  fit(g, len, 700, 68, L.cm.w);
  brush(g, len, L.cm.x, L.cm.y + L.cm.h - 20, r, 0.85);
  // 낚시터 · 날짜 · 잡은 사람
  for (const ln of L.lines) {
    const base = ln.box.y + ln.box.h - 12;
    g.font = `600 26px ${SERIF}`;
    g.fillStyle = "rgba(150,40,32,0.8)";
    g.fillText(ln.label, ln.box.x, base);
    const lw = Math.max(150, g.measureText(ln.label).width + 24);
    fit(g, ln.text, 600, 36, ln.box.w - lw);
    brush(g, ln.text, ln.box.x + lw, base, r, 0.86);
  }
  drawSeal(g, L.seal, sealChar(t.by), r);
  g.font = `500 24px ${SERIF}`;
  g.fillStyle = "rgba(60,44,30,0.45)";
  g.fillText("하루 · 우리 섬 낚시", L.foot.x, L.foot.y + 26);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/** 내보낼 파일 이름 — 모습 key · cm(같은 어탁은 같은 이름) */
export const gyotakuFileName = (t: Pick<TrophyCard, "key" | "cm">) => `haru-gyotaku-${t.key}-${String(t.cm).replace(".", "_")}.png`;
