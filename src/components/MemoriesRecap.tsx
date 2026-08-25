"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import {
  type Member,
  listMemorySnapshot,
  signedPhotoUrl,
  subscribeAnswers,
  subscribeCoupleLogs,
  subscribeDeco,
  subscribePhotos,
} from "@/lib/couple";
import {
  monthlyRecap,
  onThisDayMemories,
  shiftedMonthKey,
  type MemorySnapshot,
} from "@/lib/memories";
import { useDayTick } from "@/lib/useDayTick";

export default function MemoriesRecap({
  coupleId,
  members,
  myUserId,
  onOpenRecords,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
  onOpenRecords: () => void;
}) {
  const today = useDayTick();
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [monthDelta, setMonthDelta] = useState(0);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setSnapshot(null);
    setMedia({});
    const refresh = () => {
      const currentRevision = ++revision;
      return listMemorySnapshot(coupleId)
        .then((value) => {
          if (!cancelled && currentRevision === revision) {
            setSnapshot(value);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled && currentRevision === revision) setFailed(true);
        });
    };
    void refresh();
    const unsubscribes = [
      subscribeDeco(coupleId, () => void refresh(), "memories"),
      subscribePhotos(coupleId, () => void refresh()),
      subscribeCoupleLogs(coupleId, () => void refresh(), "memories"),
      subscribeAnswers(coupleId, () => void refresh()),
    ];
    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [coupleId]);

  const memories = useMemo(
    () => (snapshot ? onThisDayMemories(snapshot, today).slice(0, 8) : []),
    [snapshot, today],
  );
  const monthKey = shiftedMonthKey(today, monthDelta);
  const recap = useMemo(
    () => (snapshot ? monthlyRecap(snapshot, monthKey) : null),
    [snapshot, monthKey],
  );

  useEffect(() => {
    let cancelled = false;
    const paths = [...new Set(memories.map((item) => item.mediaPath).filter((path): path is string => !!path))];
    Promise.all(paths.map(async (path) => [path, await signedPhotoUrl(path)] as const)).then((entries) => {
      if (!cancelled)
        setMedia(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => !!entry[1])));
    });
    return () => {
      cancelled = true;
    };
  }, [memories]);

  const actorName = (id: string) =>
    id === myUserId
      ? "나"
      : members.find((member) => member.user_id === id)?.nickname?.trim() || "상대";
  const [year, month] = monthKey.split("-");

  return (
    <section className="space-y-3">
      <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-rose-deep">오늘 다시 만난 순간</p>
            <h2 className="mt-0.5 text-base font-extrabold text-ink">그날의 우리</h2>
          </div>
          <span className="text-2xl" aria-hidden>🕰️</span>
        </div>
        {failed ? (
          <p className="mt-3 text-xs text-rose-deep">추억을 불러오지 못했어요. 연결을 확인해 주세요.</p>
        ) : memories.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ touchAction: "pan-x" }}>
            {memories.map((item) => (
              <article key={item.key} className="w-44 shrink-0 overflow-hidden rounded-xl bg-glass2 ring-1 ring-line">
                {item.mediaPath && media[item.mediaPath] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media[item.mediaPath]} alt={`${item.yearsAgo}년 전 추억`} className="h-24 w-full object-cover" loading="lazy" />
                )}
                <div className="p-3">
                  <p className="text-xs font-bold text-rose-deep">{item.yearsAgo}년 전 오늘 · {actorName(item.actorUser)}</p>
                  <p className="mt-1 truncate text-sm font-bold text-ink">{item.emoji} {item.title}</p>
                  {item.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.body}</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-glass2 px-3 py-4 text-center text-xs leading-relaxed text-muted">
            오늘과 같은 날짜의 지난 기록은 아직 없어요. 올해의 오늘이 다음 추억이 될 거예요.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-rose-deep">월간 리캡</p>
            <h2 className="text-base font-extrabold text-ink">{year}년 {Number(month)}월의 우리</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setMonthDelta(-1)} aria-pressed={monthDelta === -1} className={`tap rounded-full px-2.5 py-1 text-xs font-bold ${monthDelta === -1 ? "bg-brand text-white" : "bg-glass text-muted ring-1 ring-line"}`}>지난달</button>
            <button onClick={() => setMonthDelta(0)} aria-pressed={monthDelta === 0} className={`tap rounded-full px-2.5 py-1 text-xs font-bold ${monthDelta === 0 ? "bg-brand text-white" : "bg-glass text-muted ring-1 ring-line"}`}>이번달</button>
          </div>
        </div>
        {recap && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
              {[
                ["📔", recap.diaries, "일기"],
                ["📷", recap.photos, "사진"],
                ["🎥", recap.logs, "로그"],
                ["💬", recap.answers, "답변"],
              ].map(([emoji, count, label]) => (
                <div key={String(label)} className="rounded-xl bg-glass2 px-1 py-2 ring-1 ring-line">
                  <span className="text-base" aria-hidden>{emoji}</span>
                  <p className="mt-0.5 text-base font-extrabold tabular-nums text-ink">{count}</p>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">
              {recap.total
                ? `${recap.activeDays}일 동안 ${recap.total}개의 순간을 남겼어요${recap.topMood ? ` · 대표 기분 ${recap.topMood}` : ""}`
                : "아직 이 달의 기록이 없어요. 첫 순간을 남겨볼까요?"}
            </p>
          </>
        )}
        <button onClick={onOpenRecords} className="tap mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-glass py-2.5 text-xs font-bold text-rose-deep ring-1 ring-line">
          전체 기록 보러 가기 <Icon name="chevronRight" size={14} />
        </button>
        <p className="mt-2 text-center text-xs text-muted">기록은 직접 삭제하기 전까지 보관돼요.</p>
      </div>
    </section>
  );
}
