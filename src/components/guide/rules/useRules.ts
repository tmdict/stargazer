/* The Formation engine rules page's units and lists, worked out once from Stargazer's
 * own data files and the lists, leans and weights of the build's data pack,
 * and how the page names them in the site language. Without the data pack
 * the page shows the rules without their lists, weights or leans. */

import { computed } from 'vue'
import formationData from 'virtual:formation-rules'

import { CLASS_ORDER, compareCharacters } from '@/lib/filterOrder'
import {
  ruleLists,
  ruleUnit,
  type ListGroup,
  type RuleCard,
  type RuleList,
  type RuleUnit,
} from '@/lib/placement/formationRules'
import { matchesFilter } from '@/lib/placement/lists'
import type { HeroFilter } from '@/lib/placement/types'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import {
  loadAppLocales,
  loadArtifacts,
  loadCharacters,
  loadCharms,
  loadPhantimals,
} from '@/utils/dataLoader'
import { localizedDisplayName, phantimalDisplayName } from '@/utils/nameFormatting'
import { curatedHeroName } from '@/utils/skillLabels'

export interface RulesUnit extends RuleUnit {
  // A charm's holders, by hero slug.
  holders?: string[]
  seasonal?: boolean
}

const weights = formationData?.weights ?? {}

export const RULE_HEROES: readonly CharacterType[] = loadCharacters()
  .filter((hero) => !hero.placeholder)
  .sort(compareCharacters)
const heroById = new Map(RULE_HEROES.map((hero) => [hero.id, hero]))
export const heroOf = (id: number): CharacterType | undefined => heroById.get(id)

export const RULE_UNITS: readonly RulesUnit[] = [
  ...RULE_HEROES.flatMap((hero) =>
    hero.rules?.length ? [ruleUnit('hero', hero.name, hero.rules, weights)] : [],
  ),
  ...[...loadPhantimals()]
    .sort((a, b) => a.id - b.id)
    .flatMap((phantimal) =>
      phantimal.rules?.length
        ? [ruleUnit('phantimal', phantimal.name, phantimal.rules, weights)]
        : [],
    ),
  ...[...loadArtifacts()]
    .sort((a, b) => Number(b.season > 0) - Number(a.season > 0))
    .flatMap((artifact) =>
      artifact.rules?.length
        ? [
            {
              ...ruleUnit('artifact', artifact.name, artifact.rules, weights),
              seasonal: artifact.season > 0,
            },
          ]
        : [],
    ),
  ...loadCharms().flatMap((charm) =>
    charm.rules?.length
      ? [
          {
            ...ruleUnit('charm', charm.id, charm.rules, weights),
            holders: RULE_HEROES.filter((hero) => charm.heroes.includes(hero.name)).map(
              (hero) => hero.name,
            ),
          },
        ]
      : [],
  ),
]

export const heroesMatching = (filter: HeroFilter): number[] =>
  RULE_HEROES.filter((hero) => matchesFilter(hero, filter)).map((hero) => hero.id)

export const RULE_LISTS: Readonly<Record<string, RuleList>> = formationData
  ? ruleLists(formationData.lists, RULE_UNITS, { heroesMatching })
  : {}

const LEANS = {
  front: new Set(formationData?.leans.front),
  back: new Set(formationData?.leans.back),
}

export const leanOf = (id: number): 'front' | 'back' | 'none' =>
  LEANS.front.has(id) ? 'front' : LEANS.back.has(id) ? 'back' : 'none'

export function unitPicture(unit: RuleUnit): string | null {
  const gameData = useGameDataStore()
  if (unit.kind === 'phantimal') return gameData.getCharacterImage(unit.id)
  if (unit.kind === 'artifact') return gameData.getArtifactImage(unit.id)
  return null
}

// The page's parts that are no unit's: the intro first, the rest after the
// units.
export const HOW_VIEW = 'how'
export const SHARED_VIEWS = ['leans', 'map', 'lists', 'questions'] as const

const unitById = new Map(RULE_UNITS.map((unit) => [unit.id, unit]))
export const ruleUnitOf = (id: string): RulesUnit | undefined => unitById.get(id)

// A list the rules share has a name of its own; any other is named after the
// one unit whose rule reads it.
const hasListName = (name: string): boolean => !!loadAppLocales()[`rules-list-${name}`]

// A list's first heroes, as its button shows them.
export const listPeek = (list: RuleList): number[] =>
  (list.ranked.length ? list.ranked : list.equal).flatMap((group) => group.heroes).slice(0, 4)

export const groupSize = (groups: readonly ListGroup[]): number =>
  groups.reduce((sum, group) => sum + group.heroes.length, 0)

export interface ListGroupNames {
  key: 'per-hero' | 'shared'
  label: string
  names: string[]
}

// A part of a sentence, a link to a unit or a list where `go` or `open` names one.
export interface RulesLink {
  text: string
  go?: string
  open?: string
}

export function useRulesNames() {
  const i18n = useI18nStore()
  const lang = computed(() => i18n.currentLocale)
  const t = (key: string, vars?: Record<string, string | number>): string =>
    i18n.t(`app.${key}`, vars)
  const game = (key: string): string => i18n.t(`game.${key}`)

  const heroName = (slug: string): string => curatedHeroName(slug, lang.value)
  // In a sentence the Chinese name goes without the players' nickname in brackets.
  const proseName = (name: string): string =>
    lang.value === 'zh' ? name.replace(/\s*\([^)]*\)$/, '') : name
  const heroNameById = (id: number): string => heroName(heroOf(id)?.name ?? String(id))

  const unitName = (unit: RulesUnit): string => {
    switch (unit.kind) {
      case 'hero':
        return heroName(unit.id)
      case 'phantimal':
        return phantimalDisplayName(lang.value, unit.id)
      case 'artifact':
        return localizedDisplayName(i18n.t, 'artifact', unit.id)
      case 'charm':
        return i18n.t('app.charm')
    }
  }

  const and = (items: string[]): string =>
    new Intl.ListFormat(lang.value, { type: 'conjunction' }).format(items)

  const unitSub = (unit: RulesUnit): string | undefined => {
    if (unit.kind === 'phantimal') return t('rules-phantimal')
    if (unit.kind === 'artifact')
      return unit.seasonal ? t('rules-seasonal-artifact') : t('import-artifact')
    if (unit.kind === 'charm') return and((unit.holders ?? []).map(heroName))
    return undefined
  }

  const listName = (name: string): string => {
    if (hasListName(name)) return t(`rules-list-${name}`)
    const reader = RULE_LISTS[name]?.readers[0]
    const unit = reader && ruleUnitOf(reader.unit)
    return unit ? t('rules-unit-list', { name: proseName(unitName(unit)) }) : name
  }

  // Five classes of six read as every hero but the sixth.
  const everyName = ({ class: classes, range, damage }: HeroFilter): string => {
    const adjectives = [
      ...(range ? [t(`rules-${range}`)] : []),
      ...(damage ? [game(damage).toLowerCase()] : []),
    ]
    const words = (noun: string) =>
      lang.value === 'zh' ? [...adjectives, noun].join('') : [...adjectives, noun].join(' ')
    const named = classes && classes.length < CLASS_ORDER.length ? classes : null
    const className = (key: string) => game(key).toLowerCase()
    if (named?.length === CLASS_ORDER.length - 1) {
      const missing = CLASS_ORDER.find((key) => !named.includes(key))!
      return t('rules-every-but', { class: className(missing), who: words(t('rules-hero')) })
    }
    const noun = named
      ? new Intl.ListFormat(lang.value, { type: 'disjunction' }).format(named.map(className))
      : t('rules-hero')
    return t('rules-every', { who: words(noun) })
  }

  const cardUse = (card: RuleCard): { label: string; text: string } | null => {
    if (!card.use) return null
    const label = card.use === 'avoid' ? 'keep-away' : card.use === 'every' ? 'counts' : 'goes-to'
    return { label: t(`rules-row-${label}`), text: t(`rules-use-${card.use}`) }
  }

  // `{items}` in a sentence, each item a link, joined as the language joins a list.
  function linked(key: string, items: RulesLink[]): RulesLink[] {
    const [before = '', after = ''] = t(key).split('{items}')
    let index = 0
    const parts = new Intl.ListFormat(lang.value, { type: 'conjunction' })
      .formatToParts(items.map((item) => item.text))
      .map((part) => (part.type === 'element' ? items[index++]! : { text: part.value }))
    return [{ text: before }, ...parts, { text: after }]
  }

  // Who reads a list, and the lists that bring it in.
  function listLines(name: string): RulesLink[][] {
    const list = RULE_LISTS[name]
    if (!list) return []
    const readers = list.readers.flatMap(({ unit: id, enemy }) => {
      const unit = ruleUnitOf(id)
      if (!unit) return []
      const text = proseName(unitName(unit))
      return [{ text: enemy ? t('rules-an-enemy', { name: text }) : text, go: id }]
    })
    const into = list.broughtInto.map((other) => ({ text: listName(other), open: other }))
    return [
      ...(readers.length ? [linked('rules-read-by', readers)] : []),
      ...(into.length ? [linked('rules-brought-into', into)] : []),
    ]
  }

  // One hero's lists first, then the shared ones, each group by name.
  function groupLists(names: readonly string[]): ListGroupNames[] {
    const collator = new Intl.Collator(lang.value)
    const sorted = (picked: string[]) =>
      picked.sort((a, b) => collator.compare(listName(a), listName(b)))
    const groups = [
      { key: 'per-hero', names: sorted(names.filter((name) => !hasListName(name))) },
      { key: 'shared', names: sorted(names.filter(hasListName)) },
    ] as const
    return groups
      .filter((group) => group.names.length)
      .map((group) => ({ ...group, label: t(`rules-lists-${group.key}`) }))
  }

  return {
    lang,
    t,
    game,
    heroName,
    proseName,
    heroNameById,
    unitName,
    unitSub,
    listName,
    everyName,
    cardUse,
    and,
    listLines,
    groupLists,
  }
}
