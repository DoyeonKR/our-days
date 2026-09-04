"use client";

import Image from "next/image";
import { asset } from "@/lib/base";

const BIRDS = new Set(["hatchling", "sunny", "cozy", "moody", "owl", "arcane_owl", "sage_owl"]);
const FELINES = new Set(["cat", "royal_cat", "lucky_cat", "tiger", "bengal_tiger", "mudeung_tiger", "lion"]);
const CANINES = new Set(["fox", "celestial_fox", "starlight_fox", "wolf", "lunar_wolf", "spirit_wolf"]);
const TALL = new Set(["giraffe"]);
const BIRD = new Set(["owl", "arcane_owl", "sage_owl"]);
const SMALL_FACE = new Set(["egg", "hatchling", "sunny", "cozy", "moody"]);

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
        ["--eye-y" as string]: TALL.has(form) ? "29%" : BIRD.has(form) ? "37%" : SMALL_FACE.has(form) ? "42%" : "39%",
        ["--eye-gap" as string]: TALL.has(form) ? "15%" : BIRD.has(form) ? "13%" : "14%",
        ["--eye-width" as string]: BIRD.has(form) ? "14%" : "12%",
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
        {form !== "egg" && (
          <span className="hero-eyelids" aria-hidden>
            <i className="hero-eyelid is-left" />
            <i className="hero-eyelid is-right" />
          </span>
        )}
      </span>
    </span>
  );
}
