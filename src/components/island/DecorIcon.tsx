"use client";

/* 데코 아이콘 — PetIcon/CropIcon 과 같은 규약의 단일 진입점(픽셀 기본, 일러스트 폴백). */

import { decorArt } from "@/components/island/art/decor";
import PixelSprite from "@/components/island/PixelSprite";
import { decorSprite } from "@/lib/pixeldecor";
import { usePixelArt } from "@/lib/pixelpref";

export default function DecorIcon({
  decorKey,
  size = 34,
  className,
  title,
}: {
  decorKey: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const pixel = usePixelArt();
  if (pixel) {
    return <PixelSprite sprite={decorSprite(decorKey)} size={size} className={className} title={title} />;
  }
  const A = decorArt(decorKey);
  return (
    <span className={className}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <A size={size} title={title} />
    </span>
  );
}
