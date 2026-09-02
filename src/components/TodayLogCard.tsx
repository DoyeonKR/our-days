"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CoupleLog,
  type LogComment,
  evictSignedUrls,
  listCoupleLogs,
  listLogComments,
  subscribeCoupleLogs,
  subscribeLogComments,
} from "@/lib/couple";
import { logDateIso, slotLabel, slotOf } from "@/lib/logslot";
import { splitByOwner } from "@/lib/ownerSplit";
import { useMyUid } from "@/lib/useMyUid";
import Icon from "@/components/Icon";
import LoopVideo from "@/components/LoopVideo";

/* 인스타 스토리 링 — 채워진 브이로그에 시그니처 그라디언트 링(액센트→바이올렛→앰버). */
const STORY_RING = "linear-gradient(45deg, var(--neon), #a78bfa, #f6cd6b)";

function Mini({
  log,
  label,
  empty,
  slots,
  onExpired,
  onTap,
}: {
  log?: CoupleLog | null;
  label: string;
  empty: string;
  slots: { am: boolean; pm: boolean }; // 이 사람의 오늘 오전/오후 채움 여부
  onExpired?: () => void;
  onTap: () => void;
}) {
  const filled = !!(log?.videoUrl || log?.body);
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 flex items-center text-xs font-semibold text-muted">
        <span className="truncate">{label}</span>
        {/* 오전/오후 채움 도트 — 오늘 이 사람의 두 슬롯 현황 */}
        <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
          <span
            title={`오전 ${slots.am ? "완료" : "비어있음"}`}
            className={`h-1.5 w-1.5 rounded-full ${slots.am ? "bg-rose" : "bg-line-strong"}`}
          />
          <span
            title={`오후 ${slots.pm ? "완료" : "비어있음"}`}
            className={`h-1.5 w-1.5 rounded-full ${slots.pm ? "bg-rose" : "bg-line-strong"}`}
          />
        </span>
      </p>
      {/* 스토리 링: 콘텐츠 있으면 그라디언트, 없으면 얇은 라인.
          ⚠ LoopVideo 안에 재생 폴백 <button>이 있어 래퍼는 button 금지(중첩 버튼) — role 로 */}
      <div
        role="button"
        tabIndex={0}
        onClick={onTap}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
        aria-label={filled ? `${label}의 브이로그 보기` : `${label} · ${empty}`}
        className="tap block w-full cursor-pointer rounded-none p-[2px] text-left"
        style={{ background: filled ? STORY_RING : "var(--line)" }}
      >
        {log?.videoUrl ? (
          <LoopVideo src={log.videoUrl} overlay={log.body} onExpired={onExpired} compact />
        ) : log?.body ? (
          <div className="grid aspect-[3/4] place-items-center rounded-xl bg-glass2 px-2">
            <span className="line-clamp-4 text-center text-xs text-ink">{log.body}</span>
          </div>
        ) : (
          <div className="grid aspect-[3/4] place-items-center rounded-xl bg-glass2">
            <span className="text-xs text-muted">{empty}</span>
          </div>
        )}
      </div>
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
  onOpen: (openCapture?: boolean) => void; // true = 로그 탭 이동 + 현재 슬롯 촬영 즉시 오픈
}) {
  // ⚠ 귀속 uid — prop null 이어도 저장 정체성과 같은 uid 로 복구(내 영상이 상대 칸에 뜨는 회귀 방지)
  const uid = useMyUid(myUserId);
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [comments, setComments] = useState<LogComment[]>([]);
  const [now, setNow] = useState(() => new Date());
  const refreshRef = useRef<(() => void) | null>(null);
  // 서명URL 만료 등으로 영상 로드 실패 시 — 캐시 evict 후 재조회 (홈 카드 자가복구)
  const recover = (l?: CoupleLog | null) => {
    if (l?.video_path) evictSignedUrls([l.video_path]);
    refreshRef.current?.();
  };

  useEffect(() => {
    let cancelled = false;
    refreshRef.current = () =>
      listCoupleLogs(coupleId, logDateIso(new Date()))
        .then((l) => {
          if (!cancelled) setLogs(l);
        })
        .catch(() => {});
    const refresh = () => refreshRef.current?.();
    refresh();
    // 로그 탭(TodayLog)과 동시 마운트(keep-mounted) — 채널 키 분리 필수 (couple.ts 주석 참조)
    const unsub = subscribeCoupleLogs(coupleId, refresh, "clogs-home");
    // 댓글도 같이 — 홈에서 상대가 남긴 말을 바로 볼 수 있어야 한다.
    // ⚠ 채널 키를 분리한다(로그 탭과 동시 마운트되므로 — couple.ts 주석 참조).
    const loadComments = () =>
      listLogComments(coupleId)
        .then((c) => {
          if (!cancelled) setComments(c);
        })
        .catch(() => {});
    loadComments();
    const unsubC = subscribeLogComments(coupleId, loadComments, "lcomments-home");
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      unsub();
      unsubC();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [coupleId]);

  const slot = slotOf(now);
  const today = logDateIso(now);
  const todaySlotLogs = logs.filter((l) => l.log_date === today && l.slot === slot);
  const { mine, partner } = splitByOwner(todaySlotLogs, uid, (l) => l.created_by);
  // 오전/오후 채움 도트용 — 오늘 전체 로그에서 사람×슬롯 집계
  const todayLogs = logs.filter((l) => l.log_date === today);
  // 오늘 올라온 로그(양쪽·양 슬롯)에 달린 댓글만 — 홈 카드는 '오늘'의 창이다.
  const todayLogIds = new Set(todayLogs.map((l) => l.id));
  const todayComments = comments.filter((c) => todayLogIds.has(c.log_id));
  const slotsOf = (isMine: boolean) => ({
    am: todayLogs.some((l) => l.slot === "am" && (uid ? (l.created_by === uid) === isMine : false)),
    pm: todayLogs.some((l) => l.slot === "pm" && (uid ? (l.created_by === uid) === isMine : false)),
  });

  return (
    <section className="cosmic-feed-card animate-rise p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="camera" size={16} className="text-rose-deep" />
          <span className="cosmic-rank-chip bg-rose/12 px-2 py-0.5 text-xs font-bold text-rose-deep">
            {slotLabel(slot)}
          </span>
        </p>
        {/* '로그 ›' 알약은 뗐다 — 하단 탭 '로그'와 목적지가 100% 같은 '두 번째 문'이었다.
            카드 안의 미니 브이로그와 '3초 남기기'로 같은 곳에 갈 수 있다. [2026-08-04] */}
      </div>
      <div className="flex gap-3">
        <Mini
          log={mine}
          label={(myName || "나").trim()}
          empty="아직 안 남겼어요"
          slots={slotsOf(true)}
          onExpired={() => recover(mine)}
          onTap={() => onOpen(!mine)} // 내 칸: 비었으면 바로 촬영, 있으면 로그 탭 보기
        />
        <Mini
          log={partner}
          label={(partnerName || "상대").trim()}
          empty="아직이에요"
          slots={slotsOf(false)}
          onExpired={() => recover(partner)}
          onTap={() => onOpen()}
        />
      </div>

      {/* 오늘 로그에 달린 댓글 — 예전엔 로그 탭까지 들어가야 보여서 상대가 남긴 말을 놓쳤다.
          (사용자: "셋로그 댓글이 메인에도 잘 표시될 수 있도록"). 최근 2개만 보여주고 나머지는 개수로. */}
      {todayComments.length > 0 && (
        <button
          onClick={() => onOpen()}
          className="tap mt-3 w-full space-y-1 border-t border-line pt-2.5 text-left"
        >
          {todayComments.slice(-2).map((c) => {
            const isMine = !!uid && c.created_by === uid;
            return (
              <p key={c.id} className="flex items-start gap-1.5 text-xs">
                <span className={`shrink-0 font-bold ${isMine ? "text-rose-deep" : "text-partner"}`}>
                  {(isMine ? myName || "나" : partnerName || "상대").trim()}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">{c.body}</span>
              </p>
            );
          })}
          {todayComments.length > 2 && (
            <p className="text-xs font-bold text-rose-deep">댓글 {todayComments.length}개 모두 보기 →</p>
          )}
        </button>
      )}
      {!mine && (
        <button
          onClick={() => onOpen(true)}
          className="tap cosmic-rank-chip mt-3 flex w-full items-center justify-center gap-1.5 bg-brand py-2.5 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
        >
          <Icon name="camera" size={14} />
          {slotLabel(slot)} 3초 남기기
        </button>
      )}
    </section>
  );
}
