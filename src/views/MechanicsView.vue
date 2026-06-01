<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'

import { SkillLangKey } from '@/components/skill/snippetKeys'
import SkillsSelection from '@/components/SkillsSelection.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupMechanicsContentMeta } from '@/utils/contentMeta'
import { heroName, heroPortrait, mechanicEntries } from '@/utils/mechanics'

import '@/styles/content.css'

// `name` is the route param (route has `props: true`); empty on the index.
const props = defineProps<{ name?: string }>()

const lang = useRouteLocale()
provide(SkillLangKey, lang)
setupMechanicsContentMeta(lang.value)

const i18n = useI18nStore()

// SSG-safe so the filtered roster (and its crawlable mechanics links) bakes into
// the static HTML, exactly as the skills browser does.
const gameDataStore = useGameDataStore()
gameDataStore.initializeContentData()

const entries = mechanicEntries()
const mechanicSlugs = new Set(entries.map((e) => e.slug))
// Roster pre-filtered to heroes that have a mechanics snippet.
const mechanicsCharacters = computed(() =>
  gameDataStore.characters.filter((c) => mechanicSlugs.has(c.name)),
)

const slug = computed(() => (props.name ?? '').toLowerCase())
const activeEntry = computed(() => entries.find((e) => e.slug === slug.value) ?? null)
// A selected hero narrows the reader to its snippet; the index shows them all.
const displayedEntries = computed(() => (activeEntry.value ? [activeEntry.value] : entries))

// Mobile: the roster is a pull-up sheet — open on the empty index, collapse once
// a hero is chosen (mirrors SkillsBrowser).
const expanded = ref(false)
watch(slug, () => (expanded.value = false))
</script>

<template>
  <main>
    <div class="mechanics-layout">
      <!-- .container + .content from content.css — same reader surface as SkillReader. -->
      <div class="mech-reader-col">
        <article v-for="e in displayedEntries" :key="e.slug" class="container mech-panel">
          <div class="content">
            <div class="mech-entry-head">
              <img
                :src="heroPortrait(e.slug)"
                :alt="heroName(e.slug, lang)"
                class="mech-portrait"
                loading="lazy"
              />
              <h2 class="mech-name">{{ heroName(e.slug, lang) }}</h2>
              <a :href="`/${lang}/skill/${e.slug}`" class="mech-go">
                {{ i18n.t('app.skills') }}
              </a>
            </div>
            <component :is="e.components[lang] ?? e.components.en" />
          </div>
        </article>
      </div>

      <BottomSheet v-model:expanded="expanded" :initial-expanded="!slug">
        <SkillsSelection
          :characters="mechanicsCharacters"
          :lang
          :current-slug="slug"
          route-base="mechanics"
        />
      </BottomSheet>
    </div>
  </main>
</template>

<style scoped>
/* Mirrors SkillsBrowser's .skills-layout split. */
.mechanics-layout {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

/* Left column stacks one snippet (a selected hero) or all of them (the index). */
.mech-reader-col {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  min-width: 0;
}

@media (min-width: 1220px) {
  .mechanics-layout {
    flex-direction: row;
    align-items: flex-start;
  }
  .mechanics-layout > .mech-reader-col {
    flex: 0 0 660px;
    width: 660px;
  }
}

@media (min-width: 1600px) {
  .mechanics-layout > .mech-reader-col {
    flex-basis: 760px;
    width: 760px;
  }
}

@media (min-width: 1920px) {
  .mechanics-layout > .mech-reader-col {
    flex-basis: 860px;
    width: 860px;
  }
}

/* Reader surface: override content.css's modal background/centering, as SkillReader does. */
.mech-panel {
  background: #262626;
  margin: 0;
}

.mech-entry-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.mech-portrait {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 1px solid var(--color-border-light);
}
.mech-name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
/* Pill action so the full-skill-page link reads as a clear call-to-action. */
.mech-go {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5fc4bb;
  text-decoration: none;
  white-space: nowrap;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(95, 196, 187, 0.4);
  transition: background-color 0.15s;
}
/* Hover mirrors the skill page's tag chips: subtle fill, with teal text and no
   underline pinned so the global `a:hover` (red + underline) can't take over. */
.mech-go:hover {
  background: rgba(95, 196, 187, 0.1);
  color: #5fc4bb;
  text-decoration: none;
}

/* Mobile: drop the card chrome so panels fill the width and clear the sheet peek
   — matching SkillReader/SkillsBrowser. */
@media (max-width: 768px) {
  main {
    padding-bottom: 96px;
  }
  .mech-panel {
    max-width: 100% !important;
    border: none;
    box-shadow: none;
    border-radius: var(--radius-medium);
  }
  .content {
    padding: var(--spacing-lg);
  }
}
@media (max-width: 480px) {
  main {
    padding-bottom: 88px;
  }
  .mech-panel {
    border-radius: 0;
  }
  .content {
    padding: var(--spacing-md);
  }
}
</style>
