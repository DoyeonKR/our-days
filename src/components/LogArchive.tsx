"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { type CoupleLog, listLogArchive, signLogMedia } from "@/lib/couple";
import { shiftDateIso } from "@/lib/logslot";
import { LOG_VIDEO_KEEP_DAYS } from "@/lib/logretention";
import {
  MONTAGE_SIZE,
  archiveMonths,
  expiryDaysLeft,
  expirySoon,
  exportFileName,
  montagePlan,
  monthDays,
  monthLeadBlanks,
} from "@/lib/logreview";
import { composeClips, shareOrDownload } from "@/lib/logmontage";

/** 3초 필름 보관함 — 달력 한 장에 영상이 남아 있는 모든 날(90일 + 평생 보관). [2026-11-06]
 *  예전엔 날짜 화살표로 14일만 넘길 수 있었고, 그보다 오래된 76일치 영상은 지워지기 전까지 볼 길이 없었다.
 *  타일은 영상 대신 첫 장면 그림(poster)만 그린다(수십 개라). 날을 누르면 그 날의 필름으로 간다.
 *  '이 달 3초 필름'은 이 기기에서 이어 붙여(캔버스 + MediaRecorder) 내려받거나 공유한다 — 서버로 보내지 않는다. */
export default function LogArchive({
  coupleId,
  myUserId,
  todayIso,
  onPick,
}: {
  coupleId: string;
  myUserId: string;
  todayIso: string;
  onPick: (dateIso: string) => void;
}) {
  const [rows, setRows] = useState<CoupleLog[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(todayIso.slice(0, 7));
  const [film, setFilm] = useState<{ done: number; total: number } | null>(null);
  const [filmMsg, setFilmMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let off = false;
    listLogArchive(coupleId, shiftDateIso(todayIso, -LOG_VIDEO_KEEP_DAYS))
      .then((r) => { if (!off) setRows(r); })
      .catch(() => { if (!off) setErr("보관함을 불러오지 못했어요."); });
    return () => { off = true; abortRef.current?.abort(); };
  }, [coupleId, todayIso]);

  const months = useMemo(
    () => archiveMonths(todayIso, (rows ?? []).filter((r) => r.keep).map((r) => r.log_date)),
    [rows, todayIso],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CoupleLog[]>();
    for (const r of rows ?? []) {
      if (!r.log_date.startsWith(month)) continue;
      const list = m.get(r.log_date) ?? [];
      list.push(r);
      m.set(r.log_date, list);
    }
    return m;
  }, [rows, month]);
  const monthClips = useMemo(() => [...byDay.values()].flat().filter((r) => r.video_path), [byDay]);
  const soon = monthClips.filter((r) => expirySoon(r, todayIso));

  async function makeFilm() {
    if (film) return;
    const plan = montagePlan(monthClips, myUserId);
    if (!plan.clips.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setFilmMsg(null);
    setFilm({ done: 0, total: plan.clips.length });
    try {
      const urls = await signLogMedia(plan.clips.map((c) => c.video_path ?? ""));
      const segments = plan.clips.map((c) => ({ sources: [urls[c.video_path ?? ""]].filter(Boolean) as string[] })).filter((s) => s.sources.length);
      const out = await composeClips(segments, {
        ...MONTAGE_SIZE,
        perClipMs: plan.perClipMs,
        signal: controller.signal,
        onProgress: (done, total) => setFilm({ done, total }),
      });
      const how = await shareOrDownload(out.blob, exportFileName("month", month, out.mime), `우리의 3초 필름 ${month.replace("-", ".")}`);
      setFilmMsg(how === "shared" ? "공유했어요." : how === "downloaded" ? "기기에 저장했어요." : null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setFilmMsg(e instanceof Error ? e.message : "필름을 만들지 못했어요.");
    } finally {
      abortRef.current = null;
      setFilm(null);
    }
  }

  const tile = (list: CoupleLog[] | undefined, mine: boolean) => {
    const l = list?.filter((x) => (x.created_by === myUserId) === mine).sort((a, b) => (a.slot < b.slot ? -1 : 1))[0];
    if (!l) return <span className="vlog-archive-thumb is-empty" aria-hidden />;
    // 서명 URL 의 작은 그림이라 next/image 최적화(정적 export 에선 꺼져 있다)를 거치지 않는다.
    // eslint-disable-next-line @next/next/no-img-element
    if (l.posterUrl) return <img className="vlog-archive-thumb" src={l.posterUrl} alt="" loading="lazy" decoding="async" />;
    return <span className={`vlog-archive-thumb ${l.video_path ? "is-video" : "is-text"}`} aria-hidden />;
  };

  return (
    <section className="vlog-archive" aria-label="3초 필름 보관함">
      <div className="vlog-archive-months" role="group" aria-label="달 고르기">
        {months.map((m) => (
          <button key={m} type="button" aria-pressed={m === month} onClick={() => setMonth(m)} className="tap">
            {Number(m.slice(5))}월
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-rose-deep">{err}</p>}
      {!rows && !err && <p className="mt-3 text-center text-xs text-muted">불러오는 중…</p>}
      {rows && (
        <>
          <div className="vlog-archive-grid" role="list">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d} className="vlog-archive-dow" aria-hidden>{d}</span>)}
            {Array.from({ length: monthLeadBlanks(month) }, (_, i) => <span key={`b${i}`} aria-hidden />)}
            {monthDays(month).map((d) => {
              const list = byDay.get(d);
              const future = d > todayIso;
              const kept = list?.some((x) => x.keep);
              const left = list?.map((x) => expiryDaysLeft(x, todayIso)).filter((n): n is number => n !== null && n > 0).sort((a, b) => a - b)[0];
              const count = list?.length ?? 0;
              return (
                <button
                  key={d}
                  type="button"
                  role="listitem"
                  disabled={future || !count}
                  onClick={() => onPick(d)}
                  aria-label={`${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 · ${count ? `${count}편` : "없음"}${kept ? " · 평생 보관" : ""}${left !== undefined && left <= 7 ? ` · ${left}일 뒤 영상 정리` : ""}`}
                  className={`tap vlog-archive-day ${d === todayIso ? "is-today" : ""}`}
                >
                  <span className="vlog-archive-date">{Number(d.slice(8))}</span>
                  <span className="vlog-archive-pair">{tile(list, true)}{tile(list, false)}</span>
                  {kept && <span className="vlog-archive-badge is-kept">★</span>}
                  {!kept && left !== undefined && left <= 7 && <span className="vlog-archive-badge">D-{left}</span>}
                </button>
              );
            })}
          </div>
          {soon.length > 0 && (
            <p className="vlog-archive-note">
              <Icon name="camera" size={12} /> 이 달 영상 {soon.length}편이 일주일 안에 정리돼요. 남기고 싶은 날을 눌러 별(평생 보관)을 켜 주세요 · 한 사람이 한 달에 한 편.
            </p>
          )}
          <div className="vlog-archive-actions">
            {film ? (
              <>
                <p role="status" className="text-xs font-bold text-ink">필름 만드는 중… {film.done}/{film.total}</p>
                <button type="button" className="tap vlog-film-action" onClick={() => abortRef.current?.abort()}>그만 만들기</button>
              </>
            ) : (
              <button type="button" className="tap vlog-film-action" disabled={!monthClips.length} onClick={makeFilm}>
                {Number(month.slice(5))}월의 3초 필름 만들기 ({monthClips.length}편)
              </button>
            )}
            {filmMsg && <p role="status" className="text-xs text-muted">{filmMsg}</p>}
            <p className="text-xs text-muted">이 기기에서 이어 붙여 저장하거나 공유해요 · 화면을 켜 둔 채 기다려 주세요.</p>
          </div>
        </>
      )}
    </section>
  );
}
