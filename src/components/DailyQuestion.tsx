"use client";

import { useEffect, useState } from "react";
import {
  type Answer,
  currentUserId,
  getAnswers,
  submitAnswer,
  subscribeAnswers,
} from "@/lib/couple";
import { todaysQuestion } from "@/lib/questions";

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
  const [busy, setBusy] = useState(false);

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
      await submitAnswer(coupleId, q.id, draft.trim());
      setAnswers(await getAnswers(coupleId, q.id));
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line backdrop-blur-xl">
      <p className="text-xs font-bold text-rose-deep">오늘의 질문</p>
      <p className="mt-1 text-base font-bold text-ink">{q.text}</p>

      {!mine ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="내 답을 적으면 상대 답도 열려요"
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <button
            disabled={busy || !draft.trim()}
            onClick={submit}
            className="mt-2 w-full rounded-xl bg-rose-deep py-2.5 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-50"
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
            <div className="animate-pop rounded-xl bg-white/70 px-3 py-2 ring-1 ring-line">
              <p className="text-[11px] text-muted">{partnerName || "상대"}</p>
              <p className="text-sm text-ink">{partner.body}</p>
            </div>
          ) : (
            <p className="rounded-xl bg-white/40 px-3 py-3 text-center text-xs text-muted">
              {partnerName || "상대"}가 답하면 여기 공개돼요 🔒
            </p>
          )}
        </div>
      )}
    </section>
  );
}
