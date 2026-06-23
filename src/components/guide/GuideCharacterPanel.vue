<script setup lang="ts">
import { computed } from 'vue'

import SkillSection from '@/components/skill/SkillSection.vue'
import { useSnippetAnchors } from '@/composables/useSnippetAnchors'
import type { Locale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { loadCharacters, loadSkillLocales } from '@/utils/dataLoader'
import { guideEntries, heroName } from '@/utils/guide'
import { taggedSlots } from '@/utils/guideTags'
import { appLabel, headingFor } from '@/utils/skillLabels'

const props = defineProps<{ slug: string; tag: string; lang: Locale }>()

const gameDataStore = useGameDataStore()

const character = computed(() => loadCharacters().find((c) => c.name === props.slug))
const name = computed(() => heroName(props.slug, props.lang))

// Eager (SSG-baked) prose snippet when the hero has a written guide. Its
// per-slot pieces teleport into the anchors below, so each note lands under the
// skill section it documents (as on the skill page).
const proseComp = computed(() => {
  const entry = guideEntries().find((e) => e.slug === props.slug)
  return entry ? (entry.components[props.lang] ?? entry.components.en) : null
})

// initial-energy-300 pins no slot, so surface the starting energy instead.
const isEnergyTag = computed(() => props.tag === 'initial-energy-300')
const energyIcon = computed(() => gameDataStore.getIcon('initial-energy'))
const energyStat = computed(() => {
  const [base = 0, ...bonuses] = character.value?.energy ?? []
  const bonus = bonuses.reduce((sum, n) => sum + n, 0)
  return bonus ? `${base} (+${bonus})` : String(base)
})

// The tagged slot section(s): the full slot, with tag-bearing levels accented.
const sections = computed(() => {
  const char = character.value
  const file = char ? loadSkillLocales()[props.lang][props.slug] : undefined
  if (!char || !file) return []
  return taggedSlots(char, props.tag)
    .map(({ slotKey, levels: highlightLevels }) => {
      const slot = file[slotKey]
      if (!slot) return null
      return {
        slotKey,
        heading: headingFor(slotKey, slot.n, props.lang),
        levels: slot.d.map((description, i) => ({ level: i + 1, description })),
        highlightLevels,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
})

// An unset slot is skipped by the snippet, so a note only shows under the tag
// whose section it belongs to.
const anchors = useSnippetAnchors()
</script>

<template>
  <div class="char-panel">
    <div class="char-panel-head">
      <h3 class="char-panel-name">{{ name }}</h3>
      <a :href="`/${lang}/skill/${slug}`" class="char-panel-go">{{ appLabel('skills', lang) }}</a>
    </div>

    <div v-if="isEnergyTag" class="char-energy">
      <img :src="energyIcon" alt="" class="char-energy-icon" />
      <span class="char-energy-value">{{ energyStat }}</span>
    </div>

    <template v-for="s in sections" :key="s.slotKey">
      <SkillSection :heading="s.heading" :levels="s.levels" :highlight-levels="s.highlightLevels" />
      <div
        :ref="
          (el) => {
            anchors[s.slotKey].value = el as HTMLElement | null
          }
        "
        class="char-snippet-anchor"
      />
    </template>

    <!-- Hidden source: its per-slot pieces teleport into the anchors above. -->
    <component :is="proseComp" v-if="proseComp" class="char-snippet-host" />
  </div>
</template>

<style scoped>
.char-panel {
  margin: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-medium);
}

.char-panel-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.char-panel-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

/* Pill action mirroring the skill page's tag chips; teal pinned on hover so the
   global `.content a:hover` (red + underline) can't take over. */
.char-panel-go {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5fc4bb;
  text-decoration: none;
  white-space: nowrap;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(95, 196, 187, 0.4);
  transition: background-color 0.15s;
}
.char-panel-go:hover {
  background: rgba(95, 196, 187, 0.1);
  color: #5fc4bb;
  text-decoration: none;
}

.char-energy {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: var(--spacing-md);
  font-size: 1.1rem;
  font-weight: 600;
}
.char-energy-icon {
  width: 20px;
  height: 20px;
}

.char-snippet-host {
  display: none;
}
</style>
