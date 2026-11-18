// One reading of a glossary term for everything that shows one: the Glossary
// page and the keyword pop-ups in skill text. The game's words in the data
// pack come first; the site's own words fill what the game leaves out.

import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryGroup } from '@/lib/glossary'
import { isAppLocale, type LocaleData, type SkillLocale } from '@/lib/types/i18n'
import type { GlossaryKeyword, SkillGlossary } from '@/lib/types/skill'
import { loadKeywordImages } from '@/utils/imageLoader'
import { loadGlossaryLocales } from '@/utils/localeLoader'

export interface GlossaryTerm {
  key: string
  name: string
  description: string | null
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

/** A term as `lang` reads it, from that language's pack glossary. The site's
 * own words exist in the app languages alone, so in any other language a term
 * the game leaves unnamed reads as its key and one it leaves undescribed has a
 * picture at most. */
export function glossaryTerm(pack: SkillGlossary, key: string, lang: SkillLocale): GlossaryTerm {
  const game = packEntry(pack, key)
  const site = loadGlossaryLocales()[key]
  const own = (text?: LocaleData): string | undefined =>
    isAppLocale(lang) ? text?.[lang] : undefined
  return {
    key,
    name: game?.n ?? own(site?.name) ?? key,
    description: game?.d ?? own(site?.description) ?? null,
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
