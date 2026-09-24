"use client";

/* 우리 활동함 — 홈 머리글의 🔔 시트. [2026-09-24 IA 개편]
 *
 * 예전엔 함께 탭 안의 접히는 카드였다. 새 소식은 앱을 열자마자 알아야 하는데 함께 탭을 열어야만
 * 불러와서, 안 읽은 개수를 보려면 탭을 옮겨야 했다. 이제 조회·구독(useActivityInbox)은 앱이 한 번
 * 들고 있고, 홈 머리글 🔔 에 안 읽은 개수를 단다. 목록(ActivityList)은 page 의 공용 시트 안에 그린다.
 * ⚠ 행을 누르면 어디로 가는지는 lib/activity 의 activityRoute 한 곳이 정한다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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

export type ActivityInboxState = {
  events: ActivityEvent[];
  lastRead: string | null;
  loading: boolean;
  error: string | null;
  unread: number;
  /** 지금까지 온 소식을 읽음으로 — 시트를 열 때 부른다. */
  markRead: () => Promise<void>;
};

export function useActivityInbox(coupleId: string | null, myUserId: string | null): ActivityInboxState {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setEvents([]);
    setLastRead(null);
    if (!coupleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const refresh = async () => {
      const currentRevision = ++revision;
      try {
        const [nextEvents, readAt] = await Promise.all([listActivityEvents(coupleId), getMyActivityRead(coupleId)]);
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

  const unread = useMemo(() => unreadActivityCount(events, lastRead, myUserId), [events, lastRead, myUserId]);

  const markRead = useCallback(async () => {
    if (!coupleId || !events[0] || unread === 0) return;
    const readAt = events[0].created_at;
    try {
      await markActivityRead(coupleId, readAt);
      setLastRead(readAt);
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : "읽음 상태를 저장하지 못했어요.", "error");
    }
  }, [coupleId, events, unread]);

  return { events, lastRead, loading, error, unread, markRead };
}

/** 활동 목록 — since(시트를 연 순간의 읽은 시각)보다 새 소식을 밝혀 둔다.
 *  열자마자 읽음 처리가 되므로, 지금의 lastRead 로 칠하면 새 소식 표시가 곧바로 사라진다. */
export default function ActivityList({
  inbox,
  since,
  members,
  myUserId,
  onOpenKind,
}: {
  inbox: ActivityInboxState;
  since: string | null;
  members: Member[];
  myUserId: string | null;
  onOpenKind: (kind: ActivityEvent["kind"]) => void;
}) {
  const { events, loading, error } = inbox;
  return (
    <div>
      {error && (
        <p role="alert" className="text-xs text-rose-deep">
          {error}
        </p>
      )}
      {!error && loading && events.length === 0 && <p className="py-5 text-center text-xs text-muted">새 소식을 확인하는 중…</p>}
      {!error && !loading && events.length === 0 && <p className="py-5 text-center text-xs text-muted">아직 쌓인 활동이 없어요</p>}
      <ul className="space-y-1">
        {events.map((event) => {
          const shown = activityPresentation(event, members, myUserId);
          const isNew = event.actor_user !== myUserId && (!since || event.created_at > since);
          return (
            <li key={event.id}>
              <button
                onClick={() => onOpenKind(event.kind)}
                className={`tap flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left ${isNew ? "bg-rose/10" : ""}`}
              >
                <span className="text-lg" aria-hidden>
                  {shown.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-ink">
                    {shown.title}
                    {isNew && <span className="ml-1 inline-block whitespace-nowrap text-rose-deep">· 새 소식</span>}
                  </span>
                  {shown.detail && <span className="mt-0.5 block truncate text-xs text-muted">{shown.detail}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{activityTime(event.created_at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
