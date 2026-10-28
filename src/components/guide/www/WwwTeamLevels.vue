<script setup lang="ts">
/* A team's Upgrades menu, which sets a level on all of the team's heroes at
   once. A level is lit while every hero on the team shares it. */

import { computed } from 'vue'

import { sideLabelKey, type WwwLevelAttr, type WwwTeamState } from './WwwTeamRow.vue'
import DropdownSelect from '@/components/ui/DropdownSelect.vue'
import UpgradeLevelChips from '@/components/ui/UpgradeLevelChips.vue'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import type { TeamSide } from '@/lib/pvp/sl/www/panel'
import { useI18nStore } from '@/stores/i18n'

const { team } = defineProps<{
  side: TeamSide
  team: WwwTeamState
}>()

const emit = defineEmits<{
  level: [attr: WwwLevelAttr, level: number]
}>()

const LEVEL_ATTRS = [
  { attr: 'paragon', id: ATTR_PARAGON },
  { attr: 'refinement', id: ATTR_REFINEMENT },
] as const

const i18n = useI18nStore()

const heroes = computed(() => team.heroes.flatMap((h) => (h ? [h] : [])))

const sharedLevel = (attr: WwwLevelAttr): number | null => {
  const levels = new Set(heroes.value.map((h) => h[attr]))
  return levels.size === 1 ? [...levels][0]! : null
}
</script>

<template>
  <div class="www-team-levels" role="group" :aria-label="i18n.t(sideLabelKey(side))">
    <DropdownSelect :label="i18n.t('app.upgrades')" floating>
      <template #default>
        <div class="www-levels">
          <template v-for="{ attr, id } in LEVEL_ATTRS" :key="attr">
            <span class="www-levels-label">{{ i18n.t(`app.${attr}`) }}</span>
            <UpgradeLevelChips
              :attr-id="id"
              :lit="sharedLevel(attr)"
              :disabled="!heroes.length"
              @pick="emit('level', attr, $event)"
            />
          </template>
        </div>
      </template>
    </DropdownSelect>
  </div>
</template>

<style scoped>
.www-team-levels {
  --control-font-size: var(--chip-dark-font-size);
}

.www-levels {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 10px 12px;
  padding: var(--spacing-sm);
}

.www-levels-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}
</style>
