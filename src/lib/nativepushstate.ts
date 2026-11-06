/* 안드로이드 앱 푸시의 순수 부분 — 저장 키 · 채널 표 · 설정 화면 문구. 다른 파일을 불러오지 않는다(node --test 가 그대로 읽는다).
 * 플러그인을 부르는 쪽은 nativepush.ts. (2026-11-06 앱 · 푸시 리뷰 — README §10.20) */

/** 이 기기의 마지막 FCM 토큰 */
export const TOKEN_KEY = "ourdays:native-push-token";
/** 서버 등록을 확인한 '사용자:토큰' — 같으면 다시 등록하지 않는다(앱으로 돌아올 때마다 RPC 를 부르지 않게) */
export const SYNCED_KEY = "ourdays:native-push-synced";
/** 로그아웃 때 서버 행을 못 지운 토큰들(JSON 배열) — 다음 실행에 unregister_native_push 로 지운다 */
export const UNBIND_KEY = "ourdays:native-push-unbind";
const UNBIND_MAX = 10;

/** 안드로이드 알림 채널 — id 는 서버 _shared/fcm.ts 의 channelFor 와 같아야 한다(fcmpush.test 가 비교).
 *  사람이 휴대폰 설정에서 종류마다 끄고 켤 수 있다. importance 4 = 소리 + 화면 위 배너, 3 = 소리만. */
export const NATIVE_CHANNELS = [
  { id: "poke", name: "쿡 찌르기", description: "상대가 쿡 찔렀을 때", importance: 4 },
  { id: "reminders", name: "기념일 · 일정", description: "다가오는 기념일과 일정", importance: 4 },
  { id: "question", name: "오늘의 질문", description: "아침 질문 · 상대가 먼저 답했을 때", importance: 3 },
  { id: "activity", name: "활동 · 리마인더", description: "기록 알림 · 오늘 남기기 · 그 밖의 소식", importance: 3 },
] as const;
/** AndroidManifest 의 default_notification_channel_id 와 같아야 한다 — channel_id 없이 온 알림(옛 서버)이 여기로 간다 */
export const DEFAULT_CHANNEL_ID = "activity";

/** 앱을 켜 둔 동안 온 알림을 시스템이 직접 띄우는 껍데기(capacitor.config 의 presentationOptions 가 들어간 APK)의 versionCode.
 *  그보다 옛 APK 는 앞에 있을 때 알림이 안 뜨므로 앱 안 안내(showNotice)로 대신한다. */
export const FOREGROUND_SHELL_BUILD = 3;

export function shellShowsForeground(build: string | number | null | undefined): boolean {
  const n = Number(build);
  return Number.isFinite(n) && n >= FOREGROUND_SHELL_BUILD;
}

/** FCM 토큰 모양 — 서버 register_native_push 와 같은 규칙(영숫자 : _ -, 20~512자) */
export function isFcmTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9:_-]{20,512}$/.test(token);
}

export const syncedMark = (userId: string, token: string): string => `${userId}:${token}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readUnbind(store: Store): string[] {
  try {
    const list = JSON.parse(store.getItem(UNBIND_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter(isFcmTokenShape).slice(-UNBIND_MAX) : [];
  } catch {
    return [];
  }
}

function writeUnbind(store: Store, list: string[]): void {
  try {
    if (list.length) store.setItem(UNBIND_KEY, JSON.stringify(list.slice(-UNBIND_MAX)));
    else store.removeItem(UNBIND_KEY);
  } catch {
    /* 저장이 막힌 기기 — 다음 실행 재시도만 못 한다 */
  }
}

export function addUnbind(store: Store, token: string): void {
  if (!isFcmTokenShape(token)) return;
  writeUnbind(store, [...readUnbind(store).filter((t) => t !== token), token]);
}

/** 지워졌거나, 이 기기가 그 토큰을 다시 쓰게 됐으면 목록에서 뺀다 — 다시 쓰는 토큰을 지우면 새 계정 알림이 끊긴다 */
export function removeUnbind(store: Store, token: string): void {
  const list = readUnbind(store);
  if (list.includes(token)) writeUnbind(store, list.filter((t) => t !== token));
}

export type NativePermission = "granted" | "denied" | "prompt" | "unavailable";
export type NativePushStatus = { permission: NativePermission; token: string | null; registered: boolean };

export function normalizePermission(receive: string | null | undefined): NativePermission {
  if (receive === "granted" || receive === "denied") return receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") return "prompt";
  return "unavailable";
}

export type NativePushView = {
  tone: "ok" | "warn" | "off";
  text: string;
  /** 주 버튼 — request = 권한 묻기 · register = 다시 등록 · recheck = 설정에서 바꾼 뒤 다시 확인 */
  action: "request" | "register" | "recheck" | null;
  actionLabel?: string;
  /** 휴대폰 설정에서 켜는 길 */
  howTo?: string;
  canTest: boolean;
};

/** 설정 화면의 앱 알림 카드 — 예전엔 상태와 무관하게 늘 '앱 알림을 쓰고 있어요'였다(거절한 사람이 되돌릴 길도 없었다). */
export function nativePushView(s: NativePushStatus): NativePushView {
  if (s.permission === "unavailable")
    return { tone: "off", text: "이 앱 버전에서는 알림을 켤 수 없어요. 새 APK 를 설치해 주세요.", action: "recheck", actionLabel: "다시 확인", canTest: false };
  if (s.permission === "denied")
    return {
      tone: "off",
      text: "알림이 꺼져 있어요. 앱이 대신 켤 수 없어서 휴대폰 설정에서 켜야 해요.",
      howTo: "휴대폰 설정 → 애플리케이션(앱) → 하루 → 알림 → 허용. 켠 뒤 돌아와서 '다시 확인'을 눌러 주세요.",
      action: "recheck",
      actionLabel: "다시 확인",
      canTest: false,
    };
  if (s.permission === "prompt")
    return { tone: "warn", text: "아직 알림을 허용하지 않았어요. 켜면 쿡 · 기념일 · 질문 알림이 이 휴대폰으로 와요.", action: "request", actionLabel: "알림 켜기", canTest: false };
  if (!s.token)
    return { tone: "warn", text: "알림은 허용됐지만 이 휴대폰이 아직 등록되지 않았어요.", action: "register", actionLabel: "다시 등록", canTest: false };
  if (!s.registered)
    return { tone: "warn", text: "이 휴대폰을 서버에 등록하지 못했어요. 연결을 확인하고 다시 등록해 주세요.", action: "register", actionLabel: "다시 등록", canTest: true };
  return {
    tone: "ok",
    text: "이 휴대폰으로 앱 알림이 와요. 종류별로 끄려면 휴대폰 설정 → 앱 → 하루 → 알림에서 바꿔 주세요.",
    action: null,
    canTest: true,
  };
}

/** send-poke-push 의 테스트 응답(이 기기 토큰으로 보낸 것) → 사람 말. native 가 없으면 옛 함수다(내 모든 기기로 보냈다). */
export function nativeTestMessage(data: { sent?: number; native?: { sent?: number; targets?: number; disabled?: boolean } } | null | undefined): string {
  const native = data?.native;
  if (!native)
    return (data?.sent ?? 0) > 0
      ? "테스트 알림을 보냈어요. (서버가 아직 옛 버전이라 이 휴대폰만 골라 보내지는 못했어요.)"
      : "보낼 기기가 없어요. '다시 등록'을 누른 뒤 다시 해 보세요.";
  if (native.disabled) return "서버에 앱 알림(FCM) 설정이 없어 보내지 못했어요.";
  if (!native.targets) return "서버에 이 휴대폰이 등록돼 있지 않아요. 다시 등록하고 있어요 — 잠시 뒤 한 번 더 눌러 주세요.";
  if ((native.sent ?? 0) > 0) return "이 휴대폰으로 테스트 알림을 보냈어요. 잠시 후 알림이 오는지 확인하세요.";
  return "이 휴대폰으로 보내지 못했어요. 앱을 지웠다 깔았거나 토큰이 바뀌었을 수 있어요 — 다시 등록하고 있어요.";
}
