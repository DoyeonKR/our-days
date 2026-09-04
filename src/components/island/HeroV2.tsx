"use client";

import Image from "next/image";
import { asset } from "@/lib/base";

const BIRDS = new Set(["hatchling", "sunny", "cozy", "moody", "owl", "arcane_owl", "sage_owl"]);
const FELINES = new Set(["cat", "royal_cat", "lucky_cat", "tiger", "bengal_tiger", "mudeung_tiger", "lion"]);
const CANINES = new Set(["fox", "celestial_fox", "starlight_fox", "wolf", "lunar_wolf", "spirit_wolf"]);
const TALL = new Set(["giraffe"]);
type EyeProfile = { y: number; left: number; right: number; width: number; height: number; skin: string; line?: string };

const DEFAULT_EYES: EyeProfile = { y: 39, left: 39, right: 61, width: 12, height: 10, skin: "#f0c28e" };
const EYES: Record<string, EyeProfile> = {
  hatchling: { y: 43, left: 40, right: 60, width: 12, height: 9, skin: "#ffd05c" },
  sunny: { y: 44, left: 40, right: 60, width: 11, height: 9, skin: "#ffc953" },
  cozy: { y: 42, left: 40, right: 60, width: 11, height: 9, skin: "#f6a4a5" },
  moody: { y: 44, left: 41, right: 59, width: 11, height: 8, skin: "#30333e" },
  fox: { y: 40, left: 40, right: 60, width: 11, height: 9, skin: "#f8b36b" },
  cat: { y: 39, left: 39, right: 61, width: 11, height: 10, skin: "#eee0cc" },
  bear: { y: 40, left: 40, right: 60, width: 10, height: 9, skin: "#a66d42" },
  panda: { y: 40, left: 39, right: 61, width: 12, height: 10, skin: "#242735", line: "#080913" },
  owl: { y: 40, left: 40, right: 60, width: 13, height: 11, skin: "#f1d6a5" },
  wolf: { y: 40, left: 40, right: 60, width: 11, height: 9, skin: "#9eb2c6" },
  celestial_fox: { y: 38, left: 40, right: 60, width: 11, height: 9, skin: "#fbdfbd" },
  starlight_fox: { y: 39, left: 40, right: 60, width: 11, height: 9, skin: "#c9a3ec" },
  royal_cat: { y: 39, left: 39, right: 61, width: 11, height: 9, skin: "#eee5e2" },
  lucky_cat: { y: 40, left: 40, right: 60, width: 10, height: 9, skin: "#f6dcc4" },
  guardian_bear: { y: 40, left: 40, right: 60, width: 10, height: 9, skin: "#79523d" },
  honey_bear: { y: 40, left: 40, right: 60, width: 10, height: 9, skin: "#93603a" },
  zen_panda: { y: 39, left: 39, right: 61, width: 12, height: 10, skin: "#272a35", line: "#090a11" },
  dream_panda: { y: 40, left: 39, right: 61, width: 12, height: 10, skin: "#313040", line: "#11101c" },
  arcane_owl: { y: 39, left: 40, right: 60, width: 13, height: 11, skin: "#d6ae72" },
  sage_owl: { y: 39, left: 40, right: 60, width: 13, height: 11, skin: "#dfbd82" },
  lunar_wolf: { y: 40, left: 40, right: 60, width: 11, height: 9, skin: "#47516f" },
  spirit_wolf: { y: 39, left: 40, right: 60, width: 11, height: 9, skin: "#9ed9dc" },
  tiger: { y: 39, left: 41, right: 59, width: 11, height: 9, skin: "#eda24c" },
  bengal_tiger: { y: 38, left: 41, right: 59, width: 11, height: 9, skin: "#d9e5ea" },
  mudeung_tiger: { y: 38, left: 41, right: 59, width: 11, height: 9, skin: "#a3bc83" },
  lion: { y: 38, left: 41, right: 59, width: 11, height: 9, skin: "#d99a42" },
  giraffe: { y: 31, left: 43, right: 57, width: 9, height: 8, skin: "#c69653" },
};

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
  const eyes = EYES[form] ?? DEFAULT_EYES;
  return (
    <span
      className={`hero-v2 ${motionKind(form)} ${form === "egg" ? "" : "can-blink"} ${active ? "is-active" : ""} ${asleep ? "is-asleep" : ""} ${face ? "is-face" : ""} ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        filter: shadow ? "drop-shadow(0 4px 3px rgba(20, 18, 35, .28))" : undefined,
        ["--hero-delay" as string]: `${(form.length * 173) % 1700}ms`,
        ["--eye-y" as string]: `${eyes.y}%`,
        ["--eye-left" as string]: `${eyes.left}%`,
        ["--eye-right" as string]: `${eyes.right}%`,
        ["--eye-width" as string]: `${eyes.width}%`,
        ["--eye-height" as string]: `${eyes.height}%`,
        ["--eye-skin" as string]: eyes.skin,
        ["--eye-line" as string]: eyes.line ?? "#351c2a",
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
          <span className="hero-closed-eyes" aria-hidden>
            <i className="hero-eye-shut is-left" />
            <i className="hero-eye-shut is-right" />
          </span>
        )}
      </span>
    </span>
  );
}
