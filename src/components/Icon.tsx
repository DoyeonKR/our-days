import { ICON_PATHS, type IconName } from "@/lib/icons";

export type { IconName };

/**
 * 코히런트 인라인 SVG 아이콘. currentColor 상속(라이트/다크/활성 자동), 24 그리드.
 * 아이콘 전용 버튼은 aria-label 을 '버튼'에, 아이콘은 aria-hidden 으로.
 * filled: 닫힌 도형(하트 등)을 채운 형태로.
 */
export default function Icon({
  name,
  size = 22,
  strokeWidth = 2,
  filled = false,
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
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block" }}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
