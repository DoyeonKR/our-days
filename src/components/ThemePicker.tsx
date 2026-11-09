"use client";

import { useEffect, useState } from "react";
import { type ThemeId, THEMES, getTheme, setTheme } from "@/lib/theme";
import Icon from "@/components/Icon";
import { useSharedAppearance } from "@/components/SharedAppearanceProvider";

/** 설정 안의 '테마 색' 선택 — 고르면 앱 전체 톤앤매너가 즉시 바뀐다. */
export default function ThemePicker() {
  const [sel, setSel] = useState<ThemeId>("rose");
  const [err, setErr] = useState<string | null>(null);
  const shared=useSharedAppearance();

  // 저장값으로 초기화 (SSR/하이드레이션 안전 — 마운트 후 반영)
  useEffect(() => setSel(getTheme()), []);

  /* [2026-11-09] 예전엔 저장 실패를 .catch(()=>{}) 로 삼켰고, 첫 불러오기가 실패하면 ready 가 false 로 남아
     버튼이 말없이 잠겨 있었다(오류 띠는 앱 맨 위라 설정 시트에 가려 안 보인다). 이제 여기서 이유와 다시 불러오기를 보여 준다. */
  function pick(id: ThemeId) {
    if(shared){
      setErr(null);
      shared.save({theme:id},shared.record.version).catch((e:unknown)=>setErr(e instanceof Error&&e.message?e.message:"테마를 저장하지 못했어요. 다시 시도해 주세요."));
      return;
    }
    setSel(id);
    setTheme(id);
  }

  function retry() {
    setErr(null);
    shared?.refresh();
  }

  const problem = err || shared?.error || null;
  const loading = !!shared && !shared.ready && !problem;

  return (
    <section>
      <p className="mb-1.5 text-xs font-semibold text-muted">테마 색</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const active = (shared?.record.settings.theme??sel) === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!!shared&&(!shared.ready||shared.busy)}
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
      {loading && <p role="status" className="mt-2 text-xs text-muted">공유 테마를 불러오는 중…</p>}
      {problem && (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-rose-deep">
          <span>{problem}</span>
          <button type="button" onClick={retry} className="tap min-h-11 font-bold underline">
            다시 불러오기
          </button>
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        {shared?.linked?"저장하면 상대방의 앱 색도 함께 바뀌어요.":"고르면 앱 전체 색이 바로 바뀌어요."}
      </p>
    </section>
  );
}
