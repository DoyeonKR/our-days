// 올해의 우리 공유 카드(1080×1350 PNG) — 한 해의 숫자 넷 + 기억할 순간 몇 줄. [2026-11-13 우리 연대기]
// 월간 카드(recapcard)와 같은 길: 브라우저 전용 캔버스 · 세로 배치는 YEAR_LAYOUT 한 곳(테스트가 겹침을 잰다) ·
// 공유는 shareOrDownload(앱 → 네이티브 공유 시트, 웹 → Web Share, 안 되면 내려받기).
import type { YearSummary } from "./chronicle.ts";
import { YEAR_MOMENTS_MAX } from "./chronicle.ts";
import { shareOrDownload } from "./recapcard.ts";

const W = 1080;
const H = 1350;
const PAD = 80;
const STAT_H = 170;
const STAT_GAP = 24;
const STAT_TOP = 272;
const MOMENT_LINE = 74;
const MOMENTS_TOP = 760;

/** 세로 배치 — 위에서 아래로: 머리(~214) · 숫자 칸 2×2 · '기억할 순간' 제목 · 순간 줄 · 맺음말. */
export const YEAR_LAYOUT = {
  height: H,
  width: W,
  pad: PAD,
  titleBase: 214,
  statTop: STAT_TOP,
  statH: STAT_H,
  statGap: STAT_GAP,
  statBottom: STAT_TOP + STAT_H * 2 + STAT_GAP,
  momentsHeadBase: 712,
  momentsTop: MOMENTS_TOP,
  momentLine: MOMENT_LINE,
  momentsBottom: MOMENTS_TOP + MOMENT_LINE * YEAR_MOMENTS_MAX,
  footTop: 1150,
  footBase: 1196,
  footBottom: 1210,
};

/** 순간 한 줄이 칸을 넘지 않게 — 넘치면 말줄임(글자 수로 먼저 자르고, 그리기에서 폭으로 한 번 더). */
export const MOMENT_MAX_CHARS = 30;
export function clampLine(s: string, max = MOMENT_MAX_CHARS): string {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("")}…`;
}

function fitText(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  let t = s;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = `${[...t].slice(0, -2).join("")}…`;
  return t;
}

export async function renderYearCard(sum: YearSummary): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const L = YEAR_LAYOUT;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fff1f4");
  bg.addColorStop(1, "#fde7d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#b4375a";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText("하루 · 올해의 우리", PAD, 120);
  ctx.fillStyle = "#2b2024";
  ctx.font = "800 76px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${sum.year}년의 우리`, PAD, L.titleBase);

  const stats: [string, number][] = [["일기", sum.diaries], ["사진", sum.photos], ["로그", sum.logs], ["함께한 일정", sum.events]];
  const cellW = (W - PAD * 2 - STAT_GAP) / 2;
  stats.forEach(([label, n], i) => {
    const x = PAD + (i % 2) * (cellW + STAT_GAP);
    const y = L.statTop + Math.floor(i / 2) * (STAT_H + STAT_GAP);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, STAT_H, 32);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b2024";
    ctx.font = "800 68px system-ui, -apple-system, sans-serif";
    ctx.fillText(n.toLocaleString("ko-KR"), x + cellW / 2, y + 92);
    ctx.fillStyle = "#7a6a70";
    ctx.font = "600 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(label, x + cellW / 2, y + 140);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "#b4375a";
  ctx.font = "700 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("기억할 순간", PAD, L.momentsHeadBase);
  ctx.font = "600 36px system-ui, -apple-system, sans-serif";
  const lines = sum.moments.length ? sum.moments.slice(0, YEAR_MOMENTS_MAX) : ["올해의 첫 순간을 기다려요"];
  lines.forEach((line, i) => {
    const y = L.momentsTop + i * MOMENT_LINE;
    ctx.fillStyle = "#b4375a";
    ctx.beginPath();
    ctx.arc(PAD + 10, y + 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2024";
    ctx.fillText(fitText(ctx, clampLine(line), W - PAD * 2 - 40), PAD + 36, y + 38);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#7a6a70";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(sum.total ? `${sum.activeDays}일 동안 ${sum.total.toLocaleString("ko-KR")}개의 순간을 남겼어요` : "올해의 이야기를 함께 채워 가요", W / 2, L.footBase);
  ctx.textAlign = "left";

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/** 카드를 그려 공유 · 내려받기. 취소(AbortError)는 그대로 던진다(부르는 쪽이 아무 말도 안 하게). */
export async function shareYearCard(sum: YearSummary): Promise<"shared" | "saved"> {
  const blob = await renderYearCard(sum);
  if (!blob) throw new Error("card");
  return shareOrDownload(blob, `haru-${sum.year}.png`, "올해의 우리");
}
