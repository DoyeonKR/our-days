"use client";

import Image from "next/image";
import { asset } from "@/lib/base";

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
      className={`hero-v2 ${active ? "is-active" : ""} ${asleep ? "is-asleep" : ""} ${face ? "is-face" : ""} ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, filter: shadow ? "drop-shadow(0 4px 3px rgba(20, 18, 35, .28))" : undefined }}
      onClick={onTap}
      role="img"
      aria-label={title ?? "펫"}
    >
      <Image
        src={asset(`/heroes/v2/${form}.png`)}
        alt=""
        width={232}
        height={232}
        unoptimized
        draggable={false}
      />
    </span>
  );
}
