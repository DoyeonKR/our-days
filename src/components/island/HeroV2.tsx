"use client";

import Image from "next/image";
import { asset } from "@/lib/base";

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
  return (
    <span
      className={`hero-v2 ${motionKind(form)} ${form === "egg" ? "" : "can-blink"} ${active ? "is-active" : ""} ${asleep ? "is-asleep" : ""} ${face ? "is-face" : ""} ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        filter: shadow ? "drop-shadow(0 4px 3px rgba(20, 18, 35, .28))" : undefined,
        ["--hero-delay" as string]: `${(form.length * 173) % 1700}ms`,
        ["--eye-top" as string]: TALL.has(form) ? "17%" : "24%",
        ["--eye-bottom" as string]: TALL.has(form) ? "43%" : "52%",
      }}
      onClick={onTap}
      role="img"
      aria-label={title ?? "펫"}
    >
      {(["hero-top", "hero-eyes", "hero-body"] as const).map((part) => (
        <Image
          key={part}
          className={part}
          src={asset(`/heroes/v2/${form}.png`)}
          alt=""
          width={232}
          height={232}
          unoptimized
          draggable={false}
        />
      ))}
    </span>
  );
}
