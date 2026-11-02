export type BodyKind = "fish" | "ray" | "turtle" | "jelly" | "dragon";
export type Pattern = "plain" | "stripe" | "clown" | "koi" | "spot" | "neon" | "shell";
export type Appearance = { kind: BodyKind; base: number; accent: number; pattern: Pattern; height: number; width: number; tail: number; long: boolean; glow: boolean };

/** Family topology + per-species material. These are volumetric models, never image planes. */
export function appearance(family: string, key: string): Appearance {
  const p: Appearance = { kind: "fish", base: 0x7ab0ac, accent: 0xd6e5df, pattern: "plain", height: 0.32, width: 0.2, tail: 0.45, long: false, glow: false };
  if (family === "guppy") Object.assign(p, { base: 0xb9b777, accent: 0x172321, pattern: "spot", height: 0.22, width: 0.12, tail: 0.72 });
  if (family === "tetra") Object.assign(p, { base: 0x3999d0, accent: 0xec323c, pattern: "neon", height: 0.24, width: 0.12, tail: 0.32 });
  if (family === "goldfish") Object.assign(p, { base: 0xe69426, accent: 0xf6ede0, pattern: "koi", height: 0.48, width: 0.32, tail: 0.62 });
  if (family === "betta") Object.assign(p, { base: 0x146eb5, accent: 0x994cc4, height: 0.30, width: 0.15, tail: 1.05 });
  if (family === "angel") Object.assign(p, { base: 0xb6bbb2, accent: 0x252728, pattern: "stripe", height: 0.64, width: 0.12, tail: 0.50 });
  if (family === "clown") Object.assign(p, { base: 0xf38221, accent: 0xf5f6e5, pattern: "clown", height: 0.36, width: 0.23 });
  if (family === "discus") Object.assign(p, { base: 0x3594bd, accent: 0x082d4e, pattern: "stripe", height: 0.72, width: 0.18, tail: 0.33 });
  if (family === "koi") Object.assign(p, { base: 0xe7e7d6, accent: 0xc8371b, pattern: "koi", height: 0.35, width: 0.25, tail: 0.42, long: true });
  if (family === "arowana") Object.assign(p, { base: 0xabbab8, accent: 0x706b46, height: 0.26, width: 0.18, long: true, tail: 0.4 });
  if (family === "bluefin") Object.assign(p, { base: 0x284e70, accent: 0xc6d8db, height: 0.42, width: 0.31, tail: 0.8, long: true });
  if (family === "whale_shark") Object.assign(p, { base: 0x36576b, accent: 0xd9dfc9, pattern: "spot", height: 0.37, width: 0.37, tail: 0.8, long: true });
  if (family === "ray" || family === "manta" || key === "aurora_ray") Object.assign(p, { kind: "ray", base: family === "ray" ? 0x4c392a : 0x172d3c, accent: 0xd4d8c1, pattern: family === "ray" ? "spot" : "plain", height: 0.12, width: 0.46 });
  if (family === "sea_turtle") Object.assign(p, { kind: "turtle", base: 0x67623b, accent: 0xc2ae61, pattern: "shell", height: 0.4, width: 0.55 });
  if (family === "rising") Object.assign(p, { kind: key.includes("dragon") || key.includes("imugi") ? "dragon" : "fish", base: key.includes("azure") ? 0x258ea4 : 0xc9a13a, accent: 0xf8e5a0, tail: 0.8, long: true, glow: true });
  if (family === "astral") Object.assign(p, { base: 0x6356b6, accent: 0x91e3f0, pattern: "spot", tail: 0.95, glow: true });
  if (key === "moon_jelly") p.kind = "jelly";
  if (key.includes("red") || key.includes("pigeon")) p.base = 0xd94732;
  if (key.includes("gold") || key.includes("ogon")) p.base = 0xd4a43b;
  if (key.includes("platinum") || key.includes("silver")) p.base = 0xc4d2ce;
  if (key.includes("black")) p.base = 0x18242b;
  if (key.includes("turquoise")) { p.base = 0x289f9a; p.accent = 0x132c5d; }
  if (key.includes("leopard") || key.includes("mosaic") || key.includes("galaxy")) p.pattern = "spot";
  if (key.includes("snowflake")) p.accent = 0xe8f1ef;
  if (key.includes("ranchu")) { p.height = 0.58; p.width = 0.38; }
  const breeds: Record<string, Partial<Appearance>> = {
    tuxedo_guppy: {base:0xb6c9cd,accent:0x173c73,pattern:"koi",tail:.70}, mosaic_guppy:{base:0x3a7eb7,accent:0xdb4e38,tail:.78},
    fullred_guppy:{base:0xd94732,accent:0xb32825,pattern:"plain",tail:.76},
    cardinal_tetra:{base:0x2b8fc3,accent:0xd62b3b,height:.26},glowlight_tetra:{base:0xbba578,accent:0xe78429},diamond_tetra:{base:0xadadce,accent:0xe4dfcd,pattern:"plain",tail:.38},
    comet_gold:{height:.29,width:.19,long:true},ryukin_gold:{height:.55,width:.29,tail:.73},oranda_gold:{base:0xe9e1ce,accent:0xd13c25},
    veil_betta:{base:0x235b9e,accent:0x366eae,tail:.87},crown_betta:{base:0x9e302b,accent:0x4f282d,tail:.88},
    koi_betta:{base:0xeee3cf,accent:0xc7382f,pattern:"koi",tail:.85},
    marble_angel:{base:0xd2d8ce,accent:0x202c32,pattern:"koi"},platinum_angel:{base:0xdfe4d9,accent:0xbfc9c1,pattern:"plain"},altum_angel:{base:0xc4ad81,height:.79},
    snowflake_clown:{base:0xd68d3c,accent:0xf2f1e4,height:.41},blackice_clown:{base:0x202a30,accent:0xe7eee7},
    pigeon_discus:{base:0xdeaa72,accent:0xc74831,pattern:"spot"},leopard_discus:{base:0xcbac71,accent:0x9d3b32,pattern:"spot"},
    sanke_koi:{base:0xe1dfc9,accent:0xc6402b,tail:.49},showa_koi:{base:0xb83d2d,accent:0x202b2e,tail:.47},ogon_koi:{base:0xcfa83f,accent:0xc7a346,pattern:"plain"},
    polka_ray:{base:0x243237,accent:0xe5ddc4},black_ray:{base:0x12272a,accent:0xa2b7b0},pearl_ray:{base:0x6e6653,accent:0xe1d1a8},
    imugi_fish:{base:0x4d837b,accent:0xc9c59c},azure_dragonfish:{base:0x268da1,accent:0xd1d8ae},golden_dragonfish:{base:0xc5a443,accent:0xf0e1a8},
    aurora_ray:{base:0x6e87ab,accent:0xa5dfd2},galaxy_fish:{base:0x3b3f83,accent:0xb4cfe2},genesis_fish:{base:0xd2d3b2,accent:0xad9344,pattern:"plain"},
  };
  Object.assign(p,breeds[key]);
  return p;
}
