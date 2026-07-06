"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type QuizResponse,
  listQuizResponses,
  submitQuiz,
  subscribeQuiz,
} from "@/lib/couple";
import { QUIZ, type QuizChoice, quizScore } from "@/lib/quiz";
import Icon from "@/components/Icon";

/** A/B 선택 필 (모듈 레벨 — 렌더 중 컴포넌트 생성 안 함). */
function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`tap flex-1 rounded-xl px-2 py-2.5 text-sm font-bold ring-1 ${
        on ? "bg-rose/15 text-rose-deep ring-rose" : "bg-glass text-ink ring-line"
      }`}
    >
      {children}
    </button>
  );
}

/** 서로 얼마나 알까 퀴즈 — 각자 '나는?' + '상대는?(예측)'. 둘 다 답하면 예측 적중 채점.
 *  상대 응답은 내가 답해야 열림(RLS 스포 방지, 오늘의 질문과 동일 패턴). */
export default function QuizGame({
  coupleId,
  myUserId,
  partnerName,
}: {
  coupleId: string;
  myUserId: string | null; // page.tsx 확보 uid — getUser 중복 제거
  partnerName: string;
}) {
  const uid = myUserId;
  const [resp, setResp] = useState<QuizResponse[]>([]);
  const [self, setSelf] = useState<QuizChoice | "">("");
  const [guess, setGuess] = useState<QuizChoice | "">("");
  const [busy, setBusy] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [open, setOpen] = useState(false); // 홈 정리: 기본 접힘(점수만 노출)

  // 완료 상태(슬림 강등 여부)를 알아야 하므로 마운트 시 1회 로드(경량).
  useEffect(() => {
    let cancelled = false;
    listQuizResponses(coupleId)
      .then((r) => {
        if (!cancelled) setResp(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  // 실시간 구독은 펼칠 때만 — 상시 채널 절감
  useEffect(() => {
    if (!open) return;
    const unsub = subscribeQuiz(coupleId, () => {
      listQuizResponses(coupleId)
        .then(setResp)
        .catch(() => {});
    });
    return unsub;
  }, [coupleId, open]);

  const mine = useMemo(
    () => new Map(resp.filter((r) => r.user_id === uid).map((r) => [r.question_id, r])),
    [resp, uid],
  );
  const partner = useMemo(
    () => new Map(resp.filter((r) => r.user_id !== uid).map((r) => [r.question_id, r])),
    [resp, uid],
  );

  const { correct, total: bothCount } = quizScore(resp, uid);
  const next = QUIZ.find((q) => !mine.has(q.id));
  const answeredCount = QUIZ.filter((q) => mine.has(q.id)).length;
  // 1회성 게임 — 둘 다 전 문항 완주하면 홈에서 슬림 한 줄(점수 키프세이크)로 강등.
  // 미완(내 문제 남음/상대 답 대기)일 때만 프롬프트 카드로 노출.
  const fullyDone = mine.size >= QUIZ.length && partner.size >= QUIZ.length;

  async function submit() {
    if (!next || !self || !guess) return;
    setBusy(true);
    try {
      await submitQuiz(coupleId, next.id, self, guess);
      setResp(await listQuizResponses(coupleId));
      setSelf("");
      setGuess("");
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  const showForm = next && !showResults;

  return (
    <section
      className={`rounded-[var(--radius-card)] bg-card glass shadow-[var(--shadow-md)] ring-1 ring-line ${
        fullyDone ? "mt-3 px-4 py-3" : "mt-6 p-5"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">서로 얼마나 알까 💘</span>
          {bothCount > 0 && (
            <span className="rounded-full bg-rose/12 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-rose-deep">
              {correct}/{bothCount} 적중
            </span>
          )}
          {!open && next && (
            <span className="text-[11px] font-semibold text-muted">· 풀어보기</span>
          )}
        </span>
        <Icon
          name="chevronDown"
          size={18}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
      <>
      {showForm ? (
        <div className="mt-3">
          <p className="text-[11px] text-muted">
            {answeredCount}/{QUIZ.length}
          </p>
          <p className="mt-1 text-base font-bold text-ink">{next!.q}</p>

          <p className="mt-3 text-xs font-semibold text-muted">나는?</p>
          <div className="mt-1.5 flex gap-2">
            <Pill on={self === "a"} onClick={() => setSelf("a")}>{next!.a}</Pill>
            <Pill on={self === "b"} onClick={() => setSelf("b")}>{next!.b}</Pill>
          </div>

          <p className="mt-3 text-xs font-semibold text-muted">
            {partnerName || "상대"}는? <span className="text-rose-deep">(예측)</span>
          </p>
          <div className="mt-1.5 flex gap-2">
            <Pill on={guess === "a"} onClick={() => setGuess("a")}>{next!.a}</Pill>
            <Pill on={guess === "b"} onClick={() => setGuess("b")}>{next!.b}</Pill>
          </div>

          <button
            disabled={busy || !self || !guess}
            onClick={submit}
            aria-busy={busy}
            className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            {busy ? "저장 중…" : "제출하고 다음"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {next && (
            <button
              onClick={() => setShowResults(false)}
              className="tap w-full rounded-xl bg-glass py-2 text-xs font-bold text-rose-deep ring-1 ring-line"
            >
              남은 문제 풀기 ({QUIZ.length - answeredCount}개)
            </button>
          )}
          {QUIZ.filter((q) => mine.has(q.id)).map((q) => {
            const m = mine.get(q.id)!;
            const p = partner.get(q.id);
            const hit = p && m.guess_choice === p.self_choice;
            const label = (c: QuizChoice) => (c === "a" ? q.a : q.b);
            return (
              <div key={q.id} className="rounded-xl bg-glass px-3 py-2 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ink">{q.q}</p>
                  {p ? (
                    <span className={hit ? "text-rose-deep" : "text-muted"}>
                      <Icon name={hit ? "circleCheck" : "circleX"} size={16} />
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">상대 대기중</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  내 예측: <span className="text-ink">{label(m.guess_choice)}</span>
                  {p && (
                    <>
                      {" · "}
                      {partnerName || "상대"} 실제:{" "}
                      <span className="text-ink">{label(p.self_choice)}</span>
                    </>
                  )}
                </p>
              </div>
            );
          })}
          {answeredCount === 0 && (
            <p className="text-center text-xs text-muted">첫 문제를 풀어보세요!</p>
          )}
        </div>
      )}

      {/* 결과/문제 전환 (풀던 중에도 결과 미리보기) */}
      {next && !showResults && answeredCount > 0 && (
        <button
          onClick={() => setShowResults(true)}
          className="tap mt-3 w-full text-center text-xs font-semibold text-rose-deep"
        >
          지금까지 결과 보기
        </button>
      )}
      </>
      )}
    </section>
  );
}
