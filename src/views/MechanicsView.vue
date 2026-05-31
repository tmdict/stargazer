<script setup lang="ts">
import { computed, provide } from 'vue'

import { SkillLangKey } from '@/components/skill/snippetKeys'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useI18nStore } from '@/stores/i18n'
import { setupMechanicsContentMeta } from '@/utils/contentMeta'
import {
  CATEGORY_LABEL_KEY,
  CATEGORY_ORDER,
  heroName,
  heroPortrait,
  mechanicEntries,
} from '@/utils/mechanics'

import '@/styles/content.css'

const lang = useRouteLocale()
provide(SkillLangKey, lang)
setupMechanicsContentMeta(lang.value)

const i18n = useI18nStore()

const entries = mechanicEntries()
const groups = computed(() =>
  CATEGORY_ORDER.map((cat) => ({ cat, items: entries.filter((e) => e.category === cat) })).filter(
    (g) => g.items.length > 0,
  ),
)
</script>

<template>
  <main class="mechanics">
    <header class="mech-head">
      <h1 class="mech-title">{{ i18n.t('app.mechanics') }}</h1>
      <p class="mech-intro">{{ i18n.t('app.mechanics-intro') }}</p>
      <nav class="mech-toc">
        <a v-for="g in groups" :key="g.cat" :href="`#cat-${g.cat}`" class="mech-toc-link">
          {{ i18n.t(`app.${CATEGORY_LABEL_KEY[g.cat]}`) }}
          <span class="mech-toc-count">{{ g.items.length }}</span>
        </a>
      </nav>
    </header>

    <section v-for="g in groups" :key="g.cat" :id="`cat-${g.cat}`" class="mech-cat">
      <h2 class="mech-cat-head">{{ i18n.t(`app.${CATEGORY_LABEL_KEY[g.cat]}`) }}</h2>

      <!-- Each entry reuses the skill-reader surface (.container + .content). -->
      <div class="mech-cat-entries">
        <div v-for="e in g.items" :key="e.slug" class="container mech-panel">
          <div class="content">
            <div class="mech-entry-head">
              <img
                :src="heroPortrait(e.slug)"
                :alt="heroName(e.slug, lang)"
                class="mech-portrait"
                loading="lazy"
              />
              <h3 class="mech-name">{{ heroName(e.slug, lang) }}</h3>
              <a :href="`/${lang}/skill/${e.slug}`" class="mech-go">{{ i18n.t('app.skills') }}</a>
            </div>
            <component :is="e.components[lang] ?? e.components.en" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.mechanics {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

/* Wider screens: widen the page and flow entries into masonry columns so the
   panels fill the space without stretching prose lines. Category headers and
   the intro stay full-width above each column group. */
@media (min-width: 1024px) {
  .mechanics {
    max-width: 1200px;
  }
  .mech-cat-entries {
    column-count: 2;
    column-gap: 1rem;
  }
  .mech-panel {
    break-inside: avoid;
  }
}

@media (min-width: 1680px) {
  .mechanics {
    max-width: 1640px;
  }
  .mech-cat-entries {
    column-count: 3;
  }
}

.mech-head {
  padding: 1.5rem 0 0.5rem;
}
.mech-title {
  margin: 0 0 0.4rem;
  font-size: 24px;
  font-weight: 600;
}
.mech-intro {
  margin: 0 0 1.2rem;
  color: rgba(255, 255, 255, 0.55);
  max-width: 60ch;
}

.mech-toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.mech-toc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(95, 196, 187, 0.4);
  background: transparent;
  color: #5fc4bb;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s;
}
.mech-toc-link:hover {
  background: rgba(95, 196, 187, 0.1);
}
.mech-toc-count {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  font-size: 0.78rem;
}

/* Category divider mirrors SkillSection's header rule. */
.mech-cat-head {
  font-size: 18px;
  font-weight: 600;
  /* Lighter than base.css's dark `h2` token, reusing the page's teal accent. */
  color: #5fc4bb;
  margin: 2.2rem 0 1rem;
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
  scroll-margin-top: 1rem;
}
.mech-cat {
  scroll-margin-top: 1rem;
}

/* Reader-panel look: override content.css's modal-context background/centering,
   exactly as SkillReader does. */
.mech-panel {
  background: #262626;
  margin: 0 0 1rem;
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
/* Pill action matching the TOC links, so the skill-page link reads as a clear
   call-to-action rather than muted metadata. */
.mech-go {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5fc4bb;
  text-decoration: none;
  white-space: nowrap;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(95, 196, 187, 0.14);
  border: 1px solid rgba(95, 196, 187, 0.4);
  transition: background-color 0.15s;
}
.mech-go:hover {
  background: rgba(95, 196, 187, 0.25);
}

@media (max-width: 480px) {
  .mechanics {
    padding: 0 0 3rem;
  }
  /* Edge-to-edge panels on small screens, matching SkillReader. */
  .mech-panel {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
  .mech-head,
  .mech-cat-head {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
