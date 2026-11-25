"use client";

import { useState } from "react";
import { requestPasswordReset, signInEmail, signUpEmail, startGuest } from "@/lib/auth";
import { startSoloSpace } from "@/lib/couple";
import { GUEST_LOST_MESSAGE, hadGuest } from "@/lib/guest";
import {
  emailValidationMessage,
  newPasswordValidationMessage,
} from "@/lib/authPolicy";
import Icon from "@/components/Icon";
import { BASE } from "@/lib/base";

/** 로그인/회원가입 화면. 로그인 전에는 앱 기능을 못 쓰게 게이트로 사용.
 *  notice — 쓰던 중 세션이 풀려 돌아왔을 때의 안내(page.tsx · lib/session). 같은 계정으로 들어오면 기록이 그대로다.
 *  guestLost — 풀린 세션이 가입 없이 쓰던 것이었다(lib/guest). 이메일이 없으니 '같은 이메일로'라고 말하지 않는다.
 *  '혼자하기'(2026-11-25) — 가입 없이 바로 시작한다. 커플 연결 때만 가입을 받는다(CoupleSync · GuestSignup). */
export default function AuthGate({
  onAuthed,
  notice = null,
  guestLost = false,
}: {
  onAuthed: () => void;
  notice?: string | null;
  guestLost?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  // 이 기기에서 가입 없이 시작한 적이 있으면 한 번 더 묻는다 — 새로 누르면 빈 공간이 새로 생긴다(옛 기록으로 돌아가는 길이 아니다)
  const [guestAsk, setGuestAsk] = useState(false);

  /** 혼자하기 — 익명 계정을 만들고 바로 나 혼자인 공간까지 만든다(한 번 눌러 끝나게). 공간 만들기가 실패해도
   *  들어가면 기록 화면의 '혼자 시작하기'가 같은 일을 하므로 막지 않는다. 애칭 · 사귄 날은 이어지는 첫 화면에서 받는다. */
  async function goGuest(confirmed = false) {
    if (guestBusy || busy) return;
    if (!confirmed && hadGuest()) {
      setGuestAsk(true);
      return;
    }
    setGuestAsk(false);
    setGuestBusy(true);
    setErr(null);
    setMessage(null);
    try {
      await startGuest();
      await startSoloSpace("", null).catch(() => null);
      onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setGuestBusy(false);
    }
  }

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

      {/* 진짜 form [2026-11-09] — 예전엔 div 에 버튼 onClick 이라 이메일 칸에서 Enter 가 안 먹었고(비밀번호 칸만 onKeyDown),
          브라우저가 비밀번호 저장을 제안하지 않았다. 제출은 onSubmit 한 곳. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !email || (mode !== "forgot" && !pw)) return;
          void (mode === "forgot" ? sendReset() : submit());
        }}
        className="mt-8 space-y-3 rounded-[var(--radius-card)] bg-card glass p-6 shadow-[var(--shadow-md)] ring-1 ring-line"
      >
        {notice && (
          <p role="status" className="rounded-lg bg-rose/10 px-3 py-2 text-xs leading-relaxed text-rose-deep">
            {guestLost ? GUEST_LOST_MESSAGE : `${notice} 같은 이메일로 들어오면 기록이 그대로 있어요.`}
          </p>
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
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
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              aria-label="비밀번호"
              placeholder={mode === "signup" ? "비밀번호 (8자 이상 · 영문+숫자)" : "비밀번호"}
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
          type="submit"
          disabled={busy || !email || (mode !== "forgot" && !pw)}
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
      </form>

      {mode !== "forgot" && (
        <div className="guest-start mt-4 space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>
          {guestAsk ? (
            <div role="alertdialog" aria-label="새로 시작할까요" className="space-y-2 rounded-xl bg-rose/10 p-3">
              <p className="text-xs leading-relaxed text-rose-deep">
                이 기기에서 전에 가입 없이 쓰던 기록은 다시 열 수 없어요. 새로 누르면 빈 공간에서 다시 시작해요.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGuestAsk(false)} className="tap rounded-lg px-3 py-2 text-xs text-muted">
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void goGuest(true)}
                  className="tap flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white"
                >
                  새로 시작하기
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void goGuest()}
              disabled={guestBusy || busy}
              aria-busy={guestBusy}
              className="tap w-full rounded-2xl bg-card py-3.5 text-base font-bold text-rose-deep shadow-[var(--shadow-sm)] ring-1 ring-line disabled:opacity-50"
            >
              {guestBusy ? "준비하는 중…" : "가입 없이 혼자하기"}
            </button>
          )}
          <p className="text-center text-xs leading-relaxed text-muted">
            바로 시작하고, 커플을 연결할 때 가입하면 돼요. 가입 전 기록도 그대로 이어져요.
          </p>
        </div>
      )}

      {mode === "login" && (
        <button
          type="button"
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
        type="button"
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
      {/* 가입 전에 무엇을 저장하는지 볼 수 있게 — 하위 경로(/our-days) 배포라 BASE 를 붙인다 */}
      <a
        href={`${BASE}/privacy/`}
        className="tap mt-2 text-center text-xs font-semibold text-muted underline"
      >
        개인정보·데이터 관리 안내
      </a>
      <p className="mt-3 text-center text-sm text-muted">
        같은 이메일로 로그인하면 어느 기기에서든 그대로 이어져요.
      </p>
    </main>
  );
}
