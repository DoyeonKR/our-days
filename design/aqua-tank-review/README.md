# Aquarium background additions

Source: `design/AQUARIUM-ART.md`. Generated with built-in imagegen; prompts and original PNG locations are in `prompts.json`.

Preview order, left to right: `tank_7` coral reef, `tank_8` deep sea, `tank_9` heavenly aquarium.

All three delivered files are opaque 1024×1280 WebP, quality 86. Visual inspection checked distinct palettes, empty swimming space, a sandy/silty bottom, and absence of animals, text and UI. Existing fish, decorations and motion sheets were preserved.

Asset inventory after import: 222 fish, 37 decorations, 9 backgrounds; no missing keys from the art document. The game card and 3D habitat select the actual tank background instead of capping at tier 6. Upper-tier geometry remains unchanged.

Validation: 28 targeted tests, TypeScript and changed-file ESLint passed. Full suite: 1523/1525 passed, plus the separate UTC suite 4/4; the two failures concern unchanged Supabase bootstrap/migration text equality (`product-schema-sync` and `review-round3-sync`). No database files were modified. No push or deployment was performed for this change.
