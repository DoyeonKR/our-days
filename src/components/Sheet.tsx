"use client";

/* 공용 아래 시트 — page.tsx 안에 있던 것을 그대로 꺼냈다(2026-11-06 일기 리뷰).
 * 일기 편집기도 같은 시트를 써야 주 버튼이 스크롤 밖 발판에 고정된다(README §10.6).
 * 예전 일기 편집기는 자체 모달이라 본문 약 950px / 보이는 높이 약 731px 에서 '일기장에 남기기'가 화면 밖에 있었다. */
import { CloseButton } from "@/components/AppButtons";
import { useDialogFocus } from "@/lib/useDialogFocus";

export default function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 스크롤 밖에 고정되는 하단 영역 — 저장 같은 주 버튼용.
   *  [2026-09-23 리뷰] 일정 추가 시트는 본문이 1,039px 인데 보이는 높이가 731px 라
   *  '추가하기'가 화면 아래 300px 밖에 있었다. 생일 하나 넣으려고 아이콘·반복·메모·알림을
   *  다 지나 스크롤해야 저장할 수 있었다. */
  footer?: React.ReactNode;
}) {
  // dialog 시맨틱 + Esc 닫기 + 초기 포커스 — 다른 모달(Letters/PhotoAlbum/ConfirmHost)과 일관
  const sheetRef = useDialogFocus(true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="glass animate-sheet flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[var(--radius-card)] bg-surface shadow-[var(--shadow-lg)] ring-1 ring-line outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 스크롤은 본문만 — 발판(footer)은 그 밖에 있어서 항상 보인다 */}
        <div
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-6 ${
            footer ? "pb-4" : "pb-[calc(2rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line-strong" />
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink">{title}</h3>
            <CloseButton onClose={onClose} />
          </div>
          {children}
        </div>
        {footer && (
          <div className="border-t border-line px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
