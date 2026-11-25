// 혼자하기 — 가입 없이 시작하기 (2026-11-25)
//
// [사용자: "혼자하기 버튼 만들어서 그 버튼누르면 그냥 계정 가입없이 … 진행되도록 … 나중에 커플 연결 할때만 가입하라고"]
// 로그인 화면의 '혼자하기'는 **사용자가 직접 눌렀을 때만** 익명 계정을 만든다(lib/auth startGuest).
// 2026-11-05 에 걷어낸 것은 '세션이 풀리면 몰래 익명 계정을 새로 만드는' 길이다 — 그건 그대로 막혀 있다(couple.ts ensureAnonAuth).
// 데이터는 서버에 이메일 계정과 똑같이 저장되고, 가입하면 같은 계정(uid)에 이메일 · 비밀번호만 붙는다(upgradeGuest).
//
// 이 파일의 표식은 '이 기기에서 가입 없이 시작한 적이 있다'를 기억한다. 쓰임은 둘:
//  ① 세션이 풀려 로그인 화면으로 돌아왔을 때 "같은 이메일로 들어오면 그대로"(거짓 — 이메일이 없다) 대신 사실대로 말한다.
//  ② 다시 '혼자하기'를 누르면 새 빈 공간이 생긴다는 것을 먼저 묻는다.
// 가입이 끝나면 지운다. 저장소가 통째로 지워지면 표식도 같이 사라진다(그때는 알 길이 없다).

export const GUEST_MARK_KEY = "ourdays:guest-started";

export const GUEST_LOST_MESSAGE =
  "가입 없이 쓰던 이 기기의 로그인이 풀렸어요. 가입 전 기록은 다시 열 수 없어요.";

/** 가입 없이 쓰는 동안 화면 곳곳에 다는 한 줄 — 무엇을 잃을 수 있는지. */
export const GUEST_RISK_LINE = "가입 전에는 이 기기에서만 열려요. 앱 데이터를 지우거나 폰을 바꾸면 기록을 다시 열 수 없어요.";

export function markGuest(): void {
  try {
    localStorage.setItem(GUEST_MARK_KEY, String(Date.now()));
  } catch {
    /* 저장소가 막힌 기기 — 표식 없이도 동작한다 */
  }
}

export function clearGuestMark(): void {
  try {
    localStorage.removeItem(GUEST_MARK_KEY);
  } catch {
    /* noop */
  }
}

export function hadGuest(): boolean {
  try {
    return !!localStorage.getItem(GUEST_MARK_KEY);
  } catch {
    return false;
  }
}

/** 가입(이메일 붙이기) 오류 문구 — 가입 없이 쓰는 사람에게 "로그인해 주세요"는 지금 기록을 버리라는 말이 된다. */
export function guestUpgradeError(message: string): string {
  if (message.includes("이미 가입된 이메일")) {
    return "이미 가입된 이메일이에요. 다른 이메일로 가입해 주세요. (그 계정으로 로그인하면 지금까지의 기록은 옮겨지지 않아요.)";
  }
  return message;
}
