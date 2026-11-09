<script setup lang="ts">
/* The Formation engine rules page: every rule the PvP team generator, Generate and
   Placement tips place heroes by, unit by unit, with the lists they read. A
   column of units and the parts every team shares, the open one in the
   middle, addressed by the page's hash (#gunnar), and the open list on the
   right, or in a pop-up where the window has no room for it. The page is
   pre-rendered whole, on its intro. */

import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import RulesHow from '@/components/guide/rules/RulesHow.vue'
import RulesLeans from '@/components/guide/rules/RulesLeans.vue'
import RulesListChip from '@/components/guide/rules/RulesListChip.vue'
import RulesListPanel from '@/components/guide/rules/RulesListPanel.vue'
import RulesLists from '@/components/guide/rules/RulesLists.vue'
import RulesNav from '@/components/guide/rules/RulesNav.vue'
import RulesTexts from '@/components/guide/rules/RulesTexts.vue'
import RulesUnitView from '@/components/guide/rules/RulesUnitView.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import {
  HOW_VIEW,
  RULE_LISTS,
  ruleUnitOf,
  SHARED_VIEWS,
  useRulesNames,
} from '@/components/guide/rules/useRules'
import { useOverlay } from '@/composables/useOverlay'
import { useGameDataStore } from '@/stores/gameData'
import { setupSlRulesContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/components/guide/rules/rules.css'

const { lang, t, unitName, listName, groupLists } = useRulesNames()
setupSlRulesContentMeta(lang)

// SSG-safe: the portraits are in the pre-rendered page.
useGameDataStore().initializeContentData()

const route = useRoute()
const router = useRouter()

const VIEWS = new Set<string>([HOW_VIEW, ...SHARED_VIEWS])
// The hash is read only after mount: the baked page shows the intro, and the
// first client render has to match it.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const view = computed(() => {
  const id = mounted.value ? decodeURIComponent(route.hash.slice(1)) : ''
  return VIEWS.has(id) || ruleUnitOf(id) ? id : HOW_VIEW
})
const unit = computed(() => ruleUnitOf(view.value))
const viewName = computed(() => (unit.value ? unitName(unit.value) : t(`rules-${view.value}`)))

const listGroups = computed(() => groupLists(Object.keys(RULE_LISTS)))

const openList = ref<string | null>(null)
const sheet = ref(false)
// A unit's view opens with its first list beside it.
watch(
  unit,
  (shown) => {
    openList.value = shown?.cards.find((card) => card.list && RULE_LISTS[card.list])?.list ?? null
  },
  { immediate: true },
)

function open(name: string): void {
  openList.value = name
  if (!window.matchMedia('(min-width: 1101px)').matches) sheet.value = true
}

const navOpen = ref(false)
const nav = useTemplateRef<HTMLElement>('nav')
const toggle = useTemplateRef<HTMLElement>('toggle')
useOverlay({
  elementRef: nav,
  detachedRef: toggle,
  isOpen: navOpen,
  onClose: () => (navOpen.value = false),
})

const query = ref('')

function go(id: string): void {
  navOpen.value = false
  sheet.value = false
  void router.push({ hash: `#${id}` })
}
</script>

<template>
  <main class="rules-page">
    <header class="rules-head">
      <h1>{{ t('rules-title') }}</h1>
    </header>

    <div class="rules-layout">
      <button
        ref="toggle"
        type="button"
        class="nav-toggle"
        :aria-expanded="navOpen"
        @click="navOpen = !navOpen"
      >
        <span class="current">{{ viewName }}</span>
        {{ t('rules-all') }}
        <IconChevronRight :size="14" />
      </button>
      <nav
        ref="nav"
        class="rules-column rules-nav"
        :class="{ open: navOpen }"
        :aria-label="t('rules-title')"
      >
        <RulesNav v-model:query="query" :current="view" @go="go" />
      </nav>

      <article :id="view" class="rules-column rules-main content">
        <RulesUnitView v-if="unit" :unit :open-list @open="open" />
        <RulesLeans v-else-if="view === 'leans'" />
        <RulesTexts v-else-if="view === 'map'" view="map" :count="4" />
        <RulesLists
          v-else-if="view === 'lists'"
          :groups="listGroups"
          :open-list
          @go="go"
          @open="open"
        />
        <RulesTexts v-else-if="view === 'questions'" view="questions" :count="4" />
        <RulesHow v-else @open="open" />
      </article>

      <aside class="rules-column rules-aside content" :aria-label="t('rules-row-list')">
        <RulesListPanel v-if="openList" :key="openList" :name="openList" @go="go" @open="open" />
        <template v-else>
          <h2>{{ t('rules-lists') }}</h2>
          <template v-for="group in listGroups" :key="group.key">
            <p class="rules-group">{{ group.label }}</p>
            <div class="index">
              <RulesListChip v-for="name in group.names" :key="name" :name @open="open" />
            </div>
          </template>
        </template>
      </aside>
    </div>

    <BaseModal
      :show="sheet && !!openList"
      :label="openList ? listName(openList) : ''"
      @close="sheet = false"
    >
      <RulesListPanel v-if="openList" :key="openList" :name="openList" @go="go" @open="open" />
    </BaseModal>
  </main>
</template>

<style scoped>
.rules-page {
  align-items: stretch;
  gap: 12px;
  width: 100%;
  padding: 18px 24px 48px;
  background: var(--color-bg-page);
  color: var(--reading-text);
}


h1 {
  margin: 0;
  font-size: var(--reading-title-size);
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  color: var(--reading-text);
}

.rules-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) clamp(300px, 20vw, 380px);
  align-items: start;
  gap: 16px;
}

.rules-column {
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-large);
  background: var(--color-bg-reading);
  box-shadow: var(--shadow-panel);
}

.rules-nav,
.rules-aside {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 24px);
  overflow: auto;
  scrollbar-color: var(--scrollbar-thumb-on-dark) transparent;
}

.rules-main {
  min-width: 0;
}

.rules-aside.content {
  padding: 14px;
}

.rules-aside h2 {
  margin: 0 0 4px;
}

.index {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.index > * {
  width: 100%;
}

.index :deep(.words) {
  flex: 1;
}

.nav-toggle {
  display: none;
}

@media (max-width: 1100px) {
  .rules-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .rules-aside {
    display: none;
  }
}

@media (max-width: 700px) {
  .rules-page {
    padding: 14px 16px 32px;
  }

  .rules-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .nav-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--chip-dark-border-color);
    border-radius: var(--radius-large);
    background: var(--color-bg-reading);
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 600;
    color: var(--reading-text);
    cursor: pointer;
  }

  .current {
    flex: 1;
    overflow: hidden;
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rules-nav {
    position: static;
    max-height: none;
  }

  .rules-nav:not(.open) {
    display: none;
  }
}
</style>
