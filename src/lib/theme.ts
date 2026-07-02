// 앱 색 테마(톤앤매너) — data-theme 로 accent/네온/배경 토큰을 교체하면
// 라인·섀도·그라디언트·형광 프레임까지 전부 파생되어 앱 전체가 리틴트된다.
// 기본(로즈)은 :root 값 그대로 → data-theme 미설정.

export type ThemeId = "rose" | "coral" | "purple" | "blue" | "mint" | "lime";

export const THEME_KEY = "ourdays:theme";

/** 선택지 — swatch 는 미리보기 점 색(라이트 기준 accent), neon 은 형광 테두리 색. */
export const THEMES: {
  id: ThemeId;
  label: string;
  swatch: string;
  neon: string;
}[] = [
  { id: "rose", label: "로즈", swatch: "#ff5f97", neon: "#ff2e9a" },
  { id: "coral", label: "코랄", swatch: "#ff6f52", neon: "#ff5a2e" },
  { id: "purple", label: "퍼플", swatch: "#a06bff", neon: "#b34dff" },
  { id: "blue", label: "블루", swatch: "#3f9bff", neon: "#2e9aff" },
  { id: "mint", label: "민트", swatch: "#12b085", neon: "#10d79a" },
  { id: "lime", label: "라임", swatch: "#6faf1c", neon: "#a6ff2e" },
];

const IDS = new Set<string>(THEMES.map((t) => t.id));

/** 저장된 테마(없으면 기본 rose). */
export function getTheme(): ThemeId {
  if (typeof window === "undefined") return "rose";
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v && IDS.has(v)) return v as ThemeId;
  } catch {
    /* noop */
  }
  return "rose";
}

/** DOM 에 즉시 적용 (rose 는 data-theme 제거해 :root 기본값 사용). */
export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === "rose") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
}

/** 선택 저장 + 즉시 적용. */
export function setTheme(id: ThemeId): void {
  applyTheme(id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* noop */
  }
}
