"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoupleLog,
  deleteCoupleLog,
  listCoupleLogs,
  subscribeCoupleLogs,
  uploadLogVideo,
  upsertCoupleLog,
} from "@/lib/couple";
import {
  LOG_VIDEO_FALLBACK_MAX_S,
  LOG_VIDEO_MAX_BYTES,
  extForMime,
} from "@/lib/logvideo";
import CameraRecorder from "@/components/CameraRecorder";
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

const LOG_MOODS = ["😊", "🥰", "😴", "🔥", "☁️", "😮‍💨", "🥳", "😭"];
const MAX_LEN = 100;
const KEEP_DAYS = 14; // 브라우징 범위

function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return logDateIso(new Date(y, m - 1, d + delta));
}

/** 셋로그식 3초 루프 재생 — 자동재생(음소거 시작, 모바일 정책) + 탭하면 소리 토글. */
function LoopVideo({ src }: { src: string }) {
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
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white">
        <Icon name={muted ? "volumeX" : "volume"} size={13} />
      </span>
    </button>
  );
}

/** 오늘의 로그 — 하루 2슬롯(오전/오후), 슬롯당 1개. 커플 둘의 하루를 나란히. */
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
  const [editingSlot, setEditingSlot] = useState<LogSlot | null>(null);
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  // 3초 영상 상태 — 새로 찍은 blob / 유지할 기존 경로 / 미리보기 URL / 녹화기 표시
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoMime, setVideoMime] = useState("video/mp4");
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [keepVideo, setKeepVideo] = useState<string | null>(null);
  const [showCam, setShowCam] = useState(false);
  const fallbackFileRef = useRef<HTMLInputElement>(null);

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
    dayLogs.find(
      (l) => l.slot === slot && (l.created_by === myUserId) === mine,
    );

  function resetVideoState() {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoBlob(null);
    setVideoPreview(null);
    setKeepVideo(null);
  }

  async function save(slot: LogSlot) {
    const hasVideo = !!videoBlob || !!keepVideo;
    if (!body.trim() && !hasVideo) {
      setErr("3초 영상이나 한 줄 중 하나는 남겨야 해요.");
      return;
    }
    // 제출 시점 재검증 — 작성 중 12시/자정을 넘겼으면 저장 거부(초안은 보존, 서버 RLS 도 거부함)
    if (!canWriteSlot(dateIso, slot, new Date())) {
      setErr(
        `${slotLabel(slot)} 시간이 지나 저장할 수 없어요. 작성한 내용은 지워지지 않았으니 복사해 두세요.`,
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const prevPath = cell(slot, true)?.video_path ?? null;
      let videoPath = keepVideo;
      if (videoBlob) {
        videoPath = await uploadLogVideo(
          coupleId,
          videoBlob,
          extForMime(videoMime),
        );
      }
      await upsertCoupleLog(
        coupleId,
        dateIso,
        slot,
        body.trim(),
        mood || null,
        videoPath,
        prevPath,
      );
      setEditingSlot(null);
      setBody("");
      setMood("");
      resetVideoState();
      setLogs(await listCoupleLogs(coupleId, shiftIso(todayIso, -(KEEP_DAYS - 1))));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** 카메라 폴백(<input capture>)으로 받은 파일 검증 — 길이/용량 제한. */
  function onFallbackFile(f: File | null) {
    if (!f) return;
    if (f.size > LOG_VIDEO_MAX_BYTES) {
      setErr("영상이 너무 커요. 6MB 이하로 짧게 찍어주세요.");
      return;
    }
    const url = URL.createObjectURL(f);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (probe.duration > LOG_VIDEO_FALLBACK_MAX_S) {
        URL.revokeObjectURL(url);
        setErr(`${LOG_VIDEO_FALLBACK_MAX_S}초 이내로 짧게 찍어주세요.`);
        return;
      }
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideoBlob(f);
      setVideoMime(f.type || "video/mp4");
      setVideoPreview(url);
      setKeepVideo(null);
      setErr(null);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setErr("영상을 읽을 수 없어요.");
    };
    probe.src = url;
  }

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

  function openEditor(slot: LogSlot) {
    const mine = cell(slot, true);
    setBody(mine?.body ?? "");
    setMood(mine?.emoji ?? "");
    resetVideoState();
    setKeepVideo(mine?.video_path ?? null);
    setEditingSlot(slot);
  }

  const isToday = dateIso === todayIso;
  const curSlot = slotOf(now);

  /** 슬롯 에디터 — 카드 전체 폭으로 렌더(좁은 반칸에서 버튼 밀림 방지).
   *  writable 과 무관하게 editingSlot 이 열려 있는 동안 유지 → 12시/자정 경계에
   *  타이핑 중이던 초안이 사라지지 않음(저장은 save() 재검증 + 서버 RLS 가 거부). */
  function editor(slot: LogSlot) {
    const log = cell(slot, true);
    const existingUrl = keepVideo && log?.video_path === keepVideo ? log?.videoUrl : "";
    return (
      <div className="space-y-2">
        {/* 3초 브이로그 */}
        {videoPreview || existingUrl ? (
          <div>
            <video
              src={videoPreview || existingUrl}
              playsInline
              muted
              autoPlay
              loop
              className="max-h-44 w-full rounded-xl bg-black/20 object-contain"
            />
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => setShowCam(true)}
                className="tap rounded-full px-2 py-2 text-[11px] font-semibold text-rose-deep"
              >
                다시 찍기
              </button>
              <button
                onClick={resetVideoState}
                className="tap rounded-full px-2 py-2 text-[11px] text-muted"
              >
                영상 빼기
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCam(true)}
            className="tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose/40 bg-glass2 py-3 text-xs font-bold text-rose-deep"
          >
            <Icon name="image" size={14} />
            3초 영상 찍기 (선택)
          </button>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
          placeholder="한 줄 남기기 (선택)"
          rows={3}
          autoFocus
          className="w-full resize-none rounded-xl border border-line bg-glass px-3 py-2 text-sm text-ink outline-none focus:border-rose"
        />
        <div className="flex flex-wrap gap-1">
          {LOG_MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(mood === m ? "" : m)}
              aria-label={`기분 ${m}`}
              aria-pressed={mood === m}
              className={`tap grid h-9 w-9 place-items-center rounded-lg text-base ${
                mood === m ? "bg-rose/20 ring-1 ring-rose" : "bg-glass ring-1 ring-line"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[10px] text-muted tabular-nums">
            {body.length}/{MAX_LEN}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setEditingSlot(null)}
              className="tap whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-muted"
            >
              취소
            </button>
            <button
              disabled={(!body.trim() && !videoBlob && !keepVideo) || busy}
              onClick={() => save(slot)}
              className="tap whitespace-nowrap rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-[var(--shadow-sm)] disabled:opacity-40"
            >
              {busy ? "저장 중…" : log ? "수정" : "남기기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /** 내 칸 렌더 */
  function myCell(slot: LogSlot) {
    const log = cell(slot, true);
    const writable = canWriteSlot(dateIso, slot, now);
    if (log) {
      return (
        <div>
          {log.videoUrl && <LoopVideo src={log.videoUrl} />}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          {log.body && (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{log.body}</p>
          )}
          {writable && (
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => openEditor(slot)}
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
          onClick={() => openEditor(slot)}
          className="tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose/40 bg-glass2 py-4 text-xs font-bold text-rose-deep"
        >
          <Icon name="plus" size={14} strokeWidth={2.4} />
          {slotLabel(slot)} 로그 남기기
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
          {log.videoUrl && <LoopVideo src={log.videoUrl} />}
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          {log.body && (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{log.body}</p>
          )}
        </div>
      );
    }
    const future = isToday && slot === "pm" && curSlot === "am";
    return (
      <p className="py-3 text-xs text-muted">
        {future ? "아직이에요" : isToday && slot === curSlot ? "아직 안 남겼어요" : "조용히 지나갔어요 ☁️"}
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
            {editingSlot === slot ? (
              // 에디터는 카드 전체 폭 — 좁은 반칸(≈145px)에서 버튼이 밀리지 않게
              editor(slot)
            ) : (
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
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        오전엔 오전에, 오후엔 오후에 — 슬롯당 3초 영상 1개씩
      </p>
      {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}

      {/* 인앱 3초 녹화기 (미지원/권한거부 시 네이티브 카메라 폴백) */}
      {showCam && (
        <CameraRecorder
          onDone={(blob, mime) => {
            if (videoPreview) URL.revokeObjectURL(videoPreview);
            setVideoBlob(blob);
            setVideoMime(mime);
            setVideoPreview(URL.createObjectURL(blob));
            setKeepVideo(null);
            setShowCam(false);
          }}
          onClose={() => setShowCam(false)}
          onNeedFallback={() => {
            setShowCam(false);
            fallbackFileRef.current?.click();
          }}
        />
      )}
      <input
        ref={fallbackFileRef}
        type="file"
        accept="video/*"
        capture="user"
        hidden
        onChange={(e) => {
          onFallbackFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}
