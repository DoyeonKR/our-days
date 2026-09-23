"use client";

import Icon, { type IconName } from "@/components/Icon";

/* 커플 연결 전 빈 화면 — 기록(오늘 로그·일기·사진)과 버킷리스트가 같이 쓴다.
 *
 * [2026-09-23 리뷰] 네 곳이 같은 카드를 따로 찍었는데 **어디에도 버튼이 없었다.**
 * 연결은 '함께' 탭에서만 할 수 있는데 여기선 그 길을 안 알려 줘서, 혼자 쓰는 사람에게는
 * 기록 탭 세 화면이 전부 막다른 길이었다(버킷리스트는 "홈에서 연결하면"이라고 틀린 곳을 가리켰다).
 * → 카드마다 '함께' 탭으로 가는 버튼을 달고, 서체·문구 틀을 한 곳에서 맞춘다
 *   (예전엔 일기만 .reading 안에 있어서 같은 카드가 화면마다 다른 서체로 보였다).
 */
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
  return (
    <div className="reading rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
        <Icon name={icon} size={26} />
      </div>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs text-muted">{body}</p>
      {onConnect && (
        <button
          onClick={onConnect}
          className="tap mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-[var(--shadow-md)]"
        >
          <Icon name="heart" size={12} />
          커플 연결하러 가기
        </button>
      )}
    </div>
  );
}
