"use client";

import { useEffect, useState } from "react";
import {
  changePassword,
  type AuthInfo,
  getAuthInfo,
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
import { newPasswordValidationMessage } from "@/lib/authPolicy";
import { getMyCouple, isSupabaseConfigured } from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";
import { beginBusy } from "@/lib/busy";
import { deletionImpact, isSoloSpace, type SpaceKind } from "@/lib/solospace";

export default function AccountSection() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  // 계정 정보 불러오기 상태 [2026-11-09] — 예전엔 실패를 삼켜 info 가 null 로 남았고, 그러면 로그인 게이트 뒤인데도
  // 옛 익명 계정용 '계정 저장 · 다른 기기 로그인' 화면이 떴다. 이제 불러오는 중 · 실패(다시 시도)만 보여 준다.
  const [infoState, setInfoState] = useState<"loading" | "ready" | "error">("loading");
  const [mode, setMode] = useState<"idle" | "password" | "delete">("idle");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [nextPwAgain, setNextPwAgain] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  // 계정 삭제 안내용 — 지금 공간에 상대가 있는지. 모르면(조회 실패) 'pair' 로 본다: 덜 말하는 쪽보다 더 말하는 쪽이 안전하다.
  const [space, setSpace] = useState<{ kind: SpaceKind; partner: string | null } | null>(null);

  function loadInfo() {
    setInfoState("loading");
    getAuthInfo()
      .then((next) => {
        setInfo(next);
        setInfoState(next ? "ready" : "error");
      })
      .catch(() => setInfoState("error"));
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    loadInfo();
  }, []);

  if (!isSupabaseConfigured) return null;

  /* [2026-11-06] 계정을 지우면 purge_account_data(schema.sql)가 내가 쓴 일기 · 사진 · 3초 로그 · 질문 답 · 기분 · 쿡을
     지운다 — **상대 화면에서도** 사라지고, 내 일기에 상대가 남긴 반응 · 댓글도 같이 사라진다. 예전 안내는 '내 개인 기록'
     이라고만 해서 상대가 잃는 것을 말하지 않았다. 지우기 전에 공간을 읽어 상대 이름까지 넣어 말하고 내보내기를 먼저 권한다.
     (상대에게 알림을 보내는 건 manage-account 를 다시 배포해야 해서 이번엔 하지 않았다.) */
  async function openDelete() {
    setMode("delete");
    setErr(null);
    setMsg(null);
    setSpace(null);
    try {
      const st = await getMyCouple();
      if (!st) return setSpace({ kind: "none", partner: null });
      if (isSoloSpace(st.members.length)) return setSpace({ kind: "solo", partner: null });
      const partner = st.members.find((m) => m.user_id !== info?.id)?.nickname ?? null;
      setSpace({ kind: "pair", partner });
    } catch {
      setSpace({ kind: "pair", partner: null });
    }
  }

  const loggedIn = !!(info && !info.isAnonymous && info.email);

  function resetSensitiveFields() {
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
    // ZIP 은 미디어를 다 받아 묶느라 몇 분 걸린다 — 그동안 새 버전 자동 새로고침 · 탭 닫기가 끊지 않게(lib/busy)
    const endBusy = beginBusy();
    try {
      // 앱은 공유 시트에서 사용자가 닫을 수 있다 — 그건 오류가 아니라 '저장 안 함'으로 알린다(2026-11-06)
      if (kind === "json") {
        const { saved } = await downloadAccountJson(setExportProgress);
        setMsg(saved ? "데이터 JSON을 내려받았어요." : "저장을 취소했어요. 다시 누르면 처음부터 만들어요.");
      } else {
        const result = await downloadAccountArchive(setExportProgress);
        if (result.saved < result.parts)
          setMsg(
            result.saved
              ? `${result.parts}개 중 ${result.saved}개만 저장했어요. 보관함은 모든 파일이 있어야 완성돼요 — 다시 내보내 주세요.`
              : "저장을 취소했어요. 다시 누르면 처음부터 만들어요.",
          );
        else
          setMsg(
            result.skipped
              ? `보관함을 내려받았어요. 미디어 ${result.skipped}개는 ZIP 안의 실패 목록을 확인해 주세요.`
              : `데이터와 미디어 ${result.files}개를 보관함으로 내려받았어요.`,
          );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
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

  // 로그아웃 [2026-11-09] — 예전엔 실패해도 그대로 새로고침해서, 오프라인이면 '로그아웃했는데 다시 로그인돼 있다'가 됐다.
  // signOutAccount 가 실패를 던지면 여기서 보여 주고 머문다. 누르는 동안은 버튼을 막는다(두 번 눌러 두 번 묻지 않게).
  async function logout() {
    if (loggingOut || busy) return;
    if (
      !(await confirmDialog({
        message: "로그아웃할까요?",
        detail: "이 기기에선 다시 로그인해야 연동이 보여요.",
        confirmText: "로그아웃",
      }))
    )
      return;
    setLoggingOut(true);
    setErr(null);
    setMsg(null);
    try {
      await signOutAccount();
      location.reload();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "로그아웃하지 못했어요. 다시 시도해 주세요.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
      <p className="text-xs font-bold text-ink">계정 · 기기 간 연동</p>

      {infoState === "loading" ? (
        <p role="status" className="text-xs text-muted">계정 정보를 불러오는 중…</p>
      ) : !loggedIn ? (
        <div className="flex items-center justify-between gap-2">
          <p role="alert" className="text-xs text-rose-deep">계정 정보를 불러오지 못했어요. 연결을 확인해 주세요.</p>
          <button type="button" onClick={loadInfo} className="tap shrink-0 text-xs font-semibold text-rose-deep underline">
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted">로그인됨 · {info!.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="tap shrink-0 text-xs font-semibold text-rose-deep disabled:opacity-50"
            >
              {loggingOut ? "로그아웃 중…" : "로그아웃"}
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
                onClick={() => void openDelete()}
                className="tap rounded-lg bg-glass py-2 text-xs font-bold text-rose-deep ring-1 ring-line"
              >
                계정 삭제
              </button>
            </div>
          )}
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
            aria-label="현재 비밀번호"
            placeholder="현재 비밀번호"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-label="새 비밀번호"
            placeholder="새 비밀번호 (8자 이상 · 영문+숫자)"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={nextPwAgain}
            onChange={(e) => setNextPwAgain(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-label="새 비밀번호 확인"
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
          {(() => {
            const impact = deletionImpact(space?.kind ?? "pair", space?.partner ?? null);
            return (
              <div className="space-y-1.5 rounded-lg bg-rose/10 p-2.5" aria-live="polite">
                <p className="text-xs font-bold text-ink">{impact.lead}</p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted">
                  {impact.gone.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {impact.kept.map((line) => (
                  <p key={line} className="text-xs leading-relaxed text-muted">{line}</p>
                ))}
                <p className="text-xs leading-relaxed text-muted">지운 뒤에는 되살릴 수 없어요. 먼저 미디어 포함 ZIP 을 받아 두세요.</p>
                <button
                  onClick={() => void runExport("archive")}
                  disabled={busy}
                  className="tap mt-1 w-full rounded-lg bg-glass py-2 text-xs font-bold text-ink ring-1 ring-line disabled:opacity-45"
                >
                  내보내기 먼저 (미디어 포함 ZIP)
                </button>
              </div>
            );
          })()}
          <input
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            aria-label="계정 삭제 확인용 현재 비밀번호"
            placeholder="현재 비밀번호"
            className="w-full rounded-lg border border-line bg-glass px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <input
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            aria-label="확인을 위해 삭제 입력"
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

      {msg && <p role="status" className="text-xs text-emerald-600">{msg}</p>}
      {err && <p role="alert" className="text-xs text-rose-deep">{err}</p>}
    </div>
  );
}
