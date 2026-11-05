"use client";

/* 사진 크게 보기 — 사진첩 · 추억이 같이 쓴다. [2026-11-06 사진첩 리뷰]
 *
 * 예전 보기의 문제: 원본을 목록 시각에 서명해서 1시간 넘게 켜 두면 깨졌고(onError 없음), 원본이 올 때까지 검은 화면,
 * 두 손가락 확대 없음(앱 전체 확대 잠금), 안드로이드 뒤로 가기가 앱을 닫음, 저장 · 공유 · 날짜 · 올린 사람 없음,
 * 지우면 다음 사진이 아니라 보기가 닫혔다.
 * 지금: 썸네일을 먼저 깔고 원본은 열 때 서명(+ 앞뒤 이웃 미리 받기), 깨지면 한 번 다시 서명, 보기 안에서만 확대(두 손가락 ·
 * 두 번 탭), 뒤로 가기 = 닫기(useBackClose), 공유/저장, 찍은 날 · 올린 사람 · 캡션 · 하트 · 댓글.
 * ⚠ 확대는 브라우저 확대가 아니라 이 사진의 transform 이다 — ZoomLock 이 브라우저 확대를 막아도 영향이 없다(ZoomLock 은 안 고쳤다).
 */

import { useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/AppButtons";
import Icon from "@/components/Icon";
import {
  type Photo,
  type PhotoComment,
  type PhotoReaction,
  addPhotoComment,
  deletePhotoComment,
  listPhotoInteractions,
  resignPaths,
  setPhotoCaption,
  signPhotoOriginals,
  togglePhotoHeart,
} from "@/lib/couple";
import { isConfirmOpen } from "@/lib/confirm";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { useDayTick } from "@/lib/useDayTick";
import { clampPan, dayLabel, kstDay, neighborIds, pinchScale } from "@/lib/photoalbum";

export type ViewerActions = {
  coverPath: string | null;
  onCover: (p: Photo) => void;
  hungPaths: string[];
  onToggleHung?: (p: Photo) => void;
  hungBusy?: boolean;
  onTrash: (p: Photo) => void;
};

type Zoom = { id: string; s: number; x: number; y: number };

export default function PhotoViewer({
  photos,
  currentId,
  onChange,
  onClose,
  coupleId,
  myUserId,
  nameOf,
  actions,
  onPhotoUpdated,
  blockKeys = false,
}: {
  photos: Photo[];
  currentId: string;
  onChange: (id: string) => void;
  onClose: () => void;
  coupleId: string | null;
  myUserId: string | null;
  /** 올린 사람 이름(없으면 '나' · '상대'). */
  nameOf?: (userId: string) => string;
  actions?: ViewerActions;
  onPhotoUpdated?: (p: Photo) => void;
  /** 위에 다른 확인창이 떠 있을 때 — 화살표 키를 그쪽이 갖는다. */
  blockKeys?: boolean;
}) {
  const today = useDayTick();
  const idx = photos.findIndex((p) => p.id === currentId);
  const photo = idx >= 0 ? photos[idx] : null;
  const ids = photos.map((p) => p.id);
  const ref = useDialogFocus(true, onClose);
  useBackClose(onClose);

  // 원본 URL(보기에서만 서명) · 다시 서명한 썸네일 · 한 번 다시 서명했는지
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [thumbFix, setThumbFix] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<Record<string, true>>({});
  const retried = useRef(new Set<string>());
  const [zoom, setZoom] = useState<Zoom>({ id: "", s: 1, x: 0, y: 0 });
  const z = zoom.id === currentId ? zoom : { id: currentId, s: 1, x: 0, y: 0 };
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ dist: number; s: number; x: number; y: number; sx: number; sy: number; moved: boolean; pinch: boolean; t: number } | null>(null);
  const lastTap = useRef(0);
  const [dragging, setDragging] = useState(false); // 손가락이 닿아 있는 동안은 transform 전환을 끈다
  const [panel, setPanel] = useState(false); // 캡션 · 댓글 칸
  const [inter, setInter] = useState<{ id: string; comments: PhotoComment[]; reactions: PhotoReaction[] } | null>(null);
  const [draft, setDraft] = useState("");
  const [caption, setCaption] = useState<{ id: string; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 원본 서명(지금 + 앞뒤) · 이웃 미리 받기
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    const near = [photo, ...neighborIds(ids, photo.id).map((id) => photos.find((p) => p.id === id)!).filter(Boolean)];
    const need = near.filter((p) => !orig[p.path] && !(p.url && !p.thumbPath));
    if (need.length === 0) return;
    signPhotoOriginals(need)
      .then((urls) => {
        if (cancelled) return;
        setOrig((cur) => ({ ...cur, ...urls }));
        for (const p of need) {
          if (p.id === photo.id || !urls[p.path]) continue;
          const img = new Image();
          img.decoding = "async";
          img.src = urls[p.path];
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  // 하트 · 댓글(열 때만 읽는다 — 실시간 채널을 늘리지 않는다)
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    listPhotoInteractions(photo.id).then((r) => {
      if (!cancelled) setInter({ id: photo.id, ...r });
    });
    return () => {
      cancelled = true;
    };
  }, [photo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (delta: number) => {
    if (idx < 0 || photos.length < 2) return;
    onChange(photos[(idx + delta + photos.length) % photos.length].id);
  };

  // 화살표 키(Esc · Tab 은 useDialogFocus 가 맡는다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blockKeys || isConfirmOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!photo) return null;
  const thumbSrc = thumbFix[photo.thumbPath || photo.path] || photo.thumbUrl;
  const origSrc = orig[photo.path] || (photo.thumbPath ? "" : photo.url);
  const mine = !!myUserId && photo.created_by === myUserId;
  const who = nameOf ? nameOf(photo.created_by) : mine ? "나" : "상대";
  const when = `${dayLabel(kstDay(photo.shotAt), today)}${photo.takenAt ? "" : " 올림"}`;
  const hearts = inter?.id === photo.id ? inter.reactions : [];
  const comments = inter?.id === photo.id ? inter.comments : [];
  const myHeart = hearts.find((r) => r.created_by === myUserId) ?? null;
  const isCover = actions?.coverPath === photo.path;
  const hungAt = actions ? actions.hungPaths.indexOf(photo.path) : -1;

  async function fixOriginal(p: Photo) {
    const key = `o:${p.path}`;
    if (retried.current.has(key)) return;
    retried.current.add(key);
    const urls = await resignPaths([p.path]).catch(() => ({} as Record<string, string>));
    if (urls[p.path]) setOrig((cur) => ({ ...cur, [p.path]: urls[p.path] }));
  }
  async function fixThumb(p: Photo) {
    const path = p.thumbPath || p.path;
    const key = `t:${path}`;
    if (retried.current.has(key)) return;
    retried.current.add(key);
    const urls = await resignPaths([path]).catch(() => ({} as Record<string, string>));
    if (urls[path]) setThumbFix((cur) => ({ ...cur, [path]: urls[path] }));
  }

  /* ── 손가락: 두 손가락 = 확대, 확대 중 한 손가락 = 이동, 확대 안 했을 때 옆으로 = 넘기기, 두 번 탭 = 확대/원래대로 ── */
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  function onTouchStart(e: React.TouchEvent) {
    setDragging(true);
    if (e.touches.length === 2) {
      gesture.current = { dist: dist(e.touches), s: z.s, x: z.x, y: z.y, sx: 0, sy: 0, moved: true, pinch: true, t: Date.now() };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      gesture.current = { dist: 0, s: z.s, x: z.x, y: z.y, sx: t.clientX, sy: t.clientY, moved: false, pinch: false, t: Date.now() };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g) return;
    const box = stage.current?.getBoundingClientRect();
    const w = box?.width ?? 360, h = box?.height ?? 600;
    if (e.touches.length === 2 && g.pinch) {
      const s = pinchScale(g.dist, dist(e.touches), g.s);
      setZoom({ id: photo!.id, s, x: clampPan(g.x, w, s), y: clampPan(g.y, h, s) });
    } else if (e.touches.length === 1 && !g.pinch) {
      const t = e.touches[0];
      const dx = t.clientX - g.sx, dy = t.clientY - g.sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
      if (g.s > 1) setZoom({ id: photo!.id, s: g.s, x: clampPan(g.x + dx, w, g.s), y: clampPan(g.y + dy, h, g.s) });
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g || e.touches.length > 0) return;
    gesture.current = null;
    setDragging(false);
    if (g.pinch) {
      if (z.s < 1.05) setZoom({ id: photo!.id, s: 1, x: 0, y: 0 });
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - g.sx, dy = t.clientY - g.sy;
    if (g.s <= 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1); // 수평 우세 스와이프만 페이지 넘김(대각/수직 플릭 오동작 방지)
      return;
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        setZoom(z.s > 1 ? { id: photo!.id, s: 1, x: 0, y: 0 } : { id: photo!.id, s: 2.5, x: 0, y: 0 });
      } else lastTap.current = now;
    }
  }

  async function share(p: Photo) {
    setBusy(true);
    setNote(null);
    try {
      const url = orig[p.path] || (await signPhotoOriginals([p]))[p.path] || p.url;
      if (!url) throw new Error("no url");
      const blob = await (await fetch(url)).blob();
      const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("gif") ? "gif" : blob.type.includes("png") ? "png" : "jpg";
      const file = new File([blob], `haru-${kstDay(p.shotAt) || "photo"}.${ext}`, { type: blob.type || "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "우리 사진" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setNote("사진을 저장했어요");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("사진을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function heart(p: Photo) {
    if (!coupleId) return;
    try {
      await togglePhotoHeart(coupleId, p.id, myHeart?.id ?? null);
      const r = await listPhotoInteractions(p.id);
      setInter({ id: p.id, ...r });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "하트를 남기지 못했어요.");
    }
  }

  async function sendComment(p: Photo) {
    if (!coupleId || !draft.trim()) return;
    setBusy(true);
    try {
      await addPhotoComment(coupleId, p.id, draft);
      setDraft("");
      setInter({ id: p.id, ...(await listPhotoInteractions(p.id)) });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "댓글을 남기지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(p: Photo, id: string) {
    try {
      await deletePhotoComment(id);
      setInter({ id: p.id, ...(await listPhotoInteractions(p.id)) });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "댓글을 지우지 못했어요.");
    }
  }

  async function saveCaption(p: Photo, text: string) {
    setBusy(true);
    try {
      const saved = await setPhotoCaption(p.id, text);
      onPhotoUpdated?.({ ...p, caption: saved });
      setCaption(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "캡션을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const editing = caption?.id === photo.id ? caption : null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={`사진 크게 보기, ${when}, ${who}가 올린 사진`}
    >
      {/* 상단 바 — 몇 번째 · 찍은 날 · 올린 사람 */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="min-w-0 text-white/90">
          <p className="text-sm font-bold tabular-nums">
            {idx + 1} / {photos.length}
          </p>
          <p className="truncate text-xs text-white/70">
            {when} · {who}가 올림
          </p>
        </div>
        <CloseButton onClose={onClose} ariaLabel="사진 보기 닫기" />
      </div>

      {/* 사진 — 썸네일을 먼저 깔고 원본이 오면 덮는다 */}
      <div
        ref={stage}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={() => setZoom(z.s > 1 ? { id: photo.id, s: 1, x: 0, y: 0 } : { id: photo.id, s: 2.5, x: 0, y: 0 })}
      >
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, transition: dragging ? "none" : "transform 160ms ease-out" }}
        >
          {thumbSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`t-${photo.id}`}
              src={thumbSrc}
              alt=""
              aria-hidden
              onError={() => void fixThumb(photo)}
              className={`absolute max-h-full max-w-full select-none rounded-xl object-contain ${loaded[photo.id] ? "opacity-0" : "opacity-100 blur-[1px]"}`}
            />
          )}
          {origSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`o-${photo.id}`}
              src={origSrc}
              alt={photo.caption ? `${when} 사진: ${photo.caption}` : `${when} 사진`}
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded((cur) => ({ ...cur, [photo.id]: true }))}
              onError={() => void fixOriginal(photo)}
              className={`relative max-h-full max-w-full select-none rounded-xl object-contain transition-opacity duration-200 ${loaded[photo.id] ? "opacity-100" : "opacity-0"}`}
            />
          )}
        </div>
        {photos.length > 1 && z.s <= 1 && (
          <>
            <button onClick={() => step(-1)} aria-label="이전 사진" className="tap absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white">
              <Icon name="chevronLeft" size={22} />
            </button>
            <button onClick={() => step(1)} aria-label="다음 사진" className="tap absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white">
              <Icon name="chevronRight" size={22} />
            </button>
          </>
        )}
      </div>

      {/* 캡션 · 하트 · 댓글 */}
      <div className="px-4 pt-2 text-white">
        {editing ? (
          <div className="flex gap-2">
            <input
              value={editing.text}
              maxLength={200}
              autoFocus
              onChange={(e) => setCaption({ id: photo.id, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveCaption(photo, editing.text);
              }}
              aria-label="사진 캡션"
              placeholder="이 사진에 한 줄"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
            />
            <button disabled={busy} onClick={() => void saveCaption(photo, editing.text)} className="tap rounded-xl bg-white/90 px-3 text-sm font-bold text-black disabled:opacity-50">
              저장
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCaption({ id: photo.id, text: photo.caption ?? "" })}
            className="tap block w-full truncate text-left text-sm text-white/85"
            aria-label={photo.caption ? `캡션 고치기: ${photo.caption}` : "캡션 쓰기"}
          >
            {photo.caption || <span className="text-white/50">캡션 쓰기…</span>}
          </button>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => void heart(photo)}
            aria-pressed={!!myHeart}
            aria-label={myHeart ? `하트 빼기, 하트 ${hearts.length}개` : `하트 남기기, 하트 ${hearts.length}개`}
            className={`tap flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${myHeart ? "bg-rose text-white" : "bg-white/10 text-white"}`}
          >
            <Icon name="heart" size={15} filled={!!myHeart} /> {hearts.length}
          </button>
          <button
            onClick={() => setPanel((v) => !v)}
            aria-expanded={panel}
            className="tap flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white"
          >
            <Icon name="chat" size={15} /> 댓글 {comments.length}
          </button>
          {note && (
            <span role="status" className="ml-auto truncate text-xs text-white/75">
              {note}
            </span>
          )}
        </div>
        {panel && (
          <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-white/5 p-2">
            {comments.length === 0 && <p className="text-xs text-white/60">아직 댓글이 없어요.</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-bold text-white/80">{nameOf ? nameOf(c.created_by) : c.created_by === myUserId ? "나" : "상대"}</span>
                <span className="min-w-0 flex-1 break-words text-white/90">{c.body}</span>
                {c.created_by === myUserId && (
                  <button onClick={() => void removeComment(photo, c.id)} className="tap shrink-0 text-white/50" aria-label="내 댓글 지우기">
                    지우기
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                value={draft}
                maxLength={500}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendComment(photo);
                }}
                aria-label="댓글 쓰기"
                placeholder="한 줄 남기기"
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white placeholder:text-white/50"
              />
              <button disabled={busy || !draft.trim()} onClick={() => void sendComment(photo)} className="tap rounded-lg bg-white/90 px-2.5 text-xs font-bold text-black disabled:opacity-50">
                남기기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 액션 — 예전엔 타일 위 36px 버튼 셋이 107px 타일의 1/3 을 덮었다. 보기 안으로 옮겼다 */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {actions && (
          <button
            onClick={() => actions.onCover(photo)}
            aria-pressed={isCover}
            className={`tap flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-bold ${isCover ? "bg-brand text-white shadow-[var(--shadow-md)]" : "bg-white/10 text-white"}`}
          >
            <Icon name="star" size={15} filled={isCover} />
            {isCover ? "대표 사진" : "대표로"}
          </button>
        )}
        {actions?.onToggleHung && (
          <button
            onClick={() => actions.onToggleHung!(photo)}
            disabled={actions.hungBusy}
            aria-pressed={hungAt >= 0}
            className={`tap flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${hungAt >= 0 ? "bg-amber-300 text-ink" : "bg-white/10 text-white"}`}
          >
            <Icon name="house" size={15} filled={hungAt >= 0} />
            {hungAt >= 0 ? `홈 ${hungAt + 1}번째` : "홈에 걸기"}
          </button>
        )}
        <button disabled={busy} onClick={() => void share(photo)} className="tap flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          <Icon name="send" size={15} />
          저장·공유
        </button>
        {actions && (
          <button onClick={() => actions.onTrash(photo)} className="tap flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2.5 text-sm font-bold text-white">
            <Icon name="trash" size={15} />
            휴지통
          </button>
        )}
      </div>
    </div>
  );
}
