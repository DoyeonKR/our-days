/* 3초 로그 영상 보관 기간 [2026-09-24]
 *
 * 영상 한 편 ≈ 0.5MB. 둘이 하루 두 번 찍으면 1년에 약 0.76GB 라 무료 플랜 저장 공간(1GB)을 사진과
 * 나눠 쓰면 1년 안팎에 찬다. 그래서 90일이 지난 로그는 **영상만** 정리하고 글·이모지·날짜·댓글은 남긴다
 * (로그 행이 그대로라 연속 기록도 안 끊긴다).
 *
 * 정리는 서버가 한다 — migrations/20260924010000_log_video_retention.sql 의 expire_log_videos 를
 * daily-reminders 가 매 실행마다 조금씩 부른다. 그쪽 숫자와 여기 숫자가 같아야 화면 안내가 거짓말이 안 된다
 * (logretention.test 가 맞춰 본다). */

export const LOG_VIDEO_KEEP_DAYS = 90;

/** 보관 기간이 지나 영상만 정리된 로그인가.
 *  DB 제약상 로그는 '영상 또는 글' 중 하나가 꼭 있어서(clogs_content_check), 둘 다 없으면 영상이 정리된 것이다.
 *  (글과 영상이 같이 있던 로그는 정리 뒤 글 로그와 똑같이 보인다 — 그걸로 충분하다.) */
export function logVideoExpired(log: { video_path: string | null; body: string | null }): boolean {
  return !log.video_path && !(log.body && log.body.trim());
}
