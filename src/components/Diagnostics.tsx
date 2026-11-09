"use client";

import { useEffect, useState } from "react";
import { type DebugLog, type Diag, getDebugLogs, runDiagnostics } from "@/lib/debug";
import { isSupabaseConfigured } from "@/lib/couple";
import { nativePlatform } from "@/lib/nativeplatform";
import { nativePushView, type NativePushStatus } from "@/lib/nativepushstate";
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

/** 문제 해결 — 이 기기의 알림 경로 점검 + (접힌) 개발자용 기록. 설정 → 도움말 맨 아래.
 *  [2026-09-24] 예전 이름은 '푸시 진단 / 로그'였고 펼치면 서버 로그가 바로 보였다 — 개발자 화면이 그대로
 *  노출된 셈이라, 이름을 사용자의 말('알림이 안 올 때')로 바꾸고 로그는 한 겹 더 접었다. */
export default function Diagnostics() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [open, setOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* 앱(Capacitor) 안이면 웹 푸시가 아니라 FCM 으로 받는다 [2026-11-09]. 예전엔 앱에서도 웹 푸시 항목(서비스워커 · 구독 ·
     VAPID)을 그대로 보여 줘서 멀쩡한 안드로이드 앱이 전부 ✗ 였다. 앱이면 앱 알림 상태(nativepush)를 보여 준다. */
  const [platform, setPlatform] = useState<string | null>(null);
  const [native, setNative] = useState<NativePushStatus | null>(null);

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const where = nativePlatform();
      setPlatform(where);
      if (where === "android") {
        const { nativePushStatus } = await import("@/lib/nativepush");
        setNative(await nativePushStatus());
        setDiag(null);
      } else if (!where) {
        setDiag(await runDiagnostics());
      }
      setLogs(await getDebugLogs(20));
    } catch (e) {
      // 예전엔 catch 가 없어 실패하면 빈 칸만 남았다 — 무엇이 안 됐는지 말한다
      setErr(e instanceof Error && e.message ? `점검하지 못했어요: ${e.message}` : "점검하지 못했어요. 연결을 확인하고 다시 확인을 눌러 주세요.");
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
        aria-expanded={open}
        className="tap flex w-full items-center justify-between gap-2 text-left text-xs font-bold text-ink"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon name="stethoscope" size={15} />
          문제 해결
          <span className="truncate font-medium text-muted">· 알림이 안 올 때</span>
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {platform === "ios" && (
            <p className="rounded-lg bg-glass p-2 text-xs leading-relaxed text-muted ring-1 ring-line">
              아이폰 앱에서는 푸시 알림을 받을 수 없어요. 알림이 필요하면 사파리에서 하루를 열고 공유 → 홈 화면에 추가로 설치해 주세요.
            </p>
          )}
          {platform === "android" && native && (
            <div className="space-y-1 rounded-lg bg-glass p-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              <Row ok={native.permission === "granted"} label="앱 알림 권한" note={native.permission} />
              <Row ok={!!native.token} label="이 기기 알림 토큰(FCM)" />
              <Row ok={native.registered} label="서버 등록" />
              <p className="pt-1 text-xs leading-relaxed text-muted">{nativePushView(native).text}</p>
            </div>
          )}
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
                  note={diag.standalone ? "설치됨" : "미설치, 홈화면 추가 필요"}
                />
              )}
            </div>
          )}
          {err && (
            <p role="alert" className="text-xs text-rose-deep">
              {err}
            </p>
          )}
          <button
            onClick={() => void refresh()}
            disabled={busy}
            className="tap w-full rounded-lg bg-glass py-1.5 text-xs font-semibold text-rose-deep ring-1 ring-line disabled:opacity-50"
          >
            {busy ? "확인 중…" : "다시 확인"}
          </button>
          {/* 개발자용 기록 — 문의할 때 보여 줄 용도라 한 겹 더 접는다 */}
          {logs.length > 0 && (
            <button
              onClick={() => setShowLogs((v) => !v)}
              aria-expanded={showLogs}
              className="tap w-full text-center text-xs font-semibold text-muted"
            >
              {showLogs ? "개발자용 기록 접기" : "개발자용 기록 보기"}
            </button>
          )}
          {showLogs && logs.length > 0 && (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-glass2 p-2 ring-1 ring-line shadow-[var(--shadow-sm)]">
              {logs.map((l) => (
                <div key={l.id} className="text-xs leading-tight text-muted">
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
