"use client";
/** 수집 탭의 '유리병 띄우기'(2026-11-12) — 10글자 편지를 병에 넣어 띄우고, 상대가 낚아 연 편지 · 내가 받은 편지를 본다. 엔진은 lib/fishbottle.
 *  · 커플 섬에서만 보인다(혼자 하는 섬엔 받을 사람이 없다). 개발 화면에선 window.__fishSeedBottle(글) 로 상대 병을 넣어 혼자서도 볼 수 있다 —
 *    그 병을 연 기록이 있으면 '받은 편지'만 혼자 섬에서도 보인다.
 *  · 입력칸에 maxLength 를 두지 않는다 — 한글 조합 중에 글자가 잘려 마지막 글자가 깨진다. 칸은 그대로 받고 'n/10' 만 보여 주며,
 *    자르기 · 다듬기는 보낼 때 엔진(checkBottleText)이 한다. */
import { useEffect, useState, type KeyboardEvent } from "react";
import { ActionButton } from "@/components/AppButtons";
import type { FishTabProps } from "@/components/FishCollect";
import { BOTTLE_LEN, BOTTLE_PER_SENDER, DEV_PARTNER, bottleLength, bottleLogOf, bottlesOf, checkBottleText, clipBottleText, devSeedBottle, sendBottle } from "@/lib/fishbottle";
import type { FishResult, GearResult } from "@/lib/fishing";
import { gameNow } from "@/lib/islandsync";
import { kstDate } from "@/lib/kst";

const IS_DEV = process.env.NODE_ENV !== "production";
const dayLabel = (t: number) => {
  const [, m, d] = kstDate(t).split("-");
  return `${Number(m)}월 ${Number(d)}일`;
};

/** 병 그림 — UI 크롬엔 이모지를 쓰지 않는다(프로젝트 규칙) */
function BottleMark() {
  return (
    <svg viewBox="0 0 24 24" className="fish-bottle-mark" aria-hidden>
      <rect x="9.5" y="2" width="5" height="3.4" rx="1" fill="#b98b52" />
      <path d="M9 5.4h6v2.4c2.6 1.5 3.6 3.6 3.6 6.6v4.4a3 3 0 0 1-3 3H8.4a3 3 0 0 1-3-3v-4.4c0-3 1-5.1 3.6-6.6z" fill="#9fd6e6" fillOpacity=".55" stroke="#e6fbff" strokeWidth="1.2" />
      <rect x="8.6" y="12.4" width="6.8" height="6" rx=".8" fill="#f6ecd2" transform="rotate(-8 12 15.4)" />
    </svg>
  );
}

export default function FishBottles(p: FishTabProps) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const { act } = p;

  // 개발용 — 혼자 하는 미리보기에서 상대의 병을 넣는다(수집 탭이 열려 있는 동안만 있다). 훅은 혼자 섬에서 숨기기 전에 둔다
  useEffect(() => {
    if (!IS_DEV) return;
    const w = window as unknown as { __fishSeedBottle?: (text?: string) => Promise<unknown> };
    w.__fishSeedBottle = (text = "보고 싶어") => act((s) => devSeedBottle(s, text, gameNow()));
    return () => { delete w.__fishSeedBottle; };
  }, [act]);

  const pending = bottlesOf(p.st);
  const log = bottleLogOf(p.st);
  const received = log.filter((b) => b.by === p.who);
  const devView = IS_DEV && !p.couple && received.some((b) => b.from === DEV_PARTNER);
  if (!p.couple && !devView) return null;

  const mineFloating = pending.filter((b) => b.from === p.who);
  const openedByPartner = log.filter((b) => b.from === p.who && b.by !== p.who).length;
  const count = bottleLength(draft);
  const full = mineFloating.length >= BOTTLE_PER_SENDER;

  const send = () => {
    if (p.busy || full) return;
    const c = checkBottleText(draft);
    if (!c.ok) { setNote({ text: c.reason, bad: true }); return; }
    // 시각은 누른 순간의 서버 보정 시각(렌더 때의 p.now 는 낡았을 수 있다)
    const t = gameNow();
    void act((s) => sendBottle(s, p.who, c.text, t)).then((r) => {
      const res = r as FishResult | GearResult | null;
      if (res?.ok) { setDraft(""); setNote({ text: "병을 띄웠어요. 상대가 낚시하다 건질 거예요" }); }
      else if (res && !res.ok) setNote({ text: res.reason, bad: true });
    });
  };
  // 한글 조합 중의 Enter 는 글자를 확정하는 키다 — 보내지 않는다
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send();
  };

  return (
    <section className="aqua-card fish-bottles" aria-label="유리병 편지">
      <header><strong>유리병 띄우기</strong><small>{BOTTLE_LEN}글자 편지를 병에 담아요</small></header>
      {p.couple && (
        <>
          <div className="fish-bottle-write">
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setNote(null); }}
              onKeyDown={onKey}
              placeholder="짧은 편지를 써 보세요"
              aria-label="병에 넣을 편지"
              aria-describedby="fish-bottle-count"
              enterKeyHint="send"
              autoComplete="off"
              disabled={full}
            />
            <span id="fish-bottle-count" className={`fish-bottle-count ${count > BOTTLE_LEN ? "is-over" : ""}`} aria-live="polite">{count}/{BOTTLE_LEN}</span>
          </div>
          <ActionButton main wide disabled={p.busy || full || count === 0} onClick={send}>병 띄우기</ActionButton>
          {note && <p className={`aqua-note fish-bottle-note ${note.bad ? "is-bad" : ""}`} role={note.bad ? "alert" : "status"}>{note.text}</p>}
          <p className="aqua-note">
            떠다니는 병 {mineFloating.length}개{full ? ` · 한 번에 ${BOTTLE_PER_SENDER}개까지예요` : ""}{openedByPartner ? ` · 상대가 연 편지 ${openedByPartner}통` : ""}
          </p>
          {mineFloating.length > 0 && (
            <ul className="fish-bottle-floating" aria-label="내가 띄운 병">
              {mineFloating.map((b) => <li key={b.id}><BottleMark /><span>{clipBottleText(b.text)}</span></li>)}
            </ul>
          )}
        </>
      )}
      <h3 className="fish-sheet-title">받은 편지 <small>{received.length}통</small></h3>
      {received.length ? (
        <ul className="fish-letters">
          {received.map((b) => (
            <li key={b.id} className="fish-letter">
              <p>{clipBottleText(b.text)}</p>
              <small>{dayLabel(b.openedAt)}에 건짐{b.from === DEV_PARTNER ? " · 연습용" : ""}</small>
            </li>
          ))}
        </ul>
      ) : <p className="aqua-note">아직 건진 병이 없어요. 낚시하다 보면 상대의 병이 걸려요</p>}
    </section>
  );
}
