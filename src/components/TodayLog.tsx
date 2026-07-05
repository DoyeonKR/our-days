"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoupleLog,
  type LogComment,
  addLogComment,
  deleteCoupleLog,
  deleteLogComment,
  evictSignedUrls,
  listCoupleLogs,
  listLogComments,
  subscribeCoupleLogs,
  subscribeLogComments,
} from "@/lib/couple";
import LogCapture from "@/components/LogCapture";
import LoopVideo from "@/components/LoopVideo";
import {
  type LogSlot,
  canWriteSlot,
  logDateIso,
  shiftDateIso,
  slotLabel,
  slotOf,
} from "@/lib/logslot";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";
import { SkeletonList } from "@/components/Skeleton";

const KEEP_DAYS = 14; // 브라우징 범위
const LS_SEEN = "ourdays:logseen"; // 상대 새 로그 NEW 배지 기준

/** 브이로그 댓글 스레드 — 한 로그(영상)에 달린 댓글 목록 + 입력.
 *  draft(입력 중 텍스트)를 자체 보관 → 열려 있는 스레드에만 상태가 붙는다. */
function CommentThread({
  comments,
  myUserId,
  myName,
  partnerName,
  onAdd,
  onDelete,
}: {
  comments: LogComment[];
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onAdd: (body: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onAdd(body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 border-t border-line pt-2.5">
      {comments.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {comments.map((c) => {
            const mine = c.created_by === myUserId;
            return (
              <li key={c.id} className="flex items-start gap-1.5 text-xs">
                <span className="shrink-0 font-bold text-rose-deep">
                  {mine ? myName || "나" : partnerName || "상대"}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-ink">
                  {c.body}
                </span>
                {mine && (
                  <button
                    onClick={() => onDelete(c.id)}
                    className="tap shrink-0 text-[10px] text-muted"
                    aria-label="댓글 삭제"
                  >
                    삭제
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="댓글 달기…"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="flex-1 rounded-full border border-line bg-glass px-3 py-2 text-xs outline-none focus:border-rose"
        />
        <button
          disabled={busy || !draft.trim()}
          onClick={submit}
          aria-label="댓글 보내기"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-50"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}

/** 오늘의 로그 — 하루 2슬롯(오전/오후) 3초 브이로그. 커플 둘의 하루가 나란히.
 *  브이로그 자동재생/탭폴백은 공용 LoopVideo(@/components/LoopVideo)로 통합됨. */
export default function TodayLog({
  coupleId,
  myUserId,
  myName,
  partnerName,
  captureReq,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
  /** 홈 CTA 신호 — 값이 증가하면 오늘·현재 슬롯 촬영을 즉시 연다 */
  captureReq?: number;
}) {
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [dateIso, setDateIso] = useState(() => logDateIso(new Date()));
  const [capture, setCapture] = useState<{
    slot: LogSlot;
    existing: CoupleLog | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [savedFlash, setSavedFlash] = useState<LogSlot | null>(null);
  const [comments, setComments] = useState<LogComment[]>([]);
  const [openComments, setOpenComments] = useState<string | null>(null); // 댓글 펼친 로그 id
  const seqRef = useRef(0); // 마지막 응답만 반영(연속 이벤트 경합 방지)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 이전 방문 시각 — 그 이후 상대 로그에 NEW 배지 (render 에서 읽으므로 state)
  const [lastSeen, setLastSeen] = useState("1970-01-01T00:00:00Z");

  const todayIso = logDateIso(now);

  // 홈 '3초 남기기' CTA → 촬영 즉시 오픈. ref 0 초기화: 첫 마운트에 req>0 이면(=CTA 로 진입) 열어야 함
  const captureReqRef = useRef(0);
  useEffect(() => {
    if (!captureReq || captureReq === captureReqRef.current) return;
    captureReqRef.current = captureReq;
    const d = new Date();
    const slot = slotOf(d);
    const iso = logDateIso(d);
    setDateIso(iso);
    if (canWriteSlot(iso, slot, d)) {
      const existing =
        logs.find(
          (l) => l.log_date === iso && l.slot === slot && l.created_by === myUserId,
        ) ?? null;
      setCapture({ slot, existing });
    }
    // logs/myUserId 는 발화 시점 클로저면 충분 — req 변화 시점에만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureReq]);

  async function doRefresh() {
    const seq = ++seqRef.current;
    try {
      const l = await listCoupleLogs(
        coupleId,
        shiftDateIso(logDateIso(new Date()), -(KEEP_DAYS - 1)),
      );
      if (seq === seqRef.current) {
        setLogs(l);
        setErr(null);
      }
    } catch {
      if (seq === seqRef.current) setErr("불러오기에 실패했어요.");
    }
  }
  const refreshSoon = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doRefresh, 400);
  };

  useEffect(() => {
    // NEW 배지 기준(이전 방문) 읽고, 이번 방문 시각을 기록
    try {
      const stored = localStorage.getItem(`${LS_SEEN}:${coupleId}`);
      if (stored) setLastSeen(stored);
      localStorage.setItem(`${LS_SEEN}:${coupleId}`, new Date().toISOString());
    } catch {
      /* noop */
    }
    doRefresh();
    const unsub = subscribeCoupleLogs(coupleId, refreshSoon);
    // 탭 복귀 시 즉시 갱신 — 서명 URL(1시간) 만료 선제 복구
    const onVis = () => {
      if (document.visibilityState === "visible") doRefresh();
    };
    document.addEventListener("visibilitychange", onVis);
    // 슬롯 경계(12시/자정) 넘어가면 잠금/오픈 상태 갱신 — 1분 시계
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM ref 아님: 시퀀스 카운터를 올려 in-flight 응답을 의도적으로 무효화
      seqRef.current++; // 언마운트 후 응답 무시
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // 브이로그 댓글 — 로드 & 실시간 구독(전체 로드 후 로그별로 필터)
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listLogComments(coupleId)
        .then((c) => !cancelled && setComments(c))
        .catch(() => {});
    load();
    const unsub = subscribeLogComments(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  async function addComment(logId: string, body: string) {
    await addLogComment(coupleId, logId, body);
    listLogComments(coupleId).then(setComments).catch(() => {}); // 즉시 반영(구독 지연 대비)
  }
  function removeComment(id: string) {
    const prev = comments;
    setComments((cur) => cur.filter((c) => c.id !== id)); // 낙관적 제거
    deleteLogComment(id).catch(() => setComments(prev));
  }

  const dayLogs = useMemo(
    () => logs.filter((l) => l.log_date === dateIso),
    [logs, dateIso],
  );
  const cell = (slot: LogSlot, mine: boolean) =>
    dayLogs.find((l) => l.slot === slot && (l.created_by === myUserId) === mine);
  // 로그별 댓글 버튼(💬 개수) — 탭하면 그 로그의 댓글 스레드 토글
  const commentBtn = (log: CoupleLog) => {
    const n = comments.filter((c) => c.log_id === log.id).length;
    const open = openComments === log.id;
    return (
      <button
        onClick={() => setOpenComments((o) => (o === log.id ? null : log.id))}
        className={`tap flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
          open || n > 0 ? "text-rose-deep" : "text-muted"
        }`}
        aria-label="댓글"
      >
        <span>💬</span>
        {n > 0 ? n : "댓글"}
      </button>
    );
  };

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
      setErr(null);
    } catch (e) {
      setLogs(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const isToday = dateIso === todayIso;
  const curSlot = slotOf(now);
  const isNew = (l: CoupleLog) => l.created_at > lastSeen;

  /** 내 칸 렌더 */
  function myCell(slot: LogSlot) {
    const log = cell(slot, true);
    const writable = canWriteSlot(dateIso, slot, now);
    if (log) {
      return (
        <div>
          {log.videoUrl ? (
            <LoopVideo
              src={log.videoUrl}
              overlay={log.body}
              onExpired={() => {
                // 죽은 URL 을 캐시에서 지우고 재서명 — evict 없이는 캐시 히트로 같은 URL 이 돌아온다
                evictSignedUrls([log.video_path]);
                refreshSoon();
              }}
            />
          ) : (
            // (구버전) 텍스트만 있던 로그 하위호환
            log.body && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                {log.body}
              </p>
            )
          )}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          <div className="mt-1 flex items-center gap-1">
            {commentBtn(log)}
            {writable && (
              <button
                onClick={() => setCapture({ slot, existing: log })}
                className="tap rounded-full px-2 py-2 text-[11px] font-semibold text-rose-deep"
              >
                수정
              </button>
            )}
            {/* 삭제는 본인 로그면 언제든(서버 RLS 도 시간 제약 없음) */}
            <button
              onClick={() => remove(log)}
              className="tap rounded-full px-2 py-2 text-[11px] text-muted"
            >
              삭제
            </button>
          </div>
        </div>
      );
    }
    if (writable) {
      return (
        <button
          onClick={() => setCapture({ slot, existing: null })}
          className="tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose/40 bg-glass2 text-xs font-bold text-rose-deep"
        >
          <Icon name="camera" size={20} />
          3초 남기기
        </button>
      );
    }
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
        <div className={isNew(log) ? "animate-pop" : undefined}>
          {isNew(log) && (
            <span className="mb-1 inline-block rounded-full bg-rose/15 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-deep ring-1 ring-rose/40">
              NEW
            </span>
          )}
          {log.videoUrl ? (
            <LoopVideo
              src={log.videoUrl}
              overlay={log.body}
              onExpired={() => {
                // 죽은 URL 을 캐시에서 지우고 재서명 — evict 없이는 캐시 히트로 같은 URL 이 돌아온다
                evictSignedUrls([log.video_path]);
                refreshSoon();
              }}
            />
          ) : (
            log.body && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                {log.body}
              </p>
            )
          )}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          <div className="mt-1">{commentBtn(log)}</div>
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
          onClick={() => setDateIso((d) => shiftDateIso(d, -1))}
          disabled={dateIso <= shiftDateIso(todayIso, -(KEEP_DAYS - 1))}
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
          onClick={() => setDateIso((d) => shiftDateIso(d, 1))}
          disabled={isToday}
          aria-label="다음 날"
          className="tap grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {/* 2×2: 오전/오후 × 나/상대 */}
      <div className="space-y-3">
        {(["am", "pm"] as const).map((slot) => {
          const myLog = cell(slot, true);
          const partnerLog = cell(slot, false);
          // 이 슬롯 안에서 댓글이 펼쳐진 로그(내 것 또는 상대 것)
          const openLog =
            (myLog && myLog.id === openComments && myLog) ||
            (partnerLog && partnerLog.id === openComments && partnerLog) ||
            null;
          return (
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
              {savedFlash === slot && (
                <span className="animate-pop rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold text-white">
                  남겼어요 💗
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

            {/* 댓글 스레드 (펼친 로그) */}
            {openLog && (
              <CommentThread
                comments={comments.filter((c) => c.log_id === openLog.id)}
                myUserId={myUserId}
                myName={my}
                partnerName={partner}
                onAdd={(body) => addComment(openLog.id, body)}
                onDelete={removeComment}
              />
            )}
          </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        오전엔 오전에, 오후엔 오후에 — 슬롯당 3초 브이로그 1개
      </p>
      {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}

      {/* 원-플로우 촬영기 */}
      {capture && (
        <LogCapture
          coupleId={coupleId}
          dateIso={dateIso}
          slot={capture.slot}
          existing={capture.existing}
          onClose={() => setCapture(null)}
          onSaved={() => {
            const slot = capture.slot;
            setCapture(null);
            setSavedFlash(slot);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setSavedFlash(null), 2500);
            doRefresh();
          }}
        />
      )}
    </div>
  );
}
