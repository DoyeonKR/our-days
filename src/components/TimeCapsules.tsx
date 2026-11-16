"use client";

/* 기록 › 추억 맨 위 — 타임캡슐 편지(2026-11-13). README §10.26
 *
 * 한 사람이 편지를 쓰고 여는 날(내일 ~ 10년 뒤)을 고른다. 여는 날 전엔 받는 사람에게 봉인된 카드(보낸 사람 · 여는 날 · D-day)만
 * 보인다 — 본문 · 사진은 서버가 안 준다(lib/capsuleData 머리 주석). 여는 날이 오면 활동함 🔔 에 한 줄이 오고, 처음 열 때
 * 이 기기에서 한 번 봉투가 열리는 연출(움직임 줄이기면 바로 편지)을 보여 준 뒤 편지와 '답장 쓰기'.
 * 보낸 사람은 여는 날 전까지 고치거나 지울 수 있다(서버 정책이 같은 규칙을 강제한다).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Member } from "@/lib/couple";
import {
  CAPSULE_MAX_BODY,
  capsuleBodyError,
  capsuleDdayLabel,
  capsuleKstDay,
  capsuleMaxDate,
  capsuleMinDate,
  capsuleQuickPicks,
  capsuleToday,
  formatCapsuleDate,
  splitCapsules,
  validOpenOn,
} from "@/lib/capsule";
import {
  CapsuleUnavailableError,
  deleteTimeCapsule,
  listTimeCapsules,
  saveTimeCapsule,
  signedCapsulePhotoUrls,
  type TimeCapsule,
} from "@/lib/capsuleData";
import { confirmDialog } from "@/lib/confirm";
import { useDayTick } from "@/lib/useDayTick";
import { useDialogFocus } from "@/lib/useDialogFocus";
import Sheet from "@/components/Sheet";
import Icon from "@/components/Icon";
import { CloseButton } from "@/components/AppButtons";

const SEEN_KEY = (coupleId: string) => `ourdays:capsule-seen:${coupleId}`;

function readSeen(coupleId: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY(coupleId)) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function writeSeen(coupleId: string, seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY(coupleId), JSON.stringify([...seen].slice(-200)));
  } catch {
    /* 연출을 한 번 더 볼 뿐이다 */
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Compose = { mode: "new" } | { mode: "edit"; capsule: TimeCapsule } | { mode: "reply"; to: TimeCapsule };

export default function TimeCapsules({
  coupleId,
  members,
  myUserId,
  startDate,
  focusReq,
  onFocusHandled,
  refreshKey,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
  /** 사귄 날 — 빠른 선택(다음 주년 · 100일 단위) */
  startDate: string | null;
  /** 활동함 · 알림 → 그 편지 카드(lib/activity 의 focus 규약) */
  focusReq: { id: string; ts: number } | null;
  onFocusHandled: () => void;
  /** 활동함에 새 타임캡슐 줄이 오면 바뀐다 — 상대가 묻은 봉인 카드는 표 구독으로 안 오니(본문이 안 보이는 행) 이걸로 다시 읽는다 */
  refreshKey: string | null;
}) {
  const tick = useDayTick();
  const [today, setToday] = useState(() => capsuleToday());
  useEffect(() => setToday(capsuleToday()), [tick]);
  const [list, setList] = useState<TimeCapsule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [reading, setReading] = useState<TimeCapsule | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setSeen(readSeen(coupleId)), [coupleId]);

  const load = useCallback(async () => {
    try {
      const rows = await listTimeCapsules(coupleId);
      setList(rows);
      setError(null);
      setUnavailable(false);
    } catch (e) {
      if (e instanceof CapsuleUnavailableError) setUnavailable(true);
      else setError(e instanceof Error ? e.message : "편지를 불러오지 못했어요");
    }
  }, [coupleId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, tick]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const nameOf = useCallback(
    (uid: string) => (uid === myUserId ? "나" : members.find((m) => m.user_id === uid)?.nickname?.trim() || "상대"),
    [members, myUserId],
  );
  const partner = members.find((m) => m.user_id !== myUserId)?.nickname?.trim() || null;

  const { sealed, opened } = useMemo(() => splitCapsules(list ?? [], today), [list, today]);

  const openLetter = useCallback(
    (c: TimeCapsule) => {
      setReading(c);
    },
    [],
  );
  const markSeen = useCallback(
    (id: string) => {
      setSeen((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        writeSeen(coupleId, next);
        return next;
      });
    },
    [coupleId],
  );

  // 알림 · 활동함에서 온 카드 — 목록이 오면 그 카드로 스크롤하고, 열린 편지면 바로 연다
  useEffect(() => {
    if (!focusReq || !list) return;
    const c = list.find((x) => x.id === focusReq.id);
    onFocusHandled();
    if (!c) return;
    setFlash(c.id);
    window.setTimeout(() => setFlash((f) => (f === c.id ? null : f)), 1600);
    requestAnimationFrame(() => document.getElementById(`capsule-${c.id}`)?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" }));
    if (!(c.openOn > today) && c.body != null) openLetter(c);
  }, [focusReq, list, today, onFocusHandled, openLetter]);

  async function remove(c: TimeCapsule) {
    const ok = await confirmDialog({
      message: "이 편지를 지울까요?",
      detail: "지운 편지는 되살릴 수 없어요. 상대 화면의 봉인 카드도 함께 사라져요.",
      confirmText: "지우기",
      cancelText: "그대로 두기",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await deleteTimeCapsule(c);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "지우지 못했어요");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="capsule-title" className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-rose-deep">정한 날에 열리는 편지</p>
          <h2 id="capsule-title" className="mt-0.5 text-base font-extrabold text-ink">타임캡슐 편지</h2>
        </div>
        {!unavailable && (
          <button
            onClick={() => setCompose({ mode: "new" })}
            className="tap inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-2 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
          >
            <Icon name="mail" size={16} />
            편지 묻기
          </button>
        )}
      </div>

      {unavailable && <p className="mt-3 rounded-xl bg-glass2 px-3 py-3 text-xs text-muted">타임캡슐을 준비하고 있어요. 잠시 후 다시 열어 주세요.</p>}
      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-deep">
          <span className="min-w-0 flex-1">{error}</span>
          <button onClick={() => void load()} className="tap shrink-0 font-bold underline">
            다시 시도
          </button>
        </p>
      )}
      {!unavailable && list === null && !error && <p className="mt-3 text-xs text-muted" role="status">편지함을 여는 중…</p>}
      {list && list.length === 0 && (
        <p className="mt-3 rounded-xl bg-glass2 px-3 py-4 text-center text-xs leading-relaxed text-muted">
          아직 묻어 둔 편지가 없어요.
          <br />
          다음 기념일에 열릴 편지를 남겨 봐요.
        </p>
      )}

      {sealed.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold text-muted">봉인된 편지 {sealed.length}</p>
          <ul className="space-y-2">
            {sealed.map((c) => {
              const mine = c.createdBy === myUserId;
              return (
                <li
                  key={c.id}
                  id={`capsule-${c.id}`}
                  className={`capsule-card is-sealed rounded-xl bg-glass2 px-3 py-2.5 ring-1 ring-line ${flash === c.id ? "capsule-flash" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="capsule-seal grid size-10 shrink-0 place-items-center rounded-full text-rose-deep" aria-hidden>
                      <Icon name="lock" size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{mine ? (partner ? `${partner}님에게 묻은 편지` : "미래의 나에게 묻은 편지") : `${nameOf(c.createdBy)}님이 보낸 편지`}</p>
                      <p className="text-xs text-muted">
                        {formatCapsuleDate(c.openOn)}에 열려요{c.hasPhoto ? " · 사진 한 장" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-rose/10 px-2 py-1 text-xs font-bold text-rose-deep">{capsuleDdayLabel(c.openOn, today)}</span>
                  </div>
                  {mine && (
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        disabled={busyId === c.id}
                        onClick={() => setCompose({ mode: "edit", capsule: c })}
                        className="tap inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-50"
                      >
                        <Icon name="pencil" size={14} />
                        고치기
                      </button>
                      <button
                        disabled={busyId === c.id}
                        onClick={() => void remove(c)}
                        className="tap inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-rose-deep ring-1 ring-rose/40 disabled:opacity-50"
                      >
                        <Icon name="trash" size={14} />
                        지우기
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {opened.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold text-muted">열린 편지 {opened.length}</p>
          <ul className="space-y-2">
            {opened.map((c) => {
              const mine = c.createdBy === myUserId;
              const fresh = !mine && !seen.has(c.id);
              return (
                <li key={c.id} id={`capsule-${c.id}`} className={flash === c.id ? "capsule-flash rounded-xl" : ""}>
                  <button
                    onClick={() => openLetter(c)}
                    className="tap flex w-full items-center gap-3 rounded-xl bg-glass2 px-3 py-2.5 text-left ring-1 ring-line"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose/10 text-rose-deep" aria-hidden>
                      <Icon name="mail" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {mine ? "내가 묻었던 편지" : `${nameOf(c.createdBy)}님의 편지`}
                        {fresh && <span className="ml-1 whitespace-nowrap text-xs text-rose-deep">· 새로 열림</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {formatCapsuleDate(c.openOn)}에 열렸어요 · {formatCapsuleDate(capsuleKstDay(c.createdAt))}에 묻음
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {compose && (
        <CapsuleComposer
          key={compose.mode === "edit" ? compose.capsule.id : compose.mode}
          compose={compose}
          coupleId={coupleId}
          today={today}
          startDate={startDate}
          recipient={compose.mode === "reply" ? nameOf(compose.to.createdBy) : partner}
          onClose={() => setCompose(null)}
          onSaved={() => {
            setCompose(null);
            void load();
          }}
        />
      )}
      {reading && (
        <CapsuleReader
          capsule={reading}
          sender={reading.createdBy === myUserId ? "나" : nameOf(reading.createdBy)}
          animate={reading.createdBy !== myUserId && !seen.has(reading.id)}
          canReply={reading.createdBy !== myUserId}
          onSeen={() => markSeen(reading.id)}
          onClose={() => setReading(null)}
          onReply={() => {
            const to = reading;
            setReading(null);
            setCompose({ mode: "reply", to });
          }}
        />
      )}
    </section>
  );
}

function CapsuleComposer({
  compose,
  coupleId,
  today,
  startDate,
  recipient,
  onClose,
  onSaved,
}: {
  compose: Compose;
  coupleId: string;
  today: string;
  startDate: string | null;
  recipient: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = compose.mode === "edit" ? compose.capsule : null;
  const picks = useMemo(() => capsuleQuickPicks(today, startDate), [today, startDate]);
  const [body, setBody] = useState(editing?.body ?? "");
  const [openOn, setOpenOn] = useState(editing?.openOn ?? picks[0]?.date ?? capsuleMinDate(today));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const length = [...body].length;

  useEffect(() => {
    if (!editing?.photoPath) return;
    let alive = true;
    void signedCapsulePhotoUrls([editing.photoPath]).then((m) => alive && setExistingUrl(m[editing.photoPath!] ?? null));
    return () => {
      alive = false;
    };
  }, [editing?.photoPath]);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const dirty = body !== (editing?.body ?? "") || !!photo || dropPhoto || (editing ? openOn !== editing.openOn : false);
  async function requestClose() {
    if (busy) return;
    if (dirty && !(await confirmDialog({ message: "쓰던 편지를 닫을까요?", detail: "닫으면 쓰던 내용이 사라져요.", confirmText: "닫기", cancelText: "계속 쓰기" }))) return;
    onClose();
  }

  async function save() {
    const bodyErr = capsuleBodyError(body);
    if (bodyErr) return setErr(bodyErr);
    if (!validOpenOn(openOn, today)) return setErr("여는 날은 내일부터 10년 뒤까지 고를 수 있어요");
    setBusy(true);
    setErr(null);
    try {
      await saveTimeCapsule({
        id: editing?.id,
        coupleId,
        openOn,
        body,
        photo,
        dropPhoto,
        prevPhotoPath: editing?.photoPath ?? null,
        replyTo: compose.mode === "reply" ? compose.to.id : null,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  const shownPhoto = preview ?? (dropPhoto ? null : existingUrl);
  const title = editing ? "편지 고치기" : compose.mode === "reply" ? "답장 묻기" : "타임캡슐 편지 쓰기";
  const who = recipient ? `${recipient}님` : "미래의 나";
  const whoTopic = recipient ? `${recipient}님은` : "미래의 나는";
  return (
    <Sheet
      title={title}
      onClose={() => void requestClose()}
      footer={
        <div className="space-y-2">
          {err && (
            <p role="alert" className="text-xs text-rose-deep">
              {err}
            </p>
          )}
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted">{formatCapsuleDate(openOn)}에 열려요</p>
            <button
              disabled={busy}
              onClick={() => void save()}
              className="shrink-0 rounded-2xl bg-brand px-6 py-3.5 font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {busy ? "묻는 중…" : editing ? "고쳐 저장" : "편지 묻기"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-glass2 px-3 py-2 text-xs leading-relaxed text-muted ring-1 ring-line">
          여는 날 전까지 {whoTopic} 보낸 사람과 여는 날만 볼 수 있어요. 내용과 사진은 그날 열려요. 열리기 전까지는 고치거나 지울 수 있어요.
        </p>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">여는 날</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="여는 날 빠른 선택">
            {picks.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={openOn === p.date}
                onClick={() => setOpenOn(p.date)}
                className={`tap rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${openOn === p.date ? "bg-brand text-white ring-transparent" : "text-ink ring-line"}`}
              >
                {p.label} · {p.date.slice(2).replaceAll("-", ".")}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={openOn}
            min={capsuleMinDate(today)}
            max={capsuleMaxDate(today)}
            onChange={(e) => setOpenOn(e.target.value)}
            disabled={busy}
            aria-label="여는 날 직접 고르기"
            className="mt-2 w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
          />
        </div>
        <div>
          <label htmlFor="capsule-body" className="mb-1.5 block text-xs font-semibold text-muted">
            편지
          </label>
          <textarea
            id="capsule-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            rows={8}
            placeholder={`${who}에게 그날 전하고 싶은 말을 적어요`}
            className="reading w-full resize-none rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
          />
          <p className={`mt-1 text-right text-xs ${length > CAPSULE_MAX_BODY ? "text-rose-deep" : "text-muted"}`} aria-live="polite">
            {length.toLocaleString("ko-KR")} / {CAPSULE_MAX_BODY.toLocaleString("ko-KR")}
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">사진 (선택)</p>
          {shownPhoto ? (
            <div className="relative overflow-hidden rounded-xl ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownPhoto} alt="편지에 넣을 사진" className="max-h-56 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setDropPhoto(true);
                }}
                className="tap absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white"
              >
                사진 빼기
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="tap inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-50"
            >
              <Icon name="image" size={16} />
              사진 넣기
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f) {
                setPhoto(f);
                setDropPhoto(false);
              }
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}

type Stage = "sealed" | "opening" | "letter";

function CapsuleReader({
  capsule,
  sender,
  animate,
  canReply,
  onSeen,
  onClose,
  onReply,
}: {
  capsule: TimeCapsule;
  sender: string;
  animate: boolean;
  canReply: boolean;
  onSeen: () => void;
  onClose: () => void;
  onReply: () => void;
}) {
  const ref = useDialogFocus(true, onClose);
  const [stage, setStage] = useState<Stage>(() => (animate && !reducedMotion() ? "sealed" : "letter"));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const seenRef = useRef(onSeen);
  useEffect(() => {
    seenRef.current = onSeen;
  }, [onSeen]);

  useEffect(() => {
    seenRef.current();
  }, []);
  useEffect(() => {
    if (stage === "letter") return;
    const a = window.setTimeout(() => setStage("opening"), 350);
    const b = window.setTimeout(() => setStage("letter"), 1500);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // 한 번만 — 연출 도중 다시 그려도 타이머를 새로 걸지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!capsule.photoPath) return;
    let alive = true;
    void signedCapsulePhotoUrls([capsule.photoPath]).then((m) => alive && setPhotoUrl(m[capsule.photoPath!] ?? null));
    return () => {
      alive = false;
    };
  }, [capsule.photoPath]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${sender === "나" ? "내가 묻었던" : `${sender}님의`} 타임캡슐 편지`}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-md flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {stage !== "letter" ? (
          <button
            type="button"
            onClick={() => setStage("letter")}
            className={`capsule-envelope tap mx-auto ${stage === "opening" ? "is-opening" : ""}`}
            aria-label="편지 펼치기"
          >
            <span className="capsule-envelope-back" aria-hidden />
            <span className="capsule-envelope-paper" aria-hidden />
            <span className="capsule-envelope-front" aria-hidden />
            <span className="capsule-envelope-flap" aria-hidden />
            <span className="capsule-envelope-seal" aria-hidden>
              <Icon name="heart" size={18} filled />
            </span>
          </button>
        ) : (
          <article className="capsule-letter flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-lg)] ring-1 ring-line">
            <header className="flex items-start justify-between gap-2 border-b border-line px-4 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-deep">{formatCapsuleDate(capsule.openOn)}에 열린 편지</p>
                <h3 className="mt-0.5 text-base font-extrabold text-ink">{sender === "나" ? "내가 묻었던 편지" : `${sender}님이 보낸 편지`}</h3>
                <p className="text-xs text-muted">{formatCapsuleDate(capsuleKstDay(capsule.createdAt))}에 묻음</p>
              </div>
              <CloseButton onClose={onClose} />
            </header>
            <div className="reading min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {capsule.body != null ? (
                <p className="whitespace-pre-wrap break-words text-base text-ink">{capsule.body}</p>
              ) : (
                <p className="text-sm text-muted">편지를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
              )}
              {capsule.photoPath &&
                (photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="편지와 함께 묻은 사진" className="mt-4 w-full rounded-xl object-cover ring-1 ring-line" />
                ) : (
                  <div className="mt-4 h-40 w-full animate-pulse rounded-xl bg-glass2" aria-label="사진을 불러오는 중" />
                ))}
            </div>
            {canReply && (
              <footer className="border-t border-line px-4 py-3">
                <button onClick={onReply} className="tap inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand px-4 py-3 font-bold text-white shadow-[var(--shadow-md)]">
                  <Icon name="send" size={16} />
                  답장 묻기
                </button>
              </footer>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
