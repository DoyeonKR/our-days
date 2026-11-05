// 월간 리캡 공유 카드(1080×1350 PNG) — 그 달의 좋은 사진 4장 + 숫자. [2026-11-06 F5]
// 브라우저 전용. 사진은 fetch → Blob → createImageBitmap 으로 그린다(서명 URL 을 <img> 로 그리면 다른 출처라 캔버스가 더럽혀져 내보낼 수 없다).
import type { MonthlyRecap } from "@/lib/memories";

const W = 1080;
const H = 1350;
/** 세로 배치 — 예전엔 사진이 1190 까지 내려와 요약 글(1130)과 숫자(1210)를 덮었다[사용자 캡처]. 테스트가 겹침을 잰다. */
const CELL_W = 448;
const CELL_H = 350;
const CELL_GAP = 24;
const PHOTO_TOP = 260;
export const RECAP_LAYOUT = {
  height: H,
  photoBottom: PHOTO_TOP + CELL_H * 2 + CELL_GAP,
  lineTop: 1020,
  lineBase: 1056,
  statTop: 1110,
  statBase: 1170,
  labelBase: 1218,
  labelBottom: 1228,
};

async function bitmapOf(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

/** 칸에 가운데를 잘라 채운다(object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, cw: number, ch: number, r: number) {
  const s = Math.max(cw / img.width, ch / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, r);
  ctx.clip();
  ctx.drawImage(img, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
  ctx.restore();
}

export async function renderRecapCard(recap: MonthlyRecap, photoUrls: string[]): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fff1f4");
  bg.addColorStop(1, "#fde7d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const [y, m] = recap.monthKey.split("-");
  ctx.fillStyle = "#b4375a";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText("하루 · 월간 리캡", 80, 120);
  ctx.fillStyle = "#2b2024";
  ctx.font = "800 76px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${y}년 ${Number(m)}월의 우리`, 80, 214);

  const bitmaps = (await Promise.all(photoUrls.slice(0, 4).map(bitmapOf))).filter((b): b is ImageBitmap => !!b);
  for (let i = 0; i < 4; i++) {
    const x = 80 + (i % 2) * (CELL_W + CELL_GAP);
    const yy = PHOTO_TOP + Math.floor(i / 2) * (CELL_H + CELL_GAP);
    const img = bitmaps[i];
    if (img) drawCover(ctx, img, x, yy, CELL_W, CELL_H, 36);
    else {
      ctx.fillStyle = "rgba(180,55,90,0.10)";
      ctx.beginPath();
      ctx.roundRect(x, yy, CELL_W, CELL_H, 36);
      ctx.fill();
    }
  }
  bitmaps.forEach((b) => b.close?.());

  const stats: [string, number][] = [["일기", recap.diaries], ["사진", recap.photos], ["로그", recap.logs], ["답변", recap.answers]];
  const colW = (W - 160) / 4;
  stats.forEach(([label, n], i) => {
    const cx = 80 + colW * i + colW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b2024";
    ctx.font = "800 64px system-ui, -apple-system, sans-serif";
    ctx.fillText(String(n), cx, RECAP_LAYOUT.statBase);
    ctx.fillStyle = "#7a6a70";
    ctx.font = "600 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(label, cx, RECAP_LAYOUT.labelBase);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#7a6a70";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(recap.total ? `${recap.activeDays}일 동안 ${recap.total}개의 순간을 남겼어요` : "이 달의 첫 순간을 기다려요", W / 2, RECAP_LAYOUT.lineBase);
  ctx.textAlign = "left";

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/** 공유(되는 기기) 또는 내려받기. */
export async function shareOrDownload(blob: Blob, name: string): Promise<"shared" | "saved"> {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "우리의 한 달" });
    return "shared";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "saved";
}
