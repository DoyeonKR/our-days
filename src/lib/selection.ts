/** Keyboard navigation for single-selection controls. null means leave native input alone. */
export function selectionIndex(key: string, index: number, count: number): number | null {
  if (!count) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}
