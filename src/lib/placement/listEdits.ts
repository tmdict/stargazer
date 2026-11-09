/* A visitor's own version of the lists the rules read, for the Hero lists
 * page: kept in the browser under `stargazer.placement.lists` and copied or
 * exported for the owner (docs/architecture/PLACEMENT.md has both shapes). The
 * site always places heroes by its own lists; these only wait to be sent. */

import { CLASS_ORDER } from '../filterOrder'
import { expandList } from './lists'
import type { HeroFilter, ListEntry } from './types'

export type Lists = Record<string, ListEntry[]>

export const LIST_EDITS_KEY = 'stargazer.placement.lists'

interface StoredListEdits {
  lists: Record<string, { entries: ListEntry[]; site: ListEntry[] }>
}

interface ListsExportFile {
  app: 'stargazer'
  kind: 'placement-lists'
  exportedAt: string
  lists: Record<string, ListEntry[]>
}

// What reading the stored value left out, for a line on the page each.
export type ListEditNote =
  | { kind: 'gone'; list: string }
  | { kind: 'unreadable'; list: string }
  | { kind: 'heroes'; list: string; count: number }

export type ListProblem = 'lines' | 'every-above' | 'loop'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Entries are plain JSON, and the page's copies are reactive proxies, which
// structuredClone refuses.
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// One key per entry, the same however an every entry's classes are ordered,
// so a list can be compared with the site's entry by entry.
export function entryKey(entry: ListEntry): string {
  if (typeof entry === 'number') return String(entry)
  if ('list' in entry) return `@${entry.list}`
  if ('line' in entry) return '|line'
  const { class: classes, range, damage } = entry.every
  return `every:${JSON.stringify({ class: classes && [...classes].sort(), range, damage })}`
}

export const sameEntries = (a: readonly ListEntry[], b: readonly ListEntry[]): boolean =>
  a.length === b.length && a.every((entry, i) => entryKey(entry) === entryKey(b[i]!))

// An every entry's filter in the class order the site lists classes in.
export function everyEntry(filter: HeroFilter): ListEntry {
  const every: HeroFilter = {}
  if (filter.class?.length && filter.class.length < CLASS_ORDER.length)
    every.class = CLASS_ORDER.filter((key) => filter.class!.includes(key))
  if (filter.range) every.range = filter.range
  if (filter.damage) every.damage = filter.damage
  return { every }
}

function readFilter(value: unknown): HeroFilter | null {
  if (!isRecord(value)) return null
  const filter: HeroFilter = {}
  for (const [key, field] of Object.entries(value)) {
    if (key === 'class') {
      if (
        !Array.isArray(field) ||
        !field.length ||
        !field.every((c) => CLASS_ORDER.includes(c as string))
      )
        return null
      filter.class = field as string[]
    } else if (key === 'range') {
      if (field !== 'melee' && field !== 'ranged') return null
      filter.range = field
    } else if (key === 'damage') {
      if (field !== 'physical' && field !== 'magic') return null
      filter.damage = field
    } else return null
  }
  return filter
}

// A list's entries as the app writes them. With `known`, a hero number the
// site does not know is dropped and a list it does not have makes the list
// unreadable; without it both are kept, for the site's version a list started
// from, which is only compared with the site's now. Any other entry it cannot
// read makes the list unreadable.
function readEntries(
  value: unknown,
  known?: { site: Lists; heroes: ReadonlySet<number> },
): { entries: ListEntry[]; dropped: number } | null {
  if (!Array.isArray(value)) return null
  const entries: ListEntry[] = []
  let dropped = 0
  for (const entry of value) {
    if (typeof entry === 'number') {
      if (!Number.isInteger(entry)) return null
      if (!known || known.heroes.has(entry)) entries.push(entry)
      else dropped++
      continue
    }
    if (!isRecord(entry) || Object.keys(entry).length !== 1) return null
    if ('list' in entry) {
      if (typeof entry.list !== 'string' || (known && !Object.hasOwn(known.site, entry.list)))
        return null
      entries.push({ list: entry.list })
    } else if ('line' in entry) {
      if (entry.line !== true) return null
      entries.push({ line: true })
    } else if ('every' in entry) {
      const filter = readFilter(entry.every)
      if (!filter) return null
      entries.push({ every: filter })
    } else return null
  }
  return { entries, dropped }
}

// The rules a list must keep for the engine to read it, as the data file's
// own lists keep them: one line at most, every entries only below it, and no
// list that brings itself in.
export function listProblems(lists: Lists, name: string): ListProblem[] {
  const entries = lists[name] ?? []
  const problems: ListProblem[] = []
  const lines = entries.filter((entry) => typeof entry === 'object' && 'line' in entry).length
  if (lines > 1) problems.push('lines')
  const line = entries.findIndex((entry) => typeof entry === 'object' && 'line' in entry)
  if (
    entries.some(
      (entry, i) => typeof entry === 'object' && 'every' in entry && (line < 0 || i < line),
    )
  )
    problems.push('every-above')
  if (!expandList(lists, name, { heroesMatching: () => [] })) problems.push('loop')
  return problems
}

interface ListEdits {
  // Every list, the visitor's version where they changed it.
  lists: Lists
  // The site's version of each changed list when the visitor first changed it,
  // or last chose to keep theirs.
  since: Lists
  notes: ListEditNote[]
}

// The stored value read against the site's lists: a list the site no longer
// has and a list that cannot be read each go, the site's version shown in its
// place. A list that breaks a rule stays, so the page can show the problem.
export function readListEdits(
  text: string | null,
  site: Lists,
  heroes: ReadonlySet<number>,
): ListEdits {
  const edits: ListEdits = { lists: clone(site), since: {}, notes: [] }
  let value: unknown = null
  try {
    value = text === null ? null : JSON.parse(text)
  } catch {
    // An unreadable value leaves the site's lists.
  }
  if (!isRecord(value) || !isRecord(value.lists)) return edits
  for (const [name, stored] of Object.entries(value.lists)) {
    if (!Object.hasOwn(site, name)) {
      edits.notes.push({ kind: 'gone', list: name })
      continue
    }
    const mine = isRecord(stored) ? readEntries(stored.entries, { site, heroes }) : null
    if (!mine) {
      edits.notes.push({ kind: 'unreadable', list: name })
      continue
    }
    edits.lists[name] = mine.entries
    edits.since[name] = (isRecord(stored) && readEntries(stored.site)?.entries) || [...site[name]!]
    if (mine.dropped) edits.notes.push({ kind: 'heroes', list: name, count: mine.dropped })
  }
  return edits
}

export const changedLists = (lists: Lists, site: Lists): string[] =>
  Object.keys(site).filter((name) => lists[name] && !sameEntries(lists[name], site[name]!))

// The value to keep, or null when no list differs from the site's.
export function listEditsValue(lists: Lists, since: Lists, site: Lists): StoredListEdits | null {
  const changed = changedLists(lists, site)
  if (!changed.length) return null
  return {
    lists: Object.fromEntries(
      changed.map((name) => [
        name,
        { entries: clone(lists[name]!), site: clone(since[name] ?? site[name]!) },
      ]),
    ),
  }
}

// The site changed a list after the visitor changed theirs.
export const siteChanged = (name: string, lists: Lists, since: Lists, site: Lists): boolean =>
  name in since &&
  !sameEntries(lists[name] ?? [], site[name] ?? []) &&
  !sameEntries(since[name]!, site[name] ?? [])

// The lists Copy and Export hold: every changed list the engine could read.
export const sendableLists = (lists: Lists, site: Lists): string[] =>
  changedLists(lists, site).filter((name) => !listProblems(lists, name).length)

export function listsExportFile(lists: Lists, site: Lists, exportedAt: string): ListsExportFile {
  return {
    app: 'stargazer',
    kind: 'placement-lists',
    exportedAt,
    lists: Object.fromEntries(
      sendableLists(lists, site).map((name) => [name, clone(lists[name]!)]),
    ),
  }
}

// The file's text, each list on a line of its own, to read in a message.
export function listsExportText(file: ListsExportFile): string {
  const entries = Object.entries(file.lists).map(
    ([name, list]) =>
      `    ${JSON.stringify(name)}: [${list.map((entry) => JSON.stringify(entry)).join(', ')}]`,
  )
  const lists = entries.length ? `{\n${entries.join(',\n')}\n  }` : '{}'
  return `{\n  "app": "stargazer",\n  "kind": "placement-lists",\n  "exportedAt": ${JSON.stringify(file.exportedAt)},\n  "lists": ${lists}\n}\n`
}

interface ListDiff {
  added: Set<string>
  removed: string[]
  // Entries out of the site's order, by key, with their place on the site's list.
  moved: Map<string, number>
}

// The visitor's list against the site's: what came in, what went, and the
// fewest entries that moved, the rest keeping the site's order.
export function listDiff(site: readonly ListEntry[], mine: readonly ListEntry[]): ListDiff {
  const before = site.map(entryKey)
  const after = mine.map(entryKey)
  const added = new Set(after.filter((key) => !before.includes(key)))
  const removed = before.filter((key) => !after.includes(key))
  const common = after.filter((key) => before.includes(key))
  const places = common.map((key) => before.indexOf(key))
  // The longest run of common entries in the site's order stays put.
  const tails: number[] = []
  const tailAt: number[] = []
  const previous: number[] = []
  places.forEach((place, i) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (tails[mid]! < place) low = mid + 1
      else high = mid
    }
    tails[low] = place
    tailAt[low] = i
    previous[i] = low ? tailAt[low - 1]! : -1
  })
  const kept = new Set<string>()
  for (let i = tailAt[tails.length - 1] ?? -1; i >= 0; i = previous[i]!) kept.add(common[i]!)
  const moved = new Map(
    common.filter((key) => !kept.has(key)).map((key) => [key, before.indexOf(key) + 1]),
  )
  return { added, removed, moved }
}
