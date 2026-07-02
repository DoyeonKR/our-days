"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CoupleLog,
  deleteCoupleLog,
  listCoupleLogs,
  subscribeCoupleLogs,
} from "@/lib/couple";
import LogCapture from "@/components/LogCapture";
import {
  type LogSlot,
  canWriteSlot,
  logDateIso,
  slotLabel,
  slotOf,
} from "@/lib/logslot";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";
import { SkeletonList } from "@/components/Skeleton";

const KEEP_DAYS = 14; // 브라우징 범위

function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return logDateIso(new Date(y, m - 1, d + delta));
}

/** 셋로그식 3초 루프 재생 — 자동재생(음소거 시작) + 탭 소리 토글 + 영상 가운데 텍스트. */
function LoopVideo({ src, overlay }: { src: string; overlay?: string | null }) {
  const [muted, setMuted] = useState(true);
  return (
    <button
      onClick={() => setMuted((m) => !m)}
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
      className="relative mb-1 block w-full overflow-hidden rounded-xl bg-black/20"
    >
      <video
        src={src}
        autoPlay
        muted={muted}
        loop
        playsInline
        preload="auto"
        className="w-full"
      />
      {overlay?.trim() && (
        <span className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 break-words text-center text-base font-extrabold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
          {overlay}
        </span>
      )}
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white">
        <Icon name={muted ? "volumeX" : "volume"} size={13} />
      </span>
    </button>
  );
}

/** 오늘의 로그 — 하루 2슬롯(오전/오후) 3초 브이로그. 커플 둘의 하루가 나란히. */
export default function TodayLog({
  coupleId,
  myUserId,
  myName,
  partnerName,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
}) {
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [dateIso, setDateIso] = useState(() => logDateIso(new Date()));
  const [capture, setCapture] = useState<{
    slot: LogSlot;
    existing: CoupleLog | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const todayIso = logDateIso(now);

  useEffect(() => {
    let cancelled = false;
    const since = shiftIso(logDateIso(new Date()), -(KEEP_DAYS - 1));
    const refresh = () =>
      listCoupleLogs(coupleId, since)
        .then((l) => {
          if (!cancelled) setLogs(l);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        });
    refresh();
    const unsub = subscribeCoupleLogs(coupleId, refresh);
    // 슬롯 경계(12시/자정) 넘어가면 잠금/오픈 상태 갱신 — 1분 시계
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(tick);
    };
  }, [coupleId]);

  const dayLogs = useMemo(
    () => logs.filter((l) => l.log_date === dateIso),
    [logs, dateIso],
  );
  const cell = (slot: LogSlot, mine: boolean) =>
    dayLogs.find((l) => l.slot === slot && (l.created_by === myUserId) === mine);

  async function remove(l: CoupleLog) {
    if (
      !(await confirmDialog({
        message: "이 로그를 삭제할까요?",
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    const prev = logs;
    setLogs((cur) => cur.filter((x) => x.id !== l.id));
    try {
      await deleteCoupleLog(l.id, l.video_path);
    } catch (e) {
      setLogs(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const isToday = dateIso === todayIso;
  const curSlot = slotOf(now);

  /** 내 칸 렌더 */
  function myCell(slot: LogSlot) {
    const log = cell(slot, true);
    const writable = canWriteSlot(dateIso, slot, now);
    if (log) {
      return (
        <div>
          {log.videoUrl ? (
            <LoopVideo src={log.videoUrl} overlay={log.body} />
          ) : (
            // (구버전) 텍스트만 있던 로그 하위호환
            log.body && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                {log.body}
              </p>
            )
          )}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          {writable && (
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => setCapture({ slot, existing: log })}
                className="tap -ml-2 rounded-full px-2 py-2 text-[11px] font-semibold text-rose-deep"
              >
                수정
              </button>
              <button
                onClick={() => remove(log)}
                className="tap rounded-full px-2 py-2 text-[11px] text-muted"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      );
    }
    if (writable) {
      return (
        <button
          onClick={() => setCapture({ slot, existing: null })}
          className="tap flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-rose/40 bg-glass2 py-5 text-xs font-bold text-rose-deep"
        >
          <Icon name="image" size={18} />
          3초 남기기
        </button>
      );
    }
    // 미래 슬롯 = 잠김 / 오늘의 지난 슬롯 = 마감 사유 명시 / 지난 날짜 = 중립
    const future = isToday && slot === "pm" && curSlot === "am";
    return (
      <p className="flex items-center gap-1.5 py-3 text-xs text-muted">
        {future ? (
          <>
            <Icon name="lock" size={12} />
            12시에 열려요
          </>
        ) : isToday ? (
          `${slotLabel(slot)}이 지나서 이제 남길 수 없어요`
        ) : (
          "조용히 지나갔어요 ☁️"
        )}
      </p>
    );
  }

  function partnerCell(slot: LogSlot) {
    const log = cell(slot, false);
    if (log) {
      return (
        <div>
          {log.videoUrl ? (
            <LoopVideo src={log.videoUrl} overlay={log.body} />
          ) : (
            log.body && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                {log.body}
              </p>
            )
          )}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
        </div>
      );
    }
    const future = isToday && slot === "pm" && curSlot === "am";
    return (
      <p className="py-3 text-xs text-muted">
        {future
          ? "아직이에요"
          : isToday && slot === curSlot
            ? "아직 안 남겼어요"
            : "조용히 지나갔어요 ☁️"}
      </p>
    );
  }

  const my = (myName || "나").trim();
  const partner = (partnerName || "상대").trim();

  // uid 해석 전에는 나/상대 칸 매칭이 불가능(내 로그가 상대 칸에 보임) → 스켈레톤
  if (!myUserId) {
    return <SkeletonList rows={2} />;
  }

  return (
    <div>
      {/* 날짜 네비 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setDateIso((d) => shiftIso(d, -1))}
          disabled={dateIso <= shiftIso(todayIso, -(KEEP_DAYS - 1))}
          aria-label="이전 날"
          className="tap grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-extrabold text-ink tabular-nums">
            {dateIso.replaceAll("-", ".")}
          </p>
          <p className="text-[10px] font-semibold text-rose-deep">
            {isToday ? `오늘 · 지금은 ${slotLabel(curSlot)}` : "지난 로그"}
          </p>
        </div>
        <button
          onClick={() => setDateIso((d) => shiftIso(d, 1))}
          disabled={isToday}
          aria-label="다음 날"
          className="tap grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {/* 2×2: 오전/오후 × 나/상대 */}
      <div className="space-y-3">
        {(["am", "pm"] as const).map((slot) => (
          <div
            key={slot}
            className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-sm)] ring-1 ring-line"
          >
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  slot === "am" ? "bg-anniv-bg text-anniv" : "bg-diary-bg text-diary"
                }`}
              >
                {slot === "am" ? "☀" : "☾"}
              </span>
              {slotLabel(slot)}
              {isToday && slot === curSlot && (
                <span className="rounded-full bg-rose/12 px-1.5 py-0.5 text-[9px] font-bold text-rose-deep">
                  NOW
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold text-muted">{my}</p>
                {myCell(slot)}
              </div>
              <div className="min-w-0 border-l border-line pl-3">
                <p className="mb-1 text-[10px] font-semibold text-muted">
                  {partner}
                </p>
                {partnerCell(slot)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        오전엔 오전에, 오후엔 오후에 — 슬롯당 3초 브이로그 1개
      </p>
      {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}

      {/* 원-플로우 촬영기: 열리면 카메라 → 3초 강제 → 찍자마자 업로드 → 한마디 → 올리기 */}
      {capture && (
        <LogCapture
          coupleId={coupleId}
          dateIso={dateIso}
          slot={capture.slot}
          existing={capture.existing}
          onClose={() => setCapture(null)}
          onSaved={async () => {
            setCapture(null);
            try {
              setLogs(
                await listCoupleLogs(
                  coupleId,
                  shiftIso(todayIso, -(KEEP_DAYS - 1)),
                ),
              );
            } catch {
              /* realtime 이 곧 갱신 */
            }
          }}
        />
      )}
    </div>
  );
}
