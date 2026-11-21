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

/* ── 센서 그대로(4:3) 받기 — 2026-11-21 [사용자: "카메라가 줌인 된 것 같은 느낌이야 이유가 뭔지 확인하고 고쳐"] ──
 * 운영 기록(debug_logs 'cam_zoom')은 줌이 이미 최소(1배)였다 — 당겨 보이는 건 줌이 아니라 '잘라 내기'였다.
 * 예전엔 3:4 세로(720×960)를 달라고 했는데, 폰 센서는 4:3 이라 브라우저가 이 요청을 16:9 모드(1280×720)로 맞췄다.
 * 16:9 모드는 센서의 양옆(세로 화면 기준)을 잘라 낸 것이고, 그 위에서 렌더러가 다시 가운데 3:4 로 잘라(cropFrame34) 약 1.33배 당겨 보였다.
 * 이제 센서의 원래 비율(4:3 — 세로로 들면 3:4)을 달라고 하고, 실제로 받은 비율을 보고 16:9 면 한 번 더(640×480) 청한다.
 * resizeMode "none" — 크롬이 요청 크기에 맞추려고 영상을 잘라 내지(crop-and-scale) 않게. 모르는 브라우저는 무시한다. */

/** 청할 모양 — 센서 방향(가로) 기준 4:3. 앞의 것부터 */
export const CAMERA_FORMATS: readonly { width: number; height: number }[] = [{ width: 1280, height: 960 }, { width: 640, height: 480 }];

/** 받은 영상이 센서 그대로(4:3 · 3:4)인가 — 16:9 면 이미 잘린 것 */
export function isFullSensor(w: unknown, h: unknown): boolean {
  if (typeof w !== "number" || typeof h !== "number" || !(w > 0) || !(h > 0)) return false;
  const r = Math.max(w, h) / Math.min(w, h);
  return r > 1.28 && r < 1.4;
}

export function cameraConstraints(facing: string, f: { width: number; height: number }): MediaTrackConstraints {
  return { facingMode: facing, width: { ideal: f.width }, height: { ideal: f.height }, aspectRatio: { ideal: f.width / f.height }, resizeMode: "none", zoom: true } as MediaTrackConstraints;
}

type Gum = (c: MediaStreamConstraints) => Promise<MediaStream>;
/** 4:3 을 받을 때까지 CAMERA_FORMATS 를 차례로 — 다음 것을 열기 전에 앞의 스트림을 닫는다(아이폰은 카메라를 둘 못 연다).
 *  끝내 16:9 면 마지막 것을 쓴다. 첫 시도가 던지면 그대로 던진다(부르는 쪽이 느슨한 제약으로 다시 연다). */
export async function openWideCamera(gum: Gum, facing: string): Promise<{ stream: MediaStream; tried: number; w: number | null; h: number | null }> {
  let last: MediaStream | null = null, w: number | null = null, h: number | null = null;
  for (let i = 0; i < CAMERA_FORMATS.length; i++) {
    if (last) last.getTracks().forEach((t) => t.stop());
    let s: MediaStream;
    try {
      s = await gum({ video: cameraConstraints(facing, CAMERA_FORMATS[i]), audio: false });
    } catch (e) {
      if (i === 0) throw e;
      // 두 번째가 안 열리면 첫 모양으로 다시(앞에서 닫았다)
      s = await gum({ video: cameraConstraints(facing, CAMERA_FORMATS[0]), audio: false });
      const st0 = (s.getVideoTracks()[0]?.getSettings?.() ?? {}) as { width?: number; height?: number };
      return { stream: s, tried: i + 1, w: st0.width ?? null, h: st0.height ?? null };
    }
    const st = (s.getVideoTracks()[0]?.getSettings?.() ?? {}) as { width?: number; height?: number };
    w = st.width ?? null; h = st.height ?? null;
    last = s;
    if (isFullSensor(w, h) || w === null) return { stream: s, tried: i + 1, w, h };
  }
  return { stream: last!, tried: CAMERA_FORMATS.length, w, h };
}
