"use client";

import Image from "next/image";
import { asset } from "@/lib/base";
import PetPixel from "@/components/island/PetPixel";

/** public/heroes/v2 에 **실제로 있는** 그림. 없는 폼은 캔버스 도트(PetPixel)로 그린다.
 *  [2026-09-24] 2026-09-22 에 폼이 28 → 49 로 늘었는데 그림은 28장뿐이라, 새싹이·이슬이·토끼·사신 등
 *  21 폼이 **깨진 이미지**로 나왔다(펫 탭 무대 · 섬 탭 아이콘 · 게임 카드 전부). 픽셀 스프라이트는
 *  49 폼 모두 있으니 그걸로 받는다. ⚠ 그림을 추가하면 여기도 추가한다 — heroart.test 가 폴더와 맞춰 본다. */
export const HERO_V2_FORMS: ReadonlySet<string> = new Set(["arcane_owl", "bear", "bengal_tiger", "cat", "celestial_fox", "cozy", "dream_panda", "egg", "fox", "giraffe", "guardian_bear", "hatchling", "honey_bear", "lion", "lucky_cat", "lunar_wolf", "moody", "mudeung_tiger", "owl", "panda", "royal_cat", "sage_owl", "spirit_wolf", "starlight_fox", "sunny", "tiger", "wolf", "zen_panda"]);

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
  if (!HERO_V2_FORMS.has(form)) {
    return (
      <PetPixel form={form} size={size} asleep={asleep} active={active} shadow={shadow} face={face} onTap={onTap} className={className} title={title} />
    );
  }
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
          src={asset(`/heroes/v2/${form}.png`)}
          alt=""
          width={232}
          height={232}
          unoptimized
          draggable={false}
        />
      </span>
    </span>
  );
}
