"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { LockMark } from "@/components/PixelGlyph";
import WorldProp from "@/components/island/WorldProp";
import { sendEventPush } from "@/lib/notify";
import {
  type Answer,
  getAnswers,
  listAllAnswers,
  listQuestionRounds,
  submitAnswer,
  subscribeAnswers,
} from "@/lib/couple";
import { questionDate, questionIndex, questionText, todaysQuestion } from "@/lib/questions";
import { splitByOwner } from "@/lib/ownerSplit";
import { useDayTick } from "@/lib/useDayTick";
import { useMyUid } from "@/lib/useMyUid";
import { parseDate } from "@/lib/dday";
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from "@/lib/draft";
import { pickStaleQuestionDraft, questionDraftState, type QuestionDraft } from "@/lib/questiondraft";

export function HomeQuestionFrame({ question, children }: {question:string; children:ReactNode}) {
  return <section className="home-question-card">
    <div className="home-letter-stamp" aria-hidden="true">♥<small>우리</small></div>
    <span className="home-feed-eyebrow">03 · 오늘의 질문</span>
    <div className="home-letter-heading flex items-start gap-2.5">
      <span aria-hidden className="shrink-0"><WorldProp kind="loveletter" size={38}/></span>
      <div className="min-w-0"><p className="text-xs font-bold text-rose-deep">오늘의 질문이 도착했어요</p><h3 className="home-letter-question">{question}</h3></div>
    </div>{children}
  </section>;
}

export default function DailyQuestion({
  coupleId,
  myUserId,
  partnerName,
  onStatus,
}: {
  coupleId: string;
  myUserId: string | null; // page.tsx 확보 uid — getUser 중복 제거
  partnerName: string;
  /** '오늘의 우리' 진행 표시용 — 오늘의 질문에 내가 답했는가. */
  onStatus?: (done: boolean) => void;
}) {
  // 자정/앱 재개 시 dayKey 가 바뀌면 오늘의 질문이 자동 전환됨(백그라운드 자정 넘김 포함)
  const day = useDayTick();
  const q = useMemo(() => todaysQuestion(parseDate(day)), [day]);
  // prop uid 가 null(auth info fetch 실패)이어도 저장 정체성과 같은 uid 로 복구 — 오귀속 방지
  const uid = useMyUid(myUserId);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState("");
  // 답변을 '쓰기 시작한 시점'의 질문 id — 자정 넘겨 제출해도 원래 질문에 귀속되게
  const [draftQid, setDraftQid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<Answer[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  // 같은 질문의 **지난 회차** 답 — 2026-09-26 부터 답이 회차(질문+날짜)에 묶여서 같은 질문이 다시 와도
  // 빈 칸에서 새로 답한다. 예전 답은 지우지 않고 "지난번엔"으로 접어 둔다(겹침을 비교하는 재미로).
  const [past, setPast] = useState<Answer[]>([]);
  useEffect(() => {
    let cancelled = false;
    // 같은 질문의 회차만 서버에서 골라 받는다 — 예전엔 커플의 답 전부를 홈이 열릴 때마다 받아 여기서 걸렀다
    listQuestionRounds(coupleId, q.index)
      .then((all) => {
        if (!cancelled) setPast(all.filter((a) => a.question_id !== q.id && questionIndex(a.question_id) === q.index));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleId, q.id, q.index]);
  const lastRound = useMemo(() => {
    if (!uid || past.length === 0) return null;
    const latest = past.reduce((a, b) => (b.created_at > a.created_at ? b : a));
    // 귀속은 공용 규칙(splitByOwner)으로 — raw find 는 uid 를 모를 때 아무 행이나 '상대'로 잡는다
    const round = splitByOwner(past.filter((a) => a.question_id === latest.question_id), uid, (a) => a.user_id);
    return {
      date: questionDate(latest.question_id) ?? latest.created_at.slice(0, 10),
      mine: round.mine?.body ?? null,
      partner: round.partner?.body ?? null,
    };
  }, [past, uid]);

  useEffect(() => {
    // 새 질문으로 전환될 때만 복원. 현재 작성값은 자정 경계에서도 유지한다(그 초안의 키도 건드리지 않는다).
    if (draft.trim()) return;
    const todayKey = draftStorageKey("question", `${coupleId}:${q.id}`);
    const saved = loadDraft<QuestionDraft>(localStorage, todayKey);
    if (saved?.body) {
      setDraft(saved.body);
      setDraftQid(saved.questionId);
      setDraftSaved(true);
      return; // 지난 질문 초안은 다음에 — 말없이 지우지 않는다
    }
    // 지난 질문의 초안 [2026-11-11] — 예전엔 오늘 키가 아니면 전부 지워서(2026-08-26 청소) 자정 전에 쓰던 답이
    // 다시 열면 말없이 사라졌다. 이제 글이 있는 가장 최근 것 하나를 **한 번** 되살려 '어제 질문'으로 보여 주고
    // (옮기기 · 지우기), 이미 보여 준 것 · 빈 것 · 더 오래된 것만 지운다.
    try {
      const prefix = draftStorageKey("question", `${coupleId}:`);
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && k !== todayKey) keys.push(k);
      }
      const { offer, remove } = pickStaleQuestionDraft(keys.map((key) => ({ key, value: loadDraft<QuestionDraft>(localStorage, key) })));
      for (const k of remove) clearDraft(localStorage, k);
      if (offer) {
        saveDraft<QuestionDraft>(localStorage, offer.key, { ...offer.value, offered: true }); // 다음에 열 때는 다시 안 꺼낸다
        setDraft(offer.value.body);
        setDraftQid(offer.value.questionId);
        setDraftSaved(true);
      }
    } catch {
      /* 저장소를 못 쓰면 초안 없이 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, q.id]);

  useEffect(() => {
    const questionId = draftQid ?? q.id;
    const key = draftStorageKey("question", `${coupleId}:${questionId}`);
    if (!draft.trim()) {
      clearDraft(localStorage, key);
      setDraftSaved(false);
      return;
    }
    setDraftSaved(false);
    const timer = setTimeout(() => {
      setDraftSaved(
        // 지난 질문의 초안은 이미 화면에 보여 줬다(offered) — 다음 실행에선 다시 꺼내지 않고 치운다
        saveDraft<QuestionDraft>(localStorage, key, { body: draft, questionId, ...(questionId !== q.id ? { offered: true } : {}) }),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [coupleId, q.id, draft, draftQid]);

  useEffect(() => {
    if (!histOpen) return;
    let cancelled = false;
    listAllAnswers(coupleId)
      .then((a) => {
        if (!cancelled) setHist(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [histOpen, coupleId, answers]);

  const groups = useMemo(() => {
    const m = new Map<string, { mine?: string; partner?: string; at: string }>();
    // uid 미확정이면 전부 '상대'로 오귀속되므로 귀속 자체를 보류(다음 렌더에서 복구)
    if (!uid) return [];
    for (const a of hist) {
      const g = m.get(a.question_id) ?? { at: a.created_at };
      if (a.user_id === uid) g.mine = a.body;
      else g.partner = a.body;
      if (a.created_at > g.at) g.at = a.created_at;
      m.set(a.question_id, g);
    }
    return [...m.entries()]
      .map(([qid, g]) => ({ qid, ...g }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [hist, uid]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getAnswers(coupleId, q.id)
        .then((a) => {
          if (!cancelled) setAnswers(a);
        })
        .catch(() => {});
    refresh();
    const unsub = subscribeAnswers(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId, q.id]);

  const { mine, partner } = splitByOwner(answers, uid, (a) => a.user_id);
  const answered = !!mine;
  // 쓰던 답이 어느 질문 것인가 — 자정을 넘겼으면 그 질문 글을 '어제 질문'으로 보여 준다(오늘 질문 아래 어제 답이 저장되던 것)
  const [nowMs, setNowMs] = useState(() => Date.now());
  const draftState = questionDraftState(draft.trim() ? draftQid : null, q.id, nowMs);
  useEffect(() => {
    if (draftState !== "grace") return;
    // 유예(새벽 3시)가 지나는 순간을 화면이 알게 — 1분마다
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [draftState]);
  useEffect(() => setNowMs(Date.now()), [q.id, draftQid]);
  function draftKeyOf(qid: string) {
    return draftStorageKey("question", `${coupleId}:${qid}`);
  }
  /** 어제 질문에 쓰던 답 → 오늘 질문으로(글은 그대로). */
  function moveDraftToToday() {
    if (draftQid && draftQid !== q.id) clearDraft(localStorage, draftKeyOf(draftQid));
    setDraftQid(q.id);
    setErr(null);
  }
  function discardStaleDraft() {
    if (draftQid) clearDraft(localStorage, draftKeyOf(draftQid));
    setDraft("");
    setDraftQid(null);
    setErr(null);
  }
  useEffect(() => {
    onStatus?.(answered);
  }, [answered, onStatus]);

  async function submit() {
    if (!draft.trim() || draftState === "expired") return; // 유예가 지난 어제 질문엔 내지 않는다(옮기거나 지운다)
    setBusy(true);
    setErr(null);
    try {
      // 자정 걸쳐 작성했으면 시작 시점 질문(draftQid)에 귀속 — 엉뚱한 질문 아래 저장 방지
      const submittedQuestionId = draftQid ?? q.id;
      await submitAnswer(coupleId, submittedQuestionId, draft.trim());
      // 기분과 같은 카테고리(moodq)라 누르면 갈 카드를 직접 정한다 — 기본값은 기분 카드다
      sendEventPush(coupleId, "moodq", "💬 오늘의 질문에 답했어요", "너도 답하면 서로의 답이 열려요", "answer");
      setDraftQid(null);
      // 자정 경계: 어제 질문(draftQid)에 저장한 경우 오늘 질문 기준으론 mine 이 없어
      // 입력창이 draft 채로 재노출 → 재탭 시 이중 저장. 성공했으면 draft 를 비운다.
      setDraft("");
      clearDraft(localStorage, draftStorageKey("question", `${coupleId}:${submittedQuestionId}`));
      setDraftSaved(false);
      setAnswers(await getAnswers(coupleId, q.id));
    } catch (e) {
      // 저장 실패를 조용히 삼키면 답이 사라진 것처럼 보임(draft 는 유지됨) — 사용자에게 알림
      setErr(e instanceof Error && e.message ? e.message : "답 저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <HomeQuestionFrame question={q.text}>

      {!mine || draftState !== "today" ? (
        <div className="mt-3">
          {draftState !== "today" && draftQid && (
            <div className="mb-2 rounded-xl bg-glass2 px-3 py-2 text-xs ring-1 ring-line">
              <p className="font-bold text-rose-deep">어제 질문</p>
              <p className="mt-0.5 text-ink">{questionText(draftQid)}</p>
              <p className="mt-0.5 text-muted">
                {draftState === "grace"
                  ? "쓰던 답은 이 질문에 남아요(새벽 3시까지). 오늘 질문에 답하려면 옮겨 주세요."
                  : "어제 질문은 이제 답할 수 없어요. 오늘 질문으로 옮기거나 지워 주세요."}
              </p>
              <div className="mt-1.5 flex gap-2">
                {!mine && (
                  <button type="button" onClick={moveDraftToToday} className="tap rounded-full bg-brand px-3 py-1.5 font-bold text-white">
                    오늘 질문으로 옮기기
                  </button>
                )}
                <button type="button" onClick={discardStaleDraft} className="tap rounded-full bg-glass px-3 py-1.5 font-bold text-ink ring-1 ring-line">
                  지우기
                </button>
              </div>
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => {
              if (!draftQid && e.target.value.trim()) setDraftQid(q.id);
              if (!e.target.value.trim()) {
                // 지난 질문의 초안을 다 지웠으면 그 키도 — 남겨 두면 다음에 다시 꺼낸다
                if (draftQid && draftQid !== q.id) clearDraft(localStorage, draftKeyOf(draftQid));
                setDraftQid(null);
              }
              setDraft(e.target.value);
            }}
            rows={2}
            maxLength={200}
            aria-label={`${draftState !== "today" && draftQid ? "어제" : "오늘의"} 질문 답: ${draftState !== "today" && draftQid ? questionText(draftQid) : q.text}`}
            placeholder="내 답을 적으면 상대 답도 열려요"
            className="home-letter-input w-full outline-none focus:border-rose"
          />
          {err && (
            <p role="alert" className="mt-1.5 text-xs text-rose-deep">
              {err}
            </p>
          )}
          {draft.trim() && (
            <p className="mt-1 text-right text-xs text-muted">
              {draftSaved ? "이 기기에 초안 저장됨" : "초안 저장 중…"}
            </p>
          )}
          <button
            disabled={busy || !draft.trim() || draftState === "expired"}
            onClick={submit}
            aria-busy={busy}
            className="tap home-feed-primary disabled:opacity-50"
          >
            {busy ? "저장 중…" : draftState === "grace" ? "어제 질문에 답하기" : "답하기"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-rose/10 px-3 py-2">
            <p className="text-sm text-muted">나</p>
            <p className="text-sm text-ink">{mine.body}</p>
          </div>
          {partner ? (
            <div className="animate-pop rounded-xl bg-glass px-3 py-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              <p className="text-sm text-muted">{partnerName || "상대"}</p>
              <p className="text-sm text-ink">{partner.body}</p>
            </div>
          ) : (
            <p className="rounded-xl bg-glass2 px-3 py-2 text-center text-xs text-muted">
              <LockMark />
              {partnerName || "상대"}가 답하면 여기 공개돼요
            </p>
          )}
        </div>
      )}

      {lastRound && (
        <details className="mt-3 rounded-xl bg-glass2 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-bold text-rose-deep">
            지난번({lastRound.date.replaceAll("-", ".")})엔 이렇게 답했어요
          </summary>
          <p className="mt-1.5 text-muted">
            나: <span className="text-ink">{lastRound.mine ?? "-"}</span>
          </p>
          <p className="text-muted">
            {partnerName || "상대"}: <span className="text-ink">{lastRound.partner ?? (lastRound.mine ? "그땐 답하지 않았어요" : <><LockMark />그때 내가 안 답해서 안 보여요</>)}</span>
          </p>
        </details>
      )}

      {/* 지난 질문/답변 보관함 */}
      <button
        onClick={() => setHistOpen((o) => !o)}
        aria-expanded={histOpen}
        aria-controls={`qa-history-${coupleId}`}
        className="tap home-letter-history"
      >
        {histOpen ? "지난 질문 접기" : "지난 질문/답변 모아보기"}
        <Icon
          name="chevronDown"
          size={14}
          className={`transition-transform ${histOpen ? "rotate-180" : ""}`}
        />
      </button>
      {histOpen && (
        <div id={`qa-history-${coupleId}`} className="mt-2 space-y-2">
          {groups.length === 0 ? (
            <p className="text-center text-xs text-muted">아직 쌓인 질문이 없어요</p>
          ) : (
            groups.map((g) => (
              <div key={g.qid} className="rounded-xl bg-glass p-3 ring-1 ring-line shadow-[var(--shadow-sm)]">
                <p className="text-xs font-bold text-ink">
                  {questionText(g.qid)}
                  <span className="ml-1 font-normal text-muted">{(questionDate(g.qid) ?? g.at.slice(0, 10)).replaceAll("-", ".")}</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  나: <span className="text-ink">{g.mine ?? "-"}</span>
                </p>
                <p className="text-xs text-muted">
                  {partnerName || "상대"}:{" "}
                  <span className="text-ink">{g.partner ?? <><LockMark />아직</>}</span>
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </HomeQuestionFrame>
  );
}
