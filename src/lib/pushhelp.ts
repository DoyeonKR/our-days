/** 알림이 차단됐을 때 어느 브라우저 안내를 보일지(순수 — UA 문자열만 본다).
 *  'samsung' 삼성 인터넷 · 'ios' 아이폰·아이패드(홈 화면 앱) · 'other' 크롬·PC 등 주소창 자물쇠 경로. */
export type PushBrowser = "samsung" | "ios" | "other";
export function blockedPushBrowser(ua: string): PushBrowser {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile\//i.test(ua))) return "ios";
  return "other";
}
