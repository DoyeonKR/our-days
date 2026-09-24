import type { ActivityEvent, Member } from "./couple.ts";

const KIND_TEXT: Record<ActivityEvent["kind"], { emoji: string; action: string }> = {
  poke: { emoji: "💌", action: "메시지를 보냈어요" },
  event: { emoji: "📅", action: "일정을 저장했어요" },
  photo: { emoji: "📷", action: "사진을 올렸어요" },
  diary: { emoji: "📔", action: "일기를 남겼어요" },
  log: { emoji: "🎥", action: "오늘의 로그를 남겼어요" },
  mood: { emoji: "😊", action: "오늘의 기분을 남겼어요" }, // 하루 한 번 고른다 — '바꿨어요'는 옛 무드 체크인 문구
  answer: { emoji: "💬", action: "오늘의 질문에 답했어요" },
  bucket: { emoji: "🎯", action: "버킷리스트를 바꿨어요" },
};

export function activityPresentation(
  event: ActivityEvent,
  members: readonly Member[],
  myUserId: string | null,
): { emoji: string; title: string; detail: string | null } {
  const kind = KIND_TEXT[event.kind] ?? { emoji: "✨", action: "새 활동이 있어요" };
  const mine = !!myUserId && event.actor_user === myUserId;
  const actor = members.find((member) => member.user_id === event.actor_user)?.nickname?.trim() || "상대";
  return {
    emoji: kind.emoji,
    // 내 활동은 '나님이'가 아니라 '내가' — 활동함이 홈 🔔 로 올라와 매일 보게 되면서 어색함이 눈에 띄었다
    title: mine ? `내가 ${kind.action}` : `${actor}님이 ${kind.action}`,
    detail: event.summary?.trim() || null,
  };
}

export function activityTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "방금";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function unreadActivityCount(
  events: readonly ActivityEvent[],
  lastRead: string | null,
  myUserId?: string | null,
): number {
  return events.filter(
    (event) => event.actor_user !== myUserId && (!lastRead || event.created_at > lastRead),
  ).length;
}

/* ── 활동 → 화면 경로 [2026-09-24 IA 개편] ─────────────────────────
 * [사용자: "메뉴가 너무 파편화 되어있는 것 같아"] 활동함에서 기분·오늘의 질문 답을 누르면 **홈**으로
 * 갔는데, 두 카드는 **함께** 탭에 있었다(죽은 링크). 이제 매일 하는 일 셋(로그·기분·질문)은 홈의
 * '오늘의 우리'에 모였고, 경로는 여기 한 곳에서 정한다 — 활동함·푸시 알림이 같은 표를 쓴다.
 * ⚠ focus 는 홈 카드의 DOM id 다(TodayTogether). 이름을 바꾸면 todayhub.test 가 잡는다. */
export type HomeFocus = "today-log" | "today-mood" | "today-question";
export type AppRoute =
  | { view: "home"; focus?: HomeFocus }
  | { view: "records"; sub: "log" | "diary" | "photos" | "memories" }
  | { view: "plan"; sub: "cal" | "bucket" }
  | { view: "together" };

export function activityRoute(kind: ActivityEvent["kind"]): AppRoute {
  switch (kind) {
    case "mood":
      return { view: "home", focus: "today-mood" };
    case "answer":
      return { view: "home", focus: "today-question" };
    case "log":
      return { view: "records", sub: "log" };
    case "diary":
      return { view: "records", sub: "diary" };
    case "photo":
      return { view: "records", sub: "photos" };
    case "event":
      return { view: "plan", sub: "cal" };
    case "bucket":
      return { view: "plan", sub: "bucket" };
    case "poke":
      return { view: "together" };
    default: {
      // 새 종류를 추가하면 여기서 타입 오류가 난다 — 경로 없는 활동 행(죽은 버튼)을 만들지 않게
      const never: never = kind;
      return never;
    }
  }
}

/* ── 알림을 누르면 제자리로 [2026-09-24] ─────────────────────────────
 * 예전엔 푸시 알림을 누르면 앱만 열렸다(열려 있으면 앞으로 가져오기만) — 상대가 기분을 남겼다는 알림을
 * 눌러도 홈 맨 위였다. 이제 푸시에 ?go=<활동 종류> 를 실어 보내고(Edge 가 url 을 그대로 전달한다),
 * 앱은 활동함과 **같은 표**(activityRoute)로 그 화면·카드로 간다. 열린 앱에는 SW 가 postMessage 로 전한다.
 * ⚠ 서버 예약 푸시(기념일·오늘 남기기 알림)는 Edge 함수가 url 을 "./" 로 박아 둬서 홈으로 연다 — 홈에
 *   '다음 일정'과 '오늘의 우리'가 있으니 그대로 둔다(바꾸려면 함수 재배포가 필요하다). */
export const ACTIVITY_KINDS = Object.keys(KIND_TEXT) as ActivityEvent["kind"][];

/** 알림을 눌렀을 때 열 주소 — SW 의 notificationTargetUrl 이 같은 앱 경로 안으로만 허용한다. */
export function pushUrlFor(kind: ActivityEvent["kind"]): string {
  return `./?go=${kind}`;
}

/** ?go= 값 → 활동 종류. 모르는 값은 null — 옛 알림·손으로 친 주소가 엉뚱한 곳으로 보내지 않게. */
export function goKindOf(raw: string | null | undefined): ActivityEvent["kind"] | null {
  return raw && (ACTIVITY_KINDS as string[]).includes(raw) ? (raw as ActivityEvent["kind"]) : null;
}
