"use client";

import { CloseButton } from "@/components/AppButtons";
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
  uploadLogPoster,
  uploadLogVideo,
  upsertCoupleLog,
} from "@/lib/couple";
import { type LogSlot, canWriteSlot, slotLabel } from "@/lib/logslot";
import { LOG_VIDEO_KEEP_DAYS } from "@/lib/logretention";
import {
  LOG_MIN_FRAMES,
  LOG_SAVE_TIMEOUT_MS,
  LOG_UPLOAD_TIMEOUT_MS,
  humanLogError,
  isNetworkishError,
  recordRetryPath,
  retakeWarning,
  withTimeout,
} from "@/lib/logreview";
import { zoomInfo, zoomOutFully } from "@/lib/camerazoom";
import { logDebug } from "@/lib/debug";
import { deleteLogDraft, downloadBlob, draftKey, putLogDraft } from "@/lib/logdraft";
import { posterFromBlob } from "@/lib/logmontage";
import { confirmDialog } from "@/lib/confirm";
import { getSupabase } from "@/lib/supabase";
import { sendEventPush } from "@/lib/notify";
import VideoFilterPicker from "@/components/VideoFilterPicker";
import VideoBeautyPicker from "@/components/VideoBeautyPicker";
import {beautyPreset,type BeautyPresetId} from "@/lib/videoBeauty";
import { cropFrame34, hasVideoColor, videoFilter, type VideoFilterId } from "@/lib/videoColor";
import { captureColorStream, colorVideoFile, createColorRenderer } from "@/lib/videoColorRenderer";
import { useDialogFocus } from "@/lib/useDialogFocus";

const MAX_LEN = 60;
/** Optional adapters allow isolated camera/record/upload UI tests without real couple writes. */
export type CaptureServices={camera?:(facing:"user"|"environment")=>Promise<MediaStream>;upload?:typeof uploadLogVideo;save?:typeof upsertCoupleLog;remove?:(path:string)=>void;onEncoded?:(info:{frames:number;usingCanvas:boolean})=>void;poster?:(blob:Blob)=>Promise<Blob|null>;uploadPoster?:typeof uploadLogPoster};

function removeStorage(path: string) {
  getSupabase()
    ?.storage.from("couple-photos")
    .remove([path])
    .catch(() => {});
}

/** 짧은 진동(지원하는 안드로이드만 — iOS 사파리는 조용히 무시한다). */
function buzz(ms = 10) {
  try { navigator.vibrate?.(ms); } catch { /* noop */ }
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
  commentCount = 0,
  mission,
  replyTo,
}: {
  coupleId: string;
  dateIso: string;
  slot: LogSlot;
  existing: CoupleLog | null;
  onClose: () => void;
  onSaved: () => void;
  services?:CaptureServices;
  /** 기존 영상에 달린 댓글 수 — 다시 찍기 전에 '댓글은 새 영상에 그대로 붙는다'고 묻는다. */
  commentCount?: number;
  /** 오늘의 촬영 미션(빈 칸에서 열었을 때). */
  mission?: string | null;
  /** 상대 클립에서 '3초 답장'으로 열었을 때 상대 이름. */
  replyTo?: string | null;
}) {
  const discard=(path:string)=>services?.remove?services.remove(path):removeStorage(path);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<ReturnType<typeof createColorRenderer>|null>(null);
  const rendererCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const frameRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const recordedFramesRef=useRef(0);
  const captureStreamRef=useRef<MediaStream|null>(null);
  const fileAbortRef=useRef<AbortController|null>(null);
  const processingRef=useRef(false);
  const [processing,setProcessing]=useState(false);
  const [filter,setFilter]=useState<VideoFilterId>("original");
  const [strength,setStrength]=useState(1);
  const [beauty,setBeauty]=useState(0);
  const [beautyStyle,setBeautyStyle]=useState<BeautyPresetId>("natural");
  // 보정 · 색감은 칩 한 줄로 접어 둔다 — 예전엔 보정 8버튼 · 3줄 + 강도 막대(약 240px)가 늘 펼쳐져 SE 에서 화면이 200px 로 줄었다.
  const [panel,setPanel]=useState<"beauty"|"color"|null>(null);
  const toneRef=useRef({filter:"original" as VideoFilterId,strength:1,beauty:0,preset:"natural" as BeautyPresetId});
  // 전면 카메라는 거울처럼 — 찍는 화면 · 저장 영상 · 재생이 전부 같은 방향이다(비트맵에 구워서, 재생 때 따로 뒤집지 않는다).
  const mirrorRef=useRef(true);
  const [colorReady,setColorReady]=useState(false);
  const [colorUnsupported,setColorUnsupported]=useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const hiddenStopRef = useRef(false); // 화면을 벗어나 카메라를 껐다 → 돌아오면 다시 연다
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
  const cancelledRef = useRef(false); // 올리는 중에 닫기/다시 찍기 — 이어지는 단계가 저장하지 않게
  const blobRef = useRef<{ blob: Blob; mime: string } | null>(null); // 업로드 실패 시 재시도용
  const posterRef = useRef<Promise<Blob | null> | null>(null);
  const clipUrlRef = useRef<string | null>(null);
  const capturedAtRef = useRef<Date | null>(null); // 슬롯 게이트는 '촬영 시각' 기준(경계 유실 방지)
  const retriedRef = useRef(false); // 프레임 부족 자동 재시도는 한 번만

  const [facing, setFacing] = useState<"user" | "environment">("user");
  useEffect(()=>{mirrorRef.current=facing==="user";},[facing]);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [clip, setClip] = useState<{ url: string; mirrored: boolean } | null>(null);
  const [reshoot, setReshoot] = useState(false);
  const [body, setBody] = useState(existing?.body ?? "");
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  // 올리기 단계 — 파일을 올리는 동안은 닫기 · 다시 찍기가 된다(영상은 기기 보관함에 남아 뒤에서 다시 올린다).
  // 행을 저장하는 몇 초만 막는다(닫아서 파일을 지웠는데 저장이 들어가면 깨진 영상이 남는다).
  const phaseRef = useRef<"idle" | "upload" | "save">("idle");
  const [phase, setPhase] = useState<"idle" | "upload" | "save">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [slotClosedBlob, setSlotClosedBlob] = useState(false);
  const [camError, setCamError] = useState<"denied" | "unsupported" | null>(null);
  const [camTry, setCamTry] = useState(0);
  const [freshExistingUrl, setFreshExistingUrl] = useState("");
  const canClose = !recording && !processing && phase !== "save";
  const rootRef = useDialogFocus(true,()=>{if(canClose)requestClose();});
  useEffect(()=>{
    const viewport=window.visualViewport,root=rootRef.current;
    if(!viewport||!root)return;
    const sync=()=>{
      root.style.setProperty("--capture-height",`${viewport.height}px`);
      root.style.setProperty("--capture-top",`${viewport.offsetTop}px`);
    };
    sync();viewport.addEventListener("resize",sync);viewport.addEventListener("scroll",sync);
    return()=>{viewport.removeEventListener("resize",sync);viewport.removeEventListener("scroll",sync);};
  },[rootRef]);

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

  function stopColorPreview(){if(frameRef.current!==null)clearInterval(frameRef.current);frameRef.current=null;rendererRef.current?.dispose();rendererRef.current=null;rendererCanvasRef.current=null;}
  /** 미리보기 렌더러 준비 — loadeddata 와 resize(기기 회전으로 원본 크기가 바뀜)에서 부른다.
   *  같은 캔버스에 렌더러가 이미 있으면 다시 만들지 않고 크기 · 자를 칸만 고친다(컨텍스트를 다시 잡지 않는다). */
  function prepareColorPreview(){
    const video=videoRef.current,canvas=canvasRef.current;if(!video||!canvas||!video.videoWidth)return;
    if(rendererRef.current&&rendererCanvasRef.current===canvas){
      if(recordingRef.current)return; // 녹화 중 크기를 바꾸면 레코더가 멈추는 브라우저가 있다 — 3초는 그대로 간다
      try{const frame=cropFrame34(video.videoWidth,video.videoHeight);if(canvas.width!==frame.width||canvas.height!==frame.height){canvas.width=frame.width;canvas.height=frame.height;}rendererRef.current.setCrop(frame.crop);}catch{/* 다음 프레임에서 다시 */}
      return;
    }
    stopColorPreview();setColorReady(false);
    try{
      const frame=cropFrame34(video.videoWidth,video.videoHeight);canvas.width=frame.width;canvas.height=frame.height;
      const renderer=createColorRenderer(canvas,{loseOnDispose:false});renderer.setCrop(frame.crop);rendererRef.current=renderer;rendererCanvasRef.current=canvas;
      renderer.draw(video,toneRef.current.filter,toneRef.current.strength,mirrorRef.current,toneRef.current.beauty,toneRef.current.preset);
      setColorReady(true);setColorUnsupported(typeof canvas.captureStream!=="function");
      // Encoding cadence must not depend on compositor rAF throttling behind a modal.
      const render=()=>{if(unmountedRef.current||document.visibilityState!=="visible")return;try{if(video.readyState>=2){renderer.draw(video,toneRef.current.filter,toneRef.current.strength,mirrorRef.current,toneRef.current.beauty,toneRef.current.preset);if(recordingRef.current)recordedFramesRef.current++;}}catch{stopColorPreview();setColorReady(false);setColorUnsupported(true);if(recordingRef.current){teardownRecorder();setRecording(false);setCountdown(null);setErr("필터 처리가 중단되어 촬영을 취소했어요. 다시 시도해 주세요.");}}};
      frameRef.current=setInterval(render,1000/24);
    }catch{stopColorPreview();setColorReady(false);setColorUnsupported(true);}
  }
  function selectTone(id:VideoFilterId){if(recordingRef.current||processingRef.current)return;setFilter(id);toneRef.current={...toneRef.current,filter:id};setErr(null);}
  function selectStrength(n:number){if(recordingRef.current||processingRef.current)return;setStrength(n);toneRef.current={...toneRef.current,strength:n};}
  function selectBeauty(n:number){if(recordingRef.current||processingRef.current)return;setBeauty(n);toneRef.current={...toneRef.current,beauty:n};setErr(null);}
  function selectBeautyStyle(preset:BeautyPresetId){if(recordingRef.current||processingRef.current)return;setBeautyStyle(preset);toneRef.current={...toneRef.current,preset};setErr(null);}

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
      if (document.visibilityState === "hidden") {
        if(recordingRef.current){teardownRecorder();setRecording(false);setCountdown(null);setErr("화면을 벗어나 촬영을 취소했어요. 다시 찍어주세요.");}
        // 안 찍는 동안 화면을 벗어나면 카메라를 끈다 — 켜 두면 안드로이드 카메라 표시등이 남고 배터리를 쓴다.
        if (streamRef.current) {
          hiddenStopRef.current = true;
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        return;
      }
      // 돌아오면 다시 연다(직접 끈 경우 + 백그라운드에서 트랙이 죽은 경우 — iOS PWA 셔터 무반응 방지)
      if (
        document.visibilityState === "visible" &&
        (hiddenStopRef.current ||
          (streamRef.current && streamRef.current.getVideoTracks().every((t) => t.readyState !== "live")))
      ) {
        hiddenStopRef.current = false;
        setCamTry((n) => n + 1);
      }
    };
    // 무음 촬영(셋로그처럼) — 마이크 미사용. 요청한 카메라(facingMode)가 없으면
    // 느슨한 제약으로 한 번 더 시도해 '무조건' 카메라를 연다(권한 거부만 예외로 던짐).
    // 해상도는 3:4 세로(720×960)를 바란다 — 어떤 비율이 와도 렌더러가 가운데 3:4 로 자른다(cropFrame34).
    const getStream = async () => {
      if(services?.camera)return services.camera(facing);
      try {
        return await navigator.mediaDevices.getUserMedia({
          // zoom: true — 줌 범위를 알려 달라는 뜻(크롬). 모르는 브라우저는 무시한다. 열린 뒤 zoomOutFully 가 최소로 맞춘다.
          video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 960 }, aspectRatio: { ideal: 3 / 4 }, zoom: true } as MediaTrackConstraints,
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
        // 기기 기본 줌(당겨진 채)이 아니라 가장 넓게. 실기기에서 듣는지 탭마다 한 번 기록한다(debug_logs 'cam_zoom').
        void zoomOutFully(stream).then((applied) => {
          try {
            if (sessionStorage.getItem("ourdays:camzoom-logged")) return;
            sessionStorage.setItem("ourdays:camzoom-logged", "1");
          } catch {
            return;
          }
          void logDebug("cam_zoom", { applied, ...zoomInfo(stream) });
        });
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

  /** blob 확보 → 미리보기 전환 + 즉시 업로드 시작(세대 가드) + 첫 장면 그림 굽기. */
  function acceptClip(blob: Blob, mimeType: string, mirrored: boolean) {
    capturedAtRef.current ??= new Date();
    blobRef.current = { blob, mime: mimeType };
    retriedRef.current = false;
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    const url = URL.createObjectURL(blob);
    clipUrlRef.current = url;
    setClip({ url, mirrored });
    setErr(null);
    setSlotClosedBlob(false);
    uploadedPathRef.current = null;
    posterRef.current = (services?.poster ?? posterFromBlob)(blob).catch(() => null);
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

  function startRecording(opts: { raw?: boolean; auto?: boolean } = {}) {
    const camera = streamRef.current;
    if (!camera || recordingRef.current || processingRef.current || busyRef.current) return;
    if(!videoRef.current||videoRef.current.readyState<2){setErr("카메라 준비가 끝나면 다시 눌러주세요.");return;}
    const colored=hasVideoColor(filter,strength)||beauty>0;
    if(colored&&(!colorReady||colorUnsupported)){setErr("이 환경에서는 필터 영상 저장을 지원하지 않아요. 원본을 선택해 주세요.");return;}
    if(!opts.auto){buzz(10);retriedRef.current=false;}
    let stream=camera;
    try{if(!opts.raw&&colorReady&&!colorUnsupported&&canvasRef.current){rendererRef.current?.draw(videoRef.current,filter,strength,mirrorRef.current,beauty,beautyStyle);stream=captureColorStream(canvasRef.current);captureStreamRef.current=stream;}}
    catch(error){setColorUnsupported(true);setErr(error instanceof Error?error.message:"필터 녹화를 준비하지 못했어요.");return;}
    const usingCanvas=stream!==camera;
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
    // Preview and saved orientation are identical (the mirror is baked in the renderer). Never mirror playback separately.
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
      services?.onEncoded?.({frames:recordedFramesRef.current,usingCanvas});
      if(usingCanvas && recordedFramesRef.current<LOG_MIN_FRAMES){
        // 캔버스가 프레임을 거의 못 받았다(백그라운드 · 저전력 타이머 지연). 한 번은 저절로 다시 찍는다 —
        // 후면 + 보정 없음은 카메라 원본으로(잃는 게 없다), 전면은 거울을 지키려 캔버스로(logreview.recordRetryPath).
        if(!retriedRef.current){
          retriedRef.current=true;
          const path=recordRetryPath(facing,colored);
          setErr("영상이 잘 안 담겼어요. 한 번 더 찍을게요…");
          stopTimersRef.current=[setTimeout(()=>{if(!unmountedRef.current)startRecording({raw:path==="raw",auto:true});},600)];
          return;
        }
        setErr("영상 프레임이 충분히 기록되지 않았어요. 화면을 켜 둔 채 다시 찍어주세요.");return;
      }
      const blob = new Blob(chunksRef.current, { type: actualMime });
      if (blob.size === 0) {
        setErr("녹화에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      buzz(15);
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

  /** 올리는 중이면 이어지는 단계를 멈춘다(파일은 치우고, 영상은 기기 보관함에 남는다). */
  function cancelPosting() {
    if (!busyRef.current || phaseRef.current === "save") return;
    cancelledRef.current = true;
    postedRef.current = false;
    genRef.current++; // 늦게 끝나는 백그라운드 업로드는 스스로 폐기
    busyRef.current = false; setBusy(false);
    phaseRef.current = "idle"; setPhase("idle");
  }

  function requestClose() {
    if (recordingRef.current || processingRef.current || phaseRef.current === "save") return;
    cancelPosting();
    onClose();
  }

  async function retake() {
    if(processingRef.current||recordingRef.current||phaseRef.current==="save")return;
    // 기존 영상에 댓글이 있으면 먼저 묻는다 — 댓글은 행에 붙어 있어 새 영상으로 그대로 옮겨 간다.
    const warn = !clip && existing ? retakeWarning(commentCount) : null;
    if (warn && !(await confirmDialog({ message: "다시 찍을까요?", detail: warn, confirmText: "다시 찍기" }))) return;
    if (busyRef.current) {
      cancelPosting();
      deleteLogDraft(draftKey(coupleId, dateIso, slot)).catch(() => {});
    }
    teardownRecorder();
    genRef.current++; // in-flight 업로드 무효화(.then 에서 자체 폐기)
    if (uploadedPathRef.current) {
      discard(uploadedPathRef.current);
      uploadedPathRef.current = null;
    }
    uploadRef.current = null;
    blobRef.current = null;
    posterRef.current = null;
    if (clipUrlRef.current) {
      URL.revokeObjectURL(clipUrlRef.current);
      clipUrlRef.current = null;
    }
    setClip(null);
    capturedAtRef.current=null;
    setReshoot(true);
    setErr(null);
    setSlotClosedBlob(false);
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
    try{const result=await colorVideoFile(f,filter,strength,controller.signal,beauty,beautyStyle);if(!unmountedRef.current)acceptClip(result.blob,result.mime,false);}
    catch(error){if(!unmountedRef.current)setErr(error instanceof Error?error.message:"필터를 적용하지 못했어요. 원본을 선택하거나 다시 시도해 주세요.");}
    finally{fileAbortRef.current=null;processingRef.current=false;if(!unmountedRef.current)setProcessing(false);}
  }

  /** 게시 — 업로드는 대부분 이미 끝나 있어 체감 즉시. 중복 탭/업로드 실패 재시도 처리.
   *  모든 기다림에 시간 제한이 있고(업로드 60초 · 저장 20초), 올리는 동안 닫으면 영상은 기기 보관함에 남는다. */
  async function post() {
    if (busyRef.current || processingRef.current || recordingRef.current) return;
    // 슬롯 게이트는 '촬영 시각' 기준(11:59 촬영 → 12:01 게시 허용, 서버 5분 유예와 짝)
    const gateAt = capturedAtRef.current ?? new Date();
    if (!canWriteSlot(dateIso, slot, gateAt)) {
      setErr(`${slotLabel(slot)} 시간이 지나 올릴 수 없어요.`);
      setSlotClosedBlob(!!blobRef.current);
      return;
    }
    busyRef.current=true;setBusy(true);
    cancelledRef.current=false;
    setErr(null);
    postedRef.current = true; // 커밋 경합 창에서 클린업이 파일을 지우지 못하게 선세팅
    const key = draftKey(coupleId, dateIso, slot);
    const stopped = () => cancelledRef.current || unmountedRef.current;
    let draftSaved = false;
    try {
      let videoPath: string | null;
      let posterPath: string | null | undefined = undefined;
      if (clip) {
        phaseRef.current = "upload"; setPhase("upload");
        const held = blobRef.current;
        // 임시 보관 — 올리는 도중 연결이 끊기거나 앱이 꺼져도 찍은 영상이 이 기기에 남는다(성공하면 지운다).
        if (held) {
          const poster = await withTimeout(posterRef.current ?? Promise.resolve(null), 3000).catch(() => null);
          draftSaved = await putLogDraft({ coupleId, dateIso, slot, capturedAt: (capturedAtRef.current ?? new Date()).toISOString(), blob: held.blob, mime: held.mime, poster, body: body.trim() }).catch(() => false);
        }
        try {
          if (!uploadRef.current) throw new Error("no-upload");
          videoPath = await withTimeout(uploadRef.current, LOG_UPLOAD_TIMEOUT_MS);
        } catch {
          if (stopped()) return;
          // 백그라운드 업로드 실패 → 보관해 둔 blob 으로 1회 재시도(다시 찍기 강요 방지). 이 재시도도 시간 제한이 있다.
          if (!blobRef.current) throw new Error("영상 업로드에 실패했어요. 다시 찍어주세요.");
          const gen = ++genRef.current; // 늦게 끝난 첫 업로드는 acceptClip 의 세대 가드가 치운다
          videoPath = await withTimeout(
            (services?.upload??uploadLogVideo)(coupleId, blobRef.current.blob, extForMime(blobRef.current.mime)),
            LOG_UPLOAD_TIMEOUT_MS,
            (late) => discard(late),
          );
          if (gen === genRef.current) uploadedPathRef.current = videoPath;
        }
        if (stopped()) { if (videoPath) discard(videoPath); return; }
        // 첫 장면 그림 — 실패해도 영상 저장은 막지 않는다(null = 그림 없음, 목록은 #t=0.001 로 첫 장면을 그린다)
        const posterBlob = await withTimeout(posterRef.current ?? Promise.resolve(null), 5000).catch(() => null);
        posterPath = posterBlob
          ? await withTimeout((services?.uploadPoster ?? uploadLogPoster)(coupleId, posterBlob), 15_000, (late) => { if (late) discard(late); }).catch(() => null)
          : null;
        if (stopped()) { discard(videoPath); if (posterPath) discard(posterPath); return; }
      } else {
        videoPath = existing?.video_path ?? null; // 텍스트만 수정
      }
      if (!videoPath) throw new Error("영상을 먼저 찍어주세요.");
      phaseRef.current = "save"; setPhase("save");
      const res = await withTimeout(
        (services?.save??upsertCoupleLog)(
          coupleId,
          dateIso,
          slot,
          body.trim(),
          existing?.emoji ?? null,
          videoPath,
          existing?.video_path ?? null,
          posterPath,
        ),
        LOG_SAVE_TIMEOUT_MS,
      );
      deleteLogDraft(key).catch(() => {});
      // 새 로그만 상대에게 푸시 — '새 로그인지'는 화면 캐시(existing)가 아니라 서버가 저장 직전에 다시 본 값이다.
      // 수신자 설정/조용시간은 서버가 게이트
      if (res?.created) {
        sendEventPush(
          coupleId,
          "log",
          `🎬 ${slotLabel(slot)} 브이로그 도착!`,
          body.trim() || "상대의 3초를 확인해 보세요",
        );
      }
      phaseRef.current = "idle";
      onSaved();
    } catch (e) {
      postedRef.current = false;
      phaseRef.current = "idle";
      if (unmountedRef.current) return;
      setPhase("idle");
      const raw = e instanceof Error ? e.message : String(e);
      const slotClosed = /slot-closed|row-level security|violates/i.test(raw);
      if (slotClosed) {
        // 시간이 지나 서버가 거절 — 다시 올릴 수 없으니 보관함에서 빼고, 기기에 저장할 길만 남긴다.
        deleteLogDraft(key).catch(() => {});
        setSlotClosedBlob(!!blobRef.current);
      }
      setErr(
        !slotClosed && isNetworkishError(raw) && !draftSaved
          ? "인터넷 연결이 끊겨 올리지 못했어요. 연결을 확인하고 다시 눌러 주세요."
          : humanLogError(e, slotLabel(slot)),
      );
      setBusy(false);
      busyRef.current=false;
    }
  }

  function saveToDevice() {
    const held = blobRef.current;
    if (!held) return;
    downloadBlob(held.blob, `our-3s-${dateIso}-${slot}.${extForMime(held.mime)}`);
  }

  // Refs are synchronous operation gates. Do not mirror stale render snapshots
  // back into them from passive effects after a record/post click.

  const title = replyTo ? `${replyTo}에게 3초 답장` : `${slotLabel(slot)} 브이로그`;
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
          {title}
          <span className="rounded-full bg-rose/25 px-1.5 py-0.5 text-xs font-extrabold text-rose">
            3초
          </span>
        </span>
        <CloseButton onClose={requestClose} disabled={!canClose} />
      </div>

      {/* 화면 */}
      <div className="vlog-capture-body">
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
            {/* 입력은 영상 아래에 분리하여 얼굴과 원본 화면을 가리지 않는다. */}
            <input
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              enterKeyHint="done"
              placeholder="영상에 한마디 (선택)"
              aria-label="영상에 남길 한마디"
              maxLength={MAX_LEN}
              className="vlog-caption-input"
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
                : `아래 버튼으로 촬영해서 올릴 수 있어요(${LOG_VIDEO_FALLBACK_MAX_S}초 이내 · 앞 3초만 저장돼요).`}
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
            onResize={prepareColorPreview}
            className={`max-h-full max-w-full object-contain ${colorReady ? "vlog-camera-source" : ""}`}
          />
          {/* 카메라(facing) · 재연결(camTry)마다 캔버스를 새로 단다 — 같은 캔버스에 다시 붙이면 잃은 WebGL 컨텍스트가 돌아와
              필터 준비가 실패했고 전면 영상이 거울 없이 저장됐다. */}
          <canvas key={`${facing}-${camTry}`} ref={canvasRef} className={`vlog-color-canvas ${colorReady?"":"hidden"}`} aria-label="저장 색감 프리뷰"/>
          </>
        )}
        {countdown !== null && (
          <span
            key={countdown}
            aria-hidden
            className="animate-pop pointer-events-none absolute text-8xl font-black text-white drop-shadow-[0_0_0_4px_rgba(255,95,151,0.95)]"
          >
            {countdown}
          </span>
        )}
        {/* 스크린리더용 진행 안내 — 숫자만 바뀌는 큰 글자는 읽히지 않는다 */}
        <span role="status" aria-live="polite" className="sr-only">
          {countdown !== null ? `녹화 중, ${countdown}초 남았어요` : recording ? "녹화를 준비하고 있어요" : ""}
        </span>
        {recording && (
          <span className="animate-camprogress absolute bottom-0 left-0 h-1 rounded-full bg-brand" />
        )}
      </div>

      {!inPreview && <>
        <div className="vlog-tune-chips" role="group" aria-label="보정과 색감">
          <button type="button" className="vlog-tune-chip" aria-expanded={panel==="beauty"} disabled={recording||processing} onClick={()=>setPanel(p=>p==="beauty"?null:"beauty")}>
            보정 · {beauty>0?`${beautyPreset(beautyStyle).label} ${Math.round(beauty*100)}%`:"끄기"}
          </button>
          <button type="button" className="vlog-tune-chip" aria-expanded={panel==="color"} disabled={recording||processing} onClick={()=>setPanel(p=>p==="color"?null:"color")}>
            색감 · {videoFilter(filter).label}
          </button>
        </div>
        {panel==="beauty" && <VideoBeautyPicker value={beauty} onChange={selectBeauty} preset={beautyStyle} onPresetChange={selectBeautyStyle} disabled={recording||processing} unsupported={colorUnsupported}/>}
        {panel==="color" && <VideoFilterPicker value={filter} strength={strength} onChange={selectTone} onStrength={selectStrength} disabled={recording||processing} unsupported={colorUnsupported}/>}
      </>}
      {inPreview && <p className="vlog-color-saved">{clip?`${beauty>0?beautyPreset(beautyStyle).label:"보정 끄기"} ${Math.round(beauty*100)}% · ${videoFilter(filter).label} · 영상에 적용해 저장했어요`:"기존 영상 · 보정을 바꾸려면 다시 찍기를 선택해 주세요"}</p>}
      {processing && <p className="vlog-color-saved" role="status">보정을 영상에 저장하는 중… 잠시만 기다려 주세요.</p>}
      {busy && phase === "upload" && <p className="vlog-color-saved" role="status">올리는 중… 닫아도 영상은 이 기기에 보관했다가 다시 올려요.</p>}

      {err && <p role="alert" className="relative px-4 py-1 text-center text-xs text-rose">{err}</p>}
      {slotClosedBlob && (
        <div className="flex justify-center pb-1">
          <button type="button" onClick={saveToDevice} className="tap rounded-full bg-white/15 px-4 py-2.5 text-xs font-bold text-white">
            이 영상 기기에 저장
          </button>
        </div>
      )}
      </div>

      {/* 컨트롤 */}
      <div className="vlog-capture-controls relative flex flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        {inPreview ? (
          <div className="flex items-center gap-3">
            <button
              onClick={retake}
              disabled={phase === "save"}
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
                onClick={() => startRecording()}
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
              {recording ? "찍는 중…" : mission ? `오늘의 미션 · ${mission}` : "하트를 누르면 3초 동안 찍혀요"}
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
