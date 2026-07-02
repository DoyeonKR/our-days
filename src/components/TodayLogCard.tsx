"use client";

import { useEffect, useState } from "react";
import {
  type CoupleLog,
  listCoupleLogs,
  subscribeCoupleLogs,
} from "@/lib/couple";
import { logDateIso, slotLabel, slotOf } from "@/lib/logslot";
import Icon from "@/components/Icon";

function Mini({
  log,
  label,
  empty,
}: {
  log?: CoupleLog;
  label: string;
  empty: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[10px] font-semibold text-muted">{label}</p>
      {log?.videoUrl ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black/20">
          <video
            src={log.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          {log.body?.trim() && (
            <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 line-clamp-2 break-words text-center text-[11px] font-extrabold text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.85)]">
              {log.body}
            </span>
          )}
        </div>
      ) : log?.body ? (
        <div className="grid aspect-[3/4] place-items-center rounded-xl bg-glass2 px-2 ring-1 ring-line">
          <span className="line-clamp-4 text-center text-xs text-ink">{log.body}</span>
        </div>
      ) : (
        <div className="grid aspect-[3/4] place-items-center rounded-xl bg-glass2 ring-1 ring-line">
          <span className="text-[10px] text-muted">{empty}</span>
        </div>
      )}
    </div>
  );
}

/** 홈 상단 '지금의 우리' — 현재 슬롯의 두 사람 3초 브이로그 미리보기 + 로그 탭 진입. */
export default function TodayLogCard({
  coupleId,
  myUserId,
  myName,
  partnerName,
  onOpen,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onOpen: () => void;
}) {
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      listCoupleLogs(coupleId, logDateIso(new Date()))
        .then((l) => {
          if (!cancelled) setLogs(l);
        })
        .catch(() => {});
    refresh();
    const unsub = subscribeCoupleLogs(coupleId, refresh);
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [coupleId]);

  const slot = slotOf(now);
  const today = logDateIso(now);
  const mine = logs.find(
    (l) => l.log_date === today && l.slot === slot && l.created_by === myUserId,
  );
  const partner = logs.find(
    (l) => l.log_date === today && l.slot === slot && l.created_by !== myUserId,
  );

  return (
    <section className="animate-rise glass mt-6 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="camera" size={16} className="text-rose-deep" />
          지금의 우리
          <span className="rounded-full bg-rose/12 px-1.5 py-0.5 text-[9px] font-bold text-rose-deep">
            {slotLabel(slot)}
          </span>
        </p>
        <button
          onClick={onOpen}
          className="tap flex items-center gap-0.5 rounded-full bg-rose/12 px-3 py-1.5 text-xs font-bold text-rose-deep"
        >
          로그
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
      <div className="flex gap-3">
        <Mini log={mine} label={(myName || "나").trim()} empty="아직 안 남겼어요" />
        <Mini
          log={partner}
          label={(partnerName || "상대").trim()}
          empty="아직이에요"
        />
      </div>
      {!mine && (
        <button
          onClick={onOpen}
          className="tap mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
        >
          <Icon name="camera" size={14} />
          {slotLabel(slot)} 3초 남기기
        </button>
      )}
    </section>
  );
}
