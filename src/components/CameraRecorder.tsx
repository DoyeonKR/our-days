"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { LOG_VIDEO_BPS, LOG_VIDEO_MS, pickVideoMime } from "@/lib/logvideo";

/**
 * 3초 브이로그 녹화기(셋로그식) — 누르면 3초 녹화 후 자동 종료 → 미리보기 →
 * 사용/재촬영. MediaRecorder 미지원/카메라 거부 시 onNeedFallback(파일 촬영 폴백).
 */
export default function CameraRecorder({
  onDone,
  onClose,
  onNeedFallback,
}: {
  onDone: (blob: Blob, mime: string) => void;
  onClose: () => void;
  onNeedFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; mime: string } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  const mime =
    typeof MediaRecorder !== "undefined"
      ? pickVideoMime((m) => MediaRecorder.isTypeSupported(m))
      : null;

  // 카메라 스트림 열기 (facing 변경 시 재획득)
  useEffect(() => {
    if (preview) return; // 미리보기 중엔 카메라 정지 상태 유지
    let cancelled = false;
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      onNeedFallback();
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: true,
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
        if (!cancelled) onNeedFallback(); // 권한 거부/미지원 → 파일 촬영 폴백
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, preview]);

  // 언마운트 시 미리보기 URL 정리
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

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
      onNeedFallback();
      return;
    }
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size === 0) {
        setErr("녹화에 실패했어요. 다시 시도해 주세요.");
        setRecording(false);
        setCountdown(null);
        return;
      }
      setPreview({ blob, url: URL.createObjectURL(blob), mime });
      setRecording(false);
      setCountdown(null);
    };
    rec.start();
    setRecording(true);
    // 3-2-1 카운트다운 + 3초 자동 종료
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (rec.state !== "inactive") rec.stop();
    }, LOG_VIDEO_MS);
    rec.onerror = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setRecording(false);
      setCountdown(null);
      setErr("녹화 중 오류가 났어요.");
    };
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="3초 영상 찍기"
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="text-sm font-bold text-white/90">3초 브이로그</span>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="tap grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* 프리뷰/재생 영역 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {preview ? (
          <video
            src={preview.url}
            autoPlay
            loop
            playsInline
            controls={false}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
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

      {/* 하단 컨트롤 */}
      <div className="flex items-center justify-center gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        {preview ? (
          <>
            <button
              onClick={retake}
              className="tap rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white"
            >
              다시 찍기
            </button>
            <button
              onClick={() => onDone(preview.blob, preview.mime)}
              className="tap rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]"
            >
              이 영상 사용
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
    </div>
  );
}
