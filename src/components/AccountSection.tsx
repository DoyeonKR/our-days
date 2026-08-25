"use client";

import { useEffect, useState } from "react";
import {
  changePassword,
  type AuthInfo,
  getAuthInfo,
  linkEmail,
  requestPasswordReset,
  signInEmail,
  signOutAccount,
} from "@/lib/auth";
import {
  clearOurDaysDeviceData,
  deleteRemoteAccount,
  downloadAccountArchive,
  downloadAccountJson,
  type ExportProgress,
} from "@/lib/accountData";
import {
  emailValidationMessage,
  newPasswordValidationMessage,
} from "@/lib/authPolicy";
import { isSupabaseConfigured } from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";

export default function AccountSection() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [mode, setMode] = useState<"idle" | "save" | "login" | "password" | "delete">("idle");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [nextPwAgain, setNextPwAgain] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getAuthInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!isSupabaseConfigured) return null;

  const loggedIn = !!(info && !info.isAnonymous && info.email);

  async function save() {
    const inputError = emailValidationMessage(email) ?? newPasswordValidationMessage(pw);
    if (inputError) {
      setErr(inputError);
      return;
    }
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
    const inputError = emailValidationMessage(email);
    if (inputError || pw.length < 6) {
      setErr(inputError ?? "비밀번호는 6자 이상 입력해 주세요.");
      return;
    }
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

  function resetSensitiveFields() {
    setPw("");
    setCurrentPw("");
    setNextPw("");
    setNextPwAgain("");
    setDeleteText("");
    setShowPassword(false);
  }

  async function updatePassword() {
    const validation = newPasswordValidationMessage(nextPw);
    if (validation) return setErr(validation);
    if (nextPw !== nextPwAgain) return setErr("새 비밀번호가 서로 일치하지 않아요.");
    if (!info?.email || currentPw.length < 6) return setErr("현재 비밀번호를 입력해 주세요.");
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await signInEmail(info.email, currentPw);
      await changePassword(nextPw, currentPw);
      setMode("idle");
      resetSensitiveFields();
      setMsg("비밀번호를 바꿨어요.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendRecovery() {
    if (!info?.email) return;
    setBusy(true);
    setErr(null);
    try {
      await requestPasswordReset(info.email);
      setMsg("복구 메일을 보냈어요. 메일함과 스팸함을 확인해 주세요.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runExport(kind: "json" | "archive") {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setExportProgress({ done: 0, total: 1, label: "준비 중" });
    try {
      if (kind === "json") {
        await downloadAccountJson(setExportProgress);
        setMsg("데이터 JSON을 내려받았어요.");
      } else {
        const result = await downloadAccountArchive(setExportProgress);
        setMsg(
          result.skipped
            ? `보관함을 내려받았어요. 미디어 ${result.skipped}개는 ZIP 안의 실패 목록을 확인해 주세요.`
            : `데이터와 미디어 ${result.files}개를 보관함으로 내려받았어요.`,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setExportProgress(null);
    }
  }

  async function removeAccount() {
    if (!info?.email || currentPw.length < 6 || deleteText !== "삭제") return;
    setBusy(true);
    setErr(null);
    try {
      // 현재 비밀번호 재확인 — 빠른 실패용 클라 검증. **강제는 서버**(manage-account)가 한다:
      // 클라 확인만으론 탈취된 열린 세션이 엔드포인트를 직접 불러 파기하는 걸 못 막는다.
      await signInEmail(info.email, currentPw);
      await deleteRemoteAccount(currentPw);
      clearOurDaysDeviceData();
      location.reload();
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted">로그인됨 · {info!.email}</span>
            <button onClick={logout} className="tap shrink-0 text-xs font-semibold text-rose-deep">
              로그아웃
            </button>
          </div>
          {mode === "idle" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMode("password");
                  setErr(null);
                  setMsg(null);
                }}
                className="tap rounded-lg bg-glass py-2 text-xs font-bold text-ink ring-1 ring-line"
              >
                비밀번호 변경
              </button>
              <button
                onClick={() => void runExport("json")}
                disabled={busy}
                className="tap rounded-lg bg-glass py-2 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-45"
              >
                데이터 JSON
              </button>
              <button
                onClick={() => void runExport("archive")}
                disabled={busy}
                className="tap rounded-lg bg-glass py-2 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-45"
              >
                미디어 포함 ZIP
              </button>
              <button
                onClick={() => {
                  setMode("delete");
                  setErr(null);
                  setMsg(null);
                }}
                className="tap rounded-lg bg-glass py-2 text-xs font-bold text-rose-deep ring-1 ring-line"
              >
                계정 삭제
              </button>
            </div>
          )}
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
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "save" ? "new-password" : "current-password"}
            placeholder="비밀번호 (6자 이상)"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            비밀번호 보기
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode("idle");
                resetSensitiveFields();
              }}
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

      {loggedIn && mode === "password" && (
        <div className="space-y-2 border-t border-line pt-2">
          <p className="text-xs leading-relaxed text-muted">현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿔요.</p>
          <input
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="현재 비밀번호"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="새 비밀번호 (8자 이상 · 영문+숫자)"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={nextPwAgain}
            onChange={(e) => setNextPwAgain(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="새 비밀번호 확인"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            비밀번호 보기
          </label>
          <div className="flex gap-2">
            <button onClick={() => { setMode("idle"); resetSensitiveFields(); }} className="tap rounded-lg px-3 py-2 text-xs text-muted">취소</button>
            <button disabled={busy || !currentPw || !nextPw || !nextPwAgain} onClick={() => void updatePassword()} className="tap flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white disabled:opacity-45">
              {busy ? "변경 중…" : "비밀번호 바꾸기"}
            </button>
          </div>
          <button disabled={busy} onClick={() => void sendRecovery()} className="tap w-full py-1 text-xs font-semibold text-muted disabled:opacity-45">
            현재 비밀번호를 모르면 복구 메일 받기
          </button>
        </div>
      )}

      {loggedIn && mode === "delete" && (
        <div className="space-y-2 border-t border-rose-deep pt-2">
          <p className="text-xs font-bold text-rose-deep">이 작업은 되돌릴 수 없어요.</p>
          <p className="text-xs leading-relaxed text-muted">
            내 계정과 내가 작성한 개인 기록을 삭제해요. 혼자 쓰는 공유 공간이면 그 공간의 데이터도 함께 삭제돼요. 먼저 ZIP 보관함을 내려받는 것을 권장해요.
          </p>
          <input
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="현재 비밀번호"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder="확인을 위해 ‘삭제’ 입력"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <div className="flex gap-2">
            <button onClick={() => { setMode("idle"); resetSensitiveFields(); }} className="tap rounded-lg px-3 py-2 text-xs text-muted">취소</button>
            <button disabled={busy || currentPw.length < 6 || deleteText !== "삭제"} onClick={() => void removeAccount()} className="tap flex-1 rounded-lg bg-rose-deep py-2 text-xs font-bold text-white disabled:opacity-35">
              {busy ? "삭제 중…" : "계정 영구 삭제"}
            </button>
          </div>
        </div>
      )}

      {exportProgress && (
        <p role="status" className="text-xs text-muted">
          내보내는 중 · {exportProgress.label} ({exportProgress.done}/{exportProgress.total})
        </p>
      )}

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {err && <p className="text-xs text-rose-deep">{err}</p>}
    </div>
  );
}
