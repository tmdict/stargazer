<script setup lang="ts">
/* Guide page for the glossary: every stat and skill keyword with what it
   means, grouped by kind, with a search box and a link to each term. */

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import GuideSearch from '@/components/guide/GuideSearch.vue'
import type { GlossaryGroup } from '@/lib/glossary'
import type { AppLocale } from '@/lib/types/i18n'
import type { SkillGlossary } from '@/lib/types/skill'
import en from '@/pack/text/skill/en/_glossary.json'
import ko from '@/pack/text/skill/ko/_glossary.json'
import zh from '@/pack/text/skill/zh/_glossary.json'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { glossaryGroups } from '@/utils/glossary'
import { appLabel } from '@/utils/skillLabels'

import '@/styles/content.css'
import '@/styles/guide.css'

// In the page's own bundle, so it pre-renders with its text. The same files
// ride the skill text's language chunks; the bundler keeps one copy of each.
const PACKS: Record<AppLocale, SkillGlossary> = { en, ko, zh }

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupGuideContentMeta(lang, 'glossary')

const label = (key: string): string => appLabel(key, lang.value)

const GROUP_LABEL: Record<GlossaryGroup, string> = {
  stats: 'stats',
  status: 'status',
  control: 'control-effects',
  targeting: 'targeting-and-position',
  damage: 'damage',
}

const groups = computed(() => glossaryGroups(PACKS[lang.value], lang.value))

const query = ref('')

const shown = computed(() => {
  const wanted = query.value.trim().toLowerCase()
  if (!wanted) return groups.value
  return groups.value
    .map(({ group, terms }) => ({
      group,
      terms: terms.filter(
        (term) =>
          term.name.toLowerCase().includes(wanted) ||
          term.description?.toLowerCase().includes(wanted) ||
          term.note?.toLowerCase().includes(wanted),
      ),
    }))
    .filter(({ terms }) => terms.length > 0)
})

// The term the address links to. `:target` holds only for a row that was on
// the page when the browser went to the fragment, so a row built later (the
// first client render, a search cleared) is marked from the route. The hash
// is read after mount, as the baked page has none.
const route = useRoute()
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const linked = computed(() => (mounted.value ? route.hash.slice(1) : ''))
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content">
        <h1>{{ label('glossary') }}</h1>

        <div class="tools">
          <GuideSearch v-model="query" class="find" label="app.find-a-term" />
          <nav class="jump" :aria-label="label('glossary')">
            <a v-for="{ group } in shown" :key="group" :href="`#${group}`">
              {{ label(GROUP_LABEL[group]) }}
            </a>
          </nav>
        </div>

        <p v-if="shown.length === 0" class="none">{{ label('glossary-none') }}</p>

        <section v-for="{ group, terms } in shown" :id="group" :key="group" class="group">
          <h2>
            {{ label(GROUP_LABEL[group]) }}
            <small>{{ terms.length }}</small>
          </h2>
          <dl>
            <div
              v-for="term in terms"
              :id="term.key"
              :key="term.key"
              class="term"
              :class="{ linked: term.key === linked }"
            >
              <dt>
                <a :href="`#${term.key}`">{{ term.name }}</a>
              </dt>
              <dd>
                <p v-if="term.description" class="reading-secondary">{{ term.description }}</p>
                <p v-if="term.note" class="reading-meta">{{ term.note }}</p>
                <img
                  v-if="term.picture"
                  :src="term.picture"
                  :alt="term.description ? '' : term.name"
                  width="464"
                  height="348"
                  loading="lazy"
                />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  </main>
</template>

<style scoped>
.tools {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px 16px;
  margin: 18px -12px 4px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--guide-panel-bg);
}
.find {
  flex: 1 1 220px;
  max-width: 320px;
}
.jump {
  display: flex;
  flex: none;
  gap: 6px;
}
.jump a {
  flex: none;
  padding: 5px 11px;
  border: 1px solid var(--chip-dark-border-color);
  border-radius: 999px;
  font-size: var(--reading-small-size);
  color: var(--reading-text);
}
.jump a:hover {
  border-color: var(--color-accent);
  text-decoration: none;
}

.group,
.term {
  scroll-margin-top: 76px;
}
.content h2 small {
  margin-left: 6px;
  font-size: var(--reading-small-size);
  font-weight: 500;
  color: var(--reading-muted);
}

dl {
  margin: 0;
}
.term {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 4px 24px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.term:first-child {
  border-top: none;
}
.term:target,
.term.linked {
  margin: 0 -12px;
  padding: 12px;
  border-radius: var(--radius-medium);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}
dt {
  font-size: var(--reading-body-size);
  font-weight: 700;
  line-height: var(--reading-leading);
}
dt a {
  color: var(--color-accent);
}
dd {
  margin: 0;
}
.content dd p {
  margin: 0;
  white-space: pre-line;
}
dd img {
  display: block;
  width: 232px;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-small);
}
dd p + img {
  margin-top: 10px;
}
.content dd p + .reading-meta {
  margin-top: 6px;
}
.content .none {
  margin: 24px 0 0;
  color: var(--reading-muted);
  opacity: 1;
}

@container (max-width: 820px) {
  .tools {
    flex-wrap: wrap;
  }
  .jump {
    flex-basis: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .group,
  .term {
    scroll-margin-top: 116px;
  }
}

@container (max-width: 640px) {
  .term {
    grid-template-columns: minmax(0, 1fr);
  }
  .find {
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
