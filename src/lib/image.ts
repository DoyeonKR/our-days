// 업로드 전 이미지 축소·압축(canvas). 폰 사진(수 MB) → 수십~수백 KB.
// WebP 지원 브라우저는 WebP(동일 화질에 ~25-35% 더 작음), 아니면 JPEG 폴백.
// ⚠ iOS 사파리는 캔버스로 WebP 를 못 만든다(toDataURL 이 PNG 를 돌려준다) — 그래서 아이폰에서 올린 사진은 JPEG 다.
//
// 사진첩 업로드(preparePhoto)는 2026-11-06 리뷰로 다시 짰다:
//  · 원본을 그대로 올리는 길을 없앴다 — 디코드에 실패하면 원본(최대 25MB, EXIF 의 GPS 그대로)을 원본 · 썸네일 두 칸에
//    올리던 폴백이 있었다. 이제 못 열면 한국어로 이유를 말하고 그 한 장만 건너뛴다(다시 그려야 EXIF · GPS 가 사라진다).
//  · 한 번만 디코드한다 — 1280 · 480 을 따로 디코드하면 48MP 사진 하나에 약 190MB 비트맵이 두 장 동시에 떠서 iOS 탭이 죽었다.
//  · 찍은 시각(EXIF DateTimeOriginal)을 다시 그리기 **전에** 읽는다 — 캔버스를 거치면 EXIF 가 없어진다.
//  · HEIC 는 디코드할 수 있는 브라우저(사파리)에서만 받고, 못 여는 곳에선 아이폰 설정을 안내한다.
//  · GIF 는 움직임을 지키려 원본을 쓰되 썸네일은 첫 장면 정지 그림으로 만든다(GIF 에는 EXIF 가 없다).

/* ── 순수 로직(노드 테스트 대상) ───────────────────────────────────────── */

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "unsupported";

/** 파일 형식 판별. 안드로이드 갤러리는 type 이 비어서 오는 일이 있어 확장자도 본다. */
export function classifyImage(type: string, name: string): ImageKind {
  const t = (type || "").toLowerCase();
  const ext = (/\.([a-z0-9]+)$/i.exec(name || "")?.[1] ?? "").toLowerCase();
  if (t === "image/heic" || t === "image/heif" || t === "image/heic-sequence" || t === "image/heif-sequence" || ext === "heic" || ext === "heif") return "heic";
  if (t === "image/gif" || (!t && ext === "gif")) return "gif";
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/pjpeg" || (!t && (ext === "jpg" || ext === "jpeg"))) return "jpeg";
  if (t === "image/png" || (!t && ext === "png")) return "png";
  if (t === "image/webp" || (!t && ext === "webp")) return "webp";
  return "unsupported";
}

/** 화면에 띄우는 문구 — 버킷의 영어 원문("mime type … not supported")이 그대로 보이던 것을 대신한다. */
export const PHOTO_ERRORS = {
  unsupported: "사진 파일만 올릴 수 있어요(JPG · PNG · WebP · GIF · HEIC).",
  heic: "이 브라우저는 아이폰 HEIC 사진을 열지 못해요. 아이폰 설정 › 카메라 › 포맷 › '높은 호환성'으로 바꾸거나, 사파리에서 올려 주세요.",
  decode: "이 사진을 열지 못했어요. 파일이 깨졌거나 너무 커요.",
  tooBig: "사진이 너무 커요(50MB 까지).",
  gifTooBig: "움직이는 GIF 는 10MB 까지 올릴 수 있어요.",
  encode: "사진을 줄이는 중에 문제가 생겼어요. 다시 시도해 주세요.",
} as const;

export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_GIF_BYTES = 10 * 1024 * 1024;
export const FULL_DIM = 1280;
export const THUMB_DIM = 480;

/** 긴 변을 max 이하로(키우지는 않는다). */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

const EXIF_HEAD = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

/** 바이트 앞부분에서 TIFF 머리(Exif 블록)를 찾는다. JPEG APP1 · HEIC Exif 항목 모두 "Exif\0\0" 뒤에 TIFF 가 온다. */
function findTiff(b: Uint8Array): number {
  const end = b.length - 14;
  for (let i = 0; i < end; i++) {
    if (b[i] !== 0x45) continue;
    let ok = true;
    for (let k = 1; k < 6; k++) if (b[i + k] !== EXIF_HEAD[k]) { ok = false; break; }
    if (!ok) continue;
    const t = i + 6;
    if ((b[t] === 0x49 && b[t + 1] === 0x49 && b[t + 2] === 0x2a && b[t + 3] === 0) ||
        (b[t] === 0x4d && b[t + 1] === 0x4d && b[t + 2] === 0 && b[t + 3] === 0x2a)) return t;
  }
  return -1;
}

/** EXIF 의 찍은 시각 문자열 둘(DateTimeOriginal · OffsetTimeOriginal). 없거나 깨졌으면 null — 절대 던지지 않는다. */
export function readExifDate(bytes: Uint8Array): { dateTime: string | null; offset: string | null } {
  const none = { dateTime: null, offset: null };
  try {
    const t = findTiff(bytes);
    if (t < 0) return none;
    const le = bytes[t] === 0x49;
    const u16 = (o: number) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
    const u32 = (o: number) =>
      (le ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) + bytes[o + 3] * 0x1000000
          : ((bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) + bytes[o] * 0x1000000);
    const inRange = (o: number, n: number) => o >= 0 && o + n <= bytes.length;
    const ascii = (entry: number): string | null => {
      const count = u32(entry + 4);
      if (count < 2 || count > 64) return null;
      const off = count <= 4 ? entry + 8 : t + u32(entry + 8);
      if (!inRange(off, count)) return null;
      let s = "";
      for (let i = 0; i < count; i++) {
        const c = bytes[off + i];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s.trim() || null;
    };
    const ifd = (start: number, want: number[]): Map<number, number> => {
      const found = new Map<number, number>();
      if (!inRange(start, 2)) return found;
      const n = u16(start);
      if (n > 512) return found;
      for (let i = 0; i < n; i++) {
        const e = start + 2 + i * 12;
        if (!inRange(e, 12)) break;
        const tag = u16(e);
        if (want.includes(tag)) found.set(tag, e);
      }
      return found;
    };
    const ifd0 = ifd(t + u32(t + 4), [0x8769]);
    const exifPtr = ifd0.get(0x8769);
    if (exifPtr === undefined) return none;
    const sub = ifd(t + u32(exifPtr + 8), [0x9003, 0x9004, 0x9011, 0x9012]);
    const dto = sub.has(0x9003) ? ascii(sub.get(0x9003)!) : null;
    const dtd = sub.has(0x9004) ? ascii(sub.get(0x9004)!) : null;
    const offO = sub.has(0x9011) ? ascii(sub.get(0x9011)!) : null;
    const offD = sub.has(0x9012) ? ascii(sub.get(0x9012)!) : null;
    return { dateTime: dto ?? dtd, offset: dto ? offO : offD };
  } catch {
    return none;
  }
}

/** "YYYY:MM:DD HH:MM:SS" + 선택 오프셋 → UTC ISO. 오프셋이 없으면 KST(+09:00)로 본다 — 앱의 하루는 KST 다. */
export function exifToIso(dateTime: string | null, offset: string | null): string | null {
  if (!dateTime) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(dateTime);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  let offMin = 9 * 60;
  const om = offset ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (om) offMin = (om[1] === "-" ? -1 : 1) * (Number(om[2]) * 60 + Number(om[3]));
  const ms = Date.UTC(y, mo - 1, d, h, mi, s) - offMin * 60_000;
  const back = new Date(ms + offMin * 60_000);
  if (back.getUTCDate() !== d) return null; // 2월 31일 같은 값
  return new Date(ms).toISOString();
}

/** 찍은 시각 고르기 — EXIF → 파일 수정 시각 → 없음(null = '모름', 화면은 올린 시각으로 본다).
 *  수정 시각이 지금과 2분 안이면 '방금 만든 사본'(공유 · 다운로드)이라 찍은 시각이 아니다. 미래 값은 버린다. */
export function pickTakenAt(exifIso: string | null, lastModified: number | null | undefined, now: number): string | null {
  const DAY = 86_400_000;
  const floor = Date.UTC(1990, 0, 1);
  if (exifIso) {
    const t = Date.parse(exifIso);
    if (Number.isFinite(t) && t >= floor && t <= now + DAY) return new Date(t).toISOString();
  }
  if (typeof lastModified === "number" && Number.isFinite(lastModified) && lastModified >= floor &&
      lastModified <= now + DAY && Math.abs(now - lastModified) > 120_000) {
    return new Date(lastModified).toISOString();
  }
  return null;
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ── 브라우저 전용 ─────────────────────────────────────────────────────── */

let _webpOk: boolean | null = null;
function webpSupported(): boolean {
  if (_webpOk !== null) return _webpOk;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpOk = false;
  }
  return _webpOk;
}

/** 사진첩 업로드에서 한 장을 못 올린 이유 — message 는 그대로 화면에 띄워도 되는 한국어다. */
export class PhotoPrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoPrepError";
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
  }
  // createImageBitmap 이 없는 옛 사파리 — img 로 디코드(방향은 브라우저가 EXIF 대로 돌려 준다)
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** iOS 는 캔버스 메모리를 늦게 돌려준다 — 크기를 0 으로 줄여 바로 놓아 준다. */
function release(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

async function encode(c: HTMLCanvasElement, quality: number, base: string): Promise<File> {
  const type = webpSupported() ? "image/webp" : "image/jpeg";
  const blob: Blob | null = await new Promise((res) => c.toBlob(res, type, quality));
  if (!blob || !blob.size) throw new PhotoPrepError(PHOTO_ERRORS.encode);
  const real = blob.type || type;
  const ext = real === "image/webp" ? "webp" : real === "image/png" ? "png" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: real });
}

function draw(src: CanvasImageSource, w: number, h: number, jpegBackground: boolean): HTMLCanvasElement {
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d");
  if (!ctx) throw new PhotoPrepError(PHOTO_ERRORS.encode);
  // JPEG 폴백은 알파가 없어 투명 픽셀이 **검정**으로 눌린다 — 흰 바탕을 먼저 깐다
  if (jpegBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

async function sha256Hex(f: Blob): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null; // http 개발 서버 등 보안 컨텍스트가 아닐 때
    return toHex(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()));
  } catch {
    return null;
  }
}

export type PreparedPhoto = {
  full: File;
  thumb: File;
  takenAt: string | null;
  /** 올릴 원본(다시 그린 바이트)의 sha256 — 같은 사진 두 번 올리기 경고용. 보안 컨텍스트가 아니면 null. */
  sha256: string | null;
};

/** 사진첩 한 장 준비 — 실패하면 PhotoPrepError(한국어 문구). 원본 파일을 그대로 돌려주는 길은 없다(GIF 원본만 예외). */
export async function preparePhoto(file: File, now = Date.now()): Promise<PreparedPhoto> {
  const kind = classifyImage(file.type, file.name);
  if (kind === "unsupported") throw new PhotoPrepError(PHOTO_ERRORS.unsupported);
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoPrepError(PHOTO_ERRORS.tooBig);
  if (kind === "gif" && file.size > MAX_GIF_BYTES) throw new PhotoPrepError(PHOTO_ERRORS.gifTooBig);
  let exifIso: string | null = null;
  if (kind === "jpeg" || kind === "heic" || kind === "webp" || kind === "png") {
    try {
      const head = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
      const { dateTime, offset } = readExifDate(head);
      exifIso = exifToIso(dateTime, offset);
    } catch {
      /* 찍은 시각은 덤 — 못 읽어도 올린다 */
    }
  }
  const takenAt = pickTakenAt(exifIso, file.lastModified, now);
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "image";
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new PhotoPrepError(kind === "heic" ? PHOTO_ERRORS.heic : PHOTO_ERRORS.decode);
  }
  const jpeg = !webpSupported();
  let fullCanvas: HTMLCanvasElement | null = null;
  let thumbCanvas: HTMLCanvasElement | null = null;
  try {
    const fullSize = fitSize(decoded.width, decoded.height, FULL_DIM);
    // 한 번만 디코드한 뒤 1280 캔버스로 줄이고 큰 비트맵은 곧바로 놓아 준다 — 썸네일은 그 캔버스에서 만든다.
    fullCanvas = draw(decoded.source, fullSize.w, fullSize.h, jpeg);
    decoded.close();
    const thumbSize = fitSize(fullSize.w, fullSize.h, THUMB_DIM);
    thumbCanvas = draw(fullCanvas, thumbSize.w, thumbSize.h, jpeg);
    const thumb = await encode(thumbCanvas, 0.7, `${base}.thumb`);
    // GIF 는 움직임을 지키려 원본을 그대로(EXIF 가 없는 형식) — 썸네일만 첫 장면 정지 그림
    const full = kind === "gif" ? file : await encode(fullCanvas, 0.72, base);
    const sha256 = await sha256Hex(full);
    return { full, thumb, takenAt, sha256 };
  } catch (e) {
    if (e instanceof PhotoPrepError) throw e;
    throw new PhotoPrepError(PHOTO_ERRORS.decode);
  } finally {
    decoded.close();
    if (fullCanvas) release(fullCanvas);
    if (thumbCanvas) release(thumbCanvas);
  }
}

/** maxDim 이하로 축소 + WebP/JPEG 압축. 실패 시 원본 반환 — **일기장 사진 경로 전용**(사진첩은 preparePhoto).
 *  ⚠ 원본 폴백은 EXIF(GPS 포함)를 그대로 올린다. 일기 쪽도 preparePhoto 처럼 실패를 알리는 편이 맞다(리뷰 메모). */
export async function renderImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  // 움직이는 GIF 는 캔버스 재인코딩이 첫 컷 정지 이미지로 평탄화한다 — 원본 그대로 업로드
  if (file.type === "image/gif") return file;
  try {
    const decoded = await decode(file);
    const { w, h } = fitSize(decoded.width, decoded.height, maxDim);
    const jpeg = !webpSupported();
    const canvas = draw(decoded.source, w, h, jpeg);
    decoded.close();
    const type = jpeg ? "image/jpeg" : "image/webp";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, quality));
    release(canvas);
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "").trim() || "image";
    return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** 하위호환 별칭 (기존 호출부: 일기장 사진 등). 1280/0.72 — 사진첩과 동일 기준. */
export async function resizeImage(
  file: File,
  maxDim = 1280,
  quality = 0.72,
): Promise<File> {
  return renderImage(file, maxDim, quality);
}
