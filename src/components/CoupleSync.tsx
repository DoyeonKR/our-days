"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  enablePush,
  isPushConfigured,
  isPushSubscribed,
  sendPokePush,
} from "@/lib/push";

type Props = {
  localStart: string | null;
  myName: string; // 온보딩에서 넣은 내 애칭 — 커플 생성/합류 시 그대로 사용
  notif: NotificationPermission;
  onCoupleChange: (coupleId: string | null) => void;
  onAdoptStart: (iso: string) => void;
  onPartnerName: (name: string) => void; // 연결된 상대 애칭을 부모(히어로)로 전달
};

type Phase = "loading" | "notconfigured" | "unpaired" | "paired";

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
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
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // notif 를 ref 로 읽어, 권한 변경 때마다 실시간 채널이 재생성되지 않게 한다.
  const notifRef = useRef(notif);
  useEffect(() => {
    notifRef.current = notif;
  }, [notif]);

  const pushPoke = useCallback((p: Poke) => {
    setPokes((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [p, ...prev].slice(0, 20),
    );
  }, []);

  const fireNotification = useCallback((p: Poke) => {
    if (notifRef.current !== "granted" || typeof Notification === "undefined") return;
    try {
      new Notification("💗 콕! 상대가 찔렀어요", {
        body: `${pokeEmoji(p.kind)} ${p.message ?? "콕!"}`,
        icon: asset("/icon.svg"),
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
        setBanner(`${pokeEmoji(p.kind)} ${p.message ?? "콕!"}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, couple, members.length]);

  // 연결된 상대의 애칭을 부모(히어로 "나 💕 상대")로 전달. 미연결이면 빈 값.
  useEffect(() => {
    const p = members.find((m) => m.user_id !== uid);
    onPartnerName(p?.nickname ?? "");
  }, [members, uid, onPartnerName]);

  // 이 기기의 백그라운드 푸시 구독 상태 확인
  useEffect(() => {
    if (phase !== "paired") return;
    isPushSubscribed()
      .then(setPushOn)
      .catch(() => {});
  }, [phase]);

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
    try {
      await sendPoke(couple.id, kind, message);
      sendPokePush(couple.id, message); // 상대에게 백그라운드 푸시 (실패는 무시)
      setCustomMsg("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePush() {
    setPushBusy(true);
    setErr(null);
    try {
      const ok = await enablePush();
      setPushOn(ok);
      if (!ok)
        setErr(
          "푸시를 켤 수 없어요. 권한을 허용했는지, 아이폰은 '홈 화면에 추가'한 앱에서 여는지 확인해 주세요.",
        );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleLeave() {
    if (!couple) return;
    if (!confirm("커플 연결을 해제할까요? 쿡찌르기 기록도 안 보이게 됩니다.")) return;
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
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  const partner = members.find((m) => m.user_id !== uid);
  const waiting = members.length < 2;

  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-sm font-bold text-ink">커플 연동</h2>

      {/* 실시간 수신 배너 */}
      {banner && (
        <div className="animate-pop mb-3 rounded-2xl bg-rose-deep px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {banner}
        </div>
      )}

      <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-line backdrop-blur-xl">
        {phase === "loading" && (
          <p className="py-4 text-center text-sm text-muted">연결 확인 중…</p>
        )}

        {phase === "notconfigured" && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">💑 두 사람이 함께 쓰려면</p>
            <p className="text-xs leading-relaxed text-muted">
              커플 연동·쿡찌르기는 무료 백엔드(Supabase) 연결이 필요해요. 저장소의{" "}
              <code className="rounded bg-white/60 px-1">docs/SETUP.md</code> 지침서대로
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
                    className="flex-1 rounded-xl bg-rose-deep py-3 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    커플 만들기
                  </button>
                  <button
                    onClick={() => {
                      setMode("join");
                      setErr(null);
                    }}
                    className="flex-1 rounded-xl bg-white/70 py-3 text-sm font-bold text-rose-deep ring-1 ring-line active:scale-[0.98]"
                  >
                    코드로 합류
                  </button>
                </div>
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
                    className="rounded-xl px-4 py-2.5 text-sm text-muted"
                  >
                    뒤로
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleCreate}
                    className="flex-1 rounded-xl bg-rose-deep py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
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
                    className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-rose"
                  />
                </label>
                <p className="text-xs text-muted">
                  <b className="text-rose-deep">{myName || "나"}</b> 이름으로 합류해요.
                  {!myName && " (내 애칭은 설정에서 바꿀 수 있어요)"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("menu")}
                    className="rounded-xl px-4 py-2.5 text-sm text-muted"
                  >
                    뒤로
                  </button>
                  <button
                    disabled={busy || code.trim().length < 4}
                    onClick={handleJoin}
                    className="flex-1 rounded-xl bg-rose-deep py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
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
                    {partner?.nickname || "그대"} 님과 연결됨
                  </p>
                )}
                <p className="text-xs text-muted">
                  {members.length}/2명 · {couple.start_date ? "D-day 공유 중" : "함께한 날 미설정"}
                </p>
              </div>
            </div>

            {/* 대기중: 초대코드 공유 */}
            {waiting && (
              <div className="rounded-xl bg-white/60 p-4 text-center ring-1 ring-line">
                <p className="text-xs text-muted">이 코드를 상대에게 보내세요</p>
                <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-rose-deep">
                  {couple.invite_code}
                </p>
                <button
                  onClick={copyCode}
                  className="mt-2 rounded-full bg-rose/12 px-4 py-1.5 text-xs font-semibold text-rose-deep active:scale-95"
                >
                  {copied ? "복사됨 ✓" : "코드 복사"}
                </button>
              </div>
            )}

            {/* 쿡찌르기 */}
            {!waiting && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">쿡 찌르기</p>
                <div className="grid grid-cols-2 gap-2">
                  {POKE_KINDS.map((p) => (
                    <button
                      key={p.kind}
                      disabled={busy}
                      onClick={() => handlePoke(p.kind, p.message)}
                      className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm font-semibold text-ink ring-1 ring-line active:scale-[0.97] disabled:opacity-50"
                    >
                      <span className="text-lg">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="직접 메시지…"
                    maxLength={60}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customMsg.trim())
                        handlePoke("custom", customMsg.trim());
                    }}
                    className="flex-1 rounded-xl border border-line bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-rose"
                  />
                  <button
                    disabled={busy || !customMsg.trim()}
                    onClick={() => handlePoke("custom", customMsg.trim())}
                    className="rounded-xl bg-rose-deep px-4 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
                  >
                    보내기
                  </button>
                </div>
              </div>
            )}

            {/* 최근 쿡찌르기 */}
            {pokes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">최근 쿡찌르기</p>
                <ul className="space-y-1.5">
                  {pokes.slice(0, 6).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2 text-sm"
                    >
                      <span>{pokeEmoji(p.kind)}</span>
                      <span
                        className={`flex-1 truncate ${
                          p.from_user === uid ? "text-muted" : "font-semibold text-ink"
                        }`}
                      >
                        {p.from_user === uid ? "내가: " : "상대가: "}
                        {p.message ?? "콕!"}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {timeAgo(p.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 백그라운드 푸시 (앱 꺼져 있어도 알림) */}
            {isPushConfigured &&
              (pushOn ? (
                <p className="text-center text-xs text-muted">
                  🔔 백그라운드 푸시 켜짐 — 앱을 꺼놔도 쿡찌르기 알림이 와요
                </p>
              ) : (
                <button
                  onClick={handlePush}
                  disabled={pushBusy}
                  className="w-full rounded-xl border border-dashed border-rose/40 bg-white/40 px-4 py-3 text-left active:scale-[0.99] disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-rose-deep">
                    🔔 백그라운드 푸시 켜기
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {pushBusy
                      ? "설정 중…"
                      : "앱을 꺼놔도 쿡찌르기 알림을 받아요 (아이폰은 홈 화면에 추가 필요)"}
                  </span>
                </button>
              ))}

            <button
              onClick={handleLeave}
              className="w-full rounded-xl py-2 text-xs text-muted"
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
