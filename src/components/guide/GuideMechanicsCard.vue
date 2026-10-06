<script setup lang="ts">
/* One mechanic on the Mechanics guide: its title, its controls (a tag's
   modifiers as chips, or what the `controls` slot holds) and its heroes. A
   click anywhere on the card picks it, except on a control or a hero, which
   act on themselves. A hero the page's picks or its name search leave out is
   dimmed in place, so the card keeps its shape. */

import { computed } from 'vue'

import CharacterIcon from '@/components/CharacterIcon.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import { heroInspectTarget, useInspect } from '@/composables/useInspect'
import {
  ENERGY_KEY,
  matchesMechanic,
  pickKey,
  tagPicksOf,
  type MechanicPick,
} from '@/lib/mechanics'
import { matchesPick, openingPicks, tagPick, type TagVocabulary } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { AppLocale } from '@/lib/types/i18n'
import type { TagPick } from '@/lib/types/skill'
import { mechanicLabel, modifierLabel } from '@/utils/skillLabels'

const props = defineProps<{
  // A tag, or the energy filter's key.
  entry: string
  heroes: readonly CharacterType[]
  // Every pick on the page; this card's own is the one for `entry`.
  picks: readonly MechanicPick[]
  // Hero names a search found, ringed here with the rest dimmed; null without
  // a search.
  found: ReadonlySet<string> | null
  vocabulary: TagVocabulary
  lang: AppLocale
}>()

const emit = defineEmits<{
  toggle: []
  toggleModifier: [mod: string]
}>()

defineSlots<{
  // Shown with the modifier chips, for a mechanic that has its own control.
  controls?(): unknown
}>()

const { inspect } = useInspect()

// A tag card's skills can be opened on its tag; energy has no skill behind it.
const tag = computed(() => (props.entry === ENERGY_KEY ? null : props.entry))
const picked = computed(() => props.picks.some((pick) => pickKey(pick) === props.entry))
const others = computed(() => props.picks.filter((pick) => pickKey(pick) !== props.entry))
const label = computed(() => mechanicLabel(props.entry, props.lang))

const isLit = (hero: CharacterType): boolean =>
  props.picks.every((pick) => matchesMechanic(hero, pick))
const litCount = computed(() => props.heroes.filter(isLit).length)

// A search dims without counting: the count stays the picks' answer.
const isDimmed = (hero: CharacterType): boolean =>
  !isLit(hero) || (props.found !== null && !props.found.has(hero.name))

// Each chip's count is what the card would keep lit with that chip switched
// on, so a zero is a dead end; an active chip shows the current count.
const chips = computed(() => {
  const info = props.vocabulary.get(props.entry)
  if (!info || info.solo) return []
  const mods = tagPicksOf(props.picks).find((pick) => pick.tag === props.entry)?.mods ?? []
  const candidates = props.heroes.filter((hero) =>
    others.value.every((pick) => matchesMechanic(hero, pick)),
  )
  return info.mods.map((mod) => {
    const active = mods.includes(mod)
    const toggled = { tag: props.entry, mods: active ? mods : [...mods, mod] }
    return {
      mod,
      label: modifierLabel(mod, props.lang),
      active,
      count: candidates.filter((hero) => matchesPick(hero.tags, toggled)).length,
    }
  })
})

// A hero opened from a picked card shows the skill behind every pick; from an
// unpicked card, this tag's.
const chipsFor = (hero: CharacterType): TagPick[] => {
  const own = tag.value ? [tagPick(tag.value, props.vocabulary)] : []
  return openingPicks(
    hero.tags,
    picked.value ? tagPicksOf(props.picks) : own,
    tag.value ?? undefined,
  )
}

function open(hero: CharacterType) {
  const target = heroInspectTarget(hero, chipsFor(hero))
  if (target) void inspect(target)
}
</script>

<template>
  <!-- The id is the index tile's deep-link target. The title button has no
       handler of its own: its click reaches the card's, and it keeps the card
       reachable from the keyboard. -->
  <section :id="entry" class="card" :class="{ picked }" @click="emit('toggle')">
    <h2 class="card-title">
      <button type="button" class="title-button" :aria-pressed="picked">
        <span class="check" aria-hidden="true">{{ picked ? '✓' : '' }}</span>
        <span>{{ label }}</span>
        <span class="count">{{ litCount }}</span>
      </button>
    </h2>

    <div v-if="chips.length > 0 || $slots.controls" class="chips">
      <slot name="controls" />
      <FilterChip
        v-for="chip in chips"
        :key="chip.mod"
        dark
        :label="chip.label"
        :count="chip.count"
        :active="chip.active"
        :disabled="!chip.active && chip.count === 0"
        @click.stop="emit('toggleModifier', chip.mod)"
      />
    </div>

    <div class="faces">
      <CharacterIcon
        v-for="hero in heroes"
        :key="hero.id"
        :character="hero"
        :dimmed="isDimmed(hero)"
        :is-selected="found?.has(hero.name)"
        :show-energy="!tag"
        inspectable
        :inspect-chips="chipsFor(hero)"
        @click.stop
        @character-click="open"
      />
    </div>
  </section>
</template>

<style scoped>
.card {
  break-inside: avoid;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-lg);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-medium);
  scroll-margin-top: var(--spacing-lg);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.card:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.card.picked {
  border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
  background: color-mix(in srgb, var(--color-accent) 5%, transparent);
}

.card-title {
  margin: 0;
  padding: 0;
  border-bottom: none;
  font-size: var(--reading-subheading-size);
}

.title-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0;
  border: none;
  background: none;
  color: var(--reading-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.check {
  display: grid;
  place-items: center;
  flex: none;
  width: 15px;
  height: 15px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  font-size: 9px;
  line-height: 1;
  color: var(--color-bg-reading);
}

.title-button:hover .check {
  border-color: var(--color-accent);
}

.picked .check {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.count {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--spacing-sm);
}

.faces {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--spacing-sm);
}

.faces :deep(.character-display) {
  width: 38px;
  height: 38px;
  box-shadow: 0 0 0 2px #fff;
  cursor: pointer;
}

.faces :deep(.portrait) {
  width: 44px;
  height: 44px;
}

.faces :deep(.character-display.selected) {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 5px var(--color-accent);
}

.faces :deep(.character-display.dimmed),
.faces :deep(.character-energy.dimmed) {
  opacity: 0.25;
}

.faces :deep(.character-energy) {
  padding-right: 0;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.85);
}

.faces :deep(.energy-icon) {
  display: none;
}
</style>
