import { type IconName } from "@/lib/icons";
import { PIXEL_ICON_PATHS } from "@/lib/pixelicon";

export type { IconName };

/**
 * 픽셀 아이콘 — 12×12 도트를 SVG path 로 구운 것(`lib/pixelicon.ts`).
 *
 * 왜 캔버스가 아니라 SVG 인가: 아이콘은 100 곳 넘게 **버튼 안에서 `currentColor` 를 상속해**
 * 쓰인다(활성/비활성/다크 자동). 캔버스는 색 상속이 안 되고, 캔버스 100 개는 무겁다.
 * 도트를 가로 런으로 합쳐 path 하나로 만들면 노드도 가볍고 색 상속도 그대로다.
 *
 * ⚠ `shapeRendering="crispEdges"` 가 핵심 — 없으면 브라우저가 경계를 안티앨리어싱해 도트
 *   가장자리가 번진다(픽셀 아이콘이 흐릿해 보이는 원인 1순위).
 * ⚠ 크기는 **12 의 배수로 스냅**한다. 22px 이면 한 칸이 1.83px 이라 어떤 줄은 2px, 어떤 줄은
 *   1px 로 렌더되어 굵기가 들쭉날쭉해진다.
 *
 * props 시그니처는 **일부러 그대로 둔다** — 호출부 100 여 곳을 건드리지 않기 위해서다.
 * `strokeWidth`/`filled` 는 픽셀 아이콘에 의미가 없어 무시된다(선 굵기 = 도트 1칸 고정).
 */
export default function Icon({
  name,
  size = 24,
  strokeWidth,
  filled,
  className,
}: {
  name: IconName;
  size?: number;
  /** 픽셀 아이콘에선 무시 — 선 굵기는 도트 1칸으로 고정이다(호환용으로만 남김). */
  strokeWidth?: number;
  /** 픽셀 아이콘은 항상 칠해진 도형이다(호환용으로만 남김). */
  filled?: boolean;
  className?: string;
}) {
  void strokeWidth;
  void filled;
  const snapped = Math.max(12, Math.round(size / 12) * 12);
  return (
    <svg
      width={snapped}
      height={snapped}
      viewBox="0 0 12 12"
      fill="currentColor"
      stroke="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block" }}
      dangerouslySetInnerHTML={{ __html: `<path d="${PIXEL_ICON_PATHS[name]}"/>` }}
    />
  );
}
