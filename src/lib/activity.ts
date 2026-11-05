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
export type HomeFocus = "today-log" | "today-mood" | "today-question" | "home-poke";
/* ── 카드까지 가는 focus [2026-11-06 일기 리뷰 F1] ───────────────────
 * 일기 · 사진 경로엔 그 행의 id(activity_events.entity_id = 행의 uuid)를 focus 로 싣는다.
 *   { view: "diary", focus: <deco_entries.id> }                  → 일기장이 그 카드로 스크롤 + 반짝(10편 밖이면 '더 보기'를 펼친다)
 *   { view: "records", sub: "photos", focus: <couple_photos.id> } → 사진첩이 소비한다(사진 쪽 담당 — page 가 PhotoAlbum 에 넘긴다)
 *   { view: "plan", sub: "cal", focus: <couple_events.id> }       → 달력이 그 일정의 다음 회차가 있는 달 · 날을 연다(2026-11-05 — 일정 · 기념일 알림)
 * focus 가 없으면(옛 행 · 다른 종류) 그 화면 맨 위로 — 예전 동작 그대로.
 * 푸시 주소는 `?go=<종류>&f=<id>` — 옛 앱은 f 를 모르고 go 만 읽어 그 화면으로 간다(뒤 호환). */
export type AppRoute =
  | { view: "home"; focus?: HomeFocus }
  | { view: "records"; sub: "log" | "diary" | "photos" | "memories"; focus?: string }
  | { view: "plan"; sub: "cal" | "bucket"; focus?: string }
  | { view: "diary"; focus?: string }
  | { view: "together" }
  | { view: "game"; open?: "island" | "merge" | "aquarium" | "fishing" };

/** focus 로 받을 수 있는 id — 행 id 는 uuid 다. 손으로 친 주소 · 옛 알림이 아무 문자열이나 DOM id 로 넣지 않게. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function focusIdOf(raw: string | null | undefined): string | null {
  return raw && UUID.test(raw) ? raw.toLowerCase() : null;
}

/** 경로에 카드 id 를 싣는다 — 일기 · 사진 · 달력의 일정만(다른 화면엔 카드 단위 focus 가 없다). */
export function withFocus(route: AppRoute | null, raw: string | null | undefined): AppRoute | null {
  const focus = focusIdOf(raw);
  if (!route || !focus) return route;
  if (route.view === "diary") return { ...route, focus };
  if (route.view === "records" && route.sub === "photos") return { ...route, focus };
  if (route.view === "plan" && route.sub === "cal") return { ...route, focus };
  return route;
}

export function activityRoute(kind: ActivityEvent["kind"], entityId?: string | null): AppRoute {
  switch (kind) {
    case "mood":
      return { view: "home", focus: "today-mood" };
    case "answer":
      return { view: "home", focus: "today-question" };
    case "log":
      return { view: "records", sub: "log" };
    case "diary":
      return withFocus({ view: "diary" }, entityId) ?? { view: "diary" };
    case "photo":
      return withFocus({ view: "records", sub: "photos" }, entityId) ?? { view: "records", sub: "photos" };
    case "event":
      return withFocus({ view: "plan", sub: "cal" }, entityId) ?? { view: "plan", sub: "cal" };
    case "bucket":
      return { view: "plan", sub: "bucket" };
    case "poke":
      return { view: "home", focus: "home-poke" };
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
 * 서버 예약 푸시 중 기념일 · 일정 알림(daily-reminders)은 2026-11-05 부터 `./?go=event&f=<일정 id>` 로 그 날 달력을 연다
 *   (함수 재배포 뒤부터 — 그 전 운영본은 "./" 로 홈을 연다). 오늘 남기기 알림(activity-nudge)은 여전히 "./". */
export const ACTIVITY_KINDS = Object.keys(KIND_TEXT) as ActivityEvent["kind"][];

/** 알림을 눌렀을 때 열 주소 — SW 의 notificationTargetUrl 이 같은 앱 경로 안으로만 허용한다. */
export function pushUrlFor(kind: ActivityEvent["kind"]): string {
  return `./?go=${kind}`;
}

/** 푸시 주소 뒤에 붙일 카드 id(`&f=`). uuid 가 아니면 빈 문자열 — 주소엔 id 말고 아무것도 싣지 않는다. */
export function focusQuery(id: string | null | undefined): string {
  const f = focusIdOf(id);
  return f ? `&f=${f}` : "";
}

/** 주소의 go · f 를 한 값으로(로그인 전엔 sessionStorage 에 이 값 하나를 맡긴다) — 'diary~<uuid>'. */
export function joinGo(go: string | null | undefined, f: string | null | undefined): string {
  const focus = focusIdOf(f);
  return focus ? `${go ?? ""}~${focus}` : (go ?? "");
}
export function splitGo(raw: string | null | undefined): { go: string | null; focus: string | null } {
  if (!raw) return { go: raw ?? null, focus: null };
  const i = raw.indexOf("~");
  return i < 0 ? { go: raw, focus: null } : { go: raw.slice(0, i), focus: focusIdOf(raw.slice(i + 1)) };
}

/** ?go= 값 → 활동 종류. 모르는 값은 null — 옛 알림·손으로 친 주소가 엉뚱한 곳으로 보내지 않게. */
/** 게임으로 바로 가는 링크 [사용자 2026-10-31 "게임 라우팅 지정해줘 거기로 url 링크걸게"] —
 *  ?go=game(게임 탭) · ?go=merge(정원 합치기) · ?go=island(우리 섬). 짧은 주소 /game/ 은 ?go=merge 로 넘긴다(app/game).
 *  활동 종류(goKindOf)와 이름이 겹치지 않는다(activity.test). */
export const GAME_GO = { game: { view: "game" }, merge: { view: "game", open: "merge" }, island: { view: "game", open: "island" }, aquarium: { view: "game", open: "aquarium" }, fishing: { view: "game", open: "fishing" } } as const satisfies Record<string, AppRoute>;
export function gameRouteOf(raw: string | null | undefined): AppRoute | null {
  return raw && Object.prototype.hasOwnProperty.call(GAME_GO, raw) ? GAME_GO[raw as keyof typeof GAME_GO] : null;
}

export function goKindOf(raw: string | null | undefined): ActivityEvent["kind"] | null {
  return raw && (ACTIVITY_KINDS as string[]).includes(raw) ? (raw as ActivityEvent["kind"]) : null;
}
