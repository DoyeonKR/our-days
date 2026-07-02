"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CoupleLog,
  deleteCoupleLog,
  listCoupleLogs,
  subscribeCoupleLogs,
  upsertCoupleLog,
} from "@/lib/couple";
import {
  type LogSlot,
  canWriteSlot,
  logDateIso,
  slotLabel,
  slotOf,
} from "@/lib/logslot";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";

const LOG_MOODS = ["😊", "🥰", "😴", "🔥", "☁️", "😮‍💨", "🥳", "😭"];
const MAX_LEN = 100;
const KEEP_DAYS = 14; // 브라우징 범위

function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return logDateIso(new Date(y, m - 1, d + delta));
}

/** 오늘의 로그 — 하루 2슬롯(오전/오후), 슬롯당 1개. 커플 둘의 하루를 나란히. */
export default function TodayLog({
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
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [dateIso, setDateIso] = useState(() => logDateIso(new Date()));
  const [editingSlot, setEditingSlot] = useState<LogSlot | null>(null);
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const todayIso = logDateIso(now);

  useEffect(() => {
    let cancelled = false;
    const since = shiftIso(logDateIso(new Date()), -(KEEP_DAYS - 1));
    const refresh = () =>
      listCoupleLogs(coupleId, since)
        .then((l) => {
          if (!cancelled) setLogs(l);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        });
    refresh();
    const unsub = subscribeCoupleLogs(coupleId, refresh);
    // 슬롯 경계(12시/자정) 넘어가면 잠금/오픈 상태 갱신 — 1분 시계
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(tick);
    };
  }, [coupleId]);

  const dayLogs = useMemo(
    () => logs.filter((l) => l.log_date === dateIso),
    [logs, dateIso],
  );
  const cell = (slot: LogSlot, mine: boolean) =>
    dayLogs.find(
      (l) => l.slot === slot && (l.created_by === myUserId) === mine,
    );

  async function save(slot: LogSlot) {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await upsertCoupleLog(coupleId, dateIso, slot, body.trim(), mood || null);
      setEditingSlot(null);
      setBody("");
      setMood("");
      setLogs(await listCoupleLogs(coupleId, shiftIso(todayIso, -(KEEP_DAYS - 1))));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: CoupleLog) {
    if (
      !(await confirmDialog({
        message: "이 로그를 삭제할까요?",
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    const prev = logs;
    setLogs((cur) => cur.filter((x) => x.id !== l.id));
    try {
      await deleteCoupleLog(l.id);
    } catch (e) {
      setLogs(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function openEditor(slot: LogSlot) {
    const mine = cell(slot, true);
    setBody(mine?.body ?? "");
    setMood(mine?.emoji ?? "");
    setEditingSlot(slot);
  }

  const isToday = dateIso === todayIso;
  const curSlot = slotOf(now);

  /** 내 칸 렌더 */
  function myCell(slot: LogSlot) {
    const log = cell(slot, true);
    const writable = canWriteSlot(dateIso, slot, now);
    if (editingSlot === slot && writable) {
      return (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
            placeholder="지금 뭐 해? 한 줄로 남겨요"
            rows={3}
            autoFocus
            className="w-full resize-none rounded-xl border border-line bg-glass px-3 py-2 text-sm text-ink outline-none focus:border-rose"
          />
          <div className="flex flex-wrap gap-1">
            {LOG_MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? "" : m)}
                className={`tap grid h-8 w-8 place-items-center rounded-lg text-base ${
                  mood === m ? "bg-rose/20 ring-1 ring-rose" : "bg-glass ring-1 ring-line"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted tabular-nums">
              {body.length}/{MAX_LEN}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setEditingSlot(null)}
                className="tap rounded-full px-3 py-1.5 text-xs text-muted"
              >
                취소
              </button>
              <button
                disabled={!body.trim() || busy}
                onClick={() => save(slot)}
                className="tap rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-[var(--shadow-sm)] disabled:opacity-40"
              >
                {busy ? "저장 중…" : log ? "수정" : "남기기"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (log) {
      return (
        <div>
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{log.body}</p>
          {writable && (
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => openEditor(slot)}
                className="tap text-[11px] font-semibold text-rose-deep"
              >
                수정
              </button>
              <button
                onClick={() => remove(log)}
                className="tap text-[11px] text-muted"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      );
    }
    if (writable) {
      return (
        <button
          onClick={() => openEditor(slot)}
          className="tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose/40 bg-glass2 py-4 text-xs font-bold text-rose-deep"
        >
          <Icon name="plus" size={14} strokeWidth={2.4} />
          {slotLabel(slot)} 로그 남기기
        </button>
      );
    }
    // 미래 슬롯(오늘 오전 중의 오후) = 잠김 / 지난 빈 슬롯 = 중립
    const future = isToday && slot === "pm" && curSlot === "am";
    return (
      <p className="flex items-center gap-1.5 py-3 text-xs text-muted">
        {future ? (
          <>
            <Icon name="lock" size={12} />
            12시에 열려요
          </>
        ) : (
          "조용히 지나갔어요 ☁️"
        )}
      </p>
    );
  }

  function partnerCell(slot: LogSlot) {
    const log = cell(slot, false);
    if (log) {
      return (
        <div>
          {log.emoji && <span className="text-xl">{log.emoji}</span>}
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{log.body}</p>
        </div>
      );
    }
    const future = isToday && slot === "pm" && curSlot === "am";
    return (
      <p className="py-3 text-xs text-muted">
        {future ? "아직이에요" : isToday && slot === curSlot ? "아직 안 남겼어요" : "조용히 지나갔어요 ☁️"}
      </p>
    );
  }

  const my = (myName || "나").trim();
  const partner = (partnerName || "상대").trim();

  return (
    <div>
      {/* 날짜 네비 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setDateIso((d) => shiftIso(d, -1))}
          disabled={dateIso <= shiftIso(todayIso, -(KEEP_DAYS - 1))}
          aria-label="이전 날"
          className="tap grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-extrabold text-ink tabular-nums">
            {dateIso.replaceAll("-", ".")}
          </p>
          <p className="text-[10px] font-semibold text-rose-deep">
            {isToday ? `오늘 · 지금은 ${slotLabel(curSlot)}` : "지난 로그"}
          </p>
        </div>
        <button
          onClick={() => setDateIso((d) => shiftIso(d, 1))}
          disabled={isToday}
          aria-label="다음 날"
          className="tap grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {/* 2×2: 오전/오후 × 나/상대 */}
      <div className="space-y-3">
        {(["am", "pm"] as const).map((slot) => (
          <div
            key={slot}
            className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-sm)] ring-1 ring-line"
          >
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  slot === "am" ? "bg-anniv-bg text-anniv" : "bg-diary-bg text-diary"
                }`}
              >
                {slot === "am" ? "☀" : "☾"}
              </span>
              {slotLabel(slot)}
              {isToday && slot === curSlot && (
                <span className="rounded-full bg-rose/12 px-1.5 py-0.5 text-[9px] font-bold text-rose-deep">
                  NOW
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold text-muted">{my}</p>
                {myCell(slot)}
              </div>
              <div className="min-w-0 border-l border-line pl-3">
                <p className="mb-1 text-[10px] font-semibold text-muted">{partner}</p>
                {partnerCell(slot)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        하루 두 번 — 오전·오후 각 1개씩만 남길 수 있어요
      </p>
      {err && <p className="mt-2 text-xs text-rose-deep">{err}</p>}
    </div>
  );
}
