"use client";

import { useEffect, useState } from "react";
import {
  type Letter,
  deleteLetter,
  listLetters,
  sendLetter,
} from "@/lib/couple";
import { toISODate, today } from "@/lib/dday";
import { confirmDialog, isConfirmOpen } from "@/lib/confirm";
import { sendEventPush } from "@/lib/notify";
import Icon from "@/components/Icon";

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function Letters({
  coupleId,
  myUserId,
  partnerName,
}: {
  coupleId: string;
  myUserId: string | null;
  partnerName: string;
}) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [composing, setComposing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () =>
    listLetters(coupleId)
      .then(setLetters)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    refresh();
    // 예약 편지가 시간이 되어 열리도록 5분마다 갱신 + 앱 복귀 시 즉시 갱신
    const id = setInterval(refresh, 5 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // 가장 이른 미개봉 시각(내가 쓴 봉인 편지 — 클라가 open_at 을 앎)에 맞춰 정시 갱신.
  useEffect(() => {
    const future = letters
      .map((l) => new Date(l.open_at).getTime())
      .filter((t) => t > Date.now());
    if (!future.length) return;
    const wait = Math.min(...future) - Date.now() + 2000;
    if (wait > 30 * 60 * 1000) return; // 너무 먼 건 폴링에 맡김
    const id = setTimeout(refresh, wait);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters]);

  const now = Date.now();
  const isLocked = (l: Letter) =>
    l.from_user === myUserId && new Date(l.open_at).getTime() > now;

  async function remove(l: Letter) {
    if (!(await confirmDialog({ message: "이 편지를 삭제할까요?", confirmText: "삭제", danger: true })))
      return;
    const prev = letters;
    setLetters((cur) => cur.filter((x) => x.id !== l.id));
    try {
      await deleteLetter(l.id);
    } catch (e) {
      setLetters(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="mt-6">
      <div className="rounded-[var(--radius-card)] bg-card glass p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Icon name="mail" size={16} className="text-rose-deep" />
            편지
          </p>
          <button
            onClick={() => setComposing(true)}
            className="tap flex items-center gap-1 rounded-full bg-rose/12 px-3 py-1.5 text-xs font-bold text-rose-deep"
          >
            <Icon name="plus" size={14} strokeWidth={2.4} />
            편지 쓰기
          </button>
        </div>

        {letters.length === 0 ? (
          <p className="rounded-2xl bg-glass2 px-4 py-5 text-center text-xs text-muted">
            미래의 우리에게, 혹은 서로에게 편지를 남겨보세요. 원하는 날짜에 열려요.
          </p>
        ) : (
          <ul className="space-y-2">
            {letters.map((l) => {
              const mine = l.from_user === myUserId;
              const locked = isLocked(l);
              return (
                <li
                  key={l.id}
                  className="rounded-2xl bg-glass px-4 py-3 ring-1 ring-line"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                      {locked ? (
                        <Icon name="lock" size={12} />
                      ) : (
                        <Icon name="mail" size={12} />
                      )}
                      {mine
                        ? `나 → ${(partnerName || "상대").trim()}`
                        : `${(partnerName || "상대").trim()} → 나`}
                      {" · "}
                      {locked ? `${fmt(l.open_at)}에 열려요` : fmt(l.open_at)}
                    </span>
                    {mine && (
                      <button
                        onClick={() => remove(l)}
                        aria-label="편지 삭제"
                        className="tap grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                  {locked ? (
                    <p className="mt-1 text-xs italic text-muted">
                      아직 봉인된 편지예요.
                    </p>
                  ) : (
                    <>
                      {l.title && (
                        <p className="mt-1 text-sm font-bold text-ink">{l.title}</p>
                      )}
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink/90">
                        {l.body}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}
      </div>

      {composing && (
        <Compose
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            refresh();
          }}
          coupleId={coupleId}
          partnerName={partnerName}
        />
      )}
    </section>
  );
}

function Compose({
  coupleId,
  partnerName,
  onClose,
  onSent,
}: {
  coupleId: string;
  partnerName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openDate, setOpenDate] = useState(toISODate(today()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 작성 중 내용이 있으면 실수 탭/Esc 한 번에 날아가지 않게 확인 경유
  async function requestClose() {
    if (body.trim() || title.trim()) {
      const ok = await confirmDialog({
        message: "작성 중인 편지를 버릴까요?",
        detail: "지금 닫으면 내용이 사라져요.",
        confirmText: "버리기",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isConfirmOpen()) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, title]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const openAt = new Date(openDate + "T00:00:00").toISOString();
      await sendLetter(coupleId, body.trim(), title.trim() || undefined, openAt);
      const sealed = new Date(openAt).getTime() > Date.now();
      sendEventPush(
        coupleId,
        "letter",
        sealed ? "💌 봉인 편지가 도착했어요" : "💌 편지가 도착했어요",
        sealed
          ? `${openDate.replaceAll("-", ".")}에 열려요`
          : title.trim() || body.trim().slice(0, 40),
      );
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="편지 쓰기"
        className="glass animate-sheet max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[var(--radius-card)] bg-surface p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />
        <h3 className="text-lg font-extrabold text-ink">편지 쓰기</h3>
        <p className="text-xs text-muted">
          {(partnerName || "상대").trim()}에게 · 지정한 날짜에 열려요(오늘이면 바로).
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-sm text-ink outline-none focus:border-rose"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="마음을 적어보세요…"
          rows={6}
          className="w-full resize-none rounded-xl border border-line bg-glass px-3 py-2.5 text-sm text-ink outline-none focus:border-rose"
        />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            열리는 날
          </span>
          <input
            type="date"
            value={openDate}
            min={toISODate(today())}
            onChange={(e) => setOpenDate(e.target.value)}
            className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-sm text-ink outline-none focus:border-rose"
          />
        </label>
        {err && <p className="text-xs text-rose-deep">{err}</p>}
        <button
          disabled={!body.trim() || busy}
          onClick={send}
          className="tap mt-1 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
        >
          {busy ? "보내는 중…" : "편지 보내기"}
        </button>
      </div>
    </div>
  );
}
