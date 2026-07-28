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
import { splitByOwner } from "@/lib/ownerSplit";
import { useDayTick } from "@/lib/useDayTick";
import { useMyUid } from "@/lib/useMyUid";
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
  // ⚠ 귀속 uid — prop 이 null(auth info fetch 실패)이어도 저장 정체성과 같은 uid 로 복구.
  // 이거 없이 raw find(user_id !== myUserId) 쓰면 '상대가 뭘 골라도 첫 행으로 보이는' 회귀.
  const uid = useMyUid(myUserId);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteDirty, setNoteDirty] = useState(false); // 입력 중 realtime 새로고침이 타이핑을 덮지 않게
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
  const { mine: mineRaw, partner: partnerRaw } = splitByOwner(moods, uid, (m) => m.user_id);
  const mine = mineRaw && isTodayMood(mineRaw.updated_at, now) ? mineRaw : null;
  const partner = partnerRaw && isTodayMood(partnerRaw.updated_at, now) ? partnerRaw : null;
  const jinx = isJinx(mine, partner, now);
  const chipOf = (e: string) => prompt.chips.find((c) => c.e === e) ?? null;

  // 내 한마디 입력 동기화 — 입력 중(dirty)이 아닐 때만 서버값 반영
  useEffect(() => {
    if (!noteDirty) setNote(mine?.note ?? "");
  }, [mine?.note, noteDirty]);

  // ⚠ 내 행동(칩/한마디)의 화면 반영을 realtime 소켓에 맡기지 않는다 — 모바일 PWA 는 소켓이
  // 수시로 죽어 '골라도 하이라이트 안 뜸 / 저장한 한마디 사라짐'(사용자 리포트)이 됐다.
  // 쓰기 성공 즉시 로컬 낙관 반영 + HTTP 재조회(벨트&서스펜더). realtime 은 상대 변화 가속용.
  function applyMineLocal(emoji: string, noteVal: string) {
    if (!uid) return;
    const row: Mood = { user_id: uid, emoji, note: noteVal || null, updated_at: new Date().toISOString() };
    setMoods((ms) => [row, ...ms.filter((m) => m.user_id !== uid)]);
  }
  function resync() {
    getMoods(coupleId).then(setMoods).catch(() => {});
  }

  async function pick(e: string) {
    if (busy) return;
    setBusy(true);
    setPopKey(e);
    try {
      // 입력창에 쓰다 만 한마디가 있으면 함께 저장(칩 바꿔도 한마디 유실 없음)
      const noteVal = note.trim().slice(0, 40);
      await setMyMood(coupleId, e, noteVal);
      applyMineLocal(e, noteVal);
      resync();
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
      const noteVal = note.trim().slice(0, 40);
      await setMyMood(coupleId, mine.emoji, noteVal);
      // 낙관 반영을 dirty 해제보다 먼저 — 해제 직후 sync 이펙트가 stale(옛 note)로 입력을
      // 비우던 회귀 방지(저장했는데 사라져 보임)
      applyMineLocal(mine.emoji, noteVal);
      setNoteDirty(false);
      resync();
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
          {prompt.q}{" "}
          {!mine && <span className="text-[10px] font-semibold text-muted">· 탭 한 번이면 끝</span>}
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

      {/* 답한 뒤 — 우리 둘 요약(상대 한마디 포함) */}
      {(mine || partner) && (
        <div className="mt-2.5 text-[11px] text-muted">
          <span className="block truncate">
            {mine ? `나 ${mine.emoji}${mine.note ? ` “${mine.note}”` : ""}` : "나 · 아직"}
            <span className="mx-1 text-line-strong">·</span>
            {partner
              ? `${partnerName || "상대"} ${partner.emoji}${partner.note ? ` “${partner.note}”` : ""}`
              : `${partnerName || "상대"} · 아직`}
          </span>
        </div>
      )}
      {/* 내 한마디 — 버튼 뒤에 숨기지 않고 바로 쓴다(사용자 요청: '+ 없이 바로 작성') */}
      {mine && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteDirty(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
            }}
            maxLength={40}
            placeholder="한마디 남기기 (선택)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-xs text-ink outline-none focus:border-rose"
          />
          <button
            onClick={saveNote}
            disabled={busy || note.trim() === (mine.note ?? "")}
            className="tap shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            저장
          </button>
        </div>
      )}
    </section>
  );
}
