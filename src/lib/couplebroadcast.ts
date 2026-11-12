/* 커플 브로드캐스트 · presence 채널 (2026-11-12 함께 끌어올리기 — lib/fishcoop · lib/usefishcoop)
 *
 * 왜 couple.ts 의 다중화 채널(muxOn)이 아닌가
 *  · 다중화 채널은 DB 변경 구독 전용이고, 이름이 기기 · 인스턴스마다 다르다(_chanName 이 번호를 붙인다 — 2026-07-02 이중 구독 크래시 봉인).
 *    브로드캐스트 · presence 는 **두 폰이 글자 하나까지 같은 이름**에 붙어야 서로 보인다. 번호가 붙으면 영영 못 만난다
 *    (지운 부루마블 · 테트리스 presence 가 그 구조였다 — 되살리지 않는다).
 *  · 이 채널은 DB 를 안 건드린다 — 구독 행(realtime.subscription) · WAL 디코딩이 없어서 2026-07-27 Disk IO 사건과 무관하다.
 *    DB 변경 구독은 여전히 muxOn 으로만(realtime-mux.test · fishcoop.test 가 이 파일에 그 구독이 없는지 본다).
 *
 * 같은 이름이라 생기는 위험과 막는 법
 *  · supabase-js 의 client.channel(이름)은 같은 이름이 이미 있으면 **그 객체를 그대로** 돌려준다. removeChannel 은 비동기라
 *    StrictMode 재마운트처럼 닫자마자 다시 열면 닫히는 중인 채널을 받는다 → 이 파일은 이름마다 하나의 항목을 참조 수로 들고
 *    (리스너는 JS 에서 팬아웃), 마지막 리스너가 떠나도 1.5초 뒤에 닫는다(바로 다시 붙으면 그대로 쓴다).
 *    다시 지을 때는 옛 채널 제거를 **기다린 뒤** 짓고, 그래도 남은 같은 이름 객체(제거 응답 시간 초과)는 클라이언트 목록에서 뗀다.
 *  · .on() 은 채널을 만들 때 한 번만 단다 — 구독 뒤 .on() 추가는 크래시 클래스다.
 *
 * 재연결: 앱 복귀 되살리기(couple.ts reviveRealtime, README §10.23)가 소켓을 새로 열면 onRealtimeRevive 로 여기도 새로 짓는다.
 *  SUBSCRIBED 는 재조인 때마다 다시 오므로 그때마다 presence 를 다시 싣는다(track). 끊긴 동안은 상대를 '없음'으로 알린다 —
 *  기다리던 쪽은 바로 혼자 하던 대로 돌아간다(fishcoop 의 gone).
 *
 * 공개 채널이다(private 는 realtime.messages RLS = DB 변경이 필요하다). 이름의 커플 id 는 추측할 수 없는 uuid 이고,
 * 오가는 값은 게임 신호뿐이며 받은 쪽의 효과는 자기 담기 확률뿐이라 남이 끼어들어도 남의 저장은 못 건드린다. */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { onRealtimeRevive } from "./couple";

export type BroadcastListener = {
  /** 상대가 보낸 메시지(내 메시지는 서버가 돌려주지 않는다 — self: false) */
  message: (payload: unknown) => void;
  /** presence 에 실린 값 전부(나 포함). 끊기면 빈 목록 */
  presence: (peers: unknown[]) => void;
};
export type BroadcastLink<M> = {
  /** 붙어 있을 때만 보낸다 — 안 붙었으면 false(REST 로 몰래 보내지 않는다) */
  send: (msg: M) => boolean;
  /** 내 presence 값 — 붙기 전에 불러도 기억했다가 붙으면 싣는다 */
  track: (meta: Record<string, unknown>) => void;
  close: () => void;
};

const EVENT = "m";
/** 마지막 리스너가 떠난 뒤 닫기까지 — StrictMode 재마운트 · 탭 전환 재마운트를 같은 채널로 흡수한다 */
const RELEASE_MS = 1_500;

type Entry = {
  topic: string;
  me: string;
  ch: RealtimeChannel | null;
  joined: boolean;
  listeners: Set<BroadcastListener>;
  meta: Record<string, unknown> | null;
  peers: unknown[];
  releaseTimer: ReturnType<typeof setTimeout> | null;
  /** 옛 채널 제거가 끝나는 때 — 같은 이름을 새로 짓기 전에 기다린다 */
  closing: Promise<unknown>;
  /** 짓기 세대 — 기다리는 사이 더 새 짓기 · 닫기가 오면 옛 짓기는 그만둔다 */
  gen: number;
  dead: boolean;
  unrevive: () => void;
};
const _entries = new Map<string, Entry>();
/** 이름마다 진행 중인 제거 — 항목이 지워진 뒤 곧바로 같은 이름으로 다시 붙어도(StrictMode · 화면 재진입) 옛 제거를 기다리게.
 *  안 기다리면 새 객체를 만든 뒤 옛 채널의 닫힘 처리가 '같은 이름'으로 목록을 걸러 새 채널까지 목록에서 지운다(realtime-js _remove) */
const _closing = new Map<string, Promise<unknown>>();

/** 공유 이름 — 두 기기가 같아야 한다(번호를 붙이지 않는다) */
export const broadcastTopic = (topic: string, coupleId: string) => `${topic}:${coupleId}`;

function fan(e: Entry, f: (l: BroadcastListener) => void): void {
  for (const l of [...e.listeners]) {
    try {
      f(l);
    } catch {
      /* 한 화면이 던져도 나머지는 계속 */
    }
  }
}
function setPeers(e: Entry, peers: unknown[]): void {
  e.peers = peers;
  fan(e, (l) => l.presence(peers));
}
/** presenceState() = { 키: [값, …] } — 값만 펼친다 */
function flatten(state: Record<string, unknown[]>): unknown[] {
  const out: unknown[] = [];
  for (const arr of Object.values(state)) if (Array.isArray(arr)) out.push(...arr);
  return out;
}
/** 제거 응답이 시간 초과로 끝나 같은 이름 객체가 목록에 남았으면 뗀다 — 남아 있으면 다음 짓기가 그 죽은 객체를 돌려받는다 */
function dropStale(sb: SupabaseClient, topic: string): void {
  const rt = sb.realtime as unknown as { _remove?: (c: RealtimeChannel) => void };
  for (const c of sb.getChannels()) if (c.topic === `realtime:${topic}`) rt._remove?.(c);
}

function teardown(sb: SupabaseClient, e: Entry): void {
  const old = e.ch;
  e.ch = null;
  e.joined = false;
  if (e.peers.length) setPeers(e, []);
  if (!old) return;
  const done = Promise.all([e.closing, sb.removeChannel(old).catch(() => null)]).then(() => dropStale(sb, e.topic));
  e.closing = done;
  _closing.set(e.topic, done);
  void done.then(() => {
    if (_closing.get(e.topic) === done) _closing.delete(e.topic);
  });
}

function build(sb: SupabaseClient, e: Entry): void {
  const gen = ++e.gen;
  void e.closing.then(() => {
    if (gen !== e.gen || e.dead) return;
    dropStale(sb, e.topic);
    const ch = sb.channel(e.topic, { config: { broadcast: { self: false, ack: false }, presence: { key: e.me } } });
    e.ch = ch;
    e.joined = false;
    ch.on("broadcast", { event: EVENT }, (msg) => {
      if (e.ch !== ch) return;
      fan(e, (l) => l.message((msg as { payload?: unknown }).payload));
    })
      .on("presence", { event: "sync" }, () => {
        if (e.ch !== ch) return;
        setPeers(e, flatten(ch.presenceState() as Record<string, unknown[]>));
      })
      .subscribe((status) => {
        if (e.ch !== ch) return;
        if (status === "SUBSCRIBED") {
          e.joined = true;
          // 재조인마다 다시 싣는다 — 서버는 끊긴 소켓의 presence 를 지웠다
          if (e.meta) void ch.track(e.meta).catch(() => {});
          return;
        }
        // 오류 · 시간 초과 · 닫힘 — phoenix 가 알아서 다시 붙는다. 그 사이 상대는 모르는 것으로(기다리던 쪽은 혼자 간다)
        e.joined = false;
        if (e.peers.length) setPeers(e, []);
      });
  });
}

/** 커플 공유 이름의 브로드캐스트 · presence 채널에 붙는다. me 는 presence 키(사람 id). 반환값의 close 로 뗀다. */
export function coupleBroadcast<M>(coupleId: string, topic: string, me: string, listener: BroadcastListener): BroadcastLink<M> {
  const sb = getSupabase();
  if (!sb) return { send: () => false, track: () => {}, close: () => {} };
  const name = broadcastTopic(topic, coupleId);
  const key = `${name}|${me}`;
  let e = _entries.get(key);
  if (e?.releaseTimer) {
    clearTimeout(e.releaseTimer);
    e.releaseTimer = null;
  }
  if (!e) {
    const fresh: Entry = { topic: name, me, ch: null, joined: false, listeners: new Set(), meta: null, peers: [], releaseTimer: null, closing: _closing.get(name) ?? Promise.resolve(), gen: 0, dead: false, unrevive: () => {} };
    // 앱 복귀 재연결 — 소켓이 새로 열렸으니 새 소켓 위에 다시 짓는다(좀비 소켓의 채널은 다시 join 하지 않는다)
    fresh.unrevive = onRealtimeRevive(() => {
      if (fresh.dead) return;
      teardown(sb, fresh);
      build(sb, fresh);
    });
    _entries.set(key, fresh);
    build(sb, fresh);
    e = fresh;
  }
  const entry = e;
  entry.listeners.add(listener);
  // 이미 붙어 있던 채널이면 지금 상대 목록을 바로 알려 준다(다음 sync 를 기다리지 않게)
  if (entry.joined) queueMicrotask(() => {
    if (entry.listeners.has(listener)) listener.presence(entry.peers);
  });
  let open = true;
  return {
    send(msg) {
      if (!open || !entry.ch || !entry.joined) return false;
      void entry.ch.send({ type: "broadcast", event: EVENT, payload: msg }).catch(() => {});
      return true;
    },
    track(meta) {
      if (!open) return;
      entry.meta = meta;
      if (entry.ch && entry.joined) void entry.ch.track(meta).catch(() => {});
    },
    close() {
      if (!open) return;
      open = false;
      entry.listeners.delete(listener);
      if (entry.listeners.size > 0 || entry.releaseTimer) return;
      entry.releaseTimer = setTimeout(() => {
        entry.releaseTimer = null;
        if (entry.listeners.size > 0) return;
        entry.dead = true;
        entry.gen++;
        entry.unrevive();
        teardown(sb, entry);
        _entries.delete(key);
      }, RELEASE_MS);
    },
  };
}
