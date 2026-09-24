"use client";

/* 기록 › 추억 — 그날의 우리(지난해들의 오늘) + 월간 리캡 + 이 달의 기분. [2026-09-24 IA 개편]
 *
 * 예전엔 함께 탭 맨 아래에 있었고, 같은 '작년 오늘'이 일기장 안에도 한 벌 더 있었다(일기만).
 * 이달의 기분 요약도 일기장 안에 따로 있었다. 지난 기록을 보는 곳은 기록 탭이라 여기로 모았다.
 * 홈에는 '작년 오늘'이 있는 날에만 한 장(MemoryTeaser)이 떠서 이 칸으로 보낸다.
 */

import { useEffect, useMemo, useState } from "react";
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
import Icon, { type IconName } from "@/components/Icon";
import { MoodGlyph } from "@/components/PixelGlyph";

export default function MemoriesRecap({
  coupleId,
  members,
  myUserId,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
}) {
  const today = useDayTick();
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [monthDelta, setMonthDelta] = useState(0);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  // 일기장 안의 '작년 오늘'은 글 전체를 보여 줬다 — 여기로 합치면서 두 줄로 줄였으니, 눌러서 펼친다
  const [openKey, setOpenKey] = useState<string | null>(null);

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
      {/* 보이는 제목은 없다 — 바로 위 세그먼트가 이미 '추억'이라고 말한다(다른 기록 뷰와 같은 방식) */}
      <h1 className="sr-only">추억</h1>
      <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-rose-deep">오늘 다시 만난 순간</p>
            <h2 className="mt-0.5 text-base font-extrabold text-ink">그날의 우리</h2>
          </div>
          <span className="text-rose-deep" aria-hidden>
            <Icon name="clock" size={24} />
          </span>
        </div>
        {failed ? (
          <p className="mt-3 text-xs text-rose-deep">추억을 불러오지 못했어요. 연결을 확인해 주세요.</p>
        ) : memories.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ touchAction: "pan-x" }}>
            {memories.map((item) => (
              <article
                key={item.key}
                className={`shrink-0 overflow-hidden rounded-xl bg-glass2 ring-1 ring-line ${openKey === item.key ? "w-64" : "w-44"}`}
              >
                {item.mediaPath && media[item.mediaPath] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media[item.mediaPath]} alt={`${item.yearsAgo}년 전 추억`} className="h-24 w-full object-cover" loading="lazy" />
                )}
                <div className="p-3">
                  <p className="text-xs font-bold text-rose-deep">{item.yearsAgo}년 전 오늘 · {actorName(item.actorUser)}</p>
                  <p className="mt-1 truncate text-sm font-bold text-ink">{item.emoji} {item.title}</p>
                  {item.body && (
                    <button
                      onClick={() => setOpenKey((k) => (k === item.key ? null : item.key))}
                      aria-expanded={openKey === item.key}
                      className={`tap mt-1 block w-full text-left text-xs leading-relaxed text-muted ${openKey === item.key ? "" : "line-clamp-2"}`}
                    >
                      {item.body}
                    </button>
                  )}
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
              {(
                [
                  ["book", recap.diaries, "일기"],
                  ["camera", recap.photos, "사진"],
                  ["play", recap.logs, "로그"],
                  ["chat", recap.answers, "답변"],
                ] as const satisfies readonly (readonly [IconName, number, string])[]
              ).map(([icon, count, label]) => (
                <div key={label} className="rounded-xl bg-glass2 px-1 py-2 ring-1 ring-line">
                  <span className="flex justify-center text-rose-deep" aria-hidden>
                    <Icon name={icon} size={12} />
                  </span>
                  <p className="mt-0.5 text-base font-extrabold tabular-nums text-ink">{count}</p>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">
              {recap.total
                ? `${recap.activeDays}일 동안 ${recap.total}개의 순간을 남겼어요`
                : "아직 이 달의 기록이 없어요. 첫 순간을 남겨볼까요?"}
            </p>
            {/* 이 달의 기분 — 일기에 고른 기분의 분포. 예전엔 일기장 안에 '이번 달 우리 기분'으로 따로 있었다 */}
            {recap.moods.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-bold text-ink">{Number(month)}월의 기분 · 일기 {recap.diaries}편</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recap.moods.slice(0, 8).map((m) => (
                    <span key={m.emoji} className="flex items-center gap-1 rounded-full bg-glass px-2.5 py-1 text-sm ring-1 ring-line">
                      <MoodGlyph e={m.emoji} size={16} />
                      <span className="text-xs font-bold tabular-nums text-muted">{m.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-center text-xs text-muted">기록은 직접 지우기 전까지 남아요 · 3초 로그 영상만 90일 뒤 정리돼요.</p>
      </div>
    </section>
  );
}
