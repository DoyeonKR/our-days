"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import {
  type ActivityEvent,
  type Member,
  getMyActivityRead,
  listActivityEvents,
  markActivityRead,
  subscribeActivityEvents,
} from "@/lib/couple";
import { activityPresentation, activityTime, unreadActivityCount } from "@/lib/activity";
import { showNotice } from "@/lib/notice";

export default function ActivityInbox({
  coupleId,
  members,
  myUserId,
  onOpenKind,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
  onOpenKind?: (kind: ActivityEvent["kind"]) => void;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setEvents([]);
    setLastRead(null);
    setLoading(true);
    const refresh = async () => {
      const currentRevision = ++revision;
      try {
        const [nextEvents, readAt] = await Promise.all([
          listActivityEvents(coupleId),
          getMyActivityRead(coupleId),
        ]);
        if (!cancelled && currentRevision === revision) {
          setEvents(nextEvents);
          setLastRead(readAt);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled && currentRevision === revision)
          setError(reason instanceof Error ? reason.message : "활동을 불러오지 못했어요.");
      } finally {
        if (!cancelled && currentRevision === revision) setLoading(false);
      }
    };
    void refresh();
    const unsubscribe = subscribeActivityEvents(coupleId, () => void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [coupleId]);

  const unread = useMemo(
    () => unreadActivityCount(events, lastRead, myUserId),
    [events, lastRead, myUserId],
  );

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || !events[0] || unread === 0) return;
    const readAt = events[0].created_at;
    try {
      await markActivityRead(coupleId, readAt);
      setLastRead(readAt);
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : "읽음 상태를 저장하지 못했어요.", "error");
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
      <button onClick={() => void toggle()} className="tap flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
          <Icon name="bell" size={19} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-neon px-1 text-xs font-bold text-white">
              {Math.min(unread, 99)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-ink">우리 활동함</span>
          <span className="block truncate text-xs text-muted">
            {loading ? "새 소식을 확인하는 중…" : unread ? `확인하지 않은 활동 ${unread}개` : "새 활동을 모두 확인했어요"}
          </span>
        </span>
        <Icon name="chevronDown" size={17} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          {error && <p role="alert" className="text-xs text-rose-deep">{error}</p>}
          {!error && events.length === 0 && <p className="py-5 text-center text-xs text-muted">아직 쌓인 활동이 없어요</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {events.map((event) => {
              const shown = activityPresentation(event, members, myUserId);
              const isUnread = !lastRead || event.created_at > lastRead;
              return (
                <li key={event.id}>
                  <button
                    onClick={() => onOpenKind?.(event.kind)}
                    className={`tap flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left ${isUnread ? "bg-rose/10" : ""}`}
                  >
                    <span className="text-lg" aria-hidden>{shown.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink">{shown.title}</span>
                      {shown.detail && <span className="mt-0.5 block truncate text-xs text-muted">{shown.detail}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{activityTime(event.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
