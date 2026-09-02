# Design QA — Main Feed & All Heroes

## Evidence

- Source visual truth: `C:/Users/kdy78/.codex/generated_images/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/exec-028aaa87-4f85-41c4-bbc0-c2df01142c0e.png`
- Hero implementation capture: `C:/Users/kdy78/.codex/visualizations/2026/09/01/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/05-all-heroes-redesign.png`
- Seasonal background implementation capture: `C:/Users/kdy78/.codex/visualizations/2026/09/01/01a05cf2-b96c-7473-aa5f-1c0e02c6499c/06-homeworld-seasons.png`
- Browser state: `http://127.0.0.1:4173/`, 1280 × 720 CSS px, device scale factor 1.
- Hero capture: 1820 × 1040 px, all 28 forms, 5× nearest-neighbor integer scaling.
- Seasonal source assets: four 1200 × 890 WebP files; combined QA contact sheet 600 × 446 px.
- State: cosmic-pixel direction; unauthenticated browser shell and deterministic production sprite renderer.

## Required fidelity surfaces

- Fonts and typography: existing Korean Galmuri hierarchy and copy are preserved. Feed actions use stronger weight without changing font loading.
- Spacing and layout rhythm: quick actions use a consistent 58 px minimum tap height, 12–16 px pixel-panel radii, and 3–4 px hard depth shadows.
- Colors and visual tokens: feed surfaces reuse theme tokens, mixed with the selected violet, rose, and gold cosmic accents. Light/dark theme variables remain authoritative.
- Image quality and asset fidelity: all 28 heroes remain in the production 48 × 48 sprite pipeline and render only at integer scale. Early forms now have distinct palettes; 12 final forms have branch-specific regalia; five mythic silhouettes remain distinct.
- Copy and content: no navigation labels, user data, or gameplay meaning changed.

## Comparison history

### Iteration 1

- [P1] Hatchling, Sunny, Cozy, and Moody shared the same sprite.
  - Fix: added four distinct production palettes with different eye and belly treatments.
- [P1] Twelve final forms relied on the same crown pattern.
  - Fix: added deterministic branch-specific side regalia while preserving face crops.
- [P2] Main-feed cards did not visually continue the cosmic hero world.
  - Fix: unified activity, daily log, quick actions, anniversary rows, and D-day chips with a shared cosmic pixel surface.
- [P1] The hero background used low-density flat hill layers, so all seasonal themes looked less polished than the hero artwork.
  - Fix: added four high-resolution seasonal landscape assets with layered mountains, forest canopies, vegetation, and a clear central hero stage. Existing eight-phase lighting and weather overlays remain dynamic.

### Iteration 2

- [P1] Initial regalia extended too far and changed weapon anchors on Lunar Wolf.
  - Fix: moved regalia closer to the body but outside the face crop. All hat, weapon, anchor, and animation tests then passed.
- Post-fix hero evidence: `05-all-heroes-redesign.png` visibly shows 28 forms with distinct early colors, lineage silhouettes, final-form palettes/regalia, and mythic bodies.

## Technical verification

- 675/675 regression tests passed.
- ESLint passed.
- Next.js production build and TypeScript passed.
- Four seasonal assets are 1200 × 890 and total about 1.1 MB, preserving up to DPR 3 detail without a multi-megabyte image per theme.
- Browser console/local shell opened successfully.

## Remaining blocker

- The authenticated main feed could not be browser-captured because the available in-app browser has no signed-in session. Authentication was not bypassed and credentials were not requested. Therefore the final feed visual state cannot be compared at matching content/state in this run.

final result: blocked
