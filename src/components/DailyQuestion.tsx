"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { LoveLetter } from "@/components/island/art/world";
import { sendEventPush } from "@/lib/notify";
import {
  type Answer,
  getAnswers,
  listAllAnswers,
  submitAnswer,
  subscribeAnswers,
} from "@/lib/couple";
import { questionText, todaysQuestion } from "@/lib/questions";
import { splitByOwner } from "@/lib/ownerSplit";
import { useDayTick } from "@/lib/useDayTick";
import { useMyUid } from "@/lib/useMyUid";
import { parseDate } from "@/lib/dday";

export default function DailyQuestion({
  coupleId,
  myUserId,
  partnerName,
}: {
  coupleId: string;
  myUserId: string | null; // page.tsx 확보 uid — getUser 중복 제거
  partnerName: string;
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

  async function submit() {
    if (!draft.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      // 자정 걸쳐 작성했으면 시작 시점 질문(draftQid)에 귀속 — 엉뚱한 질문 아래 저장 방지
      await submitAnswer(coupleId, draftQid ?? q.id, draft.trim());
      sendEventPush(coupleId, "moodq", "💬 오늘의 질문에 답했어요", "너도 답하면 서로의 답이 열려요");
      setDraftQid(null);
      // 자정 경계: 어제 질문(draftQid)에 저장한 경우 오늘 질문 기준으론 mine 이 없어
      // 입력창이 draft 채로 재노출 → 재탭 시 이중 저장. 성공했으면 draft 를 비운다.
      setDraft("");
      setAnswers(await getAnswers(coupleId, q.id));
    } catch (e) {
      // 저장 실패를 조용히 삼키면 답이 사라진 것처럼 보임(draft 는 유지됨) — 사용자에게 알림
      setErr(e instanceof Error && e.message ? e.message : "답 저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
      {/* V2 — 러브레터 봉투에서 오늘의 질문이 배달된다(우편함 세계관) */}
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="animate-floaty -mt-1 shrink-0">
          <LoveLetter size={38} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-rose-deep">오늘의 질문이 도착했어요</p>
          <p className="mt-0.5 text-base font-bold leading-snug text-ink">{q.text}</p>
        </div>
      </div>

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
            aria-label={`오늘의 질문 답: ${q.text}`}
            placeholder="내 답을 적으면 상대 답도 열려요"
            className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          {err && (
            <p role="alert" className="mt-1.5 text-xs text-rose-deep">
              {err}
            </p>
          )}
          <button
            disabled={busy || !draft.trim()}
            onClick={submit}
            aria-busy={busy}
            className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            {busy ? "저장 중…" : "답하기"}
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
            <p className="rounded-xl bg-glass2 px-3 py-2 text-center text-xs text-muted">
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
