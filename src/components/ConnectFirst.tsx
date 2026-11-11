"use client";

import { useState, useSyncExternalStore } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { isSupabaseConfigured, notifyCoupleChanged, startSoloSpace } from "@/lib/couple";
import { coupleLookupStatus, onCoupleLookup } from "@/lib/couplelookup";

/* 공간이 없을 때의 빈 화면 — 기록(오늘 로그·일기·사진·추억)과 버킷리스트가 같이 쓴다.
 *
 * [2026-09-23 리뷰] 네 곳이 같은 카드를 따로 찍었는데 **어디에도 버튼이 없었다.**
 * 연결은 '함께' 탭에서만 할 수 있는데 여기선 그 길을 안 알려 줘서, 혼자 쓰는 사람에게는
 * 기록 탭 세 화면이 전부 막다른 길이었다(버킷리스트는 "홈에서 연결하면"이라고 틀린 곳을 가리켰다).
 * → 카드마다 '함께' 탭으로 가는 버튼을 달고, 서체·문구 틀을 한 곳에서 맞춘다.
 *
 * [2026-11-06] 그래도 상대가 없으면 기록을 하나도 못 썼다(섬 · 낚시는 혼자 되는데). 이제 첫 버튼이
 * '혼자 시작하기'다 — 초대코드 만들기와 같은 1인 공간을 만들고(lib/solospace), 상대는 나중에 그 코드로 들어온다.
 * 이 컴포넌트를 쓰는 화면(DecoBook · PhotoAlbum · BucketList · page)은 props 를 바꿀 필요가 없다 —
 * 만든 뒤 couple.ts 의 이벤트로 page · CoupleSync 가 공간을 다시 읽고, 그러면 이 카드가 사라진다.
 * 백엔드가 없는 로컬 모드에선 공간을 만들 곳이 없으니 연결 버튼만 둔다.
 */

// page.tsx 의 LS 키와 같은 값(애칭 · 시작일) — 커플 만들기(CoupleSync)도 같은 두 값을 보낸다.
const LS_ME = "ourdays:me";
const LS_START = "ourdays:start";
const readLs = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export default function ConnectFirst({
  icon,
  title,
  body,
  onConnect,
}: {
  icon: IconName;
  title: string;
  body: string;
  /** '함께' 탭으로 보낸다. 없으면 버튼을 안 그린다(연결 화면 자체에서는 필요 없다). */
  onConnect?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // [2026-11-11] 공간이 없다는 답을 받기 전(첫 조회 중 · 조회 실패 — 오프라인으로 연 앱)엔 '혼자 시작하기'를 내밀지 않는다.
  // 예전엔 조회 실패도 '공간 없음'으로 보여, 연결이 돌아와도 이 카드가 남았고 누르면 두 번째 공간이 생길 수 있었다(lib/couplelookup).
  const lookup = useSyncExternalStore(onCoupleLookup, coupleLookupStatus, () => "pending" as const);

  async function startSolo() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await startSoloSpace(readLs(LS_ME) ?? "", readLs(LS_START));
      // 성공하면 이 카드는 부모가 공간을 다시 읽는 순간 사라진다 — busy 를 풀지 않아 두 번 눌리지 않는다.
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (isSupabaseConfigured && lookup !== "ok") {
    return (
      <div role="status" className="reading connect-first-v2 rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
          <Icon name={icon} size={26} />
        </div>
        <p className="mt-3 text-sm font-bold text-ink">연결 확인 중…</p>
        {lookup === "failed" && (
          <>
            <p className="mt-1 text-xs text-muted">인터넷에 연결되면 저절로 이어서 불러와요.</p>
            <button
              onClick={() => notifyCoupleChanged()}
              className="tap mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-glass px-4 text-sm font-bold text-rose-deep ring-1 ring-line"
            >
              <Icon name="refresh" size={12} />
              다시 시도
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="reading connect-first-v2 rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
        <Icon name={icon} size={26} />
      </div>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs text-muted">{body}</p>
      {(isSupabaseConfigured || onConnect) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {isSupabaseConfigured && (
            <button
              onClick={() => void startSolo()}
              disabled={busy}
              className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              <Icon name="sparkles" size={12} />
              {busy ? "준비하는 중…" : "혼자 시작하기"}
            </button>
          )}
          {onConnect && (
            <button
              onClick={onConnect}
              /* 혼자 시작하기가 없으면(로컬 모드) 이 버튼이 유일한 길이라 주 버튼 모양으로 */
              className={
                isSupabaseConfigured
                  ? "tap inline-flex min-h-11 items-center gap-1.5 rounded-full bg-glass px-4 text-sm font-bold text-rose-deep ring-1 ring-line"
                  : "tap inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-[var(--shadow-md)]"
              }
            >
              <Icon name="heart" size={12} />
              커플 연결하기
            </button>
          )}
        </div>
      )}
      {isSupabaseConfigured && (
        <p className="mt-2 text-xs text-muted">혼자 쓰다가 나중에 초대코드를 보내면 둘이 함께 봐요.</p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-xs text-rose-deep">
          {err}
        </p>
      )}
    </div>
  );
}
