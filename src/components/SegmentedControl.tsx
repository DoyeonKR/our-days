"use client";

import Icon, { type IconName } from "@/components/Icon";
import { selectionIndex } from "@/lib/selection";

/** 2~4개 상호배타 옵션용 세그먼트 컨트롤. 활성 pill 이 스프링으로 슬라이드. */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconName }[];
  ariaLabel?: string;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="segmented-v2 relative flex rounded-full bg-glass2 p-1 ring-1 ring-line"
    >
      {/* 슬라이딩 pill */}
      <span
        aria-hidden
        className="ease-spring absolute bottom-1 top-1 rounded-full bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line transition-transform duration-300"
        style={{
          left: "0.25rem",
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map((o, index) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={index === idx ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(event) => {
              const next = selectionIndex(event.key, index, options.length);
              if (next === null || event.altKey || event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              onChange(options[next].value);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
            }}
            className={`tap segmented-v2-option relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold ${
              active ? "text-rose-deep" : "text-muted"
            }`}
          >
            {o.icon && <Icon name={o.icon} size={15} />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
