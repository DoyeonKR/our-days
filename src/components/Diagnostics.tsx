"use client";

import { useEffect, useState } from "react";
import { type DebugLog, type Diag, getDebugLogs, runDiagnostics } from "@/lib/debug";
import { isSupabaseConfigured } from "@/lib/couple";
import Icon from "@/components/Icon";

function Row({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon
        name={ok ? "circleCheck" : "circleX"}
        size={15}
        className={ok ? "text-emerald-500" : "text-rose-deep"}
      />
      <span className="text-ink">{label}</span>
      {note && <span className="text-muted">· {note}</span>}
    </div>
  );
}

/** 푸시 파이프라인 진단 + 최근 로그 (설정에서 펼침). */
export default function Diagnostics() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      setDiag(await runDiagnostics());
      setLogs(await getDebugLogs(20));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!isSupabaseConfigured) return null;

  return (
    <div className="rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap flex w-full items-center justify-between text-xs font-bold text-ink"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="stethoscope" size={15} />
          푸시 진단 / 로그
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {diag && (
            <div className="space-y-1 rounded-lg bg-glass p-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              <Row ok={diag.pushSupported} label="브라우저 푸시 지원" />
              <Row
                ok={diag.permission === "granted"}
                label="알림 권한"
                note={diag.permission}
              />
              <Row ok={diag.swRegistered} label="서비스워커 등록" />
              <Row ok={diag.subscribed} label="푸시 구독 생성" />
              <Row ok={diag.savedInDb} label="구독 서버 저장" />
              <Row ok={diag.vapidPresent} label="VAPID 키" />
              {diag.ios && (
                <Row
                  ok={diag.standalone}
                  label="아이폰 홈화면 앱"
                  note={diag.standalone ? "설치됨" : "미설치 — 홈화면 추가 필요"}
                />
              )}
            </div>
          )}
          <button
            onClick={refresh}
            disabled={busy}
            className="tap w-full rounded-lg bg-glass py-1.5 text-xs font-semibold text-rose-deep ring-1 ring-line disabled:opacity-50"
          >
            {busy ? "확인 중…" : "진단 새로고침"}
          </button>
          {logs.length > 0 && (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-glass2 p-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              <p className="text-[10px] font-semibold text-muted">최근 로그</p>
              {logs.map((l) => (
                <div key={l.id} className="text-[10px] leading-tight text-muted">
                  <span className="font-semibold text-ink">{l.tag}</span>{" "}
                  {l.detail ? l.detail.slice(0, 140) : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
