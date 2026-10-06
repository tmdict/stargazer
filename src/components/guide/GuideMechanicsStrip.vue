<script setup lang="ts">
/* The Mechanics guide's selection: each pick (a click removes it) and one
   Clear. A click on the strip's own background clears the selection too, as
   in the hero pickers. With two or more picks the heroes that satisfy all of
   them are listed, since no single card holds that answer. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconClose from '@/components/ui/IconClose.vue'
import { heroInspectTarget, useInspect } from '@/composables/useInspect'
import { pickKey, tagPicksOf, type MechanicPick } from '@/lib/mechanics'
import { openingPicks } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel, curatedHeroName, mechanicPickLabel } from '@/utils/skillLabels'

const props = defineProps<{
  picks: readonly MechanicPick[]
  // The heroes that satisfy every pick.
  heroes: readonly CharacterType[]
  lang: AppLocale
}>()

const emit = defineEmits<{
  remove: [key: string]
  clear: []
}>()

const { inspect } = useInspect()

function open(hero: CharacterType) {
  const target = heroInspectTarget(hero, openingPicks(hero.tags, tagPicksOf(props.picks)))
  if (target) void inspect(target)
}

// Everything that acts on its own in the strip is a <button>.
function handleStripClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('button')) emit('clear')
}
</script>

<template>
  <div class="strip" @click="handleStripClick">
    <button
      v-for="pick in picks"
      :key="pickKey(pick)"
      type="button"
      class="pick"
      :title="appLabel('clear', lang)"
      @click="emit('remove', pickKey(pick))"
    >
      {{ mechanicPickLabel(pick, lang) }}
      <span class="pick-remove" aria-hidden="true"><IconClose :size="9" /></span>
    </button>
    <span v-if="picks.length > 1" class="faces">
      <button
        v-for="hero in heroes"
        :key="hero.id"
        type="button"
        class="face"
        :aria-label="curatedHeroName(hero.name, lang)"
        @click="open(hero)"
      >
        <GuidePortrait :slug="hero.name" :lang :size="30" />
      </button>
    </span>
    <button type="button" class="clear" @click="emit('clear')">
      {{ appLabel('clear', lang) }}
    </button>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
  border-radius: var(--radius-large);
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  font-size: var(--reading-small-size);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 10px;
  border: none;
  border-radius: 999px;
  background: var(--color-accent-active);
  color: #fff;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.pick-remove {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.pick:hover .pick-remove {
  background: rgba(255, 255, 255, 0.36);
}

.faces {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.face {
  display: flex;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.clear {
  margin-left: auto;
  padding: 3px 11px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
  border-radius: 999px;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.clear:hover {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
</style>
