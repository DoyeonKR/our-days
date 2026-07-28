"use client";

/* '오늘 어땠어?' — 오늘의 기분 한 줄 평(옛 무드 체크인의 재미 복귀판, 2026-07-27).
   숙제가 아니라 놀이가 되도록:
   · 매일 다른 가벼운 질문(날짜 결정적 — 둘이 같은 질문)이 말을 건다
   · 답은 칩 6개 중 **탭 1번이 전부**(즉시 저장 + 팝). 한마디는 답한 뒤에만 살짝 권함(선택)
   · 상대 답은 바로 보임(가벼움이 핵심 — reveal-gate 없음). 같은 칩이면 💞 이심전심 연출
   · 내일이 되면 질문이 바뀌고 오늘 답은 리셋(어제 답은 '어제의 우리'로 남지 않음 — 가볍게) */

import { useEffect, useState } from "react";
import { type Mood, getMoods, setMyMood, subscribeMoods } from "@/lib/couple";
import { isJinx, isTodayMood, todaysMoodPrompt } from "@/lib/moodPrompt";
import { useDayTick } from "@/lib/useDayTick";
import { sendEventPush } from "@/lib/notify";

export default function MoodLine({
  coupleId,
  myUserId,
  myName,
  partnerName,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
}) {
  const today = useDayTick(); // 자정 넘어가면 프롬프트/오늘 판정 갱신
  // 렌더 순수성: Date.now() 는 state 로 — 날짜가 바뀔 때만 갱신하면 충분(분 단위 정확성 불필요)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
  }, [today]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [popKey, setPopKey] = useState<string | null>(null); // 방금 탭한 칩 팝 연출

  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const load = () =>
      getMoods(coupleId)
        .then((m) => !cancelled && setMoods(m))
        .catch(() => {});
    load();
    const unsub = subscribeMoods(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const prompt = todaysMoodPrompt(now);
  const mineRaw = moods.find((m) => m.user_id === myUserId) ?? null;
  const partnerRaw = moods.find((m) => m.user_id !== myUserId) ?? null;
  const mine = mineRaw && isTodayMood(mineRaw.updated_at, now) ? mineRaw : null;
  const partner = partnerRaw && isTodayMood(partnerRaw.updated_at, now) ? partnerRaw : null;
  const jinx = isJinx(mine, partner, now);
  const chipOf = (e: string) => prompt.chips.find((c) => c.e === e) ?? null;

  async function pick(e: string) {
    if (busy) return;
    setBusy(true);
    setPopKey(e);
    try {
      await setMyMood(coupleId, e, mine?.note ?? "");
      // 상대에게 가볍게 알림(설정 존중은 notify 쪽에서) — 답 유도 아니라 공유
      const label = chipOf(e)?.label ?? "";
      sendEventPush(coupleId, "interact", "오늘 어땠어?", `${myName || "상대"}의 오늘: ${e} ${label}`).catch(() => {});
    } catch {
      // 실패는 조용히 — 다음 탭으로 재시도(가벼운 기능이라 배너 소음 금지)
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!mine) return;
    setBusy(true);
    try {
      await setMyMood(coupleId, mine.emoji, note.trim().slice(0, 40));
      setNoteOpen(false);
    } catch {
      // 조용히
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass relative mt-3 overflow-hidden rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-sm)] ring-1 ring-line">
      {/* 이심전심 — 은은한 배경 하트 글로우 */}
      {jinx && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,127,174,0.25), transparent 70%)" }}
        />
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">
          {prompt.q} <span className="text-[10px] font-semibold text-muted">· 탭 한 번이면 끝</span>
        </p>
        {jinx && (
          <span className="animate-pop rounded-full bg-rose/15 px-2 py-0.5 text-[10px] font-black text-rose-deep">
            💞 이심전심!
          </span>
        )}
      </div>

      {/* 답 칩 — 내가 고른 것 강조, 상대가 고른 것엔 상대 점 표시 */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {prompt.chips.map((c) => {
          const isMine = mine?.emoji === c.e;
          const isPartner = partner?.emoji === c.e;
          return (
            <button
              key={c.e}
              disabled={busy}
              onClick={() => pick(c.e)}
              className={`tap relative flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold ring-1 transition-shadow ${
                isMine
                  ? "bg-rose/15 text-rose-deep ring-rose/40 shadow-[0_0_10px_rgba(255,95,151,0.25)]"
                  : "bg-glass text-ink ring-line"
              } ${popKey === c.e && isMine ? "animate-pop" : ""}`}
            >
              <span className="text-base leading-none">{c.e}</span>
              {c.label}
              {isPartner && (
                <span
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-partner-bg text-[8px] font-black text-partner ring-1 ring-partner/40"
                  title={`${partnerName}의 오늘`}
                >
                  {(partnerName || "상대").slice(0, 1)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 답한 뒤 — 우리 둘 요약 + 선택적 한마디 */}
      {(mine || partner) && (
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
          <span className="min-w-0 flex-1 truncate">
            {mine ? `나 ${mine.emoji}${mine.note ? ` “${mine.note}”` : ""}` : "나 · 아직"}
            <span className="mx-1 text-line-strong">·</span>
            {partner
              ? `${partnerName || "상대"} ${partner.emoji}${partner.note ? ` “${partner.note}”` : ""}`
              : `${partnerName || "상대"} · 아직`}
          </span>
          {mine && !noteOpen && (
            <button
              onClick={() => {
                setNote(mine.note ?? "");
                setNoteOpen(true);
              }}
              className="tap shrink-0 rounded-full bg-rose/10 px-2.5 py-1 font-bold text-rose-deep"
            >
              {mine.note ? "한마디 고치기" : "+ 한마디"}
            </button>
          )}
        </div>
      )}
      {noteOpen && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={40}
            placeholder="딱 한 줄만 (선택)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-xs text-ink outline-none focus:border-rose"
          />
          <button
            onClick={saveNote}
            disabled={busy}
            className="tap shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
      )}
    </section>
  );
}
