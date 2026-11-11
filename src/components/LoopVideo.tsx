"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { firstFrameSrc } from "@/lib/logreview";

/**
 * 셋로그식 3초 무음 루프 브이로그 — '무조건 자동재생'에 최적화.
 * 홈 카드/로그 탭 공용(중복 제거). 자동재생이 브라우저 정책·타이밍·저전력모드로
 * 실패하던 문제를 다음으로 방어:
 *  - muted 를 '속성'이 아닌 '프로퍼티'로 명시 설정(정책상 muted 라야 제스처 없이 재생 허용).
 *  - canplay/loadeddata/focus/visibilitychange/IntersectionObserver 등 여러 시점에 play() 재시도.
 *  - src 가 바뀌면 이펙트 재무장(새 영상도 자동재생).
 *  - 그래도 거부되면(iOS 저전력 등) 탭하면 재생되는 폴백 버튼.
 *  - [2026-11-06] 첫 장면(poster)을 먼저 그린다 — preload=metadata 는 iOS 저전력 · 느린 망에서 첫 장면을 안 받아
 *    검은 칸으로 남았다. 그림이 없는 옛 로그는 src 에 #t=0.001 을 붙여 첫 장면을 그리게 한다(사파리가 그 지점을 디코딩한다).
 */

export default function LoopVideo({
  src,
  overlay,
  onExpired,
  compact,
  poster,
  label,
}: {
  src: string;
  overlay?: string | null;
  onExpired?: () => void;
  compact?: boolean;
  poster?: string | null;
  /** 스크린리더용 이름(누구의 몇 시 영상인지) */
  label?: string;
}) {
  const playSrc = firstFrameSrc(src, poster);
  const ref = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);
  // 재서명 재시도 캡: 영상이 '실제로 삭제'되면 재서명해도 매번 새 URL(다른 서명)이라
  // src 기반 카운터로는 캡이 안 됨 → 성공 재생(onPlaying) 없이 누적된 에러만 센다.
  // MAX 초과 시 onExpired 호출을 멈춰 evict→재조회→같은 죽은 URL 무한 네트워크 루프 차단.
  const errCountRef = useRef(0);
  const MAX_RECOVER = 2;

  // 화면 안에 있는가(IntersectionObserver). 2026-11-11 배터리 — 예전엔 autoPlay + preload=metadata 라 마운트된 영상이
  // 화면 밖이어도 전부 받기 시작해 재생까지 했다(로그 탭 · 홈 카드). 이제 보일 때만 play() 한다. 관찰자가 없는 브라우저는 보인다고 친다.
  const visibleRef = useRef(typeof IntersectionObserver === "undefined");
  const tryPlay = () => {
    const v = ref.current;
    if (!v || !visibleRef.current || document.visibilityState === "hidden") return;
    v.muted = true; // 자동재생 정책: 프로퍼티로 확실히 muted
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const onReady = () => tryPlay();
    const onVis = () => {
      if (document.visibilityState === "hidden") v.pause();
      else tryPlay();
    };
    // 데이터가 준비되는 여러 시점에 재생 시도 → 타이밍 실패 방어
    v.addEventListener("loadedmetadata", onReady);
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("canplay", onReady);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("pageshow", onVis);
    // 화면 밖 영상은 정지(배터리/메모리), 들어오면 재생
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!ref.current) return;
          visibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) tryPlay();
          else ref.current.pause();
        },
        { threshold: 0.1 },
      );
      io.observe(v);
    }
    tryPlay(); // 초기 시도 — 관찰자가 있으면 첫 콜백(보이는지)이 올 때까지 기다린다(visibleRef)
    return () => {
      v.removeEventListener("loadedmetadata", onReady);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("canplay", onReady);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("pageshow", onVis);
      io?.disconnect();
    };
    // src 가 바뀌면 새 영상으로 재무장
  }, [src]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/20">
      <video
        ref={ref}
        src={playSrc}
        poster={poster || undefined}
        aria-label={label}
        muted
        loop
        playsInline
        // 첫 장면 그림이 있으면 그것만 보이면 된다 — 영상은 보일 때 play() 가 받는다. 그림이 없는 옛 로그는 첫 장면(#t=)을 그리려고 메타데이터만.
        preload={poster ? "none" : "metadata"}
        onError={() => {
          errCountRef.current += 1;
          if (errCountRef.current <= MAX_RECOVER) {
            setFailed(false);
            onExpired?.(); // 재서명 시도 (만료 URL 회복용)
          } else {
            // 재시도 소진: 영상이 실제로 사라짐 → 루프 중단, 안내만 표시(video 는 계속 마운트
            // 유지 → 파일이 되살아나면 onPlaying 이 카운터 리셋해 자연 회복)
            setFailed(true);
          }
        }}
        onPlaying={() => {
          errCountRef.current = 0;
          setFailed(false);
          setNeedsTap(false);
        }}
        className="h-full w-full object-contain"
      />
      {failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 px-2 text-center">
          <span className="text-sm font-semibold text-white/90">
            영상을 불러올 수 없어요
          </span>
        </div>
      )}
      {needsTap && !failed && (
        <button
          onClick={(e) => {
            // 부모가 클릭 가능한 래퍼(홈 스토리 링)일 수 있음 — 재생 탭이 내비게이션으로 새지 않게
            e.stopPropagation();
            tryPlay();
          }}
          aria-label="영상 재생"
          className="absolute inset-0 grid place-items-center bg-black/25"
        >
          <span
            className={`grid place-items-center rounded-full bg-white/85 text-ink shadow-[var(--shadow-md)] ${
              compact ? "h-9 w-9" : "h-11 w-11"
            }`}
          >
            <Icon name="play" size={compact ? 16 : 20} filled />
          </span>
        </button>
      )}
      {overlay?.trim() && !failed && (
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 break-words text-center font-extrabold text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.85)] ${
            compact
              ? "inset-x-1 line-clamp-2 text-sm"
              : "inset-x-2 line-clamp-3 text-sm"
          }`}
        >
          {overlay}
        </span>
      )}
    </div>
  );
}
