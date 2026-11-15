import { loadCharacters } from '@/lib/dataLoader'

let heroIds: Map<string, number> | null = null

// Hero names from the oldest hero to the newest, which is the order of their
// ids: for a list cut to its newest heroes, which compareCharacters cannot say.
export function oldestFirst(heroes: readonly string[]): string[] {
  heroIds ??= new Map(loadCharacters().map((hero) => [hero.name, hero.id]))
  const id = (name: string): number => heroIds!.get(name) ?? 0
  return [...heroes].sort((a, b) => id(a) - id(b))
}
