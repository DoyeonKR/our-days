// 도트 공용 팔레트 — 5톤 램프의 원색 3단. [2026-09-25 lib/pixelart 에서 분리]
//
// 왜 따로 두나: 팔레트는 아이콘(pixelui · pixelglyph · pixelworld · pixelfx …) 전부가 쓰는데, pixelart 는
// 펫 48×48 스프라이트 전부를 불러온다. 팔레트 하나 때문에 홈 첫 로드에 펫 그림 수십 장이 실리고 있었다.
// ⚠ 여기엔 **값만** 둔다 — 다른 도트 모듈을 불러오면 같은 일이 되풀이된다.

/* ── PAL 복사본 — art/parts.tsx 의 값과 **반드시** 동일 ────────── */
export const PIXEL_PAL = {
  cream: ["#fff3d9", "#ffe1ad", "#e8bd7e"],
  peach: ["#ffd9c2", "#ffb894", "#e08a63"],
  fur: ["#ffcf9a", "#f0a862", "#c47c3c"],
  gray: ["#e6e9f2", "#c3c9da", "#949cb3"],
  charcoal: ["#5a6072", "#414657", "#2b2f3d"],
  white: ["#ffffff", "#f2f4fb", "#d5daea"],
  brown: ["#c99a6e", "#a3764f", "#775435"],
  rose: ["#ffb3cd", "#ff7fae", "#e05287"],
  gold: ["#ffe08a", "#ffc93f", "#e0a02e"],
  violet: ["#d9c2ff", "#b18cf5", "#8259cf"],
  mint: ["#b6f5df", "#6fe0bf", "#3bb191"],
  night: ["#3d3a68", "#2a2749", "#1a1830"],
  grass: ["#8ee36b", "#5cc447", "#3d9433"],
  leaf: ["#7fd96a", "#4fb84a", "#2f7f36"],
  water: ["#7fd8f0", "#46b6dd", "#2b87b3"],
  sand: ["#f7e2b0", "#eccf8e", "#cfae6a"],
  // 2026-09-23 사신·천수 — 주작의 주홍, 해태의 옥빛. 기존 램프로는 분홍 새·민트 사자가 됐다.
  vermilion: ["#ffae8a", "#f2643c", "#c23b22"],
  jade: ["#5fd3b0", "#2f9e84", "#1f6f5c"],
} as const;
