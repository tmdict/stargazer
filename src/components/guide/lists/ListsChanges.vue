<script setup lang="ts">
/* My changes: what changed in each list against the site's, with Export,
   Copy and Back to the site's lists for every list, which takes a second
   press. */

import { computed } from 'vue'

import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { entryKey, listDiff } from '@/lib/placement/listEdits'
import type { ListEntry } from '@/lib/placement/types'
import { SITE_LISTS, useListEditor, useListWords } from './useListEditor'

const emit = defineEmits<{ go: [name: string]; export: []; copy: []; close: [] }>()

const editor = useListEditor()
const { t, listName, entryName, and } = useListWords()
const { armed, confirm } = useArmedConfirm()

const broken = computed(() =>
  editor.changed.value.filter((name) => editor.problems.value[name]!.length),
)

function changes(name: string): string[] {
  const mine = editor.lists.value[name]!
  const site = SITE_LISTS[name]!
  const { added, removed, moved } = listDiff(site, mine)
  const now = new Map(mine.map((entry, i) => [entryKey(entry), i + 1]))
  const named = (key: string, list: readonly ListEntry[]) =>
    entryName(
      list.find((entry) => entryKey(entry) === key)!,
      true,
    )
  return [
    ...(added.size
      ? [
          t('lists-added', {
            items: and(
              [...added].map((key) =>
                t('lists-entry-at', { name: named(key, mine), place: now.get(key)! }),
              ),
            ),
          }),
        ]
      : []),
    ...(removed.length
      ? [t('lists-took-off', { items: and(removed.map((key) => named(key, site))) })]
      : []),
    ...(moved.size
      ? [
          t('lists-moved', {
            items: and(
              [...moved].map(([key, was]) =>
                was === now.get(key)
                  ? t('lists-moved-same', { name: named(key, mine), place: was })
                  : t('lists-moved-from', { name: named(key, mine), from: was, to: now.get(key)! }),
              ),
            ),
          }),
        ]
      : []),
  ]
}

function resetAll(): void {
  if (!confirm('all')) return
  editor.resetAll()
}
</script>

<template>
  <section class="lists-changes">
    <h2>
      {{
        editor.changed.value.length
          ? t('lists-changes-title', { n: editor.changed.value.length })
          : t('lists-no-changes')
      }}
    </h2>
    <ul v-if="editor.changed.value.length" class="reading-secondary">
      <li v-for="name in editor.changed.value" :key="name">
        <a :href="`#${name}`" @click.prevent="emit('go', name)">{{ listName(name) }}</a>
        <span v-for="(line, index) in changes(name)" :key="index" class="line">{{ line }}</span>
        <span v-if="editor.isSiteChanged(name)" class="line reading-meta">
          {{ t('lists-changed-since') }}
        </span>
      </li>
    </ul>
    <p v-else>{{ t('lists-no-changes-text') }}</p>
    <p v-if="broken.length" class="reading-secondary">
      {{ t('lists-left-out', { lists: and(broken.map(listName)) }) }}
    </p>
    <p class="reading-meta">{{ t('lists-send') }}</p>
    <div class="actions">
      <button
        type="button"
        class="lists-btn primary"
        :disabled="!editor.sendable.value.length"
        @click="emit('export')"
      >
        {{ t('export') }}
      </button>
      <button
        type="button"
        class="lists-btn"
        :disabled="!editor.sendable.value.length"
        @click="emit('copy')"
      >
        {{ t('copy') }}
      </button>
      <span class="spacer" />
      <button
        type="button"
        class="lists-btn danger"
        :class="{ 'confirm-armed': armed !== null }"
        :disabled="!editor.changed.value.length"
        @click="resetAll"
      >
        <ConfirmLabel :armed="armed !== null" :label="t('lists-back-all')" />
      </button>
      <button type="button" class="lists-btn" @click="emit('close')">{{ t('close') }}</button>
    </div>
  </section>
</template>

<style scoped>
h2 {
  margin-top: 0;
  padding-right: 40px;
}

li {
  display: flex;
  flex-direction: column;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.spacer {
  flex: 1;
}
</style>
