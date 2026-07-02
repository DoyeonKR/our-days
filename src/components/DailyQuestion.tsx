"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import {
  type Answer,
  currentUserId,
  getAnswers,
  listAllAnswers,
  submitAnswer,
  subscribeAnswers,
} from "@/lib/couple";
import { questionText, todaysQuestion } from "@/lib/questions";

export default function DailyQuestion({
  coupleId,
  partnerName,
}: {
  coupleId: string;
  partnerName: string;
}) {
  const q = todaysQuestion();
  const [uid, setUid] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState("");
  // 답변을 '쓰기 시작한 시점'의 질문 id — 자정 넘겨 제출해도 원래 질문에 귀속되게
  const [draftQid, setDraftQid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<Answer[]>([]);

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
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const id = await currentUserId();
      if (cancelled) return;
      setUid(id);
      const refresh = () =>
        getAnswers(coupleId, q.id)
          .then((a) => {
            if (!cancelled) setAnswers(a);
          })
          .catch(() => {});
      refresh();
      unsub = subscribeAnswers(coupleId, refresh);
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId, q.id]);

  const mine = answers.find((a) => a.user_id === uid);
  const partner = answers.find((a) => a.user_id !== uid);

  async function submit() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      // 자정 걸쳐 작성했으면 시작 시점 질문(draftQid)에 귀속 — 엉뚱한 질문 아래 저장 방지
      await submitAnswer(coupleId, draftQid ?? q.id, draft.trim());
      setDraftQid(null);
      setAnswers(await getAnswers(coupleId, q.id));
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-card)] bg-card glass p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
      <p className="text-xs font-bold text-rose-deep">오늘의 질문</p>
      <p className="mt-1 text-base font-bold text-ink">{q.text}</p>

      {!mine ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => {
              if (!draftQid && e.target.value.trim()) setDraftQid(q.id);
              if (!e.target.value.trim()) setDraftQid(null);
              setDraft(e.target.value);
            }}
            rows={2}
            maxLength={200}
            placeholder="내 답을 적으면 상대 답도 열려요"
            className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <button
            disabled={busy || !draft.trim()}
            onClick={submit}
            className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            {busy ? "…" : "답하기"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-rose/10 px-3 py-2">
            <p className="text-[11px] text-muted">나</p>
            <p className="text-sm text-ink">{mine.body}</p>
          </div>
          {partner ? (
            <div className="animate-pop rounded-xl bg-glass px-3 py-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              <p className="text-[11px] text-muted">{partnerName || "상대"}</p>
              <p className="text-sm text-ink">{partner.body}</p>
            </div>
          ) : (
            <p className="rounded-xl bg-glass2 px-3 py-3 text-center text-xs text-muted">
              {partnerName || "상대"}가 답하면 여기 공개돼요 🔒
            </p>
          )}
        </div>
      )}

      {/* 지난 질문/답변 보관함 */}
      <button
        onClick={() => setHistOpen((o) => !o)}
        className="tap mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-rose-deep"
      >
        {histOpen ? "지난 질문 접기" : "지난 질문/답변 모아보기"}
        <Icon
          name="chevronDown"
          size={14}
          className={`transition-transform ${histOpen ? "rotate-180" : ""}`}
        />
      </button>
      {histOpen && (
        <div className="mt-2 space-y-2">
          {groups.length === 0 ? (
            <p className="text-center text-xs text-muted">아직 쌓인 질문이 없어요</p>
          ) : (
            groups.map((g) => (
              <div key={g.qid} className="rounded-xl bg-glass p-3 ring-1 ring-line shadow-[var(--shadow-sm)]">
                <p className="text-xs font-bold text-ink">{questionText(g.qid)}</p>
                <p className="mt-1 text-xs text-muted">
                  나: <span className="text-ink">{g.mine ?? "—"}</span>
                </p>
                <p className="text-xs text-muted">
                  {partnerName || "상대"}:{" "}
                  <span className="text-ink">{g.partner ?? "🔒 아직"}</span>
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
