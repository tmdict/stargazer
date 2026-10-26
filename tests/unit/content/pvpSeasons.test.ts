import { expect, it } from 'vitest'

import { PVP_SEASONS } from '@/content/pvp/seasons'
import { loadCharacters } from '@/utils/dataLoader'

const heroNames = new Set(loadCharacters().map((character) => character.name))

// A summary is generated with a season's report and copied here, so its heroes
// are checked against the hero list, and every team is named in each language
// the report is written in.
it.each(PVP_SEASONS.map((summary) => [summary.season, summary] as const))(
  'season %i summary names known heroes and each team in its languages',
  (_season, summary) => {
    expect(
      summary.teams.flatMap((team) => team.heroes.filter((slug) => !heroNames.has(slug))),
    ).toEqual([])
    expect(summary.languages[0]).toBe('en')
    expect(
      summary.teams.filter(
        (team) =>
          !team.name.en ||
          Object.keys(team.name).length !== summary.languages.length ||
          summary.languages.some(
            (lang) => lang !== 'en' && (!team.name[lang] || team.name[lang] === team.name.en),
          ),
      ),
    ).toEqual([])
  },
)
