"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Photo,
  deletePhoto,
  listPhotos,
  subscribePhotos,
  uploadPhoto,
} from "@/lib/couple";

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
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await deletePhoto(p.id, p.path);
      if (coverPath === p.path) onSetCover("");
      setPhotos(await listPhotos(coupleId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-ink">공유 사진첩</h1>
        {coupleId && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            {busy ? "올리는 중…" : "+ 사진 올리기"}
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
        <p className="rounded-[var(--radius-card)] bg-card glass px-4 py-8 text-center text-sm text-muted ring-1 ring-line shadow-[var(--shadow-md)]">
          커플을 연결하면 사진을 함께 모을 수 있어요.
        </p>
      )}

      {coupleId && (
        <>
          <p className="mb-3 text-xs text-muted">
            사진을 눌러 <b className="text-rose-deep">대표 사진</b>으로 지정하면 홈 상단·배경에 쓰여요.
          </p>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
          ) : photos.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-glass2 px-4 py-10 text-center text-sm text-muted">
              아직 사진이 없어요. 첫 사진을 올려보세요 📷
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={`group relative aspect-square overflow-hidden rounded-xl ring-1 shadow-[var(--shadow-sm)] ${
                    coverPath === p.path ? "ring-2 ring-rose-deep" : "ring-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full cursor-pointer object-cover"
                    onClick={() => onSetCover(p.path)}
                  />
                  {coverPath === p.path && (
                    <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[var(--shadow-sm)]">
                      대표
                    </span>
                  )}
                  <button
                    onClick={() => remove(p)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-xs text-white tap"
                    aria-label="삭제"
                  >
                    ×
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
    </section>
  );
}
