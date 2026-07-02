"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import {
  LOG_VIDEO_BPS,
  LOG_VIDEO_FALLBACK_MAX_S,
  LOG_VIDEO_MAX_BYTES,
  LOG_VIDEO_MS,
  extForMime,
  pickVideoMime,
} from "@/lib/logvideo";
import {
  type CoupleLog,
  signedPhotoUrl,
  uploadLogVideo,
  upsertCoupleLog,
} from "@/lib/couple";
import { type LogSlot, canWriteSlot, slotLabel } from "@/lib/logslot";
import { getSupabase } from "@/lib/supabase";
import { sendEventPush } from "@/lib/notify";

const MAX_LEN = 60;

function removeStorage(path: string) {
  getSupabase()
    ?.storage.from("couple-photos")
    .remove([path])
    .catch(() => {});
}

/**
 * 셋로그식 원-플로우 촬영기: 열리면 바로 자체 카메라 → 하트 셔터(3초 강제) →
 * 찍자마자 백그라운드 업로드 → 같은 화면에서 영상 가운데 한마디 → '올리기' 한 번.
 * 수정 모드(existing)면 기존 영상 위 텍스트만 고치거나 다시 찍기.
 */
export default function LogCapture({
  coupleId,
  dateIso,
  slot,
  existing,
  onClose,
  onSaved,
}: {
  coupleId: string;
  dateIso: string;
  slot: LogSlot;
  existing: CoupleLog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const stopTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const unmountedRef = useRef(false);
  // 업로드 관리: 세대(gen) 가드로 다시찍기 race 에서 이전 업로드가 경로를 덮지 못하게
  const genRef = useRef(0);
  const uploadRef = useRef<Promise<string> | null>(null);
  const uploadedPathRef = useRef<string | null>(null);
  const postedRef = useRef(false);
  const blobRef = useRef<{ blob: Blob; mime: string } | null>(null); // 업로드 실패 시 재시도용
  const clipUrlRef = useRef<string | null>(null);
  const capturedAtRef = useRef<Date | null>(null); // 슬롯 게이트는 '촬영 시각' 기준(경계 유실 방지)

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [clip, setClip] = useState<{ url: string; mirrored: boolean } | null>(null);
  const [reshoot, setReshoot] = useState(false);
  const [body, setBody] = useState(existing?.body ?? "");
  const rootRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [camError, setCamError] = useState<"denied" | "unsupported" | null>(null);
  const [camTry, setCamTry] = useState(0);
  const [typing, setTyping] = useState(false); // 키보드 올라올 때 입력칸 위로
  const [freshExistingUrl, setFreshExistingUrl] = useState("");

  const mime =
    typeof MediaRecorder !== "undefined"
      ? pickVideoMime((m) => MediaRecorder.isTypeSupported(m))
      : null;

  // 수정 모드: 기존 영상 URL 을 신선하게 재서명(만료된 URL 로 검은 화면 방지)
  useEffect(() => {
    if (!existing?.video_path) return;
    signedPhotoUrl(existing.video_path)
      .then((u) => {
        if (!unmountedRef.current && u) setFreshExistingUrl(u);
      })
      .catch(() => {});
  }, [existing?.video_path]);

  const previewUrl =
    clip?.url || (!reshoot ? freshExistingUrl || (existing?.videoUrl ?? "") : "");
  const inPreview = !!previewUrl;

  function clearStopTimers() {
    stopTimersRef.current.forEach(clearTimeout);
    stopTimersRef.current = [];
  }

  /** 진행 중 레코더를 조용히 해체(핸들러 분리 → 업로드/상태변경 미발생). */
  function teardownRecorder() {
    clearStopTimers();
    const rec = recRef.current;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.onerror = null;
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
  }

  // 자체 카메라 열기 — OS 카메라로 자동 이탈하지 않는다(권한 거부 시 안내만).
  useEffect(() => {
    if (inPreview) return;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCamError("unsupported");
      return;
    }
    setCamError(null);
    let localStream: MediaStream | null = null;
    const onVis = () => {
      // 백그라운드 복귀 시 트랙이 죽어 있으면 재획득(iOS PWA 셔터 무반응 방지)
      if (
        document.visibilityState === "visible" &&
        streamRef.current &&
        streamRef.current.getVideoTracks().every((t) => t.readyState !== "live")
      ) {
        setCamTry((n) => n + 1);
      }
    };
    (async () => {
      try {
        // 무음 촬영(셋로그처럼) — 마이크 미사용
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;
        stream.getVideoTracks().forEach((t) =>
          t.addEventListener("ended", () => setCamTry((n) => n + 1)),
        );
        document.addEventListener("visibilitychange", onVis);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setCamError("denied");
      }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      teardownRecorder(); // 녹화 중 이탈 시 onstop 발화(→유령 업로드) 차단
      (localStream ?? streamRef.current)?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, inPreview, camTry]);

  // 언마운트: 플래그 → 레코더 해체 → URL/고아 업로드 정리
  useEffect(
    () => () => {
      unmountedRef.current = true;
      teardownRecorder();
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
      if (!postedRef.current) {
        if (uploadedPathRef.current) removeStorage(uploadedPathRef.current);
        else
          uploadRef.current?.then((p) => {
            if (!postedRef.current) removeStorage(p);
          }).catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** blob 확보 → 미리보기 전환 + 즉시 업로드 시작(세대 가드). */
  function acceptClip(blob: Blob, mimeType: string, mirrored: boolean) {
    capturedAtRef.current = new Date();
    blobRef.current = { blob, mime: mimeType };
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    const url = URL.createObjectURL(blob);
    clipUrlRef.current = url;
    setClip({ url, mirrored });
    setErr(null);
    uploadedPathRef.current = null;
    const gen = ++genRef.current;
    uploadRef.current = uploadLogVideo(coupleId, blob, extForMime(mimeType)).then(
      (p) => {
        // 다시찍기/언마운트로 세대가 바뀌었으면 이 업로드본은 즉시 폐기
        if (gen !== genRef.current || (unmountedRef.current && !postedRef.current)) {
          removeStorage(p);
        } else {
          uploadedPathRef.current = p;
        }
        return p;
      },
    );
    uploadRef.current.catch(() => {});
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || recording) return;
    setErr(null);
    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = mime
        ? new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: LOG_VIDEO_BPS,
          })
        : new MediaRecorder(stream, { videoBitsPerSecond: LOG_VIDEO_BPS });
    } catch {
      try {
        rec = new MediaRecorder(stream);
      } catch {
        setErr("이 브라우저에서 녹화가 지원되지 않아요.");
        return;
      }
    }
    recRef.current = rec;
    const actualMime = rec.mimeType || mime || "video/webm";
    const mirrored = facing === "user";
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      clearStopTimers();
      recRef.current = null;
      if (unmountedRef.current) return; // 언마운트 후 유령 업로드 금지
      setRecording(false);
      setCountdown(null);
      const blob = new Blob(chunksRef.current, { type: actualMime });
      if (blob.size === 0) {
        setErr("녹화에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      acceptClip(blob, actualMime, mirrored);
    };
    rec.onerror = () => {
      clearStopTimers();
      recRef.current = null;
      if (unmountedRef.current) return;
      setRecording(false);
      setCountdown(null);
      setErr("녹화 중 오류가 났어요. 다시 시도해 주세요.");
    };
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setErr("카메라가 끊겼어요. 다시 연결할게요.");
      setCamTry((n) => n + 1);
      return;
    }
    setRecording(true);
    setCountdown(3);
    stopTimersRef.current = [
      setTimeout(() => setCountdown(2), 1000),
      setTimeout(() => setCountdown(1), 2000),
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop(); // 3초 강제 종료
      }, LOG_VIDEO_MS),
    ];
  }

  function retake() {
    teardownRecorder();
    genRef.current++; // in-flight 업로드 무효화(.then 에서 자체 폐기)
    if (uploadedPathRef.current) {
      removeStorage(uploadedPathRef.current);
      uploadedPathRef.current = null;
    }
    uploadRef.current = null;
    blobRef.current = null;
    if (clipUrlRef.current) {
      URL.revokeObjectURL(clipUrlRef.current);
      clipUrlRef.current = null;
    }
    setClip(null);
    setReshoot(true);
    setErr(null);
  }

  /** 파일 폴백(네이티브 카메라) 검증. */
  function onFallbackFile(f: File | null) {
    if (!f) return;
    if (f.size > LOG_VIDEO_MAX_BYTES) {
      setErr("영상이 너무 커요. 카메라 앱 화질을 낮추거나 더 짧게 찍어주세요.");
      return;
    }
    const url = URL.createObjectURL(f);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      // 일부 포맷은 duration 이 NaN/Infinity — 검증 불가 시 용량 가드만 적용
      if (Number.isFinite(probe.duration) && probe.duration > LOG_VIDEO_FALLBACK_MAX_S) {
        setErr(`${LOG_VIDEO_FALLBACK_MAX_S}초 이내로 짧게 찍어주세요.`);
        return;
      }
      acceptClip(f, f.type || "video/mp4", false);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setErr("영상을 읽을 수 없어요.");
    };
    probe.src = url;
  }

  /** 게시 — 업로드는 대부분 이미 끝나 있어 체감 즉시. 중복 탭/업로드 실패 재시도 처리. */
  async function post() {
    if (busy) return;
    // 슬롯 게이트는 '촬영 시각' 기준(11:59 촬영 → 12:01 게시 허용, 서버 5분 유예와 짝)
    const gateAt = capturedAtRef.current ?? new Date();
    if (!canWriteSlot(dateIso, slot, gateAt)) {
      setErr(`${slotLabel(slot)} 시간이 지나 올릴 수 없어요.`);
      return;
    }
    setBusy(true);
    setErr(null);
    postedRef.current = true; // 커밋 경합 창에서 클린업이 파일을 지우지 못하게 선세팅
    try {
      let videoPath: string | null;
      if (clip) {
        try {
          if (!uploadRef.current) throw new Error("no-upload");
          videoPath = await uploadRef.current;
        } catch {
          // 백그라운드 업로드 실패 → 보관해 둔 blob 으로 1회 재시도(다시 찍기 강요 방지)
          if (!blobRef.current) throw new Error("영상 업로드에 실패했어요. 다시 찍어주세요.");
          const gen = genRef.current;
          videoPath = await uploadLogVideo(
            coupleId,
            blobRef.current.blob,
            extForMime(blobRef.current.mime),
          );
          if (gen === genRef.current) uploadedPathRef.current = videoPath;
        }
      } else {
        videoPath = existing?.video_path ?? null; // 텍스트만 수정
      }
      if (!videoPath) throw new Error("영상을 먼저 찍어주세요.");
      await upsertCoupleLog(
        coupleId,
        dateIso,
        slot,
        body.trim(),
        existing?.emoji ?? null,
        videoPath,
        existing?.video_path ?? null,
      );
      // 새 로그(수정 아님)만 상대에게 푸시 — 수신자 설정/조용시간은 서버가 게이트
      if (!existing) {
        sendEventPush(
          coupleId,
          "log",
          `🎬 ${slotLabel(slot)} 브이로그 도착!`,
          body.trim() || "상대의 3초를 확인해 보세요",
        );
      }
      onSaved();
    } catch (e) {
      postedRef.current = false;
      const msg = e instanceof Error ? e.message : String(e);
      setErr(
        /row-level security|violates/i.test(msg)
          ? `${slotLabel(slot)} 시간이 지나 올릴 수 없어요.`
          : msg,
      );
      setBusy(false);
    }
  }


  // Esc 로 닫기(촬영/업로드 중엔 무시 — X 버튼과 동일 가드) + 초기 포커스(키보드/스크린리더)
  useEffect(() => {
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current && !recordingRef.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ref 미러는 render 가 아닌 effect 에서 (react-hooks/refs)
  useEffect(() => {
    busyRef.current = busy;
    recordingRef.current = recording;
  }, [busy, recording]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12] outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${slotLabel(slot)} 3초 브이로그`}
      tabIndex={-1}
    >
      {/* 로즈 글로우 배경 (톤앤매너) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_-12%,rgba(255,95,151,0.28),transparent_70%),radial-gradient(420px_260px_at_100%_110%,rgba(139,92,246,0.18),transparent_70%)]"
      />

      {/* 상단 바 */}
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          <Icon name="camera" size={14} className="text-rose" />
          {slotLabel(slot)} 브이로그
          <span className="rounded-full bg-rose/25 px-1.5 py-0.5 text-[9px] font-extrabold text-rose">
            3초
          </span>
        </span>
        <button
          onClick={onClose}
          disabled={busy || recording}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 disabled:opacity-40"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* 화면 */}
      <div className="relative mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--radius-card)] ring-1 ring-white/12">
        {inPreview ? (
          <>
            <video
              key={previewUrl}
              src={previewUrl}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setErr("영상을 불러올 수 없어요 — 다시 찍어주세요.")}
              className={`max-h-full max-w-full object-contain ${
                clip?.mirrored ? "-scale-x-100" : ""
              }`}
            />
            {/* 영상 가운데 한마디 — 키보드 올라오면 위쪽으로 */}
            <input
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              enterKeyHint="done"
              placeholder="영상에 한마디 (선택)"
              maxLength={MAX_LEN}
              className={`absolute inset-x-6 bg-transparent text-center text-lg font-extrabold text-white outline-none drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] placeholder:text-white/50 transition-all ${
                typing ? "top-[16%]" : "top-1/2 -translate-y-1/2"
              }`}
            />
          </>
        ) : camError ? (
          <div className="mx-8 rounded-2xl bg-white/10 p-6 text-center">
            <p className="text-sm font-bold text-white">
              {camError === "denied"
                ? "카메라를 열 수 없어요"
                : "이 브라우저는 인앱 카메라를 지원하지 않아요"}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
              {camError === "denied"
                ? "브라우저 사이트 설정에서 카메라를 허용한 뒤 다시 시도해 주세요."
                : "아래 버튼으로 촬영해서 올릴 수 있어요(3초 이내)."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {camError === "denied" && (
                <button
                  onClick={() => setCamTry((n) => n + 1)}
                  className="tap rounded-full bg-brand px-4 py-2.5 text-xs font-bold text-white"
                >
                  다시 시도
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="tap rounded-full bg-white/15 px-4 py-2.5 text-xs font-bold text-white"
              >
                카메라 앱으로 촬영
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`max-h-full max-w-full object-contain ${
              facing === "user" ? "-scale-x-100" : ""
            }`}
          />
        )}
        {countdown !== null && (
          <span
            key={countdown}
            className="animate-pop pointer-events-none absolute text-8xl font-black text-white drop-shadow-[0_0_28px_rgba(255,95,151,0.95)]"
          >
            {countdown}
          </span>
        )}
        {recording && (
          <span className="animate-camprogress absolute bottom-0 left-0 h-1 rounded-full bg-brand" />
        )}
      </div>

      {err && <p className="relative px-4 py-1 text-center text-xs text-rose">{err}</p>}

      {/* 컨트롤 */}
      <div className="relative flex flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        {inPreview ? (
          <div className="flex items-center gap-3">
            <button
              onClick={retake}
              disabled={busy}
              className="tap glass rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/15 disabled:opacity-40"
            >
              다시 찍기
            </button>
            <button
              onClick={post}
              disabled={busy}
              className="tap flex items-center gap-1.5 rounded-full bg-brand px-8 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,95,151,0.7)] disabled:opacity-40"
            >
              <Icon name="send" size={15} />
              {busy ? "올리는 중…" : "올리기"}
            </button>
          </div>
        ) : camError ? null : (
          <>
            <div className="flex w-full items-center justify-center gap-6">
              <span className="w-11" aria-hidden />
              <button
                onClick={startRecording}
                disabled={recording}
                aria-label="3초 녹화 시작"
                className="tap grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white/10 ring-4 ring-rose/80 backdrop-blur"
              >
                {recording ? (
                  <span className="h-6 w-6 animate-pulse rounded-md bg-white" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand shadow-[0_0_24px_rgba(255,95,151,0.65)]">
                    <Icon name="heart" size={22} filled className="text-white" />
                  </span>
                )}
              </button>
              <button
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={recording}
                aria-label="카메라 전환"
                className="tap glass grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 disabled:opacity-40"
              >
                <Icon name="refresh" size={18} />
              </button>
            </div>
            <p className="mt-2.5 text-[11px] font-medium text-white/55">
              {recording ? "찍는 중…" : "하트를 누르면 3초 동안 찍혀요"}
            </p>
          </>
        )}
      </div>

      <input
        ref={fileRef}
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
