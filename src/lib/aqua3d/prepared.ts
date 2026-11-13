/** New expansion families are staged separately from the active catch catalogue. */
export const EXPANSION_FAMILIES = [
  "nurse_shark", "leopard_shark", "blue_shark", "hammerhead", "great_white", "megamouth",
  "flounder", "rockfish", "sea_bream", "sea_bass", "salmon", "yellowtail", "croaker", "striped_jack",
] as const;
export const EXPANSION2_FAMILIES = ["starfish", "squid", "octopus", "gulper_eel", "anglerfish", "oarfish", "coelacanth", "giant_squid", "kraken"] as const;
export const NATIVE_FAMILIES = ["crucian","pale_chub","chinese_minnow","smelt","bullhead","common_carp","masu_salmon","snakehead","mandarin_fish","perch_kkeokji","eel","lenok","mackerel","rockfish_bollak","black_seabream","hairtail","barred_knifejaw","cutlassfish_pollock","sailfin_sandfish","puffer"] as const;
export const NATIVE_SPOT_KEYS = ["spot_dumulmeori","spot_soyang","spot_hwacheon","spot_bonghwa","spot_sanriver"] as const;
/** 4차 54계열(2026-11-13 켰다 — 옛 4차 지침서(git 이력) — 최신은 design/ART-GUIDE.md) */
export const EXPANSION4_FAMILIES = ["bitterling", "hatchetfish", "gourami", "boxfish", "butterflyfish", "mudskipper", "sleeper", "gudgeon", "scorpionfish", "halfbeak", "pleco", "shiri", "blue_tang", "filefish", "oscar", "largemouth_bass", "rainbow_trout", "skygazer", "cod", "spanish_mackerel", "seahorse", "viperfish", "goosefish", "grouper", "dolphinfish", "redtail_catfish", "sturgeon", "ricefish", "zebra_danio", "corydoras", "platy", "lanternfish", "molly", "anchovy", "dark_chub", "goby", "loach", "bluegill", "saury", "blobfish", "lionfish", "piranha", "char", "parrotfish", "moray", "barracuda", "grass_carp", "skate", "electric_eel", "frilled_shark", "arapaima", "sunfish", "marlin", "swordfish"] as const;
/** 해양 포유류 6계열(2026-11-13 켰다 — design/ART-GUIDE.md A) */
export const MAMMAL_FAMILIES = ["spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "sea_otter", "otter"];
export const PREPARED_FISH_KEYS = ["catfish", "sweetfish", "jellyfish", ...EXPANSION_FAMILIES, ...EXPANSION2_FAMILIES, ...NATIVE_FAMILIES, ...EXPANSION4_FAMILIES, ...MAMMAL_FAMILIES]
  .flatMap(f => [f, `fry_${f}`, `juv_${f}`]);
