/** New expansion families are staged separately from the active catch catalogue. */
export const EXPANSION_FAMILIES = [
  "nurse_shark", "leopard_shark", "blue_shark", "hammerhead", "great_white", "megamouth",
  "flounder", "rockfish", "sea_bream", "sea_bass", "salmon", "yellowtail", "croaker", "striped_jack",
] as const;
export const EXPANSION2_FAMILIES = ["starfish", "squid", "octopus", "gulper_eel", "anglerfish", "oarfish", "coelacanth", "giant_squid", "kraken"] as const;
export const NATIVE_FAMILIES = ["crucian","pale_chub","chinese_minnow","smelt","bullhead","common_carp","masu_salmon","snakehead","mandarin_fish","perch_kkeokji","eel","lenok","mackerel","rockfish_bollak","black_seabream","hairtail","barred_knifejaw","cutlassfish_pollock","sailfin_sandfish","puffer"] as const;
export const NATIVE_SPOT_KEYS = ["spot_dumulmeori","spot_soyang","spot_hwacheon","spot_bonghwa","spot_sanriver"] as const;
export const PREPARED_FISH_KEYS = ["catfish", "sweetfish", "jellyfish", ...EXPANSION_FAMILIES, ...EXPANSION2_FAMILIES, ...NATIVE_FAMILIES]
  .flatMap(f => [f, `fry_${f}`, `juv_${f}`]);
