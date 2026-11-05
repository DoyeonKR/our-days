/* 3초 로그 영상 굽기(브라우저 전용) [2026-11-06]
 *
 * - posterFromBlob: 찍은 영상의 첫 장면을 WebP(안 되면 JPEG) 한 장으로. 목록 타일이 영상 대신 이 그림을 먼저 그린다 —
 *   iOS 저전력 · 느린 망에서 preload=metadata 영상은 첫 장면을 안 그려 검은 칸으로 남았다.
 * - composeClips: 여러 클립을 캔버스 + MediaRecorder 로 한 편에(한 달 필름 · 나란히). 서버로 보내지 않는다.
 *   iOS 메모리 때문에 클립은 **한 번에 한 칸씩**만 열고(나란히는 둘) 다 쓰면 바로 놓는다, 녹화는 1초 조각으로 받는다.
 * - shareOrDownload: 파일 공유(Web Share files)가 되면 공유 시트, 아니면 내려받기. */
import { coverRect } from "./logreview.ts";
import { pickVideoMime } from "./logvideo.ts";

const POSTER_W = 360, POSTER_H = 480;

function waitFor(video: HTMLVideoElement, event: "loadeddata" | "seeked", ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener("error", bad); signal?.removeEventListener("abort", abort); fn(); };
    const ok = () => done(resolve);
    const bad = () => done(() => reject(new Error("영상을 읽을 수 없어요.")));
    const abort = () => done(() => reject(new DOMException("취소됨", "AbortError")));
    const timer = setTimeout(() => done(() => reject(new Error("영상을 읽는 시간이 너무 오래 걸려요."))), ms);
    video.addEventListener(event, ok, { once: true });
    video.addEventListener("error", bad, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function releaseVideo(v: HTMLVideoElement): void {
  try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* noop */ }
}

/** 첫 장면 한 장 — 실패하면 null(포스터 없이도 영상은 올라간다). */
export async function posterFromBlob(blob: Blob): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  try {
    const loaded = waitFor(v, "loadeddata", 8000);
    v.src = url;
    await loaded;
    const seeked = waitFor(v, "seeked", 4000);
    v.currentTime = Math.min(0.1, Number.isFinite(v.duration) ? v.duration / 2 : 0.1);
    await seeked.catch(() => {});
    if (!v.videoWidth || !v.videoHeight) return null;
    const c = document.createElement("canvas");
    c.width = POSTER_W; c.height = POSTER_H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const [sx, sy, sw, sh] = coverRect(v.videoWidth, v.videoHeight, POSTER_W, POSTER_H);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, POSTER_W, POSTER_H);
    const as = (type: string) => new Promise<Blob | null>((r) => c.toBlob((b) => r(b), type, 0.72));
    // 사파리는 WebP 인코딩을 못 해 PNG 를 돌려준다(크다) — 그땐 JPEG.
    const webp = await as("image/webp");
    if (webp && webp.type === "image/webp") return webp;
    return await as("image/jpeg");
  } catch {
    return null;
  } finally {
    releaseVideo(v);
    URL.revokeObjectURL(url);
  }
}

export type ComposeSegment = { sources: string[] };
/** 클립들을 한 편으로. sources 가 둘이면 좌우 나란히(칸마다 cover). */
export async function composeClips(
  segments: readonly ComposeSegment[],
  opts: { width: number; height: number; perClipMs: number; signal: AbortSignal; onProgress?: (done: number, total: number) => void },
): Promise<{ blob: Blob; mime: string }> {
  if (typeof MediaRecorder === "undefined") throw new Error("이 브라우저는 영상 만들기를 지원하지 않아요.");
  const canvas = document.createElement("canvas");
  canvas.width = opts.width; canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") throw new Error("이 브라우저는 영상 만들기를 지원하지 않아요.");
  ctx.fillStyle = "#0f0a12"; ctx.fillRect(0, 0, opts.width, opts.height);
  const stream = canvas.captureStream(24);
  const mime = pickVideoMime((m) => MediaRecorder.isTypeSupported(m));
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_000_000 }) : new MediaRecorder(stream);
  const actual = rec.mimeType || mime || "video/webm";
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  const canPause = typeof rec.pause === "function" && typeof rec.resume === "function";
  rec.start(1000);
  try {
    for (let i = 0; i < segments.length; i += 1) {
      if (opts.signal.aborted) throw new DOMException("취소됨", "AbortError");
      const seg = segments[i];
      // 다음 칸을 여는 동안은 녹화를 멈춘다(로딩 중 검은 화면이 필름에 끼지 않게).
      if (canPause && rec.state === "recording") rec.pause();
      const videos = seg.sources.map(() => {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous"; // 서명 URL 은 다른 출처 — 없으면 캔버스가 오염돼 녹화가 빈다
        v.muted = true; v.playsInline = true; v.preload = "auto";
        return v;
      });
      try {
        await Promise.all(videos.map((v, k) => { const p = waitFor(v, "loadeddata", 15000, opts.signal); v.src = seg.sources[k]; return p; }));
        await Promise.all(videos.map((v) => v.play().catch(() => {})));
        if (canPause && rec.state === "paused") rec.resume();
        const cellW = opts.width / videos.length;
        const t0 = performance.now();
        await new Promise<void>((resolve, reject) => {
          const tick = setInterval(() => {
            if (opts.signal.aborted) { clearInterval(tick); reject(new DOMException("취소됨", "AbortError")); return; }
            videos.forEach((v, k) => {
              if (v.readyState < 2 || !v.videoWidth) return;
              const [sx, sy, sw, sh] = coverRect(v.videoWidth, v.videoHeight, cellW, opts.height);
              ctx.drawImage(v, sx, sy, sw, sh, k * cellW, 0, cellW, opts.height);
            });
            const ended = videos.every((v) => v.ended);
            if (performance.now() - t0 >= opts.perClipMs || ended) { clearInterval(tick); resolve(); }
          }, 1000 / 24);
        });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") throw e;
        // 한 칸이 안 열리면(이미 정리된 영상 등) 그 칸만 건너뛴다.
      } finally {
        videos.forEach(releaseVideo);
      }
      opts.onProgress?.(i + 1, segments.length);
    }
  } finally {
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }
  if (opts.signal.aborted) throw new DOMException("취소됨", "AbortError");
  const blob = new Blob(chunks, { type: actual });
  if (!blob.size) throw new Error("영상을 만들지 못했어요. 화면을 켜 둔 채 다시 시도해 주세요.");
  return { blob, mime: actual };
}

/** 공유(파일)가 되면 공유 시트, 아니면 내려받기. 공유를 사용자가 취소하면 아무것도 안 한다. */
export async function shareOrDownload(blob: Blob, name: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
