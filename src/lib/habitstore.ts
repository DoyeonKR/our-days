"use client";

/* 같이 하는 습관 저장소(2026-11-13, README §10.27) — 커플마다 조회 하나 · 구독 하나 · 재시도 줄 하나.
 * 홈 '오늘의 우리'의 습관 카드와 계획 › 습관이 둘 다 마운트돼 있어도 같은 값을 본다(체크가 두 화면에서 어긋나지 않게).
 *
 * · 체크는 낙관적이다 — 누르는 즉시 '보낼 줄'(pending)에 넣고 화면은 서버 값 위에 그 줄을 얹어 그린다(withPending).
 *   보낼 줄은 이 기기에 남겨(localStorage) 앱을 닫았다 열어도 다시 보낸다. 같은 열쇠에 upsert 라 몇 번을 보내도 같다.
 *   길 위의 오류(오프라인 · 5xx)는 1 · 2 · 4 … 30초와 연결 복구 때 다시, 서버가 거절한 것(날짜 창 밖 · 권한)은 버리고 알린다.
 * · 상대의 체크는 실시간(lib/couple 의 다중화 채널)으로 바로 들어온다. resync(재연결 · 채널 교체)면 전부 다시 읽는다.
 * · 섬 하트: 둘 다 오늘 체크한 습관이 보이면(내 저장 성공 · 상대 체크 도착 · 처음 읽기) 서버에서 오늘 줄을 **새로** 읽어
 *   확인한 뒤 섬에 정산한다(settleHabitPay — 같은 열쇠는 두 번 안 준다 · 하루 20). 버전 충돌이면 다시 읽어 또.
 *   두 사람 기기가 동시에 해도 열쇠 링이 한 번만 준다. */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  HABITS_MISSING,
  addHabit,
  deleteHabit,
  habitCheckinsOn,
  listHabitCheckins,
  listHabits,
  saveIsland,
  setHabitCheck,
  subscribeHabits,
  updateHabit,
  type HabitInput,
} from "@/lib/couple";
import { refreshIsland } from "@/lib/islandstore";
import { backoffMs, gameNow, saveErrorKind } from "@/lib/islandsync";
import { kstDate } from "@/lib/kst";
import { useDayTick } from "@/lib/useDayTick";
import { newClientId } from "@/lib/clientid";
import {
  HABIT_MAX,
  bothChecked,
  dayNum,
  settleHabitPay,
  upsertCheckin,
  withPending,
  type Habit,
  type HabitCheckin,
  type PendingCheck,
} from "@/lib/habits";

export type HabitSnap = {
  habits: Habit[];
  /** 서버에서 받은 체크(done 인 줄) — 화면은 view 를 쓴다(보낼 줄을 얹은 것). */
  server: HabitCheckin[];
  pending: PendingCheck[];
  loading: boolean;
  /** 표가 아직 없다(migration 전) — 화면은 습관 칸을 숨긴다. */
  missing: boolean;
  loadError: string | null;
  /** 보내지 못해 버린 체크 · 습관 저장 실패 — 화면 한 줄. */
  error: string | null;
  /** 연결이 끊겨 기다리는 체크가 있다. */
  offline: boolean;
  /** 마지막 하트 정산(화면 한 줄 '+5 하트'). */
  reward: { coins: number; at: number } | null;
};

const EMPTY: HabitSnap = { habits: [], server: [], pending: [], loading: true, missing: false, loadError: null, error: null, offline: false, reward: null };

type Store = {
  coupleId: string;
  me: string;
  partner: string | null;
  snap: HabitSnap;
  listeners: Set<() => void>;
  refs: number;
  unsub: (() => void) | null;
  flushing: boolean;
  retryN: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  settleTimer: ReturnType<typeof setTimeout> | null;
  settling: boolean;
  loadSeq: number;
};

const stores = new Map<string, Store>();
const pendingKey = (s: Pick<Store, "coupleId" | "me">) => `ourdays:habit-pending:v1:${s.coupleId}:${s.me}`;
const today = () => kstDate(gameNow());

function readPending(s: Store): PendingCheck[] {
  try {
    const raw = localStorage.getItem(pendingKey(s));
    const list = raw ? (JSON.parse(raw) as PendingCheck[]) : [];
    // 서버는 KST 오늘 · 어제만 받는다 — 그보다 지난 줄은 보내도 거절이라 버린다
    const floor = dayNum(today()) - 1;
    return Array.isArray(list)
      ? list.filter((p) => p && typeof p.habitId === "string" && typeof p.day === "string" && typeof p.done === "boolean" && dayNum(p.day) >= floor)
      : [];
  } catch {
    return [];
  }
}
function writePending(s: Store): void {
  try {
    if (s.snap.pending.length) localStorage.setItem(pendingKey(s), JSON.stringify(s.snap.pending));
    else localStorage.removeItem(pendingKey(s));
  } catch {
    /* 저장소를 못 쓰면 메모리 줄만 — 화면을 닫기 전엔 그대로 다시 보낸다 */
  }
}

function set(s: Store, patch: Partial<HabitSnap>): void {
  s.snap = { ...s.snap, ...patch };
  s.listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const missingErr = (e: unknown) => (e as { code?: string } | null)?.code === HABITS_MISSING;

async function load(s: Store): Promise<void> {
  const seq = ++s.loadSeq;
  try {
    const [habits, server] = await Promise.all([listHabits(s.coupleId), listHabitCheckins(s.coupleId)]);
    if (seq !== s.loadSeq) return;
    set(s, { habits, server, loading: false, missing: false, loadError: null });
    listen(s);
    void flush(s);
    scheduleSettle(s);
  } catch (e) {
    if (seq !== s.loadSeq) return;
    if (missingErr(e)) {
      set(s, { loading: false, missing: true, loadError: null });
      s.unsub?.();
      s.unsub = null;
    } else {
      set(s, { loading: false, loadError: messageOf(e) });
      listen(s); // 길 위의 오류 — 표는 있다고 보고 붙인다(SUBSCRIBED 의 resync 가 다시 읽는다)
    }
  }
}

async function reloadHabits(s: Store): Promise<void> {
  try {
    set(s, { habits: await listHabits(s.coupleId) });
  } catch {
    /* 다음 resync 에 */
  }
}

function scheduleRetry(s: Store): void {
  if (s.retryTimer || s.refs === 0) return;
  const wait = backoffMs(s.retryN++);
  s.retryTimer = setTimeout(() => {
    s.retryTimer = null;
    void flush(s);
  }, wait);
}

/** 보낼 줄을 앞에서부터 보낸다 — 한 번에 하나(같은 열쇠의 마지막 값이 이긴다). */
async function flush(s: Store): Promise<void> {
  if (s.flushing || s.snap.missing) return;
  s.flushing = true;
  try {
    while (s.snap.pending.length) {
      const p = s.snap.pending[0];
      try {
        await setHabitCheck(s.coupleId, p.habitId, p.day, p.done);
      } catch (e) {
        if (missingErr(e)) return set(s, { missing: true });
        if (saveErrorKind(e) === "network") {
          set(s, { offline: true });
          return scheduleRetry(s);
        }
        // 서버가 거절했다(날짜 창 밖 · 지워진 습관 · 권한) — 다시 보내도 같다. 버리고 화면은 서버 값으로 돌아간다.
        set(s, {
          pending: s.snap.pending.filter((x) => x !== p),
          error: /42501|row-level/i.test(`${(e as { code?: string }).code} ${messageOf(e)}`)
            ? "이 체크는 저장할 수 없어요(어제보다 지난 날이거나 지워진 습관이에요)."
            : messageOf(e),
        });
        writePending(s);
        continue;
      }
      // 보낸 사이에 같은 열쇠를 또 눌렀으면 그 새 값은 남긴다(보낸 것과 같은 객체일 때만 뺀다)
      const mine: HabitCheckin = { habit_id: p.habitId, user_id: s.me, day: p.day, done: p.done };
      set(s, { pending: s.snap.pending.filter((x) => x !== p), server: upsertCheckin(s.snap.server, mine), offline: false });
      writePending(s);
      s.retryN = 0;
      if (p.done) scheduleSettle(s);
    }
  } finally {
    s.flushing = false;
  }
}

function scheduleSettle(s: Store): void {
  if (!s.partner) return; // 혼자 쓰는 공간은 하트 없음
  if (s.settleTimer) clearTimeout(s.settleTimer);
  s.settleTimer = setTimeout(() => {
    s.settleTimer = null;
    void settle(s);
  }, 700);
}

/** 둘 다 오늘 체크한 습관을 섬 하트로 — 서버에서 새로 읽은 줄로만 판정한다. 실패는 조용히(다음 체크 · 다음 열기에 다시). */
async function settle(s: Store): Promise<void> {
  if (s.settling || !s.partner) return;
  const day = today();
  // 화면 값으로 먼저 거른다 — 둘 다 한 습관이 하나도 없으면 서버에 묻지 않는다
  const view = withPending(s.snap.server, s.snap.pending, s.me);
  if (!s.snap.habits.some((h) => bothChecked(view, h.id, day, s.me, s.partner))) return;
  s.settling = true;
  try {
    const fresh = await habitCheckinsOn(s.coupleId, day);
    const ready = s.snap.habits.filter((h) => bothChecked(fresh, h.id, day, s.me, s.partner));
    if (!ready.length) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await refreshIsland(s.coupleId);
      if (!row) return; // 섬이 없다 — 주지 않는다
      const now = today(); // 서버 시각의 오늘 — 폰 날짜로 상한을 다시 열지 못하게
      let state = row.state;
      let coins = 0;
      for (const h of ready) {
        const r = settleHabitPay(state, h.id, day, now, h.name);
        state = r.state;
        coins += r.coins;
      }
      if (state === row.state) return; // 이미 받았거나 상한
      try {
        await saveIsland(s.coupleId, row.version, state);
        const at = Date.now();
        set(s, { reward: { coins, at } });
        setTimeout(() => {
          if (s.snap.reward?.at === at) set(s, { reward: null });
        }, 6000);
        return;
      } catch (e) {
        if (saveErrorKind(e) !== "conflict") return;
        /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 또 */
      }
    }
  } catch {
    /* 오프라인 · 섬 읽기 실패 — 다음 기회에 */
  } finally {
    s.settling = false;
  }
}

function attach(coupleId: string, me: string, partner: string | null): Store {
  const key = `${coupleId}|${me}`;
  let s = stores.get(key);
  if (!s) {
    s = {
      coupleId, me, partner, snap: EMPTY, listeners: new Set(), refs: 0, unsub: null, flushing: false,
      retryN: 0, retryTimer: null, settleTimer: null, settling: false, loadSeq: 0,
    };
    stores.set(key, s);
  }
  s.partner = partner;
  if (s.refs++ === 0) {
    const st = s;
    set(st, { pending: readPending(st), loading: st.snap.habits.length === 0 });
    void load(st);
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
  }
  return s;
}

/** 실시간 구독 — 첫 읽기가 끝난 뒤에만 붙인다. 표가 아직 없는데(migration 전) 다중화 채널에 바인딩을 실으면
 *  그 채널의 다른 구독(쿡 · 일정 · 사진)까지 같이 다시 지어지고 거절될 수 있어서다. 읽기와 구독 사이의 틈은 SUBSCRIBED 의 resync 가 메운다. */
function listen(st: Store): void {
  if (st.unsub || st.refs === 0 || st.snap.missing) return;
  st.unsub = subscribeHabits(st.coupleId, (table, p) => {
    // resync 는 두 바인딩에 다 온다 — 한 번만 다시 읽는다
    if (p.eventType === "resync") return void (table === "habit_checkins" && load(st));
    if (table === "couple_habits") return void reloadHabits(st);
    const row = p.new as Partial<HabitCheckin> | undefined;
    if (!row || typeof row.habit_id !== "string" || typeof row.user_id !== "string" || typeof row.day !== "string") return void load(st);
    const c: HabitCheckin = { habit_id: row.habit_id, user_id: row.user_id, day: row.day, done: row.done !== false };
    set(st, { server: upsertCheckin(st.snap.server, c) });
    if (c.done && c.user_id !== st.me) scheduleSettle(st);
  });
}
function detach(s: Store): void {
  if (--s.refs > 0) return;
  s.unsub?.();
  s.unsub = null;
  if (s.retryTimer) clearTimeout(s.retryTimer);
  s.retryTimer = null;
  if (![...stores.values()].some((x) => x.refs > 0) && typeof window !== "undefined") window.removeEventListener("online", onOnline);
}
function onOnline(): void {
  for (const s of stores.values()) {
    if (s.refs === 0) continue;
    s.retryN = 0;
    if (s.retryTimer) clearTimeout(s.retryTimer);
    s.retryTimer = null;
    void flush(s);
  }
}

function errorText(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === "PT422") return `습관은 ${HABIT_MAX}개까지 만들 수 있어요.`;
  if (code === "23514") return "이름은 1~20자, 목표는 매일 또는 주 1~6회예요.";
  return messageOf(e);
}

/** 습관 저장소 훅 — partner 가 없으면(혼자 쓰는 공간 · 아직 모름) 'both' 는 나 하나로 센다. */
export function useHabits(coupleId: string | null, me: string | null, partner: string | null) {
  const store = useMemo(() => (coupleId && me ? { coupleId, me } : null), [coupleId, me]);
  const subscribe = useCallback(
    (fn: () => void) => {
      if (!store) return () => {};
      const s = attach(store.coupleId, store.me, partner);
      s.listeners.add(fn);
      return () => {
        s.listeners.delete(fn);
        detach(s);
      };
    },
    [store, partner],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => (store ? stores.get(`${store.coupleId}|${store.me}`)?.snap ?? EMPTY : EMPTY),
    () => EMPTY,
  );
  // 화면의 '오늘'도 저장 · 하트와 같은 시계(서버 시각의 KST — gameNow)로 센다. useDayTick 은 자정에 다시 그리게 하는 박자.
  const tick = useDayTick();
  const todayKey = useMemo(() => {
    void tick;
    return today();
  }, [tick]);
  const view = useMemo(() => withPending(snap.server, snap.pending, me), [snap.server, snap.pending, me]);
  const members = useMemo(() => [me, partner].filter((x): x is string => !!x), [me, partner]);

  const s = store ? stores.get(`${store.coupleId}|${store.me}`) ?? null : null;

  const toggle = useCallback(
    (habitId: string, done: boolean) => {
      if (!s) return;
      const d = today();
      const rest = s.snap.pending.filter((p) => !(p.habitId === habitId && p.day === d));
      set(s, { pending: [...rest, { habitId, day: d, done }], error: null });
      writePending(s);
      void flush(s);
    },
    [s],
  );

  const create = useCallback(
    async (input: HabitInput, id: string = newClientId()): Promise<boolean> => {
      if (!s) return false;
      if (s.snap.habits.length >= HABIT_MAX) {
        set(s, { error: `습관은 ${HABIT_MAX}개까지 만들 수 있어요.` });
        return false;
      }
      const now = new Date().toISOString();
      const optimistic: Habit = { id, couple_id: s.coupleId, created_by: s.me, created_at: now, updated_at: now, ...input };
      set(s, { habits: [...s.snap.habits.filter((h) => h.id !== id), optimistic], error: null });
      try {
        await addHabit(s.coupleId, input, id);
        void reloadHabits(s);
        return true;
      } catch (e) {
        set(s, { habits: s.snap.habits.filter((h) => h.id !== id), error: errorText(e) });
        return false;
      }
    },
    [s],
  );

  const update = useCallback(
    async (id: string, input: HabitInput): Promise<boolean> => {
      if (!s) return false;
      const prev = s.snap.habits.find((h) => h.id === id);
      set(s, { habits: s.snap.habits.map((h) => (h.id === id ? { ...h, ...input } : h)), error: null });
      try {
        await updateHabit(id, input);
        return true;
      } catch (e) {
        if (prev) set(s, { habits: s.snap.habits.map((h) => (h.id === id ? prev : h)) });
        set(s, { error: errorText(e) });
        void reloadHabits(s);
        return false;
      }
    },
    [s],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!s) return false;
      const prev = s.snap.habits;
      set(s, { habits: prev.filter((h) => h.id !== id), error: null });
      try {
        await deleteHabit(id);
        // 그 습관의 보낼 줄은 이제 갈 곳이 없다
        set(s, { pending: s.snap.pending.filter((p) => p.habitId !== id), server: s.snap.server.filter((c) => c.habit_id !== id) });
        writePending(s);
        return true;
      } catch (e) {
        set(s, { habits: s.snap.habits.some((h) => h.id === id) ? s.snap.habits : prev, error: errorText(e) });
        return false;
      }
    },
    [s],
  );

  const retry = useCallback(() => {
    if (!s) return;
    set(s, { loading: true, loadError: null });
    void load(s);
  }, [s]);
  const clearError = useCallback(() => {
    if (s) set(s, { error: null });
  }, [s]);

  return { snap, view, members, today: todayKey, toggle, create, update, remove, retry, clearError };
}
