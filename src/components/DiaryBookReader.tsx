"use client";

/* 일기책 — 앱 안에서 넘겨 보는 책. 표지 · 차례 · 달마다 표제지 · 일기 · 뒤표지. [사용자 2026-11-05 "일기장도 책으로 만들기"]
 * 옆으로 밀면 한 장씩 넘어가고, 긴 일기는 그 쪽 안에서 위아래로 읽는다. 종이로 뽑는 건 'PDF 저장'(diaryBookHtml)이 맡는다. */
import { useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/AppButtons";
import { MoodGlyph } from "@/components/PixelGlyph";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { bookPages, type BookReaderEntry } from "@/lib/diarybook";

export default function DiaryBookReader({ year, entries, names, nameOf, onClose, onPrint }: { year: string; entries: readonly BookReaderEntry[]; names: string; nameOf: (uid: string) => string; onClose: () => void; onPrint: () => void }) {
  useBackClose(onClose);
  const focus = useDialogFocus(true, onClose);
  const pages = useMemo(() => bookPages(entries), [entries]);
  const shelf = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(0);
  const go = (i: number) => {
    const el = shelf.current;
    if (el) el.scrollTo({ left: el.clientWidth * Math.max(0, Math.min(pages.length - 1, i)), behavior: "smooth" });
  };
  const cover = entries.find((e) => e.photo_urls.length > 0)?.photo_urls[0];
  return (
    <div ref={focus} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`우리의 일기 ${year}`} className="diary-book fixed inset-0 z-[80] reading">
      <header className="diary-book-head">
        <button type="button" className="tap diary-book-print" onClick={onPrint}>PDF 저장</button>
        <p aria-live="polite">{at + 1} / {pages.length}</p>
        <CloseButton onClose={onClose} />
      </header>
      <div ref={shelf} className="diary-book-shelf" onScroll={(e) => {
        const el = e.currentTarget;
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        if (i !== at) setAt(i);
      }}>
        {pages.map((p, i) => (
          <article key={p.key} className={`diary-page is-${p.kind}`} aria-hidden={Math.abs(i - at) > 1}>
            {p.kind === "cover" && (
              <div className="diary-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cover && <img src={cover} alt="" />}
                <p>{year}</p>
                <h2>우리의 일기</h2>
                <small>{names}{"\n"}{entries.length}편</small>
              </div>
            )}
            {p.kind === "toc" && (
              <div className="diary-toc">
                <h2>차례</h2>
                <ol>
                  {p.months.map((m) => (
                    <li key={m.month}><button type="button" className="tap" onClick={() => go(m.page)}><span>{m.month}월</span><i aria-hidden /><span>{m.count}편</span></button></li>
                  ))}
                </ol>
              </div>
            )}
            {p.kind === "month" && (
              <div className="diary-month"><p>{year}</p><h2>{p.month}월</h2><small>{p.count}편의 하루</small></div>
            )}
            {p.kind === "entry" && (
              <div className="diary-entry">
                <p className="diary-entry-date">{Number(p.entry.entry_date.slice(5, 7))}월 {Number(p.entry.entry_date.slice(8, 10))}일 · {nameOf(p.entry.created_by)}{p.entry.mood_emoji && <MoodGlyph e={p.entry.mood_emoji} size={24} className="ml-1" />}</p>
                {(p.entry.location || p.entry.weather) && <p className="diary-entry-meta">{[p.entry.location, p.entry.weather].filter(Boolean).join(" · ")}</p>}
                {p.entry.title && <h3>{p.entry.title}</h3>}
                {p.entry.photo_urls.length > 0 && (
                  <div className="diary-entry-photos">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.entry.photo_urls.map((u) => <img key={u} src={u} alt="" loading="lazy" />)}
                  </div>
                )}
                {p.entry.body && <p className="diary-entry-body">{p.entry.body}</p>}
                {p.entry.hashtags.length > 0 && <p className="diary-entry-tags">{p.entry.hashtags.map((t) => `#${t}`).join(" ")}</p>}
              </div>
            )}
            {p.kind === "end" && <div className="diary-month"><h2>끝</h2><small>{year}년의 우리</small></div>}
          </article>
        ))}
      </div>
      <nav className="diary-book-nav" aria-label="쪽 넘기기">
        <button type="button" className="tap" disabled={at <= 0} onClick={() => go(at - 1)}>이전</button>
        <button type="button" className="tap" disabled={at >= pages.length - 1} onClick={() => go(at + 1)}>다음</button>
      </nav>
    </div>
  );
}
