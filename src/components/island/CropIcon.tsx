"use client";

/* 작물·가공품 아이콘 — PetIcon 과 같은 규약의 **단일 진입점**.
 *
 * 픽셀이 기본이고, 사용자가 일러스트로 바꾸면 기존 SVG 아트로 돌아간다.
 * 새 자리에 작물을 넣을 땐 `cropArt()`/`productArt()` 를 직접 부르지 말고 이걸 쓴다
 * (펫에서 아홉 군데가 제각기 달라졌던 것과 같은 사고를 막는다).
 */

import { type CropStage, cropArt, productArt } from "@/components/island/art/crops";
import PixelSprite from "@/components/island/PixelSprite";
import { cropSprite, productSprite } from "@/lib/pixelcrop";
import { usePixelArt } from "@/lib/pixelpref";

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
  if (pixel) {
    return <PixelSprite sprite={cropSprite(cropKey, stage)} size={size} className={className} title={title} />;
  }
  const A = cropArt(cropKey, stage);
  return (
    <span className={className}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <A size={size} title={title} />
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
  if (pixel) {
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
