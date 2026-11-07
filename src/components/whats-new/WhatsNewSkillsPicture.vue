<script setup lang="ts">
/* The Skills menu with one hero and the enemy side unticked, and the board
   drawing only the arrows still ticked. */

import { computed } from 'vue'

import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { appLabel, curatedHeroName } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)

const ALLIES = [
  { slug: 'frieren', at: [2, 0] as const, on: true },
  { slug: 'valen', at: [2, 2] as const, on: false },
  { slug: 'koko', at: [2, 4] as const, on: true },
]
const ENEMIES = [
  { slug: 'thoran', at: [0, 1] as const },
  { slug: 'odie', at: [0, 3] as const },
]

const row = (slug: string, checked: boolean) => ({
  key: slug,
  label: curatedHeroName(slug, lang.value),
  checked,
  sub: true,
})

const groups = computed(() => [
  {
    parent: { key: 'ally', label: label('ally'), checked: false, partial: true },
    rows: ALLIES.map((hero) => row(hero.slug, hero.on)),
  },
  {
    parent: { key: 'enemy', label: label('enemy'), checked: false },
    rows: ENEMIES.map((hero) => row(hero.slug, false)),
  },
])

const tokens = [...ALLIES, ...ENEMIES].map(({ slug, at }) => ({ slug, at }))

const arrows = [
  { from: ALLIES[0]!.at, to: ENEMIES[0]!.at, kind: 'target' as const },
  { from: ALLIES[2]!.at, to: ENEMIES[1]!.at, kind: 'target' as const },
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('skills')">
        <ToggleChipMenu
          :model-value="true"
          :label="label('skills')"
          :options-label="label('skills-options')"
          :groups
          pinned
        />
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('arena')">
        <div class="whats-new-skills-board">
          <HelpBoard :tokens :arrows />
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.whats-new-skills-board {
  width: 250px;
  margin: 12px auto 0;
}

.whats-new-skills-board > svg {
  width: 100%;
}
</style>
