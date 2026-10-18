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
import { LOG_VIDEO_KEEP_DAYS } from "@/lib/logretention";
import { getSupabase } from "@/lib/supabase";
import { sendEventPush } from "@/lib/notify";
import VideoFilterPicker from "@/components/VideoFilterPicker";
import { colorFrameSize, hasVideoColor, videoFilter, type VideoFilterId } from "@/lib/videoColor";
import { captureColorStream, colorVideoFile, createColorRenderer } from "@/lib/videoColorRenderer";
import { useDialogFocus } from "@/lib/useDialogFocus";

const MAX_LEN = 60;
/** Optional adapters allow isolated camera/record/upload UI tests without real couple writes. */
export type CaptureServices={camera?:(facing:"user"|"environment")=>Promise<MediaStream>;upload?:typeof uploadLogVideo;save?:typeof upsertCoupleLog;remove?:(path:string)=>void;onEncoded?:(info:{frames:number;usingCanvas:boolean})=>void};

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
  services,
}: {
  coupleId: string;
  dateIso: string;
  slot: LogSlot;
  existing: CoupleLog | null;
  onClose: () => void;
  onSaved: () => void;
  services?:CaptureServices;
}) {
  const discard=(path:string)=>services?.remove?services.remove(path):removeStorage(path);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<ReturnType<typeof createColorRenderer>|null>(null);
  const frameRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const recordedFramesRef=useRef(0);
  const captureStreamRef=useRef<MediaStream|null>(null);
  const fileAbortRef=useRef<AbortController|null>(null);
  const processingRef=useRef(false);
  const [processing,setProcessing]=useState(false);
  const [filter,setFilter]=useState<VideoFilterId>("original");
  const [strength,setStrength]=useState(1);
  const toneRef=useRef({filter:"original" as VideoFilterId,strength:1});
  const [colorReady,setColorReady]=useState(false);
  const [colorUnsupported,setColorUnsupported]=useState(false);
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
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [camError, setCamError] = useState<"denied" | "unsupported" | null>(null);
  const [camTry, setCamTry] = useState(0);
  const [typing, setTyping] = useState(false); // 키보드 올라올 때 입력칸 위로
  const [freshExistingUrl, setFreshExistingUrl] = useState("");
  const rootRef = useDialogFocus(true,()=>{if(!busy&&!recording&&!processing)onClose();});

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
      rec.onstart = null;
      rec.onstop = null;
      rec.onerror = null;
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    captureStreamRef.current?.getTracks().forEach(t=>t.stop());captureStreamRef.current=null;
    recordingRef.current=false;
  }

  function stopColorPreview(){if(frameRef.current!==null)clearInterval(frameRef.current);frameRef.current=null;rendererRef.current?.dispose();rendererRef.current=null;}
  function prepareColorPreview(){
    const video=videoRef.current,canvas=canvasRef.current;if(!video||!canvas||!video.videoWidth)return;
    stopColorPreview();setColorReady(false);
    try{
      const size=colorFrameSize(video.videoWidth,video.videoHeight);canvas.width=size.width;canvas.height=size.height;
      const renderer=createColorRenderer(canvas);rendererRef.current=renderer;
      renderer.draw(video,toneRef.current.filter,toneRef.current.strength);
      setColorReady(true);setColorUnsupported(typeof canvas.captureStream!=="function");
      // Encoding cadence must not depend on compositor rAF throttling behind a modal.
      const render=()=>{if(unmountedRef.current||document.visibilityState!=="visible")return;try{if(video.readyState>=2){renderer.draw(video,toneRef.current.filter,toneRef.current.strength);if(recordingRef.current)recordedFramesRef.current++;}}catch{stopColorPreview();setColorReady(false);setColorUnsupported(true);if(recordingRef.current){teardownRecorder();setRecording(false);setCountdown(null);setErr("필터 처리가 중단되어 촬영을 취소했어요. 다시 시도해 주세요.");}}};
      frameRef.current=setInterval(render,1000/24);
    }catch{stopColorPreview();setColorReady(false);setColorUnsupported(true);}
  }
  function selectTone(id:VideoFilterId){if(recordingRef.current||processingRef.current)return;setFilter(id);toneRef.current={...toneRef.current,filter:id};setErr(null);}
  function selectStrength(n:number){if(recordingRef.current||processingRef.current)return;setStrength(n);toneRef.current={...toneRef.current,strength:n};}

  // 자체 카메라 열기 — OS 카메라로 자동 이탈하지 않는다(권한 거부 시 안내만).
  useEffect(() => {
    if (inPreview) return;
    let cancelled = false;
    if ((!services?.camera&&!navigator.mediaDevices?.getUserMedia) || typeof MediaRecorder === "undefined") {
      setColorUnsupported(typeof MediaRecorder==="undefined"||typeof HTMLCanvasElement.prototype.captureStream!=="function");
      setCamError("unsupported");
      return;
    }
    setCamError(null);
    let localStream: MediaStream | null = null;
    const onVis = () => {
      if(document.visibilityState==="hidden"&&recordingRef.current){teardownRecorder();setRecording(false);setCountdown(null);setErr("화면을 벗어나 촬영을 취소했어요. 다시 찍어주세요.");}
      // 백그라운드 복귀 시 트랙이 죽어 있으면 재획득(iOS PWA 셔터 무반응 방지)
      if (
        document.visibilityState === "visible" &&
        streamRef.current &&
        streamRef.current.getVideoTracks().every((t) => t.readyState !== "live")
      ) {
        setCamTry((n) => n + 1);
      }
    };
    // 무음 촬영(셋로그처럼) — 마이크 미사용. 요청한 카메라(facingMode)가 없으면
    // 느슨한 제약으로 한 번 더 시도해 '무조건' 카메라를 연다(권한 거부만 예외로 던짐).
    const getStream = async () => {
      if(services?.camera)return services.camera(facing);
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (name === "NotAllowedError" || name === "SecurityError") throw e; // 권한 거부는 그대로
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    };
    (async () => {
      try {
        const stream = await getStream();
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
      } catch (e) {
        // 권한 거부 vs 장치 없음 구분 — 후자는 '지원 안 함'(카메라앱 폴백 안내)으로
        if (!cancelled) {
          const name = (e as { name?: string })?.name;
          setCamError(
            name === "NotFoundError" || name === "OverconstrainedError"
              ? "unsupported"
              : "denied",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      teardownRecorder(); // 녹화 중 이탈 시 onstop 발화(→유령 업로드) 차단
      (localStream ?? streamRef.current)?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopColorPreview();setColorReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, inPreview, camTry]);

  // 언마운트: 플래그 → 레코더 해체 → URL/고아 업로드 정리
  useEffect(
    () => {unmountedRef.current=false;return () => {
      unmountedRef.current = true;
      fileAbortRef.current?.abort();stopColorPreview();
      teardownRecorder();
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
      if (!postedRef.current) {
        if (uploadedPathRef.current) discard(uploadedPathRef.current);
        else
          uploadRef.current?.then((p) => {
            if (!postedRef.current) discard(p);
          }).catch(() => {});
      }
    };},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** blob 확보 → 미리보기 전환 + 즉시 업로드 시작(세대 가드). */
  function acceptClip(blob: Blob, mimeType: string, mirrored: boolean) {
    capturedAtRef.current ??= new Date();
    blobRef.current = { blob, mime: mimeType };
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    const url = URL.createObjectURL(blob);
    clipUrlRef.current = url;
    setClip({ url, mirrored });
    setErr(null);
    uploadedPathRef.current = null;
    const gen = ++genRef.current;
    uploadRef.current = (services?.upload??uploadLogVideo)(coupleId, blob, extForMime(mimeType)).then(
      (p) => {
        // 다시찍기/언마운트로 세대가 바뀌었으면 이 업로드본은 즉시 폐기
        if (gen !== genRef.current || (unmountedRef.current && !postedRef.current)) {
          discard(p);
        } else {
          uploadedPathRef.current = p;
        }
        return p;
      },
    );
    uploadRef.current.catch(() => {});
  }

  function startRecording() {
    const camera = streamRef.current;
    if (!camera || recordingRef.current || processingRef.current || busyRef.current) return;
    if(!videoRef.current||videoRef.current.readyState<2){setErr("카메라 준비가 끝나면 다시 눌러주세요.");return;}
    const colored=hasVideoColor(filter,strength);
    if(colored&&(!colorReady||colorUnsupported)){setErr("이 환경에서는 필터 영상 저장을 지원하지 않아요. 원본을 선택해 주세요.");return;}
    let stream=camera;
    try{if(colorReady&&!colorUnsupported&&canvasRef.current){rendererRef.current?.draw(videoRef.current,filter,strength);stream=captureColorStream(canvasRef.current);captureStreamRef.current=stream;}}
    catch(error){setColorUnsupported(true);setErr(error instanceof Error?error.message:"필터 녹화를 준비하지 못했어요.");return;}
    recordingRef.current=true;
    recordedFramesRef.current=0;
    capturedAtRef.current=new Date();
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
        teardownRecorder();setErr("이 브라우저에서 녹화가 지원되지 않아요.");
        return;
      }
    }
    recRef.current = rec;
    const actualMime = rec.mimeType || mime || "video/webm";
    // Preview and saved orientation are identical. Never mirror playback separately.
    const mirrored = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      clearStopTimers();
      recRef.current = null;
      captureStreamRef.current?.getTracks().forEach(t=>t.stop());captureStreamRef.current=null;recordingRef.current=false;
      if (unmountedRef.current) return; // 언마운트 후 유령 업로드 금지
      setRecording(false);
      setCountdown(null);
      services?.onEncoded?.({frames:recordedFramesRef.current,usingCanvas:stream!==camera});
      if(stream!==camera && recordedFramesRef.current<10){setErr("영상 프레임이 충분히 기록되지 않았어요. 화면을 켜 둔 채 다시 찍어주세요.");return;}
      const blob = new Blob(chunksRef.current, { type: actualMime });
      if (blob.size === 0) {
        setErr("녹화에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      acceptClip(blob, actualMime, mirrored);
    };
    rec.onerror = () => {
      teardownRecorder();
      if (unmountedRef.current) return;
      setRecording(false);
      setCountdown(null);
      setErr("녹화 중 오류가 났어요. 다시 시도해 주세요.");
    };
    rec.onstart=()=>{
      clearStopTimers();if(unmountedRef.current)return;setCountdown(3);
      stopTimersRef.current=[setTimeout(()=>setCountdown(2),1000),setTimeout(()=>setCountdown(1),2000),setTimeout(()=>{if(rec.state!=="inactive")rec.stop();},LOG_VIDEO_MS)];
    };
    try {
      rec.start();
    } catch {
      teardownRecorder();
      setErr("카메라가 끊겼어요. 다시 연결할게요.");
      setCamTry((n) => n + 1);
      return;
    }
    setRecording(true);
    setCountdown(null);
    stopTimersRef.current = [
      setTimeout(()=>{teardownRecorder();if(!unmountedRef.current){setRecording(false);setCountdown(null);setErr("녹화 준비가 지연됐어요. 다시 시도해 주세요.");}},15000),
    ];
  }

  function retake() {
    if(busyRef.current||processingRef.current||recordingRef.current)return;
    teardownRecorder();
    genRef.current++; // in-flight 업로드 무효화(.then 에서 자체 폐기)
    if (uploadedPathRef.current) {
      discard(uploadedPathRef.current);
      uploadedPathRef.current = null;
    }
    uploadRef.current = null;
    blobRef.current = null;
    if (clipUrlRef.current) {
      URL.revokeObjectURL(clipUrlRef.current);
      clipUrlRef.current = null;
    }
    setClip(null);
    capturedAtRef.current=null;
    setReshoot(true);
    setErr(null);
  }

  /** 파일 폴백(네이티브 카메라) 검증. */
  async function onFallbackFile(f: File | null) {
    if (!f || processingRef.current || recordingRef.current || busyRef.current || unmountedRef.current) return;
    if (f.size > LOG_VIDEO_MAX_BYTES) {
      setErr("영상이 너무 커요. 카메라 앱 화질을 낮추거나 더 짧게 찍어주세요.");
      return;
    }
    capturedAtRef.current=new Date();processingRef.current=true;setProcessing(true);setErr(null);
    const controller=new AbortController();fileAbortRef.current=controller;
    try{const result=await colorVideoFile(f,filter,strength,controller.signal);if(!unmountedRef.current)acceptClip(result.blob,result.mime,false);}
    catch(error){if(!unmountedRef.current)setErr(error instanceof Error?error.message:"필터를 적용하지 못했어요. 원본을 선택하거나 다시 시도해 주세요.");}
    finally{fileAbortRef.current=null;processingRef.current=false;if(!unmountedRef.current)setProcessing(false);}
  }

  /** 게시 — 업로드는 대부분 이미 끝나 있어 체감 즉시. 중복 탭/업로드 실패 재시도 처리. */
  async function post() {
    if (busyRef.current || processingRef.current || recordingRef.current) return;
    // 슬롯 게이트는 '촬영 시각' 기준(11:59 촬영 → 12:01 게시 허용, 서버 5분 유예와 짝)
    const gateAt = capturedAtRef.current ?? new Date();
    if (!canWriteSlot(dateIso, slot, gateAt)) {
      setErr(`${slotLabel(slot)} 시간이 지나 올릴 수 없어요.`);
      return;
    }
    busyRef.current=true;setBusy(true);
    setErr(null);
    postedRef.current = true; // 커밋 경합 창에서 클린업이 파일을 지우지 못하게 선세팅
    try {
      let videoPath: string | null;
      if (clip) {
        try {
          if (!uploadRef.current) throw new Error("no-upload");
          // 60초 상한 — 백그라운드 업로드 프라미스가 영영 안 끝나면(끊긴 소켓 등) 이 await 가
          // 닫기·다시찍기까지 무기한 잠갔다. 시간 초과면 보관해 둔 blob 재시도로 떨어진다.
          videoPath = await Promise.race([
            uploadRef.current,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("upload-timeout")), 60_000),
            ),
          ]);
        } catch {
          // 백그라운드 업로드 실패 → 보관해 둔 blob 으로 1회 재시도(다시 찍기 강요 방지)
          if (!blobRef.current) throw new Error("영상 업로드에 실패했어요. 다시 찍어주세요.");
          const gen = genRef.current;
          videoPath = await (services?.upload??uploadLogVideo)(
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
      await (services?.save??upsertCoupleLog)(
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
      busyRef.current=false;
    }
  }


  // Refs are synchronous operation gates. Do not mirror stale render snapshots
  // back into them from passive effects after a record/post click.

  return (
    <div
      ref={rootRef}
      className="vlog-capture fixed inset-0 z-[70] flex flex-col bg-[#0f0a12] outline-none"
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
      <div className="vlog-capture-header relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          <Icon name="camera" size={14} className="text-rose" />
          {slotLabel(slot)} 브이로그
          <span className="rounded-full bg-rose/25 px-1.5 py-0.5 text-xs font-extrabold text-rose">
            3초
          </span>
        </span>
        <button
          onClick={onClose}
          disabled={busy || recording || processing}
          aria-label="닫기"
          className="tap grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 disabled:opacity-40"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* 화면 */}
      <div className="vlog-capture-stage relative mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--radius-card)] ring-1 ring-white/12">
        <span className="vlog-stage-label">{inPreview?"PREVIEW · 저장할 영상":recording?"REC · 3초 녹화 중":"OUR MOMENT · 무음 촬영"}</span>
        {inPreview ? (
          <>
            <video
              key={previewUrl}
              src={previewUrl}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setErr("영상을 불러올 수 없어요, 다시 찍어주세요.")}
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
              aria-label="영상에 남길 한마디"
              maxLength={MAX_LEN}
              className={`absolute inset-x-6 bg-transparent text-center text-lg font-extrabold text-white outline-none drop-shadow-[2px_2px_0_rgba(0,0,0,0.9)] placeholder:text-white/50 transition-all ${
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
                ? "'권한 다시 요청'을 누르면 허용 창이 떠요. 창이 안 뜨면 브라우저 사이트 설정 → 카메라 → 허용 후 다시 시도해 주세요."
                : `아래 버튼으로 촬영해서 올릴 수 있어요(${LOG_VIDEO_FALLBACK_MAX_S}초 이내).`}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {camError === "denied" && (
                <button
                  onClick={() => setCamTry((n) => n + 1)}
                  className="tap rounded-full bg-brand px-4 py-2.5 text-xs font-bold text-white"
                >
                  권한 다시 요청
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={processing}
                className="tap rounded-full bg-white/15 px-4 py-2.5 text-xs font-bold text-white"
              >
                카메라 앱으로 촬영
              </button>
            </div>
          </div>
        ) : (
          <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onLoadedData={prepareColorPreview}
            className={`max-h-full max-w-full object-contain ${colorReady ? "vlog-camera-source" : ""}`}
          />
          <canvas ref={canvasRef} className={`vlog-color-canvas ${colorReady?"":"hidden"}`} aria-label="저장 색감 프리뷰"/>
          </>
        )}
        {countdown !== null && (
          <span
            key={countdown}
            className="animate-pop pointer-events-none absolute text-8xl font-black text-white drop-shadow-[0_0_0_4px_rgba(255,95,151,0.95)]"
          >
            {countdown}
          </span>
        )}
        {recording && (
          <span className="animate-camprogress absolute bottom-0 left-0 h-1 rounded-full bg-brand" />
        )}
      </div>

      {!inPreview && <VideoFilterPicker value={filter} strength={strength} onChange={selectTone} onStrength={selectStrength} disabled={recording||processing} unsupported={colorUnsupported}/>}
      {inPreview && <p className="vlog-color-saved">{clip?`${videoFilter(filter).label} · ${hasVideoColor(filter,strength)?Math.round(strength*100):0}% · 색감이 영상에 저장됐어요`:"기존 영상 · 색감을 바꾸려면 다시 찍기를 선택해 주세요"}</p>}
      {processing && <p className="vlog-color-saved" role="status">색감을 영상에 저장하는 중… 잠시만 기다려 주세요.</p>}

      {err && <p role="alert" className="relative px-4 py-1 text-center text-xs text-rose">{err}</p>}

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
              className="tap flex items-center gap-1.5 rounded-full bg-brand px-8 py-3 text-sm font-bold text-white shadow-[4px_4px_0_rgba(255,95,151,0.7)] disabled:opacity-40"
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
                disabled={recording || processing}
                aria-label="3초 녹화 시작"
                className="tap vlog-shutter grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white/10 ring-4 ring-rose/80"
              >
                {recording ? (
                  <span className="h-6 w-6 animate-pulse rounded-md bg-white" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand shadow-[0_0_0_4px_rgba(255,95,151,0.65)]">
                    <Icon name="heart" size={22} filled className="text-white" />
                  </span>
                )}
              </button>
              <button
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={recording || processing}
                aria-label="카메라 전환"
                className="tap grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 disabled:opacity-40"
              >
                <Icon name="refresh" size={18} />
              </button>
            </div>
            <p className="mt-2.5 text-sm font-medium text-white/55">
              {recording ? "찍는 중…" : "하트를 누르면 3초 동안 찍혀요"}
            </p>
            {/* 보관 기간 안내 — 지우기 전에 미리 말해 둔다(서버가 90일 지난 영상만 정리한다) */}
            <p className="mt-1 text-xs text-white/55">영상은 {LOG_VIDEO_KEEP_DAYS}일 동안 보관돼요 · 글은 계속 남아요</p>
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
