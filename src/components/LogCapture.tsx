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
  uploadLogVideo,
  upsertCoupleLog,
} from "@/lib/couple";
import { type LogSlot, canWriteSlot, slotLabel } from "@/lib/logslot";
import { getSupabase } from "@/lib/supabase";

const MAX_LEN = 60;

/**
 * 셋로그식 원-플로우 촬영기: 열리면 바로 카메라 → 셔터(3초 강제, 자동 종료) →
 * 찍자마자 백그라운드 업로드 시작 → 같은 화면에서 영상 가운데 한마디 → '올리기'
 * 한 번에 게시. 수정 모드(existing)면 기존 영상 위 텍스트만 고치거나 다시 찍기.
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
  const chunksRef = useRef<BlobPart[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // 찍자마자 시작한 백그라운드 업로드 (올리기 시 await — 대부분 이미 완료라 즉시)
  const uploadRef = useRef<Promise<string> | null>(null);
  const uploadedPathRef = useRef<string | null>(null);
  const postedRef = useRef(false);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [clip, setClip] = useState<{ url: string } | null>(null);
  const [reshoot, setReshoot] = useState(false); // 수정 모드에서 '다시 찍기' 눌렀나
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mime =
    typeof MediaRecorder !== "undefined"
      ? pickVideoMime((m) => MediaRecorder.isTypeSupported(m))
      : null;

  const previewUrl = clip?.url || (!reshoot ? (existing?.videoUrl ?? "") : "");
  const inPreview = !!previewUrl;

  // 카메라 열기 (미리보기 상태가 아닐 때)
  useEffect(() => {
    if (inPreview) return;
    let cancelled = false;
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      fileRef.current?.click(); // 미지원 → 네이티브 카메라 폴백
      return;
    }
    (async () => {
      try {
        // 무음 촬영(셋로그처럼) — 마이크 미사용: OS 오디오 세션 개입/에코 원천 차단
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) fileRef.current?.click(); // 권한 거부 → 폴백
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, inPreview]);

  // 언마운트: URL 정리 + 게시 안 된 업로드 파일 정리(best-effort)
  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip.url);
      if (!postedRef.current && uploadedPathRef.current) {
        getSupabase()
          ?.storage.from("couple-photos")
          .remove([uploadedPathRef.current])
          .catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** blob 확보 → 미리보기 전환 + 즉시 업로드 시작. */
  function acceptClip(blob: Blob, mimeType: string) {
    setClip({ url: URL.createObjectURL(blob) });
    setErr(null);
    uploadedPathRef.current = null;
    uploadRef.current = uploadLogVideo(coupleId, blob, extForMime(mimeType))
      .then((p) => {
        uploadedPathRef.current = p;
        return p;
      });
    uploadRef.current.catch(() => {}); // unhandled rejection 방지(올리기에서 재-await)
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !mime || recording) return;
    setErr(null);
    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: LOG_VIDEO_BPS,
      });
    } catch {
      fileRef.current?.click();
      return;
    }
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      setRecording(false);
      setCountdown(null);
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size === 0) {
        setErr("녹화에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      acceptClip(blob, mime);
    };
    rec.start();
    setRecording(true);
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    setTimeout(() => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (rec.state !== "inactive") rec.stop(); // 3초 강제 종료
    }, LOG_VIDEO_MS);
  }

  function retake() {
    if (clip) URL.revokeObjectURL(clip.url);
    // 게시 전 업로드본 정리
    if (uploadedPathRef.current) {
      getSupabase()
        ?.storage.from("couple-photos")
        .remove([uploadedPathRef.current])
        .catch(() => {});
      uploadedPathRef.current = null;
    }
    uploadRef.current = null;
    setClip(null);
    setReshoot(true); // 수정 모드였다면 기존 영상 무시하고 새로
  }

  /** 파일 폴백(네이티브 카메라) 검증. */
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
      URL.revokeObjectURL(url);
      if (probe.duration > LOG_VIDEO_FALLBACK_MAX_S) {
        setErr(`${LOG_VIDEO_FALLBACK_MAX_S}초 이내로 짧게 찍어주세요.`);
        return;
      }
      acceptClip(f, f.type || "video/mp4");
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setErr("영상을 읽을 수 없어요.");
    };
    probe.src = url;
  }

  /** 게시 — 업로드는 대부분 이미 끝나 있어 체감 즉시. */
  async function post() {
    if (!canWriteSlot(dateIso, slot, new Date())) {
      setErr(`${slotLabel(slot)} 시간이 지나 올릴 수 없어요.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let videoPath: string | null;
      if (clip) {
        if (!uploadRef.current) throw new Error("업로드가 준비되지 않았어요.");
        videoPath = await uploadRef.current; // 이미 완료면 즉시
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
      postedRef.current = true;
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`${slotLabel(slot)} 3초 브이로그`}
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="text-sm font-bold text-white/90">
          {slotLabel(slot)} 브이로그 · 3초
        </span>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="tap grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* 화면 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {inPreview ? (
          <>
            <video
              key={previewUrl}
              src={previewUrl}
              autoPlay
              muted
              loop
              playsInline
              className="max-h-full max-w-full rounded-xl object-contain"
            />
            {/* 영상 가운데 한마디 */}
            <input
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
              placeholder="영상에 한마디 (선택)"
              maxLength={MAX_LEN}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 bg-transparent text-center text-lg font-extrabold text-white outline-none drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] placeholder:text-white/50"
            />
          </>
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className={`max-h-full max-w-full rounded-xl object-contain ${
              facing === "user" ? "-scale-x-100" : ""
            }`}
          />
        )}
        {countdown !== null && (
          <span className="pointer-events-none absolute text-8xl font-black text-white/90 drop-shadow-lg">
            {countdown}
          </span>
        )}
      </div>

      {err && <p className="px-4 py-1 text-center text-xs text-rose">{err}</p>}

      {/* 컨트롤 */}
      <div className="flex items-center justify-center gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        {inPreview ? (
          <>
            <button
              onClick={retake}
              disabled={busy}
              className="tap rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              다시 찍기
            </button>
            <button
              onClick={post}
              disabled={busy}
              className="tap rounded-full bg-brand px-8 py-3 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
            >
              {busy ? "올리는 중…" : "올리기"}
            </button>
          </>
        ) : (
          <>
            <span className="w-10" aria-hidden />
            <button
              onClick={startRecording}
              disabled={recording}
              aria-label="3초 녹화 시작"
              className={`tap grid h-16 w-16 place-items-center rounded-full ring-4 ring-white/70 ${
                recording ? "bg-rose-deep" : "bg-white"
              }`}
            >
              <span
                className={`rounded-full ${
                  recording ? "h-6 w-6 bg-white" : "h-12 w-12 bg-rose-deep"
                }`}
              />
            </button>
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              disabled={recording}
              aria-label="카메라 전환"
              className="tap grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white disabled:opacity-40"
            >
              <Icon name="refresh" size={18} />
            </button>
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
