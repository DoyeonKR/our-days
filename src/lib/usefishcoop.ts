/* 함께 끌어올리기 — 낚시 화면이 쓰는 훅 (2026-11-12, 규칙은 lib/fishcoop · 소켓은 lib/couplebroadcast)
 * 리듀서(coopStep)에 사건을 넣고, 나온 메시지를 채널로 보내고, 받은 메시지 · presence 를 다시 사건으로 넣는다. 저장은 하지 않는다 —
 * 보너스는 낚는 사람(A) 화면이 coopBonus 로 읽어 자기 담기 판정에만 얹는다(단일 작성자).
 *
 * presence 값: { who, visible, ready }
 *  · visible — 낚시 화면이 실제로 보인다(문서가 보이고 · 낚시 창이 숨은 탭([hidden]) 안이 아니다). 탭은 숨긴 채 마운트로 남으므로
 *    마운트만으로 '상대도 낚시 중'이라 말하면 거짓말이 된다.
 *  · ready — 부탁을 받을 수 있다(보이고 · 판을 돌리지 않고 · 시트 · 수조 · 레이드가 안 열렸고 · 다른 도움 중이 아니다).
 *
 * 개발용 가짜 상대(배포 빌드엔 없다 — NODE_ENV 가 production 이면 통째로 빠진다)
 *  콘솔에서 낚시 화면을 열기 **전에** window.__fishFakePartner = true 를 넣으면 혼자 미리보기에서도 흐름을 돌려 볼 수 있다.
 *   · true(또는 "ok") — 0.3초 뒤 '상대도 낚시 중', 도와줘를 보내면 0.9초 뒤 받고 4.5초 뒤 '건졌어요' 결과
 *   · "fail" — 받지만 놓친 결과 · "ignore" — 받지 않는다(시간 초과로 혼자 가는 길)
 *   · window.__fishFakeAsk() — 가짜 상대가 나에게 부탁한다(B 쪽 창 · 들어올리기를 볼 때)
 *  커플 연결이 없어도(coupleId null) 돈다. 끄려면 값을 지우고 낚시 화면을 다시 연다. */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { coupleBroadcast, type BroadcastLink, type BroadcastListener } from "./couplebroadcast";
import { COOP_IDLE, coopStep, partnerOf, type CancelWhy, type Coop, type CoopEvent, type CoopMsg, type CoopNote, type CoopPeer } from "./fishcoop";

declare global {
  interface Window {
    __fishFakePartner?: boolean | "ok" | "fail" | "ignore";
    __fishFakeAsk?: () => void;
  }
}

export const COOP_TOPIC = "fish-coop";
const NO_PARTNER = { present: false, ready: false } as const;
/** 상대가 사라졌다고 보기까지 기다리는 시간 */
const GONE_GRACE_MS = 1_500;
type Partner = { present: boolean; ready: boolean };

type FakeMode = "ok" | "fail" | "ignore";
function fakeMode(): FakeMode | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const v = window.__fishFakePartner;
  if (v === true || v === "ok") return "ok";
  if (v === "fail" || v === "ignore") return v;
  return null;
}
/** 가짜 상대 — 채널과 같은 모양(BroadcastLink)이라 리듀서 · 화면은 진짜와 구분하지 않는다 */
function fakeLink(listener: BroadcastListener, mode: FakeMode): BroadcastLink<CoopMsg> {
  const FAKE = "fake-partner";
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
  later(() => listener.presence([{ who: FAKE, visible: true, ready: true } satisfies CoopPeer]), 300);
  window.__fishFakeAsk = () => listener.message({ t: "ask", round: `fake-${Date.now().toString(36)}`, from: FAKE } satisfies CoopMsg);
  return {
    send(msg) {
      if (msg.t === "ask" && mode !== "ignore") {
        later(() => listener.message({ t: "accept", round: msg.round, from: FAKE } satisfies CoopMsg), 900);
        later(() => listener.message({ t: "result", round: msg.round, from: FAKE, ok: mode === "ok", q: 0.8 } satisfies CoopMsg), 4_500);
      }
      return true;
    },
    track() {},
    close() {
      timers.forEach(clearTimeout);
      delete window.__fishFakeAsk;
    },
  };
}

/** 낚시 창이 실제로 보이나 — 문서가 보이고 숨은 탭 안이 아니다 */
function rootVisible(el: HTMLElement | null): boolean {
  if (typeof document === "undefined" || document.visibilityState !== "visible") return false;
  return !!el && !el.closest("[hidden]");
}

export type FishCoop = {
  coop: Coop;
  partner: Partner;
  /** 마지막 소식(번호가 바뀔 때만 새 소식) */
  note: { id: number; note: Exclude<CoopNote, null> } | null;
  /** 33ms 루프용 — 렌더를 기다리지 않는 지금 값 */
  stateRef: RefObject<Coop>;
  partnerRef: RefObject<Partner>;
  ask: (round: string) => void;
  close: (why: CancelWhy) => void;
  accept: () => void;
  decline: () => void;
  finish: (ok: boolean, q: number) => void;
};

export function useFishCoop({ coupleId, me, ready, rootRef }: { coupleId: string | null; me: string; ready: boolean; rootRef: RefObject<HTMLElement | null> }): FishCoop {
  const [coop, setCoop] = useState<Coop>(COOP_IDLE);
  const stateRef = useRef<Coop>(COOP_IDLE);
  const [partner, setPartner] = useState<Partner>(NO_PARTNER);
  const partnerRef = useRef<Partner>(NO_PARTNER);
  const [note, setNote] = useState<FishCoop["note"]>(null);
  const noteSeq = useRef(0);
  const linkRef = useRef<BroadcastLink<CoopMsg> | null>(null);
  const [visible, setVisible] = useState(false);
  /** 상대가 사라진 것처럼 보여도 잠깐 기다린다 — presence 를 다시 실을 때(B 가 받기 창으로 바뀌는 순간 등) 떠남 · 들어옴이
   *  한 번에 오면, 바로 gone 을 넣으면 A 가 막 오는 accept 를 버리고 혼자 간다. 진짜 끊김은 리듀서의 시간 초과가 마저 처리한다 */
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useCallback((ev: CoopEvent) => {
    const r = coopStep(stateRef.current, ev, me);
    if (r.s !== stateRef.current) {
      stateRef.current = r.s;
      setCoop(r.s);
    }
    if (r.out) linkRef.current?.send(r.out);
    if (r.note) {
      noteSeq.current += 1;
      setNote({ id: noteSeq.current, note: r.note });
    }
  }, [me]);
  const dispatchRef = useRef(dispatch);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // 보이나 — 앱 숨김은 바로, 숨은 탭으로 바뀐 건 1.5초마다 본다(hidden 속성 변화를 따로 구독하지 않는 값싼 길)
  useEffect(() => {
    const check = () => setVisible(rootVisible(rootRef.current));
    check();
    document.addEventListener("visibilitychange", check);
    const iv = setInterval(check, 1_500);
    return () => {
      document.removeEventListener("visibilitychange", check);
      clearInterval(iv);
    };
  }, [rootRef]);

  // 다른 도움이 진행 중이면 새 부탁을 받지 않는다(보여 주던 결과는 예외 — 리듀서와 같은 규칙)
  const free = coop.k === "idle" || (coop.k === "result" && coop.role === "helper");
  const canPrompt = visible && ready && free;
  const canPromptRef = useRef(canPrompt);
  const metaRef = useRef<CoopPeer>({ who: me, visible, ready: canPrompt });
  useEffect(() => {
    canPromptRef.current = canPrompt;
    metaRef.current = { who: me, visible, ready: canPrompt };
    linkRef.current?.track(metaRef.current);
  }, [me, visible, canPrompt]);

  // 채널 — 커플이 있고 로그인한 사람일 때만(혼자 섬 · 로컬 모드는 아무 일도 없다). 개발 빌드는 가짜 상대도
  useEffect(() => {
    const fake = fakeMode();
    if (!fake && (!coupleId || me === "me")) return;
    const listener: BroadcastListener = {
      message: (m) => dispatchRef.current({ e: "recv", msg: m as CoopMsg, now: Date.now(), canPrompt: canPromptRef.current }),
      presence: (peers) => {
        const p = partnerOf(peers, me);
        partnerRef.current = p;
        setPartner(p);
        if (p.present) {
          if (goneTimer.current) clearTimeout(goneTimer.current);
          goneTimer.current = null;
        } else if (!goneTimer.current) {
          goneTimer.current = setTimeout(() => {
            goneTimer.current = null;
            if (!partnerRef.current.present) dispatchRef.current({ e: "gone", now: Date.now() });
          }, GONE_GRACE_MS);
        }
      },
    };
    const link = fake ? fakeLink(listener, fake) : coupleBroadcast<CoopMsg>(coupleId as string, COOP_TOPIC, me, listener);
    linkRef.current = link;
    link.track(metaRef.current);
    return () => {
      // 화면을 떠난다 — 진행 중이던 상대에게 알리고, 보이지 않음을 싣고 뗀다(상대는 1.5초 기다리지 않고 바로 안다)
      dispatchRef.current({ e: "close", why: "gone", now: Date.now() });
      link.track({ who: me, visible: false, ready: false });
      link.close();
      linkRef.current = null;
      if (goneTimer.current) clearTimeout(goneTimer.current);
      goneTimer.current = null;
      partnerRef.current = NO_PARTNER;
      setPartner(NO_PARTNER);
    };
  }, [coupleId, me]);

  // 시간 초과 — 무언가 진행 중일 때만 돈다
  const busy = coop.k !== "idle";
  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => dispatchRef.current({ e: "tick", now: Date.now() }), 400);
    return () => clearInterval(iv);
  }, [busy]);

  return {
    coop,
    partner,
    note,
    stateRef,
    partnerRef,
    ask: useCallback((round: string) => dispatch({ e: "ask", round, now: Date.now() }), [dispatch]),
    close: useCallback((why: CancelWhy) => dispatch({ e: "close", why, now: Date.now() }), [dispatch]),
    accept: useCallback(() => dispatch({ e: "accept", now: Date.now() }), [dispatch]),
    decline: useCallback(() => dispatch({ e: "decline", now: Date.now() }), [dispatch]),
    finish: useCallback((ok: boolean, q: number) => dispatch({ e: "finish", ok, q, now: Date.now() }), [dispatch]),
  };
}
