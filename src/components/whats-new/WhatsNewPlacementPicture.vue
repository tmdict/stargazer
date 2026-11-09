<script setup lang="ts">
/* Placement tips on a board: Grid Info's menu with the tips ticked, the hovered
   hero and the heroes its card names ringed, a better tile in green, and the
   card itself. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import SlCard from '@/components/guide/sl/SlCard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import { GRID_INFO_DEFAULTS, gridInfoMenuRows } from '@/composables/useGridInfoPrefs'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { appLabel, curatedHeroName } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

// Tiles of the first arena map: Alna stands in Valen's row and would do better
// one tile along it.
const MAP_KEY = 'arena1'
const BETTER = [7]
const UNITS = [
  { slug: 'alna', hexId: 9, team: Team.ALLY, ring: 'focus' },
  { slug: 'valen', hexId: 12, team: Team.ALLY, ring: 'named' },
  { slug: 'koko', hexId: 16, team: Team.ALLY },
  { slug: 'gerda', hexId: 4, team: Team.ALLY },
  { slug: 'frieren', hexId: 2, team: Team.ALLY },
  { slug: 'thoran', hexId: 37, team: Team.ENEMY },
  { slug: 'odie', hexId: 34, team: Team.ENEMY },
  { slug: 'vala', hexId: 39, team: Team.ENEMY },
] as const

const units = computed<ThumbnailUnit[]>(() =>
  UNITS.map((unit) => ({
    hexId: unit.hexId,
    team: unit.team,
    image: gameData.getCharacterImage(unit.slug),
    highlight: 'ring' in unit,
    focus: 'ring' in unit && unit.ring === 'focus',
  })),
)

const gridInfo = computed(() => [
  { rows: gridInfoMenuRows({ ...GRID_INFO_DEFAULTS, master: true }, label) },
])

const named = (slug: string): TextPart[] => [
  { text: curatedHeroName(slug, lang.value), marked: true },
]

const lines = computed(() => [
  {
    lead: label('placement-gives'),
    parts: interpolateParts(label('placement-gives-alna'), { heroes: named('valen') }),
  },
  {
    lead: label('placement-stands'),
    parts: interpolateParts(label('placement-stands-better'), {
      better: [{ text: label('placement-better'), marked: true }],
    }),
    better: true,
  },
])
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('arena')">
        <div class="whats-new-placement-from">
          <ToggleChipMenu
            :model-value="true"
            :label="label('grid-info')"
            :options-label="label('grid-info-options')"
            :groups="gridInfo"
            pinned
          />
          <BoardThumbnail
            class="whats-new-placement-board"
            :map-key="MAP_KEY"
            :units
            :better="BETTER"
          />
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('placement-tips')">
        <div class="whats-new-placement-card">
          <SlCard :lines page-look inline />
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.whats-new-placement-from {
  display: flex;
  gap: 12px;
}

.whats-new-placement-board {
  display: block;
  flex: 1;
  min-width: 0;
  max-width: 230px;
}

.whats-new-placement-card {
  display: flex;
  justify-content: center;
}
</style>
