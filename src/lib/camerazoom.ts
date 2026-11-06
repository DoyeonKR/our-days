/* 카메라를 가장 넓게(최소 줌) — 2026-11-06 [사용자: "카메라가 기본으로 줌 되있는 것 같아 최소줌으로 해주고"]
 * 브라우저 · 웹뷰는 줌을 정하지 않으면 기기 기본값을 쓴다. 기기에 따라 1배보다 당겨진 채 열리고, 초광각(0.6배 등)이
 * 있어도 쓰지 않는다. 줌 범위를 알려 주는 브라우저(안드로이드 크롬 · 웹뷰, iOS 17+ 사파리)면 범위의 맨 아래로 맞춘다.
 * 범위를 모르면(옛 브라우저) 아무것도 안 한다 — 지금과 같다. 실패해도 촬영은 그대로 된다. */

type ZoomRange = { min?: unknown; max?: unknown };
type ZoomTrack = {
  getCapabilities?: () => { zoom?: ZoomRange } & Record<string, unknown>;
  getSettings?: () => { zoom?: unknown } & Record<string, unknown>;
  applyConstraints?: (c: MediaTrackConstraints) => Promise<void>;
};

/** 맞출 줌 값 — 범위를 모르거나 이미 최소면 null */
export function widestZoom(caps: { zoom?: ZoomRange } | undefined, current: unknown): number | null {
  const min = caps?.zoom?.min;
  if (typeof min !== "number" || !Number.isFinite(min)) return null;
  if (typeof current === "number" && current <= min + 1e-3) return null;
  return min;
}

/** 스트림의 영상 트랙을 가장 넓게. 결과(맞춘 값 · 못 맞춤)를 돌려준다 — 진단 기록용 */
export async function zoomOutFully(stream: { getVideoTracks: () => unknown[] } | null | undefined): Promise<number | null> {
  const track = stream?.getVideoTracks?.()[0] as ZoomTrack | undefined;
  if (!track?.getCapabilities || !track.applyConstraints) return null;
  let caps: { zoom?: ZoomRange } | undefined;
  try {
    caps = track.getCapabilities();
  } catch {
    return null;
  }
  const want = widestZoom(caps, track.getSettings?.().zoom);
  if (want === null) return null;
  try {
    await track.applyConstraints({ advanced: [{ zoom: want } as MediaTrackConstraintSet] });
    return want;
  } catch {
    return null;
  }
}

/** 진단용 — 이 카메라가 알려 준 줌 범위와 지금 값(모르면 null). 실기기에서 줌이 듣는지 debug_logs 로 본다. */
export function zoomInfo(stream: { getVideoTracks: () => unknown[] } | null | undefined): { min: number | null; max: number | null; now: number | null; facing: string | null } {
  const track = stream?.getVideoTracks?.()[0] as ZoomTrack | undefined;
  let caps: { zoom?: ZoomRange } | undefined, set: Record<string, unknown> | undefined;
  try {
    caps = track?.getCapabilities?.();
    set = track?.getSettings?.();
  } catch {
    /* 옛 브라우저 */
  }
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { min: n(caps?.zoom?.min), max: n(caps?.zoom?.max), now: n(set?.zoom), facing: typeof set?.facingMode === "string" ? set.facingMode : null };
}
