/* 수조 사진 모드(2026-11-13) — 순수 계산만 둔다(three · DOM 없음). 화면(Aquarium3D)과 엔진(scene.ts) · 테스트가 같은 식을 쓴다.
 *  - 필터: 후처리 마지막 그리기(post.ts FINAL_FRAG)가 톤 매핑 · sRGB 뒤 화면 색에 거는 값. 원본은 끈다(gradeOn 0 — 평소 화면과 한 픽셀도 안 다르다)
 *  - 카메라: 사진 모드에서만 넓혀 주는 돌리기 · 기울이기 · 확대 범위. 밖에서 볼 땐 앞유리 안으로 못 들어가게 거리를 묶는다
 *  - 찍기: 캔버스의 최대 2배로 한 장 — GPU 한계(최대 그림 크기)와 픽셀 예산 안에서
 *  - 카드: 사진 둘레 테 + 아래 글(우리 수조 · 날짜 · 두 사람 이름) · 물고기 이름표 자리 */

export type PhotoFilterId = "none" | "warm" | "deep" | "mono" | "film";
export const PHOTO_FILTERS: readonly { id: PhotoFilterId; label: string }[] = [
  { id: "none", label: "원본" },
  { id: "warm", label: "따뜻한 바다" },
  { id: "deep", label: "심해 푸른빛" },
  { id: "mono", label: "흑백" },
  { id: "film", label: "빛바랜 필름" },
];

/** 셰이더에 넘기는 값 — on 0 이면 아무것도 안 한다.
 *  saturation(0 흑백 ~ 1 그대로) · contrast(가운데 0.5 기준) · fade(검정을 들어 올림) · tint(밝은 곳에 곱하는 색) · shade(어두운 곳에 곱하는 색)
 *  vignette(가장자리 더 어둡게 0~0.4) · grain(알갱이 0~0.06 — 시계가 멈춰 있어 한 장에 고정된 무늬) */
export type PhotoGrade = { on: number; saturation: number; contrast: number; fade: number; tint: readonly [number, number, number]; shade: readonly [number, number, number]; vignette: number; grain: number };

const GRADES: Record<PhotoFilterId, PhotoGrade> = {
  none: { on: 0, saturation: 1, contrast: 1, fade: 0, tint: [1, 1, 1], shade: [1, 1, 1], vignette: 0, grain: 0 },
  warm: { on: 1, saturation: 1.08, contrast: 1.04, fade: 0.02, tint: [1.08, 1.0, 0.86], shade: [1.02, 0.97, 0.92], vignette: 0.12, grain: 0 },
  deep: { on: 1, saturation: 0.88, contrast: 1.08, fade: 0.0, tint: [0.88, 1.0, 1.1], shade: [0.78, 0.92, 1.12], vignette: 0.28, grain: 0 },
  mono: { on: 1, saturation: 0, contrast: 1.14, fade: 0.03, tint: [1, 1, 1], shade: [1, 1, 1], vignette: 0.22, grain: 0.035 },
  film: { on: 1, saturation: 0.78, contrast: 0.9, fade: 0.09, tint: [1.06, 1.02, 0.9], shade: [0.94, 1.02, 1.04], vignette: 0.2, grain: 0.05 },
};

export const isPhotoFilter = (id: string): id is PhotoFilterId => Object.prototype.hasOwnProperty.call(GRADES, id);
/** 모르는 id 는 원본 — 저장한 값이 옛 목록일 때도 깨지지 않게 */
export const photoGrade = (id: string): PhotoGrade => (isPhotoFilter(id) ? GRADES[id] : GRADES.none);

/** 화면 색 한 점(0~1)에 필터를 건 값 — 셰이더와 같은 식(자리에 따른 비네트 · 알갱이는 뺀다). 테스트 · 미리보기 칩 색에 쓴다 */
export function gradePixel(rgb: readonly [number, number, number], g: PhotoGrade): [number, number, number] {
  if (!g.on) return [rgb[0], rgb[1], rgb[2]];
  const c = (v: number) => Math.max(0, Math.min(1, v));
  const r0 = c(rgb[0]), g0 = c(rgb[1]), b0 = c(rgb[2]);
  const l = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;
  const t = l * l * (3 - 2 * l);
  return [r0, g0, b0].map((v, i) => {
    let x = l + (v - l) * g.saturation;
    x = (x - 0.5) * g.contrast + 0.5;
    x = x * (g.shade[i] + (g.tint[i] - g.shade[i]) * t);
    x = g.fade + x * (1 - g.fade);
    return c(x);
  }) as [number, number, number];
}

/** 어디서 보나 — 밖(수조 앞) · 터널 안 · 돔 안. 안에서는 확대를 시야각으로 한다(카메라가 걷는 자리는 그대로) */
export type PhotoView = "outside" | "tunnel" | "dome";
/** 사진 카메라 — angle(좌우 돌리기, 터널은 이 값 × 2.6 이 고개) · pitch(위아래) · zoom(1 그대로, 작을수록 가까이) · yaw(돔 둘러보기, 한 바퀴 넘어도 된다) */
export type PhotoCam = { angle: number; pitch: number; zoom: number; yaw: number };
type Range = readonly [number, number];
/** 평소(사진 모드 밖)의 끌기 범위는 scene.ts 의 angle ±0.4 · pitch −0.10 ~ 0.13. 사진에서만 조금 더 — 옆벽 바위가 화면을 덮기 전까지 */
export const PHOTO_BOUNDS: Record<PhotoView, { angle: Range; pitch: Range; zoom: Range }> = {
  outside: { angle: [-0.6, 0.6], pitch: [-0.12, 0.24], zoom: [0.5, 1.25] },
  tunnel: { angle: [-0.6, 0.6], pitch: [-0.1, 0.16], zoom: [0.55, 1.15] },
  dome: { angle: [-0.4, 0.4], pitch: [-0.1, 0.16], zoom: [0.55, 1.15] },
};
const clampTo = (v: number, [lo, hi]: Range, fallback: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);

/** 끌기 · 집기 · 막대로 바뀐 카메라를 범위 안으로. 숫자가 아니면(NaN) 기본값 */
export function clampPhotoCam(cam: PhotoCam, view: PhotoView): PhotoCam {
  const b = PHOTO_BOUNDS[view];
  const yaw = Number.isFinite(cam.yaw) ? cam.yaw : 0;
  return { angle: clampTo(cam.angle, b.angle, 0), pitch: clampTo(cam.pitch, b.pitch, 0), zoom: clampTo(cam.zoom, b.zoom, 1), yaw };
}

/** 밖에서 볼 때 카메라 거리(dist — 화면이 고른 거리 × 확대). 앞유리(z = 3·깊이) 앞에 여유(1.2)를 두고 멈춘다.
 *  물고기를 따라가는 중이면 이미 수조 안에 다가가 있으므로(평소 동작) 물고기와 2.4 보다 가까워지지만 않게 */
export function photoDistance(o: { dist: number; zoom: number; angle: number; deep: number; following: boolean }): number {
  const want = o.dist * (Number.isFinite(o.zoom) ? o.zoom : 1);
  if (o.following) return Math.max(2.4, want);
  const cos = Math.max(0.2, Math.cos(o.angle));
  return Math.max(want, (3 * Math.max(1, o.deep) + 1.2) / cos);
}

/** 두 손가락 거리가 바뀐 만큼 확대(벌리면 가까이 = zoom 이 작아진다) */
export function pinchZoom(startZoom: number, startGap: number, gap: number): number {
  if (!(startGap > 0) || !(gap > 0)) return startZoom;
  return startZoom * (startGap / gap);
}

/** 찍을 해상도 배율 — 지금 배율의 want 배(기본 2배)까지, GPU 최대 그림 크기 · 픽셀 예산(후처리 그림이 반정밀이라 픽셀당 약 17바이트) 안에서.
 *  지금 배율보다 낮추지는 않는다(이미 한계를 넘는 기기는 그대로) */
export function captureRatio(o: { cssW: number; cssH: number; ratio: number; maxSize: number; maxPixels?: number; want?: number }): number {
  const { cssW, cssH, ratio } = o;
  if (!(cssW > 0) || !(cssH > 0) || !(ratio > 0)) return Math.max(0.5, ratio || 1);
  const want = ratio * (o.want ?? 2);
  const bySize = Math.max(1, o.maxSize) / Math.max(cssW, cssH);
  const byPixels = Math.sqrt((o.maxPixels ?? 3_000_000) / (cssW * cssH));
  const r = Math.min(want, bySize, byPixels);
  return Math.max(ratio, Math.floor(r * 100) / 100);
}

/** 카드 글 — 제목 · 날짜와 이름 한 줄. 이름은 0 ~ 2명(혼자 섬 · 상대 이름을 모르는 낚시 화면에선 하나 또는 없음) */
export function photoCaption(dateKey: string, names: readonly (string | null | undefined)[] = []): { title: string; sub: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  const date = m ? `${m[1]}.${m[2]}.${m[3]}` : "";
  const clean = [...new Set(names.map((n) => (n ?? "").replace(/\s+/g, " ").trim().slice(0, 12)).filter(Boolean))].slice(0, 2);
  const who = clean.join(" & ");
  return { title: "우리 수조", sub: [date, who].filter(Boolean).join(" · ") };
}

/** 파일 이름 — 한국 시각으로(같은 날 여러 장이어도 겹치지 않게 초까지) */
export function photoFileName(now: number): string {
  const d = new Date(now + 9 * 3600_000).toISOString();
  return `haru-aquarium-${d.slice(0, 10).replace(/-/g, "")}-${d.slice(11, 19).replace(/:/g, "")}.jpg`;
}

export type Box = { x: number; y: number; w: number; h: number };
/** 공유 카드 자리 — 사진(w × h 픽셀) 둘레에 테, 아래에 글 두 줄. 글 크기는 사진 폭에 비례(작은 사진에서도 읽히게 바닥 18 · 13) */
export type CardLayout = { width: number; height: number; photo: Box; title: { x: number; y: number; size: number }; sub: { x: number; y: number; size: number }; radius: number };
export function photoCardLayout(w: number, h: number): CardLayout {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const pad = Math.max(12, Math.round(W * 0.045));
  const titleSize = Math.max(18, Math.round(W * 0.052));
  const subSize = Math.max(13, Math.round(W * 0.034));
  const gap = Math.round(titleSize * 0.45);
  // 글 칸 — 사진 아래 여백 · 제목 · 사이 · 이름 줄 · 아래 여백
  const capH = Math.round(pad * 0.9 + titleSize + gap + subSize * 1.3 + pad);
  const photo = { x: pad, y: pad, w: W, h: H };
  const top = pad + H + Math.round(pad * 0.9);
  return {
    width: W + pad * 2,
    height: pad + H + capH,
    photo,
    title: { x: pad, y: top + titleSize, size: titleSize },
    sub: { x: pad, y: top + titleSize + gap + subSize, size: subSize },
    radius: Math.round(pad * 0.6),
  };
}

/** 물고기 이름표 자리 — 화면에 투영한 점(x, y 픽셀 · 가까울수록 작은 depth)마다 이름 상자를 몸 위에 놓는다.
 *  가까운 물고기부터 놓고, 이미 놓은 상자와 겹치면 아래 · 오른쪽 · 왼쪽 위로 비켜 보고, 다 막히면 뺀다. 상자는 화면 밖으로 안 나간다 */
export type LabelPoint = { id: number; x: number; y: number; depth: number; text: string };
export type PlacedLabel = Box & { id: number; text: string };
export function placeLabels(points: readonly LabelPoint[], width: number, height: number, o: { font: number; margin?: number; max?: number }): PlacedLabel[] {
  const font = Math.max(1, o.font), pad = Math.round(font * 0.45), h = Math.round(font * 1.5), margin = o.margin ?? Math.round(font * 0.5);
  const out: PlacedLabel[] = [];
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const sorted = [...points].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height && p.text.trim()).sort((a, b) => a.depth - b.depth);
  for (const p of sorted) {
    if (out.length >= (o.max ?? 12)) break;
    const text = p.text.trim().slice(0, 14);
    // 한글은 글자 폭 ≈ 글자 크기, 영숫자는 그 절반 남짓
    const tw = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) < 256 ? font * 0.6 : font), 0);
    const w = Math.round(tw + pad * 2);
    if (w > width - margin * 2) continue;
    const tries: [number, number][] = [[p.x - w / 2, p.y - h - font * 0.6], [p.x - w / 2, p.y + font * 0.6], [p.x + font * 0.6, p.y - h / 2], [p.x - w - font * 0.6, p.y - h / 2]];
    for (const [tx, ty] of tries) {
      const box = { x: Math.round(Math.max(margin, Math.min(width - margin - w, tx))), y: Math.round(Math.max(margin, Math.min(height - margin - h, ty))), w, h };
      if (out.some((q) => hit(q, box))) continue;
      out.push({ ...box, id: p.id, text });
      break;
    }
  }
  return out;
}
