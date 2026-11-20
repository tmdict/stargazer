// One reading of a glossary term for everything that shows one: the Glossary
// page and the keyword pop-ups in skill text. The game's words in the data
// pack come first; the site's own words fill what the game leaves out.

import { GLOSSARY, GLOSSARY_GROUPS, glossaryWords, type GlossaryGroup } from '@/lib/glossary'
import type { SkillLocale } from '@/lib/types/i18n'
import type { GlossaryKeyword, SkillGlossary } from '@/lib/types/skill'
import { loadKeywordImages } from '@/utils/imageLoader'
import { loadGlossaryLocales } from '@/utils/localeLoader'

export interface GlossaryTerm {
  key: string
  name: string
  description: string | null
  note: string | null
  picture: string | null
}

const packEntries = new WeakMap<SkillGlossary, Map<string, GlossaryKeyword>>()

function packEntry(pack: SkillGlossary, key: string): GlossaryKeyword | undefined {
  let entries = packEntries.get(pack)
  if (!entries) {
    entries = new Map([...pack.stats, ...pack.keywords].map((entry) => [entry.key, entry]))
    packEntries.set(pack, entries)
  }
  return entries.get(key)
}

/** A term as `lang` reads it, from that language's pack glossary. Outside the
 * app languages a term the game leaves unnamed reads as its key, and one it
 * leaves undescribed has a picture at most. */
export function glossaryTerm(pack: SkillGlossary, key: string, lang: SkillLocale): GlossaryTerm {
  const { name, description, note } = glossaryWords(
    packEntry(pack, key),
    loadGlossaryLocales()[key],
    lang,
  )
  return {
    key,
    name: name ?? key,
    description: description ?? null,
    note: note ?? null,
    picture: loadKeywordImages()[key] ?? null,
  }
}

/** The Glossary page's terms in `lang`, group by group. */
export function glossaryGroups(
  pack: SkillGlossary,
  lang: SkillLocale,
): { group: GlossaryGroup; terms: GlossaryTerm[] }[] {
  return GLOSSARY_GROUPS.map((group) => ({
    group,
    terms: GLOSSARY[group].map((key) => glossaryTerm(pack, key, lang)),
  }))
}
