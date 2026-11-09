<script setup lang="ts">
/* The Hero lists page: the lists the formation rules read, which a visitor
   can change and then copy or export. The site always places heroes by its
   own lists; a visitor's version stays in the browser until sent. A column
   of lists, the open one in the middle, addressed by the page's hash
   (#temp-buff), and the Add heroes panel on the right, below it where the
   window has no room. The page is pre-rendered with the site's lists. */

import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ListsChanges from '@/components/guide/lists/ListsChanges.vue'
import ListsCompare from '@/components/guide/lists/ListsCompare.vue'
import ListsEditor from '@/components/guide/lists/ListsEditor.vue'
import ListsNav from '@/components/guide/lists/ListsNav.vue'
import ListsPool from '@/components/guide/lists/ListsPool.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { provideListDrag, useListDrag } from '@/components/guide/lists/useListDrag'
import {
  createListEditor,
  provideListEditor,
  SITE_LISTS,
  useListWords,
} from '@/components/guide/lists/useListEditor'
import { hasListName } from '@/components/guide/rules/useRules'
import { useOverlay } from '@/composables/useOverlay'
import { useToast } from '@/composables/useToast'
import { guidePath, SL_GENERATOR_PATH, SL_RULES_PATH } from '@/lib/guide'
import { listsExportFile, listsExportText } from '@/lib/placement/listEdits'
import { useGameDataStore } from '@/stores/gameData'
import { setupSlListsContentMeta } from '@/utils/contentMeta'
import { downloadBlob, timestampedName } from '@/utils/download'

import '@/styles/content.css'
import '@/components/guide/lists/lists.css'

const { lang, t, listName } = useListWords()
setupSlListsContentMeta(lang)

// SSG-safe: the portraits are in the pre-rendered page.
useGameDataStore().initializeContentData()

const route = useRoute()
const router = useRouter()
const { success, error } = useToast()

// The first list of the column opens when the hash names none.
const first = computed(() => {
  const collator = new Intl.Collator(lang.value)
  const byName = (a: string, b: string) => collator.compare(listName(a), listName(b))
  const names = Object.keys(SITE_LISTS)
  return names.filter(hasListName).sort(byName)[0] ?? names.sort(byName)[0] ?? ''
})

// The hash and the stored lists are read only after mount: the baked page
// shows the site's lists, and the first client render has to match it.
const mounted = ref(false)
const current = computed(() => {
  const id = mounted.value ? decodeURIComponent(route.hash.slice(1)) : ''
  return id in SITE_LISTS ? id : first.value
})

const editor = createListEditor(current)
provideListEditor(editor)
const page = useTemplateRef<HTMLElement>('page')
const drag = useListDrag(page, editor)
provideListDrag(drag)

const navOpen = ref(false)
const nav = useTemplateRef<HTMLElement>('nav')
const toggle = useTemplateRef<HTMLElement>('toggle')
useOverlay({
  elementRef: nav,
  detachedRef: toggle,
  isOpen: navOpen,
  onClose: () => (navOpen.value = false),
})

const changesOpen = ref(false)
const compareOpen = ref(false)

function go(name: string): void {
  navOpen.value = false
  changesOpen.value = false
  compareOpen.value = false
  void router.push({ hash: `#${name}` })
}

const sendable = computed(() => editor.sendable.value.length > 0)

const exportText = (): string =>
  listsExportText(listsExportFile(editor.lists.value, SITE_LISTS, new Date().toISOString()))

function download(): void {
  downloadBlob(
    new Blob([exportText()], { type: 'application/json' }),
    timestampedName('stargazer-lists', 'json'),
  )
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportText())
    success(t('copied-clipboard'))
  } catch {
    error(t('lists-copy-failed'))
  }
}

function keepMine(): void {
  compareOpen.value = false
  editor.keepMine()
}

function takeSite(): void {
  compareOpen.value = false
  editor.takeSite()
}

function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  if (!(event.metaKey || event.ctrlKey) || target.matches('input, textarea, select')) return
  if (changesOpen.value || compareOpen.value) return
  const key = event.key.toLowerCase()
  if (key === 'z') (event.shiftKey ? editor.redo : editor.undo)()
  else if (key === 'y') editor.redo()
  else return
  event.preventDefault()
}

onMounted(() => {
  editor.load()
  mounted.value = true
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <main ref="page" class="lists-page" @pointerdown="drag.onDown" @dragstart.prevent>
    <header class="lists-head">
      <p class="crumbs">
        <RouterLink :to="guidePath('index')">{{ t('guide') }}</RouterLink>
        <span aria-hidden="true"> › </span>
        <RouterLink :to="SL_GENERATOR_PATH">{{ t('sl-title') }}</RouterLink>
        <span aria-hidden="true"> › </span>
        <RouterLink :to="SL_RULES_PATH">{{ t('rules-title') }}</RouterLink>
        <span aria-hidden="true"> › </span>
        <span>{{ t('lists-title') }}</span>
      </p>
      <h1>{{ t('lists-title') }}</h1>
      <p class="intro">{{ t('lists-intro') }}</p>
    </header>

    <div class="tools">
      <button
        type="button"
        class="lists-btn"
        :disabled="!editor.past.length"
        :title="t('lists-undo-tip')"
        @click="editor.undo"
      >
        {{ t('lists-undo') }}
      </button>
      <button
        type="button"
        class="lists-btn"
        :disabled="!editor.future.length"
        :title="t('lists-redo-tip')"
        @click="editor.redo"
      >
        {{ t('lists-redo') }}
      </button>
      <span class="spacer" />
      <button type="button" class="lists-btn" :disabled="!sendable" @click="download">
        {{ t('export') }}
      </button>
      <button type="button" class="lists-btn" :disabled="!sendable" @click="copy">
        {{ t('copy') }}
      </button>
      <button type="button" class="lists-btn primary" @click="changesOpen = true">
        {{ t('lists-my-changes') }}
        <span class="count">{{ editor.changed.value.length }}</span>
      </button>
    </div>

    <div v-if="editor.notes.value.length" class="notes">
      <div v-for="(note, index) in editor.notes.value" :key="index" class="lists-notice">
        <span>{{
          t(`lists-note-${note.kind}`, {
            list: note.kind === 'gone' ? note.list : listName(note.list),
            n: note.kind === 'heroes' ? note.count : 0,
          })
        }}</span>
        <button type="button" class="lists-btn small" @click="editor.dismiss(index)">
          {{ t('close') }}
        </button>
      </div>
    </div>

    <p v-if="!editor.names.value.length" class="none">{{ t('lists-none') }}</p>
    <div v-else class="lists-layout">
      <button
        ref="toggle"
        type="button"
        class="nav-toggle"
        :aria-expanded="navOpen"
        @click="navOpen = !navOpen"
      >
        <span class="current">{{ listName(current) }}</span>
        {{ t('lists-all') }}
        <IconChevronRight :size="14" />
      </button>
      <nav
        ref="nav"
        class="lists-column lists-nav"
        :class="{ open: navOpen }"
        :aria-label="t('lists-title')"
      >
        <ListsNav :current @go="go" />
      </nav>
      <section :id="current" class="lists-column lists-main">
        <ListsEditor @go="go" @compare="compareOpen = true" />
      </section>
      <aside class="lists-column lists-aside" data-drag="pool" :aria-label="t('lists-add-heroes')">
        <ListsPool />
      </aside>
    </div>

    <BaseModal :show="changesOpen" :label="t('lists-my-changes')" @close="changesOpen = false">
      <ListsChanges @go="go" @export="download" @copy="copy" @close="changesOpen = false" />
    </BaseModal>
    <BaseModal :show="compareOpen" :label="t('lists-compare')" @close="compareOpen = false">
      <ListsCompare @keep="keepMine" @take="takeSite" @close="compareOpen = false" />
    </BaseModal>
  </main>
</template>

<style scoped>
.lists-page {
  align-items: stretch;
  gap: 12px;
  width: 100%;
  padding: 18px 24px 48px;
  background: var(--color-bg-page);
  color: var(--reading-text);
}

.lists-head,
.tools,
.notes,
.none,
.lists-layout {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

.crumbs {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--reading-muted);
}

.crumbs a {
  font-weight: normal;
  color: inherit;
}

.crumbs a:hover {
  color: var(--color-accent);
}

h1 {
  margin: 0;
  font-size: var(--reading-title-size);
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  color: var(--reading-text);
}

.intro {
  max-width: 760px;
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--reading-muted);
}

.tools {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-large);
  background: var(--color-bg-reading);
  box-shadow: var(--shadow-panel);
}

.spacer {
  flex: 1;
}

.count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: var(--color-primary-hover);
}

.notes .lists-notice:last-child {
  margin-bottom: 0;
}

.none {
  font-size: 14px;
  color: var(--reading-muted);
}

.lists-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  align-items: start;
  gap: 16px;
}

.lists-column {
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-large);
  background: var(--color-bg-reading);
  box-shadow: var(--shadow-panel);
}

.lists-nav,
.lists-aside {
  position: sticky;
  top: 72px;
  max-height: calc(100vh - 88px);
  overflow: auto;
  scrollbar-color: var(--scrollbar-thumb-on-dark) transparent;
}

.lists-main {
  min-width: 0;
  scroll-margin-top: 72px;
}

.nav-toggle {
  display: none;
}

@media (max-width: 1100px) {
  .lists-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .lists-aside {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
  }
}

@media (max-width: 700px) {
  .lists-page {
    padding: 14px 16px 32px;
  }

  .tools {
    position: static;
  }

  .lists-layout {
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

  .lists-nav {
    position: static;
    max-height: none;
  }

  .lists-nav:not(.open) {
    display: none;
  }

  .lists-main {
    scroll-margin-top: 12px;
  }
}
</style>
