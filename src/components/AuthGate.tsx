"use client";

import { useState } from "react";
import { requestPasswordReset, signInEmail, signUpEmail } from "@/lib/auth";
import {
  emailValidationMessage,
  newPasswordValidationMessage,
} from "@/lib/authPolicy";
import Icon from "@/components/Icon";

/** 로그인/회원가입 화면. 로그인 전에는 앱 기능을 못 쓰게 게이트로 사용. */
export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function submit() {
    const emailError = emailValidationMessage(email);
    const passwordError =
      mode === "signup"
        ? newPasswordValidationMessage(pw)
        : pw.length < 6
          ? "비밀번호는 6자 이상 입력해 주세요."
          : null;
    if (emailError || passwordError) {
      setErr(emailError ?? passwordError);
      return;
    }
    setBusy(true);
    setErr(null);
    setMessage(null);
    try {
      if (mode === "signup") await signUpEmail(email.trim(), pw);
      else await signInEmail(email.trim(), pw);
      onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function sendReset() {
    const emailError = emailValidationMessage(email);
    if (emailError) {
      setErr(emailError);
      return;
    }
    setBusy(true);
    setErr(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage("가입 여부와 관계없이, 계정이 있다면 복구 메일을 보냈어요. 메일함과 스팸함을 확인해 주세요.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reading mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pt-[env(safe-area-inset-top)]">
      <div className="animate-floaty flex justify-center text-rose-deep">
        <Icon name="heart" size={60} filled />
      </div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">하루</h1>
      <p className="mt-2 text-center text-sm text-muted">
        {mode === "login"
          ? "로그인하고 우리의 기록을 이어가요"
          : mode === "signup"
            ? "회원가입하고 둘만의 공간을 시작해요"
            : "복구 메일로 새 비밀번호를 설정해요"}
      </p>

      <div className="mt-8 space-y-3 rounded-[var(--radius-card)] bg-card glass p-6 shadow-[var(--shadow-md)] ring-1 ring-line">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          aria-label="이메일"
          placeholder="이메일"
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-ink outline-none focus:border-rose"
        />
        {mode !== "forgot" && (
          <div className="relative">
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              aria-label="비밀번호"
              placeholder={mode === "signup" ? "비밀번호 (8자 이상 · 영문+숫자)" : "비밀번호"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="w-full rounded-xl border border-line bg-glass py-2.5 pl-3 pr-16 text-ink outline-none focus:border-rose"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-pressed={showPassword}
              className="tap absolute inset-y-0 right-2 px-2 text-xs font-semibold text-muted"
            >
              {showPassword ? "숨기기" : "보기"}
            </button>
          </div>
        )}
        {err && (
          <p role="alert" className="text-xs text-rose-deep">
            {err}
          </p>
        )}
        {message && <p role="status" className="text-xs leading-relaxed text-emerald-700">{message}</p>}
        <button
          disabled={busy || !email || (mode !== "forgot" && !pw)}
          onClick={() => void (mode === "forgot" ? sendReset() : submit())}
          aria-busy={busy}
          className="w-full rounded-2xl bg-brand py-3.5 text-base font-bold text-white shadow-[var(--shadow-md)] tap disabled:opacity-40"
        >
          {busy
            ? "처리 중…"
            : mode === "login"
              ? "로그인"
              : mode === "signup"
                ? "회원가입"
                : "복구 메일 보내기"}
        </button>
      </div>

      {mode === "login" && (
        <button
          onClick={() => {
            setMode("forgot");
            setErr(null);
            setMessage(null);
          }}
          className="mt-3 text-center text-sm font-semibold text-muted tap"
        >
          비밀번호를 잊었어요
        </button>
      )}

      <button
        onClick={() => {
          setMode((m) => (m === "login" ? "signup" : "login"));
          setErr(null);
          setMessage(null);
          setPw("");
        }}
        className="mt-4 text-center text-sm font-semibold text-rose-deep tap"
      >
        {mode === "login" ? "계정이 없어요 · 회원가입" : "로그인으로 돌아가기"}
      </button>
      <p className="mt-3 text-center text-sm text-muted">
        같은 이메일로 로그인하면 어느 기기에서든 우리 커플이 이어져요.
      </p>
    </main>
  );
}
