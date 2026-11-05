/* 공유 섬 캐시의 몸통(순수 — 저장소 · 구독을 인자로 받는다). 배선은 lib/islandstore. (2026-11-06 게임 리뷰)
 *
 * 예전엔 홈 펫 · 게임 허브 · 섬 화면이 각자 구독하고 각자 다시 받았다 — 저장 한 번(내 저장의 메아리 포함)에
 * 기기마다 섬 상태 전체를 2~3번 내려받았다. 이제는:
 *   · 구독은 커플마다 하나(첫 구독자가 열고 마지막이 닫는다).
 *   · 들어온 변경의 버전이 캐시보다 크지 않으면 다시 받지 않는다(내 저장의 메아리 · 이미 본 버전).
 *   · 저장 응답 · 다른 화면이 받은 행은 adopt 로 바로 캐시에 들어간다.
 *   · 네트워크 오류는 '섬 없음'이 아니다 — 캐시를 지키고 error 로 알린다.
 */

export type CacheRow<S = unknown> = { couple_id: string; state: S; version: number; updated_by: string | null };
export type Change = { eventType: string; new?: unknown; old?: unknown };
export type IslandSnap<R> = {
  row: R | null;
  /** 한 번이라도 답을 받았나 — false 면 아직 모른다(빈 화면 ≠ 섬 없음) */
  loaded: boolean;
  /** 마지막으로 받으려던 시도가 실패했나(캐시는 그대로) */
  error: boolean;
};
export type CacheDeps<R> = {
  load: (coupleId: string | null) => Promise<R | null>;
  watch: (coupleId: string | null, onChange: (p?: Change) => void) => () => void;
};

/** 더 새 행만 받는다 — 같은 버전은 같은 상태다(낙관적 락이 저장마다 버전을 올린다). */
export function isNewerRow(row: { version: number }, cur: { version: number } | null): boolean {
  return !cur || row.version > cur.version;
}

/** realtime 이 실어 온 행이 통째로 왔나 — 큰 행은 값이 빠진 채 올 수 있어 그땐 다시 받는다. */
export function fullRow<R extends CacheRow>(v: unknown): R | null {
  const r = v as Partial<CacheRow> | null | undefined;
  const st = r?.state as { pet?: unknown; farm?: unknown; log?: unknown } | undefined;
  if (!r || typeof r.version !== "number" || typeof r.couple_id !== "string") return null;
  if (!st || typeof st !== "object" || !st.pet || !st.farm || !Array.isArray(st.log)) return null;
  return { couple_id: r.couple_id, state: r.state, version: r.version, updated_by: r.updated_by ?? null } as R;
}

/** 들어온 변경 하나 — 버리기 · 그대로 받기 · 다시 받기. */
export function changeAction(p: Change | undefined, cached: { version: number } | null): "skip" | "adopt" | "refresh" {
  if (!p || p.eventType === "resync" || p.eventType === "DELETE") return "refresh";
  const v = (p.new as { version?: unknown } | undefined)?.version;
  if (typeof v === "number" && cached && v <= cached.version) return "skip";
  return fullRow(p.new) ? "adopt" : "refresh";
}

type Entry<R> = {
  coupleId: string | null;
  snap: IslandSnap<R>;
  subs: Set<(s: IslandSnap<R>) => void>;
  unwatch: (() => void) | null;
  inflight: Promise<R | null> | null;
  again: boolean;
  /** 캐시 행을 갈아 끼운 횟수 — 받는 도중에 저장 응답이 들어왔는지 가른다 */
  seq: number;
};

export function createIslandCache<R extends CacheRow>(deps: CacheDeps<R>) {
  const entries = new Map<string, Entry<R>>();
  const entryOf = (coupleId: string | null): Entry<R> => {
    const key = coupleId ?? "solo";
    let e = entries.get(key);
    if (!e) {
      e = { coupleId, snap: { row: null, loaded: false, error: false }, subs: new Set(), unwatch: null, inflight: null, again: false, seq: 0 };
      entries.set(key, e);
    }
    return e;
  };
  const publish = (e: Entry<R>, next: IslandSnap<R>) => {
    if (next.row === e.snap.row && next.loaded === e.snap.loaded && next.error === e.snap.error) return;
    if (next.row !== e.snap.row) e.seq++;
    e.snap = next;
    e.subs.forEach((cb) => {
      try {
        cb(next);
      } catch {
        /* 구독자 하나가 던져도 나머지는 받는다 */
      }
    });
  };

  /** 저장 응답 · 받은 행을 캐시에 — 버전이 더 클 때만. */
  const adopt = (coupleId: string | null, row: R) => {
    const e = entryOf(coupleId);
    if (isNewerRow(row, e.snap.row)) publish(e, { row, loaded: true, error: false });
    else if (!e.snap.loaded || e.snap.error) publish(e, { ...e.snap, loaded: true, error: false });
  };

  /** 다시 받기 — 같은 커플의 동시 요청은 하나로, 도는 중에 또 부르면 끝난 뒤 한 번 더.
   *  ⚠ 실패는 던진다(캐시는 그대로, error 표시). 진짜로 섬이 없을 때만 null. */
  const refresh = (coupleId: string | null): Promise<R | null> => {
    const e = entryOf(coupleId);
    if (e.inflight) {
      e.again = true;
      return e.inflight;
    }
    const run = (async () => {
      try {
        do {
          e.again = false;
          const seq = e.seq;
          const row = await deps.load(coupleId);
          // 받는 사이 저장 응답이 들어왔으면 더 새 쪽만. 아니면 서버가 진실이다(버전이 더 낮아도 — 섬을 다시 만든 경우).
          const raced = e.seq !== seq;
          if (row) {
            // 같은 버전이면 옛 참조를 둔다(화면이 헛되이 다시 그리지 않게)
            if (isNewerRow(row, e.snap.row) || (!raced && row.version !== e.snap.row?.version)) publish(e, { row, loaded: true, error: false });
            else publish(e, { ...e.snap, loaded: true, error: false });
          } else if (!raced) publish(e, { row: null, loaded: true, error: false });
          else publish(e, { ...e.snap, loaded: true, error: false });
        } while (e.again);
        return e.snap.row;
      } catch (err) {
        publish(e, { ...e.snap, error: true });
        throw err;
      } finally {
        e.inflight = null;
      }
    })();
    e.inflight = run;
    return run;
  };

  const onChange = (e: Entry<R>, p?: Change) => {
    const act = changeAction(p, e.snap.row);
    if (act === "skip") return;
    const full = act === "adopt" ? fullRow<R>(p?.new) : null;
    if (full) return adopt(e.coupleId, full);
    void refresh(e.coupleId).catch(() => {});
  };

  /** 구독 — 지금 캐시를 바로 한 번 알리고, 아직 모르면 받아 온다. 반환값으로 끊는다. */
  const watch = (coupleId: string | null, cb: (s: IslandSnap<R>) => void): (() => void) => {
    const e = entryOf(coupleId);
    e.subs.add(cb);
    if (!e.unwatch) e.unwatch = deps.watch(coupleId, (p) => onChange(e, p));
    cb(e.snap);
    if (!e.snap.loaded && !e.inflight) void refresh(coupleId).catch(() => {});
    return () => {
      e.subs.delete(cb);
      if (e.subs.size === 0 && e.unwatch) {
        e.unwatch();
        e.unwatch = null;
      }
    };
  };

  return { adopt, refresh, watch, snapshot: (coupleId: string | null) => entryOf(coupleId).snap };
}
