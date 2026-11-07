"use client";
/* 모험 생물 그림 — 우리 펫 원화(public/heroes) 그대로. back = 내 쪽(뒤돌아 선 느낌으로 좌우 뒤집기). */
import { heroAsset } from "@/lib/heroassets";
import { asset } from "@/lib/base";
import { SPECIES } from "@/lib/adventure";

export default function MonArt({ species, size, back, mode = "full", className = "" }: {
  species: string;
  size: number;
  back?: boolean;
  /** silhouette = 아직 못 만남 · faded = 보기만 함 */
  mode?: "full" | "silhouette" | "faded";
  className?: string;
}) {
  const sp = SPECIES[species];
  const filter = mode === "silhouette" ? "brightness(0) invert(.55) opacity(.45)" : mode === "faded" ? "grayscale(1) opacity(.55)" : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset(heroAsset(species, size))}
      alt={mode === "silhouette" ? "아직 못 만난 생물" : sp?.name ?? ""}
      width={size}
      height={size}
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{ width: size, height: size, transform: back ? "scaleX(-1)" : undefined, filter }}
    />
  );
}
