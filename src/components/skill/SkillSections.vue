<script setup lang="ts">
import { computed, defineAsyncComponent, inject, provide, ref, type Component } from 'vue'

import SkillCharmSection from './SkillCharmSection.vue'
import SkillKeywordTooltip from './SkillKeywordTooltip.vue'
import SkillSection from './SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useSnippetAnchors } from '@/composables/useSnippetAnchors'
import { ownEnergy } from '@/lib/mechanics'
import {
  chipActive,
  heroChips,
  pinnedLevels,
  toggleChip,
  toTagQuery,
  usablePicks,
} from '@/lib/tags'
import { isAppLocale, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { SLOT_ORDER, type TagPick, type TagPin } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { ContentInModalKey, setupSkillContentMeta } from '@/utils/contentMeta'
import {
  getCharmForHero,
  getSkillCharms,
  getSkillFile,
  getSkillNumbers,
  loadCharacters,
} from '@/utils/dataLoader'
import { formatToCamelCase } from '@/utils/nameFormatting'
import { appLabel, headingFor, heroDisplayName, tagPickLabel } from '@/utils/skillLabels'
import { loadTagVocabulary } from '@/utils/tagData'
import { SkillLangKey } from './snippetKeys'

const props = defineProps<{
  slug: string
  // Skill-text language for the body text and hero name; slot/chip labels
  // render in the chrome locale (the store).
  lang: SkillLocale
  // Chips to open on: a hero list's tag filter, the Mechanics guide's picks.
  initialChips?: readonly TagPick[]
}>()

setupSkillContentMeta(props.slug, props.lang)

const i18n = useI18nStore()
const appLang = computed<AppLocale>(() => i18n.currentLocale)
const inModal = inject(ContentInModalKey, false)

// The locale is warm before mount (route guard on pages, ready gate in the
// modal). When its chunk could not be fetched, English stands in if it is
// warm; otherwise there is no text to show.
const locale = computed(
  () => getSkillFile(props.lang, props.slug) ?? getSkillFile('en', props.slug),
)
const hero = loadCharacters().find((c) => c.name === props.slug)
const tags = hero?.tags ?? {}
const vocabulary = loadTagVocabulary()
const chips = heroChips(tags, vocabulary)
const numbers = getSkillNumbers(props.slug)

const heroName = computed(() => heroDisplayName(props.slug, props.lang))

// A pick this hero does not satisfy would hide every slot, so those are left off.
const picks = ref<readonly TagPick[]>(usablePicks(tags, props.initialChips ?? []))

const chipKey = (chip: TagPick): string => `${chip.tag}:${chip.mods.join(',')}`

function toggle(chip: TagPick) {
  picks.value = toggleChip(picks.value, chip)
}

function clearChips() {
  if (picks.value.length > 0) picks.value = []
}

// Chips filter whole slots, not rows: an upgrade line reads only against the
// levels before it, so a tagged row is never shown alone.
function applyChips(pin: TagPin) {
  const filter = usablePicks(tags, picks.value)
  const slotTags = heroChips(tags, vocabulary, pin).map((chip) => ({
    label: tagPickLabel(chip, appLang.value),
    query: toTagQuery(chip),
  }))
  const highlight = pinnedLevels(tags, filter, pin)
  return { slotTags, highlight, visible: filter.length === 0 || highlight.length > 0 }
}

const sections = computed(() => {
  if (!locale.value) return []
  return SLOT_ORDER.map((slotKey) => {
    const slot = locale.value![slotKey]
    if (!slot) return null
    const { slotTags, highlight, visible } = applyChips(slotKey)
    if (!visible) return null
    return {
      slotKey,
      heading: headingFor(slotKey, slot.n, appLang.value, locale.value!._terms),
      numbers: numbers[slotKey],
      // The game shows a hero's starting energy on its ultimate. This is the
      // hero's own; what a later skill level adds is in that level's text.
      initialEnergy: slotKey === 'ultimate' && hero ? ownEnergy(hero) : undefined,
      slotTags,
      levels: slot.d.map((description, i) => ({ level: i + 1, description })),
      refinements: (slot.r ?? []).map((r) => ({ tier: r.t, description: r.d })),
      highlightLevels: highlight,
    }
  }).filter((s): s is NonNullable<typeof s> => s !== null)
})

// One charm is shared by several heroes, so its text is stored charm-keyed
// and resolved through the hero → charm mapping; the en fallback mirrors the
// skill-file fallback above.
const charm = computed(() => {
  const entry = getCharmForHero(props.slug)
  if (!entry) return null
  const dict = getSkillCharms(props.lang) ?? getSkillCharms('en')
  const texts = dict?.charms[entry.slug]
  if (!dict || !texts) return null
  const { slotTags, highlight, visible } = applyChips('charm')
  if (!visible) return null
  const sharedNames = entry.heroes
    .filter((h) => h !== props.slug)
    .map((h) => heroDisplayName(h, props.lang))
  return {
    tierNames: dict.tiers,
    slotTags,
    tiers: texts.map((text, i) => ({ tier: i + 1, text })),
    highlightTiers: highlight,
    sharedNames,
  }
})

const anchors = useSnippetAnchors()

// Delegation root for the glossary-keyword tooltips: the [data-kw] spans sit
// in SkillSection's v-html output, so the host listens on the article.
const rootEl = ref<HTMLElement | null>(null)

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
  <div v-if="!locale" class="skill-empty" :lang="appLang">
    {{ i18n.t('app.skill-load-failed') }}
  </div>
  <article v-else ref="rootEl" class="skill-sections" :lang>
    <div class="skill-header" :class="{ resettable: picks.length > 0 }" @click="clearChips">
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

      <div v-if="chips.length > 0" class="skill-chips" :lang="appLang">
        <button
          v-for="chip in chips"
          :key="chipKey(chip)"
          type="button"
          class="skill-chip"
          :class="{ 'is-active': chipActive(picks, chip) }"
          @click.stop="toggle(chip)"
        >
          {{ tagPickLabel(chip, appLang) }}
        </button>
      </div>
    </div>

    <template v-for="section in sections" :key="section.slotKey">
      <!-- id anchors the search overlay's deep links (#ultimate, #ex, …). -->
      <SkillSection
        :id="section.slotKey"
        :heading="section.heading"
        :numbers="section.numbers"
        :initial-energy="section.initialEnergy"
        :terms="locale._terms"
        :slot-tags="section.slotTags"
        :levels="section.levels"
        :refinements="section.refinements"
        :highlight-levels="section.highlightLevels"
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

    <!-- id anchors the search overlay's deep links (#charm). -->
    <SkillCharmSection
      v-if="charm"
      id="charm"
      :heading="appLabel('charm', appLang)"
      :slot-tags="charm.slotTags"
      :tier-names="charm.tierNames"
      :tiers="charm.tiers"
      :highlight-tiers="charm.highlightTiers"
      :shared-label="appLabel('charm-shared', appLang)"
      :shared-names="charm.sharedNames"
    />

    <component :is="snippetComp" v-if="snippetComp" />

    <SkillKeywordTooltip :lang :container="rootEl" />
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
</style>
