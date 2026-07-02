"use client";

import { useEffect, useState } from "react";
import { type ThemeId, THEMES, getTheme, setTheme } from "@/lib/theme";
import Icon from "@/components/Icon";

/** 설정 안의 '테마 색' 선택 — 고르면 앱 전체 톤앤매너가 즉시 바뀐다(형광 테두리 포함). */
export default function ThemePicker() {
  const [sel, setSel] = useState<ThemeId>("rose");

  // 저장값으로 초기화 (SSR/하이드레이션 안전 — 마운트 후 반영)
  useEffect(() => setSel(getTheme()), []);

  function pick(id: ThemeId) {
    setSel(id);
    setTheme(id);
  }

  return (
    <section>
      <p className="mb-1.5 text-xs font-semibold text-muted">테마 색</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const active = sel === t.id;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              aria-pressed={active}
              aria-label={`${t.label} 테마`}
              className={`tap relative flex items-center gap-2 rounded-2xl px-3 py-2.5 ring-1 transition-colors ${
                active
                  ? "bg-glass ring-line-strong"
                  : "bg-glass2 ring-line"
              }`}
              style={
                active
                  ? { boxShadow: `0 0 0 1.5px ${t.neon}, 0 0 12px -2px ${t.neon}` }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch}, ${t.neon})`,
                }}
              />
              <span className="text-sm font-bold text-ink">{t.label}</span>
              {active && (
                <span className="ml-auto text-rose-deep">
                  <Icon name="check" size={16} strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        고르면 앱 전체 색과 형광 테두리가 바로 바뀌어요.
      </p>
    </section>
  );
}
