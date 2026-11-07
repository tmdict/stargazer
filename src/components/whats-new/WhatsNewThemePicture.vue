<script setup lang="ts">
/* The same board and controls in the light look and the dark look, each
   forced with data-theme so the picture shows both whatever the site's look. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import IconMoon from '@/components/ui/IconMoon.vue'
import IconSun from '@/components/ui/IconSun.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { appLabel } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

const MAP_KEY = 'arena1'
const UNITS = [
  { slug: 'koko', hexId: 16, team: Team.ALLY },
  { slug: 'valen', hexId: 12, team: Team.ALLY },
  { slug: 'alna', hexId: 9, team: Team.ALLY },
  { slug: 'gerda', hexId: 4, team: Team.ALLY },
  { slug: 'frieren', hexId: 2, team: Team.ALLY },
  { slug: 'thoran', hexId: 37, team: Team.ENEMY },
  { slug: 'odie', hexId: 34, team: Team.ENEMY },
  { slug: 'vala', hexId: 39, team: Team.ENEMY },
] as const

const units = computed<ThumbnailUnit[]>(() =>
  UNITS.map(({ slug, hexId, team }) => ({
    hexId,
    team,
    image: gameData.getCharacterImage(slug),
  })),
)

const LOOKS = [
  { slot: 'from', theme: 'light', caption: 'light-mode', icon: IconSun },
  { slot: 'to', theme: 'dark', caption: 'dark-mode', icon: IconMoon },
] as const
</script>

<template>
  <HelpScene>
    <template v-for="look in LOOKS" :key="look.theme" #[look.slot]>
      <HelpMock :caption="label(look.caption)" :data-theme="look.theme">
        <div class="help-mock-bar centered">
          <HelpToggle :label="label('skills')" on />
          <HelpToggle :label="label('grid-info')" split />
          <component :is="look.icon" :size="18" class="whats-new-theme-icon" />
        </div>
        <BoardThumbnail class="whats-new-theme-board" :map-key="MAP_KEY" :units />
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.whats-new-theme-icon {
  color: var(--color-text-secondary);
}

.whats-new-theme-board {
  display: block;
  width: 220px;
  margin: 0 auto;
}
</style>
