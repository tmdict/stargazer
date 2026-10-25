// A hero's outfits sit beside the portrait as `<hero>-skin<N>.png`, N being the
// game's skin number, so the portrait lists leave those names out.
const OUTFIT = /^(.+)-skin\d+$/

/** The hero an outfit file (named without its extension) belongs to; null for a portrait. */
export function outfitHero(name: string): string | null {
  return OUTFIT.exec(name)?.[1] ?? null
}
