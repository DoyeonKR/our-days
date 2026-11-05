import { type IconName, ICON_PATHS } from "@/lib/icons";

export type { IconName };

/** 선 아이콘 — 24×24 · 둥근 선(lib/icons). currentColor 를 따른다. 2026-11-05 도트 아이콘에서 바꿨다[사용자: "옛날 스러워 현대적으로"]. */
export default function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  filled,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", flex: "none" }}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
