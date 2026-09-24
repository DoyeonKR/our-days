"use client";

import { type ReactNode, useEffect, useRef } from "react";

/** 우리 섬 공용 바텀시트(어두운 섬 톤). IslandGame 과 섬 하위 화면(씨앗 가게·레시피북·상점)이 같이 쓴다.
 *  ⚠ z-index 82 — 섬 오버레이(80대) 위, 축하 연출(84~85) 아래. 바꾸면 연출이 시트에 가린다. */
export function SheetShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 목록이 긴 시트(씨앗 가게·레시피북)는 화면을 더 쓴다. */
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-sheet w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#1a2540] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-white ring-1 ring-white/10 ${
          wide ? "max-h-[88dvh]" : "max-h-[80dvh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        <h3 className="mb-3 text-base font-extrabold">{title}</h3>
        {children}
        <button onClick={onClose} className="tap mt-4 w-full rounded-xl bg-white/15 py-2.5 text-sm font-bold">
          닫기
        </button>
      </div>
    </div>
  );
}

/** 가로 스크롤 필터 칩 — 섬 하위 화면 공용. */
export function FilterChips<K extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: K;
  onChange: (k: K) => void;
  options: { k: K; label: string; n?: number; icon?: ReactNode }[];
  label: string;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  // 고른 칩이 줄 밖(오른쪽)에 있으면 무엇이 켜졌는지 안 보인다 — 다른 화면에서 필터를 정해 들어올 때
  // (세트판 → 그 세트 상점) 특히. **가로 줄만** 옮긴다: scrollIntoView 는 페이지까지 세로로 끌고 간다.
  useEffect(() => {
    const row = rowRef.current;
    const on = row?.querySelector<HTMLElement>("[aria-pressed=\"true\"]");
    if (!row || !on) return;
    const d = on.getBoundingClientRect().left - row.getBoundingClientRect().left;
    row.scrollLeft += d - (row.clientWidth - on.offsetWidth) / 2;
  }, [value]);
  return (
    // 전역 touch-action 이 pan-y 라, 실제 가로 스크롤러는 여기서 되살린다(CoupleSync 칩과 같은 이유)
    <div ref={rowRef} role="group" aria-label={label} className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" style={{ touchAction: "pan-x" }}>
      {options.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          aria-pressed={value === o.k}
          className={`tap shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
            value === o.k ? "bg-amber-300 text-[var(--ink-on-light)] ring-amber-200" : "bg-white/[0.07] text-white/75 ring-white/10"
          }`}
        >
          {o.icon && <span className="mr-1">{o.icon}</span>}
          {o.label}
          {o.n != null && <span className="ml-1 opacity-70">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

/** 일 수 → "18시간" / "1.5일" */
export const dur = (days: number): string =>
  days < 1 ? `${Math.round(days * 24)}시간` : `${Number.isInteger(days) ? days : days.toFixed(1)}일`;
