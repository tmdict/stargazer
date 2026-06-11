<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  provide,
  ref,
  shallowRef,
  type Component,
  type Ref,
} from 'vue'

import SkillSection from './SkillSection.vue'
import { useSkillTags } from '@/composables/useSkillTags'
import type { Locale } from '@/lib/types/i18n'
import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { loadAppLocales, loadCharacterLocales, loadSkillLocales } from '@/utils/dataLoader'
import { formatToCamelCase } from '@/utils/nameFormatting'
import { SkillLangKey, SkillSnippetAnchorsKey } from './snippetKeys'

const props = defineProps<{
  slug: string
  lang: Locale
  initialChip?: string | null
}>()

setupSkillContentMeta(props.slug, props.lang)

const locale = computed(() => loadSkillLocales()[props.lang][props.slug])
const { perLevel, perCharacter } = useSkillTags(props.slug)

// Resolves against `props.lang` (not the global i18n store) so chips stay in
// sync with the modal's local locale toggle and SSR-rendered URL locale.
function tagLabel(tag: string): string {
  return loadAppLocales()[tag]?.[props.lang] ?? tag
}

const heroName = computed(() => loadCharacterLocales()[props.slug]?.[props.lang] ?? props.slug)

// Heading composition per slot:
//   ultimate / ex        →  "<prefix>: <name>"   (prefix from app locale)
//   skill2 / skill3      →  just <name>           (name carries the slot)
//   mastery / awakening  →  app-locale name       (invariant across heroes)
const PREFIX_LABEL_KEY: Partial<Record<SlotKey, string>> = {
  ultimate: 'ultimate',
  ex: 'ex-skill',
}

const INVARIANT_NAME_KEY: Partial<Record<SlotKey, string>> = {
  mastery: 'hero-focus',
  awakening: 'enhance-force',
}

function headingFor(slotKey: SlotKey, name: string | null | undefined): string {
  const app = loadAppLocales()
  const invariantKey = INVARIANT_NAME_KEY[slotKey]
  if (invariantKey) return app[invariantKey]?.[props.lang] ?? invariantKey

  const trimmedName = name?.trim() ?? ''
  const prefixKey = PREFIX_LABEL_KEY[slotKey]
  if (!prefixKey) return trimmedName || slotKey
  const prefix = app[prefixKey]?.[props.lang] ?? prefixKey
  return trimmedName ? `${prefix}: ${trimmedName}` : prefix
}

const activeChips = ref<Set<string>>(new Set(props.initialChip ? [props.initialChip] : []))

function toggleChip(tag: string) {
  const next = new Set(activeChips.value)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  activeChips.value = next
}

function clearChips() {
  if (activeChips.value.size > 0) activeChips.value = new Set()
}

// A slot is shown when at least one of its levels passes the active-chip
// filter; empty filter shows everything. `slotTags` is the union of per-level
// tags, rendered as chips next to the heading. EX refinement tiers (`r`) aren't
// taggable, so they show only in the unfiltered view.
const sections = computed(() => {
  if (!locale.value) return []
  const filter = activeChips.value
  return SLOT_ORDER.map((slotKey) => {
    const slot = locale.value![slotKey]
    if (!slot) return null
    const rawLevels = slot.d.map((description, i) => ({
      level: i + 1,
      description,
      rawTags: perLevel(slotKey, i + 1),
    }))
    const slotTagsSet = new Set<string>()
    for (const l of rawLevels) for (const t of l.rawTags) slotTagsSet.add(t)
    // Keep the raw tag name (for the browser filter link) next to its label.
    const slotTags = [...slotTagsSet].map((t) => ({ name: t, label: tagLabel(t) }))
    const levels = rawLevels
      .filter((l) => filter.size === 0 || l.rawTags.some((t) => filter.has(t)))
      .map((l) => ({ level: l.level, description: l.description }))
    // Refinements carry no tags, so an active filter hides them; they only
    // appear in the unfiltered view.
    const refinements =
      filter.size === 0 ? (slot.r ?? []).map((r) => ({ tier: r.t, description: r.d })) : []
    if (levels.length === 0 && refinements.length === 0) return null
    return { slotKey, heading: headingFor(slotKey, slot.n), slotTags, levels, refinements }
  }).filter((s): s is NonNullable<typeof s> => s !== null)
})

const anchors = SLOT_ORDER.reduce(
  (acc, key) => {
    acc[key] = shallowRef<HTMLElement | null>(null)
    return acc
  },
  {} as Record<SlotKey, Ref<HTMLElement | null>>,
)
provide(SkillSnippetAnchorsKey, anchors)
provide(
  SkillLangKey,
  computed(() => props.lang),
)

// Optional per-hero snippet at src/content/skill/<slug>/<HeroName>.<lang>.vue.
const snippetModules = import.meta.glob<{ default: Component }>('@/content/skill/*/*.vue')
const snippetComp = computed(() => {
  const heroName = formatToCamelCase(props.slug)
  const target = `/src/content/skill/${props.slug}/${heroName}.${props.lang}.vue`
  const loader = snippetModules[target]
  if (!loader) return null
  return defineAsyncComponent(async () => (await loader()).default)
})
</script>

<template>
  <div v-if="!locale" class="skill-empty">No skill data available for this character.</div>
  <article v-else class="skill-sections">
    <div class="skill-header" :class="{ resettable: activeChips.size > 0 }" @click="clearChips">
      <h1 class="skill-hero-name">{{ heroName }}</h1>

      <div v-if="perCharacter.length > 0" class="skill-chips">
        <button
          v-for="tag in perCharacter"
          :key="tag"
          type="button"
          class="skill-chip"
          :class="{ 'is-active': activeChips.has(tag) }"
          @click.stop="toggleChip(tag)"
        >
          {{ tagLabel(tag) }}
        </button>
      </div>
    </div>

    <template v-for="section in sections" :key="section.slotKey">
      <SkillSection
        :heading="section.heading"
        :slot-tags="section.slotTags"
        :levels="section.levels"
        :refinements="section.refinements"
      />
      <div
        :ref="
          (el) => {
            anchors[section.slotKey].value = el as HTMLElement | null
          }
        "
        class="skill-snippet-anchor"
      />
    </template>

    <component :is="snippetComp" v-if="snippetComp" class="skill-snippet-host" />
  </article>
</template>

<style scoped>
.skill-empty {
  padding: var(--spacing-lg);
  text-align: center;
  opacity: 0.6;
}

.skill-hero-name {
  margin: 0 0 var(--spacing-md);
  font-size: 24px;
  font-weight: 600;
  text-align: left;
}

/* Clicks anywhere in the header (hero name, gaps, chip-strip background)
   clear the active chips; chip buttons themselves stop propagation. Pointer
   cursor only when there's actually something to reset. */
.skill-header.resettable {
  cursor: pointer;
}

.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.skill-chip {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(95, 196, 187, 0.4);
  background: transparent;
  color: #5fc4bb;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.skill-chip:hover {
  background: rgba(95, 196, 187, 0.1);
}

.skill-chip.is-active {
  background: #3a8a83;
  color: #fff;
  border-color: #3a8a83;
}

.skill-snippet-anchor {
  /* Teleport target — empty when no snippet present. */
}

.skill-snippet-host {
  display: none;
}
</style>
