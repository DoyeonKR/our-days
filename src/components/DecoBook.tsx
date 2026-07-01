"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Comment,
  type DecoEntry,
  type Reaction,
  addComment,
  addDecoEntry,
  addReaction,
  currentUserId,
  deleteComment,
  deleteDecoEntry,
  listComments,
  listDecoEntries,
  listReactions,
  removeReaction,
  subscribeDeco,
  subscribeEntryInteractions,
} from "@/lib/couple";
import { toISODate, today } from "@/lib/dday";
import {
  entryMonthKey,
  groupByMonth,
  matchesQuery,
  moodCounts,
  onThisDay,
} from "@/lib/diary";
import Icon from "@/components/Icon";
import SegmentedControl from "@/components/SegmentedControl";
import { SkeletonList } from "@/components/Skeleton";

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

export default function DecoBook({
  coupleId,
  myUserId = null,
  myName = "",
  partnerName = "",
}: {
  coupleId: string | null;
  myUserId?: string | null;
  myName?: string;
  partnerName?: string;
}) {
  const [entries, setEntries] = useState<DecoEntry[]>([]);
  // 상위에서 아는 uid 를 초기값으로 → 초기 렌더에서 mine/iReacted/작성자필터 오계산 방지
  const [uid, setUid] = useState<string | null>(myUserId);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [author, setAuthor] = useState<"all" | "me" | "partner">("all");
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const pendingReact = useRef<Set<string>>(new Set()); // 반응 add in-flight 가드

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
    const refreshMeta = () => {
      listReactions(coupleId)
        .then((r) => !cancelled && setReactions(r))
        .catch(() => {});
      listComments(coupleId)
        .then((c) => !cancelled && setComments(c))
        .catch(() => {});
    };
    currentUserId().then((id) => !cancelled && setUid(id));
    refresh();
    refreshMeta();
    const unsub = subscribeDeco(coupleId, refresh);
    const unsubMeta = subscribeEntryInteractions(coupleId, refreshMeta);
    return () => {
      cancelled = true;
      unsub();
      unsubMeta();
    };
  }, [coupleId]);

  // 반응 토글: 눌렀으면 취소, 아니면 추가 (양쪽 낙관적). in-flight 가드로 빠른
  // 더블탭 시 중복 add(무응답처럼 보이는 왕복) 방지.
  async function toggleReaction(entryId: string, emoji: string) {
    if (!coupleId) return;
    const key = `${entryId}:${emoji}`;
    const mine = reactions.find(
      (r) => r.entry_id === entryId && r.emoji === emoji && r.created_by === uid,
    );
    if (mine) {
      setReactions((cur) => cur.filter((r) => r.id !== mine.id)); // 낙관적 제거
      try {
        await removeReaction(mine.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setReactions(await listReactions(coupleId)); // 롤백
      }
      return;
    }
    if (pendingReact.current.has(key)) return; // 이미 처리 중
    pendingReact.current.add(key);
    const tmpId = `tmp-${key}`;
    setReactions((cur) => [
      ...cur,
      { id: tmpId, entry_id: entryId, emoji, created_by: uid ?? "" }, // 낙관적 추가
    ]);
    try {
      await addReaction(coupleId, entryId, emoji);
      setReactions(await listReactions(coupleId)); // tmp → 실제 row 로 정합
    } catch (e) {
      setReactions((cur) => cur.filter((r) => r.id !== tmpId)); // 롤백
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      pendingReact.current.delete(key);
    }
  }

  async function submitComment(entryId: string, body: string) {
    if (!coupleId || !body.trim()) return;
    try {
      await addComment(coupleId, entryId, body.trim());
      setComments(await listComments(coupleId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeComment(id: string) {
    const prev = comments;
    setComments((cur) => cur.filter((c) => c.id !== id));
    try {
      await deleteComment(id);
    } catch (e) {
      setComments(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(e: DecoEntry) {
    if (!confirm("이 일기장 페이지를 삭제할까요?")) return;
    try {
      await deleteDecoEntry(e.id, e.photo_paths);
      if (coupleId) setEntries(await listDecoEntries(coupleId));
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  const todayIso = toISODate(today());
  const recall = onThisDay(entries, todayIso);
  const monthKey = todayIso.slice(0, 7);
  const monthEntries = entries.filter((e) => entryMonthKey(e) === monthKey);
  const monthMoods = moodCounts(monthEntries);
  const moods = [...new Set(entries.map((e) => e.mood_emoji).filter(Boolean))] as string[];
  const filtered = entries.filter(
    (e) =>
      matchesQuery(e, q) &&
      (author === "all" || (author === "me") === (e.created_by === uid)) &&
      (!moodFilter || e.mood_emoji === moodFilter),
  );
  const groups = groupByMonth(filtered);
  const filtering = q.trim() !== "" || author !== "all" || moodFilter !== null;

  const renderCard = (e: DecoEntry) => (
    <DecoCard
      key={e.id}
      e={e}
      mine={e.created_by === uid}
      uid={uid}
      myName={myName}
      partnerName={partnerName}
      reactions={reactions.filter((r) => r.entry_id === e.id)}
      comments={comments.filter((c) => c.entry_id === e.id)}
      onDelete={() => remove(e)}
      onToggleReaction={(emoji) => toggleReaction(e.id, emoji)}
      onComment={(body) => submitComment(e.id, body)}
      onDeleteComment={removeComment}
    />
  );

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">일기장</h1>
        {coupleId && (
          <button
            onClick={() => setEditing(true)}
            className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-md)]"
          >
            <Icon name="pencil" size={15} />
            오늘 쓰기
          </button>
        )}
      </div>

      {!coupleId && (
        <div className="rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
            <Icon name="book" size={26} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">커플 연결 후 함께 써요</p>
          <p className="mt-1 text-xs text-muted">
            둘이 함께 하루를 기록하고 실시간으로 공유돼요.
          </p>
        </div>
      )}

      {coupleId && (
        <>
          {loading ? (
            <div className="mt-2">
              <SkeletonList rows={3} />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-12 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-glass text-muted ring-1 ring-line">
                <Icon name="book" size={22} />
              </div>
              <p className="text-sm font-semibold text-ink">아직 일기가 없어요</p>
              <p className="mt-1 text-xs text-muted">
                오늘 하루를 배경·사진·스티커로 남겨볼까요?
              </p>
              <button
                onClick={() => setEditing(true)}
                className="tap mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)]"
              >
                <Icon name="pencil" size={16} />첫 일기 쓰기
              </button>
            </div>
          ) : (
            <>
              {/* 작년 오늘 회상 */}
              {recall.length > 0 && (
                <div className="mb-5 rounded-[var(--radius-card)] bg-rose/8 p-4 ring-1 ring-rose/25">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-deep">
                    <Icon name="sparkles" size={14} />
                    지난 '오늘'의 우리
                  </p>
                  <div className="space-y-4">{recall.map(renderCard)}</div>
                </div>
              )}

              {/* 이번 달 기분 인사이트 */}
              {monthMoods.length > 0 && (
                <div className="mb-4 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-sm)] ring-1 ring-line">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Icon name="smile" size={14} className="text-rose-deep" />
                    이번 달 우리 기분 · {monthEntries.length}편
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {monthMoods.slice(0, 6).map((m) => (
                      <span
                        key={m.emoji}
                        className="flex items-center gap-1 rounded-full bg-glass px-2.5 py-1 text-sm ring-1 ring-line"
                      >
                        {m.emoji}
                        <span className="text-[11px] font-bold text-muted tabular-nums">
                          {m.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 검색 + 필터 */}
              <div className="mb-4 space-y-2.5">
                <div className="flex items-center gap-2 rounded-full bg-glass px-3.5 py-2.5 ring-1 ring-line">
                  <Icon name="search" size={16} className="shrink-0 text-muted" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="일기 검색 (제목·내용·해시태그)"
                    className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      aria-label="검색어 지우기"
                      className="tap -mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
                <SegmentedControl
                  value={author}
                  onChange={setAuthor}
                  ariaLabel="작성자 필터"
                  options={[
                    { value: "all", label: "전체" },
                    { value: "me", label: "내 일기" },
                    { value: "partner", label: "상대 일기" },
                  ]}
                />
                {moods.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {moods.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMoodFilter((cur) => (cur === m ? null : m))}
                        className={`tap rounded-full px-2.5 py-1 text-base ring-1 ${
                          moodFilter === m
                            ? "bg-rose/15 ring-rose"
                            : "bg-glass ring-line"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 월별 타임라인 */}
              {filtered.length === 0 ? (
                <p className="rounded-2xl bg-glass2 px-4 py-10 text-center text-sm text-muted ring-1 ring-line">
                  {filtering ? "검색 결과가 없어요" : "일기가 없어요"}
                </p>
              ) : (
                <div className="space-y-6">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-[var(--bg-1)]/70 px-1 py-1 text-xs font-bold text-muted backdrop-blur">
                        {g.label}{" "}
                        <span className="font-medium text-muted/70">
                          · {g.items.length}
                        </span>
                      </h2>
                      <div className="space-y-4">{g.items.map(renderCard)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
const REACT_EMOJIS = ["❤️", "😂", "🥹", "👍", "🎉"];

function DecoCard({
  e,
  mine,
  uid,
  myName,
  partnerName,
  reactions,
  comments,
  onDelete,
  onToggleReaction,
  onComment,
  onDeleteComment,
}: {
  e: DecoEntry;
  mine: boolean;
  uid: string | null;
  myName: string;
  partnerName: string;
  reactions: Reaction[];
  comments: Comment[];
  onDelete: () => void;
  onToggleReaction: (emoji: string) => void;
  onComment: (body: string) => void;
  onDeleteComment: (id: string) => void;
}) {
  const d = new Date(e.entry_date + "T00:00:00");
  const [c, setC] = useState("");
  // 프리셋 + 실제 달린(프리셋 외) 이모지 합집합
  const emojis = [
    ...REACT_EMOJIS,
    ...reactions.map((r) => r.emoji).filter((x) => !REACT_EMOJIS.includes(x)),
  ].filter((x, i, a) => a.indexOf(x) === i);
  const countOf = (emoji: string) => reactions.filter((r) => r.emoji === emoji).length;
  const iReacted = (emoji: string) =>
    reactions.some((r) => r.emoji === emoji && r.created_by === uid);
  return (
    <article
      // 일기 배경은 항상 밝은 파스텔 '종이색' → 다크 모드여도 카드 안 텍스트/칩은
      // 라이트 토큰으로 고정(안 그러면 text-ink 가 밝아져 파스텔 위에서 안 보임).
      style={
        {
          "--ink": "#2c2027",
          "--muted": "#93818b",
          "--rose": "#ff5f97",
          "--rose-deep": "#e5407a",
          "--glass": "rgba(255,255,255,0.66)",
          "--line": "rgba(229,64,122,0.14)",
        } as React.CSSProperties
      }
      className={`relative overflow-hidden rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-md)] ${bgClass(e.bg)}`}
    >
      {mine && (
        <button
          onClick={onDelete}
          className="tap absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-glass text-ink/60 ring-1 ring-line"
          aria-label="일기 삭제"
        >
          <Icon name="trash" size={15} />
        </button>
      )}
      {e.visibility === "private" && (
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-ink/60 ring-1 ring-line">
          <Icon name="lock" size={11} />
          나만 보기
        </span>
      )}
      {/* 날짜 구름 */}
      <div className="mx-auto w-fit rounded-full bg-glass px-6 py-1.5 text-center shadow-[var(--shadow-sm)]">
        <p className="text-[10px] font-bold tracking-[0.2em] text-rose-deep">
          {DOW[d.getDay()]}
        </p>
        <p className="text-xl font-extrabold leading-none text-ink">{d.getDate()}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {e.location ? (
          <span className="rounded-full bg-glass px-2.5 py-0.5 text-xs text-ink">
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
              loading="lazy"
              decoding="async"
              className="h-36 flex-1 rounded-2xl object-cover shadow-[var(--shadow-md)] ring-2 ring-line"
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

      {/* 반응 바 */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {emojis.map((emoji) => {
          const n = countOf(emoji);
          const active = iReacted(emoji);
          return (
            <button
              key={emoji}
              onClick={() => onToggleReaction(emoji)}
              className={`tap flex items-center gap-1 rounded-full px-2 py-1 text-sm ring-1 ${
                active
                  ? "bg-rose/20 ring-rose"
                  : "bg-glass ring-line opacity-80"
              }`}
              aria-label={`${emoji} 반응`}
              aria-pressed={active}
            >
              <span>{emoji}</span>
              {n > 0 && (
                <span className="text-[11px] font-bold text-ink/70 tabular-nums">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 댓글 */}
      {comments.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {comments.map((cm) => (
            <li key={cm.id} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5 shrink-0 font-bold text-rose-deep">
                {cm.created_by === uid
                  ? (myName || "나").trim()
                  : (partnerName || "상대").trim()}
              </span>
              <span className="flex-1 whitespace-pre-wrap text-ink/90">
                {cm.body}
              </span>
              {cm.created_by === uid && (
                <button
                  onClick={() => onDeleteComment(cm.id)}
                  aria-label="댓글 삭제"
                  className="tap -my-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/45"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={c}
          onChange={(ev) => setC(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && c.trim()) {
              onComment(c);
              setC("");
            }
          }}
          placeholder="한 줄 남기기"
          className="flex-1 rounded-full border border-line bg-glass px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40 focus:border-rose"
        />
        <button
          disabled={!c.trim()}
          onClick={() => {
            onComment(c);
            setC("");
          }}
          aria-label="댓글 보내기"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-sm)] disabled:opacity-40"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
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
  const [visibility, setVisibility] = useState<"shared" | "private">("shared");
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
          visibility,
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
        className="animate-pop max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[2rem] bg-surface glass p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <h3 className="text-lg font-extrabold text-ink">일기장 꾸미기</h3>

        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="📍 위치"
            className="flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">공개 범위</p>
          <SegmentedControl
            value={visibility}
            onChange={setVisibility}
            ariaLabel="공개 범위"
            options={[
              { value: "shared", label: "함께 보기" },
              { value: "private", label: "나만 보기" },
            ]}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">오늘 기분</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((e) => (
              <button
                key={e}
                onClick={() => setMood(mood === e ? "" : e)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-xl tap ${
                  mood === e ? "bg-rose/20 ring-1 ring-rose" : "bg-glass"
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
          className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="오늘 하루를 일기처럼 남겨보세요"
          className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
        />

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">사진 (최대 2장)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-glass px-3 py-2 text-sm font-semibold text-rose-deep ring-1 ring-line tap"
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
                className={`grid h-9 w-9 place-items-center rounded-lg text-lg tap ${
                  stickers.includes(s) ? "bg-rose/20 ring-1 ring-rose" : "bg-glass"
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
                className={`h-8 flex-1 rounded-lg tap ${b.cls} ${
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
          className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
        />

        {err && <p className="text-xs text-rose-deep">{err}</p>}

        <button
          disabled={busy}
          onClick={save}
          className="w-full rounded-2xl bg-brand py-3.5 font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          {busy ? "저장 중…" : "일기장에 남기기"}
        </button>
      </div>
    </div>
  );
}
