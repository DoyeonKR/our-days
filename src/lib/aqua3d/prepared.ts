/** New expansion families are staged separately from the active catch catalogue. */
export const EXPANSION_FAMILIES = [
  "nurse_shark", "leopard_shark", "blue_shark", "hammerhead", "great_white", "megamouth",
  "flounder", "rockfish", "sea_bream", "sea_bass", "salmon", "yellowtail", "croaker", "striped_jack",
] as const;
export const PREPARED_FISH_KEYS = ["catfish", "sweetfish", "jellyfish", ...EXPANSION_FAMILIES]
  .flatMap(f => [f, `fry_${f}`, `juv_${f}`]);
