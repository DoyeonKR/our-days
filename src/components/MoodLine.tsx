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
  // 한마디 입력 = 채팅형 컴포즈 필드(항상 빈 상태에서 시작, 보내면 비워짐).
  // ⚠ 서버값을 입력에 자동 동기화하지 않는다 — '보냈는데 입력에 그대로 남아 안 보낸 것 같다'
  // 리포트의 원인이었음. 저장된 한마디는 아래 말풍선이 보여준다(수정 = 내 말풍선 탭).
  const [note, setNote] = useState("");
  const [popKey, setPopKey] = useState<string | null>(null); // 방금 탭한 칩 팝 연출
  const [sentPop, setSentPop] = useState(0); // 방금 보낸 말풍선 팝 연출 키

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
    // 하루 1번 — 한 번 고르면 그날은 변경 불가(사용자 요청: 진심 한 번의 무게)
    if (busy || mine) return;
    setBusy(true);
    setPopKey(e);
    try {
      // 하루 1번 잠금이라 pick 은 항상 '오늘 첫 선택' — 이전 한마디 없음
      await setMyMood(coupleId, e, "");
      applyMineLocal(e, "");
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
    const noteVal = note.trim().slice(0, 40);
    if (!mine || !noteVal) return;
    setBusy(true);
    try {
      await setMyMood(coupleId, mine.emoji, noteVal);
      applyMineLocal(mine.emoji, noteVal);
      setNote(""); // 채팅처럼 — 보내면 입력은 비워지고 한마디는 말풍선으로
      setSentPop((k) => k + 1);
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
          {!mine ? (
            <span className="text-xs font-semibold text-muted">· 탭 한 번, 하루 한 번</span>
          ) : (
            <span className="text-xs font-semibold text-muted">· 오늘 마음 전했어요 🌙</span>
          )}
        </p>
        {jinx && (
          <span className="animate-pop rounded-full bg-rose/15 px-2 py-0.5 text-xs font-black text-rose-deep">
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
              disabled={busy || !!mine}
              onClick={() => pick(c.e)}
              className={`tap relative flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold ring-1 transition-shadow ${
                isMine
                  ? "bg-rose/15 text-rose-deep ring-rose/40 shadow-[0_0_0_2px_rgba(255,95,151,0.25)]"
                  : `bg-glass text-ink ring-line ${mine ? "opacity-45" : ""}`
              } ${popKey === c.e && isMine ? "animate-pop" : ""}`}
            >
              <span className="text-base leading-none">{c.e}</span>
              {c.label}
              {isPartner && (
                <span
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-partner-bg text-xs font-black text-partner ring-1 ring-partner/40"
                  title={`${partnerName}의 오늘`}
                >
                  {(partnerName || "상대").slice(0, 1)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 한마디 말풍선 — 각주가 아니라 채팅처럼(상대 왼쪽 · 나 오른쪽). 탭하면 다시 편집 */}
      {(mine?.note || partner?.note) && (
        <div className="mt-2.5 space-y-1.5">
          {partner?.note && (
            <div className="flex justify-start">
              <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-glass px-3 py-2 ring-1 ring-line">
                <p className="text-xs font-bold text-partner">{partnerName || "상대"}</p>
                <p className="text-xs leading-snug text-ink">
                  <span className="mr-1">{partner.emoji}</span>
                  {partner.note}
                </p>
              </div>
            </div>
          )}
          {mine?.note && (
            <div className="flex justify-end">
              <div
                key={sentPop}
                className="animate-pop max-w-[82%] rounded-2xl rounded-br-md bg-rose/15 px-3 py-2 text-left ring-1 ring-rose/30"
              >
                <p className="text-xs leading-snug text-ink">
                  <span className="mr-1">{mine.emoji}</span>
                  {mine.note}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 한마디 컴포즈 — 하루 1번(보내면 그날은 고정, 입력창도 닫힘). 채팅처럼 보내면 비워진다 */}
      {mine && !mine.note && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
            }}
            maxLength={40}
            placeholder="오늘 하루, 한마디로? (하루 한 번)"
            className="min-w-0 flex-1 rounded-full border border-line bg-glass px-3.5 py-2 text-xs text-ink outline-none focus:border-rose"
          />
          <button
            onClick={saveNote}
            disabled={busy || !note.trim()}
            aria-label="한마디 보내기"
            className="tap grid h-8 w-8 shrink-0 place-items-center self-center rounded-full bg-brand text-white disabled:opacity-40"
          >
            <span className="text-sm leading-none">➤</span>
          </button>
        </div>
      )}
    </section>
  );
}
