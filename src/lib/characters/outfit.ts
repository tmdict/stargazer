// A picture's outfits sit beside it as `<picture>-skin<N>.png`, N being the
// game's skin number: a hero's beside its portrait, a unit's beside the
// picture a skill draws it with. The portrait lists leave those names out.
const OUTFIT = /^(.+)-skin\d+$/

/** The picture an outfit file (named without its extension) belongs to; null for any other name. */
export function outfitOf(name: string): string | null {
  return OUTFIT.exec(name)?.[1] ?? null
}
