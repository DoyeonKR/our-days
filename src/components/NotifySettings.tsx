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

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** 알림 세부 설정 — 이벤트 카테고리별 on/off + 조용시간(방해금지, KST). */
export default function NotifySettings() {
  const [p, setP] = useState<NotifyPrefs>({
    prefs: {},
    quiet_start: null,
    quiet_end: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getMyNotifyPrefs()
      .then((v) => setP(v))
      .catch(() => {})
      .finally(() => setLoaded(true));
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // 변경은 0.6초 디바운스 자동 저장
  function update(next: NotifyPrefs) {
    setP(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMyNotifyPrefs(next)
        .then(() => {
          setSaved(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setSaved(false), 1500);
        })
        .catch(() => {});
    }, 600);
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
        {saved && (
          <span className="animate-pop text-[10px] font-semibold text-emerald-600">
            저장됨 ✓
          </span>
        )}
      </p>

      {!loaded ? (
        <p className="py-2 text-center text-xs text-muted">불러오는 중…</p>
      ) : (
        <>
          <ul className="space-y-1">
            {NOTIFY_CATEGORIES.map((c) => {
              const on = p.prefs[c.key] !== false;
              return (
                <li key={c.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{c.label}</p>
                    <p className="text-[10px] text-muted">{c.desc}</p>
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
                <p className="text-[10px] text-muted">
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
        </>
      )}
    </div>
  );
}
