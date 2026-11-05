import { useEffect, useState } from "react";
import { kstDayKey, localDayKey, msUntilNextKstMidnight, msUntilNextLocalMidnight } from "@/lib/daytick";

/* '오늘' 키 훅 두 개 — 기록용(KST)과 기기 시각용(로컬).
 *
 * [2026-11-06] 예전 useDayTick 은 **기기 날짜**를 돌려줬는데, 일기·3초 로그·질문·추억은 저장할 때
 * KST 날짜를 쓴다(addDecoEntry 의 kstDate, 서버 알림도 KST). 해외에 있는 기기에서는 화면의
 * '오늘'과 저장되는 날짜가 하루씩 어긋났다(예: LA 저녁 = KST 다음 날 → 질문 회차 id 가 상대와 갈림,
 * 작년 오늘이 하루 밀림, 일기 편집기에 어제 날짜가 보임). 앱의 날짜 규칙은 전부 KST 라
 * useDayTick 이 KST 날짜를 돌려주고 **KST 자정**에 바뀌게 했다.
 * D-day(함께한 날 · 주년 · 일정의 며칠 남음)는 dday.ts 가 기기 날짜로 센다 — 그 화면은
 * useLocalDayTick 으로 기기 자정에 갱신한다(바꾸면 알림 표시와 숫자가 하루 엇갈린다).
 *
 * 갱신 경로 두 가지:
 *  1) setTimeout(다음 자정 + 5초): 앱을 켜둔 채 자정을 넘기는 경우.
 *  2) visibilitychange/focus/pageshow: 모바일 PWA 를 백그라운드로 둔 채 자정을 넘기면
 *     브라우저가 (1)의 타이머를 얼린다 → 다시 보이는 즉시 날짜를 재확인한다.
 * 같은 날이면 setState 가 bail-out 되어 불필요한 리렌더가 없다.
 * 계산(순수)은 lib/daytick — recordscommon.test 가 시간대별로 잰다.
 */

function useDayKey(keyOf: (now: number) => string, msToNext: (now: number) => number): string {
  const [day, setDay] = useState(() => keyOf(Date.now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () =>
      setDay((prev) => {
        const t = keyOf(Date.now());
        return prev === t ? prev : t;
      });
    // 다음 자정에 갱신하고, 발화 시 다음 자정으로 재무장(재귀).
    const arm = () => {
      timer = setTimeout(() => {
        sync();
        arm();
      }, msToNext(Date.now()));
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
    // keyOf · msToNext 는 모듈 상수만 넘어온다(아래 두 훅) — 다시 무장할 일이 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return day;
}

/** 기록용 '오늘'(KST, YYYY-MM-DD) — KST 자정에 바뀐다. 일기 · 로그 · 질문 · 추억 · 기분 · 스트릭. */
export function useDayTick(): string {
  return useDayKey(kstDayKey, msUntilNextKstMidnight);
}

/** 기기 시각용 '오늘'(로컬, YYYY-MM-DD) — 기기 자정에 바뀐다. dday.ts 가 기기 날짜로 세는 D-day 화면 전용. */
export function useLocalDayTick(): string {
  return useDayKey(localDayKey, msUntilNextLocalMidnight);
}
