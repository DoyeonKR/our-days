// 3초 영상 로그 녹화 설정 (순수 — 테스트 용이).
// iOS Safari 는 mp4(H.264), 안드로이드 Chrome/삼성인터넷은 mp4 지원 시 mp4, 아니면 webm.
// (mp4 우선: iPhone↔Android 커플 간 상호 재생 호환이 가장 넓음. webm 재생은 iOS 16.4+.)

export const LOG_VIDEO_MS = 3000; // 녹화 길이(3초 자동 종료)
export const LOG_VIDEO_MAX_BYTES = 6 * 1024 * 1024; // 업로드 상한(안전 가드)
export const LOG_VIDEO_BPS = 1_200_000; // 비트레이트(3초 ≈ 0.45MB)
export const LOG_VIDEO_FALLBACK_MAX_S = 5; // 파일 폴백 허용 길이(3초 + 여유)

/** 지원되는 녹화 MIME 선택(우선순위 순). 없으면 null(파일 폴백). */
export function pickVideoMime(
  isSupported: (m: string) => boolean,
): string | null {
  // 무음(비디오 전용) 녹화 — 셋로그처럼 소리 없이. opus 등 오디오 코덱 불필요.
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    try {
      if (isSupported(m)) return m;
    } catch {
      /* noop */
    }
  }
  return null;
}

/** MIME → 저장 확장자. */
export function extForMime(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}
