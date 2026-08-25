"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { changePassword, consumePasswordRecoveryUrl } from "@/lib/auth";
import { newPasswordValidationMessage } from "@/lib/authPolicy";
import { BASE } from "@/lib/base";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    consumePasswordRecoveryUrl(window.location.href)
      .then(() => {
        history.replaceState(null, "", `${BASE}/reset-password/`);
        setReady(true);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "복구 링크를 확인하지 못했어요.");
      });
  }, []);

  async function submit() {
    const validation = newPasswordValidationMessage(password);
    if (validation) {
      setError(validation);
      return;
    }
    if (password !== confirm) {
      setError("새 비밀번호가 서로 일치하지 않아요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(password);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "비밀번호를 바꾸지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reading mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pt-[env(safe-area-inset-top)]">
      <div className="flex justify-center text-rose-deep">
        <Icon name="lock" size={52} />
      </div>
      <h1 className="mt-5 text-center text-2xl font-extrabold text-ink">새 비밀번호 설정</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted">
        새 비밀번호는 8자 이상, 영문과 숫자를 함께 사용해 주세요.
      </p>

      <section className="mt-8 space-y-3 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-md)] ring-1 ring-line">
        {!ready && !error && <p role="status" className="text-center text-sm text-muted">복구 링크를 확인하는 중…</p>}

        {ready && !done && (
          <>
            <div className="relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-label="새 비밀번호"
                placeholder="새 비밀번호"
                className="w-full rounded-xl border border-line bg-glass py-3 pl-3 pr-16 text-ink outline-none focus:border-rose"
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                className="tap absolute inset-y-0 right-2 px-2 text-xs font-semibold text-muted"
              >
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-label="새 비밀번호 확인"
              placeholder="새 비밀번호 확인"
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              className="w-full rounded-xl border border-line bg-glass px-3 py-3 text-ink outline-none focus:border-rose"
            />
            <button
              onClick={() => void submit()}
              disabled={busy || !password || !confirm}
              className="tap w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-45"
            >
              {busy ? "변경 중…" : "비밀번호 바꾸기"}
            </button>
          </>
        )}

        {error && <p role="alert" className="text-sm leading-relaxed text-rose-deep">{error}</p>}
        {done && (
          <div className="space-y-4 text-center">
            <p role="status" className="text-sm font-semibold text-emerald-700">비밀번호를 바꿨어요.</p>
            <a href={`${BASE}/`} className="tap block rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)]">
              하루로 돌아가기
            </a>
          </div>
        )}
        {!ready && error && (
          <a href={`${BASE}/`} className="tap block rounded-xl bg-glass px-3 py-3 text-center text-sm font-bold text-rose-deep ring-1 ring-line">
            로그인 화면으로 돌아가기
          </a>
        )}
      </section>
    </main>
  );
}
