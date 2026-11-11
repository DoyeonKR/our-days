"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import { asset } from "@/lib/base";
import { HERO_V2_FORMS, HERO_V3_FORMS, heroAsset } from "@/lib/heroassets";
import { heroMotion } from "@/lib/heromotion";

/* 도트 대체 그림은 **그때 받는다**(2026-11-11 첫 화면 다이어트). 원화가 있는 폼이 대부분이라 도트는 그림 없는 폼 ·
   다운로드 실패 때만 쓰는데, 정적으로 부르면 펫 도트 표 전부(pixellineage · pixelpet48 — 압축 약 35KB)가 홈 펫과 같이 실렸다. */
const PetPixel = dynamic(() => import("@/components/island/PetPixel"), { ssr: false });

/** 기존 28종 원화 + heroassets.ts의 고해상도 신규 원화. 미등록 폼·다운로드 실패만 도트로 받는다.
 * 두 레지스트리는 자산 폴더 및 PET_FORMS와 테스트로 대조해 깨진 이미지와 임시 그림 회귀를 막는다. */
export { HERO_V2_FORMS } from "@/lib/heroassets";

export default function HeroV2({
  form,
  size = 64,
  asleep = false,
  active = true,
  shadow = true,
  face = false,
  onTap,
  className,
  title,
}: {
  form: string;
  size?: number;
  asleep?: boolean;
  active?: boolean;
  shadow?: boolean;
  face?: boolean;
  onTap?: () => void;
  className?: string;
  title?: string;
}) {
  const source = asset(heroAsset(form, size));
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if ((!HERO_V2_FORMS.has(form) && !HERO_V3_FORMS.has(form)) || failedImage === source) {
    return (
      <PetPixel form={form} size={size} asleep={asleep} active={active} shadow={shadow} face={face} onTap={onTap} className={className} title={title} />
    );
  }
  const resolution = HERO_V3_FORMS.has(form) ? (size <= 64 ? 192 : 768) : 232;
  const motion = heroMotion(form);
  return (
    <span
      className={`hero-v2 is-${motion.kind} ${active && size > 48 ? "is-active" : ""} ${asleep ? "is-asleep" : ""} ${face ? "is-face" : ""} ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        filter: shadow ? "drop-shadow(0 4px 3px rgba(20, 18, 35, .28))" : undefined,
        ["--hero-delay" as string]: `${motion.delay}ms`,
        ["--hero-duration" as string]: `${motion.duration}s`,
        ["--hero-breath" as string]: `${motion.breath}s`,
      }}
      onClick={onTap}
      role="img"
      aria-label={title ?? "펫"}
    >
      <span className="hero-art">
        <Image
          src={source}
          alt=""
          width={resolution}
          height={resolution}
          unoptimized
          draggable={false}
          onError={() => setFailedImage(source)}
          onLoad={() => { if (failedImage !== null) setFailedImage(null); }}
        />
      </span>
    </span>
  );
}
