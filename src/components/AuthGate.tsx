"use client";

import { useState } from "react";
import { signInEmail, signUpEmail } from "@/lib/auth";
import Icon from "@/components/Icon";

/** 로그인/회원가입 화면. 로그인 전에는 앱 기능을 못 쓰게 게이트로 사용. */
export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") await signUpEmail(email.trim(), pw);
      else await signInEmail(email.trim(), pw);
      onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pt-[env(safe-area-inset-top)]">
      <div className="animate-floaty flex justify-center text-rose-deep">
        <Icon name="heart" size={60} filled />
      </div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">우리의 하루</h1>
      <p className="mt-2 text-center text-sm text-muted">
        {mode === "login"
          ? "로그인하고 우리의 기록을 이어가요"
          : "회원가입하고 둘만의 공간을 시작해요"}
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
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          aria-label="비밀번호"
          placeholder="비밀번호 (6자 이상)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && email && pw.length >= 6) submit();
          }}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-ink outline-none focus:border-rose"
        />
        {err && (
          <p role="alert" className="text-xs text-rose-deep">
            {err}
          </p>
        )}
        <button
          disabled={busy || !email || pw.length < 6}
          onClick={submit}
          aria-busy={busy}
          className="w-full rounded-2xl bg-brand py-3.5 text-base font-bold text-white shadow-[var(--shadow-md)] tap disabled:opacity-40"
        >
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </div>

      <button
        onClick={() => {
          setMode((m) => (m === "login" ? "signup" : "login"));
          setErr(null);
        }}
        className="mt-4 text-center text-sm font-semibold text-rose-deep tap"
      >
        {mode === "login" ? "계정이 없어요 · 회원가입" : "이미 계정이 있어요 · 로그인"}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">
        같은 이메일로 로그인하면 어느 기기에서든 우리 커플이 이어져요.
      </p>
    </main>
  );
}
