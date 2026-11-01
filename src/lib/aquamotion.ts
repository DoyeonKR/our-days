/** Eight neutral-aligned photographic poses per animal, four columns × two rows.
 * Only the live tank animates them; shop and encyclopedia retain the sharp master. */
export const AQUA_SWIM_SHEETS: Readonly<Record<string, number>> = {
  green_sea_turtle: 1.8,
  bluefin_tuna: 0.8,
  whale_shark: 2.2,
  oceanic_manta: 2.4,
};

export function aquaSwimSheet(key: string): string | null {
  return Object.hasOwn(AQUA_SWIM_SHEETS, key) ? `/aqua/motion/${key}.webp` : null;
}
