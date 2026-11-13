"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type Comment,
  type DecoEntry,
  type Reaction,
  DiaryConflictError,
  DiaryGoneError,
  addComment,
  addDecoEntry,
  updateDecoEntry,
  updateDecoPhotos,
  addReaction,
  deleteComment,
  deleteDecoEntry,
  getDecoEntry,
  listComments,
  listDecoEntries,
  listReactions,
  removeReaction,
  resignPaths,
  decoDisplayPaths,
  signDecoOriginals,
  subscribeDeco,
  subscribeEntryInteractions,
} from "@/lib/couple";
import { useDayTick } from "@/lib/useDayTick";
import { safeSlice } from "@/lib/base";
import {
  MAX_TAGS,
  applyRowChange,
  diaryBookHtml,
  entryVersion,
  groupByMonth,
  hasTagQuery,
  isStaleDraft,
  legacyDraftDate,
  legacyDraftKey,
  matchesQuery,
  normalizeTags,
  sortEntries,
  toggleTagQuery,
  weatherTag,
} from "@/lib/diary";
import Icon from "@/components/Icon";
import { MicroIcon, MoodGlyph } from "@/components/PixelGlyph";
import ConnectFirst from "@/components/ConnectFirst";
import Sheet from "@/components/Sheet";
import { SkeletonList } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";
import { sendEventPush } from "@/lib/notify";
import { beginBusy } from "@/lib/busy";
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from "@/lib/draft";
import { mergeIntoNewDraft, rebaseKeep, visiblePhotoUrls } from "@/lib/diarysave";
import DiaryBookReader from "@/components/DiaryBookReader";
import { useBackClose } from "@/lib/useBackClose";
import { useForecast } from "@/lib/useforecast";
import { useWeatherPlace } from "@/lib/weatherplace";
import { PLACES, wmoInfo } from "@/lib/weather";

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
const DOW = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const TITLE_MAX = 80;
const LOCATION_MAX = 40;

/** 한국어 입력(IME) 조합 중의 Enter 는 글자 확정이지 보내기가 아니다 — 예전엔 조합 Enter 와 확정 Enter 가
 *  둘 다 send 를 불러 같은 댓글이 두 번 달렸다(모바일 · 사파리는 keyCode 229 로만 알려 준다). */
function isImeEnter(ev: React.KeyboardEvent): boolean {
  return ev.nativeEvent.isComposing || ev.keyCode === 229;
}

/* KST '오늘' [2026-11-06] — 일기는 KST 날짜로 저장된다(addDecoEntry 의 kstDate). 화면의 오늘을 기기 시간대로 잡으면
 * 해외에서 화면은 11-05 인데 저장은 11-06 이 되고, 히트맵 · 연속 기록 · '지난 날 일기' 경고가 하루씩 어긋났다.
 * 공용 useDayTick 이 KST 가 되든 말든 여기는 KST 로 맞는다. KST 자정 + 5초에 다시 재고, 화면이 다시 보일 때도 잰다. */

/** 카드로 스크롤 + 반짝 — 홈 카드(focusHomeCard)와 같은 모양(.focus-flash). */
function flashCard(el: HTMLElement) {
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  el.classList.remove("focus-flash");
  void el.offsetWidth; // 같은 카드를 연달아 가도 반짝임이 다시 돌게
  el.classList.add("focus-flash");
}

export default function DecoBook({
  coupleId,
  myUserId = null,
  myName = "",
  partnerName = "",
  onConnect,
  composeReq = 0,
  focusReq = null,
}: {
  coupleId: string | null;
  myUserId?: string | null;
  myName?: string;
  partnerName?: string;
  /** 연결 전 빈 화면의 '커플 연결하러 가기' — 함께 탭으로 보낸다. */
  onConnect?: () => void;
  /** 값이 바뀔 때마다 새 일기 작성 창을 연다(홈 '일기 쓰기'). */
  composeReq?: number;
  /** 활동함 · 알림 → 그 일기 카드로(lib/activity 의 { view: "diary", focus }). ts 가 바뀔 때마다 한 번. */
  focusReq?: { id: string; ts: number } | null;
}) {
  const [entries, setEntries] = useState<DecoEntry[]>([]);
  // 상위에서 아는 uid 를 초기값으로 → 초기 렌더에서 mine/iReacted/작성자필터 오계산 방지
  const uid = myUserId; // page.tsx 확보 uid 직접 사용 (getUser 재조회 제거)
  // null=닫힘 · {entry:null}=새 일기 · {entry}=기존 일기 수정(날짜는 그대로 유지)
  const [editing, setEditing] = useState<{ entry: DecoEntry | null } | null>(null);
  // 홈 '일기 쓰기' → 작성 창 바로 열기. TodayLog 의 captureReq 와 같은 방식 —
  // ref 0 초기화라 첫 마운트에 req>0 이면(=홈 버튼으로 들어옴) 열리고, 탭을 오가도 다시 열리지 않는다.
  const composeReqRef = useRef(0);
  useEffect(() => {
    if (!composeReq || composeReq === composeReqRef.current) return;
    composeReqRef.current = composeReq;
    if (coupleId) setEditing({ entry: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeReq]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [readYear, setReadYear] = useState<string | null>(null);
  const pendingReact = useRef<Set<string>>(new Set()); // 반응 add in-flight 가드
  // ⚠ 목록 로드 실패와 '진짜 0편'을 구분한다 — 구분 안 하면 54편 가진 사용자에게
  // "아직 일기가 없어요"(빈 상태)가 떠서 데이터가 사라진 것처럼 보인다(2026-07-28 리뷰).
  const [loadFailed, setLoadFailed] = useState(false);
  const todayIso = useDayTick(); // 기록의 오늘은 KST(lib/useDayTick) — 해외 기기에서도 저장 날짜와 같다

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
    // uid 는 myUserId prop 으로 이미 초기화됨 — getUser 재조회 불필요
    refresh();
    refreshMeta();
    /* 실시간 [2026-11-06] — 한 행이 바뀌면 그 행만 고친다. 예전엔 반응 하나에도 일기 197편 + 서명 400개를
     * 통째로 다시 받았다. 재연결(resync)과 '이 신호로는 못 고침'만 예전처럼 통째로(400ms 디바운스). */
    let tFull: ReturnType<typeof setTimeout> | null = null;
    let tMeta: ReturnType<typeof setTimeout> | null = null;
    let tRows: ReturnType<typeof setTimeout> | null = null;
    const dirtyIds = new Set<string>();
    const fullSoon = () => {
      if (tFull) clearTimeout(tFull);
      tFull = setTimeout(refresh, 400);
    };
    const metaSoon = () => {
      if (tMeta) clearTimeout(tMeta);
      tMeta = setTimeout(refreshMeta, 400);
    };
    const flushRows = () => {
      tRows = null;
      const ids = [...dirtyIds];
      dirtyIds.clear();
      for (const id of ids)
        getDecoEntry(id)
          .then((row) => {
            if (cancelled) return;
            setEntries((cur) => {
              const rest = cur.filter((x) => x.id !== id);
              return row ? sortEntries([...rest, row]) : rest; // null = 지워졌거나 이제 볼 수 없다
            });
          })
          .catch(fullSoon);
    };
    const unsub = subscribeDeco(coupleId, (p) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as { id?: string } | undefined)?.id;
        if (id) setEntries((cur) => cur.filter((x) => x.id !== id));
        else fullSoon();
        return;
      }
      const id = (p.new as { id?: string } | undefined)?.id;
      if (!id || (p.eventType !== "INSERT" && p.eventType !== "UPDATE")) return fullSoon();
      dirtyIds.add(id);
      if (!tRows) tRows = setTimeout(flushRows, 300);
    });
    const unsubMeta = subscribeEntryInteractions(coupleId, (p) => {
      if (p.table === "entry_reactions") {
        let ok = true;
        setReactions((cur) => {
          const next = applyRowChange(cur, p);
          if (!next) {
            ok = false;
            return cur;
          }
          // 내가 누른 반응의 낙관 레코드(tmp-)는 진짜 행이 오면 뺀다
          const row = p.eventType === "INSERT" ? (p.new as Reaction | undefined) : undefined;
          return row ? next.filter((r) => !(r.id.startsWith("tmp-") && r.entry_id === row.entry_id && r.emoji === row.emoji && r.created_by === row.created_by)) : next;
        });
        if (!ok) metaSoon();
      } else {
        let ok = true;
        setComments((cur) => {
          const next = applyRowChange(cur, p, (c) => c.created_at);
          if (!next) ok = false;
          return next ?? cur;
        });
        if (!ok) metaSoon();
      }
    });
    return () => {
      cancelled = true;
      if (tFull) clearTimeout(tFull);
      if (tMeta) clearTimeout(tMeta);
      if (tRows) clearTimeout(tRows);
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
      const row = await addReaction(coupleId, entryId, emoji);
      // tmp → 실제 row 로 정합. 행을 돌려받았으면 그 한 줄로, 못 받았으면(중복 등) 목록을 다시 받는다
      if (row) setReactions((cur) => [...cur.filter((r) => r.id !== tmpId && r.id !== row.id), row]);
      else setReactions(await listReactions(coupleId));
      // 상대 일기에 반응했을 때만 상대에게 푸시 — 이번에 새로 저장된 반응일 때만(row). 이미 있던 반응(409)에 다시 보내면
      // 같은 알림이 누를 때마다 나갔다(2026-11-13 — 목록이 잘려 이미 단 반응이 안 보이던 때)
      const entry = entries.find((en) => en.id === entryId);
      if (row && entry && entry.created_by !== uid) {
        sendEventPush(coupleId, "interact", `${emoji} 내 일기에 반응이 달렸어요`, entry.title?.trim() || "일기장을 확인해 보세요", undefined, entryId);
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
      const row = await addComment(coupleId, entryId, body.trim());
      // 소켓과 무관하게 즉시 반영 — 돌려받은 행을 바로 넣고, 못 받았으면 목록을 다시 받는다
      if (row) setComments((cur) => applyRowChange(cur, { eventType: "INSERT", new: row }, (c) => c.created_at) ?? cur);
      else setComments(await listComments(coupleId));
      setErr(null);
      // ⚠ 상대의 일기에 단 댓글만 알린다 — 예전엔 내 일기 · 내 비밀일기에 단 댓글까지 상대에게 글 60자를 실어
      // 보냈다(나만 보려던 글이 알림으로 새 나갔다). 함께 보는 상대 일기일 때만, 글은 그 댓글 앞부분만.
      const entry = entries.find((en) => en.id === entryId);
      if (entry && shouldPushComment(entry, uid)) {
        sendEventPush(coupleId, "interact", "💬 새 댓글이 달렸어요", safeSlice(body.trim(), 60), undefined, entryId);
      }
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
      const shown = decoDisplayPaths(e); // 카드가 그리는 경로(썸네일 우선)
      const urls = await resignPaths(shown);
      // 자리를 지킨다(못 받은 칸은 '') — 거르면 편집기의 i 번째 사진이 다른 파일을 가리킨다
      const next = shown.map((p) => urls[p] ?? "");
      if (next.some(Boolean)) setEntries((cur) => cur.map((x) => (x.id === e.id ? { ...x, photo_urls: next } : x)));
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
          // 일기는 오늘(KST)만 쓸 수 있으므로, 지난 날 일기를 지우면 그 날짜로는 다시 못 쓴다
          (e.entry_date !== todayIso
            ? " 지난 날 일기는 다시 쓸 수 없으니, 고치려면 삭제 대신 '수정'을 쓰세요."
            : ""),
        confirmText: "삭제",
        danger: true,
      }))
    )
      return;
    try {
      // 썸네일도 같이 지운다(남기면 고아 파일)
      await deleteDecoEntry(e.id, [...e.photo_paths, ...e.thumb_paths.filter(Boolean)]);
      setEntries((cur) => cur.filter((x) => x.id !== e.id));
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  // 일기책에 넘길 그 해 일기 — 렌더마다 새 배열을 넘기면 반응 하나에도 책 쪽 나누기(bookPages)를 통째로 다시 했다.
  // 빈 사진 칸('')은 여기서 뺀다(책 · 표지는 그릴 주소만 본다).
  const readerEntries = useMemo(
    () =>
      readYear
        ? entries.filter((e) => e.entry_date.startsWith(readYear)).map((e) => ({ ...e, photo_urls: visiblePhotoUrls(e.photo_urls) }))
        : [],
    [entries, readYear],
  );
  // 타이핑/토글마다 전체 엔트리 재계산되지 않도록 의존값별 useMemo (엔트리 수백 개 대비)
  const filtered = useMemo(() => entries.filter((e) => matchesQuery(e, q)), [entries, q]);
  // 목록은 DIARY_PAGE 편씩 — 예전엔 197편을 전부 펼쳐 그려서 탭 하나가 약 24만 px(휴대폰 화면 300장)였다(2026-10-30 UX 점검).
  // 검색어가 바뀌면 처음 DIARY_PAGE 편으로 돌아간다(effect 없이 — 키가 다르면 저장된 개수를 버린다).
  const filterKey = q;
  const [page, setPage] = useState({ key: filterKey, n: DIARY_PAGE });
  const shown = page.key === filterKey ? page.n : DIARY_PAGE;
  const monthTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groupByMonth(filtered)) m.set(g.key, g.items.length);
    return m;
  }, [filtered]);
  const groups = useMemo(() => groupByMonth(filtered.slice(0, shown)), [filtered, shown]);
  const filtering = q.trim() !== "";

  /* 활동함 · 알림 → 그 카드 [F1] — 검색을 풀고, 10편 밖이면 그 편까지 펼친 뒤, 그려지면 스크롤 + 반짝.
   * 목록에 없으면(방금 쓴 글 · 실시간 전) 그 한 편을 읽어 넣는다. 그래도 없으면 지워진 일기라고 알린다. */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const handledFocus = useRef(0);
  function jumpTo(id: string, list: DecoEntry[]) {
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return false;
    setQ("");
    setPage({ key: "", n: Math.max(DIARY_PAGE, Math.ceil((i + 1) / DIARY_PAGE) * DIARY_PAGE) });
    setPendingFocus(id);
    return true;
  }
  useEffect(() => {
    if (!focusReq || loading || handledFocus.current === focusReq.ts) return;
    handledFocus.current = focusReq.ts;
    if (jumpTo(focusReq.id, entries)) return;
    getDecoEntry(focusReq.id)
      .then((row) => {
        if (!row) {
          setErr("그 일기를 찾을 수 없어요. 지워졌을 수 있어요.");
          return;
        }
        const next = sortEntries([...entries.filter((x) => x.id !== row.id), row]);
        setEntries(next);
        jumpTo(row.id, next);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq, loading]);
  useEffect(() => {
    if (!pendingFocus) return;
    const el = document.getElementById(`diary-${pendingFocus}`);
    if (!el) return;
    flashCard(el);
    setPendingFocus(null);
  }, [pendingFocus, groups]);

  const nameOfWriter = (id: string) => (id === uid ? (myName || "나").trim() : (partnerName || "상대").trim());
  async function printBook(year: string) {
    // 새 창은 누른 순간 연다(비동기 뒤에 열면 팝업 차단에 걸린다) → 원본 사진 주소를 받은 뒤 채운다
    const w = window.open("", "_blank");
    if (!w) {
      setErr("새 창이 막혔어요. 팝업을 허용하고 다시 눌러 주세요.");
      return;
    }
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const picked = entries.filter((e) => e.entry_date >= from && e.entry_date <= to);
    let urls: Record<string, string> = {};
    try {
      urls = await signDecoOriginals(picked.flatMap((e) => e.photo_paths));
    } catch {
      /* 사진 없이라도 만든다 */
    }
    const html = diaryBookHtml(
      picked.map((e) => ({ ...e, photo_urls: e.photo_paths.map((p) => urls[p] ?? "").filter(Boolean) })),
      {
        title: `우리의 일기 ${year}`,
        from,
        to,
        nameOf: nameOfWriter,
      },
    );
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
  const years = useMemo(
    () => [...new Set(entries.map((e) => e.entry_date.slice(0, 4)))].sort().reverse(),
    [entries],
  );

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
      query={q}
      onTag={(t) => setQ((cur) => toggleTagQuery(cur, t))}
      onDelete={() => remove(e)}
      onEdit={() => setEditing({ entry: e })}
      onToggleReaction={(emoji) => toggleReaction(e.id, emoji)}
      onComment={(body) => submitComment(e.id, body)}
      onDeleteComment={removeComment}
      onPhotoError={() => recoverPhotos(e)}
    />
  );

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-4">
      {/* 보이는 제목은 없다 — 바로 위 세그먼트가 이미 '일기'라고 말한다(오늘 로그와 같은 방식).
          예전엔 '우리의 기록 → [세그먼트] → 우리의 기록 / 일기장' 으로 제목이 두 겹이었고, 뷰마다
          서체·크기도 달랐다(일기장 24px 본문체 · 사진첩 30px 픽셀체) [2026-09-23 리뷰]. */}
      <h1 className="sr-only">일기장</h1>
      {/* 빈 목록일 땐 카드 안의 '첫 일기 쓰기'가 같은 일을 한다 — 버튼 두 개를 겹쳐 두지 않는다 */}
      {coupleId && (loading || loadFailed || entries.length > 0) && (
        <div className="mb-4 flex items-center justify-end gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => setBookOpen(true)}
              className="tap flex min-h-9 items-center gap-1.5 rounded-full bg-glass px-3.5 py-2 text-sm font-bold text-ink ring-1 ring-line"
            >
              <Icon name="book" size={15} />
              일기책
            </button>
          )}
          <button
            onClick={() => setEditing({ entry: null })}
            className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-md)]"
          >
            <Icon name="pencil" size={15} />
            오늘 쓰기
          </button>
        </div>
      )}

      {/* ⚠ 오류 배너는 목록보다 '위'에 — 아래에 두면 54편 중간에서 실패했을 때 화면 밖이라
          사용자는 아무 일도 안 일어난 것처럼 느낀다(2026-07-28 리뷰 확정) */}
      {err && (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-deep"
        >
          <span className="min-w-0 flex-1">{err}</span>
          <button onClick={() => setErr(null)} aria-label="오류 닫기" className="tap shrink-0 font-bold">
            <Icon name="x" size={14} />
          </button>
        </p>
      )}

      {!coupleId && (
        <ConnectFirst
          icon="book"
          title="커플 연결 후 함께 써요"
          body="둘이 함께 하루를 기록하고 실시간으로 공유돼요."
          onConnect={onConnect}
        />
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
              {/* '지난 오늘의 우리'와 '이번 달 우리 기분'은 기록 › 추억 칸으로 옮겼다(2026-09-24 IA 개편).
                  작년 오늘이 여기(일기만)와 함께 탭(전부)에 두 벌 있었고, 기분 요약도 두 곳에서 따로 셌다. */}
              {/* 검색 */}
              <div className="mb-4 space-y-2.5">
                <div className="flex items-center gap-2 rounded-full bg-glass px-3.5 py-2.5 ring-1 ring-line">
                  <Icon name="search" size={16} className="shrink-0 text-muted" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="일기 검색"
                    placeholder="일기 검색 (낱말 · #태그)"
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
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-2xl bg-glass2 px-4 py-10 text-center text-sm text-muted ring-1 ring-line">
                  {filtering ? "검색 결과가 없어요" : "일기가 없어요"}
                </p>
              ) : (
                /* 월별 타임라인 */
                <div className="space-y-6">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-[var(--bg-1)]/70 px-1 py-1 text-xs font-bold text-muted backdrop-blur">
                        {g.label}{" "}
                        <span className="font-medium text-muted/70">
                          · {monthTotals.get(g.key) ?? g.items.length}
                        </span>
                      </h2>
                      <div className="space-y-4">{g.items.map(renderCard)}</div>
                    </div>
                  ))}
                  {filtered.length > shown && (
                    <button
                      type="button"
                      onClick={() => setPage({ key: filterKey, n: shown + DIARY_PAGE })}
                      className="tap mx-auto flex min-h-11 items-center gap-1.5 rounded-full bg-glass px-5 text-sm font-bold text-ink ring-1 ring-line"
                    >
                      지난 일기 더 보기
                      <span className="text-muted">({filtered.length - shown}편 남음)</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {readYear && (
        <DiaryBookReader
          year={readYear}
          entries={readerEntries}
          names={[(myName || "나").trim(), (partnerName || "").trim()].filter(Boolean).join(" · ")}
          nameOf={nameOfWriter}
          onClose={() => setReadYear(null)}
          onPrint={() => void printBook(readYear)}
        />
      )}
      {bookOpen && (
        <BookSheet years={years} onClose={() => setBookOpen(false)} onOpen={(y) => { setBookOpen(false); setReadYear(y); }} />
      )}

      {editing && coupleId && (
        <DecoEditor
          coupleId={coupleId}
          entry={editing.entry}
          todayIso={todayIso}
          onClose={() => setEditing(null)}
          onSaved={async (closed) => {
            // ⚠ 저장 성공 뒤의 재조회 실패를 삼키면 'DB엔 저장 + 상대에겐 알림 + 내 화면엔 없음'
            // 이 된다(소켓이 살아야만 나중에 뜸). 실패를 배너로 올리고 편집기는 그때만 유지.
            // 저장 중에 이미 닫았으면(closed) 그 사이 다시 연 편집기를 닫지 않는다.
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
              if (!closed) setEditing(null);
            }
          }}
        />
      )}
    </section>
  );
}

/** 댓글 알림을 보낼지 — 상대가 쓴, 둘이 함께 보는 일기에 단 댓글만.
 *  내 일기에 단 댓글은 상대에게 알릴 일이 아니고(내가 쓴 글에 내가 답한 것), 비밀일기(옛 행)는 글이 새 나간다. */
function shouldPushComment(entry: Pick<DecoEntry, "created_by" | "visibility">, uid: string | null): boolean {
  return !!uid && entry.created_by !== uid && entry.visibility === "shared";
}

/* ---------- 일기책 내보내기 [F8] ---------- */
function BookSheet({ years, onClose, onOpen }: { years: string[]; onClose: () => void; onOpen: (year: string) => void }) {
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()));
  useBackClose(onClose);
  return (
    <Sheet
      title="일기책 만들기"
      onClose={onClose}
      footer={
        <button
          onClick={() => onOpen(year)}
          className="w-full rounded-2xl bg-brand py-3.5 font-bold text-white tap shadow-[var(--shadow-md)]"
        >
          책 펼치기
        </button>
      }
    >
      <p className="text-sm text-ink/80">
        고른 해의 일기를 표지 · 차례 · 달별로 묶어 책으로 펼쳐요. 옆으로 밀어 넘겨요. 브라우저에서 열면 책 안의 <b>PDF 저장</b>으로 인쇄용 파일도 만들 수 있어요.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">어느 해</span>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm text-ink outline-none focus:border-rose"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </label>
    </Sheet>
  );
}

/* ---------- 꾸민 페이지 렌더 ---------- */
const DIARY_PAGE = 10;

const REACT_EMOJIS = ["❤️", "😂", "🥹", "👍", "🎉"];

function DecoCard({
  e,
  mine,
  uid,
  myName,
  partnerName,
  reactions,
  comments,
  query,
  onTag,
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
  query: string;
  onTag: (tag: string) => void;
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
  // 보내는 중 가드는 ref 로 — state 는 같은 틱의 두 번째 Enter 가 옛 값(false)을 읽는다(이중 댓글)
  const sendingRef = useRef(false);
  // ⚠ 결과와 무관하게 입력을 비우면 실패 시 쓴 문장이 사라진다 — **성공했을 때만** 비운다.
  // (반응/댓글삭제는 이미 낙관+롤백인데 댓글 추가만 이 계약을 벗어나 있었음 — 2026-07-28 리뷰)
  async function send() {
    const body = c.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const ok = await onComment(body);
    sendingRef.current = false;
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
      id={`diary-${e.id}`}
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
      className={`relative scroll-mt-16 overflow-hidden rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-md)] ${bgClass(e.bg)}`}
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
      {/* 머리 한 줄 — 날짜 · 요일 · 누구의 하루. 예전 '날짜 구름 + 작성자 칩' 두 층이 글 위로 100px 를 먹었다(2026-11-05).
          ⚠ 우상단은 수정·삭제 버튼 자리라 그만큼 비운다. */}
      <div className={`flex items-baseline gap-2 ${mine ? "pr-20" : ""}`}>
        <p className="text-xl font-extrabold leading-none text-ink">{d.getDate()}</p>
        <p className="text-sm font-bold text-rose-deep">{DOW[d.getDay()]}</p>
        <p className="min-w-0 truncate text-xs font-bold text-ink/70">
          {mine ? (myName || "나").trim() : (partnerName || "상대").trim()}의 하루
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap gap-1">
          {e.location && (
            <span className="rounded-full bg-glass px-2.5 py-0.5 text-xs text-ink">
              <MicroIcon k="pin" size={12} className="mr-1" />
              {e.location}
            </span>
          )}
          {e.weather && (
            <span className="rounded-full bg-glass px-2.5 py-0.5 text-xs text-ink/80">
              <Icon name="cloudsun" size={12} className="mr-1 inline" />
              {e.weather}
            </span>
          )}
        </span>
        {e.mood_emoji && <MoodGlyph e={e.mood_emoji} size={32} />}
      </div>

      {e.photo_urls.some(Boolean) && (
        <div className="mt-3 flex gap-2">
          {visiblePhotoUrls(e.photo_urls).map((u, i) => (
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
      {/* 본문은 접지 않고 다 보인다 — 접기(더 보기)는 사용자 판단으로 뺐다(2026-10-30). 길이는 목록을 10편씩 나눠 잡는다. */}
      {e.body && (
        <p className="prose-ko mt-1 whitespace-pre-wrap text-ink/90">
          {e.body}
        </p>
      )}

      {e.stickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {e.stickers.map((s, i) => (
            <MoodGlyph key={i} e={s.emoji} size={32} />
          ))}
        </div>
      )}

      {/* 태그를 누르면 그 태그 일기만 — 예전엔 글자일 뿐이었다 */}
      {e.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.hashtags.map((h) => (
            <button
              key={h}
              onClick={() => onTag(h)}
              aria-pressed={hasTagQuery(query, h)}
              aria-label={`#${h} 태그 일기만 보기`}
              className="tap rounded-full px-1.5 py-0.5 text-xs font-semibold text-rose-deep"
            >
              #{h}
            </button>
          ))}
        </div>
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
              <MoodGlyph e={emoji} size={16} />
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
        {/* ⚠ 보내는 동안 disabled 를 걸면 입력칸이 포커스를 잃어 모바일 키보드가 댓글마다 내려갔다 —
            readOnly 로 글만 잠그고, 막는 건 보내기 버튼(disabled) 쪽이다 */}
        <input
          value={c}
          onChange={(ev) => setC(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key !== "Enter" || isImeEnter(ev)) return;
            ev.preventDefault();
            void send();
          }}
          readOnly={sending}
          aria-label="한 줄 댓글"
          placeholder="한 줄 남기기"
          maxLength={2000}
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-line bg-glass px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40 focus:border-rose read-only:opacity-60"
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
type DiaryForm = {
  location: string;
  mood: string;
  title: string;
  body: string;
  tags: string;
  bg: string;
  stickers: string[];
};
/** 초안 = 글 + 꾸미기. 새 일기는 날짜(date)와 이 일기의 id(재시도 때 같은 행) · 고친 일기는 원본 버전(base). */
type DiaryDraft = DiaryForm & { date?: string; id?: string; base?: string };

const formOf = (entry: DecoEntry | null): DiaryForm => ({
  location: entry?.location ?? "",
  mood: entry?.mood_emoji ?? "",
  title: entry?.title ?? "",
  body: entry?.body ?? "",
  tags: entry ? entry.hashtags.map((h) => `#${h}`).join(" ") : "",
  bg: entry?.bg ?? BGS[0].key,
  stickers: entry ? entry.stickers.map((x) => x.emoji) : [],
});
const sameForm = (a: DiaryForm, b: DiaryForm) =>
  a.location.trim() === b.location.trim() &&
  a.mood === b.mood &&
  a.title.trim() === b.title.trim() &&
  a.body.trim() === b.body.trim() &&
  normalizeTags(a.tags).join(" ") === normalizeTags(b.tags).join(" ") &&
  a.bg === b.bg &&
  a.stickers.join("") === b.stickers.join("");
const pickForm = (d: DiaryDraft): DiaryForm => ({
  location: d.location ?? "",
  mood: d.mood ?? "",
  title: d.title ?? "",
  body: d.body ?? "",
  tags: d.tags ?? "",
  bg: d.bg ?? BGS[0].key,
  stickers: Array.isArray(d.stickers) ? d.stickers : [],
});

/** 편집기를 열 때 **한 번만** 초안을 읽는다 — 예전엔 렌더마다 localStorage 를 파싱해(타이핑마다 최대 10KB),
 *  첫 자동 저장 뒤엔 '복원했어요' 안내가 새 일기마다 떴다. */
function openDraft(coupleId: string, entry: DecoEntry | null, todayIso: string) {
  const key = draftStorageKey("diary", `${coupleId}:${entry?.id ?? "new"}`);
  const original = formOf(entry);
  let restored: DiaryDraft | null = null;
  let stale: DiaryDraft | null = null;
  try {
    let d = loadDraft<DiaryDraft>(localStorage, key);
    if (!entry && !d) {
      // 옛 날짜 키(…:YYYY-MM-DD)에 남은 글 — 새 키로 한 번 옮긴다(자정을 넘겨 못 찾던 초안)
      const old = legacyDraftKey(Object.keys(localStorage), coupleId);
      const v = old ? loadDraft<DiaryDraft>(localStorage, old) : null;
      if (old && v) {
        d = { ...v, date: legacyDraftDate(old) ?? undefined };
        saveDraft(localStorage, key, d);
        clearDraft(localStorage, old);
      }
    }
    if (d && entry) {
      // 다른 기기에서 더 새로 고쳤으면 옛 초안은 버린다(새 글을 덮지 않게)
      if (d.base === entryVersion(entry)) restored = d;
      else clearDraft(localStorage, key);
    } else if (d) {
      if (isStaleDraft(d.date, todayIso)) stale = d;
      else restored = d;
    }
  } catch {
    /* 저장소를 못 쓰면 초안 없이 */
  }
  if (restored && sameForm(pickForm(restored), original)) restored = null;
  return {
    key,
    original,
    restored,
    stale,
    // 어제 초안(stale)의 id 는 쓰지 않는다 — 어제 일기로 이미 들어갔으면 오늘 글이 23505 로 그 일기에 묻혔다(2026-11-11)
    id: restored?.id || crypto.randomUUID(),
  };
}

/** 초안 한 벌 — 고친 일기는 기준 버전(base), 새 일기는 오늘 날짜와 이 일기의 id(재시도 때 같은 행). */
function draftOf(form: DiaryForm, base: DecoEntry | null, todayKey: string, id: string): DiaryDraft {
  return { ...form, ...(base ? { base: entryVersion(base) } : { date: todayKey, id }) };
}

/** 다른 기기에서 지워진 일기의 글 → '새 일기' 초안으로 [2026-11-11]. 예전엔 지워진 일기의 키에 남겨 다시 열 길이 없었다.
 *  이미 쓰던 새 일기 초안이 있으면 덮지 않고 뒤에 붙인다(mergeIntoNewDraft). */
function moveToNewDraft(coupleId: string, form: DiaryForm, todayKey: string): boolean {
  const key = draftStorageKey("diary", `${coupleId}:new`);
  const existing = loadDraft<DiaryDraft>(localStorage, key);
  const merged = mergeIntoNewDraft(existing ? pickForm(existing) : null, form);
  return saveDraft<DiaryDraft>(localStorage, key, {
    ...merged,
    date: existing?.date ?? todayKey,
    id: existing?.id ?? crypto.randomUUID(),
  });
}

/** 같은 일기(새 일기 id · 고칠 일기 id)의 저장 시도 번호 — 저장 중에 닫고 다시 열어 또 저장하면 두 편집기의 저장이 함께 돈다.
 *  늦게 실패한 옛 시도가 새 시도의 초안을 옛 글로 덮지 않게, 실패했을 때 '내가 최신 시도인가'를 본다. */
const saveAttempts = new Map<string, number>();

/** 본문 칸 최대 높이(화면의 45%) — 넘으면 칸 안에서 스크롤. */
const BODY_MAX_VH = 0.45;

function DecoEditor({
  coupleId,
  entry,
  todayIso,
  onClose,
  onSaved,
}: {
  coupleId: string;
  entry: DecoEntry | null; // null=새 일기 · 있으면 수정(날짜 고정)
  todayIso: string;
  onClose: () => void;
  /** closed = 저장 중에 사용자가 이미 닫았다(부모는 목록만 다시 읽고 다른 편집기를 닫지 않는다). */
  onSaved: (closed?: boolean) => void;
}) {
  const isEdit = !!entry;
  // 새 일기는 **오늘(KST)만** 쓴다 — 날짜 선택 불가(지난 날 소급 작성 금지, 2026-07-28).
  // 오늘은 부모의 useDayTick(KST) 이 KST 자정마다 갱신한다(백그라운드 복귀 포함) — 어제 날짜로 저장되는 일이 없다.
  // 수정일 때는 그날의 기록이므로 **원본 날짜를 그대로** 보여주고 바꾸지 않는다.
  const todayKey = todayIso;
  const date = entry ? entry.entry_date : todayKey;
  const [init] = useState(() => openDraft(coupleId, entry, todayKey));
  const draftKey = init.key;
  const [form, setForm] = useState<DiaryForm>(() => (init.restored ? pickForm(init.restored) : init.original));
  const [restoredNote, setRestoredNote] = useState(!!init.restored);
  const [staleDraft, setStaleDraft] = useState<DiaryDraft | null>(init.stale);
  // 새 일기의 id — 어제 초안의 id 는 쓰지 않는다(openDraft). '지우기' · '이어 쓰기'도 새 id(2026-11-11):
  // 어제 id 로 넣으면 23505 로 오늘 글이 사라지고 '새 일기' 알림이 어제 일기를 가리켰다.
  const [draftId, setDraftId] = useState(init.id);
  // 고칠 때의 기준 행(버전 · 사진). 저장이 한 단계씩 성공하면 새 버전으로, 충돌을 받아들이면 최신 행으로 바뀐다.
  const [base, setBase] = useState<DecoEntry | null>(entry);
  const [conflict, setConflict] = useState<DecoEntry | null>(null);
  const [gone, setGone] = useState(false);
  const set = <K extends keyof DiaryForm>(k: K, v: DiaryForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const { location, mood, title, body, tags, bg, stickers } = form;
  const [files, setFiles] = useState<File[]>([]);
  const [keep, setKeep] = useState<string[]>(() => entry?.photo_paths ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 초안이 정말 저장돼 있나 — 복원한 초안이면 이미 저장소에 있다. 예전엔 true 로 시작해
  // '어제 쓰던 글' 배너 동안(자동 저장이 꺼진 채) "이 기기에 초안 저장됨"이 떴다.
  const [draftSaved, setDraftSaved] = useState(!!init.restored);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // 저장 중 · 저장 끝에는 자동 초안 저장을 막는다 — 빠르게 저장하면 400ms 타이머가 clearDraft 뒤에 터져
  // 이미 올린 일기가 초안으로 되살아났고, 다시 열면 같은 글을 한 번 더 올릴 수 있었다.
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const closedRef = useRef(false); // 저장 중에 닫았다 — 저장은 이어서 하고 끝나면 목록만 다시 읽는다
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const photosChanged = isEdit && (keep.length !== (base?.photo_paths.length ?? 0) || files.length > 0);
  const room = Math.max(0, 2 - (isEdit ? keep.length : 0));
  // '바뀐 게 있나' = 원본(새 일기는 빈 칸)과 다른가. 예전엔 고친 일기는 늘 dirty 라 닫을 때마다 확인창이 떴다.
  const formDirty = !sameForm(form, init.original);
  const dirty = formDirty || files.length > 0 || photosChanged;
  // 어제 초안이 아직 저장소에 있다(같은 키) — 글을 바꾸기 전엔 덮지 않는다. 쓰기 시작하면 오늘 글이 그 자리를 차지한다.
  const holdingStale = !!staleDraft && !formDirty;

  // 고른 사진 미리보기 — 주소는 만든 만큼 돌려준다(메모리)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // 본문은 글만큼 자란다 — CSS field-sizing 이 되는 브라우저는 CSS 가, 아니면(iOS 사파리 등) 여기서 높이를 잰다.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * BODY_MAX_VH))}px`;
  }, [body]);

  // 오늘 날씨 한 줄 [F7] — 새 일기만(지난 날 일기에 오늘 날씨를 붙이면 거짓말)
  const place = useWeatherPlace();
  const { cached } = useForecast(place);
  const weather = isEdit ? null : weatherTag(cached?.fc, PLACES[place].name, todayKey, (c) => wmoInfo(c).label);

  function toggleSticker(s: string) {
    setForm((f) => ({
      ...f,
      stickers: f.stickers.includes(s) ? f.stickers.filter((x) => x !== s) : [...f.stickers, s].slice(0, 8),
    }));
  }

  useEffect(() => {
    if (savingRef.current || doneRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (holdingStale) return; // 어제 글을 어떻게 할지 고르기 전 · 글을 바꾸기 전엔 덮지 않는다(표시도 안 한다)
    if (!dirty) {
      // 원본 그대로면 초안을 남기지 않는다 — 고친 일기의 옛 초안이 나중에 다른 기기의 새 글을 덮던 길
      clearDraft(localStorage, draftKey);
      setDraftSaved(true);
      return;
    }
    setDraftSaved(false);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (savingRef.current || doneRef.current) return;
      // 충돌을 고르는 동안엔 최신 버전 위의 초안으로 — 옛 버전으로 쓰면 다시 열 때 openDraft 가 글을 버린다
      setDraftSaved(saveDraft<DiaryDraft>(localStorage, draftKey, draftOf(form, conflict ?? base, todayKey, draftId)));
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftKey, form, dirty, holdingStale, base, conflict, todayKey, draftId]);

  // 배경 오탭 한 번에 장문+사진 초안이 통째로 사라지는 사고 방지 — Letters 의 requestClose 패턴.
  const confirmingRef = useRef(false); // Esc 연타/이중 탭으로 confirm 이 중첩되는 것 방지
  async function requestClose() {
    if (confirmingRef.current) return;
    if (busy) {
      // 저장 중에도 닫을 수 있다 — 각 단계에 시간 제한이 있고, 같은 id 로 다시 보내도 두 편이 되지 않는다(2026-11-11)
      confirmingRef.current = true;
      const ok = await confirmDialog({
        message: "아직 저장하는 중이에요. 닫을까요?",
        detail: "저장은 이어서 해요. 끝내지 못하면 쓰던 글은 이 기기에 초안으로 남아요.",
        confirmText: "닫기",
      });
      confirmingRef.current = false;
      if (!ok) return;
      closedRef.current = true;
      onClose();
      return;
    }
    if (dirty && !gone) {
      confirmingRef.current = true;
      const ok = await confirmDialog({
        message: isEdit ? "고치던 일기를 닫을까요?" : "일기 편집기를 닫을까요?",
        detail: "작성한 글과 꾸미기는 이 기기에 초안으로 남아요. 선택한 사진은 다시 골라야 해요.",
        confirmText: "닫기",
      });
      confirmingRef.current = false;
      if (!ok) return;
    }
    onClose();
  }
  // 뒤로 가기 · iOS 쓸어 넘기기도 같은 가드를 지난다 — 예전엔 페이지를 떠나 고른 사진이 사라졌다.
  // 바뀐 게 없으면 바로 닫고, 있으면 확인창을 띄우고 '안 닫힘'(false)을 돌려 기록을 다시 쌓는다.
  useBackClose(() => {
    if (!dirty && !busy) {
      onClose();
      return;
    }
    void requestClose();
    return false;
  });

  /** over = 충돌을 받아들인 뒤의 기준 행 · 남길 사진(상태 갱신을 기다리지 않고 바로 저장할 때). */
  async function save(over?: { base: DecoEntry; keep: string[] }) {
    if (savingRef.current) return;
    savingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current); // clearDraft 뒤에 타이머가 초안을 되살리지 않게
    timerRef.current = null;
    let cur = over?.base ?? base;
    let keepNow = over?.keep ?? keep;
    const attemptKey = entry?.id ?? draftId;
    const attempt = (saveAttempts.get(attemptKey) ?? 0) + 1;
    saveAttempts.set(attemptKey, attempt);
    // 누르는 순간의 글을 바로 초안에 — 저장 중에 닫거나 앱이 꺼져도 마지막 글자까지 남는다(성공하면 아래에서 지운다)
    if (dirty && !holdingStale) setDraftSaved(saveDraft<DiaryDraft>(localStorage, draftKey, draftOf(form, cur, todayKey, draftId)));
    setBusy(true);
    setErr(null);
    setConflict(null);
    // 사진을 올리며 저장하는 동안 '바쁨' — 새 버전 자동 새로고침 · 탭 닫기가 끊지 않게(lib/busy)
    const endBusy = beginBusy();
    try {
      const patch = {
        title: safeSlice(title.trim(), TITLE_MAX),
        body,
        location: safeSlice(location.trim(), LOCATION_MAX),
        mood_emoji: mood,
        bg,
        hashtags: normalizeTags(tags),
        stickers: stickers.map((emoji) => ({ emoji })),
      };
      if (entry && cur) {
        // 연 때의 버전(updated_at 그대로)일 때만 고친다 — 같은 작성자의 두 기기가 서로 덮던 것(2026-11-11)
        const res = await updateDecoEntry(entry.id, patch, cur.updated_at === undefined ? undefined : { updated_at: cur.updated_at });
        // 글이 들어간 뒤의 행 — 사진 단계가 실패해 다시 눌러도 이 버전에서 이어 간다
        if (res.latest) {
          // 기준 행이 바뀌었다(응답을 잃은 내 저장) — 내가 뺀 사진만 빼고, 편집기가 보여 준 적 없는 사진은 남긴다
          keepNow = rebaseKeep(keepNow, cur.photo_paths, res.latest.photo_paths);
          setKeep(keepNow);
        }
        cur = res.latest ?? { ...cur, updated_at: res.updated_at === undefined ? cur.updated_at : res.updated_at };
        setBase(cur);
        const photosNow = keepNow.length !== cur.photo_paths.length || files.length > 0;
        if (photosNow) await updateDecoPhotos(coupleId, cur, keepNow, files, cur.updated_at === undefined ? undefined : { updated_at: cur.updated_at });
      } else {
        // 같은 id 로 다시 보내면 같은 일기 — 응답을 잃고 다시 눌러도 두 편이 되지 않고, 그 사이 고친 글로 바뀐다
        const savedId = await addDecoEntry(coupleId, { entry_date: date, ...patch, weather }, files, draftId);
        // 일기는 모두 둘이 함께 본다 — 새 일기는 상대에게 알린다(누르면 그 카드로). 수정은 재알림하지 않는다(스팸 방지).
        sendEventPush(
          coupleId,
          "diary",
          "📔 새 일기가 도착했어요",
          title.trim() || safeSlice(body.trim(), 40) || "일기장을 확인해 보세요",
          undefined,
          savedId,
        );
      }
      doneRef.current = true;
      clearDraft(localStorage, draftKey);
      onSaved(closedRef.current);
    } catch (e) {
      if (saveAttempts.get(attemptKey) !== attempt) {
        // 이 일기를 더 새 시도(다시 연 편집기)가 맡았다 — 옛 글로 그 초안을 덮지 않는다
      } else if (e instanceof DiaryGoneError && entry) {
        // 다른 기기에서 지운 일기 — 글은 '새 일기' 초안으로 옮긴다. 이 일기의 키는 다시 열 길이 없다.
        doneRef.current = true; // 지워진 일기에 자동 초안 · 다시 저장을 하지 않는다
        if (moveToNewDraft(coupleId, form, todayKey)) clearDraft(localStorage, draftKey);
        setGone(true);
      } else if (e instanceof DiaryConflictError && entry && !closedRef.current) {
        // 다른 기기가 먼저 고쳤다 — 덮지 않고 고르게 한다. 초안은 최신 버전 위에 둔다(닫았다 열어도 글이 남게)
        setConflict(e.latest);
        setDraftSaved(saveDraft<DiaryDraft>(localStorage, draftKey, draftOf(form, e.latest, todayKey, draftId)));
      } else {
        // 그 밖의 실패(시간 초과 포함) — 마지막 글자까지 초안에(위에서 400ms 타이머를 지웠다)
        setDraftSaved(saveDraft<DiaryDraft>(localStorage, draftKey, draftOf(form, cur, todayKey, draftId)));
      }
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
      if (!doneRef.current) savingRef.current = false;
      setBusy(false);
    }
  }

  /** 충돌 — 그래도 내 글로. 내가 뺀 사진만 빼고, 다른 기기가 더한 사진은 남긴다. */
  function overwrite() {
    const latest = conflict;
    if (!latest) return;
    const nextKeep = rebaseKeep(keep, base?.photo_paths ?? [], latest.photo_paths);
    setBase(latest);
    setKeep(nextKeep);
    void save({ base: latest, keep: nextKeep });
  }
  /** 충돌 — 저장된 글을 불러온다(지금 쓴 글이 있으면 먼저 묻는다). */
  async function takeLatest() {
    const latest = conflict;
    if (!latest) return;
    if (
      formDirty &&
      !(await confirmDialog({ message: "저장된 글로 바꿀까요?", detail: "지금 쓴 글은 사라져요.", confirmText: "바꾸기", danger: true }))
    )
      return;
    setForm(formOf(latest));
    setBase(latest);
    setKeep(latest.photo_paths);
    setConflict(null);
    setErr(null);
  }

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    // 다시 고르면 더한다(예전엔 갈아 끼워 앞에서 고른 사진이 사라졌다). 자리는 합쳐 2장
    setFiles((cur) => [...cur, ...picked].slice(0, room));
    if (fileRef.current) fileRef.current.value = ""; // 같은 사진을 지웠다 다시 고를 수 있게
  }

  // photo_urls 는 photo_paths 와 같은 자리(못 받은 칸은 '') — 그래서 i 번째 주소가 i 번째 파일이다(2026-11-11)
  const keptPhotos = base ? base.photo_paths.map((p, i) => ({ p, u: base.photo_urls[i] ?? "" })).filter((x) => keep.includes(x.p)) : [];

  return (
    <Sheet
      title={isEdit ? "일기 수정" : "일기 쓰기"}
      onClose={() => void requestClose()}
      footer={
        <div className="space-y-2">
          {err && (
            <p role="alert" className="text-xs text-rose-deep">
              {err}
            </p>
          )}
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite">
              {!dirty || holdingStale || gone ? "" : draftSaved ? "이 기기에 초안 저장됨" : "초안 저장 중…"}
            </p>
            <button
              disabled={busy || gone}
              onClick={() => void save()}
              className="shrink-0 rounded-2xl bg-brand px-6 py-3.5 font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {busy ? "저장 중…" : isEdit ? "수정 저장" : "일기장에 남기기"}
            </button>
          </div>
        </div>
      }
    >
      {restoredNote && (
        <p className="flex items-start gap-2 rounded-lg bg-glass2 px-3 py-2 text-xs text-muted ring-1 ring-line">
          <span className="min-w-0 flex-1">이전에 작성하던 초안을 복원했어요. 사진은 보안을 위해 다시 선택해 주세요.</span>
          <button onClick={() => setRestoredNote(false)} aria-label="안내 닫기" className="tap shrink-0">
            <Icon name="x" size={12} />
          </button>
        </p>
      )}
      {conflict && (
        <div role="alert" className="rounded-lg bg-glass2 px-3 py-2 text-xs text-ink ring-1 ring-line">
          <p className="font-bold">다른 기기에서 이 일기를 먼저 고쳤어요</p>
          <p className="mt-0.5 text-muted line-clamp-2">
            지금 저장된 글: {conflict.title || conflict.body || "(글 없음)"}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={overwrite} disabled={busy} className="tap rounded-full bg-brand px-3 py-1.5 font-bold text-white disabled:opacity-50">
              내 글로 저장
            </button>
            <button onClick={() => void takeLatest()} disabled={busy} className="tap rounded-full bg-glass px-3 py-1.5 font-bold text-ink ring-1 ring-line disabled:opacity-50">
              저장된 글 불러오기
            </button>
          </div>
        </div>
      )}
      {staleDraft && (
        <div className="rounded-lg bg-glass2 px-3 py-2 text-xs text-ink ring-1 ring-line">
          <p className="font-bold">어제 쓰던 글이 있어요</p>
          <p className="mt-0.5 text-muted line-clamp-2">
            {staleDraft.title || staleDraft.body || "꾸미기만 해 둔 초안"}
          </p>
          {!holdingStale && (
            // 쓰기 시작하면 오늘 글이 초안 자리를 차지한다 — 어제 글은 이 창을 닫으면 다시 볼 수 없다
            <p className="mt-0.5 text-muted">지금 쓰는 글이 초안으로 저장돼요. 어제 글은 이 창을 닫으면 사라져요.</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={async () => {
                const s = staleDraft;
                // 지금 쓴 글이 있으면 덮기 전에 묻는다(예전엔 말없이 바꿔 썼다)
                if (
                  formDirty &&
                  !(await confirmDialog({ message: "지금 쓴 글을 어제 글로 바꿀까요?", detail: "지금 쓴 글은 사라져요.", confirmText: "바꾸기", danger: true }))
                )
                  return;
                setForm(pickForm(s));
                setStaleDraft(null);
                setDraftId(crypto.randomUUID()); // 오늘 일기는 새 id — 어제 일기와 섞이지 않게
              }}
              className="tap rounded-full bg-brand px-3 py-1.5 font-bold text-white"
            >
              오늘 일기로 이어 쓰기
            </button>
            <button
              onClick={() => {
                if (holdingStale) clearDraft(localStorage, draftKey); // 저장소가 아직 어제 글일 때만 — 오늘 글은 지우지 않는다
                setStaleDraft(null);
                setDraftId(crypto.randomUUID());
              }}
              className="tap rounded-full bg-glass px-3 py-1.5 font-bold text-ink ring-1 ring-line"
            >
              지우기
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* 날짜 = 오늘 고정(선택 불가) — 지난 날 일기 소급 작성 금지.
            날짜는 한 덩어리(shrink-0 + nowrap) — 반반 나누면 375px 에서도 "2026.09.2 / 5"로 꺾였다 [2026-09-25] */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-glass px-3 py-2 text-sm text-ink"
          title={isEdit ? "일기의 날짜는 바꿀 수 없어요(그날의 기록)" : "일기는 오늘 하루만 기록할 수 있어요"}
        >
          <Icon name="calendar" size={14} className="shrink-0 text-rose-deep" />
          <span className="whitespace-nowrap font-semibold tabular-nums">{date.replaceAll("-", ".")}</span>
          <span className="ml-auto shrink-0 text-xs font-bold text-muted">{isEdit ? "그날" : "오늘"}</span>
        </div>
        <input
          value={location}
          onChange={(e) => set("location", e.target.value)}
          aria-label="위치"
          placeholder="위치 (선택)"
          maxLength={LOCATION_MAX}
          className="min-w-0 flex-1 rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
        />
      </div>
      {weather && <p className="-mt-2 text-xs text-muted">오늘 날씨 · {weather} (저장할 때 함께 남아요)</p>}

      <div>
        <p className="mb-1 text-xs font-semibold text-muted">오늘 기분</p>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((e) => (
            <button
              key={e}
              onClick={() => set("mood", mood === e ? "" : e)}
              aria-label={MOOD_LABELS[e] ?? "기분"}
              aria-pressed={mood === e}
              className={`grid h-10 w-10 place-items-center rounded-lg tap ${
                mood === e ? "bg-rose/20 ring-1 ring-rose" : "bg-glass"
              }`}
            >
              <MoodGlyph e={e} size={32} />
            </button>
          ))}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => set("title", e.target.value)}
        aria-label="제목"
        placeholder="제목 (선택)"
        maxLength={TITLE_MAX}
        className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
      />
      {/* 본문은 글만큼 자란다(최대 화면의 45% — 넘으면 칸 안에서 스크롤). field-sizing 이 없는 브라우저는 위 useLayoutEffect 가 잰다 */}
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => set("body", e.target.value)}
        aria-label="본문"
        rows={4}
        maxLength={10000}
        placeholder="오늘 하루를 일기처럼 남겨보세요"
        className="field-sizing-content min-h-28 max-h-[45dvh] w-full resize-none overflow-y-auto rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
      />

      <div>
        <p className="mb-1 text-xs font-semibold text-muted">사진 (최대 2장)</p>
        <div className="flex flex-wrap items-center gap-2">
          {keptPhotos.map((x, i) => (
            <span key={x.p} className="relative">
              {x.u ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.u} alt={`지금 사진 ${i + 1}`} className="h-16 w-16 rounded-xl object-cover ring-1 ring-line" />
              ) : (
                // 주소를 못 받은 사진 — 자리는 지킨다(다른 사진을 대신 보여 주면 '빼기'가 엉뚱한 파일을 지운다)
                <span aria-label={`지금 사진 ${i + 1}(불러오지 못함)`} className="grid h-16 w-16 place-items-center rounded-xl bg-glass2 text-muted ring-1 ring-line">
                  <Icon name="camera" size={16} />
                </span>
              )}
              <button
                onClick={() => setKeep((cur) => cur.filter((p) => p !== x.p))}
                aria-label={`지금 사진 ${i + 1} 빼기`}
                className="tap absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {previews.map((u, i) => (
            <span key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`고른 사진 ${i + 1}`} className="h-16 w-16 rounded-xl object-cover ring-1 ring-line" />
              <button
                onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                aria-label={`고른 사진 ${i + 1} 빼기`}
                className="tap absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {files.length < room && (
            <button
              onClick={() => fileRef.current?.click()}
              className="grid h-16 w-16 place-items-center rounded-xl bg-glass text-xs font-semibold text-rose-deep ring-1 ring-line tap"
            >
              <Icon name="camera" size={18} />
              사진
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => pickFiles(e.target.files)}
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
              // 선택 상태를 링 색으로만 표현하면 스크린리더로는 토글 결과를 알 수 없다(기분 버튼과 동일 패턴)
              aria-pressed={stickers.includes(s)}
              aria-label={`${s} 스티커`}
              className={`grid h-10 w-10 place-items-center rounded-lg tap ${
                stickers.includes(s) ? "bg-rose/20 ring-1 ring-rose" : "bg-glass"
              }`}
            >
              <MoodGlyph e={s} size={32} />
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
              onClick={() => set("bg", b.key)}
              className={`h-8 flex-1 rounded-lg tap ${b.cls} ${
                bg === b.key ? "ring-2 ring-rose-deep" : "ring-1 ring-line"
              }`}
              aria-label={b.label}
              aria-pressed={bg === b.key}
            />
          ))}
        </div>
      </div>

      <input
        value={tags}
        onChange={(e) => set("tags", e.target.value)}
        aria-label="해시태그"
        placeholder={`#해시태그 (공백/쉼표로 구분, 최대 ${MAX_TAGS}개)`}
        maxLength={300}
        className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
      />
    </Sheet>
  );
}
