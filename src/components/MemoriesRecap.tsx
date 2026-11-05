"use client";

/* 기록 › 추억 — 그날의 우리(지난해들의 오늘) + 월간 리캡 + 이 달의 기분. [2026-09-24 IA 개편]
 *
 * 예전엔 함께 탭 맨 아래에 있었고, 같은 '작년 오늘'이 일기장 안에도 한 벌 더 있었다(일기만).
 * 이달의 기분 요약도 일기장 안에 따로 있었다. 지난 기록을 보는 곳은 기록 탭이라 여기로 모았다.
 * 홈에는 '작년 오늘'이 있는 날에만 한 장(MemoryTeaser)이 떠서 이 칸으로 보낸다.
 *
 * [2026-11-06 사진첩 리뷰]
 *  · 네 표를 통째로 받던 스냅샷을 버렸다(PostgREST 행 상한 1000 에서 아무 행이나 잘려 숫자가 틀렸다).
 *    그날의 우리 = 같은 날짜만 고르는 가벼운 조회(listOnThisDaySnapshot), 월간 리캡 = 서버 집계(getMonthRecap) 한 달씩.
 *  · 네 표 중 어디서 이벤트가 와도 둘 다 다시 받던 것 → 0.8초 모아서 한 번.
 *  · 같은 날 사진 20장이 카드 8칸을 다 채우던 것 → 날짜로 묶고 '+N'. 서명은 한 번에. 사진 카드를 누르면 사진 보기.
 *  · 아무 달이나 고르고, 그 달을 카드 한 장(사진 4장 + 숫자)으로 공유/저장.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Member,
  type Photo,
  getMonthRecap,
  listOnThisDaySnapshot,
  signedPhotoUrls,
  subscribeAnswers,
  subscribeCoupleLogs,
  subscribeDeco,
  subscribePhotos,
} from "@/lib/couple";
import {
  groupMemoriesByDate,
  onThisDayMemories,
  photoShotAt,
  shiftedMonthKey,
  type MemoryGroup,
  type MemorySnapshot,
  type MonthlyRecap,
} from "@/lib/memories";
import { kstDate } from "@/lib/kst";
import { shareMonthCard } from "@/lib/recapshare";
import { useDayTick } from "@/lib/useDayTick";
import Icon, { type IconName } from "@/components/Icon";
import { MoodGlyph } from "@/components/PixelGlyph";
import PhotoViewer from "@/components/PhotoViewer";

export default function MemoriesRecap({
  coupleId,
  members,
  myUserId,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
}) {
  const tick = useDayTick();
  // 추억의 '오늘'은 KST — 두 사람이 같은 날을 본다(기기 시간대와 무관). tick 은 자정을 넘겼다는 신호로만 쓴다.
  const [today, setToday] = useState(() => kstDate(Date.now()));
  useEffect(() => {
    setToday(kstDate(Date.now()));
  }, [tick]);
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [monthDelta, setMonthDelta] = useState(0);
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [bump, setBump] = useState(0); // 실시간 이벤트(0.8초 모음)
  // 일기장 안의 '작년 오늘'은 글 전체를 보여 줬다 — 여기로 합치면서 두 줄로 줄였으니, 눌러서 펼친다
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ photos: Photo[]; id: string } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardNote, setCardNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const poke = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBump((n) => n + 1), 800);
    };
    const unsubscribes = [
      subscribeDeco(coupleId, poke, "memories"),
      subscribePhotos(coupleId, poke),
      subscribeCoupleLogs(coupleId, poke, "memories"),
      subscribeAnswers(coupleId, poke),
    ];
    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [coupleId]);

  // 그날의 우리 — 같은 날짜만
  useEffect(() => {
    let cancelled = false;
    listOnThisDaySnapshot(coupleId, today)
      .then((value) => {
        if (!cancelled) {
          setSnapshot(value);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [coupleId, today, bump]);

  const monthKey = shiftedMonthKey(today, monthDelta);
  // 월간 리캡 — 서버가 한 달을 센다
  useEffect(() => {
    let cancelled = false;
    getMonthRecap(coupleId, monthKey)
      .then((r) => !cancelled && setRecap(r))
      .catch(() => !cancelled && setRecap(null));
    return () => {
      cancelled = true;
    };
  }, [coupleId, monthKey, bump]);

  const memories = useMemo(() => (snapshot ? onThisDayMemories(snapshot, today) : []), [snapshot, today]);
  const groups = useMemo(() => groupMemoriesByDate(memories).slice(0, 8), [memories]);

  // 카드에 쓸 그림 — 한 번에 서명(예전엔 경로마다 따로 불렀다)
  useEffect(() => {
    let cancelled = false;
    const paths = [...new Set(groups.map((g) => g.cover.mediaPath).filter((path): path is string => !!path))];
    if (paths.length === 0) return;
    signedPhotoUrls(paths)
      .then((urls) => !cancelled && setMedia((cur) => ({ ...cur, ...urls })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [groups]);

  const actorName = (id: string) =>
    id === myUserId
      ? "나"
      : members.find((member) => member.user_id === id)?.nickname?.trim() || "상대";
  const [year, month] = monthKey.split("-");

  /** 그날의 사진들 → 사진 보기(읽기 전용 — 대표 · 휴지통은 사진첩에서). */
  async function openPhotos(g: MemoryGroup) {
    if (!snapshot) return;
    const ids = new Set(g.items.filter((i) => i.kind === "photo").map((i) => i.photoId));
    const rows = snapshot.photos.filter((r) => ids.has(r.id));
    if (rows.length === 0) return;
    const urls = await signedPhotoUrls(rows.map((r) => r.thumb_path || r.storage_path)).catch(() => ({} as Record<string, string>));
    const photos: Photo[] = rows.map((r) => ({
      id: r.id,
      path: r.storage_path,
      thumbPath: r.thumb_path,
      url: r.thumb_path ? "" : urls[r.storage_path] ?? "",
      thumbUrl: urls[r.thumb_path || r.storage_path] ?? "",
      created_by: r.created_by,
      created_at: r.created_at,
      takenAt: r.taken_at ?? null,
      shotAt: photoShotAt(r),
      caption: r.caption ?? null,
      deletedAt: null,
      deletedBy: null,
    }));
    setViewer({ photos, id: photos[0].id });
  }

  async function makeCard() {
    if (!recap) return;
    setCardBusy(true);
    setCardNote(null);
    try {
      const how = await shareMonthCard(coupleId, recap);
      setCardNote(how === "saved" ? "카드를 저장했어요" : null);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setCardNote("카드를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setCardBusy(false);
    }
  }

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
        ) : groups.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ touchAction: "pan-x" }}>
            {groups.map((g) => {
              const item = g.cover;
              const more = g.items.length - 1;
              const photoCount = g.items.filter((i) => i.kind === "photo").length;
              return (
                <article
                  key={g.date}
                  className={`shrink-0 overflow-hidden rounded-xl bg-glass2 ring-1 ring-line ${openKey === g.date ? "w-64" : "w-44"}`}
                >
                  {item.mediaPath && media[item.mediaPath] && (
                    <button
                      type="button"
                      onClick={() => void openPhotos(g)}
                      disabled={photoCount === 0}
                      aria-label={photoCount ? `${g.yearsAgo}년 전 오늘 사진 ${photoCount}장 크게 보기` : undefined}
                      className="tap relative block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={media[item.mediaPath]} alt={photoCount ? "" : `${g.yearsAgo}년 전 추억`} className="h-24 w-full object-cover" loading="lazy" />
                      {photoCount > 1 && (
                        <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 text-xs font-bold text-white">사진 {photoCount}</span>
                      )}
                    </button>
                  )}
                  <div className="p-3">
                    <p className="text-xs font-bold text-rose-deep">
                      {g.yearsAgo}년 전 오늘 · {actorName(item.actorUser)}
                      {more > 0 ? ` · +${more}` : ""}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-ink">{item.emoji} {item.title}</p>
                    {item.body && (
                      <button
                        onClick={() => setOpenKey((k) => (k === g.date ? null : g.date))}
                        aria-expanded={openKey === g.date}
                        className={`tap mt-1 block w-full text-left text-xs leading-relaxed text-muted ${openKey === g.date ? "" : "line-clamp-2"}`}
                      >
                        {item.body}
                      </button>
                    )}
                    {openKey === g.date && more > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                        {g.items.filter((i) => i !== item).map((i) => (
                          <li key={i.key} className="truncate">{i.emoji} {i.title}</li>
                        ))}
                      </ul>
                    )}
                    {more > 0 && openKey !== g.date && (
                      <button onClick={() => setOpenKey(g.date)} className="tap mt-1 text-xs font-bold text-rose-deep">
                        그날 기록 {g.items.length}개 보기
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
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
          <div className="flex items-center gap-1">
            <button onClick={() => setMonthDelta((d) => Math.max(-240, d - 1))} aria-label="이전 달" className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-muted ring-1 ring-line">
              <Icon name="chevronLeft" size={16} />
            </button>
            <button onClick={() => setMonthDelta(0)} aria-pressed={monthDelta === 0} className={`tap rounded-full px-2.5 py-1 text-xs font-bold ${monthDelta === 0 ? "bg-brand text-white" : "bg-glass text-muted ring-1 ring-line"}`}>이번달</button>
            <button onClick={() => setMonthDelta((d) => Math.min(0, d + 1))} disabled={monthDelta >= 0} aria-label="다음 달" className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-muted ring-1 ring-line disabled:opacity-40">
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>
        {recap && recap.monthKey === monthKey && (
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
            {recap.total > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <button onClick={() => void makeCard()} disabled={cardBusy} className="tap rounded-full bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {cardBusy ? "카드 만드는 중…" : "이 달 카드로 공유"}
                </button>
                {cardNote && <span role="status" className="text-xs text-muted">{cardNote}</span>}
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-center text-xs text-muted">기록은 직접 지우기 전까지 남아요 · 3초 로그 영상만 90일 뒤 정리돼요.</p>
      </div>

      {viewer && (
        <PhotoViewer
          photos={viewer.photos}
          currentId={viewer.id}
          onChange={(id) => setViewer((v) => (v ? { ...v, id } : v))}
          onClose={() => setViewer(null)}
          coupleId={coupleId}
          myUserId={myUserId}
          nameOf={actorName}
          onPhotoUpdated={(p) => setViewer((v) => (v ? { ...v, photos: v.photos.map((x) => (x.id === p.id ? p : x)) } : v))}
        />
      )}
    </section>
  );
}
