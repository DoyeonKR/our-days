"use client";

import { useEffect, useRef, useState } from "react";
import {
  type DecoEntry,
  addDecoEntry,
  currentUserId,
  deleteDecoEntry,
  listDecoEntries,
  subscribeDeco,
} from "@/lib/couple";
import { toISODate, today } from "@/lib/dday";

const BGS: { key: string; cls: string; label: string }[] = [
  { key: "pink", cls: "bg-[#f7d9e3]", label: "핑크" },
  { key: "cream", cls: "bg-[#f6ecd9]", label: "크림" },
  { key: "lavender", cls: "bg-[#e6dff7]", label: "라벤더" },
  { key: "mint", cls: "bg-[#d9f0e5]", label: "민트" },
  { key: "sky", cls: "bg-[#d9e8f5]", label: "하늘" },
  { key: "peach", cls: "bg-[#f7e0d3]", label: "피치" },
];
const bgClass = (k: string | null) => BGS.find((b) => b.key === k)?.cls ?? BGS[0].cls;
const MOODS = ["😊", "🥰", "😍", "😌", "🥳", "😢", "😴", "😋", "🤩", "😇"];
const STICKERS = ["💗", "⭐", "🌸", "✨", "🎀", "🍀", "☕", "🌙", "💫", "🧸", "🌈", "🍒"];
const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function parseTags(s: string): string[] {
  return s
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function DecoBook({ coupleId }: { coupleId: string | null }) {
  const [entries, setEntries] = useState<DecoEntry[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      listDecoEntries(coupleId)
        .then((e) => {
          if (!cancelled) setEntries(e);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    currentUserId().then((id) => !cancelled && setUid(id));
    refresh();
    const unsub = subscribeDeco(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  async function remove(e: DecoEntry) {
    if (!confirm("이 데코북 페이지를 삭제할까요?")) return;
    try {
      await deleteDecoEntry(e.id, e.photo_paths);
      if (coupleId) setEntries(await listDecoEntries(coupleId));
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-ink">데코북</h1>
        {coupleId && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-full bg-rose-deep px-4 py-2 text-sm font-bold text-white active:scale-95"
          >
            + 오늘 꾸미기
          </button>
        )}
      </div>

      {!coupleId && (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted ring-1 ring-line">
          커플을 연결하면 둘이 함께 데코북을 꾸밀 수 있어요.
        </p>
      )}

      {coupleId && (
        <>
          <p className="mb-3 text-xs text-muted">
            오늘 하루를 일기처럼 남기고 배경·이모티콘·사진으로 꾸며보세요. 둘이 실시간 공유돼요.
          </p>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
          ) : entries.length === 0 ? (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-2xl border border-dashed border-rose/40 bg-white/40 px-4 py-10 text-center text-sm text-muted active:scale-[0.99]"
            >
              첫 데코북 페이지를 만들어보세요 ✏️
            </button>
          ) : (
            <div className="space-y-4">
              {entries.map((e) => (
                <DecoCard key={e.id} e={e} mine={e.created_by === uid} onDelete={() => remove(e)} />
              ))}
            </div>
          )}
        </>
      )}

      {err && (
        <p className="mt-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-deep">{err}</p>
      )}

      {editing && coupleId && (
        <DecoEditor
          coupleId={coupleId}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            setEntries(await listDecoEntries(coupleId));
          }}
        />
      )}
    </section>
  );
}

/* ---------- 꾸민 페이지 렌더 ---------- */
function DecoCard({
  e,
  mine,
  onDelete,
}: {
  e: DecoEntry;
  mine: boolean;
  onDelete: () => void;
}) {
  const d = new Date(e.entry_date + "T00:00:00");
  return (
    <article
      className={`relative overflow-hidden rounded-[1.75rem] p-4 shadow-md ${bgClass(e.bg)}`}
    >
      {mine && (
        <button
          onClick={onDelete}
          className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/60 text-xs text-ink/50"
          aria-label="삭제"
        >
          ×
        </button>
      )}
      {/* 날짜 구름 */}
      <div className="mx-auto w-fit rounded-full bg-white/85 px-6 py-1.5 text-center shadow-sm">
        <p className="text-[10px] font-bold tracking-[0.2em] text-rose-deep">
          {DOW[d.getDay()]}
        </p>
        <p className="text-xl font-extrabold leading-none text-ink">{d.getDate()}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {e.location ? (
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs text-ink">
            📍 {e.location}
          </span>
        ) : (
          <span />
        )}
        {e.mood_emoji && <span className="text-2xl">{e.mood_emoji}</span>}
      </div>

      {e.photo_urls.length > 0 && (
        <div className="mt-3 flex gap-2">
          {e.photo_urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt=""
              className="h-36 flex-1 rounded-2xl object-cover shadow ring-2 ring-white/70"
            />
          ))}
        </div>
      )}

      {e.title && <p className="mt-3 text-sm font-bold text-ink">{e.title}</p>}
      {e.body && (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
          {e.body}
        </p>
      )}

      {e.stickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-xl">
          {e.stickers.map((s, i) => (
            <span key={i}>{s.emoji}</span>
          ))}
        </div>
      )}

      {e.hashtags.length > 0 && (
        <p className="mt-3 text-xs font-semibold text-rose-deep">
          {e.hashtags.map((h) => `#${h}`).join("  ")}
        </p>
      )}
    </article>
  );
}

/* ---------- 편집기 ---------- */
function DecoEditor({
  coupleId,
  onClose,
  onSaved,
}: {
  coupleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(toISODate(today()));
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [bg, setBg] = useState(BGS[0].key);
  const [stickers, setStickers] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleSticker(s: string) {
    setStickers((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 8),
    );
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await addDecoEntry(
        coupleId,
        {
          entry_date: date,
          title,
          body,
          location,
          mood_emoji: mood,
          bg,
          hashtags: parseTags(tags),
          stickers: stickers.map((emoji) => ({ emoji })),
        },
        files,
      );
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[2rem] bg-[var(--bg-1)] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <h3 className="text-lg font-extrabold text-ink">데코북 꾸미기</h3>

        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="📍 위치"
            className="flex-1 rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">오늘 기분</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((e) => (
              <button
                key={e}
                onClick={() => setMood(mood === e ? "" : e)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-xl ${
                  mood === e ? "bg-rose/20 ring-1 ring-rose" : "bg-white/60"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="오늘 하루를 일기처럼 남겨보세요"
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
        />

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">사진 (최대 2장)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-rose-deep ring-1 ring-line"
            >
              사진 선택
            </button>
            <span className="text-xs text-muted">{files.length}/2장 선택됨</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 2))}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">스티커</p>
          <div className="flex flex-wrap gap-1.5">
            {STICKERS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSticker(s)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${
                  stickers.includes(s) ? "bg-rose/20 ring-1 ring-rose" : "bg-white/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">배경</p>
          <div className="flex gap-2">
            {BGS.map((b) => (
              <button
                key={b.key}
                onClick={() => setBg(b.key)}
                className={`h-8 flex-1 rounded-lg ${b.cls} ${
                  bg === b.key ? "ring-2 ring-rose-deep" : "ring-1 ring-line"
                }`}
                aria-label={b.label}
              />
            ))}
          </div>
        </div>

        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="#해시태그 (공백/쉼표로 구분)"
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose"
        />

        {err && <p className="text-xs text-rose-deep">{err}</p>}

        <button
          disabled={busy}
          onClick={save}
          className="w-full rounded-2xl bg-rose-deep py-3.5 font-bold text-white active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "저장 중…" : "데코북에 남기기"}
        </button>
      </div>
    </div>
  );
}
