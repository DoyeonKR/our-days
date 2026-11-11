/* 커플 조회 상태 — '조회 실패'와 '커플 없음'을 가른다. [2026-11-11]
 *
 * 오프라인으로 앱을 열면 getMyCouple 이 던졌는데(ensureAnonAuth 는 오프라인이면 던지고, null 은 백엔드가 없는 로컬 모드뿐)
 * page.tsx 는 그걸 삼키고 한 번만 물었다 — 연결이 돌아와도 coupleId 가 null 로 남아 기록 화면마다 '혼자 시작하기 ·
 * 커플 연결하기'가 떴고, 함께 탭(CoupleSync)도 같은 실패에서 '커플 만들기' 메뉴로 떨어졌다(누르면 두 번째 공간이 생긴다).
 *
 * - 상태: pending(아직 모름) · ok(마지막 조회가 답을 받았다 — 커플이든 없음이든) · failed(마지막 조회가 실패했다).
 *   getMyCouple 이 매번 적는다. 빈 화면(ConnectFirst)은 ok 일 때만 '혼자 시작하기'를, 아니면 '연결 확인 중'을 그린다.
 * - 다시 묻기: keepRetrying — 실패하면 2 · 4 · 8 … 60초 뒤, 그리고 연결 복구(online) · 앱으로 돌아올 때(visible) 바로.
 * - 마지막으로 알던 공간: CoupleSync 가 연결될 때 적어 두는 `ourdays:couple`({id, code}). 조회가 실패하면 그 id 로 화면을 이어 간다.
 *   ⚠ 키는 auth.ts 의 로그아웃 정리와 같은 문자열이다(로그아웃하면 지운다 — 다음 계정이 옛 공간을 쓰지 않게).
 * 결과 캐시가 아니다 — 상태 한 단어와 id 만 든다(couplededup.test: getMyCouple 은 결과를 들고 있지 않는다).
 * node --test 가 읽는다 — 다른 모듈을 부르지 않는다. */

export type CoupleLookup = "pending" | "ok" | "failed";

let status: CoupleLookup = "pending";
const subs = new Set<() => void>();

/** getMyCouple 이 조회가 끝날 때마다 부른다. */
export function markCoupleLookup(next: CoupleLookup): void {
  if (status === next) return;
  status = next;
  for (const fn of [...subs]) fn();
}

export function coupleLookupStatus(): CoupleLookup {
  return status;
}

/** useSyncExternalStore 용 구독. */
export function onCoupleLookup(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/* ── 마지막으로 알던 공간(이 기기) ─────────────────────────────────────────── */

export const LS_COUPLE = "ourdays:couple";

type Stored = { id?: unknown; code?: unknown };
function readStored(): Stored | null {
  try {
    const r = JSON.parse(localStorage.getItem(LS_COUPLE) ?? "null") as Stored | null;
    return r && typeof r === "object" ? r : null;
  } catch {
    return null;
  }
}

/** 연결된 공간을 기억한다(세션이 풀렸을 때 '다시 연결' · 오프라인 부팅에 쓴다). */
export function rememberCouple(c: { id: string; invite_code: string }): void {
  try {
    localStorage.setItem(LS_COUPLE, JSON.stringify({ id: c.id, code: c.invite_code }));
  } catch {
    /* 저장 공간 없음 · 프라이빗 — 기억만 못 한다 */
  }
}

export function lastKnownCoupleId(): string | null {
  const r = readStored();
  return typeof r?.id === "string" && r.id ? r.id : null;
}

export function lastKnownCoupleCode(): string | null {
  const r = readStored();
  return typeof r?.code === "string" && r.code ? r.code : null;
}

/** 스스로 떠났을 때만 지운다(비자발 상실은 '다시 연결' 버튼을 위해 남긴다). */
export function forgetCouple(): void {
  try {
    localStorage.removeItem(LS_COUPLE);
  } catch {
    /* noop */
  }
}

/* ── 다시 묻기 ─────────────────────────────────────────────────────────────── */

export const COUPLE_RETRY_BASE_MS = 2_000;
export const COUPLE_RETRY_MAX_MS = 60_000;

/** n 번째 실패 뒤 기다릴 시간 — 2 · 4 · 8 · 16 · 32 · 60 · 60 … 초. */
export function coupleRetryDelay(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(COUPLE_RETRY_MAX_MS, COUPLE_RETRY_BASE_MS * 2 ** Math.min(n, 10));
}

export type RetryEnv = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  /** 'online' · 'visible'(앱으로 돌아옴)을 듣는다. 끊는 함수를 돌려준다. */
  listen: (fn: (why: "online" | "visible") => void) => () => void;
  visible: () => boolean;
};

function browserEnv(): RetryEnv {
  return {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
    listen: (fn) => {
      if (typeof window === "undefined") return () => {};
      const online = () => fn("online");
      const vis = () => {
        if (document.visibilityState === "visible") fn("visible");
      };
      window.addEventListener("online", online);
      document.addEventListener("visibilitychange", vis);
      return () => {
        window.removeEventListener("online", online);
        document.removeEventListener("visibilitychange", vis);
      };
    },
    visible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
  };
}

/** run 이 실패하는 동안 다시 부른다(성공하면 멈춘다 — 다음 kick 까지).
 *  - kick(): 지금 다시(기다리던 타이머는 취소). 도는 중이면 끝난 뒤 한 번 더.
 *  - 실패하면 coupleRetryDelay 뒤 · 연결 복구 · 앱 복귀 때 바로. 화면이 숨어 있으면 타이머는 미루고 돌아올 때 묻는다.
 *  - stop(): 타이머 · 듣기를 다 푼다(effect 정리). */
export function keepRetrying(run: () => Promise<unknown>, env: RetryEnv = browserEnv()): { kick: () => void; stop: () => void; failing: () => boolean } {
  let timer: unknown = null;
  let attempt = 0;
  let failing = false;
  let running = false;
  let again = false;
  let stopped = false;

  const clear = () => {
    if (timer !== null) env.clearTimeout(timer);
    timer = null;
  };
  const kick = () => {
    if (stopped) return;
    clear();
    if (running) {
      again = true;
      return;
    }
    running = true;
    let ok = false;
    run()
      .then(
        () => {
          ok = true;
        },
        () => {},
      )
      .finally(() => {
        running = false;
        if (stopped) return;
        if (ok) {
          failing = false;
          attempt = 0;
        } else {
          failing = true;
          const wait = coupleRetryDelay(attempt);
          attempt += 1;
          timer = env.setTimeout(() => {
            timer = null;
            if (env.visible()) kick(); // 숨어 있으면 돌아올 때(visible) 묻는다
          }, wait);
        }
        if (again) {
          again = false;
          kick();
        }
      });
  };
  const unlisten = env.listen(() => {
    if (failing) kick();
  });
  return {
    kick,
    stop: () => {
      stopped = true;
      clear();
      unlisten();
    },
    failing: () => failing,
  };
}
