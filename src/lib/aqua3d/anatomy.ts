export type Anatomy = {
  kind: "fish" | "ray" | "jelly" | "dragon";
  /** Body volume prior in the cropped source image; fins keep their actual source outline. */
  cx: number; cy: number; rx: number; ry: number; depth: number;
  frequency: number; flex: number; tail: number;
};
const families: Record<string, Partial<Anatomy>> = {
  guppy: { cx: .71, rx: .27, ry: .13, depth: .21, tail: .43, flex: .16 },
  tetra: { cx: .63, rx: .35, ry: .16, depth: .20, tail: .30, frequency: 6.5 },
  sweetfish: { cx: .61, rx: .36, ry: .17, depth: .19, tail: .27, frequency: 5.4 },
  catfish: { cx: .46, cy: .54, rx: .42, ry: .20, depth: .25, tail: .25, frequency: 3.2, flex: .14 },
  jellyfish: { kind: "jelly", cx: .50, cy: .32, rx: .40, ry: .28, depth: .40, frequency: 1.8, flex: .04 },
  goldfish: { cx: .69, rx: .27, ry: .29, depth: .35, tail: .42, frequency: 3.6 },
  betta: { cx: .77, rx: .21, ry: .16, depth: .19, tail: .54, flex: .24, frequency: 3.8 },
  angel: { cx: .70, rx: .24, ry: .23, depth: .16, tail: .43, frequency: 3.4 },
  clown: { cx: .64, rx: .34, ry: .29, depth: .29, tail: .29, frequency: 4.8 },
  discus: { cx: .64, rx: .33, ry: .43, depth: .20, tail: .29, frequency: 3.1 },
  koi: { cx: .64, rx: .34, ry: .17, depth: .27, tail: .29, frequency: 3.7 },
  arowana: { cx: .61, rx: .37, ry: .17, depth: .23, tail: .25, frequency: 3.1 },
  bluefin: { cx: .66, rx: .33, ry: .19, depth: .34, tail: .30, frequency: 7.3, flex: .055 },
  whale_shark: { cx: .65, rx: .34, ry: .19, depth: .33, tail: .29, frequency: 2.4, flex: .055 },
  ray: { kind: "ray", cx: .69, cy: .57, rx: .30, ry: .31, depth: .20, frequency: 2.3, flex: .12 },
  manta: { kind: "ray", cx: .69, cy: .49, rx: .27, ry: .18, depth: .22, frequency: 2.1, flex: .12 },
  rising: { cx: .56, rx: .41, ry: .20, depth: .24, frequency: 2.6, flex: .14 },
  astral: { cx: .70, rx: .28, ry: .22, depth: .22, frequency: 2.5, flex: .20 },
};

export function anatomy(family: string, key: string): Anatomy {
  const a: Anatomy = { kind: "fish", cx: .66, cy: .50, rx: .31, ry: .20, depth: .25, frequency: 4.6, flex: .10, tail: .32, ...families[family] };
  if (key.startsWith("fry_") || key.startsWith("juv_")) {
    if (["guppy", "betta", "goldfish"].includes(family)) { a.cx -= .08; a.rx += .08; }
    a.flex *= .7;
  }
  if (key === "comet_gold") { a.ry = .17; a.depth = .23; }
  if (key === "ranchu_gold" || key === "oranda_gold") { a.rx = .30; a.ry = .34; a.depth = .39; }
  if (key === "ryukin_gold") { a.ry = .30; a.depth = .32; }
  if (key === "veil_betta") { a.cx = .76; a.cy = .40; }
  if (key === "moon_jelly") Object.assign(a, { kind: "jelly", cx: .50, cy: .20, rx: .35, ry: .19, depth: .43, frequency: 2.1 });
  if (key === "aurora_ray") Object.assign(a, families.manta, { cx: .70 });
  if (/imugi|dragonfish/.test(key)) Object.assign(a, { kind: "dragon", cx: .57, cy: .48, rx: .43, ry: .29, frequency: 2.5, flex: .12 });
  return a;
}
