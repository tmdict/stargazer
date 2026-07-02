<script setup lang="ts">
import { computed, defineAsyncComponent, inject, provide, ref, type Component } from 'vue'

import SkillSection from './SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useSkillTags } from '@/composables/useSkillTags'
import { useSnippetAnchors } from '@/composables/useSnippetAnchors'
import { isAppLocale, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { SLOT_ORDER } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { ContentInModalKey, setupSkillContentMeta } from '@/utils/contentMeta'
import { getSkillFile } from '@/utils/dataLoader'
import { formatToCamelCase } from '@/utils/nameFormatting'
import { appLabel, headingFor, heroDisplayName } from '@/utils/skillLabels'
import { SkillLangKey } from './snippetKeys'

const props = defineProps<{
  slug: string
  // Skill-text language for the body text and hero name; slot/chip labels
  // render in the chrome locale (the store).
  lang: SkillLocale
  initialChip?: string | null
}>()

setupSkillContentMeta(props.slug, props.lang)

const i18n = useI18nStore()
const appLang = computed<AppLocale>(() => i18n.currentLocale)
const inModal = inject(ContentInModalKey, false)

// The locale is warm before mount (route guard on pages, ready gate in the
// modal); the en fallback covers a failed chunk fetch on a cold initial load.
const locale = computed(
  () => getSkillFile(props.lang, props.slug) ?? getSkillFile('en', props.slug),
)
const { perLevel, perCharacter } = useSkillTags(props.slug)

const heroName = computed(() => heroDisplayName(props.slug, props.lang))

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
    const slotTags = [...slotTagsSet].map((t) => ({ name: t, label: appLabel(t, appLang.value) }))
    const levels = rawLevels
      .filter((l) => filter.size === 0 || l.rawTags.some((t) => filter.has(t)))
      .map((l) => ({ level: l.level, description: l.description }))
    // Refinements carry no tags, so an active filter hides them; they only
    // appear in the unfiltered view.
    const refinements =
      filter.size === 0 ? (slot.r ?? []).map((r) => ({ tier: r.t, description: r.d })) : []
    if (levels.length === 0 && refinements.length === 0) return null
    return {
      slotKey,
      heading: headingFor(slotKey, slot.n, appLang.value, locale.value!._terms),
      slotTags,
      levels,
      refinements,
    }
  }).filter((s): s is NonNullable<typeof s> => s !== null)
})

const anchors = useSnippetAnchors()

// Optional per-hero snippet at src/content/skill/<slug>/<HeroName>.<lang>.vue.
// Deep-dive essays exist only in the app locales: the text locale wins when
// it is one, otherwise the chrome locale's essay renders under the foreign
// text (same fallback rule as the rest of the chrome).
const snippetModules = import.meta.glob<{ default: Component }>('@/content/skill/*/*.vue')
const snippetPath = (l: AppLocale) =>
  `/src/content/skill/${props.slug}/${formatToCamelCase(props.slug)}.${l}.vue`
const snippetLocale = computed<AppLocale | null>(() => {
  const candidates: AppLocale[] = []
  if (isAppLocale(props.lang)) candidates.push(props.lang)
  if (!candidates.includes(appLang.value)) candidates.push(appLang.value)
  if (!candidates.includes('en')) candidates.push('en')
  return candidates.find((l) => snippetPath(l) in snippetModules) ?? null
})
const snippetComp = computed(() => {
  const l = snippetLocale.value
  if (!l) return null
  const loader = snippetModules[snippetPath(l)]
  if (!loader) return null
  return defineAsyncComponent(async () => (await loader()).default)
})

// Snippets resolve their strings from app locales, so they receive the locale
// of the essay actually rendered.
provide(
  SkillLangKey,
  computed(() => snippetLocale.value ?? appLang.value),
)
</script>

<template>
  <div v-if="!locale" class="skill-empty">No skill data available for this character.</div>
  <article v-else class="skill-sections">
    <div class="skill-header" :class="{ resettable: activeChips.size > 0 }" @click="clearChips">
      <div class="skill-title-row">
        <h1 class="skill-hero-name">{{ heroName }}</h1>
        <!-- Page-only: the modal hosts its own globe in the header cluster. -->
        <SkillLocaleMenu
          v-if="!inModal"
          class="skill-locale-menu"
          mode="links"
          :current="lang"
          :slug
          @click.stop
        />
      </div>

      <div v-if="perCharacter.length > 0" class="skill-chips">
        <button
          v-for="tag in perCharacter"
          :key="tag"
          type="button"
          class="skill-chip"
          :class="{ 'is-active': activeChips.has(tag) }"
          @click.stop="toggleChip(tag)"
        >
          {{ appLabel(tag, appLang) }}
        </button>
      </div>
    </div>

    <template v-for="section in sections" :key="section.slotKey">
      <!-- id anchors the search overlay's deep links (#ultimate, #ex, …). -->
      <SkillSection
        :id="section.slotKey"
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

.skill-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.skill-locale-menu {
  margin-left: auto;
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
  border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
  background: transparent;
  color: var(--color-accent);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.skill-chip:hover {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

.skill-chip.is-active {
  background: var(--color-accent-active);
  color: #fff;
  border-color: var(--color-accent-active);
}

.skill-snippet-anchor {
  /* Teleport target: empty when no snippet present. */
}

.skill-snippet-host {
  display: none;
}
</style>
