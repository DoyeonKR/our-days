"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  selectBuckets,
  type BucketFilter,
} from "@/lib/bucket";
import Icon from "@/components/Icon";
import { MoodGlyph } from "@/components/PixelGlyph";
import ConnectFirst from "@/components/ConnectFirst";
import { SkeletonList } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";
import { sendEventPush } from "@/lib/notify";
import SegmentedControl from "@/components/SegmentedControl";
import StatePanel from "@/components/StatePanel";

const defaultService = { list: listBucket, add: addBucket, toggle: setBucketDone, remove: deleteBucket, watch: subscribeBucket, notify: sendEventPush };
export type BucketService = typeof defaultService;

export default function BucketList({
  coupleId,
  onConnect,
  service = defaultService,
}: {
  coupleId: string | null;
  /** 연결 전 빈 화면의 '커플 연결하러 가기' — 함께 탭으로 보낸다. */
  onConnect?: () => void;
  /** Injectable repository for deterministic UI tests; production always uses couple APIs. */
  service?: BucketService;
}) {
  const [items, setItems] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<BucketCategory>("date");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<BucketFilter>("all");
  const [query, setQuery] = useState("");
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  // 추천 시드는 최초 1회만 뽑아 고정 (매 렌더 shuffle 방지)
  const suggestions = useMemo(() => sampleSeed(4), []);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      return (
      service.list(coupleId)
        .then((b) => {
          if (!cancelled && request === revision && !busyRef.current) {
            setItems(b);
            setLoadError(null);
          }
        })
        .catch((e) => {
          if (!cancelled && request === revision) setLoadError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled && request === revision) setLoading(false);
        }));
    };
    refreshRef.current = refresh;
    refresh();
    const unsub = service.watch(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId, reload, service]);

  const { done, total, pct } = useMemo(() => bucketProgress(items), [items]);
  const sorted = useMemo(
    () => selectBuckets(items, filter, query),
    [items, filter, query],
  );

  // Synchronous lock: React state alone still permits two clicks before the next render.
  function lock() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    return true;
  }
  function unlock() {
    busyRef.current = false;
    setBusy(false);
    void refreshRef.current();
  }

  async function add(t: string, c: string, timestamp: Date) {
    const text = t.trim();
    if (!text || !coupleId || !lock()) return;
    // 낙관적 갱신 — 실패 시 롤백
    const optimistic: Bucket = {
      id: `tmp-${timestamp.getTime()}`,
      title: text,
      category: c,
      done: false,
      done_at: null,
      created_by: "",
      created_at: timestamp.toISOString(),
    };
    setItems((prev) => [optimistic, ...prev]);
    try {
      await service.add(coupleId, text, c);
      void service.notify(coupleId, "bucket", "🎯 버킷리스트에 추가됐어요", `"${text}"`).catch(() => {});
      setTitle("");
      // A subsequent read failure must not imply the confirmed insert failed.
      // Keep the pending row until the authoritative refresh replaces it.
    } catch (e) {
      setItems((prev) => prev.filter((x) => x.id !== optimistic.id));
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      unlock();
    }
  }

  async function toggle(b: Bucket) {
    if (b.id.startsWith("tmp-") || !lock()) return;
    // 낙관적 토글
    setItems((prev) =>
      prev.map((x) => (x.id === b.id ? { ...x, done: !x.done } : x)),
    );
    try {
      await service.toggle(b.id, !b.done);
      if (!b.done) {
        void service.notify(coupleId!, "bucket", "🎉 버킷 하나를 이뤘어요!", `"${b.title}"`).catch(() => {});
      }
    } catch (e) {
      // 롤백
      setItems((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, done: b.done } : x)),
      );
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      unlock();
    }
  }

  async function remove(b: Bucket) {
    if (busyRef.current || b.id.startsWith("tmp-")) return;
    if (
      !(await confirmDialog({
        message: `'${b.title}' 삭제할까요?`,
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    if (!lock()) return;
    setItems((cur) => cur.filter((x) => x.id !== b.id));
    try {
      await service.remove(b.id);
    } catch (e) {
      // Restore only this row, not a stale snapshot of everyone else's changes.
      setItems((cur) => cur.some((x) => x.id === b.id) ? cur : [...cur, b]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      unlock();
    }
  }

  return (
    <section className="bucket-v2 mx-auto max-w-md px-5 pb-28 pt-4" aria-busy={busy}>
      {/* 보이는 제목은 없다 — 위 세그먼트가 이미 '버킷리스트'라고 말한다(DecoBook 주석 참고).
          한 줄 설명은 남긴다: 세그먼트 이름만으론 '어떻게 쓰는지'가 안 나온다. */}
      <h1 className="sr-only">버킷리스트</h1>
      <p className="mb-4 text-xs text-muted">
        함께 하고 싶은 걸 적고, 이루면 체크해요 <MoodGlyph e="💫" size={16} />
      </p>

      {!coupleId ? (
        <ConnectFirst
          icon="target"
          title="커플 연결 후 함께 채워요"
          body="'함께' 탭에서 상대와 연결하면 둘이 같이 버킷리스트를 만들 수 있어요."
          onConnect={onConnect}
        />
      ) : (
        <>
          {/* 진행률 */}
          <div className="bucket-progress-v2 rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
            <div className="flex items-end justify-between">
              <p className="text-sm font-bold text-ink">함께 이룬 것</p>
              <p className="text-sm font-extrabold text-gradient tabular-nums">
                {items.length === 0 && (loading || loadError) ? "확인 중" : `${done} / ${total}`}
              </p>
            </div>
            <div role="progressbar" aria-label="버킷리스트 달성률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={items.length === 0 && (loading || loadError) ? undefined : pct} className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-rose/12">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* 추가 */}
          <div className="bucket-composer-v2 mt-4 rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {BUCKET_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={cat === c.key}
                  onClick={() => setCat(c.key)}
                  className={`tap rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                    cat === c.key
                      ? "bg-rose/15 text-rose-deep ring-rose"
                      : "bg-glass text-muted ring-line"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void add(title, cat, new Date()); }}>
              <input
                aria-label="새 버킷리스트 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
                }}
                maxLength={500}
                placeholder="예) 같이 오로라 보러 가기"
                className="min-w-0 flex-1 rounded-xl border border-line bg-glass px-3 py-2.5 text-sm outline-none focus:border-rose"
              />
              <button
                type="submit"
                disabled={!title.trim() || busy}
                className="tap shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
              >
                {busy ? "처리 중…" : "추가"}
              </button>
            </form>
          </div>

          {err && <p role="alert" className="mt-3 text-xs text-rose-deep">{err}</p>}
          {loadError && <div className="mt-4"><StatePanel kind="error" title="목록을 확인하지 못했어요" detail="저장된 항목은 지워지지 않았어요. 다시 불러와 주세요." onRetry={() => setReload((n) => n + 1)} busy={loading} /></div>}
          {items.length > 0 && <div className="bucket-tools-v2 mt-5 space-y-3">
            <label className="block"><span className="sr-only">버킷리스트 검색</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="함께 하고 싶은 일 찾기" className="v2-search w-full" /></label>
            <SegmentedControl value={filter} onChange={setFilter} ariaLabel="버킷리스트 상태" options={[{value:"all", label:`전체 ${total}`}, {value:"todo",label:`하고 싶은 ${total - done}`}, {value:"done",label:`이룬 ${done}`}]} />
            <p role="status" className="text-xs text-muted">{sorted.length}개의 소망{busy ? " · 변경사항 저장 중…" : ""}</p>
          </div>}

          {/* 목록 */}
          {loading ? (
            <div className="mt-5">
              <SkeletonList rows={4} />
            </div>
          ) : loadError && items.length === 0 ? null : items.length === 0 ? (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-muted">이런 건 어때요? 눌러서 추가</p>
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => {
                  const m = categoryMeta(s.category);
                  return (
                    <button
                      key={i}
                      disabled={busy}
                      onClick={() => add(s.title, s.category, new Date())}
                      className="tap flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-left shadow-[var(--shadow-sm)] ring-1 ring-line"
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="flex-1 text-sm text-ink">{s.title}</span>
                      <span className="text-lg text-rose-deep">+</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="mt-4"><StatePanel title="조건에 맞는 소망이 없어요" detail="검색어나 상태 필터를 바꿔보세요." /><button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="tap state-panel-action mt-3">필터 초기화</button></div>
          ) : (
            <ul className="mt-5 space-y-2">
              {sorted.map((b) => {
                const m = categoryMeta(b.category);
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line"
                  >
                    <button
                      disabled={busy || b.id.startsWith("tmp-")}
                      onClick={() => toggle(b)}
                      aria-label={`${b.title} ${b.done ? "완료 취소" : "완료 표시"}`}
                      aria-pressed={b.done}
                      className={`tap bucket-check-v2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs ring-1 ${
                        b.done
                          ? "bg-rose-deep text-white ring-rose-deep"
                          : "bg-glass text-transparent ring-line"
                      }`}
                    >
                      ✓
                    </button>
                    <span className="text-base">{m.emoji}</span>
                    <span
                      className={`min-w-0 flex-1 break-words text-sm ${
                        b.done ? "text-muted line-through" : "font-semibold text-ink"
                      }`}
                    >
                      {b.title}
                    </span>
                    <button
                      disabled={busy || b.id.startsWith("tmp-")}
                      onClick={() => remove(b)}
                      aria-label={`${b.title} 삭제`}
                      className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted"
                    >
                      <Icon name="trash" size={16} />
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
