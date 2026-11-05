"use client";

/* 매달 '지난달의 우리' 팝업 — 사진 네 장 · 이야기 · 숫자 · 기분. 공유 카드와 같은 달을 보여 준다. */
import { useEffect, useMemo, useState } from "react";
import { getMonthRecap, listMonthPhotos, photoInteractionCounts, signedPhotoUrls } from "@/lib/couple";
import { kstDate } from "@/lib/kst";
import { shiftedMonthKey, type MonthlyRecap } from "@/lib/memories";
import { bestPhotos } from "@/lib/photoalbum";
import { markRecapPopupSeen, recapHighlights } from "@/lib/recappopup";
import { shareMonthCard } from "@/lib/recapshare";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { CloseButton } from "@/components/AppButtons";
import { MoodGlyph } from "@/components/PixelGlyph";

export default function MonthlyRecapPopup({ coupleId, myUserId, month, onOpenMemories }: { coupleId: string; myUserId: string | null; month: string; onOpenMemories: () => void }) {
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getMonthRecap(coupleId, month);
      if (cancelled) return;
      // 기록이 없는 달은 띄우지 않는다 — 다음 달까지 묻지 않게 본 것으로 친다
      if (r.total === 0) {
        markRecapPopupSeen(coupleId, myUserId, month);
        setOpen(false);
        return;
      }
      setRecap(r);
      const [before, photos] = await Promise.all([
        getMonthRecap(coupleId, shiftedMonthKey(`${month}-01`, -1)).catch(() => null),
        listMonthPhotos(coupleId, month).catch(() => []),
      ]);
      if (cancelled) return;
      setLines(recapHighlights(r, before, photos.map((p) => kstDate(Date.parse(p.shotAt)))));
      const { hearts, comments } = await photoInteractionCounts(photos.map((p) => p.id)).catch(() => ({ hearts: new Map<string, number>(), comments: new Map<string, number>() }));
      const best = bestPhotos(photos, hearts, comments);
      const signed = await signedPhotoUrls(best.map((p) => p.thumbPath || p.path)).catch(() => ({} as Record<string, string>));
      if (!cancelled) setUrls(best.map((p) => signed[p.thumbPath || p.path]).filter(Boolean));
    })().catch(() => {
      if (!cancelled) setOpen(false); // 다음에 열 때 다시 시도한다
    });
    return () => {
      cancelled = true;
    };
  }, [coupleId, myUserId, month]);

  const close = () => {
    markRecapPopupSeen(coupleId, myUserId, month);
    setOpen(false);
  };
  if (!open || !recap) return null;
  return <Card recap={recap} lines={lines} urls={urls} busy={busy} note={note} onClose={close}
    onMore={() => { close(); onOpenMemories(); }}
    onShare={async () => {
      setBusy(true);
      setNote(null);
      try {
        setNote((await shareMonthCard(coupleId, recap)) === "saved" ? "카드를 저장했어요" : null);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setNote("카드를 만들지 못했어요. 다시 시도해 주세요.");
      } finally {
        setBusy(false);
      }
    }} />;
}

function Card({ recap, lines, urls, busy, note, onClose, onMore, onShare }: { recap: MonthlyRecap; lines: string[]; urls: string[]; busy: boolean; note: string | null; onClose: () => void; onMore: () => void; onShare: () => void }) {
  useBackClose(onClose);
  const ref = useDialogFocus(true, onClose);
  const [y, m] = recap.monthKey.split("-");
  const stats = useMemo(() => [["일기", recap.diaries], ["사진", recap.photos], ["로그", recap.logs], ["답변", recap.answers]] as const, [recap]);
  return (
    <div className="recap-pop-back fixed inset-0 z-[80]" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${y}년 ${Number(m)}월의 우리`} className="recap-pop reading" onClick={(e) => e.stopPropagation()}>
        <p className="recap-pop-kicker">지난달의 우리</p>
        <h2>{y}년 {Number(m)}월의 우리</h2>
        {urls.length > 0 && (
          <div className={`recap-pop-photos is-${Math.min(urls.length, 4)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {urls.slice(0, 4).map((u) => <img key={u} src={u} alt="" />)}
          </div>
        )}
        <ul className="recap-pop-lines">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <dl className="recap-pop-stats">
          {stats.map(([label, n]) => <div key={label}><dd>{n}</dd><dt>{label}</dt></div>)}
        </dl>
        {recap.moods.length > 0 && (
          <div className="recap-pop-moods" aria-label="이 달의 기분">
            {recap.moods.slice(0, 5).map((x) => <span key={x.emoji}><MoodGlyph e={x.emoji} size={24} /> {x.count}</span>)}
          </div>
        )}
        {note && <p role="status" className="recap-pop-note">{note}</p>}
        <div className="recap-pop-actions">
          <button type="button" className="tap" onClick={onShare} disabled={busy}>{busy ? "만드는 중…" : "카드로 공유"}</button>
          <button type="button" className="tap" onClick={onMore}>추억 보기</button>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
