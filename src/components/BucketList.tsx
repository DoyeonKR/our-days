"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type Bucket,
  addBucket,
  deleteBucket,
  listBucket,
  setBucketDone,
  subscribeBucket,
} from "@/lib/couple";
import {
  BUCKET_CATEGORIES,
  type BucketCategory,
  bucketProgress,
  categoryMeta,
  sampleSeed,
} from "@/lib/bucket";

export default function BucketList({ coupleId }: { coupleId: string | null }) {
  const [items, setItems] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<BucketCategory>("date");
  const [busy, setBusy] = useState(false);
  // 추천 시드는 최초 1회만 뽑아 고정 (매 렌더 shuffle 방지)
  const suggestions = useMemo(() => sampleSeed(4), []);

  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      listBucket(coupleId)
        .then((b) => {
          if (!cancelled) setItems(b);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    refresh();
    const unsub = subscribeBucket(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const { done, total, pct } = useMemo(() => bucketProgress(items), [items]);
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1; // 미완료 먼저
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  async function add(t: string, c: string) {
    const text = t.trim();
    if (!text || !coupleId || busy) return;
    setBusy(true);
    setErr(null);
    // 낙관적 갱신 — 실패 시 롤백
    const optimistic: Bucket = {
      id: `tmp-${Date.now()}`,
      title: text,
      category: c,
      done: false,
      done_at: null,
      created_by: "",
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [optimistic, ...prev]);
    try {
      await addBucket(coupleId, text, c);
      setTitle("");
      // 실제 목록은 realtime/refresh 가 곧 반영 (tmp 제거)
      setItems((prev) => prev.filter((x) => x.id !== optimistic.id));
      setItems(await listBucket(coupleId));
    } catch (e) {
      setItems((prev) => prev.filter((x) => x.id !== optimistic.id));
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Bucket) {
    // 낙관적 토글
    setItems((prev) =>
      prev.map((x) => (x.id === b.id ? { ...x, done: !x.done } : x)),
    );
    try {
      await setBucketDone(b.id, !b.done);
    } catch (e) {
      // 롤백
      setItems((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, done: b.done } : x)),
      );
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(b: Bucket) {
    if (!confirm(`'${b.title}' 삭제할까요?`)) return;
    const prev = items;
    setItems((cur) => cur.filter((x) => x.id !== b.id));
    try {
      await deleteBucket(b.id);
    } catch (e) {
      setItems(prev); // 롤백
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="mb-1 text-lg font-extrabold text-ink">우리 버킷리스트</h1>
      <p className="mb-4 text-xs text-muted">함께 하고 싶은 걸 적고, 이루면 체크해요 💫</p>

      {!coupleId ? (
        <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-sm ring-1 ring-line">
          <div className="text-4xl">🎯</div>
          <p className="mt-3 text-sm font-bold text-ink">커플 연결 후 함께 채워요</p>
          <p className="mt-1 text-xs text-muted">
            홈에서 상대와 연결하면 둘이 함께 버킷리스트를 만들 수 있어요.
          </p>
        </div>
      ) : (
        <>
          {/* 진행률 */}
          <div className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-line">
            <div className="flex items-end justify-between">
              <p className="text-sm font-bold text-ink">함께 이룬 것</p>
              <p className="text-sm font-extrabold text-rose-deep tabular-nums">
                {done} / {total}
              </p>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-rose/12">
              <div
                className="h-full rounded-full bg-rose-deep transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* 추가 */}
          <div className="mt-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-line">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {BUCKET_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 active:scale-95 ${
                    cat === c.key
                      ? "bg-rose/15 text-rose-deep ring-rose"
                      : "bg-white/60 text-muted ring-line"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add(title, cat);
                }}
                placeholder="예) 같이 오로라 보러 가기"
                className="flex-1 rounded-xl border border-line bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-rose"
              />
              <button
                disabled={!title.trim() || busy}
                onClick={() => add(title, cat)}
                className="shrink-0 rounded-xl bg-rose-deep px-4 py-2.5 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>

          {err && <p className="mt-3 text-xs text-rose-deep">{err}</p>}

          {/* 목록 */}
          {loading ? (
            <p className="mt-6 text-center text-sm text-muted">불러오는 중…</p>
          ) : items.length === 0 ? (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-muted">이런 건 어때요? 눌러서 추가</p>
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => {
                  const m = categoryMeta(s.category);
                  return (
                    <button
                      key={i}
                      onClick={() => add(s.title, s.category)}
                      className="flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-left shadow-sm ring-1 ring-line active:scale-[0.99]"
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="flex-1 text-sm text-ink">{s.title}</span>
                      <span className="text-lg text-rose-deep">+</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <ul className="mt-5 space-y-2">
              {sorted.map((b) => {
                const m = categoryMeta(b.category);
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-line"
                  >
                    <button
                      onClick={() => toggle(b)}
                      aria-label={b.done ? "완료 취소" : "완료 표시"}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ring-1 active:scale-90 ${
                        b.done
                          ? "bg-rose-deep text-white ring-rose-deep"
                          : "bg-white/60 text-transparent ring-line"
                      }`}
                    >
                      ✓
                    </button>
                    <span className="text-base">{m.emoji}</span>
                    <span
                      className={`flex-1 text-sm ${
                        b.done ? "text-muted line-through" : "font-semibold text-ink"
                      }`}
                    >
                      {b.title}
                    </span>
                    <button
                      onClick={() => remove(b)}
                      aria-label="삭제"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted active:scale-90"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
