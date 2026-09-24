"use client";

/* 홈 '오늘의 우리' — 매일 하는 일 셋(3초 로그 · 기분 한 줄 · 오늘의 질문)을 한 묶음으로. [2026-09-24 IA 개편]
 *
 * [사용자: "지금 메뉴가 너무 파편화 되어있는 것 같아 홈/기록/계획/함께 여기에서 모을 수 있는걸 다시 모으고"]
 * 예전엔 로그 카드는 홈에, 기분 한 줄과 오늘의 질문은 **함께** 탭에 있었다. 매일 하는 일인데 탭 두 개를
 * 오가야 했고, 활동함에서 기분·질문 행을 누르면 **홈**으로 가서 카드를 못 찾았다(죽은 링크).
 * 이제 셋이 한 화면에 있고, 머리에 "오늘 3개 중 N개"와 연속 기록(모닥불)을 둔다.
 *
 * ⚠ 카드의 id(today-log · today-mood · today-question)는 lib/activity 의 activityRoute(HomeFocus)가
 *   가리키는 과녁이다 — 활동함·푸시 알림이 이 id 로 스크롤한다. 바꾸면 두 곳을 같이 고쳐라(todayhub.test).
 * ⚠ 진행 여부는 각 카드가 **자기 화면과 같은 기준**으로 알려 준다(onStatus). 여기서 따로 조회하면
 *   '카드엔 했다고 나오는데 머리엔 안 했다고' 같은 어긋남이 생긴다.
 */

import { useCallback, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import WorldProp from "@/components/island/WorldProp";
import { MicroIcon } from "@/components/PixelGlyph";
import WorldSectionHead from "@/components/WorldSectionHead";
import TodayLogCard from "@/components/TodayLogCard";
import MoodLine from "@/components/MoodLine";
import DailyQuestion from "@/components/DailyQuestion";
import StreakChip from "@/components/StreakChip";
import type { HomeFocus } from "@/lib/activity";

type StepKey = "log" | "mood" | "question";
const STEPS: { k: StepKey; id: HomeFocus; label: string; icon: IconName }[] = [
  { k: "log", id: "today-log", label: "3초 로그", icon: "camera" },
  { k: "mood", id: "today-mood", label: "기분 한 줄", icon: "smile" },
  { k: "question", id: "today-question", label: "오늘의 질문", icon: "question" },
];

/** 홈 카드로 스크롤 — 활동함·푸시·진행 칩이 같은 함수를 쓴다. 잠깐 테두리를 밝혀 어느 카드인지 보여 준다. */
export function focusHomeCard(id: HomeFocus) {
  const el = document.getElementById(id);
  if (!el) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  el.classList.remove("focus-flash");
  void el.offsetWidth; // 같은 카드를 연달아 눌러도 반짝임이 다시 돌게 — 애니를 재시작한다
  el.classList.add("focus-flash");
}

export default function TodayTogether({
  coupleId,
  myUserId,
  myName,
  partnerName,
  onOpenLog,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onOpenLog: (openCapture?: boolean) => void;
}) {
  const [done, setDone] = useState<Record<StepKey, boolean>>({ log: false, mood: false, question: false });
  // 같은 값이면 이전 객체를 그대로 돌려준다 — 카드의 effect 가 불러도 다시 그리지 않게
  const onLog = useCallback((d: boolean) => setDone((p) => (p.log === d ? p : { ...p, log: d })), []);
  const onMood = useCallback((d: boolean) => setDone((p) => (p.mood === d ? p : { ...p, mood: d })), []);
  const onQuestion = useCallback((d: boolean) => setDone((p) => (p.question === d ? p : { ...p, question: d })), []);
  const n = STEPS.filter((st) => done[st.k]).length;

  return (
    <section className="mt-8" aria-label="오늘의 우리">
      <WorldSectionHead
        prop={<WorldProp kind="photocard" size={38} />}
        title="오늘의 우리"
        sub={n === STEPS.length ? <>오늘 할 일을 다 했어요 <MicroIcon k="sparkle" size={12} /></> : `오늘 ${STEPS.length}개 중 ${n}개`}
        action={<StreakChip coupleId={coupleId} />}
      />
      {/* 진행 칩 — 누르면 그 카드로. 한 일은 채워진 칩 + 체크 */}
      <ol className="mb-3 grid grid-cols-3 gap-1.5" aria-label="오늘 할 일">
        {STEPS.map((st) => {
          const ok = done[st.k];
          return (
            <li key={st.k} className="min-w-0">
              <button
                onClick={() => focusHomeCard(st.id)}
                aria-label={`${st.label} ${ok ? "완료" : "아직"} — 카드로 가기`}
                className={`tap flex w-full min-w-0 items-center justify-center gap-1 rounded-full px-1 py-1.5 text-xs font-bold ${
                  ok ? "bg-brand text-white shadow-[var(--shadow-sm)]" : "bg-glass text-muted ring-1 ring-line"
                }`}
              >
                <Icon name={ok ? "check" : st.icon} size={13} className="shrink-0" />
                <span className="truncate">{st.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div id="today-log" className="scroll-mt-[calc(env(safe-area-inset-top)+12px)] rounded-[var(--radius-card)]">
        <TodayLogCard
          coupleId={coupleId}
          myUserId={myUserId}
          myName={myName}
          partnerName={partnerName}
          onOpen={onOpenLog}
          onStatus={onLog}
        />
      </div>
      <div id="today-mood" className="scroll-mt-[calc(env(safe-area-inset-top)+12px)] rounded-[var(--radius-card)]">
        <MoodLine coupleId={coupleId} myUserId={myUserId} myName={myName} partnerName={partnerName} onStatus={onMood} />
      </div>
      <div id="today-question" className="scroll-mt-[calc(env(safe-area-inset-top)+12px)] rounded-[var(--radius-card)]">
        <DailyQuestion coupleId={coupleId} myUserId={myUserId} partnerName={partnerName} onStatus={onQuestion} />
      </div>
    </section>
  );
}
