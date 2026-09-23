"use client";

/* 데코 아이콘 — PetIcon/CropIcon 과 같은 규약의 단일 진입점(픽셀 기본, 일러스트 폴백). */

import { decorArt, hasDecorArt } from "@/components/island/art/decor";
import PixelSprite from "@/components/island/PixelSprite";
import { decorSprite } from "@/lib/pixeldecor";
import { usePixelArt } from "@/lib/pixelpref";

export default function DecorIcon({
  decorKey,
  size = 34,
  className,
  title,
  detailed = false,
}: {
  decorKey: string;
  size?: number;
  className?: string;
  title?: string;
  /** 큰 상점/보관함에서는 100×100 벡터 원화를 사용해 24px 도트보다 세부를 살린다. */
  detailed?: boolean;
}) {
  const pixel = usePixelArt();
  // 일러스트 원화가 없는 장식은 상점(detailed)에서도 픽셀로 — 조약돌 기본 그림이 뜨면 안 된다
  if ((pixel && !detailed) || !hasDecorArt(decorKey)) {
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
