/* The lists page's state, shared by its parts: every list as the visitor has
 * it, the site's version each changed list started from, undo and redo, and
 * what reading the stored value left out. Each change is kept in the browser
 * at once. The stored value is read only once the page has mounted, so the
 * baked page shows the site's lists. */

import { computed, inject, provide, ref, shallowReactive, type InjectionKey, type Ref } from 'vue'
import formationData from 'virtual:formation-rules'

import type { RuleCard } from '@/lib/placement/formationRules'
import {
  changedLists,
  clone,
  entryKey,
  everyEntry,
  LIST_EDITS_KEY,
  listDiff,
  listEditsValue,
  listProblems,
  readListEdits,
  sameEntries,
  sendableLists,
  siteChanged,
  type ListEditNote,
  type ListProblem,
  type Lists,
} from '@/lib/placement/listEdits'
import type { HeroFilter, ListEntry } from '@/lib/placement/types'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import {
  heroesMatching,
  RULE_HEROES,
  RULE_UNITS,
  useRulesNames,
  type RulesUnit,
} from '../rules/useRules'
import { listLayout, type ListLayout } from './listLayout'

export const SITE_LISTS: Lists = formationData?.lists ?? {}
const HERO_IDS = new Set(RULE_HEROES.map((hero) => hero.id))

interface ListReader {
  unit: RulesUnit
  card: RuleCard
}

const READERS: Record<string, ListReader[]> = {}
for (const unit of RULE_UNITS)
  for (const card of unit.cards) if (card.list) (READERS[card.list] ??= []).push({ unit, card })

export const readersOf = (name: string): ListReader[] => READERS[name] ?? []

// What the rules reading a list, or a list it is brought into, want of its order.
type ListUse = NonNullable<RuleCard['use']>

interface Snapshot {
  lists: Lists
  since: Lists
  // The list the change made from this state was on, for Undo and Redo to
  // show; null for one that changed every list.
  list: string | null
}

interface ListEditorEvents {
  open: (name: string) => void
  refuse: (problems: ListProblem[]) => void
}

const isLine = (entry: ListEntry): boolean => typeof entry === 'object' && 'line' in entry

export function createListEditor(current: Readonly<Ref<string>>, events: ListEditorEvents) {
  const lists = ref<Lists>(clone(SITE_LISTS))
  const since = ref<Lists>({})
  const notes = ref<ListEditNote[]>([])
  const saveFailed = ref(false)
  const past = shallowReactive<Snapshot[]>([])
  const future = shallowReactive<Snapshot[]>([])
  // The entry to focus after a change, and an entry already on the list to point out.
  const focusKey = ref<string | null>(null)
  const flashKey = ref<string | null>(null)

  const names = computed(() => Object.keys(SITE_LISTS))
  const layouts = computed<Record<string, ListLayout>>(() =>
    Object.fromEntries(
      names.value.map((name) => [name, listLayout(lists.value, name, heroesMatching)]),
    ),
  )
  // Each hero's place on the site's own version of a list.
  const sitePlaces = (name: string): Map<number, number> =>
    listLayout(SITE_LISTS, name, heroesMatching).places
  const problems = computed<Record<string, ListProblem[]>>(() =>
    Object.fromEntries(names.value.map((name) => [name, listProblems(lists.value, name)])),
  )
  const changed = computed(() => changedLists(lists.value, SITE_LISTS))
  const sendable = computed(() => sendableLists(lists.value, SITE_LISTS))
  const isChanged = (name: string): boolean => changed.value.includes(name)
  const isSiteChanged = (name: string): boolean =>
    siteChanged(name, lists.value, since.value, SITE_LISTS)
  const diffOf = (name: string) => listDiff(SITE_LISTS[name] ?? [], lists.value[name] ?? [])

  // The lists that bring a list in, with the entry that does and whether it
  // sits below their line.
  const parentsOf = (name: string): { list: string; entry: number; below: boolean }[] =>
    names.value.flatMap((other) => {
      const entries = lists.value[other] ?? []
      const at = entries.findIndex(
        (entry) => typeof entry === 'object' && 'list' in entry && entry.list === name,
      )
      if (other === name || at < 0) return []
      return [{ list: other, entry: at + 1, below: entries.slice(0, at).some(isLine) }]
    })

  function usesOf(name: string, seen = new Set<string>()): Set<ListUse> {
    const uses = new Set<ListUse>()
    if (seen.has(name)) return uses
    seen.add(name)
    for (const { card } of readersOf(name)) if (card.use) uses.add(card.use)
    for (const parent of parentsOf(name)) for (const use of usesOf(parent.list, seen)) uses.add(use)
    return uses
  }

  function persist(): void {
    for (const name of names.value) {
      if (sameEntries(lists.value[name] ?? [], SITE_LISTS[name]!)) delete since.value[name]
      else since.value[name] ??= clone(SITE_LISTS[name]!)
    }
    const value = listEditsValue(lists.value, since.value, SITE_LISTS)
    if (value) saveFailed.value = !writeStorage(LIST_EDITS_KEY, JSON.stringify(value))
    else {
      removeStorage(LIST_EDITS_KEY)
      saveFailed.value = false
    }
  }

  function load(): void {
    const read = readListEdits(readStorage(LIST_EDITS_KEY), SITE_LISTS, HERO_IDS)
    lists.value = read.lists
    since.value = read.since
    notes.value = read.notes
    // What reading left out goes from the browser too.
    if (read.notes.length) persist()
  }

  const snapshot = (list: string | null): Snapshot =>
    clone({ lists: lists.value, since: since.value, list })

  // A change that would break a rule is not made: only a site update can
  // leave a list breaking one, for the visitor to fix.
  function step(
    edit: () => void,
    focus: string | null = null,
    list: string | null = current.value,
  ): void {
    const before = snapshot(list)
    const had = problems.value
    edit()
    const added = new Set(
      names.value.flatMap((name) =>
        listProblems(lists.value, name).filter((problem) => !had[name]!.includes(problem)),
      ),
    )
    if (added.size) {
      lists.value = before.lists
      since.value = before.since
      return events.refuse([...added])
    }
    past.push(before)
    future.length = 0
    persist()
    focusKey.value = focus
  }

  function travel(from: Snapshot[], to: Snapshot[]): void {
    const back = from.pop()
    if (!back) return
    to.push(snapshot(back.list))
    lists.value = back.lists
    since.value = back.since
    persist()
    if (back.list !== null && back.list !== current.value) events.open(back.list)
  }
  const undo = (): void => travel(past, future)
  const redo = (): void => travel(future, past)

  const entries = (): ListEntry[] => lists.value[current.value]!

  function move(from: number, to: number): void {
    const list = entries()
    const target = Math.max(0, Math.min(list.length - 1, to))
    if (target === from) return
    step(() => {
      const [entry] = list.splice(from, 1)
      list.splice(target, 0, entry!)
    }, entryKey(list[from]!))
  }

  // Where an entry taken from `from` goes to stand at `rank` among the
  // heroes above the line: before the first entry that ranks there or lower.
  function indexForRank(from: number, rank: number): number {
    const rest = entries().filter((_, i) => i !== from)
    const { rows } = listLayout(
      { ...lists.value, [current.value]: rest },
      current.value,
      heroesMatching,
    )
    const at = rows.findIndex((row) => {
      if (row.kind === 'line') return true
      if (row.kind === 'hero')
        return !row.hero.counted && (!row.hero.place || row.hero.place >= rank)
      return row.first !== undefined
        ? row.first >= rank
        : row.items.some((item) => !item.counted && !item.place)
    })
    return at < 0 ? rest.length : at
  }

  const moveToRank = (from: number, rank: number): void =>
    move(from, indexForRank(from, Math.max(1, rank)))

  function remove(index: number): void {
    const list = entries()
    const next = list[index + 1] ?? list[index - 1]
    step(() => list.splice(index, 1), next === undefined ? null : entryKey(next))
  }

  function flash(key: string): void {
    flashKey.value = null
    // A second press on the same hero points it out again.
    queueMicrotask(() => (flashKey.value = key))
  }

  function addHero(id: number, at?: number): void {
    const list = entries()
    const was = list.indexOf(id)
    if (was >= 0 && at === undefined) return flash(String(id))
    step(() => {
      let to = at ?? list.length
      if (was >= 0) {
        list.splice(was, 1)
        if (to > was) to--
      }
      list.splice(to, 0, id)
    }, String(id))
  }

  function addEntry(entry: ListEntry, withLine: boolean): void {
    const key = entryKey(entry)
    const list = entries()
    if (list.some((other) => entryKey(other) === key)) return flash(key)
    step(() => {
      if (withLine && !list.some(isLine)) list.push({ line: true })
      list.push(entry)
    }, key)
  }

  // An every entry goes below the line, with a line added for it if need be.
  const addEvery = (filter: HeroFilter): void => addEntry(everyEntry(filter), true)
  const addList = (name: string): void => addEntry({ list: name }, false)
  const addLine = (): void => addEntry({ line: true }, false)

  // An entry the visitor took off goes back after the nearest entry before it
  // on the site's list that the visitor's list still has.
  function putBack(key: string): void {
    const site = SITE_LISTS[current.value]!
    const entry = site.find((other) => entryKey(other) === key)
    if (entry === undefined) return
    const now = entries().map(entryKey)
    const before = site
      .slice(0, site.indexOf(entry))
      .reverse()
      .map(entryKey)
      .find((other) => now.includes(other))
    const at = before === undefined ? 0 : now.indexOf(before) + 1
    step(() => entries().splice(at, 0, clone(entry)), key)
  }

  const resetList = (): void =>
    step(() => (lists.value[current.value] = clone(SITE_LISTS[current.value]!)))

  function resetAll(): void {
    step(
      () => {
        lists.value = clone(SITE_LISTS)
        since.value = {}
      },
      null,
      null,
    )
  }

  const keepMine = (): void =>
    step(() => (since.value[current.value] = clone(SITE_LISTS[current.value]!)))

  const takeSite = (): void => resetList()

  const dismiss = (index: number): void => void notes.value.splice(index, 1)

  return {
    current,
    lists,
    notes,
    saveFailed,
    past,
    future,
    focusKey,
    flashKey,
    names,
    layouts,
    sitePlaces,
    problems,
    changed,
    sendable,
    isChanged,
    isSiteChanged,
    diffOf,
    parentsOf,
    usesOf,
    load,
    undo,
    redo,
    move,
    moveToRank,
    remove,
    addHero,
    addEvery,
    addList,
    addLine,
    putBack,
    resetList,
    resetAll,
    keepMine,
    takeSite,
    dismiss,
  }
}

export type ListEditor = ReturnType<typeof createListEditor>

const EDITOR: InjectionKey<ListEditor> = Symbol('list-editor')

export const provideListEditor = (editor: ListEditor): void => provide(EDITOR, editor)
export const useListEditor = (): ListEditor => inject(EDITOR)!

// The page's words for entries and readers, on top of the Formation engine rules page's.
export function useListWords() {
  const names = useRulesNames()
  const { lang, t, proseName, heroNameById, unitName, listName, everyName, and } = names

  // Inside an English sentence a name that is not a proper name starts small.
  const small = (text: string): string =>
    lang.value === 'en' ? text.charAt(0).toLowerCase() + text.slice(1) : text

  const entryName = (entry: ListEntry, inSentence = false): string => {
    if (typeof entry === 'number')
      return inSentence ? proseName(heroNameById(entry)) : heroNameById(entry)
    if ('list' in entry) return listName(entry.list)
    const name = 'line' in entry ? t('rules-line') : everyName(entry.every)
    return inSentence ? small(name) : name
  }

  const readerName = ({ unit, card }: ListReader): string => {
    const name = proseName(unitName(unit))
    return card.team === 'enemy' ? t('rules-an-enemy', { name }) : name
  }

  const readersLine = (name: string, parents: readonly string[]): string => {
    const all = [
      ...new Set(readersOf(name).map(readerName)),
      ...parents.map((parent) => t('lists-in', { list: listName(parent) })),
    ]
    return all.length ? and(all) : t('lists-no-reader')
  }

  return { ...names, entryName, readersLine }
}
