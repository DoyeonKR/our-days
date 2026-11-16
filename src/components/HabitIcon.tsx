import { habitIconPath } from "@/lib/icons";

/** 습관 아이콘 — 고정 SVG 묶음(lib/icons 의 HABIT_ICONS)에서 키로 그린다. 모르는 키는 새싹. 이모지는 쓰지 않는다. */
export default function HabitIcon({ k, size = 20, className }: { k: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", flex: "none" }}
      dangerouslySetInnerHTML={{ __html: habitIconPath(k) }}
    />
  );
}
