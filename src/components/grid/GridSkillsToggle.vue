<script setup lang="ts">
/* The Skills control: the chip switches everything skills draw on the boards,
   and its list turns one unit's or artifact's drawings off, or a whole team's
   from the team's own row. A row shows only while that unit draws something, so
   every row has an effect. As on Grid Info, rows keep their ticks while the chip
   is off, and ticking one turns it back on. */

import { computed } from 'vue'

import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { compareCharacters } from '@/lib/filterOrder'
import type { SkillRow } from '@/lib/skills/skill'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const showSkills = defineModel<boolean>({ required: true })

const gameData = useGameDataStore()
const grids = useGrids()
const i18n = useI18nStore()
const { unitName } = useUnitLabels()

const TEAMS = [Team.ALLY, Team.ENEMY]

const teamKey = (team: Team): string => `team-${team}`

const heroOf = (row: SkillRow) =>
  row.kind === 'unit' ? gameData.getCharacterById(row.id) : undefined

// Heroes first, then phantimals, then artifacts.
const rank = (row: SkillRow): number => (row.kind === 'artifact' ? 2 : heroOf(row) ? 0 : 1)

const compareRows = (a: SkillRow, b: SkillRow): number => {
  const [heroA, heroB] = [heroOf(a), heroOf(b)]
  return rank(a) - rank(b) || (heroA && heroB ? compareCharacters(heroA, heroB) : a.id - b.id)
}

const rowLabel = (row: SkillRow): string =>
  row.kind === 'artifact'
    ? localizedDisplayName(i18n.t, 'artifact', gameData.getArtifactById(row.id)?.name ?? '')
    : unitName(row.id)

const shownRows = computed(() =>
  grids.skillRows.filter((row) => row.drawing && (row.team === Team.ALLY || !grids.teamView)),
)

const rowsOf = (team: Team): SkillRow[] =>
  shownRows.value.filter((row) => row.team === team).sort(compareRows)

const isOn = (row: SkillRow): boolean => !grids.hiddenSkills.has(row.key)

const groups = computed(() =>
  TEAMS.flatMap((team) => {
    const rows = rowsOf(team)
    if (rows.length === 0) return []
    const on = rows.filter(isOn).length
    const dim = !showSkills.value
    return [
      {
        parent: {
          key: teamKey(team),
          label: i18n.t(teamLabelKey(team)),
          checked: on === rows.length,
          partial: on > 0 && on < rows.length,
          dim,
        },
        rows: rows.map((row) => ({
          key: row.key,
          label: rowLabel(row),
          checked: isOn(row),
          sub: true,
          dim,
        })),
      },
    ]
  }),
)

// A team's row turns its whole team on unless every unit is on already.
const onToggle = (key: string): void => {
  const team = TEAMS.find((candidate) => teamKey(candidate) === key)
  const keys = team === undefined ? [key] : rowsOf(team).map((row) => row.key)
  const show = keys.some((rowKey) => grids.hiddenSkills.has(rowKey))
  grids.setSkillsHidden(keys, !show)
  if (show) showSkills.value = true
}
</script>

<template>
  <ToggleChipMenu
    v-model="showSkills"
    :label="i18n.t('app.skills')"
    :options-label="i18n.t('app.skills-options')"
    :groups
    @toggle="onToggle"
  />
</template>
