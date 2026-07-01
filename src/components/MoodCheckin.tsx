"use client";

import { useEffect, useState } from "react";
import {
  type Mood,
  currentUserId,
  getMoods,
  setMyMood,
  subscribeMoods,
} from "@/lib/couple";

const MOODS = ["😊", "🥰", "😍", "😌", "😐", "😢", "😡", "😴", "🥳", "🤒", "🥺", "🤗"];

export default function MoodCheckin({
  coupleId,
  partnerName,
}: {
  coupleId: string;
  partnerName: string;
}) {
  const [uid, setUid] = useState<string | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const id = await currentUserId();
      if (cancelled) return;
      setUid(id);
      const refresh = () =>
        getMoods(coupleId)
          .then((m) => {
            if (!cancelled) setMoods(m);
          })
          .catch(() => {});
      refresh();
      unsub = subscribeMoods(coupleId, refresh);
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const mine = moods.find((m) => m.user_id === uid);
  const partner = moods.find((m) => m.user_id !== uid);

  async function save() {
    if (!pick) return;
    setBusy(true);
    try {
      await setMyMood(coupleId, pick, note);
      setOpen(false);
      setNote("");
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-card)] bg-card glass p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
      <p className="mb-3 text-sm font-bold text-ink">오늘의 기분</p>
      <div className="flex gap-3">
        <button
          onClick={() => {
            setOpen(true);
            setPick(mine?.emoji ?? "");
            setNote(mine?.note ?? "");
          }}
          className="flex-1 rounded-2xl bg-glass p-3 text-center ring-1 ring-line shadow-[var(--shadow-sm)] tap"
        >
          <span className="text-3xl">{mine?.emoji ?? "➕"}</span>
          <p className="mt-1 text-xs text-muted">
            나 {mine ? "" : "· 눌러 설정"}
          </p>
          {mine?.note && <p className="mt-0.5 truncate text-xs text-ink">{mine.note}</p>}
        </button>
        <div className="flex-1 rounded-2xl bg-glass2 p-3 text-center ring-1 ring-line shadow-[var(--shadow-sm)]">
          <span className="text-3xl">{partner?.emoji ?? "🫥"}</span>
          <p className="mt-1 truncate text-xs text-muted">{partnerName || "상대"}</p>
          {partner?.note && (
            <p className="mt-0.5 truncate text-xs text-ink">{partner.note}</p>
          )}
        </div>
      </div>

      {open && (
        <div className="animate-pop mt-3 rounded-2xl bg-glass glass p-3 ring-1 ring-line shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((e) => (
              <button
                key={e}
                onClick={() => setPick(e)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-xl tap ${
                  pick === e ? "bg-rose/20 ring-1 ring-rose" : "bg-glass ring-1 ring-line"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={40}
            placeholder="한 줄 (선택)"
            className="mt-2 w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-xs text-muted tap"
            >
              취소
            </button>
            <button
              disabled={busy || !pick}
              onClick={save}
              className="flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white shadow-[var(--shadow-md)] tap disabled:opacity-50"
            >
              기분 저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
