"use client";

import { useState } from "react";
import { upgradeGuest } from "@/lib/auth";
import { emailValidationMessage, newPasswordValidationMessage } from "@/lib/authPolicy";
import { GUEST_RISK_LINE, guestUpgradeError } from "@/lib/guest";

/** 가입 없이 쓰는 사람의 가입 카드(lib/guest) — 지금 계정에 이메일 · 비밀번호를 붙인다. 기록은 그대로다.
 *  reason: connect — 커플 연결(코드 만들기 · 합류 · 초대 링크)은 가입한 뒤에만. account — 설정 › 계정. */
export default function GuestSignup({ reason }: { reason: "connect" | "account" }) {
  const [open, setOpen] = useState(reason === "connect");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const invalid = emailValidationMessage(email) ?? newPasswordValidationMessage(pw);
    if (invalid) return setErr(invalid);
    setBusy(true);
    setErr(null);
    try {
      await upgradeGuest(email.trim(), pw);
      window.location.reload();
    } catch (e) {
      setErr(guestUpgradeError(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  return (
    <div className="guest-signup space-y-2 rounded-xl bg-glass p-3 ring-1 ring-line">
      <p className="text-sm font-bold text-ink">
        {reason === "connect" ? "커플 연결은 가입하고 해요" : "가입 없이 쓰는 중"}
      </p>
      <p className="text-xs leading-relaxed text-muted">
        {reason === "connect"
          ? "이메일과 비밀번호만 정하면 돼요. 지금까지 남긴 기록은 그대로 이어지고, 가입하면 바로 코드를 만들거나 받은 코드로 합류할 수 있어요."
          : "가입하면 지금까지의 기록이 그대로 이어지고, 다른 기기에서도 같은 이메일로 열려요."}
      </p>
      <p className="text-xs leading-relaxed text-rose-deep">{GUEST_RISK_LINE}</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap w-full rounded-lg bg-brand py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)]"
        >
          가입하고 기록 지키기
        </button>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && email && pw) void submit();
          }}
          className="space-y-2"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            aria-label="가입할 이메일"
            placeholder="이메일"
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-rose"
          />
          <div className="relative">
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              aria-label="새 비밀번호"
              placeholder="비밀번호 (8자 이상 · 영문+숫자)"
              className="w-full rounded-lg border border-line bg-card py-2.5 pl-3 pr-16 text-sm text-ink outline-none focus:border-rose"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="tap absolute inset-y-0 right-2 px-2 text-xs font-semibold text-muted"
            >
              {showPassword ? "숨기기" : "보기"}
            </button>
          </div>
          {err && (
            <p role="alert" className="text-xs leading-relaxed text-rose-deep">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !email || !pw}
            aria-busy={busy}
            className="tap w-full rounded-lg bg-brand py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-45"
          >
            {busy ? "가입하는 중…" : "가입하기"}
          </button>
        </form>
      )}
    </div>
  );
}
