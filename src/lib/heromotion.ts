/** Whole-illustration motion only: no cut-up anatomy or replacement eye layers. */
export type HeroMotion = "round" | "bird" | "canine" | "feline" | "tall" | "float" | "swim" | "slow" | "hop" | "egg";
const stages = (...families: string[]) => families.flatMap((family) => [2, 3, 4].map((stage) => `${family}_${stage}`));
const groups: Record<HeroMotion, string[]> = {
  egg: ["egg"],
  round: ["bear", "guardian_bear", "honey_bear", "panda", "zen_panda", "dream_panda", ...stages("burr", "toy", "puff", "mush", "snow", "scare", "rac", "mole", "boar"), "bulgasari", "maek", "geumseom", "moth_2", "bee_2", "beetle_2"],
  bird: ["hatchling", "sunny", "cozy", "moody", "owl", "arcane_owl", "sage_owl", "vermilion_bird", "phoenix", "bii_jo", "samjoko", ...stages("volt", "swan", "peng", "peaco")],
  canine: ["fox", "celestial_fox", "starlight_fox", "wolf", "lunar_wolf", "spirit_wolf", "haetae", "baektaek"],
  feline: ["cat", "royal_cat", "lucky_cat", "tiger", "bengal_tiger", "mudeung_tiger", "lion", "white_tiger"],
  tall: ["giraffe", "deer", "forest_deer", "crystal_deer", "baengnok", "cheonrok", "cheonma", ...stages("unicorn", "ele")],
  float: ["azure_dragon", "yellow_dragon", "eungryong", "hong_dragon", "imugi", ...stages("ghost", "bat"), "moth_3", "moth_4", "bee_3", "bee_4", "beetle_3", "beetle_4"],
  swim: ["otter", "pearl_otter", "river_otter", ...stages("octo", "seal", "croc")],
  slow: ["black_tortoise", ...stages("sloth", "koala", "snail", "capy", "conch")],
  hop: ["sprout", "dewy", "rabbit", "moon_rabbit", "blossom_rabbit", "squirrel", "ember_squirrel", "acorn_squirrel", ...stages("leaf", "ember")],
};
export const HERO_MOTIONS: ReadonlyMap<string, HeroMotion> = new Map(
  (Object.entries(groups) as [HeroMotion, string[]][]).flatMap(([kind, forms]) => forms.map((form) => [form, kind] as const)),
);

/** Stable negative phases avoid a synchronized start and hydration randomness. */
export function heroMotion(form: string) {
  let seed = 0;
  for (const char of form) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return {
    kind: HERO_MOTIONS.get(form) ?? "round",
    delay: -(seed % 7000),
    duration: 6.8 + (seed % 17) / 10,
    breath: 3.2 + (seed % 11) / 10,
  };
}
