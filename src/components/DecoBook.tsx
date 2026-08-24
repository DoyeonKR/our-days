"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Comment,
  type DecoEntry,
  type Reaction,
  addComment,
  addDecoEntry,
  updateDecoEntry,
  addReaction,
  deleteComment,
  deleteDecoEntry,
  listComments,
  listDecoEntries,
  listReactions,
  removeReaction,
  resignPaths,
  subscribeDeco,
  subscribeEntryInteractions,
} from "@/lib/couple";
import { toISODate, today } from "@/lib/dday";
import { useDayTick } from "@/lib/useDayTick";
import { safeSlice } from "@/lib/base";
import {
  currentStreak,
  entryMonthKey,
  groupByMonth,
  heatmapCells,
  matchesQuery,
  moodCounts,
  onThisDay,
} from "@/lib/diary";
import Icon from "@/components/Icon";
import SegmentedControl from "@/components/SegmentedControl";
import { SkeletonList } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";
import { sendEventPush } from "@/lib/notify";

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
// 스크린리더용 기분 이름 (이모지만으론 의미 전달 안 됨) — 배경 버튼의 aria-label 패턴과 통일
const MOOD_LABELS: Record<string, string> = {
  "😊": "기쁜 기분", "🥰": "사랑스러운 기분", "😍": "황홀한 기분", "😌": "편안한 기분",
  "🥳": "신나는 기분", "😢": "슬픈 기분", "😴": "피곤한 기분", "😋": "맛있는 기분",
  "🤩": "감동한 기분", "😇": "천사 기분",
};
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
  const uid = myUserId; // page.tsx 확보 uid 직접 사용 (getUser 재조회 제거)
  // null=닫힘 · {entry:null}=새 일기 · {entry}=기존 일기 수정(날짜는 그대로 유지)
  const [editing, setEditing] = useState<{ entry: DecoEntry | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [author, setAuthor] = useState<"all" | "me" | "partner">("all");
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const pendingReact = useRef<Set<string>>(new Set()); // 반응 add in-flight 가드
  // ⚠ 목록 로드 실패와 '진짜 0편'을 구분한다 — 구분 안 하면 54편 가진 사용자에게
  // "아직 일기가 없어요"(빈 상태)가 떠서 데이터가 사라진 것처럼 보인다(2026-07-28 리뷰).
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      listDecoEntries(coupleId)
        .then((e) => {
          if (cancelled) return;
          setEntries(e);
          setLoadFailed(false);
          setErr(null); // 성공하면 옛 오류 배너를 내린다(안 그러면 리로드 전까지 상주)
        })
        .catch((e) => {
          if (cancelled) return;
          setLoadFailed(true);
          setErr(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    const refreshMeta = () => {
      // 반응/댓글 로드 실패를 조용히 삼키면 '상대 댓글이 통째로 사라짐'이 무증상이 된다
      listReactions(coupleId)
        .then((r) => !cancelled && setReactions(r))
        .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)));
      listComments(coupleId)
        .then((c) => !cancelled && setComments(c))
        .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)));
    };
    // uid 는 myUserId prop 으로 이미 초기화됨(78줄) — getUser 재조회 불필요
    refresh();
    refreshMeta();
    // realtime 이벤트 연쇄(반응 1탭 = INSERT + 후속) 시 full refetch 증폭 방지 — 400ms 디바운스
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeDeco(coupleId, () => {
      if (t1) clearTimeout(t1);
      t1 = setTimeout(refresh, 400);
    });
    const unsubMeta = subscribeEntryInteractions(coupleId, () => {
      if (t2) clearTimeout(t2);
      t2 = setTimeout(refreshMeta, 400);
    });
    return () => {
      cancelled = true;
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      unsub();
      unsubMeta();
    };
  }, [coupleId]);

  // 반응 토글: 눌렀으면 취소, 아니면 추가 (양쪽 낙관적). in-flight 가드로 빠른
  // 더블탭 시 중복 add(무응답처럼 보이는 왕복) 방지.
  async function toggleReaction(entryId: string, emoji: string) {
    // uid 로딩 전 탭 방지 — 빈 created_by 낙관레코드가 iReacted 검사와 어긋나 버튼이 안 눌린 채 남는 문제
    if (!coupleId || !uid) return;
    const key = `${entryId}:${emoji}`;
    // ⚠ in-flight 가드를 '취소 분기보다 먼저' — 순서가 반대면 빠른 더블탭 때 첫 탭의 낙관
    // 레코드(id="tmp-…")를 mine 으로 잡아 removeReaction("tmp-…") 를 보내고, DB 는 uuid 컬럼이라
    // 영문 오류가 사용자 화면에 뜬다(2026-07-28 리뷰 확정).
    if (pendingReact.current.has(key)) return;
    const mine = reactions.find(
      (r) => r.entry_id === entryId && r.emoji === emoji && r.created_by === uid,
    );
    if (mine && !mine.id.startsWith("tmp-")) {
      setReactions((cur) => cur.filter((r) => r.id !== mine.id)); // 낙관적 제거
      try {
        await removeReaction(mine.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        // 롤백 — 재조회가 그마저 실패(오프라인)하면 지웠던 레코드를 그대로 되살린다.
        // 안 그러면 낙관 제거가 고아로 남아 서버엔 있는 반응이 화면에서만 사라진다.
        const rolled = await listReactions(coupleId).catch(() => null);
        if (rolled) setReactions(rolled);
        else setReactions((cur) => [...cur, mine]);
      }
      return;
    }
    if (mine) return; // tmp(전송 중) 레코드 — 서버 id 가 생기기 전엔 취소 불가
    pendingReact.current.add(key);
    const tmpId = `tmp-${key}`;
    setReactions((cur) => [
      ...cur,
      { id: tmpId, entry_id: entryId, emoji, created_by: uid ?? "" }, // 낙관적 추가
    ]);
    try {
      await addReaction(coupleId, entryId, emoji);
      setReactions(await listReactions(coupleId)); // tmp → 실제 row 로 정합
      // 상대 일기에 반응했을 때만 상대에게 푸시
      const entry = entries.find((en) => en.id === entryId);
      if (entry && entry.created_by !== uid) {
        sendEventPush(coupleId, "interact", `${emoji} 내 일기에 반응이 달렸어요`, entry.title?.trim() || "일기장을 확인해 보세요");
      }
    } catch (e) {
      setReactions((cur) => cur.filter((r) => r.id !== tmpId)); // 롤백
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      pendingReact.current.delete(key);
    }
  }

  /** 성공 여부를 돌려준다 — 입력창은 성공했을 때만 비운다(실패 시 문장 유실 방지). */
  async function submitComment(entryId: string, body: string): Promise<boolean> {
    if (!coupleId || !body.trim()) return false;
    try {
      await addComment(coupleId, entryId, body.trim());
      setComments(await listComments(coupleId)); // 소켓과 무관하게 즉시 반영
      setErr(null);
      sendEventPush(coupleId, "interact", "💬 새 댓글이 달렸어요", safeSlice(body.trim(), 60));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
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

  // 서명 URL 만료(1시간) 자가복구 — 실패한 **그 엔트리만** 재서명해 패치한다.
  // ⚠ 전량 refresh 금지: 이미 받은 사진의 URL 까지 새로 바뀌어 브라우저 캐시가 통째로 무효화된다
  // (couple.ts 의 '같은 URL 재사용 = 캐시 적중' 계약). 엔트리당 2회 캡 — 실제로 삭제된 파일에서
  // evict→재서명→같은 실패 무한루프를 막는다(LoopVideo 와 같은 이유).
  const photoRetry = useRef<Map<string, number>>(new Map());
  async function recoverPhotos(e: DecoEntry) {
    if (!coupleId || !e.photo_paths.length) return;
    const n = photoRetry.current.get(e.id) ?? 0;
    if (n >= 2) return;
    photoRetry.current.set(e.id, n + 1);
    try {
      const urls = await resignPaths(e.photo_paths);
      const next = e.photo_paths.map((p) => urls[p] ?? "").filter(Boolean);
      if (next.length) setEntries((cur) => cur.map((x) => (x.id === e.id ? { ...x, photo_urls: next } : x)));
    } catch {
      // 조용히 — 다음 렌더/재조회에서 회복(배너 소음 금지)
    }
  }

  async function remove(e: DecoEntry) {
    if (
      !(await confirmDialog({
        message: "이 일기를 삭제할까요?",
        // 상대가 남긴 반응·댓글도 DB cascade 로 같이 사라진다 — 되돌릴 수 없으니 미리 알린다
        detail:
          (comments.some((c) => c.entry_id === e.id) || reactions.some((r) => r.entry_id === e.id)
            ? "여기 달린 반응과 댓글도 함께 사라져요. "
            : "") +
          "사진도 같이 지워지고 되돌릴 수 없어요." +
          // 일기는 오늘만 쓸 수 있으므로, 지난 날 일기를 지우면 그 날짜로는 다시 못 쓴다
          (e.entry_date !== toISODate(today())
            ? " 지난 날 일기는 다시 쓸 수 없으니, 고치려면 삭제 대신 '수정'을 쓰세요."
            : ""),
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    try {
      await deleteDecoEntry(e.id, e.photo_paths);
      if (coupleId) setEntries(await listDecoEntries(coupleId));
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  const todayIso = toISODate(today());
  // 타이핑/토글마다 전체 엔트리 재계산되지 않도록 의존값별 useMemo (엔트리 수백 개 대비)
  const recall = useMemo(() => onThisDay(entries, todayIso), [entries, todayIso]);
  const monthKey = todayIso.slice(0, 7);
  const monthEntries = useMemo(
    () => entries.filter((e) => entryMonthKey(e) === monthKey),
    [entries, monthKey],
  );
  const monthMoods = useMemo(() => moodCounts(monthEntries), [monthEntries]);
  const moods = useMemo(
    () => [...new Set(entries.map((e) => e.mood_emoji).filter(Boolean))] as string[],
    [entries],
  );
  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          matchesQuery(e, q) &&
          (author === "all" || (author === "me") === (e.created_by === uid)) &&
          (!moodFilter || e.mood_emoji === moodFilter),
      ),
    [entries, q, author, uid, moodFilter],
  );
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const heatmap = useMemo(() => heatmapCells(entries, todayIso, 24), [entries, todayIso]);
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
      onEdit={() => setEditing({ entry: e })}
      onToggleReaction={(emoji) => toggleReaction(e.id, emoji)}
      onComment={(body) => submitComment(e.id, body)}
      onDeleteComment={removeComment}
      onPhotoError={() => recoverPhotos(e)}
    />
  );

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="eyebrow">우리의 기록</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">일기장</h1>
        </div>
        {coupleId && (
          <button
            onClick={() => setEditing({ entry: null })}
            className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-md)]"
          >
            <Icon name="pencil" size={15} />
            오늘 쓰기
          </button>
        )}
      </div>

      {/* ⚠ 오류 배너는 목록보다 '위'에 — 아래에 두면 54편 중간에서 실패했을 때 화면 밖이라
          사용자는 아무 일도 안 일어난 것처럼 느낀다(2026-07-28 리뷰 확정) */}
      {err && (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-deep"
        >
          <span className="min-w-0 flex-1">{err}</span>
          <button onClick={() => setErr(null)} aria-label="오류 닫기" className="tap shrink-0 font-bold">
            ✕
          </button>
        </p>
      )}

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
          ) : loadFailed ? (
            /* 로드 실패를 '아직 일기가 없어요'로 위장하지 않는다 — 데이터 소실 오해 방지 */
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-ink">일기를 불러오지 못했어요</p>
              <p className="mt-1 text-xs text-muted">기록은 그대로 있어요. 잠시 후 다시 시도해 주세요.</p>
              <button
                onClick={() => {
                  setLoading(true);
                  setErr(null);
                  listDecoEntries(coupleId)
                    .then((e) => {
                      setEntries(e);
                      setLoadFailed(false);
                    })
                    .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                    .finally(() => setLoading(false));
                }}
                className="tap mx-auto mt-4 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white"
              >
                다시 시도
              </button>
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
                onClick={() => setEditing({ entry: null })}
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
                    지난 &apos;오늘&apos;의 우리
                  </p>
                  <div className="space-y-4">{recall.map(renderCard)}</div>
                </div>
              )}

              {/* 기록 히트맵 (최근 24주) */}
              <div className="mb-4 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-sm)] ring-1 ring-line">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Icon name="calendar" size={14} className="text-rose-deep" />
                    최근 24주 기록 · {entries.length}편
                  </p>
                  {(() => {
                    const streak = currentStreak(
                      entries.map((e) => e.entry_date),
                      todayIso,
                    );
                    return streak >= 2 ? (
                      <span className="flex items-center gap-1 rounded-full bg-rose/12 px-2 py-0.5 text-sm font-bold text-rose-deep">
                        <Icon name="flame" size={12} filled />
                        {streak}일 연속
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="grid grid-flow-col grid-rows-7 justify-start gap-[3px]">
                  {heatmap.map((c, i) => (
                    <span
                      key={i}
                      title={c?.iso}
                      className={`h-2.5 w-2.5 rounded-none ${
                        c === null
                          ? "bg-transparent"
                          : c.has
                            ? "bg-rose-deep"
                            : "bg-glass2 ring-1 ring-line"
                      }`}
                    />
                  ))}
                </div>
              </div>

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
                        <span className="text-sm font-bold text-muted tabular-nums">
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
                    aria-label="일기 검색"
                    placeholder="일기 검색 (제목·내용·해시태그)"
                    className="min-w-0 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
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

      {editing && coupleId && (
        <DecoEditor
          coupleId={coupleId}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            // ⚠ 저장 성공 뒤의 재조회 실패를 삼키면 'DB엔 저장 + 상대에겐 알림 + 내 화면엔 없음'
            // 이 된다(소켓이 살아야만 나중에 뜸). 실패를 배너로 올리고 편집기는 그때만 유지.
            try {
              setEntries(await listDecoEntries(coupleId));
              setLoadFailed(false);
              setErr(null);
            } catch (e) {
              setErr(
                (e instanceof Error ? e.message : String(e)) +
                  " (일기는 저장됐어요, 목록을 새로고침해 주세요)",
              );
            } finally {
              setEditing(null);
            }
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
  onEdit,
  onToggleReaction,
  onComment,
  onDeleteComment,
  onPhotoError,
}: {
  e: DecoEntry;
  mine: boolean;
  uid: string | null;
  myName: string;
  partnerName: string;
  reactions: Reaction[];
  comments: Comment[];
  onDelete: () => void;
  onEdit: () => void;
  onToggleReaction: (emoji: string) => void;
  onComment: (body: string) => Promise<boolean>;
  onDeleteComment: (id: string) => void;
  onPhotoError: () => void;
}) {
  const d = new Date(e.entry_date + "T00:00:00");
  const [c, setC] = useState("");
  const [sending, setSending] = useState(false);
  // ⚠ 결과와 무관하게 입력을 비우면 실패 시 쓴 문장이 사라진다 — **성공했을 때만** 비운다.
  // (반응/댓글삭제는 이미 낙관+롤백인데 댓글 추가만 이 계약을 벗어나 있었음 — 2026-07-28 리뷰)
  async function send() {
    const body = c.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onComment(body);
    setSending(false);
    if (ok) setC("");
  }
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
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          <button
            onClick={onEdit}
            className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-ink/60 ring-1 ring-line"
            aria-label="일기 수정"
          >
            <Icon name="pencil" size={15} />
          </button>
          <button
            onClick={onDelete}
            className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-ink/60 ring-1 ring-line"
            aria-label="일기 삭제"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      )}
      {e.visibility === "private" && (
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-glass px-2 py-0.5 text-xs font-bold text-ink/60 ring-1 ring-line">
          <Icon name="lock" size={11} />
          나만 보기
        </span>
      )}
      {/* 날짜 구름 */}
      <div className="mx-auto w-fit rounded-full bg-glass px-6 py-1.5 text-center shadow-[var(--shadow-sm)]">
        <p className="text-xs font-bold tracking-[2px] text-rose-deep">
          {DOW[d.getDay()]}
        </p>
        <p className="text-xl font-extrabold leading-none text-ink">{d.getDate()}</p>
      </div>
      {/* 작성자 칩 — 둘이 함께 쓰는 피드인데 카드만 봐선 누가 쓴 글인지 알 수 없었다.
          ⚠ 좌상단은 '나만 보기', 우상단은 삭제 버튼이 점유 → 날짜 구름 아래 중앙 칩으로. */}
      <p
        className={`mx-auto mt-1.5 w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${
          mine ? "bg-rose/12 text-rose-deep" : "bg-glass text-ink/70 ring-1 ring-line"
        }`}
      >
        {mine ? (myName || "나").trim() : (partnerName || "상대").trim()}의 하루
      </p>

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
              alt={e.title ? `${e.title} 사진 ${i + 1}` : `${e.entry_date} 일기 사진 ${i + 1}`}
              loading="lazy"
              decoding="async"
              onError={onPhotoError} // 서명 URL 만료(1시간) 자가복구 — 이 엔트리만 재서명
              className="h-36 flex-1 rounded-2xl object-cover shadow-[var(--shadow-md)] ring-2 ring-line"
            />
          ))}
        </div>
      )}

      {e.title && <p className="mt-3 text-sm font-bold text-ink">{e.title}</p>}
      {e.body && (
        <p className="prose-ko mt-1 whitespace-pre-wrap text-ink/90">
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
                <span className="text-sm font-bold text-ink/70 tabular-nums">
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
              <span className="prose-ko flex-1 whitespace-pre-wrap text-ink/90">
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
            if (ev.key === "Enter") send();
          }}
          disabled={sending}
          placeholder="한 줄 남기기"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full border border-line bg-glass px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40 focus:border-rose disabled:opacity-60"
        />
        <button
          disabled={!c.trim() || sending}
          onClick={send}
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
  entry,
  onClose,
  onSaved,
}: {
  coupleId: string;
  entry: DecoEntry | null; // null=새 일기 · 있으면 수정(날짜 고정, 사진 유지)
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  // 새 일기는 **오늘만** 쓴다 — 날짜 선택 불가(지난 날 소급 작성 금지, 2026-07-28).
  // useDayTick 이 자정을 넘기면(백그라운드 PWA 복귀 포함) 값을 갱신해 어제 날짜로 저장되는 일이 없다.
  // 수정일 때는 그날의 기록이므로 **원본 날짜를 그대로** 보여주고 바꾸지 않는다.
  const todayKey = useDayTick();
  const date = entry ? entry.entry_date : todayKey;
  const [location, setLocation] = useState(entry?.location ?? "");
  const [mood, setMood] = useState(entry?.mood_emoji ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [tags, setTags] = useState(entry ? entry.hashtags.map((h) => `#${h}`).join(" ") : "");
  const [bg, setBg] = useState(entry?.bg ?? BGS[0].key);
  const [stickers, setStickers] = useState<string[]>(entry ? entry.stickers.map((x) => x.emoji) : []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // DecoEntry.visibility 는 느슨한 string(DB 컬럼) — 좁혀서 받는다
  const [visibility, setVisibility] = useState<"shared" | "private">(
    entry?.visibility === "private" ? "private" : "shared",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleSticker(s: string) {
    setStickers((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 8),
    );
  }

  // 배경 오탭 한 번에 장문+사진 초안이 통째로 사라지는 사고 방지 — Letters 의 requestClose 패턴.
  const confirmingRef = useRef(false); // Esc 연타/이중 탭으로 confirm 이 중첩되는 것 방지
  async function requestClose() {
    if (confirmingRef.current) return;
    const dirty =
      title.trim() ||
      body.trim() ||
      location.trim() ||
      tags.trim() ||
      mood ||
      stickers.length > 0 ||
      files.length > 0;
    if (dirty) {
      confirmingRef.current = true;
      const ok = await confirmDialog({
        message: "작성 중인 일기를 버릴까요?",
        confirmText: "버리기",
        danger: true,
      });
      confirmingRef.current = false;
      if (!ok) return;
    }
    onClose();
  }

  // Esc 로도 같은 가드 경유
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // requestClose 는 최신 state 클로저 필요 → 매 렌더 재바인딩 (가벼움)
  });

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const patch = {
        title,
        body,
        location,
        mood_emoji: mood,
        bg,
        hashtags: parseTags(tags),
        stickers: stickers.map((emoji) => ({ emoji })),
        visibility,
      };
      // 수정은 날짜/사진을 건드리지 않는다(그날의 기록 보존). 새 일기만 사진 업로드.
      if (entry) await updateDecoEntry(entry.id, patch);
      else await addDecoEntry(coupleId, { entry_date: date, ...patch }, files);
      // 비밀일기(나만 보기)는 상대에게 알리지 않음. 수정은 재알림하지 않는다(스팸 방지).
      if (!entry && visibility === "shared") {
        sendEventPush(
          coupleId,
          "diary",
          "📔 새 일기가 도착했어요",
          title.trim() || safeSlice(body.trim(), 40) || "일기장을 확인해 보세요",
        );
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="일기 쓰기"
        className="animate-pop max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[2rem] bg-surface glass p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <h3 className="text-lg font-extrabold text-ink">{isEdit ? "일기 수정" : "일기장 꾸미기"}</h3>

        <div className="flex gap-2">
          {/* 날짜 = 오늘 고정(선택 불가) — 지난 날 일기 소급 작성 금지 */}
          <div
            className="flex flex-1 items-center gap-1.5 rounded-xl border border-line bg-glass px-3 py-2 text-sm text-ink"
            title={isEdit ? "일기의 날짜는 바꿀 수 없어요(그날의 기록)" : "일기는 오늘 하루만 기록할 수 있어요"}
          >
            <Icon name="calendar" size={14} className="shrink-0 text-rose-deep" />
            <span className="font-semibold tabular-nums">{date.replaceAll("-", ".")}</span>
            <span className="ml-auto shrink-0 text-xs font-bold text-muted">{isEdit ? "그날" : "오늘"}</span>
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="📍 위치"
            className="min-w-0 flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
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
                aria-label={MOOD_LABELS[e] ?? "기분"}
                aria-pressed={mood === e}
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
          maxLength={10000}
          placeholder="오늘 하루를 일기처럼 남겨보세요"
          className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
        />

        <div hidden={isEdit}>
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
          {busy ? "저장 중…" : isEdit ? "수정 저장" : "일기장에 남기기"}
        </button>
      </div>
    </div>
  );
}
