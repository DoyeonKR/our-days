// 3초 영상 로그 녹화 설정 (순수 — 테스트 용이).
// iOS Safari 는 mp4(H.264), 안드로이드 Chrome/삼성인터넷은 mp4 지원 시 mp4, 아니면 webm.
// (mp4 우선: iPhone↔Android 커플 간 상호 재생 호환이 가장 넓음. webm 재생은 iOS 16.4+.)

export const LOG_VIDEO_MS = 3000; // 녹화 길이(3초 자동 종료)
export const LOG_VIDEO_MAX_BYTES = 25 * 1024 * 1024; // 폴백(카메라 앱) 상한 — 기기 기본 화질 5초도 통과(버킷 제한과 동일)
export const LOG_VIDEO_BPS = 800_000; // 비트레이트(3초 ≈ 0.3MB) — 실측 평균 522KB → 스토리지 절감(작은 화면 체감 동일)
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

export type LogVideoExt = "mp4" | "webm" | "mov";

/** MIME → 저장 확장자.
 *  아이폰 카메라 앱 폴백은 video/quicktime(.mov, HEVC)이다. 예전엔 mp4 가 아니면 전부 webm 으로 붙여
 *  .mov 내용이 .webm 이름으로 올라갔다(받는 쪽 브라우저가 확장자로 형식을 짐작하다 재생을 포기한다). */
export function extForMime(mime: string): LogVideoExt {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (base === "video/mp4") return "mp4";
  if (base === "video/quicktime") return "mov";
  return "webm";
}

/** 폴백 영상을 다시 굽지 못해 원본을 올릴 때 허용하는 형식 — 버킷 allowed_mime_types 와 같은 셋. */
export function rawFallbackAllowed(mime: string): boolean {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  return base === "video/mp4" || base === "video/webm" || base === "video/quicktime";
}
