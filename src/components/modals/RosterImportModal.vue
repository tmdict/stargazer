<script setup lang="ts">
/* The roster import: drop or paste screenshots of the game's hero roster
   screen, review what was read, name the roster and save it as a new one.
   State lives in useRosterImport, and closing the modal clears it, so each
   opening is a new import. The modal only renders and emits the finished
   roster upward. */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import ImportShotCard from '@/components/import/ImportShotCard.vue'
import RosterImportReview from '@/components/RosterImportReview.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import ImageDropZone from '@/components/ui/ImageDropZone.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import type { ShotError } from '@/composables/useImportEngine'
import { useRosterImport, type RosterImportShot } from '@/composables/useRosterImport'
import { useToast } from '@/composables/useToast'
import type { AttrRecord } from '@/lib/characters/attributes'
import { MAX_NAME_LENGTH, nextAutoName } from '@/lib/names'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { imageFilesFromPaste } from '@/utils/imageFile'

import '@/styles/import.css'

const { show } = defineProps<{ show: boolean }>()

const emit = defineEmits<{
  close: []
  save: [name: string, heroes: Record<string, AttrRecord>]
}>()

const i18n = useI18nStore()
const rosters = useRosters()
const { error } = useToast()
const {
  shots,
  referenceStatus,
  learnedCount,
  plan,
  progress,
  addFiles,
  removeShot,
  clearImport,
  setHero,
  setLevel,
  forgetLearned,
  ensureReferences,
} = useRosterImport()

const name = ref('')
// The name a blank field saves under.
const autoName = computed(() =>
  nextAutoName(
    rosters.rosters.map((r) => r.name),
    'Roster',
  ),
)

// Every opening starts fresh: closing, by Save or otherwise, clears it.
watch(
  () => show,
  (open) => {
    if (open) void ensureReferences()
    else {
      clearImport()
      name.value = ''
    }
  },
  { immediate: true },
)

const handleAdd = async (files: File[]): Promise<void> => {
  const { added, refused } = await addFiles(files)
  if (refused) error(i18n.t('app.roster-import-match-shots'))
  else if (added === 0) error(i18n.t('app.no-valid-images'))
}

const handlePaste = (event: ClipboardEvent): void => {
  if (!show) return
  const files = imageFilesFromPaste(event)
  if (!files.length) return
  event.preventDefault()
  void handleAdd(files)
}

onMounted(() => window.addEventListener('paste', handlePaste))
onUnmounted(() => window.removeEventListener('paste', handlePaste))

const ERROR_TEXT: Record<ShotError, string> = {
  'too-small': 'app.import-failed-small',
  unsupported: 'app.import-failed-unsupported',
  references: 'app.import-failed-references',
  worker: 'app.import-failed-references',
  read: 'app.import-failed-unsupported',
}

// A screenshot's card: reading, failed, or the cards it gave and those the
// scroll cut, which another screenshot has to show whole.
const status = (shot: RosterImportShot): { text: string; tone: 'plain' | 'warn' | 'error' } => {
  if (shot.status === 'reading') return { text: i18n.t('app.import-reading'), tone: 'plain' }
  if (shot.status === 'failed') {
    return { text: i18n.t(ERROR_TEXT[shot.error ?? 'unsupported']), tone: 'error' }
  }
  const slots = shot.reading?.slots ?? []
  const read = slots.filter((s) => s.cell).length
  if (read === 0) return { text: i18n.t('app.roster-import-no-cards'), tone: 'error' }
  return {
    text: i18n.t('app.roster-import-shot-cards', {
      count: read,
      cut: slots.filter((s) => s.kind === 'clipped').length,
    }),
    tone: 'plain',
  }
}

const toCheck = computed(
  () => plan.value.entries.filter((e) => e.check).length + plan.value.unnamed.length,
)
const heroCount = computed(() => Object.keys(plan.value.heroes).length)
const blocked = computed(
  () => progress.value !== null || plan.value.blocked || heroCount.value === 0,
)

const handleSave = (): void => {
  if (blocked.value) return
  emit('save', name.value.trim() || autoName.value, plan.value.heroes)
}

const { armed, confirm } = useArmedConfirm()
const handleForgetLearned = (): void => {
  if (!confirm('forget')) return
  forgetLearned()
}
</script>

<template>
  <BaseModal
    :show
    :label="i18n.t('app.roster-import-title')"
    max-width="1000px"
    top-anchor
    @close="emit('close')"
  >
    <div class="import roster-import">
      <header class="import-head">
        <h1>{{ i18n.t('app.roster-import-title') }}</h1>
        <div class="meta">
          <span v-if="referenceStatus === 'loading'" class="note">
            {{ i18n.t('app.import-references-loading') }}
          </span>
          <span v-else-if="referenceStatus === 'failed'" class="note error">
            {{ i18n.t('app.import-failed-references') }}
          </span>
        </div>
        <p class="note intro">{{ i18n.t('app.roster-import-tip') }}</p>
      </header>

      <section class="drop-section">
        <ImageDropZone dark :compact="shots.length > 0" :paste-active="false" @add="handleAdd" />
        <p v-if="progress" class="note progress" role="status">
          {{ i18n.t('app.roster-import-progress', progress) }}
        </p>
        <div v-if="shots.length" class="shot-list">
          <ImportShotCard
            v-for="shot in shots"
            :key="shot.id"
            :name="shot.name"
            :thumb="shot.thumb"
            :full="shot.marked ?? undefined"
            :selected="false"
            :failed="shot.status === 'failed'"
            :status="status(shot)"
            @remove="removeShot(shot.id)"
          />
        </div>
      </section>

      <section v-if="plan.entries.length || plan.unnamed.length" class="review-section">
        <div class="section-head">
          <span class="section-title">{{ i18n.t('app.import-review') }}</span>
          <span class="section-sub">
            {{ i18n.t('app.roster-import-found', { count: plan.entries.length }) }}
            <template v-if="toCheck">
              · {{ i18n.t('app.import-to-review', { count: toCheck }) }}
            </template>
          </span>
        </div>
        <RosterImportReview :plan :shots @set-hero="setHero" @set-level="setLevel" />
      </section>

      <div class="footer">
        <label class="field name">
          <span class="field-label">{{ i18n.t('app.roster-import-name') }}</span>
          <input
            v-model="name"
            class="field-input"
            type="text"
            spellcheck="false"
            :maxlength="MAX_NAME_LENGTH"
            :placeholder="autoName"
          />
        </label>
        <button type="button" class="footer-btn danger" :disabled="blocked" @click="handleSave">
          {{ i18n.t('app.roster-import-save', { count: heroCount }) }}
        </button>
        <button type="button" class="footer-btn secondary" @click="emit('close')">
          {{ i18n.t('app.cancel') }}
        </button>
        <button
          v-if="learnedCount > 0"
          type="button"
          class="link-btn"
          :class="{ armed: armed === 'forget' }"
          @click="handleForgetLearned"
        >
          <ConfirmLabel
            :armed="armed === 'forget'"
            :label="i18n.t('app.import-forget-learned', { count: learnedCount })"
          />
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.roster-import {
  --import-columns: repeat(6, minmax(0, 1fr));
}

.progress {
  margin: 0;
}

.shot-list {
  display: grid;
  grid-template-columns: var(--import-columns);
  gap: var(--spacing-sm);
}

@media (max-width: 720px) {
  .shot-list {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-md);
  }
}

.footer .name {
  flex: 1 1 220px;
}
</style>
