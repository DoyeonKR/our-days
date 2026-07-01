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
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!window.confirm("이 사진을 삭제할까요?")) return;
    // 낙관적 제거
    const prev = photos;
    setPhotos((cur) => cur.filter((x) => x.id !== p.id));
    if (coverPath === p.path) onSetCover("");
    try {
      await deletePhoto(p.id, p.path, p.thumbPath);
    } catch (e) {
      setPhotos(prev); // 롤백
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
            사진을 <b className="text-rose-deep">더블탭</b>하면 대표 사진으로 지정돼요
            · 홈 상단·배경에 표시
          </p>
          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
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
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={`group relative aspect-square select-none overflow-hidden rounded-xl shadow-[var(--shadow-sm)] ring-1 ${
                    coverPath === p.path ? "ring-2 ring-rose-deep" : "ring-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl || p.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onDoubleClick={() => setConfirm(p)}
                    style={{ touchAction: "manipulation" }}
                    className="h-full w-full cursor-pointer object-cover"
                  />
                  {coverPath === p.path && (
                    <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[var(--shadow-sm)]">
                      대표
                    </span>
                  )}
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

      {/* 대표 사진 지정/해제 확인 (더블탭) */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-8 backdrop-blur-sm"
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
