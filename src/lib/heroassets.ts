/** Original illustrations plus new detailed pixel originals; shared by DOM, SVG and canvas scenes. */
export const HERO_V2_FORMS: ReadonlySet<string> = new Set(["arcane_owl","bear","bengal_tiger","cat","celestial_fox","cozy","dream_panda","egg","fox","giraffe","guardian_bear","hatchling","honey_bear","lion","lucky_cat","lunar_wolf","moody","mudeung_tiger","owl","panda","royal_cat","sage_owl","spirit_wolf","starlight_fox","sunny","tiger","wolf","zen_panda"]);

export const hasHeroAsset = (form: string): boolean => HERO_V2_FORMS.has(form) || HERO_V3_FORMS.has(form);

/** New deployments must not reuse a previous artwork/thumbnail response from the browser cache. */
export const HERO_ART_REVISION = process.env.NEXT_PUBLIC_APP_VERSION && process.env.NEXT_PUBLIC_APP_VERSION !== "dev"
  ? process.env.NEXT_PUBLIC_APP_VERSION : "20261018-v3";

/** Small icons have their own lightweight derivative. */
export const HERO_V3_FORMS: ReadonlySet<string> = new Set(["azure_dragon","vermilion_bird","white_tiger","black_tortoise","phoenix","haetae","yellow_dragon","ember_2","ember_3","ember_4","burr_2","burr_3","burr_4","leaf_2","leaf_3","leaf_4","conch_2","conch_3","conch_4","bat_2","bat_3","bat_4","toy_2","toy_3","toy_4","beetle_2","beetle_3","beetle_4","volt_2","volt_3","volt_4","moth_2","moth_3","moth_4","bee_2","bee_3","bee_4","puff_2","puff_3","puff_4","ghost_2","ghost_3","ghost_4","swan_2","swan_3","swan_4","mush_2","mush_3","mush_4","snow_2","snow_3","snow_4","scare_2","scare_3","scare_4","peng_2","peng_3","peng_4","sloth_2","sloth_3","sloth_4","rac_2","rac_3","rac_4","mole_2","mole_3","mole_4","octo_2","octo_3","octo_4","capy_2","capy_3","capy_4","koala_2","koala_3","koala_4","snail_2","snail_3","snail_4","croc_2","croc_3","croc_4","unicorn_2","unicorn_3","unicorn_4","boar_2","boar_3","boar_4","seal_2","seal_3","seal_4","peaco_2","peaco_3","peaco_4","ele_2","ele_3","ele_4","sprout","dewy","rabbit","deer","squirrel","otter","moon_rabbit","blossom_rabbit","forest_deer","crystal_deer","ember_squirrel","acorn_squirrel","pearl_otter","river_otter","cheonma","baengnok","bulgasari","imugi","maek","bii_jo","eungryong","baektaek","geumseom","samjoko","cheonrok","hong_dragon"]);

export function heroAsset(form: string, size = 112): string {
  return HERO_V3_FORMS.has(form)
    ? `/heroes/v3/${form}${size <= 64 ? "-icon" : ""}.webp?v=${HERO_ART_REVISION}`
    : `/heroes/v2/${form}.png`;
}
