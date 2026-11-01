"use client";

/* 우리 수조 그림 — 파일(lib/aquaimages)이 있으면 그 그림, 없으면 임시 그림.
 * 임시 그림은 '자리표시'일 뿐이다: 물고기는 key 에서 색을 뽑은 단순한 물고기 모양, 악세사리는 이름 앞 글자를 적은 점선 상자
 * (이모지는 픽셀 서체에 없는 게 많아 ⊠ 네모로 깨진다).
 * 물고기 그림은 전부 **오른쪽을 본다**(프롬프트 규칙) — 왼쪽으로 헤엄칠 땐 화면이 좌우로 뒤집는다. */
import { asset } from "@/lib/base";
import { DECOR_IMAGE_KEYS, FISH_IMAGE_KEYS } from "@/lib/aquaimages";
import { decorOf } from "@/lib/aquarium";
import { useState, type CSSProperties } from "react";
import { aquaSwimSheet, AQUA_SWIM_SHEETS } from "@/lib/aquamotion";

function hue(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

function SwimArt({ artKey, size }: { artKey: string; size?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const sheet = aquaSwimSheet(artKey)!;
  if (failed) return <FishArt artKey={artKey} size={size} />;
  return (
    <span className="aqua-swim-art" style={{ width: size ?? "100%", height: size ?? "100%" }} aria-hidden>
      {!loaded && <FishArt artKey={artKey} size={size} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!loaded && <img className="aqua-motion-loader" src={asset(sheet)} alt="" ref={img => {
        // A cached image can finish before hydration attaches onLoad.
        if (img?.complete) {
          if (img.naturalWidth > 0) setLoaded(true);
          else setFailed(true);
        }
      }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
      {loaded && <span className="aqua-motion" style={{ backgroundImage: `url(${asset(sheet)})`, "--beat": `${AQUA_SWIM_SHEETS[artKey]}s` } as CSSProperties} />}
    </span>
  );
}

export function FishArt({ artKey, size, animate = false }: { artKey: string; size?: number; animate?: boolean }) {
  if (animate && aquaSwimSheet(artKey)) return <SwimArt key={artKey} artKey={artKey} size={size} />;
  const style = size ? undefined : { width: "100%", height: "100%", objectFit: "contain" as const };
  if (FISH_IMAGE_KEYS.has(artKey)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/aqua/fish/sm/${artKey}.webp`)} alt="" width={size} height={size} style={style} draggable={false} decoding="async" className="aqua-img" />;
  }
  const h = hue(artKey);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={style} aria-hidden focusable="false">
      <path d="M22 50 L4 30 L9 50 L4 70 Z" fill={`hsl(${h} 70% 45%)`} />
      <ellipse cx="55" cy="50" rx="38" ry="24" fill={`hsl(${h} 75% 60%)`} stroke={`hsl(${h} 60% 30%)`} strokeWidth="3" />
      <path d="M50 30 Q60 12 72 30 Z" fill={`hsl(${h} 70% 45%)`} />
      <circle cx="76" cy="44" r="6" fill="#fff" />
      <circle cx="78" cy="44" r="3" fill="#123" />
    </svg>
  );
}

export function DecorArt({ artKey, size }: { artKey: string; size?: number }) {
  const style = size ? undefined : { width: "100%", height: "100%", objectFit: "contain" as const };
  if (DECOR_IMAGE_KEYS.has(artKey)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/aqua/decor/sm/${artKey}.webp`)} alt="" width={size} height={size} style={style} draggable={false} decoding="async" className="aqua-img" />;
  }
  return <span className="aqua-decor-temp" style={size ? { width: size, height: size } : undefined} aria-hidden>{(decorOf(artKey)?.name ?? "?").slice(0, 3)}</span>;
}
