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
  listLogDays,
  loadIsland,
  saveIsland,
  subscribeCoupleLogs,
  subscribeLogComments,
  uploadLogPoster,
  uploadLogVideo,
  upsertCoupleLog,
} from "@/lib/couple";
import LogCapture from "@/components/LogCapture";
import LogArchive from "@/components/LogArchive";
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
import { LOG_VIDEO_KEEP_DAYS, logVideoExpired } from "@/lib/logretention";
import {
  LOG_SAVE_TIMEOUT_MS,
  LOG_UPLOAD_TIMEOUT_MS,
  SPLIT_SIZE,
  applyLogStreakReward,
  bothRecordedDays,
  dailyMission,
  expiryDaysLeft,
  expirySoon,
  exportFileName,
  followToday,
  freezeLeftThisWeek,
  logIsNew,
  logStreak,
  slotOpenWithGrace,
  withTimeout,
  type LogStreakMark,
} from "@/lib/logreview";
import { type LogDraft, deleteLogDraft, downloadBlob, listLogDrafts } from "@/lib/logdraft";
import { composeClips, shareOrDownload } from "@/lib/logmontage";
import { extForMime } from "@/lib/logvideo";
import { sendEventPush } from "@/lib/notify";
import { getSupabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { SkeletonList } from "@/components/Skeleton";
import { VlogFilmSlot } from "@/components/VlogFilm";

const KEEP_DAYS = 14; // 한 번에 받아 두는 범위(그보다 지난 날은 고를 때 그 날만 받는다)
const LS_SEEN = "ourdays:logseen"; // 상대 새 로그 NEW 배지 기준
const LS_STREAK = "ourdays:logstreak"; // 섬 하트를 이 기기에서 오늘 이미 시도했나(섬 상태가 칸을 잃어도 하루 한 번)
const UNDO_MS = 5000;

function byCreated(a: LogComment, b: LogComment) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}
function removeFile(path: string) {
  getSupabase()?.storage.from("couple-photos").remove([path]).catch(() => {});
}

/** 댓글 목록과 입력창. 입력창은 상대 영상에만 있고(showInput), 빈 목록엔 안내 문구를 띄우지 않는다 — 입력창이 곧 안내다. */
export function CommentThread({
  comments,
  myUserId,
  myName,
  partnerName,
  onAdd,
  onDelete,
  label,
  threadId,
  showInput = true,
}: {
  comments: LogComment[];
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onAdd: (body: string) => Promise<void>;
  onDelete: (id: string) => void;
  label?: string; // 어느 영상의 댓글인지(한 슬롯에 두 영상이 있으므로)
  threadId?: string;
  showInput?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const body = draft.trim();
    if (!body || sending.current) return;
    sending.current = true;
    setError(null);
    setBusy(true);
    try {
      await onAdd(body);
      setDraft("");
    } catch {
      setError("댓글을 보내지 못했어요. 입력한 내용은 남겨 두었어요.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <div id={threadId} className="vlog-comment-thread">
      {label && <p className="vlog-comment-label">{label}</p>}
      {comments.length > 0 && (
        <ul className="vlog-comments">
          {comments.map((c) => {
            const mine = c.created_by === myUserId;
            return (
              <li key={c.id}>
                <span className="vlog-comment-author">{mine ? myName || "나" : partnerName || "상대"}</span>
                <span className="vlog-comment-body">{c.body}</span>
                {mine && (
                  <button onClick={() => onDelete(c.id)} className="tap vlog-comment-delete" aria-label="댓글 삭제">
                    삭제
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showInput && (
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="댓글 입력"
          placeholder="댓글 달기…"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          className="min-w-0 flex-1 rounded-full border border-line bg-glass px-3 py-2 text-xs outline-none focus:border-rose"
        />
        <button
          disabled={busy || !draft.trim()}
          onClick={submit}
          aria-label="댓글 보내기"
          className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-50"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-deep">{error}</p>}
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
  const [extra, setExtra] = useState<CoupleLog[]>([]); // 받아 둔 범위 밖의 날(보관함에서 고른 날)
  const [dateIso, setDateIso] = useState(() => logDateIso(new Date()));
  const [capture, setCapture] = useState<{
    slot: LogSlot;
    existing: CoupleLog | null;
    reply?: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [savedFlash, setSavedFlash] = useState<LogSlot | null>(null);
  const [comments, setComments] = useState<LogComment[]>([]);
  const [undo, setUndo] = useState<LogComment | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [staleDrafts, setStaleDrafts] = useState<LogDraft[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [streak, setStreak] = useState<ReturnType<typeof logStreak> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [splitBusy, setSplitBusy] = useState<LogSlot | null>(null);
  const seqRef = useRef(0); // 마지막 응답만 반영(연속 이벤트 경합 방지)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<LogComment | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const captureOpenRef = useRef(false);
  const rewardDayRef = useRef<string | null>(null);
  const dateRef = useRef(dateIso);
  const prevTodayRef = useRef(logDateIso(new Date()));
  // 이전 방문 시각 — 그 이후 상대 로그에 NEW 배지 (render 에서 읽으므로 state)
  const [lastSeen, setLastSeen] = useState("1970-01-01T00:00:00Z");

  const todayIso = logDateIso(now);
  const rangeStart = shiftDateIso(todayIso, -(KEEP_DAYS - 1));
  useEffect(() => { dateRef.current = dateIso; }, [dateIso]);
  useEffect(() => { captureOpenRef.current = !!capture; }, [capture]);

  function flash(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }

  // 홈 '3초 남기기' CTA → 촬영 즉시 오픈. ref 0 초기화: 첫 마운트에 req>0 이면(=CTA 로 진입) 열어야 함
  // ⚠ 목록이 오기 전이면 existing 이 null 이다 — 그래도 괜찮다: 새 로그인지는 저장 직전에 서버가 다시 본다(푸시 중복 방지).
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
    const today = logDateIso(new Date());
    const start = shiftDateIso(today, -(KEEP_DAYS - 1));
    const viewing = dateRef.current;
    try {
      const [l, x, days] = await Promise.all([
        listCoupleLogs(coupleId, start),
        viewing < start ? listCoupleLogs(coupleId, viewing, viewing) : Promise.resolve<CoupleLog[]>([]),
        myUserId ? listLogDays(coupleId, shiftDateIso(today, -70)).catch(() => null) : Promise.resolve(null),
      ]);
      if (seq === seqRef.current) {
        setLogs(l);
        setExtra(x);
        setErr(null);
        if (days && myUserId) {
          const s = logStreak(bothRecordedDays(days, myUserId), today);
          setStreak(s);
          rewardStreak(s, today);
        }
      }
    } catch {
      if (seq === seqRef.current) setErr("불러오기에 실패했어요.");
    }
  }
  const refreshSoon = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doRefresh, 400);
  };

  /** '둘 다 남긴 날' 연속 기록의 섬 하트 — 하루 한 번(섬 상태의 logStreak 칸 + 이 기기 기록). 섬의 낙관적 버전을 지킨다:
   *  충돌이면 다시 읽고 한 번만 더 — 그 사이 상대 기기가 먼저 줬으면 '이미 받음'으로 끝난다(같은 입력 = 같은 결과). */
  async function rewardStreak(s: ReturnType<typeof logStreak>, today: string) {
    if (!s.doneToday || s.count < 2 || rewardDayRef.current === today) return;
    rewardDayRef.current = today;
    const lsKey = `${LS_STREAK}:${coupleId}`;
    try { if (localStorage.getItem(lsKey) === today) return; } catch { /* noop */ }
    type WithStreak = { coins: number; logStreak?: LogStreakMark };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const row = await loadIsland(coupleId);
        if (!row) return;
        const next = applyLogStreakReward(row.state as unknown as WithStreak, today, s.count);
        try { localStorage.setItem(lsKey, today); } catch { /* noop */ }
        if (!next) return;
        await saveIsland(coupleId, row.version, next as unknown as typeof row.state);
        flash(`둘 다 남긴 날 ${s.count}일째 · 섬 하트 +${next.logStreak?.hearts ?? 0}`);
        return;
      } catch {
        /* 버전 충돌 · 일시 오류 — 한 번만 다시 */
      }
    }
  }

  /** 기기 보관함 다시 올리기 — 화면을 열 때 · 연결이 돌아올 때 · 촬영기를 닫을 때.
   *  슬롯 유예(서버와 같은 5분) 안이면 저절로 올리고, 지났으면 알려서 기기에 저장 / 지우기를 고르게 한다. */
  async function flushDrafts(captureClosed = false) {
    // 촬영기가 열려 있으면 그쪽이 같은 영상을 올리고 있을 수 있다 — 닫힌 뒤에만(captureClosed = 방금 닫았음)
    if (flushingRef.current || (captureOpenRef.current && !captureClosed)) return;
    flushingRef.current = true;
    try {
      const all = await listLogDrafts(coupleId);
      const stale: LogDraft[] = [];
      let posted = 0;
      for (const d of all) {
        if (!slotOpenWithGrace(d.dateIso, d.slot, new Date())) { stale.push(d); continue; }
        if (typeof navigator !== "undefined" && navigator.onLine === false) continue;
        try {
          const path = await withTimeout(uploadLogVideo(coupleId, d.blob, extForMime(d.mime)), LOG_UPLOAD_TIMEOUT_MS, removeFile);
          const poster = d.poster ? await withTimeout(uploadLogPoster(coupleId, d.poster), 15_000, (p) => { if (p) removeFile(p); }).catch(() => null) : null;
          const res = await withTimeout(upsertCoupleLog(coupleId, d.dateIso, d.slot, d.body, null, path, null, poster), LOG_SAVE_TIMEOUT_MS);
          await deleteLogDraft(d.key);
          posted += 1;
          if (res.created) sendEventPush(coupleId, "log", `🎬 ${slotLabel(d.slot)} 브이로그 도착!`, d.body || "상대의 3초를 확인해 보세요");
        } catch (e) {
          if (/slot-closed/.test(e instanceof Error ? e.message : "")) stale.push(d);
          // 그 밖(연결 · 시간 초과)은 보관함에 그대로 두고 다음 기회에
        }
      }
      setStaleDrafts(stale);
      if (posted) {
        flash("보관해 둔 3초를 올렸어요");
        doRefresh();
      }
    } catch {
      /* 보관함이 없는 환경 */
    } finally {
      flushingRef.current = false;
    }
  }

  /** 자정 넘김 — 보던 날이 '방금 전의 오늘'이면 새 오늘로 따라간다. 1분 시계 + 화면 복귀(잠든 폰은 타이머가 밀린다). */
  function syncClock() {
    const d = new Date();
    const t = logDateIso(d);
    const prev = prevTodayRef.current;
    if (t !== prev) {
      prevTodayRef.current = t;
      setDateIso((cur) => followToday(cur, prev, t));
    }
    setNow(d);
  }

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
    flushDrafts();
    const unsub = subscribeCoupleLogs(coupleId, refreshSoon);
    // 탭 복귀 시 즉시 갱신 — 서명 URL(1시간) 만료 선제 복구
    const onVis = () => {
      if (document.visibilityState === "visible") {
        syncClock();
        doRefresh();
        flushDrafts();
      }
    };
    const onOnline = () => flushDrafts();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    // 슬롯 경계(12시/자정) 넘어가면 잠금/오픈 상태 갱신 — 1분 시계
    const tick = setInterval(syncClock, 60_000);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM ref 아님: 시퀀스 카운터를 올려 in-flight 응답을 의도적으로 무효화
      seqRef.current++; // 언마운트 후 응답 무시
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      unsub();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // 받아 둔 범위 밖의 날을 고르면 그 날만 받는다(보관함 · 이전 날 화살표로 90일까지).
  useEffect(() => {
    if (dateIso >= rangeStart) return;
    let off = false;
    listCoupleLogs(coupleId, dateIso, dateIso)
      .then((x) => { if (!off) setExtra(x); })
      .catch(() => { if (!off) setErr("그 날의 로그를 불러오지 못했어요."); });
    return () => { off = true; };
  }, [coupleId, dateIso, rangeStart]);

  const allLogs = useMemo(() => {
    const seen = new Set(logs.map((l) => l.id));
    return [...logs, ...extra.filter((l) => !seen.has(l.id))];
  }, [logs, extra]);

  // 브이로그 댓글 — 보이는 로그 것만(in()). 실시간 이벤트는 모아서 한 번(300ms) 다시 받는다.
  const idsKey = useMemo(() => allLogs.map((l) => l.id).sort().join(","), [allLogs]);
  const loadRef = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    loadRef.current = () => {
      listLogComments(coupleId, ids)
        .then((c) => {
          if (cancelled) return;
          const hidden = pendingDeleteRef.current?.id;
          setComments(hidden ? c.filter((x) => x.id !== hidden) : c);
        })
        .catch(() => {});
    };
    loadRef.current();
    return () => { cancelled = true; };
  }, [coupleId, idsKey]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => loadRef.current(), 300);
    };
    const u1 = subscribeLogComments(coupleId, soon);
    return () => {
      if (t) clearTimeout(t);
      u1();
      // 떠나는 순간 되돌리기 대기 중이던 삭제는 바로 실행한다(되돌리기 창이 사라지므로).
      const pending = pendingDeleteRef.current;
      if (pending) {
        pendingDeleteRef.current = null;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        deleteLogComment(pending.id).catch(() => {});
      }
    };
  }, [coupleId]);

  async function addComment(logId: string, body: string) {
    await addLogComment(coupleId, logId, body);
    loadRef.current(); // 즉시 반영(구독 지연 대비)
  }
  /** 댓글 삭제 — 바로 지우지 않고 5초 되돌리기 창을 준다(지운 뒤엔 되살릴 수 없다). */
  function commitDelete() {
    const r = pendingDeleteRef.current;
    if (!r) return;
    pendingDeleteRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndo(null);
    deleteLogComment(r.id).catch(() => {
      setComments((cur) => (cur.some((c) => c.id === r.id) ? cur : [...cur, r].sort(byCreated)));
      setErr("댓글을 삭제하지 못했어요. 원래 댓글을 복원했어요. 다시 시도해 주세요.");
    });
  }
  function removeComment(id: string) {
    const removed = comments.find((comment) => comment.id === id);
    if (!removed) return;
    commitDelete(); // 앞서 대기 중이던 삭제는 확정
    setComments((cur) => cur.filter((c) => c.id !== id)); // 낙관적 제거
    pendingDeleteRef.current = removed;
    setUndo(removed);
    undoTimerRef.current = setTimeout(commitDelete, UNDO_MS);
  }
  function undoDelete() {
    const r = pendingDeleteRef.current;
    if (!r) return;
    pendingDeleteRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndo(null);
    setComments((cur) => (cur.some((c) => c.id === r.id) ? cur : [...cur, r].sort(byCreated)));
  }

  /** 이 영상을 기기에 저장(폰은 공유 시트로 사진 앱에 넣을 수 있다). 서명 주소에서 받아 그대로 넘긴다 — 다시 굽지 않는다. */
  async function saveClip(log: CoupleLog) {
    if (saving) return;
    setSaving(log.id);
    try {
      const res = await fetch(log.videoUrl);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const how = await shareOrDownload(blob, exportFileName("clip", `${log.log_date}-${log.slot}`, blob.type), `${log.log_date.replaceAll("-", ".")} ${slotLabel(log.slot)} 3초 로그`);
      if (how !== "cancelled") flash(how === "shared" ? "공유했어요" : "기기에 저장했어요");
    } catch {
      flash("영상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(null);
    }
  }

  /** 같은 슬롯 나 | 상대 나란히 한 편(이 기기에서 굽는다). */
  async function exportSplit(slot: LogSlot, mine: CoupleLog, theirs: CoupleLog) {
    if (splitBusy) return;
    setSplitBusy(slot);
    try {
      const out = await composeClips([{ sources: [mine.videoUrl, theirs.videoUrl] }], {
        ...SPLIT_SIZE,
        perClipMs: 3000,
        signal: new AbortController().signal,
      });
      const how = await shareOrDownload(out.blob, exportFileName("split", `${dateIso}-${slot}`, out.mime), `${dateIso.replaceAll("-", ".")} ${slotLabel(slot)}의 우리`);
      if (how !== "cancelled") flash(how === "shared" ? "공유했어요" : "기기에 저장했어요");
    } catch (e) {
      flash(e instanceof Error ? e.message : "나란히 영상을 만들지 못했어요.");
    } finally {
      setSplitBusy(null);
    }
  }

  const dayLogs = useMemo(
    () => allLogs.filter((l) => l.log_date === dateIso),
    [allLogs, dateIso],
  );
  const cell = (slot: LogSlot, mine: boolean) =>
    dayLogs.find((l) => l.slot === slot && (l.created_by === myUserId) === mine);
  const commentCountOf = (log: CoupleLog | null | undefined) => (log ? comments.filter((c) => c.log_id === log.id).length : 0);
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
    setExtra((cur) => cur.filter((x) => x.id !== l.id));
    try {
      await deleteCoupleLog(l.id, l.video_path, l.poster_path ?? null);
      setErr(null);
    } catch (e) {
      setLogs(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const isToday = dateIso === todayIso;
  const curSlot = slotOf(now);
  const isNew = (l: CoupleLog) => logIsNew(l, lastSeen);
  const myTodayLog = allLogs.find((l) => l.log_date === todayIso && l.slot === curSlot && l.created_by === myUserId) ?? null;

  /** 빈/잠김 상태도 영상과 같은 aspect-3/4 박스로 → 한쪽만 영상이어도 두 칸 크기가 맞음 */
  const emptyCell = (node: React.ReactNode) => (
    <div className="grid aspect-[3/4] w-full place-items-center rounded-xl bg-glass2 px-2 text-center ring-1 ring-line">
      <span className="flex flex-col items-center gap-1 whitespace-pre-line text-sm leading-snug text-muted">
        {node}
      </span>
    </div>
  );

  /** 보관 기간이 지나 영상만 정리된 로그 — 빈 칸처럼 보이면 '내 영상이 사라졌다'로 읽힌다. 이유를 말해 준다. */
  const expiredNote = (
    <p className="flex items-center gap-1 text-xs text-muted">
      <Icon name="camera" size={12} />
      영상은 {LOG_VIDEO_KEEP_DAYS}일이 지나 정리됐어요
    </p>
  );

  /** 곧 정리될 영상(D-7) — 내 영상이면 별로 남길 수 있다고 알려 준다. */
  const expiryBadge = (log: CoupleLog) => {
    if (!expirySoon(log, todayIso)) return null;
    const left = expiryDaysLeft(log, todayIso) ?? 0;
    return (
      <span className="vlog-expiry-badge" title="이 날이 지나면 영상만 정리돼요">
        D-{left} 정리
      </span>
    );
  };

  /** 내 칸 렌더 */
  function myCell(slot: LogSlot) {
    const log = cell(slot, true);
    const writable = canWriteSlot(dateIso, slot, now);
    if (log) {
      // 영상이 있으면 수정/삭제를 '영상 위 하단 오버레이'로 → 셀 높이가 영상(aspect-3/4)
      // 딱 그만큼이라 상대 칸과 정확히 동일 크기. (예전엔 버튼 행이 내 칸만 더 높게 만들었음)
      if (log.videoUrl) {
        return (
          <div className="relative">
            <LoopVideo
              src={log.videoUrl}
              poster={log.posterUrl}
              label={`${my}의 ${slotLabel(slot)} 영상`}
              overlay={log.body}
              onExpired={() => {
                // 죽은 URL 을 캐시에서 지우고 재서명 — evict 없이는 캐시 히트로 같은 URL 이 돌아온다
                evictSignedUrls([log.video_path, log.poster_path ?? null]);
                refreshSoon();
              }}
            />
            {expiryBadge(log)}
            {/* 수정/삭제를 영상 아래로 — 셀 높이가 영상(aspect-3/4)
                딱 그만큼이라 상대 칸과 정확히 동일 크기. */}
            <div className="vlog-film-actions">
              <button
                type="button"
                disabled={saving === log.id}
                onClick={() => void saveClip(log)}
                aria-label="이 영상 저장"
                className="tap vlog-film-action"
              >
                {saving === log.id ? "저장 중…" : "저장"}
              </button>
              <div className="vlog-film-edit-actions">
                {writable && (
                  <button
                    onClick={() => setCapture({ slot, existing: log })}
                    className="tap vlog-film-action"
                  >
                    수정
                  </button>
                )}
                {/* 삭제는 본인 로그면 언제든(서버 RLS 도 시간 제약 없음) */}
                <button
                  onClick={() => remove(log)}
                  aria-label="이 로그 삭제"
                  className="tap vlog-film-action vlog-film-danger flex items-center justify-center gap-1"
                >
                  <Icon name="trash" size={12} />
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      }
      // 글 로그(구버전) · 보관 기간이 지나 영상만 정리된 로그 — 영상이 없으니 버튼은 아래에
      return (
        <div>
          {logVideoExpired(log) && expiredNote}
          {log.body && (
            <p className="prose-ko mt-0.5 whitespace-pre-wrap text-ink">
              {log.body}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1">
            {writable && (
              <button
                onClick={() => setCapture({ slot, existing: log })}
                className="tap rounded-full px-2 py-2 text-sm font-semibold text-rose-deep"
              >
                수정
              </button>
            )}
            <button
              onClick={() => remove(log)}
              className="tap rounded-full px-2 py-2 text-sm text-muted"
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
          className="tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose/40 bg-glass2 px-2 text-xs font-bold text-rose-deep"
        >
          <Icon name="camera" size={20} />
          3초 남기기
          {/* 오늘의 미션 — 날짜로 정해져 둘이 같은 미션을 본다 */}
          <span className="vlog-mission">오늘의 미션 · {dailyMission(dateIso, slot)}</span>
        </button>
      );
    }
    const future = isToday && slot === "pm" && curSlot === "am";
    return emptyCell(
      future ? (
        <>
          <Icon name="lock" size={14} />
          12시에 열려요
        </>
      ) : isToday ? (
        `${slotLabel(slot)}이 지나\n이제 남길 수 없어요`
      ) : (
        "조용히 지나갔어요"
      ),
    );
  }

  function partnerCell(slot: LogSlot) {
    const log = cell(slot, false);
    if (log) {
      // 영상이면 내 칸과 동일하게: NEW 뱃지를 영상 위 오버레이로 → 셀 크기 동일(aspect-3/4)
      if (log.videoUrl) {
        return (
          <div className={`relative ${isNew(log) ? "animate-pop" : ""}`}>
            <LoopVideo
              src={log.videoUrl}
              poster={log.posterUrl}
              label={`${partner}의 ${slotLabel(slot)} 영상`}
              overlay={log.body}
              onExpired={() => {
                evictSignedUrls([log.video_path, log.poster_path ?? null]);
                refreshSoon();
              }}
            />
            {isNew(log) && (
              <span className="absolute left-1 top-1 rounded-full bg-rose-deep/90 px-1.5 py-0.5 text-xs font-extrabold text-white shadow-[var(--shadow-sm)]">
                NEW
              </span>
            )}
            {expiryBadge(log)}
            <div className="vlog-film-actions">
              <button
                type="button"
                disabled={saving === log.id}
                onClick={() => void saveClip(log)}
                aria-label="이 영상 저장"
                className="tap vlog-film-action"
              >
                {saving === log.id ? "저장 중…" : "저장"}
              </button>
              {/* 3초 답장 — 상대 클립을 보고 바로 내 지금 슬롯을 찍는다(오늘 · 지금 슬롯만 열려 있다) */}
              <button
                onClick={() => {
                  setDateIso(todayIso);
                  setCapture({ slot: curSlot, existing: myTodayLog, reply: true });
                }}
                className="tap vlog-film-action flex items-center justify-center gap-1"
              >
                <Icon name="camera" size={12} />
                3초 답장
              </button>
            </div>
          </div>
        );
      }
      // 글 로그(구버전) · 보관 기간이 지나 영상만 정리된 로그
      return (
        <div className={isNew(log) ? "animate-pop" : undefined}>
          {isNew(log) && (
            <span className="mb-1 inline-block rounded-full bg-rose/15 px-1.5 py-0.5 text-xs font-extrabold text-rose-deep ring-1 ring-rose/40">
              NEW
            </span>
          )}
          {logVideoExpired(log) && expiredNote}
          {log.body && (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
              {log.body}
            </p>
          )}
        </div>
      );
    }
    const future = isToday && slot === "pm" && curSlot === "am";
    return emptyCell(
      future
        ? "아직이에요"
        : isToday && slot === curSlot
          ? "아직 안 남겼어요"
          : "조용히 지나갔어요",
    );
  }

  const my = (myName || "나").trim();
  const partner = (partnerName || "상대").trim();

  // uid 해석 전에는 나/상대 칸 매칭이 불가능(내 로그가 상대 칸에 보임) → 스켈레톤
  if (!myUserId) {
    return <SkeletonList rows={2} />;
  }

  return (
    <div className="vlog-journal">
      {/* 기록 탭의 브이로그도 고유한 제목과 오전/오후 필름 구조를 갖는다. */}
      <header className="vlog-journal-heading"><p>매일의 3초</p><h1>우리의 3초 필름</h1><span>오전 한 장면, 오후 한 장면. 나란히 쌓이는 하루.</span></header>
      {streak && streak.count > 0 && (
        <p className="vlog-streak" role="status">
          둘 다 남긴 날 {streak.count}일 연속
          {streak.doneToday ? "" : " · 오늘도 둘 다 남기면 이어져요"}
          {freezeLeftThisWeek(streak.freezes, todayIso) ? " · 이번 주 쉬어 가기 1번" : " · 이번 주 쉬어 가기 씀"}
        </p>
      )}
      {staleDrafts.map((d) => (
        <div key={d.key} className="vlog-draft-note" role="alert">
          <p>{d.dateIso.replaceAll("-", ".")} {slotLabel(d.slot)} 영상은 시간이 지나 올리지 못했어요. 이 기기에만 남아 있어요.</p>
          <div>
            <button type="button" className="tap vlog-film-action" onClick={() => downloadBlob(d.blob, `our-3s-${d.dateIso}-${d.slot}.${extForMime(d.mime)}`)}>기기에 저장</button>
            <button
              type="button"
              className="tap vlog-film-action vlog-film-danger"
              onClick={() => {
                deleteLogDraft(d.key).catch(() => {});
                setStaleDrafts((cur) => cur.filter((x) => x.key !== d.key));
              }}
            >
              지우기
            </button>
          </div>
        </div>
      ))}
      {/* 날짜 네비 — 화살표로 90일(보관 기간)까지, 그보다 넓게는 보관함 달력으로 */}
      <div className="vlog-date-nav">
        <button
          onClick={() => setDateIso((d) => shiftDateIso(d, -1))}
          disabled={dateIso <= shiftDateIso(todayIso, -LOG_VIDEO_KEEP_DAYS)}
          aria-label="이전 날"
          className="tap grid h-12 w-12 place-items-center rounded-xl text-muted disabled:opacity-30"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-extrabold text-ink tabular-nums">
            {dateIso.replaceAll("-", ".")}
          </p>
          <p className="text-xs font-semibold text-rose-deep">
            {isToday ? `오늘 · 지금은 ${slotLabel(curSlot)}` : "지난 로그"}
          </p>
        </div>
        <button
          onClick={() => setDateIso((d) => shiftDateIso(d, 1))}
          disabled={isToday}
          aria-label="다음 날"
          className="tap grid h-12 w-12 place-items-center rounded-xl text-muted disabled:opacity-30"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div className="vlog-archive-toggle">
        <button type="button" className="tap vlog-film-action" aria-expanded={showArchive} onClick={() => setShowArchive((v) => !v)}>
          <Icon name="calendar" size={12} /> {showArchive ? "보관함 접기" : "지난 필름 모아보기 · 한 달 필름"}
        </button>
        {!isToday && (
          <button type="button" className="tap vlog-film-action" onClick={() => setDateIso(todayIso)}>오늘로</button>
        )}
      </div>
      {showArchive && (
        <LogArchive
          coupleId={coupleId}
          myUserId={myUserId}
          todayIso={todayIso}
          onPick={(d) => {
            setDateIso(d);
            setShowArchive(false);
          }}
        />
      )}

      {/* 2×2: 오전/오후 × 나/상대 */}
      <div className="space-y-3">
        {(["am", "pm"] as const).map((slot) => {
          const myLog = cell(slot, true);
          const partnerLog = cell(slot, false);
          return (
          <VlogFilmSlot
            key={slot}
            slot={slot} current={isToday && slot === curSlot} saved={savedFlash === slot ? <span className="text-xs font-bold text-rose-deep">남겼어요</span> : null}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-muted">{my}</p>
                {myCell(slot)}
              </div>
              {/* border-l/pl 비대칭 제거 — gap-3 로 분리하면 두 칸 영상 폭이 정확히 동일 */}
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-muted">
                  {partner}
                </p>
                {partnerCell(slot)}
              </div>
            </div>

            {myLog?.videoUrl && partnerLog?.videoUrl && (
              <button
                type="button"
                className="tap vlog-film-action vlog-split-export"
                disabled={!!splitBusy}
                onClick={() => exportSplit(slot, myLog, partnerLog)}
              >
                {splitBusy === slot ? "나란히 만드는 중…" : "나 | 상대 나란히 저장"}
              </button>
            )}

            {/* 댓글은 상대 영상에만 단다. 내 영상은 받은 댓글이 있을 때만 읽기로 보여 준다 */}
            {myLog && comments.some((c) => c.log_id === myLog.id) && (
              <CommentThread
                threadId={`log-comments-${myLog.id}`}
                label="내 영상에 달린 댓글"
                comments={comments.filter((c) => c.log_id === myLog.id)}
                myUserId={myUserId}
                myName={my}
                partnerName={partner}
                onAdd={(body) => addComment(myLog.id, body)}
                onDelete={removeComment}
                showInput={false}
              />
            )}
            {partnerLog && (
              <CommentThread
                threadId={`log-comments-${partnerLog.id}`}
                label={`${partner}의 영상에 댓글`}
                comments={comments.filter((c) => c.log_id === partnerLog.id)}
                myUserId={myUserId}
                myName={my}
                partnerName={partner}
                onAdd={(body) => addComment(partnerLog.id, body)}
                onDelete={removeComment}
              />
            )}
          </VlogFilmSlot>
          );
        })}
      </div>

      <p className="mt-3 text-center text-sm text-muted">
        오전엔 오전에, 오후엔 오후에 — 슬롯당 3초 브이로그 1개
      </p>
      {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}

      {/* 되돌리기 · 알림 띠 */}
      {(undo || toast) && (
        <div className="vlog-toast" role="status" aria-live="polite">
          {undo ? (
            <>
              <span>댓글을 지웠어요</span>
              <button type="button" className="tap" onClick={undoDelete}>되돌리기</button>
            </>
          ) : (
            <span>{toast}</span>
          )}
        </div>
      )}

      {/* 원-플로우 촬영기 */}
      {capture && (
        <LogCapture
          coupleId={coupleId}
          dateIso={capture.reply ? todayIso : dateIso}
          slot={capture.slot}
          existing={capture.existing}
          commentCount={commentCountOf(capture.existing)}
          mission={capture.existing ? null : dailyMission(capture.reply ? todayIso : dateIso, capture.slot)}
          replyTo={capture.reply ? partner : null}
          onClose={() => {
            setCapture(null);
            flushDrafts(true); // 올리는 중에 닫았으면 보관함의 영상을 뒤에서 이어서 올린다
          }}
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
