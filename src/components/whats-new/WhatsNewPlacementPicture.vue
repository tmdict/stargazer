<script setup lang="ts">
/* Placement tips on a board: the hovered hero and the heroes its card names
   ringed, a better tile in green, and the card itself. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import SlCard from '@/components/guide/sl/SlCard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { appLabel, curatedHeroName } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

// Tiles of the first arena map: Alna stands in Valen's row, behind Koko, and
// would do better one tile along her row.
const MAP_KEY = 'arena1'
const BETTER = [7]
const UNITS = [
  { slug: 'alna', hexId: 9, team: Team.ALLY, ring: 'focus' },
  { slug: 'valen', hexId: 12, team: Team.ALLY, ring: 'named' },
  { slug: 'koko', hexId: 16, team: Team.ALLY, ring: 'named' },
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
    parts: interpolateParts(label('placement-stands-behind'), { hero: named('koko') }),
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
        <BoardThumbnail
          class="whats-new-placement-board"
          :map-key="MAP_KEY"
          :units
          :better="BETTER"
        />
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
.whats-new-placement-board {
  display: block;
  width: 230px;
  margin: 0 auto;
}

.whats-new-placement-card {
  display: flex;
  justify-content: center;
}
</style>
