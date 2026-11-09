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

import '@/styles/columns.css'
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
  const id = mounted.value ? route.hash.slice(1) : ''
  return VIEWS.has(id) || ruleUnitOf(id) ? id : HOW_VIEW
})
const unit = computed(() => ruleUnitOf(view.value))
const viewName = computed(() => (unit.value ? unitName(unit.value) : t(`rules-${view.value}`)))

const listGroups = computed(() => groupLists(Object.keys(RULE_LISTS)))

const openList = ref<string | null>(null)
const sheet = ref(false)
// A unit's view opens with its first list beside it, and a view returned to
// with the list the visitor opened there, kept in its history entry.
watch(
  unit,
  (shown) => {
    openList.value = shown?.cards.find((card) => card.list && RULE_LISTS[card.list])?.list ?? null
  },
  { immediate: true },
)
watch([view, mounted], () => {
  const kept = mounted.value
    ? (window.history.state as { rulesList?: unknown } | null)?.rulesList
    : null
  if (typeof kept === 'string' && Object.hasOwn(RULE_LISTS, kept)) openList.value = kept
})

function open(name: string): void {
  openList.value = name
  window.history.replaceState({ ...window.history.state, rulesList: name }, '')
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
  <main class="columns-page">
    <header>
      <h1>{{ t('rules-title') }}</h1>
    </header>

    <div class="columns-layout">
      <button
        ref="toggle"
        type="button"
        class="columns-toggle"
        :aria-expanded="navOpen"
        @click="navOpen = !navOpen"
      >
        <span class="columns-current">{{ viewName }}</span>
        {{ t('rules-all') }}
        <IconChevronRight :size="14" />
      </button>
      <nav
        ref="nav"
        class="columns-panel columns-side columns-nav"
        :class="{ open: navOpen }"
        :aria-label="t('rules-title')"
      >
        <RulesNav v-model:query="query" :current="view" @go="go" />
      </nav>

      <article :id="view" class="columns-panel columns-main content">
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

      <aside
        class="columns-panel columns-side rules-aside content"
        :aria-label="t('rules-row-list')"
      >
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

@media (max-width: 1100px) {
  .rules-aside {
    display: none;
  }
}
</style>
