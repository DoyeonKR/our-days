"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOTIFY_CATEGORIES,
  type NotifyPrefs,
  getMyNotifyPrefs,
  saveMyNotifyPrefs,
} from "@/lib/notify";
import { isSupabaseConfigured } from "@/lib/couple";
import Icon from "@/components/Icon";
import SaveStatus, { type SaveFeedback } from "@/components/SaveStatus";
import { useMountedRef } from "@/lib/useMountedRef";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** 알림 세부 설정 — 이벤트 카테고리별 on/off + 조용시간(방해금지, KST). */
export default function NotifySettings() {
  const [p, setP] = useState<NotifyPrefs>({
    prefs: {},
    quiet_start: null,
    quiet_end: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback>({ phase: "idle" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRevision = useRef(0);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const latestPrefs = useRef(p);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    getMyNotifyPrefs()
      .then((value) => {
        if (!alive) return;
        latestPrefs.current = value;
        setP(value);
      })
      .catch(() => {
        if (!alive) return;
        setLoadFailed(true);
        setFeedback({ phase: "error", message: "알림 설정을 불러오지 못했어요" });
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        const flush = async () => {
          try {
            await saveMyNotifyPrefs(latestPrefs.current);
          } catch {
            // 시트가 이미 닫혀 표시할 곳이 없다. 다음 진입 때 서버 정본을 다시 읽는다.
          }
        };
        // 이미 시작한 저장보다 늦게 실행해 오래된 요청이 마지막 값을 덮지 않게 한다.
        saveChain.current = saveChain.current.then(flush, flush);
      }
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  async function reloadPrefs() {
    setLoaded(false);
    setLoadFailed(false);
    setFeedback({ phase: "idle" });
    try {
      const value = await getMyNotifyPrefs();
      if (!mounted.current) return;
      latestPrefs.current = value;
      setP(value);
    } catch {
      if (!mounted.current) return;
      setLoadFailed(true);
      setFeedback({ phase: "error", message: "알림 설정을 불러오지 못했어요" });
    } finally {
      if (mounted.current) setLoaded(true);
    }
  }

  function queueSave(next: NotifyPrefs, revision: number) {
    const run = async () => {
      try {
        await saveMyNotifyPrefs(next);
        if (!mounted.current || revision !== saveRevision.current) return;
        setFeedback({ phase: "saved", message: "알림 설정 저장 완료" });
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(
          () => setFeedback({ phase: "idle" }),
          1800,
        );
      } catch {
        if (!mounted.current || revision !== saveRevision.current) return;
        setFeedback({ phase: "error", message: "저장하지 못했어요. 다시 시도해 주세요" });
      }
    };
    // 느린 첫 요청이 나중 요청을 덮지 않게 서버 쓰기 순서를 직렬화한다.
    saveChain.current = saveChain.current.then(run, run);
  }

  // 변경은 0.6초 디바운스 자동 저장
  function update(next: NotifyPrefs) {
    setP(next);
    latestPrefs.current = next;
    const revision = ++saveRevision.current;
    setFeedback({ phase: "saving", message: "변경사항 저장 대기 중…" });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setFeedback({ phase: "saving", message: "알림 설정 저장 중…" });
      queueSave(next, revision);
    }, 600);
  }

  function retrySave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const revision = ++saveRevision.current;
    setFeedback({ phase: "saving", message: "알림 설정 다시 저장 중…" });
    queueSave(latestPrefs.current, revision);
  }

  if (!isSupabaseConfigured) return null;

  const quietOn = p.quiet_start !== null && p.quiet_end !== null;

  return (
    <div className="space-y-2.5 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
      <p className="flex items-center justify-between text-xs font-bold text-ink">
        <span className="flex items-center gap-1.5">
          <Icon name="bell" size={15} />
          알림 종류별 설정
        </span>
        <SaveStatus feedback={feedback} />
      </p>

      {!loaded ? (
        <p className="py-2 text-center text-xs text-muted">불러오는 중…</p>
      ) : loadFailed ? (
        <div className="rounded-xl bg-rose/10 px-3 py-3 text-center">
          <p className="text-xs text-rose-deep">기존 값을 덮지 않도록 편집을 잠시 멈췄어요.</p>
          <button
            type="button"
            onClick={() => void reloadPrefs()}
            className="tap mt-2 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-rose-deep ring-1 ring-line"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-1">
            {NOTIFY_CATEGORIES.map((c) => {
              const on = p.prefs[c.key] !== false;
              return (
                <li key={c.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{c.label}</p>
                    <p className="text-xs text-muted">{c.desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`${c.label} 알림`}
                    onClick={() =>
                      update({
                        ...p,
                        prefs: { ...p.prefs, [c.key]: on ? false : true },
                      })
                    }
                    className={`tap relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      on ? "bg-rose-deep" : "bg-line-strong"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        on ? "left-[1.4rem]" : "left-0.5"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 조용시간 */}
          <div className="border-t border-line pt-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink">조용시간 (방해금지)</p>
                <p className="text-xs text-muted">
                  이 시간엔 모든 푸시를 보내지 않아요
                </p>
              </div>
              <button
                role="switch"
                aria-checked={quietOn}
                aria-label="조용시간"
                onClick={() =>
                  update(
                    quietOn
                      ? { ...p, quiet_start: null, quiet_end: null }
                      : { ...p, quiet_start: 23, quiet_end: 8 },
                  )
                }
                className={`tap relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  quietOn ? "bg-rose-deep" : "bg-line-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    quietOn ? "left-[1.4rem]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {quietOn && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink">
                <select
                  value={p.quiet_start ?? 23}
                  onChange={(e) => update({ ...p, quiet_start: Number(e.target.value) })}
                  aria-label="조용시간 시작"
                  className="rounded-lg border border-line bg-glass px-2 py-1.5 outline-none"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
                부터
                <select
                  value={p.quiet_end ?? 8}
                  onChange={(e) => update({ ...p, quiet_end: Number(e.target.value) })}
                  aria-label="조용시간 끝"
                  className="rounded-lg border border-line bg-glass px-2 py-1.5 outline-none"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
                까지
              </div>
            )}
          </div>
          {feedback.phase === "error" && (
            <button
              type="button"
              onClick={retrySave}
              className="tap w-full rounded-xl bg-rose/10 px-3 py-2 text-xs font-bold text-rose-deep ring-1 ring-rose/20"
            >
              변경사항 다시 저장
            </button>
          )}
        </>
      )}
    </div>
  );
}
