import { useEffect, useState } from "react";
import { toISODate } from "@/lib/dday";

/**
 * 자정을 넘기면 값이 바뀌는 '오늘' 키('YYYY-MM-DD', 로컬 기준)를 반환하는 훅.
 * 반환값이 바뀌면 소비 컴포넌트가 리렌더 → 날짜 파생값(D-day/오늘 기분/오늘 질문)이 갱신된다.
 *
 * 안정성 포인트 — 두 갱신 경로:
 *  1) setTimeout(다음 자정): 앱을 포그라운드로 켜둔 채 자정을 넘기는 경우.
 *  2) visibilitychange/focus/pageshow: 모바일 PWA 를 백그라운드로 둔 채 자정을 넘기면
 *     브라우저가 (1)의 타이머를 얼려(throttling) 갱신이 지연된다 → 다시 열어 화면이
 *     보이는 즉시 날짜를 재확인해 어제 값이 남는 문제를 없앤다.
 * 같은 날이면 setState 가 bail-out 되어 불필요한 리렌더가 없다.
 */
export function useDayTick(): string {
  const [day, setDay] = useState(() => toISODate(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () =>
      setDay((prev) => {
        const t = toISODate(new Date());
        return prev === t ? prev : t;
      });
    // 다음 자정+5초에 갱신하고, 발화 시 다음 자정으로 재무장(재귀).
    const arm = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5,
      );
      timer = setTimeout(
        () => {
          sync();
          arm();
        },
        Math.max(1000, nextMidnight.getTime() - now.getTime()),
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") return;
      sync();
    };

    arm();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, []);

  return day;
}
