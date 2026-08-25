import type { ActivityEvent, Member } from "./couple.ts";

const KIND_TEXT: Record<ActivityEvent["kind"], { emoji: string; action: string }> = {
  poke: { emoji: "💌", action: "메시지를 보냈어요" },
  event: { emoji: "📅", action: "일정을 저장했어요" },
  photo: { emoji: "📷", action: "사진을 올렸어요" },
  diary: { emoji: "📔", action: "일기를 남겼어요" },
  log: { emoji: "🎥", action: "오늘의 로그를 남겼어요" },
  mood: { emoji: "😊", action: "오늘의 기분을 바꿨어요" },
  answer: { emoji: "💬", action: "오늘의 질문에 답했어요" },
  bucket: { emoji: "🎯", action: "버킷리스트를 바꿨어요" },
};

export function activityPresentation(
  event: ActivityEvent,
  members: readonly Member[],
  myUserId: string | null,
): { emoji: string; title: string; detail: string | null } {
  const kind = KIND_TEXT[event.kind] ?? { emoji: "✨", action: "새 활동이 있어요" };
  const actor =
    event.actor_user === myUserId
      ? "나"
      : members.find((member) => member.user_id === event.actor_user)?.nickname?.trim() || "상대";
  return {
    emoji: kind.emoji,
    title: `${actor}님이 ${kind.action}`,
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
