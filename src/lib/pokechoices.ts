export type PokeChoice = {kind:string; emoji:string; label:string; message:string; variants:readonly string[]};

/** Preview rotation excludes the current sentence, even with a deterministic RNG. */
export function nextPokeVariant(choice:PokeChoice, previous:string, random= Math.random):string {
  const pool = [...new Set([choice.message,...choice.variants])].filter((s)=>s.trim() && s!==previous);
  if (!pool.length) return choice.message;
  const sample = random();
  const index = Math.floor(Math.max(0,Math.min(Number.isFinite(sample)?sample:0,0.999999999))*pool.length);
  return pool[index];
}
