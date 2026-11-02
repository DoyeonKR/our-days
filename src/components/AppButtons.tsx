"use client";

/* 공통 버튼 — [사용자: "닫기 버튼이나 이런 공통적인 버튼은 컴포넌트화 해서 동일하게좀 만들어줘 너무 산만해"]
 * 닫기는 어디서나 이 글자 알약 하나다(44px 터치 · 어두운 면 + 흰 글씨라 어떤 바탕 · 사진 위에서도 읽힌다). X 아이콘 · ✕ 글자 · 밑줄 글자를 새로 만들지 않는다.
 * 게임 안의 일반 버튼은 ActionButton — 면 · 테두리가 글자색을 따라가서 어두운 낚시 · 수조와 밝은 합치기에서 같은 모양으로 읽힌다. */
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export function CloseButton({ onClose, label = "닫기", ariaLabel, disabled, buttonRef, className = "" }: {
  onClose: () => void;
  label?: string;
  /** 무엇을 닫는지 더 말해야 할 때(스크린리더) */
  ariaLabel?: string;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button ref={buttonRef} type="button" onClick={onClose} disabled={disabled} aria-label={ariaLabel} className={`tap app-close ${className}`}>
      {label}
    </button>
  );
}

type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { main?: boolean; wide?: boolean; on?: boolean; children: ReactNode };
export function ActionButton({ main, wide, on, className = "", children, ...rest }: ActionProps) {
  return (
    <button type="button" {...rest} className={`tap aqua-btn ${main ? "is-main" : ""} ${wide ? "is-wide" : ""} ${on ? "is-on" : ""} ${className}`}>
      {children}
    </button>
  );
}
