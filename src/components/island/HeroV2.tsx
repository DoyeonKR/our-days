"use client";

import Image from "next/image";
import { useState } from "react";
import { asset } from "@/lib/base";
import { HERO_V2_FORMS, HERO_V3_FORMS, heroAsset } from "@/lib/heroassets";
import PetPixel from "@/components/island/PetPixel";

/** 기존 28종 원화 + heroassets.ts의 고해상도 신규 원화. 미등록 폼·다운로드 실패만 도트로 받는다.
 * 두 레지스트리는 자산 폴더 및 PET_FORMS와 테스트로 대조해 깨진 이미지와 임시 그림 회귀를 막는다. */
export { HERO_V2_FORMS } from "@/lib/heroassets";

const BIRDS = new Set(["hatchling", "sunny", "cozy", "moody", "owl", "arcane_owl", "sage_owl"]);
const FELINES = new Set(["cat", "royal_cat", "lucky_cat", "tiger", "bengal_tiger", "mudeung_tiger", "lion"]);
const CANINES = new Set(["fox", "celestial_fox", "starlight_fox", "wolf", "lunar_wolf", "spirit_wolf"]);
const TALL = new Set(["giraffe"]);

function motionKind(form: string): string {
  if (BIRDS.has(form)) return "is-bird";
  if (FELINES.has(form)) return "is-feline";
  if (CANINES.has(form)) return "is-canine";
  if (TALL.has(form)) return "is-tall";
  return "is-round";
}

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
  return (
    <span
      className={`hero-v2 ${motionKind(form)} ${active ? "is-active" : ""} ${asleep ? "is-asleep" : ""} ${face ? "is-face" : ""} ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        filter: shadow ? "drop-shadow(0 4px 3px rgba(20, 18, 35, .28))" : undefined,
        ["--hero-delay" as string]: `${(form.length * 173) % 1700}ms`,
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
