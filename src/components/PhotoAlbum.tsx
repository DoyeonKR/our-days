"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Photo,
  deletePhoto,
  listPhotos,
  subscribePhotos,
  uploadPhoto,
} from "@/lib/couple";
import Icon from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";

export default function PhotoAlbum({
  coupleId,
  coverPath,
  onSetCover,
}: {
  coupleId: string | null;
  coverPath: string | null;
  onSetCover: (path: string) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Photo | null>(null); // 대표 지정 확인
  const [viewer, setViewer] = useState<number | null>(null); // 전체화면 뷰어(사진 인덱스)
  const fileRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  // 단일탭=전체화면 뷰어 / 더블탭=대표 지정 확인 (250ms 판별)
  function onTileClick(idx: number, p: Photo) {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setConfirm(p); // 더블탭
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setViewer(idx); // 단일탭
    }, 250);
  }

  const stepViewer = (delta: number) =>
    setViewer((v) =>
      v === null || photos.length === 0
        ? v
        : (v + delta + photos.length) % photos.length,
    );

  // 뷰어 키보드: ←/→ 넘기기, Esc 닫기
  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(null);
      else if (e.key === "ArrowLeft") stepViewer(-1);
      else if (e.key === "ArrowRight") stepViewer(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, photos.length]);

  // 삭제 등으로 인덱스가 범위를 벗어나면 보정/닫기
  useEffect(() => {
    if (viewer !== null && viewer >= photos.length) {
      setViewer(photos.length ? photos.length - 1 : null);
    }
  }, [viewer, photos.length]);

  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      listPhotos(coupleId)
        .then((p) => {
          if (!cancelled) setPhotos(p);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    refresh();
    const unsub = subscribePhotos(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  async function onFiles(files: FileList | null) {
    if (!coupleId || !files || !files.length) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(files)) await uploadPhoto(coupleId, f);
      setPhotos(await listPhotos(coupleId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(p: Photo) {
    if (!coupleId) return;
    if (
      !(await confirmDialog({
        message: "이 사진을 삭제할까요?",
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    // 낙관적 제거
    const prev = photos;
    const wasCover = coverPath === p.path;
    setPhotos((cur) => cur.filter((x) => x.id !== p.id));
    if (wasCover) onSetCover("");
    try {
      await deletePhoto(p.id, p.path, p.thumbPath);
    } catch (e) {
      setPhotos(prev); // 롤백
      if (wasCover) onSetCover(p.path); // 대표 해제도 롤백(서버 persist 방지)
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const applyCover = () => {
    if (!confirm) return;
    onSetCover(coverPath === confirm.path ? "" : confirm.path);
    setConfirm(null);
  };

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
          공유 사진첩
        </h1>
        {coupleId && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            <Icon name="plus" size={15} strokeWidth={2.4} />
            {busy ? "올리는 중…" : "사진 올리기"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {!coupleId && (
        <div className="rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
            <Icon name="image" size={26} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">
            커플 연결 후 함께 모아요
          </p>
          <p className="mt-1 text-xs text-muted">
            연결하면 사진을 함께 쌓고 대표 사진을 홈에 띄울 수 있어요.
          </p>
        </div>
      )}

      {coupleId && (
        <>
          <p className="mb-3 text-xs text-muted">
            사진을 <b className="text-rose-deep">탭하면 크게</b> 보고 좌우로 넘겨요 ·{" "}
            <b className="text-rose-deep">별</b>(또는 더블탭)로 대표 지정
          </p>
          {loading ? (
            <div
              className="grid grid-cols-3 gap-1.5"
              role="status"
              aria-label="사진 불러오는 중"
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-12 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-glass text-muted ring-1 ring-line">
                <Icon name="image" size={22} />
              </div>
              <p className="text-sm font-semibold text-ink">아직 사진이 없어요</p>
              <p className="mt-1 text-xs text-muted">첫 추억을 올려볼까요?</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="tap mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)]"
              >
                <Icon name="plus" size={16} strokeWidth={2.4} />첫 사진 올리기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className={`group relative aspect-square select-none overflow-hidden rounded-xl shadow-[var(--shadow-sm)] ring-1 ${
                    coverPath === p.path ? "ring-2 ring-rose-deep" : "ring-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl || p.url}
                    alt={`우리 사진 ${photos.length - i}`}
                    loading="lazy"
                    decoding="async"
                    onClick={() => onTileClick(i, p)}
                    style={{ touchAction: "manipulation" }}
                    className="h-full w-full cursor-pointer object-cover"
                  />
                  {/* 대표 지정/해제 — 더블탭 외 명시 버튼(키보드·스크린리더 접근) */}
                  <button
                    onClick={() => setConfirm(p)}
                    aria-label={
                      coverPath === p.path
                        ? "대표 사진 (해제하려면 누르기)"
                        : "대표 사진으로 지정"
                    }
                    aria-pressed={coverPath === p.path}
                    className={`tap absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full ${
                      coverPath === p.path
                        ? "bg-brand text-white shadow-[var(--shadow-sm)]"
                        : "bg-black/45 text-white/90"
                    }`}
                  >
                    <Icon name="star" size={14} filled={coverPath === p.path} />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="tap absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white"
                    aria-label="사진 삭제"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {err && (
        <p className="mt-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-deep">
          {err}
        </p>
      )}

      {/* 전체화면 앨범 뷰어 — 좌우 스와이프/화살표로 넘기기 */}
      {viewer !== null && photos[viewer] && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) stepViewer(dx < 0 ? 1 : -1);
          }}
        >
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <span className="text-sm font-bold text-white/90 tabular-nums">
              {viewer + 1} / {photos.length}
            </span>
            <button
              onClick={() => setViewer(null)}
              aria-label="닫기"
              className="tap grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
            >
              <Icon name="x" size={20} />
            </button>
          </div>

          {/* 사진 */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2"
            onClick={() => setViewer(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photos[viewer].id}
              src={photos[viewer].url || photos[viewer].thumbUrl}
              alt={`우리 사진 ${photos.length - viewer}`}
              decoding="async"
              onClick={(e) => e.stopPropagation()}
              className="animate-pop max-h-full max-w-full select-none rounded-xl object-contain"
              style={{ touchAction: "pan-y" }}
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stepViewer(-1);
                  }}
                  aria-label="이전 사진"
                  className="tap absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"
                >
                  <Icon name="chevronLeft" size={22} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stepViewer(1);
                  }}
                  aria-label="다음 사진"
                  className="tap absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"
                >
                  <Icon name="chevronRight" size={22} />
                </button>
              </>
            )}
          </div>

          {/* 하단 액션 */}
          <div className="flex items-center justify-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
            <button
              onClick={() => setConfirm(photos[viewer])}
              className={`tap flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold ${
                coverPath === photos[viewer].path
                  ? "bg-brand text-white shadow-[var(--shadow-md)]"
                  : "bg-white/10 text-white"
              }`}
            >
              <Icon
                name="star"
                size={15}
                filled={coverPath === photos[viewer].path}
              />
              {coverPath === photos[viewer].path ? "대표 사진" : "대표로 설정"}
            </button>
            <button
              onClick={() => remove(photos[viewer])}
              aria-label="사진 삭제"
              className="tap flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Icon name="trash" size={15} />
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 대표 사진 지정/해제 확인 (더블탭) */}
      {confirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-8 backdrop-blur-sm"
          onClick={() => setConfirm(null)}
        >
          <div
            className="animate-pop glass w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={confirm.url || confirm.thumbUrl}
                alt=""
                decoding="async"
                className="h-40 w-full object-cover"
              />
            </div>
            <p className="mt-3 text-center text-sm font-bold text-ink">
              {coverPath === confirm.path
                ? "대표 사진을 해제할까요?"
                : "이 사진을 대표 사진으로 설정할까요?"}
            </p>
            <p className="mt-1 text-center text-xs text-muted">
              홈 상단과 배경에 표시돼요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="tap flex-1 rounded-2xl bg-glass py-3 text-sm font-bold text-muted ring-1 ring-line"
              >
                취소
              </button>
              <button
                onClick={applyCover}
                className="tap flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]"
              >
                {coverPath === confirm.path ? "해제" : "대표로 설정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
