// The data pack's skill text, one lazy chunk per language, and what reads it
// without waiting: the languages already loaded, the numbers every language
// shares, and which heroes have text at all.

import { shallowReactive } from 'vue'

import type { SkillLocale } from '@/lib/types/i18n'
import type {
  SkillArtifacts,
  SkillCharms,
  SkillKeywords,
  SkillLanguage,
  SkillLocaleFile,
  SkillNumbers,
  SkillPhantimals,
  SkillTerms,
} from '@/lib/types/skill'
import skillNumbers from '@/pack/text/skill/numbers.json'
import { fileStem } from './fileStem'

// The locale dirs carry reserved underscore-prefixed files beside the hero
// files. They ride the same globs and chunks, but are split out at load time
// so dict consumers (the search index, slug walks) only ever see hero entries.
// The glob types every module as SkillLocaleFile, hence the cast.
function splitSkillDict(dict: Record<string, SkillLocaleFile>): SkillLanguage {
  const reserved = dict as unknown as {
    _terms: SkillTerms
    _keywords?: SkillKeywords
    _charms?: SkillCharms
    _artifacts?: SkillArtifacts
    _phantimals?: SkillPhantimals
  }
  return {
    heroes: Object.fromEntries(Object.entries(dict).filter(([key]) => !key.startsWith('_'))),
    terms: reserved._terms,
    keywords: reserved._keywords ?? {},
    charms: reserved._charms ?? null,
    artifacts: reserved._artifacts ?? {},
    phantimals: reserved._phantimals ?? {},
  }
}

// Skill text ships as one lazy chunk per language, so no page downloads a
// language it does not show: each language folder holds an index.ts, written
// by npm run data, whose eager same-folder glob inlines that folder's JSON
// into a single chunk. Loading is promise-cached per locale; the route warm-up
// guard, the skill modal, the search index and the app's background fetch of
// the reader's language all share it.
const skillLocaleChunks = import.meta.glob<Record<string, SkillLocaleFile>>(
  '@/pack/text/skill/*/index.ts',
  { import: 'default' },
)
// Reactive so whatever was computed before a language arrived re-renders when
// it lands. Shallow: the text itself never changes.
const warmedSkillLocales = shallowReactive(new Map<SkillLocale, SkillLanguage>())
const skillLocalePromises = new Map<SkillLocale, Promise<SkillLanguage>>()

export function loadSkillLocale(lang: SkillLocale): Promise<SkillLanguage> {
  const pending = skillLocalePromises.get(lang)
  if (pending) return pending
  const loader = skillLocaleChunks[`/src/pack/text/skill/${lang}/index.ts`]
  if (!loader) return Promise.reject(new Error(`No skill locale chunk for "${lang}"`))
  const promise = loader().then((dict) => {
    const language = splitSkillDict(dict)
    warmedSkillLocales.set(lang, language)
    return language
  })
  // A failed load is dropped so the next call asks again. Chrome remembers a
  // failed import and repeats the failure until the page is reloaded.
  promise.catch(() => skillLocalePromises.delete(lang))
  skillLocalePromises.set(lang, promise)
  return promise
}

/** Sync read of a language; null until loadSkillLocale has resolved. Page
 * loads are warmed by the skill route's guard; the modal and search await
 * loadSkillLocale explicitly. */
export function getSkillLanguage(lang: SkillLocale): SkillLanguage | null {
  return warmedSkillLocales.get(lang) ?? null
}

/** Sync read of a language's hero dict; null until the locale is warmed. */
export function getSkillLocaleDict(lang: SkillLocale): Record<string, SkillLocaleFile> | null {
  return getSkillLanguage(lang)?.heroes ?? null
}

/** Sync read of one hero's file; null until the locale is warmed. */
export function getSkillFile(lang: SkillLocale, slug: string): SkillLocaleFile | null {
  return getSkillLanguage(lang)?.heroes[slug] ?? null
}

/** A hero's per-slot cooldowns and ranges; language-independent, so one eager
 * file serves every skill language. */
export function getSkillNumbers(slug: string): SkillNumbers[string] {
  return (skillNumbers as SkillNumbers)[slug] ?? {}
}

/** Sync read of a language's seasonal charm text (`_charms.json`); null until
 * the locale is warmed, and always null once charms are retired. */
export function getSkillCharms(lang: SkillLocale): SkillCharms | null {
  return getSkillLanguage(lang)?.charms ?? null
}

const SKILL_HEROES: ReadonlySet<string> = new Set(
  Object.keys(
    import.meta.glob(['@/pack/text/skill/en/*.json', '!@/pack/text/skill/en/_*.json']),
  ).map(fileStem),
)

/** True iff the pack holds skill text for `slug`, from the English file names
 * so the answer needs no language loaded. Gates the surfaces where a missing
 * locale would surface a dead link (the info button, the modal, the reader's
 * visibleSlug) so a character JSON without a matching locale file degrades
 * gracefully. A build stops unless every language holds the same heroes as
 * English, so one list answers for all 16 locales. */
export function hasSkillLocale(slug: string): boolean {
  return SKILL_HEROES.has(slug)
}
