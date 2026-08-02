"use client";

/* 홈 월드 소품 — PetIcon/CropIcon/DecorIcon 과 같은 규약의 단일 진입점(픽셀 기본, 일러스트 폴백).
 *
 * 소품은 우편함·이정표·나룻배·벤치처럼 **홈 화면 여기저기에 흩어져** 있다. 각 자리에서 SVG 를
 * 직접 부르면 픽셀 전환 때 한 곳만 빠뜨려도 홈에 두 스타일이 섞인다. 여기 한 곳만 본다. */

import {
  BenchBook,
  LoveLetter,
  Mailbox,
  NestEgg,
  PhotoCard,
  RowBoat,
  Signpost,
} from "@/components/island/art/world";
import PixelSprite from "@/components/island/PixelSprite";
import { worldSprite } from "@/lib/pixelworld";
import { usePixelArt } from "@/lib/pixelpref";

export type WorldPropKind =
  | "mailbox"
  | "signpost"
  | "rowboat"
  | "benchbook"
  | "nestegg"
  | "photocard"
  | "loveletter";

const SVG = {
  mailbox: Mailbox,
  signpost: Signpost,
  rowboat: RowBoat,
  benchbook: BenchBook,
  nestegg: NestEgg,
  photocard: PhotoCard,
  loveletter: LoveLetter,
} as const;

export default function WorldProp({
  kind,
  size = 38,
  className,
  title,
}: {
  kind: WorldPropKind;
  size?: number;
  className?: string;
  title?: string;
}) {
  const pixel = usePixelArt();
  if (pixel) {
    return <PixelSprite sprite={worldSprite(kind)} size={size} className={className} title={title} />;
  }
  const A = SVG[kind];
  return (
    <span className={className}>
      <A size={size} title={title} />
    </span>
  );
}
