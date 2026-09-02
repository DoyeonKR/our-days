# Design QA — Cosmic Mythic Pixel Direction

## Evidence

- Source visual truth: `C:/Users/kdy78/.codex/generated_images/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/exec-028aaa87-4f85-41c4-bbc0-c2df01142c0e.png`
- Implementation art capture: `C:/Users/kdy78/.codex/visualizations/2026/09/01/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/04-mythic-scene.png`
- Full comparison: `C:/Users/kdy78/.codex/visualizations/2026/09/01/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/design-qa-comparison.png`
- Local mobile shell: `C:/Users/kdy78/.codex/visualizations/2026/09/01/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/qa-local-mobile-shell.png`
- Source pixels: 853 × 1844, normalized to a 390 × 844 crop for comparison.
- Implementation scene pixels: 768 × 432 from a 192 × 108 logical pixel canvas at 4× integer scale.
- Comparison pixels: 780 × 844; source and implementation are adjacent at equal 390 px column widths.
- Mobile shell viewport: 390 × 844 CSS px, device scale factor 1.
- State: selected cosmic direction; mythic tiger, legendary crops/food, and rank sigils. The authenticated game scene could not be browser-opened without a user session, so component art was captured through the production sprite renderer. Authentication was not bypassed.

## Required fidelity surfaces

- Fonts and typography: no new game copy or font system was introduced. Existing readable Korean UI typography is preserved.
- Spacing and layout rhythm: the 48 × 48 hero and 24 × 24 item contracts are preserved; all output remains integer-scaled. The rank sigil is 48 × 12 and stays under the moving hero without changing layout.
- Colors and visual tokens: the selected indigo, cyan, magenta, violet, and gold language is represented by shared deterministic palettes. Light/dark contrast remains strong.
- Image quality and asset fidelity: the existing source-native pixel pipeline is retained. No interpolated scaling, placeholder imagery, emoji substitute, or smooth vector effect was introduced. Hero mantle, aura, sigil, crops, and food remain crisp at integer scales.
- Copy and content: no product copy changed.

## Comparison history

### Iteration 1

- [P1] Mythic aura read as scattered dust rather than a mantle.
  - Fix: added a non-destructive multi-row cyan/magenta/gold aura and an innate galaxy mantle for mythic forms.
- [P1] Rank sigils were too sparse to read as geometric constellations.
  - Fix: connected the central constellation and elliptical bands while preserving species-specific colors and runes.

### Iteration 2

- Post-fix evidence: `design-qa-comparison.png` shows the hero mantle, multicolor aura, connected underfoot constellation, differentiated legendary items, and five distinct sigils.
- No actionable P0/P1/P2 visual differences remain within the production art-system scope. The concept mock intentionally uses a much denser illustrative environment than the existing game renderer; reproducing that density would be a separate world-scene redesign rather than an art-system correction.

## Interaction and technical checks

- Mythic sigil follows hero horizontal movement and remains on the ground while the hero jumps.
- Equipped capes still take precedence over the innate mythic mantle in the full pixel stage.
- Reduced-motion freezes sigil pulsing.
- Face crops stay stable across all six animation frames.
- 673 regression tests passed; ESLint passed; Next.js production build and TypeScript passed.
- Local 390 × 844 shell has no visible horizontal overflow or clipped persistent controls.

## Follow-up polish

- [P3] A future authenticated capture can tune exact aura intensity against real user equipment and weather combinations.

final result: passed
