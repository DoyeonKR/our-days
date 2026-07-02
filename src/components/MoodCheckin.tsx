"use client";

import { useEffect, useState } from "react";
import {
  type Mood,
  currentUserId,
  getMoods,
  setMyMood,
  subscribeMoods,
} from "@/lib/couple";
import Icon from "@/components/Icon";
import { sendEventPush } from "@/lib/notify";

const MOODS = ["😊", "🥰", "😍", "😌", "😐", "😢", "😡", "😴", "🥳", "🤒", "🥺", "🤗"];
// 스크린리더용 기분 이름 (이모지만으론 코드포인트로 읽혀 의미 전달 안 됨)
const MOOD_LABEL: Record<string, string> = {
  "😊": "기뻐요", "🥰": "사랑스러워요", "😍": "설레요", "😌": "편안해요",
  "😐": "그저 그래요", "😢": "슬퍼요", "😡": "화나요", "😴": "졸려요",
  "🥳": "신나요", "🤒": "아파요", "🥺": "속상해요", "🤗": "포근해요",
};

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
  // '오늘'의 기준 — 자정 넘어가면 갱신되어 어제 기분이 자동 초기화(빈 상태)됨
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());

  // 켜둔 채 자정을 넘기면 타이머로 dayKey 갱신 → 어제 기분 자동 비움.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      5,
    );
    const id = setTimeout(
      () => setDayKey(new Date().toDateString()),
      Math.max(1000, nextMidnight.getTime() - now.getTime()),
    );
    return () => clearTimeout(id);
  }, [dayKey]);

  // 모바일 PWA 를 백그라운드로 둔 채 자정을 넘기면 위 setTimeout 이 얼어(throttling)
  // 다시 열었을 때 어제 기분이 남아 보임 → 앱이 다시 보이거나 포커스 받을 때 날짜 재확인.
  // 같은 날이면 setState 가 bail-out 되어 불필요한 리렌더 없음.
  useEffect(() => {
    const sync = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      setDayKey((prev) => {
        const t = new Date().toDateString();
        return prev === t ? prev : t;
      });
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

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

  // 오늘 기록한 기분만 유효 — 어제 것은 00시에 자동으로 비워짐
  const isToday = (iso: string) => new Date(iso).toDateString() === dayKey;
  const mine = moods.find((m) => m.user_id === uid && isToday(m.updated_at));
  const partner = moods.find((m) => m.user_id !== uid && isToday(m.updated_at));

  async function save() {
    if (!pick) return;
    setBusy(true);
    try {
      await setMyMood(coupleId, pick, note);
      sendEventPush(coupleId, "moodq", `오늘의 기분 ${pick}`, note.trim() || "상대의 기분을 확인해 보세요");
      // realtime 채널이 죽어 있어도 방금 저장한 기분이 바로 보이도록 능동 재조회
      getMoods(coupleId)
        .then(setMoods)
        .catch(() => {});
      setOpen(false);
      setNote("");
    } catch (e) {
      // 실패를 조용히 삼키면 '저장했는데 안 보임' — 사용자에게 알림
      alert(
        "기분 저장에 실패했어요. 잠시 후 다시 시도해 주세요." +
          (e instanceof Error && e.message ? `\n(${e.message})` : ""),
      );
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
          {mine?.emoji ? (
            <span className="text-3xl">{mine.emoji}</span>
          ) : (
            <span className="mx-auto grid h-8 w-8 place-items-center text-muted">
              <Icon name="smile" size={26} />
            </span>
          )}
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
                aria-label={MOOD_LABEL[e] ?? "기분"}
                aria-pressed={pick === e}
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
