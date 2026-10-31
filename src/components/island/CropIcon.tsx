"use client";

/* 작물·가공품 아이콘 — PetIcon 과 같은 규약의 **단일 진입점**.
 *
 * 픽셀이 기본이고, 사용자가 일러스트로 바꾸면 기존 SVG 아트로 돌아간다.
 * 새 자리에 작물을 넣을 땐 `cropArt()`/`productArt()` 를 직접 부르지 말고 이걸 쓴다
 * (펫에서 아홉 군데가 제각기 달라졌던 것과 같은 사고를 막는다).
 */

import { type CropStage, cropArt, productArt, hasCropArt, hasProductArt } from "@/components/island/art/crops";
import PixelSprite from "@/components/island/PixelSprite";
import { cropSprite, productSprite } from "@/lib/pixelcrop";
import { usePixelArt } from "@/lib/pixelpref";
import { asset } from "@/lib/base";
import { CROP_IMAGE_KEYS, FOOD_IMAGE_KEYS } from "@/lib/farmimages";

/** 그림 파일(lib/farmimages)이 있으면 도트 · 일러스트 설정과 상관없이 그 그림 — 원화가 가장 좋은 그림이다.
 *  작은 자리(아이콘 ~64px)는 160px 사본을 받는다. */
function FarmImage({ src, size, scale = 1, title }: { src: string; size: number; scale?: number; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset(src)} alt={title ?? ""} title={title} width={Math.round(size * scale)} height={Math.round(size * scale)} draggable={false} decoding="async" loading="lazy" className="farm-image" style={{ imageRendering: "auto" }} />
  );
}

const LEGENDARY_CROPS = new Set(["watermelon", "heavenpeach", "yeongji"]);

export function CropIcon({
  cropKey,
  stage,
  size = 34,
  className,
  title,
}: {
  cropKey: string;
  stage: CropStage;
  size?: number;
  className?: string;
  title?: string;
}) {
  const pixel = usePixelArt();
  const legendary = stage === 3 && LEGENDARY_CROPS.has(cropKey);
  // 다 자란 모습(3)은 그림 그대로, 거의 다 자란 모습(2)은 조금 작게. 새싹(0 · 1)은 도트 새싹 그대로 — 자라는 게 보이게.
  if (stage >= 2 && CROP_IMAGE_KEYS.has(cropKey)) {
    return (
      <span className={`crop-icon-shell${legendary ? " is-legendary" : ""} ${className ?? ""}`} style={{ width: size, height: size }}>
        <FarmImage src={`/farm/crop/${size > 64 ? "" : "sm/"}${cropKey}.webp`} size={size} scale={stage === 3 ? 1 : 0.78} title={title} />
        {legendary && <span aria-hidden className="crop-legend-glint">✦</span>}
      </span>
    );
  }
  // 일러스트 원화가 없는 작물은 일러스트 모드에서도 픽셀로(엉뚱한 기본 새싹 그림 대신)
  if (pixel || !hasCropArt(cropKey)) {
    return (
      <span className={`crop-icon-shell${legendary ? " is-legendary" : ""} ${className ?? ""}`} style={{ width: size, height: size }}>
        <PixelSprite sprite={cropSprite(cropKey, stage)} size={size} title={title} />
        {legendary && <span aria-hidden className="crop-legend-glint">✦</span>}
      </span>
    );
  }
  const A = cropArt(cropKey, stage);
  return (
    <span className={`crop-icon-shell${legendary ? " is-legendary" : ""} ${className ?? ""}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <A size={size} title={title} />
      {legendary && <span aria-hidden className="crop-legend-glint">✦</span>}
    </span>
  );
}

export function ProductIcon({
  productKey,
  size = 34,
  className,
  title,
}: {
  productKey: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const pixel = usePixelArt();
  if (FOOD_IMAGE_KEYS.has(productKey)) {
    return (
      <span className={`crop-icon-shell ${className ?? ""}`} style={{ width: size, height: size }}>
        <FarmImage src={`/farm/food/${size > 64 ? "" : "sm/"}${productKey}.webp`} size={size} title={title} />
      </span>
    );
  }
  if (pixel || !hasProductArt(productKey)) {
    return <PixelSprite sprite={productSprite(productKey)} size={size} className={className} title={title} />;
  }
  const A = productArt(productKey);
  return (
    <span className={className}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <A size={size} title={title} />
    </span>
  );
}
