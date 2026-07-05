"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";
import {
  type Couple,
  type Member,
  type Poke,
  POKE_KINDS,
  createCouple,
  ensureAnonAuth,
  getMyCouple,
  isSupabaseConfigured,
  joinCouple,
  leaveCouple,
  pokeEmoji,
  recentPokes,
  sendPoke,
  subscribePokes,
} from "@/lib/couple";
import { asset } from "@/lib/base";
import { sendPokePush } from "@/lib/push";

type Props = {
  localStart: string | null;
  myName: string; // 온보딩에서 넣은 내 애칭 — 커플 생성/합류 시 그대로 사용
  notif: NotificationPermission;
  onCoupleChange: (coupleId: string | null) => void;
  onAdoptStart: (iso: string) => void;
  onPartnerName: (name: string) => void; // 연결된 상대 애칭을 부모(히어로)로 전달
  onOpenAccount: () => void; // '다른 기기 로그인' → 설정 열기
};

type Phase = "loading" | "notconfigured" | "unpaired" | "paired";

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

/** 채팅 날짜 구분선 라벨 — 오늘/어제/M월 D일. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
/** 같은 날인지(구분선 표시 판단). */
function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// 연결된 커플을 로컬에 기억 → 세션이 끊겼을 때 저장된 코드로 자동 재연결.
const LS_COUPLE = "ourdays:couple";
function saveCoupleLocal(c: Couple) {
  try {
    localStorage.setItem(LS_COUPLE, JSON.stringify({ id: c.id, code: c.invite_code }));
  } catch {
    /* noop */
  }
}
function readSavedCode(): string | null {
  try {
    const r = JSON.parse(localStorage.getItem(LS_COUPLE) ?? "null");
    return r?.code ?? null;
  } catch {
    return null;
  }
}
function clearCoupleLocal() {
  try {
    localStorage.removeItem(LS_COUPLE);
  } catch {
    /* noop */
  }
}

export default function CoupleSync({
  localStart,
  myName,
  notif,
  onCoupleChange,
  onAdoptStart,
  onPartnerName,
  onOpenAccount,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [uid, setUid] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pokes, setPokes] = useState<Poke[]>([]);
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [code, setCode] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [allPokes, setAllPokes] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRef = useRef<HTMLDivElement>(null); // 채팅 스크롤(새 쿡 오면 맨 아래로)
  const replyDone = useRef(false); // ?pokeReply 1회만 처리

  // notif 를 ref 로 읽어, 권한 변경 때마다 실시간 채널이 재생성되지 않게 한다.
  const notifRef = useRef(notif);
  useEffect(() => {
    notifRef.current = notif;
  }, [notif]);

  const pushPoke = useCallback((p: Poke) => {
    setPokes((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      // 서버 echo(실 id) 도착 시 같은 내용의 낙관적 임시 버블 제거(중복 방지)
      const cleaned = p.id.startsWith("tmp-")
        ? prev
        : prev.filter(
            (x) =>
              !(
                x.id.startsWith("tmp-") &&
                x.from_user === p.from_user &&
                x.kind === p.kind &&
                (x.message ?? "") === (p.message ?? "")
              ),
          );
      return [p, ...cleaned].slice(0, 200);
    });
  }, []);

  const fireNotification = useCallback((p: Poke) => {
    if (notifRef.current !== "granted" || typeof Notification === "undefined") return;
    try {
      new Notification("💗 쿡! 상대가 찔렀어요", {
        body: `${pokeEmoji(p.kind)} ${p.message ?? "쿡!"}`,
        icon: asset("/icon-192.png"),
      });
    } catch {
      /* noop */
    }
  }, []);

  // 최초 로드: 익명 로그인 → 내 커플 조회
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhase("notconfigured");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const id = await ensureAnonAuth();
        if (cancelled) return;
        setUid(id);
        const applyPaired = async (c: Couple, ms: Member[]) => {
          saveCoupleLocal(c);
          setCouple(c);
          setMembers(ms);
          onCoupleChange(c.id);
          if (c.start_date) onAdoptStart(c.start_date);
          setPokes(await recentPokes(c.id));
          setPhase("paired");
        };
        let st = await getMyCouple();
        if (cancelled) return;
        // 세션은 있는데 커플이 안 잡히면(세션 하이컵/재발급) 저장된 코드로 자동 재연결
        if (!st) {
          const savedCode = readSavedCode();
          if (savedCode) {
            try {
              await joinCouple(savedCode, myName);
              st = await getMyCouple();
            } catch {
              /* 재연결 실패 → 아래에서 메뉴 표시 */
            }
          }
        }
        if (cancelled) return;
        if (st) await applyPaired(st.couple, st.members);
        else setPhase("unpaired");
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setPhase("unpaired");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 실시간 쿡찌르기 구독 (couple/uid/notif 확정 시)
  useEffect(() => {
    if (!couple || !uid) return;
    const unsub = subscribePokes(couple.id, (p) => {
      pushPoke(p);
      if (p.from_user !== uid) {
        setBanner(`${pokeEmoji(p.kind)} ${p.message ?? "쿡!"}`);
        fireNotification(p);
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 4500);
      }
    });
    return () => {
      unsub();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [couple, uid, pushPoke, fireNotification]);

  // 상대가 합류하길 기다리는 동안 구성원을 주기적으로 새로고침 → 2명 되면 자동 반영.
  // (생성자가 '대기중' 화면에 영원히 멈춰 있던 문제 해결)
  useEffect(() => {
    if (phase !== "paired" || !couple || members.length >= 2) return;
    const id = setInterval(() => {
      reloadMembers(couple.id).catch(() => {});
    }, 4000);
    return () => clearInterval(id);
     
  }, [phase, couple, members.length]);

  // 연결된 상대의 애칭을 부모(히어로 "나 💕 상대")로 전달. 미연결이면 빈 값.
  useEffect(() => {
    const p = members.find((m) => m.user_id !== uid);
    onPartnerName(p?.nickname ?? "");
  }, [members, uid, onPartnerName]);

  // 새 쿡찌르기 오면 채팅을 맨 아래로 스크롤
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pokes]);

  // 푸시 빠른 답장 — kind 프리셋을 바로 전송
  const sendReplyKind = (kind: string) => {
    const preset = POKE_KINDS.find((p) => p.kind === kind);
    if (preset) handlePoke(preset.kind, preset.message);
  };
  // (1) 앱이 ?pokeReply=<kind> 로 열림(알림 답장 버튼 → 새 창) → 커플 준비되면 1회 전송
  useEffect(() => {
    if (!couple || replyDone.current) return;
    const kind = new URLSearchParams(window.location.search).get("pokeReply");
    if (!kind) return;
    replyDone.current = true;
    const u = new URL(window.location.href);
    u.searchParams.delete("pokeReply");
    window.history.replaceState(null, "", u.href);
    sendReplyKind(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple]);
  // (2) 앱이 이미 열려 있을 때: SW 가 postMessage 로 답장 kind 전달
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "pokeReply" && e.data.kind) sendReplyKind(e.data.kind);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple]);

  async function reloadMembers(coupleId: string) {
    const st = await getMyCouple();
    if (st && st.couple.id === coupleId) setMembers(st.members);
  }

  async function handleCreate() {
    setBusy(true);
    setErr(null);
    try {
      setUid(await ensureAnonAuth()); // 마운트 인증 실패했어도 여기서 uid 확정 → 구독 보장
      const c = await createCouple(myName, localStart);
      saveCoupleLocal(c);
      setCouple(c);
      onCoupleChange(c.id);
      if (c.start_date) onAdoptStart(c.start_date);
      await reloadMembers(c.id);
      setPokes(await recentPokes(c.id));
      setPhase("paired");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setErr(null);
    try {
      setUid(await ensureAnonAuth()); // 구독이 uid 에 의존 → 여기서 확정
      const c = await joinCouple(code, myName);
      saveCoupleLocal(c);
      setCouple(c);
      onCoupleChange(c.id);
      if (c.start_date) onAdoptStart(c.start_date);
      await reloadMembers(c.id);
      setPokes(await recentPokes(c.id));
      setPhase("paired");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePoke(kind: string, message: string) {
    if (!couple || busy) return;
    setBusy(true);
    setErr(null);
    // 낙관적 표시 — 보내는 즉시 내 말풍선 노출(서버 echo 로 실 id 치환). 채팅 반응성.
    if (uid) {
      pushPoke({
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        couple_id: couple.id,
        from_user: uid,
        kind,
        message: message || null,
        created_at: new Date().toISOString(),
      });
    }
    try {
      navigator.vibrate?.(12); // 살짝 햅틱(모바일)
    } catch {
      /* noop */
    }
    try {
      await sendPoke(couple.id, kind, message);
      sendPokePush(couple.id, message); // 상대에게 백그라운드 푸시 (실패는 무시)
      setCustomMsg("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      // 전송 실패 → 낙관적 임시 버블 롤백
      setPokes((prev) => prev.filter((x) => !x.id.startsWith("tmp-")));
    } finally {
      setBusy(false);
    }
  }

  async function loadAllPokes() {
    if (!couple) return;
    try {
      setPokes(await recentPokes(couple.id, 200));
      setAllPokes(true);
    } catch {
      /* noop */
    }
  }

  async function handleLeave() {
    if (!couple) return;
    if (
      !(await confirmDialog({
        message: "커플 연결을 해제할까요?",
        detail: "쿡 찌르기 기록도 안 보이게 됩니다.",
        confirmText: "연결 해제",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await leaveCouple(couple.id);
      clearCoupleLocal();
      setCouple(null);
      setMembers([]);
      setPokes([]);
      onCoupleChange(null);
      setPhase("unpaired");
      setMode("menu");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!couple) return;
    navigator.clipboard?.writeText(couple.invite_code).then(
      () => {
        setCopied(true);
        // 언마운트 후 setState 경고 방지 — ref 로 보관해 정리(아래 cleanup effect)
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  // 언마운트 시 '복사됨' 타이머 정리
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  // 초대 공유(카톡/메시지 등) — Web Share, 미지원이면 복사 폴백. '한쪽만 가입' 이탈 완화.
  async function shareCode() {
    if (!couple) return;
    const url =
      typeof location !== "undefined" ? location.origin + location.pathname : "";
    const text = `우리의 하루에서 함께해요 💗 초대코드 ${couple.invite_code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "우리의 하루", text, url });
        return;
      } catch {
        /* 사용자 취소/실패 → 복사 폴백 */
      }
    }
    copyCode();
  }

  const partner = members.find((m) => m.user_id !== uid);
  const waiting = members.length < 2;

  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-sm font-bold text-ink">커플 연동</h2>

      {/* 실시간 수신 배너 */}
      {banner && (
        <div className="animate-pop tap mb-3 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lg)]">
          {banner}
        </div>
      )}

      <div className="glass rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
        {phase === "loading" && (
          <p className="py-4 text-center text-sm text-muted">연결 확인 중…</p>
        )}

        {phase === "notconfigured" && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">💑 두 사람이 함께 쓰려면</p>
            <p className="text-xs leading-relaxed text-muted">
              커플 연동·쿡 찌르기는 무료 백엔드(Supabase) 연결이 필요해요. 저장소의{" "}
              <code className="rounded bg-glass px-1">docs/SETUP.md</code> 지침서대로
              2분이면 켤 수 있어요. 지금은 나 혼자 쓰는 로컬 모드로 동작 중입니다.
            </p>
          </div>
        )}

        {phase === "unpaired" && (
          <div className="space-y-3">
            {mode === "menu" && (
              <>
                <p className="text-sm text-muted">
                  둘을 하나로 연결하면 같은 D-day를 보고, 서로 쿡 찌를 수 있어요.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMode("create");
                      setErr(null);
                    }}
                    className="tap flex-1 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]"
                  >
                    커플 만들기
                  </button>
                  <button
                    onClick={() => {
                      setMode("join");
                      setErr(null);
                    }}
                    className="tap flex-1 rounded-xl bg-glass py-3 text-sm font-bold text-rose-deep ring-1 ring-line"
                  >
                    코드로 합류
                  </button>
                </div>
                <button
                  onClick={onOpenAccount}
                  className="tap w-full py-1 text-center text-xs text-muted underline underline-offset-2"
                >
                  다른 기기에서 쓰던 계정이 있어요 → 로그인
                </button>
              </>
            )}

            {mode === "create" && (
              <>
                <p className="text-sm text-ink">
                  <b className="text-rose-deep">{myName || "나"}</b> 이름으로 커플을 만들어요.
                </p>
                <p className="text-xs text-muted">
                  만들면 초대코드가 나와요. 상대에게 코드를 알려주면 연결됩니다.
                  {!myName && " (내 애칭은 설정에서 바꿀 수 있어요)"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("menu")}
                    className="tap rounded-xl px-4 py-2.5 text-sm text-muted"
                  >
                    뒤로
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleCreate}
                    className="tap flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
                  >
                    {busy ? "만드는 중…" : "커플 만들기"}
                  </button>
                </div>
              </>
            )}

            {mode === "join" && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">
                    초대코드
                  </span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="예) K7M2QP"
                    maxLength={6}
                    className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-rose"
                  />
                </label>
                <p className="text-xs text-muted">
                  <b className="text-rose-deep">{myName || "나"}</b> 이름으로 합류해요.
                  {!myName && " (내 애칭은 설정에서 바꿀 수 있어요)"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("menu")}
                    className="tap rounded-xl px-4 py-2.5 text-sm text-muted"
                  >
                    뒤로
                  </button>
                  <button
                    disabled={busy || code.trim().length < 4}
                    onClick={handleJoin}
                    className="tap flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
                  >
                    {busy ? "연결 중…" : "합류하기"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === "paired" && couple && (
          <div className="space-y-4">
            {/* 상태 */}
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-rose/15 text-xl">
                {waiting ? "⏳" : "💞"}
              </span>
              <div className="min-w-0 flex-1">
                {waiting ? (
                  <p className="text-sm font-bold text-ink">상대를 기다리는 중</p>
                ) : (
                  <p className="text-sm font-bold text-ink">
                    {partner?.nickname || "그대"} 님과 연결됨 💞
                  </p>
                )}
              </div>
            </div>

            {/* 대기중: 초대코드 공유 */}
            {waiting && (
              <div className="glass rounded-xl bg-glass p-4 text-center shadow-[var(--shadow-sm)] ring-1 ring-line">
                <p className="text-xs text-muted">이 코드를 상대에게 보내세요</p>
                <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-gradient">
                  {couple.invite_code}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={shareCode}
                    className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
                  >
                    <Icon name="send" size={13} />
                    초대 공유
                  </button>
                  <button
                    onClick={copyCode}
                    className="tap rounded-full bg-glass px-4 py-1.5 text-xs font-semibold text-rose-deep ring-1 ring-line"
                  >
                    {copied ? "복사됨 ✓" : "코드 복사"}
                  </button>
                </div>
              </div>
            )}

            {/* 쿡찌르기 — 채팅형(대화 스크롤 + 프리셋 칩 + 입력바) */}
            {!waiting && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Icon name="send" size={13} className="text-rose-deep" />쿡 찌르기
                </p>

                {/* 대화 (오래된→최신, 최신이 아래, 새 쿡 오면 자동 스크롤) */}
                <div
                  ref={chatRef}
                  className="max-h-52 space-y-1.5 overflow-y-auto rounded-2xl bg-glass2 p-2.5 ring-1 ring-line"
                >
                  {pokes.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted">
                      아직 대화가 없어요. 첫 쿡을 보내보세요 👉
                    </p>
                  ) : (
                    <>
                      {!allPokes && pokes.length > 8 && (
                        <button
                          onClick={loadAllPokes}
                          className="tap mx-auto block rounded-full bg-glass px-3 py-1 text-[11px] font-semibold text-rose-deep ring-1 ring-line"
                        >
                          이전 쿡 더보기
                        </button>
                      )}
                      {[...(allPokes ? pokes : pokes.slice(0, 8))]
                        .reverse()
                        .map((p, i, arr) => {
                          const mine = p.from_user === uid;
                          const sending = p.id.startsWith("tmp-");
                          const showDay =
                            i === 0 || !sameDay(arr[i - 1].created_at, p.created_at);
                          return (
                            <div key={p.id}>
                              {showDay && (
                                <div className="my-1.5 flex justify-center">
                                  <span className="rounded-full bg-glass px-2 py-0.5 text-[10px] text-muted ring-1 ring-line">
                                    {dayLabel(p.created_at)}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                    mine
                                      ? "rounded-br-sm bg-brand text-white shadow-[var(--shadow-sm)]"
                                      : "rounded-bl-sm bg-surface text-ink shadow-[var(--shadow-sm)] ring-1 ring-line"
                                  } ${sending ? "opacity-60" : ""}`}
                                >
                                  <span className="mr-1">{pokeEmoji(p.kind)}</span>
                                  {p.message ?? "쿡!"}
                                  <span
                                    className={`ml-2 align-middle text-[10px] ${
                                      mine ? "text-white/85" : "text-muted"
                                    }`}
                                  >
                                    {sending ? "전송 중" : timeAgo(p.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </>
                  )}
                </div>

                {/* 빠른 프리셋 (가로 스크롤 칩) */}
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {POKE_KINDS.map((p) => (
                    <button
                      key={p.kind}
                      disabled={busy}
                      onClick={() => handlePoke(p.kind, p.message)}
                      className="tap flex shrink-0 items-center gap-1 rounded-full bg-glass px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line disabled:opacity-50"
                    >
                      <span className="text-base">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* 입력 바 */}
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="메시지 보내기…"
                    maxLength={60}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customMsg.trim())
                        handlePoke("custom", customMsg.trim());
                    }}
                    className="flex-1 rounded-full border border-line bg-glass px-4 py-2.5 text-sm outline-none focus:border-rose"
                  />
                  <button
                    disabled={busy || !customMsg.trim()}
                    onClick={() => handlePoke("custom", customMsg.trim())}
                    aria-label="보내기"
                    className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-md)] disabled:opacity-50"
                  >
                    <Icon name="send" size={18} />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleLeave}
              className="tap w-full rounded-xl py-2 text-xs text-muted"
            >
              커플 연결 해제
            </button>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-deep">
            {err}
          </p>
        )}
      </div>
    </section>
  );
}
