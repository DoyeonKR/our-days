// 커플 연동 + 쿡찌르기 데이터 계층 (Supabase).
// 인증: 이메일+비번 로그인 필수(AuthGate). ensureAnonAuth 는 세션이 없을 때의 폴백일 뿐,
// 실사용에선 항상 이메일 계정 세션이 존재한다(교차기기 연동이 이 uid 로 이어짐).
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  type UrlEntry,
  isFreshUrlEntry,
  parseStoredUrlEntries,
  persistableUrlEntries,
} from "@/lib/urlcache";
import { humanError } from "@/lib/humanError";
import type { IslandState } from "@/lib/island";
import { SOLO_EVENT, clearSoloIsland, getSoloIsland, saveSoloIsland } from "@/lib/soloisland";
import { kstDate } from "@/lib/island";
import { eventRecurrence, type CoupleEvent } from "@/lib/dday";
import { renderImage, resizeImage } from "@/lib/image";
import type { MemorySnapshot } from "@/lib/memories";

export type Couple = {
  id: string;
  invite_code: string;
  start_date: string | null;
  created_by: string;
  created_at: string;
  invite_expires_at?: string | null;
};

export type Member = {
  couple_id: string;
  user_id: string;
  nickname: string | null;
  joined_at: string;
  timezone?: string;
  city_key?: string;
  updated_at?: string;
};

export type Poke = {
  id: string;
  couple_id: string;
  from_user: string;
  kind: string;
  message: string | null;
  created_at: string;
};

export type CoupleState = { couple: Couple; members: Member[] };

/** 쿡 찌르기 프리셋. custom 은 사용자가 문구를 직접 입력. */
export const POKE_KINDS: {
  kind: string;
  emoji: string;
  label: string;
  message: string;
}[] = [
  // ⚠ `kind` 는 **DB(pokes.kind)에 저장된 값**이다. 지난 쿡의 이모지를 `pokeEmoji(kind)` 로
  //   되찾으므로 kind 를 바꾸면 옛 기록이 전부 💌 로 떨어진다 → 라벨·메시지만 바꾼다.
  // ⚠ 메시지에 **이름을 박지 마라.** 프리셋은 둘 다 보내는 것이라, 한쪽 이름이 들어가면
  //   상대가 보낼 때 자기가 자기 이름으로 말하는 꼴이 된다.
  { kind: "poke", emoji: "👉", label: "쿡 찌르기", message: "야르 ~" },
  { kind: "miss", emoji: "🥺", label: "흡수하고싶어", message: "보고싶은 게 아니라 지금 당장 흡수하고 싶다" },
  { kind: "meal", emoji: "🍚", label: "밥 먹었냐", message: "밥 먹었어? 안 먹었으면 압수한다" },
  { kind: "love", emoji: "❤️", label: "섹랑해", message: "섹랑해 나의 아가꼬꼬락지영원귀속왕공주야 ❤️" },
  { kind: "kiss", emoji: "💋", label: "뽀뽀 내놔", message: "지금 당장 뽀뽀해줘 💋 반품 교환 환불 안 된다" },
  { kind: "night", emoji: "😏", label: "오늘 밤 각오해", message: "오늘 밤을 위해 신체개조 진행중이다 😏" },
  { kind: "yaru", emoji: "🫡", label: "야르딱끼마쓰 ~", message: "야르딱끼마쓰 ~ 🫡" },
];

export function pokeEmoji(kind: string): string {
  return POKE_KINDS.find((p) => p.kind === kind)?.emoji ?? "💌";
}

export { isSupabaseConfigured };

/** 익명 로그인 보장 → 현재 user id 반환 (미설정/실패 시 null). */
export async function ensureAnonAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(`익명 로그인 실패: ${error.message}`);
  return data.user?.id ?? null;
}

/** 현재 로그인 user id (없으면 null). */
export async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** 내가 속한 커플 + 구성원. 없으면 null.
 *  RLS(couples_select=is_couple_member)가 '내 커플'만 반환하므로 멤버 임베드로
 *  단 1쿼리 — 기존 3연쇄 쿼리 대비 부팅 왕복 -2 (체감 속도 개선). */
export async function getMyCouple(): Promise<CoupleState | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await ensureAnonAuth();
  if (!uid) return null;

  const { data, error } = await sb
    .from("couples")
    .select("*, couple_members(*)")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(humanError(error.message));
  if (!data) return null;
  const { couple_members, ...couple } = data as Couple & {
    couple_members: Member[];
  };
  return { couple, members: couple_members ?? [] };
}

/** 커플 생성 → 초대코드 발급 (생성자 자동 합류). */
export async function createCouple(
  nickname: string,
  startDate: string | null,
): Promise<Couple> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  await ensureAnonAuth();
  const { data, error } = await sb.rpc("create_couple", {
    p_nickname: nickname,
    p_start: startDate,
  });
  if (error) throw new Error(humanError(error.message));
  return data as Couple;
}

/** 초대코드로 합류. */
export async function joinCouple(code: string, nickname: string): Promise<Couple> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  await ensureAnonAuth();
  const { data, error } = await sb.rpc("join_couple", {
    p_code: code.trim().toUpperCase(),
    p_nickname: nickname,
  });
  if (error) throw new Error(humanError(error.message));
  return data as Couple;
}

/** 기존 초대코드를 즉시 폐기하고 7일짜리 새 코드를 발급한다. */
export async function rotateInviteCode(coupleId: string): Promise<Couple> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  const { data, error } = await sb.rpc("rotate_invite_code", { p_couple: coupleId });
  if (error) throw new Error(humanError(error.message));
  return data as Couple;
}

/** 내 멤버 프로필만 수정하고 서버 값을 다시 받아 확인한다. */
export async function updateMyMemberProfile(
  coupleId: string,
  patch: { nickname?: string; timezone?: string; cityKey?: string },
): Promise<Member> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  const uid = await currentUserId();
  if (!uid) throw new Error("로그인이 필요해요.");
  const values: Record<string, string | null> = {};
  if (patch.nickname !== undefined) values.nickname = patch.nickname.trim() || null;
  if (patch.timezone !== undefined) values.timezone = patch.timezone;
  if (patch.cityKey !== undefined) values.city_key = patch.cityKey;
  const { data, error } = await sb
    .from("couple_members")
    .update(values)
    .eq("couple_id", coupleId)
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw new Error(humanError(error.message));
  return data as Member;
}

/** 공유 '사귄 날' 변경. */
export async function updateCoupleStartDate(
  coupleId: string,
  startDate: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couples")
    .update({ start_date: startDate })
    .eq("id", coupleId);
  if (error) throw new Error(humanError(error.message));
}

/** 커플에서 나가기 (본인 멤버십 삭제). */
export async function leaveCouple(coupleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await sb
    .from("couple_members")
    .delete()
    .eq("couple_id", coupleId)
    .eq("user_id", uid);
  if (error) throw new Error(humanError(error.message));
}

/** 쿡찌르기 보내기. */
/** 쿡찌르기 전송 — **저장된 행을 돌려준다**.
 *
 * ⚠ 예전엔 void 였다. 그러면 화면의 낙관적 말풍선(tmp-…)을 지울 방법이 **실시간 echo 뿐**이라,
 * 실시간이 지연되거나 유실되면 메시지는 저장됐는데도 "전송 중" 이 영원히 남는다
 * (사용자 리포트: "메인 채팅이 전송중이라고 계속 뜸"). 삽입 결과를 그대로 받아 즉시 치환한다.
 */
export async function sendPoke(
  coupleId: string,
  kind: string,
  message: string,
): Promise<Poke | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { data, error } = await sb
    .from("pokes")
    .insert({ couple_id: coupleId, from_user: uid, kind, message })
    .select()
    .single();
  if (error) throw new Error(humanError(error.message));
  return (data as Poke) ?? null;
}

/** 최근 쿡찌르기 목록 (기본 20개, 최신순). */
export async function recentPokes(coupleId: string, limit = 20): Promise<Poke[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pokes")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Poke[];
}

/**
 * 실시간 쿡찌르기 구독. 상대가 보낸 새 poke 를 즉시 콜백.
 * 반환값을 호출하면 구독 해제.
 */
export function subscribePokes(
  coupleId: string,
  onInsert: (poke: Poke) => void,
  /** 재조인 보정(resync) — 채널 교체·재접속 공백에 흘린 쿡을 재조회하라는 신호.
   *  안 받으면 resync 가 조용히 버려져, 보정이 정작 채팅(가장 눈에 띄는 realtime)에만
   *  적용되지 않는다 [리뷰 2026-08-25]. */
  onResync: () => void,
): () => void {
  // realtime 이 엣지케이스(RLS 필터 실패/경쟁)로 new 가 없을 수 있어 가드 — null poke 로 콜백 크래시 방지
  return muxOn(coupleId, "pokes", `couple_id=eq.${coupleId}`, (p) => {
    if (p.eventType === "INSERT" && p.new) onInsert(p.new as Poke);
    else if (p.eventType === "resync") onResync();
  });
}


/** realtime 채널명 — 구독 인스턴스마다 유니크 suffix.
 *  같은 이름 채널에 두 번째 .on() 을 붙이면 "cannot add postgres_changes callbacks
 *  after subscribe()" 크래시가 난다. 동시 마운트(keep-mounted 홈+로그 탭)와
 *  StrictMode 재마운트(removeChannel 은 비동기라 이름이 잠시 살아있음) 둘 다
 *  이름 재사용이 원인 → 인스턴스별 유니크 이름으로 클래스 자체를 봉인. [2026-07-02 장애]
 */
let _chanSeq = 0;
function _chanName(base: string): string {
  return `${base}:${++_chanSeq}`;
}

/* ---------- Realtime 채널 다중화 (Disk IO 절감) ----------
 * 문제: 화면마다 채널을 1개씩 열면(한때 19개) 재접속·재마운트 때마다 join 이 반복돼
 * realtime.subscription 삽입/삭제가 폭증한다(실측 66일: ins/del 각 15,069 · 오토배큠 259회)
 * → WAL 디코딩·구독별 RLS set_config(8.5억 호출)가 무료 티어 Disk IO 예산을 소진.
 * 해법: 커플당 postgres_changes 채널 **1개**에 모든 테이블 바인딩을 싣는다.
 *  - 같은 이름 채널에 subscribe() 후 .on() 추가는 크래시(2026-07-02 장애) →
 *    바인딩 구성이 바뀌면 **새 이름의 채널을 새로 만들어 통째로 교체**(디바운스 250ms).
 *  - 같은 (table,filter) 를 여러 화면이 원하면 바인딩 1개에 콜백만 팬아웃(구독 행도 절약).
 *  - 이벤트는 전부 "*" 로 듣고 콜백에서 eventType 을 거른다(pokes INSERT 등) —
 *    타입 오버로드 단순화 + 같은 테이블의 이벤트별 중복 바인딩 방지.
 *  - presence/broadcast 채널(부루마블 접속표시·테트리스 대결)은 상호작용용이라 그대로 둔다.
 */
export type MuxPayload = { eventType: string; new?: unknown; old?: unknown };
type MuxBinding = { table: string; filter: string; cbs: Set<(p: MuxPayload) => void> };
type MuxEntry = {
  coupleId: string;
  bindings: Map<string, MuxBinding>; // key = `${table}|${filter}`
  /** 이벤트를 실제로 받고 있는 구독 완료 채널. */
  active: ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]> | null;
  /** active 를 유지한 채 서버 SUBSCRIBED 응답을 기다리는 교체 후보. */
  pending: ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]> | null;
  timer: ReturnType<typeof setTimeout> | null;
};
const _mux = new Map<string, MuxEntry>();

function _muxRebuild(entry: MuxEntry): void {
  const sb = getSupabase();
  if (!sb) return;
  const old = entry.active;
  if (entry.bindings.size === 0) {
    entry.active = null;
    if (entry.pending) sb.removeChannel(entry.pending);
    entry.pending = null;
    if (old) sb.removeChannel(old);
    _mux.delete(entry.coupleId);
    return;
  }

  // 아직 붙지 않은 이전 후보는 이벤트를 받은 적이 없으므로 안전하게 폐기한다.
  // active 는 새 후보가 SUBSCRIBED 될 때까지 유지해 채널 0개 구간을 만들지 않는다.
  if (entry.pending) sb.removeChannel(entry.pending);
  let ch = sb.channel(_chanName(`mux:${entry.coupleId}`));
  for (const b of entry.bindings.values()) {
    ch = ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: b.table, filter: b.filter },
      (payload) => {
        // 콜백 하나가 던져도 나머지 리스너는 계속 받아야 한다
        b.cbs.forEach((cb) => {
          try {
            cb(payload as unknown as MuxPayload);
          } catch {
            /* noop */
          }
        });
      },
    );
  }
  /* 최초 조회와 최초 subscribe 사이에도 원자적이지 않은 공백이 있다. 따라서 첫 연결까지
     포함해 **모든 SUBSCRIBED** 에서 resync 한다. 이벤트 증분형(pokes)도 별도 스냅샷을 읽는다. */
  entry.pending = ch;
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;

    // 더 최신 rebuild가 이 후보를 교체했다면 활성 채널로 승격시키지 않는다.
    if (entry.pending !== ch) {
      sb.removeChannel(ch);
      return;
    }

    entry.pending = null;
    entry.active = ch;
    for (const b of entry.bindings.values())
      b.cbs.forEach((cb) => {
        try {
          cb({ eventType: "resync" });
        } catch {
          /* noop — 한 콜백이 던져도 나머지는 계속 */
        }
      });

    // 새 채널이 이벤트를 받을 준비가 된 뒤에만 옛 채널을 제거한다.
    // 잠깐의 중복 수신은 각 소비처의 id 중복 제거/정본 재조회가 흡수한다.
    if (old && old !== ch) sb.removeChannel(old);
  });
}

function _muxSchedule(entry: MuxEntry): void {
  if (entry.timer) clearTimeout(entry.timer);
  // 마운트 러시(홈 진입 시 구독 6~8개)를 1회 재구성으로 합친다
  entry.timer = setTimeout(() => {
    entry.timer = null;
    _muxRebuild(entry);
  }, 250);
}

/** 공유 채널에 (table,filter) 리스너 등록. 반환값 호출로 해제. */
function muxOn(
  coupleId: string,
  table: string,
  filter: string,
  cb: (p: MuxPayload) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  let entry = _mux.get(coupleId);
  if (!entry) {
    entry = { coupleId, bindings: new Map(), active: null, pending: null, timer: null };
    _mux.set(coupleId, entry);
  }
  const key = `${table}|${filter}`;
  let b = entry.bindings.get(key);
  const isNew = !b;
  if (!b) {
    b = { table, filter, cbs: new Set() };
    entry.bindings.set(key, b);
  }
  b.cbs.add(cb);
  if (isNew) _muxSchedule(entry); // 새 (table,filter) 조합일 때만 재구성 — 콜백 추가만으론 채널 유지
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const e = _mux.get(coupleId);
    if (!e) return;
    const bb = e.bindings.get(key);
    if (!bb) return;
    bb.cbs.delete(cb);
    if (bb.cbs.size === 0) {
      e.bindings.delete(key);
      _muxSchedule(e);
    }
  };
}

/** 구성원 변화(합류/탈퇴) 구독 — 대기 화면의 4초 폴링 대체(발행에 couple_members 추가됨). */
export function subscribeMembers(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "couple_members", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 채팅 읽음 표시 (chat_reads) ---------- */

export type ChatRead = { user_id: string; last_read_at: string };

export async function getChatReads(coupleId: string): Promise<ChatRead[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("chat_reads")
    .select("user_id,last_read_at")
    .eq("couple_id", coupleId);
  return (data ?? []) as ChatRead[];
}

/** 내가 채팅을 지금 읽었음(마지막 읽은 시각 갱신). 실패는 조용히(부가 기능).
 *  15초 게이트 — 채팅 화면에 머무는 동안 연타 업서트가 앱 최다 쓰기(실측 upd 1,616)로
 *  Disk IO 를 갉아먹던 것을 코얼레싱. 읽음 표시가 최대 15초 늦는 대신 쓰기가 1/N 로 준다. */
const _lastReadWrite = new Map<string, number>();
export async function markChatRead(coupleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const nowMs = Date.now();
  if (nowMs - (_lastReadWrite.get(coupleId) ?? 0) < 15_000) return;
  const uid = await ensureAnonAuth();
  if (!uid) return;
  // 게이트는 **쓰기가 실제로 성공한 뒤**에만 닫는다 — 인증 폴백/네트워크 실패에서도
  // 먼저 닫으면 '읽음'이 15초 동안 통째로 증발한다(안 읽은 척 배지가 남는다).
  const { error } = await sb
    .from("chat_reads")
    .upsert(
      { couple_id: coupleId, user_id: uid, last_read_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id" },
    );
  if (!error) _lastReadWrite.set(coupleId, Date.now());
}

export function subscribeChatReads(
  coupleId: string,
  onChange: () => void,
): () => void {
  return muxOn(coupleId, "chat_reads", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 쿡찌르기 이모지 반응 (poke_reactions) ---------- */

export type PokeReaction = {
  id: string;
  poke_id: string;
  emoji: string;
  created_by: string;
};

export async function listPokeReactions(coupleId: string): Promise<PokeReaction[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("poke_reactions")
    .select("id,poke_id,emoji,created_by")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as PokeReaction[];
}

export async function addPokeReaction(
  coupleId: string,
  pokeId: string,
  emoji: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("poke_reactions")
    .insert({ couple_id: coupleId, poke_id: pokeId, emoji });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(humanError(error.message));
}

export async function removePokeReaction(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("poke_reactions").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export function subscribePokeReactions(
  coupleId: string,
  onChange: () => void,
): () => void {
  return muxOn(coupleId, "poke_reactions", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 브이로그 댓글 (log_comments) ---------- */

export type LogComment = {
  id: string;
  log_id: string;
  body: string;
  created_by: string;
  created_at: string;
};

export async function listLogComments(coupleId: string): Promise<LogComment[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("log_comments")
    .select("id,log_id,body,created_by,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as LogComment[];
}

export async function addLogComment(
  coupleId: string,
  logId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("log_comments")
    .insert({ couple_id: coupleId, log_id: logId, body });
  if (error) throw new Error(humanError(error.message));
}

export async function deleteLogComment(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("log_comments").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export function subscribeLogComments(
  coupleId: string,
  onChange: () => void,
  _key = "logcomments", // (구) 채널명 충돌 방지용 — 다중화 후엔 불필요, 호출부 호환용으로만 유지
): () => void {
  void _key; // 하위호환 파라미터 소비(다중화 후 미사용)
  return muxOn(coupleId, "log_comments", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 커플 공유 기념일 (couple_events) ---------- */

type EventRow = {
  id: string;
  couple_id: string;
  title: string;
  event_date: string;
  repeat_yearly: boolean;
  recurrence: string | null;
  emoji: string | null;
  category: string | null;
  note: string | null;
  reminder_offsets: number[] | null;
  created_by: string;
  created_at: string;
};

function rowToEvent(r: EventRow): CoupleEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.event_date,
    repeatYearly: r.repeat_yearly,
    recurrence:
      r.recurrence === "monthly" || r.recurrence === "yearly" ? r.recurrence : "none",
    emoji: r.emoji ?? undefined,
    category: r.category === "anniversary" ? "anniversary" : "plan",
    createdBy: r.created_by,
    note: r.note ?? undefined,
    reminderOffsets: r.reminder_offsets ?? [0, 1, 3, 7],
  };
}

/** 커플 공유 기념일 목록 (날짜순). */
export async function listCoupleEvents(coupleId: string): Promise<CoupleEvent[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_events")
    .select("*")
    .eq("couple_id", coupleId)
    .order("event_date");
  if (error) throw new Error(humanError(error.message));
  return (data ?? []).map((r) => rowToEvent(r as EventRow));
}

/** 커플 공유 기념일 추가. */
export async function addCoupleEvent(
  coupleId: string,
  ev: {
    title: string;
    date: string;
    repeatYearly: boolean;
    recurrence?: "none" | "monthly" | "yearly";
    emoji?: string;
    category?: "anniversary" | "plan";
    note?: string;
    reminderOffsets?: number[];
  },
): Promise<CoupleEvent | null> {
  const sb = getSupabase();
  if (!sb) return null;
  await ensureAnonAuth();
  const { data, error } = await sb
    .from("couple_events")
    .insert({
      couple_id: coupleId,
      title: ev.title,
      event_date: ev.date,
      repeat_yearly: ev.repeatYearly,
      recurrence: ev.recurrence ?? (ev.repeatYearly ? "yearly" : "none"),
      emoji: ev.emoji ?? null,
      category: ev.category ?? "plan",
      note: ev.note?.trim() || null,
      reminder_offsets: ev.reminderOffsets ?? [0, 1, 3, 7],
    })
    .select("*")
    .single();
  if (error) throw new Error(humanError(error.message));
  return rowToEvent(data as EventRow);
}

/** 커플 공유 일정 편집. 작성자 id/couple id는 바꾸지 않는다. */
export async function updateCoupleEvent(ev: CoupleEvent): Promise<CoupleEvent | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const recurrence = eventRecurrence(ev);
  const { data, error } = await sb
    .from("couple_events")
    .update({
      title: ev.title,
      event_date: ev.date,
      repeat_yearly: recurrence === "yearly",
      recurrence,
      emoji: ev.emoji ?? null,
      category: ev.category ?? "plan",
      note: ev.note?.trim() || null,
      reminder_offsets: ev.reminderOffsets ?? [0, 1, 3, 7],
    })
    .eq("id", ev.id)
    .select("*")
    .single();
  if (error) throw new Error(humanError(error.message));
  return rowToEvent(data as EventRow);
}

/** 커플 공유 기념일 삭제. */
export async function deleteCoupleEvent(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_events").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 공유 기념일 실시간 구독 (추가/삭제 시 콜백). 반환값 호출로 해제. */
export function subscribeCoupleEvents(
  coupleId: string,
  onChange: () => void,
): () => void {
  return muxOn(coupleId, "couple_events", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 활동함 (DB 트리거가 남긴 durable activity_events) ---------- */

export type ActivityEvent = {
  id: string;
  couple_id: string;
  actor_user: string;
  kind: "poke" | "event" | "photo" | "diary" | "log" | "mood" | "answer" | "bucket";
  entity_id: string | null;
  summary: string | null;
  metadata: { operation?: string };
  created_at: string;
};

export async function listActivityEvents(coupleId: string, limit = 80): Promise<ActivityEvent[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("activity_events")
    .select("id,couple_id,actor_user,kind,entity_id,summary,metadata,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as ActivityEvent[];
}

export async function getMyActivityRead(coupleId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await sb
    .from("activity_reads")
    .select("last_read_at")
    .eq("couple_id", coupleId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error(humanError(error.message));
  return (data as { last_read_at?: string } | null)?.last_read_at ?? null;
}

export async function markActivityRead(coupleId: string, at = new Date().toISOString()): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("activity_reads")
    .upsert({ couple_id: coupleId, user_id: uid, last_read_at: at }, { onConflict: "couple_id,user_id" });
  if (error) throw new Error(humanError(error.message));
}

export function subscribeActivityEvents(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "activity_events", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 커플 공유 사진첩 (couple_photos + Storage) ---------- */

export type Photo = {
  id: string;
  path: string;
  thumbPath: string | null;
  url: string; // 원본(대표/상세)
  thumbUrl: string; // 썸네일(그리드) — 없으면 url 폴백
  created_by: string;
  created_at: string;
};

const PHOTO_BUCKET = "couple-photos";
const _URL_TTL = 3600; // 서명 URL 유효(초)

// 서명 URL 캐시: realtime 갱신마다 전량 재서명→재다운로드하던 것을 방지.
// 같은 URL 을 재사용해야 브라우저 HTTP 캐시가 적중(재다운로드 X).
// ⭐ localStorage 영속화 — 앱 재실행/새로고침에도 TTL 내 같은 URL 재사용
//   → 사진·영상이 네트워크 없이 브라우저 캐시에서 '즉시' 뜬다(체감 속도 핵심).
const _URL_CACHE_LS = "ourdays:signedurls:v1";
const _urlCache = new Map<string, UrlEntry>();
if (typeof window !== "undefined") {
  try {
    for (const [k, v] of parseStoredUrlEntries(
      localStorage.getItem(_URL_CACHE_LS),
      Date.now(),
    ))
      _urlCache.set(k, v);
  } catch {
    /* noop */
  }
}
/** 로그아웃/계정전환 시 호출 — 공용 기기에서 커플 사진·비공개 일기·브이로그 서명URL 잔존 방지. */
export function clearSignedUrlCache(): void {
  _urlCache.clear();
  try {
    localStorage.removeItem(_URL_CACHE_LS);
  } catch {
    /* noop */
  }
}

/** 죽은/만료 의심 URL 무효화 — 미디어 onError 복구 경로가 캐시 히트로 무력화되는 것 방지. */
export function evictSignedUrls(paths: (string | null | undefined)[]): void {
  let changed = false;
  for (const p of paths) {
    if (p && _urlCache.delete(p)) changed = true;
  }
  if (changed) _persistUrlCache();
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function _persistUrlCache() {
  if (typeof window === "undefined") return;
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      // 만료 제거 + 최근 300개만(스토리지 폭주 방지)
      const entries = persistableUrlEntries([..._urlCache.entries()], Date.now());
      localStorage.setItem(_URL_CACHE_LS, JSON.stringify(entries));
    } catch {
      /* noop */
    }
  }, 500);
}

/** 만료 의심 경로 재서명(미디어 onError 자가복구용) — evict 후 새 URL 맵.
 *  ⚠ 전체 목록 재조회 대신 '실패한 항목만' 고치는 좁은 경로다(브라우저 캐시 보존). */
export async function resignPaths(paths: string[]): Promise<Record<string, string>> {
  evictSignedUrls(paths);
  return signPaths(paths);
}

/** 여러 경로를 한 번에 서명(캐시 우선). 유효 잔여 60초 미만이면 재서명. */
async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sb = getSupabase();
  const now = Date.now();
  // 만료 항목 정리(무한 증가 방지) — 장시간 켜둔 PWA 메모리 누수 차단.
  for (const [k, v] of _urlCache) if (v.exp <= now) _urlCache.delete(k);
  const need: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const c = _urlCache.get(p);
    if (isFreshUrlEntry(c, now)) out[p] = c.url;
    else need.push(p);
  }
  if (need.length && sb) {
    // 서명 실패는 silent 빈 셀로 이어지므로 1회 재시도 (transient 회복)
    let { data, error } = await sb.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(need, _URL_TTL);
    if (error || !data) {
      ({ data, error } = await sb.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(need, _URL_TTL));
    }
    (data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) {
        out[s.path] = s.signedUrl;
        _urlCache.set(s.path, { url: s.signedUrl, exp: now + _URL_TTL * 1000 });
      }
    });
    _persistUrlCache();
  }
  return out;
}

/** 사진 업로드: 원본(1600) + 썸네일(480) 두 렌디션을 WebP 로 저장 → 그리드는 썸네일. */
export async function uploadPhoto(coupleId: string, file: File): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const [full, thumb] = await Promise.all([
    // 1280px/0.72 — 모바일 화면(≤430px 폭 ×3 DPR) 체감 동일, 파일은 ~40% 절감(무료 1GB runway 2배)
    renderImage(file, 1280, 0.72),
    renderImage(file, 480, 0.7),
  ]);
  const extOf = (f: File) =>
    (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const stamp = `${new Date().getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${coupleId}/${stamp}.${extOf(full)}`;
  const thumbPath = `${coupleId}/${stamp}.thumb.${extOf(thumb)}`;
  const { error: upErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, full, { upsert: false, contentType: full.type || undefined });
  if (upErr) throw new Error("업로드 실패: " + upErr.message);
  // 썸네일 실패는 치명적이지 않음(그리드가 원본으로 폴백) — best-effort
  const { error: thErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(thumbPath, thumb, { upsert: false, contentType: thumb.type || undefined });
  const { error: metaErr } = await sb
    .from("couple_photos")
    .insert({
      couple_id: coupleId,
      storage_path: path,
      thumb_path: thErr ? null : thumbPath,
    });
  if (metaErr) {
    // 메타 저장이 실패하면 방금 올린 파일은 **영구 고아**가 된다(참조하는 row 가 없어 재시도 불가)
    // → best-effort 정리. (uploadLogVideo/deleteCoupleLog 와 동일 룰)
    const stale = [path, ...(thErr ? [] : [thumbPath])];
    sb.storage.from(PHOTO_BUCKET).remove(stale).catch(() => {});
    throw new Error("사진 저장 실패: " + metaErr.message);
  }
}

/** 커플 사진 목록 (서명 URL 캐시, 최신순). 그리드용 thumbUrl 포함. */
export async function listPhotos(coupleId: string): Promise<Photo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_photos")
    // 쓰는 컬럼만 — *는 couple_id 등 불필요 컬럼까지 실어 나른다(사진 수백 장이면 티가 난다)
    .select("id,storage_path,thumb_path,created_by,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as {
    id: string;
    storage_path: string;
    thumb_path: string | null;
    created_by: string;
    created_at: string;
  }[];
  const allPaths = rows.flatMap((r) => [r.storage_path, r.thumb_path ?? ""]);
  const urls = await signPaths(allPaths);
  return rows.map((r) => ({
    id: r.id,
    path: r.storage_path,
    thumbPath: r.thumb_path,
    url: urls[r.storage_path] ?? "",
    thumbUrl:
      (r.thumb_path && urls[r.thumb_path]) || urls[r.storage_path] || "",
    created_by: r.created_by,
    created_at: r.created_at,
  }));
}

/** 홈 빨랫줄용 최근 사진 N장 — **썸네일만** 서명한다.
 *
 *  listPhotos 는 limit 이 없어 전체 행 + 원본/썸네일 2N 경로를 서명한다. 홈은 72px 폴라로이드라
 *  원본이 필요 없고 사진이 수백 장 쌓이면 첫 화면 비용이 그대로 늘어난다 → 홈 전용 경량 경로.
 *  서명 URL 캐시(_urlCache/localStorage)를 공유하므로 사진첩을 이미 열었다면 서명 호출 0. */
export async function listRecentPhotos(
  coupleId: string,
  limit = 3,
): Promise<{ id: string; url: string; created_at: string; path: string }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_photos")
    .select("id,storage_path,thumb_path,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as {
    id: string;
    storage_path: string;
    thumb_path: string | null;
    created_at: string;
  }[];
  // 썸네일이 없는 옛 사진만 원본으로 폴백 — 그 경우에만 원본을 서명한다.
  const paths = rows.map((r) => r.thumb_path || r.storage_path);
  const urls = await signPaths(paths);
  return rows
    .map((r) => ({
      id: r.id,
      url: urls[r.thumb_path || r.storage_path] ?? "",
      created_at: r.created_at,
      path: r.storage_path,
    }))
    .filter((p) => p.url);
}

/** 고른 경로들의 썸네일 URL — **넘긴 순서 그대로** 돌려준다(빨랫줄 순서 = 고른 순서).
 *  이미 지워진 사진은 조용히 빠진다(고아 경로가 깨진 이미지로 남지 않게). */
export async function photosByPaths(
  coupleId: string,
  paths: string[],
): Promise<{ id: string; url: string; created_at: string; path: string }[]> {
  const sb = getSupabase();
  if (!sb || paths.length === 0) return [];
  const { data, error } = await sb
    .from("couple_photos")
    .select("id,storage_path,thumb_path,created_at")
    .eq("couple_id", coupleId)
    .in("storage_path", paths);
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as {
    id: string;
    storage_path: string;
    thumb_path: string | null;
    created_at: string;
  }[];
  const urls = await signPaths(rows.map((r) => r.thumb_path || r.storage_path));
  const byPath = new Map(rows.map((r) => [r.storage_path, r]));
  return paths
    .map((p) => byPath.get(p))
    .filter((r): r is (typeof rows)[number] => !!r)
    .map((r) => ({
      id: r.id,
      url: urls[r.thumb_path || r.storage_path] ?? "",
      created_at: r.created_at,
      path: r.storage_path,
    }))
    .filter((p) => p.url);
}

/** 사진 삭제 (메타 먼저 → Storage best-effort — 부분실패가 '깨진 참조' 방향이 안 되게). */
export async function deletePhoto(
  id: string,
  path: string,
  thumbPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_photos").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  const paths = [path, ...(thumbPath ? [thumbPath] : [])];
  sb.storage
    .from(PHOTO_BUCKET)
    .remove(paths)
    .then(() => paths.forEach((p) => _urlCache.delete(p)))
    .catch(() => {});
}

/** 단일 경로의 서명 URL (배경/상단 이미지용, 캐시). */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const urls = await signPaths([path]);
  return urls[path] ?? null;
}

/** 사진첩 실시간 구독. */
export function subscribePhotos(
  coupleId: string,
  onChange: () => void,
): () => void {
  return muxOn(coupleId, "couple_photos", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 대표 사진 (커플 공유 cover_path) ---------- */

export async function getCoupleCover(coupleId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("couples")
    .select("cover_path")
    .eq("id", coupleId)
    .single();
  if (error) throw new Error(humanError(error.message));
  return (data as { cover_path: string | null } | null)?.cover_path ?? null;
}

export async function updateCoupleCover(
  coupleId: string,
  path: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couples")
    .update({ cover_path: path })
    .eq("id", coupleId);
  if (error) throw new Error(humanError(error.message));
}

/* ── 홈 빨랫줄에 걸 사진(커플 공유 선택) ───────────────────────
 * 왜 커플 공유인가: 홈 히어로는 '우리 세계'라 둘이 같은 걸 봐야 한다. 로컬에 두면
 * 같은 화면을 보며 이야기할 수 없고 새 기기에서 매번 다시 골라야 한다.
 * cover_path 와 똑같은 방식(컬럼 1개 + 컬럼 단위 grant) — 선례가 이미 스키마에 있다.
 * 비어 있으면(null/빈 배열) 홈이 **최근 N장 자동**으로 폴백한다. */
import { cleanHung, HUNG_MAX } from "./hung";
export { HUNG_MAX };

export async function getCoupleHung(coupleId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couples")
    .select("hung_paths")
    .eq("id", coupleId)
    .single();
  if (error) throw new Error(humanError(error.message));
  const v = (data as { hung_paths: string[] | null } | null)?.hung_paths;
  return Array.isArray(v) ? v.slice(0, HUNG_MAX) : [];
}

/** 선택 저장. 빈 배열이면 null 로 지워 '자동(최근 N장)' 으로 되돌린다. */
export async function updateCoupleHung(coupleId: string, paths: string[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const clean = cleanHung(paths);
  const { error } = await sb
    .from("couples")
    .update({ hung_paths: clean.length ? clean : null })
    .eq("id", coupleId);
  if (error) throw new Error(humanError(error.message));
}

/** couples 행 변경(대표사진 등) 실시간 구독. resync(재조인 보정)도 재조회 신호다. */
export function subscribeCouple(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "couples", `id=eq.${coupleId}`, (p) => {
    if (p.eventType === "UPDATE" || p.eventType === "resync") onChange();
  });
}

/* ---------- 오늘의 질문 ---------- */

export type Answer = { question_id: string; user_id: string; body: string; created_at: string };

/** 해당 질문의 답 목록. RLS 상 '내 답이 있어야' 상대 답이 보인다. */
export async function getAnswers(
  coupleId: string,
  questionId: string,
): Promise<Answer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("qa_answers")
    .select("question_id,user_id,body,created_at")
    .eq("couple_id", coupleId)
    .eq("question_id", questionId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Answer[];
}

/** 커플의 모든 답변(RLS: 내 답 + 내가 답한 질문의 상대 답). 보관함용. */
export async function listAllAnswers(coupleId: string): Promise<Answer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("qa_answers")
    .select("question_id,user_id,body,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Answer[];
}

export async function submitAnswer(
  coupleId: string,
  questionId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // 스키마에 unique(couple_id,question_id,user_id) 필요 — 없으면 upsert 가 insert 로 격하됨
  const { error } = await sb
    .from("qa_answers")
    .upsert(
      { couple_id: coupleId, question_id: questionId, user_id: uid, body },
      { onConflict: "couple_id,question_id,user_id" },
    );
  if (error) throw new Error(humanError(error.message));
}

export function subscribeAnswers(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "qa_answers", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- (삭제됨) 아케이드 · 순위판 · 부루마블 · 테트리스 ----------
 * 2026-08-06 사용자 요청으로 게임 탭을 **우리 섬 + 사냥** 둘만 남기고 정리했다.
 * 컴포넌트/엔진과 함께 이 데이터 계층도 지운다 — 한쪽만 지우면 아무도 안 부르는 코드가 남는다.
 * ⚠ DB 테이블(game_challenges/attempts/daily/ranks/profile, board_games)은 **그대로 뒀다**.
 *   테이블 삭제는 되돌릴 수 없고, 앱이 안 읽으면 비용이 0 이다. 정말 지울 거면 따로 결정한다.
 */
/* ---------- 우리 섬 (지속형 공유 세계) ---------- */

export type IslandRow = {
  couple_id: string;
  state: IslandState;
  version: number;
  updated_by: string | null;
};

/** 커플의 섬 상태. 없으면 null(아직 미생성). */
export async function getIsland(coupleId: string): Promise<IslandRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("couple_island")
    .select("couple_id, state, version, updated_by")
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (error) throw new Error(humanError(error.message));
  return (data as IslandRow) ?? null;
}

/** 섬 생성(커플당 1개·멱등). 초기 state 는 클라(island.createIsland)가 구성. */
export async function createIsland(state: IslandState): Promise<IslandRow> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  await ensureAnonAuth();
  const { data, error } = await sb.rpc("island_create", { p_state: state });
  if (error) throw new Error(humanError(error.message));
  return data as IslandRow;
}

/** 액션 커밋(버전 낙관적 락). stale(40001)은 호출부에서 재조회 후 재시도. */
export async function commitIslandAction(
  version: number,
  state: IslandState,
): Promise<IslandRow> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data, error } = await sb.rpc("island_action", {
    p_expected_version: version,
    p_state: state,
  });
  if (error) throw error; // code 로 stale 판별 → 원본 유지
  return data as IslandRow;
}

export function subscribeIsland(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "couple_island", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ── 섬 저장소 라우팅 — 서버(커플) / 로컬(솔로) 단일 진입점 ──────────
 * [사용자 리포트 2026-08-12 "혼자서라도 할 수 있는게 있었으면"]
 * 화면(IslandGame/HuntGame/BubbleGame/GameArcade/HomePet)은 이 셋만 부른다 —
 * coupleId 가 null 이면 localStorage 섬(soloisland)으로 간다. 저장소가 어디든
 * 엔진과 화면 코드는 같다(엔진이 순수라서 얻는 공짜). */

/** 섬 로드. 커플인데 서버 섬이 없고 **혼자 키우던 섬이 있으면 승격**한다 —
 *  연동했다고 알이 사라지면 그건 벌이다. 승격은 서버 생성이 확인된 뒤에만 로컬을 지운다. */
export async function loadIsland(coupleId: string | null): Promise<IslandRow | null> {
  if (!coupleId) return getSoloIsland();
  const row = await getIsland(coupleId);
  if (row) return row;
  const solo = getSoloIsland();
  if (!solo) return null;
  try {
    const promoted = await createIsland(solo.state);
    /* ⚠ island_create 는 on conflict do nothing 뒤 SELECT 라 **경합에서도 성공**한다 —
       상대가 방금 만든 섬이 돌아올 수 있다. 그때 로컬을 지우면 승격 못 한 솔로 섬이
       사라진다. 정말 **내 insert 가 들어간 경우**에만 지운다: version 1 + updated_by 나
       + **state 가 방금 보낸 솔로 섬**(seed 대조). updated_by 만으론 같은 계정의 다른
       기기가 제 솔로 섬으로 먼저 만든 경우를 못 가른다 — 그때 지우면 이 기기의 섬이
       업로드된 적 없이 사라진다 [리뷰 2026-08-25]. */
    const uid = await ensureAnonAuth();
    if (
      promoted.version === 1 &&
      uid &&
      promoted.updated_by === uid &&
      promoted.state?.seed === solo.state.seed
    )
      clearSoloIsland();
    return promoted;
  } catch {
    // 진짜 실패(네트워크 등) — 서버를 다시 믿는다. 로컬은 보존(삭제보다 안전).
    return getIsland(coupleId).catch(() => null);
  }
}

/** 섬 저장(액션 커밋). 서버는 낙관적 락(충돌 throw), 솔로는 경쟁자가 없어 그냥 저장. */
export async function saveIsland(
  coupleId: string | null,
  version: number,
  state: IslandState,
): Promise<IslandRow> {
  if (!coupleId) return saveSoloIsland(state);
  return commitIslandAction(version, state);
}

/** 섬 변경 구독 — 솔로는 저장 이벤트(같은 탭)를 듣는다. 상대는 없지만 **화면은 여럿**이라
 *  (홈 HomePet ↔ 게임 화면) 구독이 없으면 게임을 하고 돌아온 홈이 낡은 섬을 보여줬다. */
export function watchIsland(coupleId: string | null, onChange: () => void): () => void {
  if (!coupleId) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(SOLO_EVENT, onChange);
    return () => window.removeEventListener(SOLO_EVENT, onChange);
  }
  return subscribeIsland(coupleId, onChange);
}

/** 섬 생성 — 솔로는 로컬에 심는다. */
export async function createIslandFor(coupleId: string | null, state: IslandState): Promise<IslandRow> {
  if (!coupleId) return saveSoloIsland(state);
  return createIsland(state);
}

/* ---------- 오늘의 기분 '오늘 어땠어?' (mood_checkins 복귀 — 2026-07-27) ---------- */
// 커플당 각자 1행 upsert(현재 상태). '오늘' 여부는 updated_at 로 판정(lib/moodPrompt.isTodayMood).
// 옛 무드 체크인의 재미 버전 — 테이블/RLS 는 그대로 재사용(라이브 잔존), realtime 발행 복원됨.

export type Mood = { user_id: string; emoji: string; note: string | null; updated_at: string };

export async function getMoods(coupleId: string): Promise<Mood[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("mood_checkins")
    .select("user_id,emoji,note,updated_at")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Mood[];
}

export async function setMyMood(coupleId: string, emoji: string, note: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // unique(couple_id,user_id) PK — upsert 로 각자 1행 유지
  const { error } = await sb
    .from("mood_checkins")
    .upsert(
      { couple_id: coupleId, user_id: uid, emoji, note: note || null, updated_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id" },
    );
  if (error) throw new Error(humanError(error.message));
}

export function subscribeMoods(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "mood_checkins", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 데코북 (꾸민 일기) ---------- */

export type DecoSticker = { emoji: string };
export type DecoEntry = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  location: string | null;
  mood_emoji: string | null;
  bg: string | null;
  hashtags: string[];
  stickers: DecoSticker[];
  photo_paths: string[];
  photo_urls: string[];
  visibility: string; // 'shared' | 'private'(나만 보기 — RLS 로 작성자만 조회)
  created_by: string;
  created_at: string;
};

export type DecoInput = {
  entry_date: string;
  title: string;
  body: string;
  location: string;
  mood_emoji: string;
  bg: string;
  hashtags: string[];
  stickers: DecoSticker[];
  visibility: "shared" | "private";
};

export async function listDecoEntries(coupleId: string): Promise<DecoEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("deco_entries")
    // 쓰는 컬럼만(couple_id 제외) — 본문·스티커가 커질수록 * 의 낭비가 커진다
    .select("id,entry_date,title,body,location,mood_emoji,bg,hashtags,stickers,photo_paths,visibility,created_by,created_at")
    .eq("couple_id", coupleId)
    // 같은 일기날짜(둘이 같은 날 씀) 안에선 '작성 시각' 역순 — 2차 정렬이 없으면
    // DB 임의 순서라 늦게 쓴 글이 작성자에 따라 아래로 깔리는 문제(2026-07-02 리포트)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as (Omit<DecoEntry, "photo_urls"> & { photo_paths: string[] })[];
  const allPaths = rows.flatMap((r) => r.photo_paths ?? []);
  const urls = await signPaths(allPaths); // 서명 URL 캐시 재사용
  return rows.map((r) => ({
    ...r,
    hashtags: r.hashtags ?? [],
    stickers: (r.stickers ?? []) as DecoSticker[],
    photo_paths: r.photo_paths ?? [],
    photo_urls: (r.photo_paths ?? []).map((p) => urls[p] ?? "").filter(Boolean),
  }));
}

export async function addDecoEntry(
  coupleId: string,
  input: DecoInput,
  files: File[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const paths: string[] = [];
  for (const raw of files.slice(0, 2)) {
    const f = await resizeImage(raw); // 축소·압축
    const ext =
      (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const p = `${coupleId}/deco-${new Date().getTime()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(p, f, { contentType: f.type || undefined });
    if (upErr) throw new Error("사진 업로드 실패: " + upErr.message);
    paths.push(p);
  }
  // 일기는 **오늘만** — 소급 작성 금지(2026-07-28). UI 가 오늘로 고정하지만,
  // 자정을 넘긴 채 열려 있던 화면/오래된 캐시가 어제 날짜를 보내는 것까지 여기서 막는다.
  // ⚠ KST 고정(kstDate) — 기기 시간대를 따르면 여행/시간대 오설정에서 둘의 '오늘'이 갈려
  // 같은 날 쓴 일기가 다른 날짜로 갈라진다(앱의 날짜 규칙은 전부 KST).
  const todayISO = kstDate(Date.now());
  const { error } = await sb.from("deco_entries").insert({
    couple_id: coupleId,
    entry_date: todayISO,
    title: input.title || null,
    body: input.body || null,
    location: input.location || null,
    mood_emoji: input.mood_emoji || null,
    bg: input.bg || null,
    hashtags: input.hashtags,
    stickers: input.stickers,
    photo_paths: paths,
    visibility: input.visibility,
  });
  if (error) {
    // DB insert 실패 시 방금 올린 사진은 고아 파일 → best-effort 정리(deletePhoto 등과 동일 룰)
    if (paths.length) sb.storage.from(PHOTO_BUCKET).remove(paths).catch(() => {});
    throw new Error(humanError(error.message));
  }
}

/** 일기 수정 — 본문/기분/배경/스티커/태그/공개범위. RLS `deco_update` 가 **작성자 본인**만 허용.
 *  ⚠ entry_date 는 절대 바꾸지 않는다: 일기는 '그날의 기록'이고, 오늘만 쓰기(소급 금지) 규칙과
 *  수정을 통한 날짜 이동이 충돌하면 규칙이 무의미해진다. 사진도 여기서 건드리지 않는다. */
export async function updateDecoEntry(
  id: string,
  patch: Omit<DecoInput, "entry_date">,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb
    .from("deco_entries")
    .update({
      title: patch.title || null,
      body: patch.body || null,
      location: patch.location || null,
      mood_emoji: patch.mood_emoji || null,
      bg: patch.bg,
      hashtags: patch.hashtags,
      stickers: patch.stickers,
      visibility: patch.visibility,
    })
    .eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export async function deleteDecoEntry(
  id: string,
  photoPaths: string[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // DB-first: Storage 먼저 지우면 DB delete 실패 시 '사진 깨진 일기 row' 가 남는다.
  // (deletePhoto/deleteCoupleLog 와 동일 룰 — 고아 storage 파일이 깨진 row 보다 낫다.)
  const { error } = await sb.from("deco_entries").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  if (photoPaths.length) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove(photoPaths)
      .then(() => photoPaths.forEach((p) => _urlCache.delete(p)))
      .catch(() => {}); // best-effort — 실패해도 row 는 이미 삭제됨
  }
}

/** 캘린더 표시용 경량 일기 마커 (사진 서명 없음 — 날짜/제목/기분/작성자만).
 *  RLS 가 비밀일기(private)를 작성자에게만 반환하므로 캘린더에도 새지 않음. */
export type DiaryMark = {
  id: string;
  entry_date: string;
  title: string | null;
  mood_emoji: string | null;
  created_by: string;
};

export async function listDiaryMarks(coupleId: string): Promise<DiaryMark[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("deco_entries")
    .select("id,entry_date,title,mood_emoji,created_by")
    .eq("couple_id", coupleId)
    .order("entry_date");
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as DiaryMark[];
}

export function subscribeDeco(
  coupleId: string,
  onChange: () => void,
  _key = "deco", // (구) 채널명 충돌 방지용 — 다중화 후엔 불필요, 호출부 호환용으로만 유지
): () => void {
  void _key; // 하위호환 파라미터 소비(다중화 후 미사용)
  return muxOn(coupleId, "deco_entries", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 커플 버킷리스트 (couple_bucket) ---------- */

export type Bucket = {
  id: string;
  title: string;
  category: string;
  done: boolean;
  done_at: string | null;
  created_by: string;
  created_at: string;
};

/** 버킷 목록 (최신순). */
export async function listBucket(coupleId: string): Promise<Bucket[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_bucket")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Bucket[];
}

/** 버킷 항목 추가. */
export async function addBucket(
  coupleId: string,
  title: string,
  category: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("couple_bucket")
    .insert({ couple_id: coupleId, title, category });
  if (error) throw new Error(humanError(error.message));
}

/** 완료/미완료 토글. */
export async function setBucketDone(id: string, done: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couple_bucket")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 버킷 항목 삭제. */
export async function deleteBucket(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_bucket").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 버킷 실시간 구독 (추가/완료/삭제 시 콜백). */
export function subscribeBucket(coupleId: string, onChange: () => void): () => void {
  return muxOn(coupleId, "couple_bucket", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 일기 반응(이모지) + 댓글 ---------- */

export type Reaction = {
  id: string;
  entry_id: string;
  emoji: string;
  created_by: string;
};
export type Comment = {
  id: string;
  entry_id: string;
  body: string;
  created_by: string;
  created_at: string;
};

/** 커플의 모든 일기 반응 (엔트리별 그룹은 클라에서). */
export async function listReactions(coupleId: string): Promise<Reaction[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("entry_reactions")
    .select("id,entry_id,emoji,created_by")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Reaction[];
}

/** 커플의 모든 일기 댓글 (오래된 순). */
export async function listComments(coupleId: string): Promise<Comment[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("entry_comments")
    .select("id,entry_id,body,created_by,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Comment[];
}

export async function addReaction(
  coupleId: string,
  entryId: string,
  emoji: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("entry_reactions")
    .insert({ couple_id: coupleId, entry_id: entryId, emoji });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(humanError(error.message));
}

export async function removeReaction(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("entry_reactions").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export async function addComment(
  coupleId: string,
  entryId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("entry_comments")
    .insert({ couple_id: coupleId, entry_id: entryId, body });
  if (error) throw new Error(humanError(error.message));
}

export async function deleteComment(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("entry_comments").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 반응·댓글 실시간 구독(두 테이블). 반환값 호출로 해제. */
export function subscribeEntryInteractions(
  coupleId: string,
  onChange: () => void,
): () => void {
  const u1 = muxOn(coupleId, "entry_reactions", `couple_id=eq.${coupleId}`, () => onChange());
  const u2 = muxOn(coupleId, "entry_comments", `couple_id=eq.${coupleId}`, () => onChange());
  return () => {
    u1();
    u2();
  };
}

/* ---------- 오늘의 로그 (couple_logs — 오전/오후 2슬롯) ---------- */

export type CoupleLog = {
  id: string;
  log_date: string; // YYYY-MM-DD
  slot: "am" | "pm";
  body: string | null;
  emoji: string | null;
  video_path: string | null; // 3초 브이로그 (Storage)
  videoUrl: string; // 서명 URL(없으면 "")
  created_by: string;
  created_at: string;
};

/** 최근 로그(sinceIso 이후, 날짜 내림차순) — 영상 서명 URL 포함(캐시 재사용). */
export async function listCoupleLogs(
  coupleId: string,
  sinceIso: string,
): Promise<CoupleLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_logs")
    .select("id,log_date,slot,body,emoji,video_path,created_by,created_at")
    .eq("couple_id", coupleId)
    .gte("log_date", sinceIso)
    .order("log_date", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as Omit<CoupleLog, "videoUrl">[];
  const urls = await signPaths(rows.map((r) => r.video_path ?? ""));
  return rows.map((r) => ({
    ...r,
    videoUrl: (r.video_path && urls[r.video_path]) || "",
  }));
}

/** 추억/월간 리캡용 경량 원본. 미디어는 표시 대상으로 고른 뒤에만 서명한다. */
export async function listMemorySnapshot(coupleId: string): Promise<MemorySnapshot> {
  const sb = getSupabase();
  if (!sb) return { diaries: [], photos: [], logs: [], answers: [] };
  const [diaries, photos, logs, answers] = await Promise.all([
    sb
      .from("deco_entries")
      .select("id,entry_date,title,body,mood_emoji,photo_paths,created_by")
      .eq("couple_id", coupleId),
    sb
      .from("couple_photos")
      .select("id,storage_path,thumb_path,created_by,created_at")
      .eq("couple_id", coupleId),
    sb
      .from("couple_logs")
      .select("id,log_date,body,emoji,created_by,created_at")
      .eq("couple_id", coupleId),
    sb
      .from("qa_answers")
      .select("id,question_id,body,user_id,created_at")
      .eq("couple_id", coupleId),
  ]);
  const failed = [diaries, photos, logs, answers].find((result) => result.error);
  if (failed?.error) throw new Error(humanError(failed.error.message));
  return {
    diaries: (diaries.data ?? []) as MemorySnapshot["diaries"],
    photos: (photos.data ?? []) as MemorySnapshot["photos"],
    logs: (logs.data ?? []) as MemorySnapshot["logs"],
    answers: (answers.data ?? []) as MemorySnapshot["answers"],
  };
}

/** 3초 영상 업로드 → storage 경로 반환. */
export async function uploadLogVideo(
  coupleId: string,
  blob: Blob,
  ext: "mp4" | "webm",
): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const path = `${coupleId}/log-${new Date().getTime()}-${Math.random()
    .toString(36)
    .slice(2, 7)}.${ext}`;
  // contentType 은 ';codecs=...' 를 떼고 base MIME 만 — 버킷 allowed_mime_types 매칭 안전
  const contentType = (blob.type || `video/${ext}`).split(";")[0].trim();
  const { error } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType });
  if (error) throw new Error("영상 업로드 실패: " + error.message);
  return path;
}

/** 슬롯 로그 작성/수정 — 슬롯당 1개(unique) 라 upsert. 기존 영상 교체 시 옛 파일 정리. */
export async function upsertCoupleLog(
  coupleId: string,
  dateIso: string,
  slot: "am" | "pm",
  body: string,
  emoji: string | null,
  videoPath: string | null,
  prevVideoPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // 스키마에 unique(couple_id,created_by,log_date,slot) 필요 — 없으면 upsert 가 insert 로 격하됨
  const { error } = await sb.from("couple_logs").upsert(
    {
      couple_id: coupleId,
      created_by: uid,
      log_date: dateIso,
      slot,
      body: body || null,
      emoji,
      video_path: videoPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "couple_id,created_by,log_date,slot" },
  );
  if (error) throw new Error(humanError(error.message));
  // 영상 교체/제거 시 옛 파일은 best-effort 정리(용량 관리)
  if (prevVideoPath && prevVideoPath !== videoPath) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove([prevVideoPath])
      .then(() => _urlCache.delete(prevVideoPath))
      .catch(() => {});
  }
}

export async function deleteCoupleLog(
  id: string,
  videoPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // DB 행 먼저(실패 시 파일 보존 — '행은 있는데 영상 깨짐' 방지). 파일은 best-effort.
  const { error } = await sb.from("couple_logs").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  if (videoPath) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove([videoPath])
      .then(() => _urlCache.delete(videoPath))
      .catch(() => {});
  }
}

export function subscribeCoupleLogs(
  coupleId: string,
  onChange: () => void,
  _key = "clogs", // (구) 채널명 충돌 방지용 — 다중화(muxOn 콜백 팬아웃) 후엔 불필요, 호출부 호환용
): () => void {
  void _key; // 하위호환 파라미터 소비(다중화 후 미사용)
  return muxOn(coupleId, "couple_logs", `couple_id=eq.${coupleId}`, () => onChange());
}

/* ---------- 홈 '우리 현황' (스트릭 + 이번 주) 통합 조회 ---------- */

export type WeekStats = { diaries: number; vlogs: number; photos: number; answers: number };

/** 홈 우리 현황 1회 조회 — deco/logs 를 90일치 한 번만 읽어 스트릭(활동일)과 주간 개수를
 *  모두 산출한다. deco/logs 중복 조회 제거(스트릭 2 + 주간 4 = 6쿼리 → 4쿼리).
 *  photos/qa 는 주간 count 만 필요. 실패는 조용히(홈을 막지 않음). */
export async function homeActivity(
  coupleId: string,
  since90Iso: string,
  since7Iso: string,
): Promise<{ activeDays: string[]; week: WeekStats }> {
  const sb = getSupabase();
  const empty = {
    activeDays: [] as string[],
    week: { diaries: 0, vlogs: 0, photos: 0, answers: 0 },
  };
  if (!sb) return empty;
  // since7Iso 는 KST 날짜 — 'Z'(UTC 자정)를 붙이면 창이 9시간 늦게 열려
  // KST 00:00~09:00 의 사진·답변이 주간 집계에서 빠진다. KST 자정으로 고정.
  const since7Ts = `${since7Iso}T00:00:00+09:00`;
  const head = { count: "exact" as const, head: true };
  const [deco, logs, photos, qa] = await Promise.all([
    sb.from("deco_entries").select("entry_date").eq("couple_id", coupleId).gte("entry_date", since90Iso),
    sb.from("couple_logs").select("log_date").eq("couple_id", coupleId).gte("log_date", since90Iso),
    sb.from("couple_photos").select("id", head).eq("couple_id", coupleId).gte("created_at", since7Ts),
    sb.from("qa_answers").select("question_id", head).eq("couple_id", coupleId).gte("created_at", since7Ts),
  ]);
  const decoRows = (deco.data ?? []) as { entry_date: string }[];
  const logRows = (logs.data ?? []) as { log_date: string }[];
  const days = new Set<string>();
  for (const r of decoRows) days.add(r.entry_date);
  for (const r of logRows) days.add(r.log_date);
  return {
    activeDays: [...days],
    week: {
      // ISO 'YYYY-MM-DD' 는 사전식 비교로 날짜 비교 성립
      diaries: decoRows.filter((r) => r.entry_date >= since7Iso).length,
      vlogs: logRows.filter((r) => r.log_date >= since7Iso).length,
      photos: photos.count ?? 0,
      answers: qa.count ?? 0,
    },
  };
}
