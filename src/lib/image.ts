// 업로드 전 이미지 축소·압축(canvas). 폰 사진(수 MB) → 수십~수백 KB.
// WebP 지원 브라우저는 WebP(동일 화질에 ~25-35% 더 작음), 아니면 JPEG 폴백.

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

/** maxDim 이하로 축소 + WebP/JPEG 압축. 실패 시 원본 반환. */
export async function renderImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const type = webpSupported() ? "image/webp" : "image/jpeg";
    const ext = type === "image/webp" ? "webp" : "jpg";
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, type, quality),
    );
    if (!blob) return file;
    // 확장자 없는 파일명이면 base 가 빈 문자열이 돼 ".jpg" 같은 이름이 됨 → 폴백
    const base = file.name.replace(/\.[^.]+$/, "").trim() || "image";
    const name = base + "." + ext;
    return new File([blob], name, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** 하위호환 별칭 (기존 호출부: 일기장 사진 등). 이제 WebP 로 렌더됨. */
export async function resizeImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  return renderImage(file, maxDim, quality);
}
