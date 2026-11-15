import { loadCharacters } from '@/lib/dataLoader'

let ages: Map<string, number> | null = null

/** Heroes from the oldest to the newest, which is the order of their ids. */
export function oldestFirst(heroes: readonly string[]): string[] {
  ages ??= new Map(loadCharacters().map((hero) => [hero.name, hero.id]))
  const age = (slug: string): number => ages!.get(slug) ?? Infinity
  return [...heroes].sort((a, b) => age(a) - age(b))
}
