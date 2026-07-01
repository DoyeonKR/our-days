"use client";

import { useEffect, useState } from "react";
import {
  type AuthInfo,
  getAuthInfo,
  linkEmail,
  signInEmail,
  signOutAccount,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";

export default function AccountSection() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [mode, setMode] = useState<"idle" | "save" | "login">("idle");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getAuthInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!isSupabaseConfigured) return null;

  const loggedIn = !!(info && !info.isAnonymous && info.email);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await linkEmail(email, pw);
      setInfo(await getAuthInfo());
      setMode("idle");
      setPw("");
      setMsg("계정이 저장됐어요. 다른 기기에서 이 이메일로 로그인하면 연동이 따라와요.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setErr(null);
    try {
      await signInEmail(email, pw);
      location.reload(); // 새 세션으로 앱 재초기화 → 커플 자동 로드
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function logout() {
    if (
      !(await confirmDialog({
        message: "로그아웃할까요?",
        detail: "이 기기에선 다시 로그인해야 연동이 보여요.",
        confirmText: "로그아웃",
      }))
    )
      return;
    await signOutAccount();
    location.reload();
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
      <p className="text-xs font-bold text-ink">계정 · 기기 간 연동</p>

      {loggedIn ? (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted">로그인됨 · {info!.email}</span>
          <button onClick={logout} className="tap shrink-0 text-xs font-semibold text-rose-deep">
            로그아웃
          </button>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          지금은 이 브라우저에서만 연동돼요. 이메일로 저장하면 다른 기기·브라우저에서
          로그인해 그대로 이어서 쓸 수 있어요.
        </p>
      )}

      {!loggedIn && mode === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("save");
              setErr(null);
            }}
            className="tap flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white shadow-[var(--shadow-md)]"
          >
            계정 저장
          </button>
          <button
            onClick={() => {
              setMode("login");
              setErr(null);
            }}
            className="tap flex-1 rounded-lg bg-glass py-2 text-xs font-bold text-rose-deep ring-1 ring-line"
          >
            다른 기기 로그인
          </button>
        </div>
      )}

      {(mode === "save" || mode === "login") && (
        <div className="space-y-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="이메일"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete={mode === "save" ? "new-password" : "current-password"}
            placeholder="비밀번호 (6자 이상)"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("idle")}
              className="tap rounded-lg px-3 py-2 text-xs text-muted"
            >
              취소
            </button>
            <button
              disabled={busy || !email || pw.length < 6}
              onClick={mode === "save" ? save : login}
              className="tap flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {busy ? "처리 중…" : mode === "save" ? "저장하기" : "로그인"}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {err && <p className="text-xs text-rose-deep">{err}</p>}
    </div>
  );
}
