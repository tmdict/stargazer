<script setup lang="ts">
/* Who Would Win?'s import: drop or paste screenshots of the Supreme League's
   knockout matchup list, review what was read, and Fill the five games. State
   lives in useWwwImport, and closing the modal clears it, so each opening is
   a new import. The modal only renders and emits the games upward. */

import { computed, onMounted, onUnmounted, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import WwwImportReview from '@/components/guide/www/WwwImportReview.vue'
import ImportLearnedReset from '@/components/import/ImportLearnedReset.vue'
import ImportShotCard from '@/components/import/ImportShotCard.vue'
import ImageDropZone from '@/components/ui/ImageDropZone.vue'
import { SHOT_ERROR_TEXT, type ShotStatusView } from '@/components/import/shotStatus'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useToast } from '@/composables/useToast'
import { useWwwImport, type WwwImportShot } from '@/composables/useWwwImport'
import { WWW_GAMES, type WwwGame } from '@/lib/pvp/sl/www/match'
import { useI18nStore } from '@/stores/i18n'
import { imageFilesFromPaste } from '@/utils/imageFile'

import '@/styles/import.css'

const { show } = defineProps<{ show: boolean }>()

const emit = defineEmits<{
  close: []
  fill: [games: (WwwGame | null)[]]
}>()

const i18n = useI18nStore()
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
  setArtifact,
  confirmAll,
  forgetLearned,
  ensureReferences,
} = useWwwImport()

// The tip marks what it bolds with **, so a translation keeps its own stress.
const tipParts = computed(() => i18n.t('app.www-import-tip').split('**'))

// Every opening starts fresh: closing, by Fill or otherwise, clears it.
watch(
  () => show,
  (open) => {
    if (open) void ensureReferences()
    else clearImport()
  },
  { immediate: true },
)

const handleAdd = async (files: File[]): Promise<void> => {
  const { added, refused } = await addFiles(files)
  if (refused.roster) error(i18n.t('app.import-roster-shots'))
  else if (Object.keys(refused).length) error(i18n.t('app.roster-import-match-shots'))
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

// A screenshot's card: reading, failed, or the games it shows and those whose
// cards are cut off, which another screenshot has to show whole.
const status = (shot: WwwImportShot): ShotStatusView => {
  if (shot.status === 'reading') return { text: i18n.t('app.import-reading'), tone: 'plain' }
  if (shot.status === 'failed') {
    return { text: i18n.t(SHOT_ERROR_TEXT[shot.error ?? 'unsupported']), tone: 'error' }
  }
  const panels = shot.reading?.panels ?? []
  if (!panels.length) return { text: i18n.t('app.www-import-no-games'), tone: 'error' }
  return {
    text: i18n.t('app.www-import-shot-games', {
      games: (plan.value.numbers[shot.id] ?? []).join(', '),
      cut: panels.filter((p) => !p.blue.cards && !p.red.cards).length,
    }),
    tone: 'plain',
  }
}

const found = computed(() => WWW_GAMES - plan.value.missing.length)
const blocked = computed(() => progress.value !== null || plan.value.blocked || found.value === 0)

const handleFill = (): void => {
  if (blocked.value) return
  emit('fill', plan.value.fill)
}

const { armed, confirm } = useArmedConfirm()
const handleForgetLearned = (): void => {
  if (!confirm('forget')) return
  forgetLearned()
}
</script>

<template>
  <BaseModal :show :label="i18n.t('app.www-import-title')" top-anchor @close="emit('close')">
    <div class="import www-import">
      <header class="import-head">
        <h1>{{ i18n.t('app.www-import-title') }}</h1>
        <div class="meta">
          <span v-if="referenceStatus === 'loading'" class="note">
            {{ i18n.t('app.import-references-loading') }}
          </span>
          <span v-else-if="referenceStatus === 'failed'" class="note error">
            {{ i18n.t('app.import-failed-references') }}
          </span>
        </div>
        <p class="note intro">
          <template v-for="(part, i) in tipParts" :key="i">
            <strong v-if="i % 2">{{ part }}</strong>
            <template v-else>{{ part }}</template>
          </template>
        </p>
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
            :failed="shot.status === 'failed'"
            :status="status(shot)"
            @remove="removeShot(shot.id)"
          />
        </div>
      </section>

      <section v-if="found || plan.otherMatch" class="review-section">
        <div class="section-head">
          <span class="section-title">{{ i18n.t('app.import-review') }}</span>
          <span class="section-sub">
            {{ i18n.t('app.www-import-found', { count: found }) }}
            <template v-if="plan.toCheck">
              · {{ i18n.t('app.import-to-review', { count: plan.toCheck }) }}
            </template>
          </span>
        </div>
        <WwwImportReview
          :plan
          :shots
          @set-hero="setHero"
          @set-level="setLevel"
          @set-artifact="setArtifact"
          @confirm-all="confirmAll"
        />
        <ImportLearnedReset
          v-if="learnedCount > 0"
          :armed="armed === 'forget'"
          @reset="handleForgetLearned"
        />
      </section>

      <div class="footer">
        <button type="button" class="footer-btn danger" :disabled="blocked" @click="handleFill">
          {{ i18n.t('app.fill') }}
        </button>
        <button type="button" class="footer-btn secondary" @click="emit('close')">
          {{ i18n.t('app.cancel') }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.www-import {
  --import-columns: repeat(5, minmax(0, 1fr));
}

.progress {
  margin: 0;
}
</style>
