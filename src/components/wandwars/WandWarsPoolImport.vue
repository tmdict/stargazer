<template>
  <div class="pool-import">
    <div class="reference-bar" :class="{ collapsed: !referenceOpen }">
      <button
        class="reference-toggle"
        :aria-expanded="referenceOpen"
        @click="referenceOpen = !referenceOpen"
      >
        <span class="toggle-arrow">{{ referenceOpen ? '▾' : '▸' }}</span>
        {{ i18n.t('wandwars.reference-options') }}
        <span v-if="usingOverride" class="override-tag">{{
          i18n.t('wandwars.override-active')
        }}</span>
      </button>
      <div v-if="referenceOpen" class="reference-content">
        <div class="reference-status">
          <span class="status-ok">✓</span>
          <template v-if="usingOverride">
            {{
              i18n
                .t('wandwars.messages/pool-ref-override')
                .replace('{count}', String(referenceCount))
            }}
          </template>
          <template v-else>
            {{
              i18n
                .t('wandwars.messages/pool-ref-default')
                .replace('{count}', String(referenceCount))
            }}
          </template>
        </div>
        <div class="reference-actions">
          <button
            class="ref-btn"
            :disabled="builderBusy"
            title="Pick a folder of hero portrait images; download a signatures file to commit."
            @click="openGenerateFolder"
          >
            {{
              builderBusy && builderMode === 'generate'
                ? i18n.t('wandwars.generating')
                : i18n.t('wandwars.generate-signatures')
            }}
          </button>
          <button
            class="ref-btn"
            :disabled="builderBusy"
            :title="
              usingOverride
                ? 'Discard uploaded reference and return to the default signatures.'
                : 'Pick a folder of hero portrait images; use them in-memory for this session only.'
            "
            @click="handleOverrideToggle"
          >
            {{
              builderBusy && builderMode === 'override'
                ? i18n.t('wandwars.loading')
                : usingOverride
                  ? i18n.t('wandwars.revert-to-default')
                  : i18n.t('wandwars.upload-reference')
            }}
          </button>
        </div>
        <div v-if="builderStatus" class="train-status">{{ builderStatus }}</div>
      </div>
      <input
        ref="generateInput"
        type="file"
        accept="image/*"
        multiple
        webkitdirectory
        class="hidden-input"
        @change="handleGenerateFolder"
      />
      <input
        ref="overrideInput"
        type="file"
        accept="image/*"
        multiple
        webkitdirectory
        class="hidden-input"
        @change="handleOverrideFolder"
      />
    </div>

    <div v-if="phase === 'upload'" class="upload-zone" @click="openFilePicker">
      <div
        class="drop-target"
        :class="{ dragging, busy }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <template v-if="busy">
          <div class="busy-indicator">{{ i18n.t('wandwars.loading') }}</div>
        </template>
        <template v-else>
          <div class="drop-title">{{ i18n.t('wandwars.messages/pool-upload-title') }}</div>
          <div class="drop-subtitle">{{ i18n.t('wandwars.messages/pool-upload-subtitle') }}</div>
        </template>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handleFileChange"
      />
    </div>

    <template v-else-if="phase === 'crop'">
      <div class="crop-instructions">
        {{ i18n.t('wandwars.messages/pool-crop-instructions') }}
      </div>
      <div
        ref="cropContainer"
        class="crop-container"
        @mousedown="startDrag"
        @touchstart.prevent="startDragTouch"
      >
        <img
          v-if="uploadedSrc"
          :src="uploadedSrc"
          class="crop-image"
          draggable="false"
          alt="Screenshot"
        />
        <div
          v-if="cropRect"
          class="crop-rect"
          :style="{
            left: cropRect.x * 100 + '%',
            top: cropRect.y * 100 + '%',
            width: cropRect.w * 100 + '%',
            height: cropRect.h * 100 + '%',
          }"
        >
          <div
            v-for="i in cols - 1"
            :key="'v' + i"
            class="grid-line-v"
            :style="{ left: (i / cols) * 100 + '%' }"
          />
          <div
            v-for="i in rows - 1"
            :key="'h' + i"
            class="grid-line-h"
            :style="{ top: (i / rows) * 100 + '%' }"
          />
        </div>
      </div>
      <div class="actions">
        <button class="action-btn danger" @click="reset">{{ i18n.t('wandwars.cancel') }}</button>
        <button class="action-btn" @click="resetCropToFull">
          {{ i18n.t('wandwars.select-all') }}
        </button>
        <button class="action-btn" :disabled="!canDetect || busy" @click="runDetection">
          {{ busy ? i18n.t('wandwars.detecting') : i18n.t('wandwars.detect-heroes') }}
        </button>
      </div>
    </template>

    <template v-else-if="phase === 'review'">
      <div class="detections-header">
        <div class="detections-title">{{ i18n.t('wandwars.messages/pool-review-title') }}</div>
        <div class="detections-summary">
          {{
            i18n
              .t('wandwars.messages/pool-review-summary')
              .replace('{confirmed}', String(confirmedCount))
              .replace('{total}', String(detections.length))
          }}
        </div>
      </div>

      <div class="detections-grid" :style="{ gridTemplateColumns: `repeat(${cols}, 1fr)` }">
        <div
          v-for="(d, i) in detections"
          :key="i"
          :class="['cell', confidenceClass(d)]"
          @click="openPicker(i)"
        >
          <img :src="d.crop" alt="" class="cell-crop" />
          <div class="cell-label">
            <img v-if="d.hero" :src="characterImages[d.hero]" :alt="d.hero" class="cell-portrait" />
            <span v-else class="cell-unknown">?</span>
            <span class="cell-name">{{
              d.hero ? formatName(d.hero) : i18n.t('wandwars.unknown')
            }}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="action-btn danger" @click="reset">{{ i18n.t('wandwars.cancel') }}</button>
        <button class="action-btn" @click="backToCrop">
          {{ i18n.t('wandwars.back-to-crop') }}
        </button>
        <button class="action-btn" :disabled="confirmedCount < detections.length" @click="confirm">
          {{ i18n.t('wandwars.apply-pool-filter') }}
        </button>
      </div>

      <div v-if="activePicker !== null" class="picker-overlay" @click.self="activePicker = null">
        <div class="picker-panel">
          <div class="picker-title">
            {{ i18n.t('wandwars.correct-detection') }}
            <span class="picker-close" @click="activePicker = null">✕</span>
          </div>
          <input
            v-model="pickerQuery"
            type="text"
            :placeholder="i18n.t('wandwars.search-hero')"
            class="picker-search"
            @keydown.esc="activePicker = null"
          />
          <div class="picker-grid">
            <button
              v-for="name in filteredHeroes"
              :key="name"
              class="picker-option"
              @click="applyPick(name)"
            >
              <img :src="characterImages[name]" :alt="name" />
              <span>{{ formatName(name) }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useI18nStore } from '@/stores/i18n'
import { formatName } from '@/wandwars/formatting'
import {
  getBundledReferenceCount,
  hasOverrideReference,
  invalidateBundledCache,
  loadBundledReferenceSignatures,
  setOverrideReference,
} from '@/wandwars/heroImport/bundledReference'
import {
  buildSignaturesFromFiles,
  downloadSignaturesFile,
  serializeSignaturesModule,
} from '@/wandwars/heroImport/heroPortraitSignatureBuilder'
import { loadImage } from '@/wandwars/heroImport/imageSignature'
import {
  detectPool,
  suggestGridCrop,
  type CropRect,
  type PoolDetection,
} from '@/wandwars/heroImport/poolDetect'

const i18n = useI18nStore()

const props = defineProps<{
  characterImages: Record<string, string>
  allHeroes: string[]
  rows?: number
  cols?: number
}>()

const emit = defineEmits<{
  apply: [pool: string[]]
  cancel: []
}>()

const rows = computed(() => props.rows ?? 4)
const cols = computed(() => props.cols ?? 5)

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const busy = ref(false)
const detections = ref<PoolDetection[]>([])

const activePicker = ref<number | null>(null)
const pickerQuery = ref('')

type Phase = 'upload' | 'crop' | 'review'
const phase = ref<Phase>('upload')

const uploadedImage = ref<HTMLImageElement | null>(null)
const uploadedSrc = ref<string>('')
const cropRect = ref<CropRect | null>(null)
const cropContainer = ref<HTMLElement | null>(null)

const canDetect = computed(() => {
  if (!cropRect.value) return false
  return cropRect.value.w > 0.05 && cropRect.value.h > 0.05
})

const referenceCount = ref(getBundledReferenceCount())
const usingOverride = ref(hasOverrideReference())
const builderBusy = ref(false)
// Store builder status as semantic state so language switches re-render reactively.
type BuilderStatusState =
  | { kind: 'none' }
  | { kind: 'no-images' }
  | { kind: 'generated'; count: number; skipped: number }
  | { kind: 'override-active'; count: number; skipped: number }
const builderStatusState = ref<BuilderStatusState>({ kind: 'none' })
const builderStatus = computed(() => {
  const s = builderStatusState.value
  if (s.kind === 'none') return ''
  if (s.kind === 'no-images') return i18n.t('wandwars.messages/builder-no-images')
  const skippedMsg =
    s.skipped > 0
      ? i18n.t('wandwars.messages/builder-skipped').replace('{count}', String(s.skipped))
      : ''
  const key =
    s.kind === 'generated'
      ? 'wandwars.messages/builder-generated'
      : 'wandwars.messages/builder-override-active'
  return i18n.t(key).replace('{count}', String(s.count)).replace('{skipped}', skippedMsg)
})
const builderMode = ref<'generate' | 'override' | null>(null)
const generateInput = ref<HTMLInputElement | null>(null)
const overrideInput = ref<HTMLInputElement | null>(null)
const referenceOpen = ref(false)

function openGenerateFolder() {
  builderStatusState.value = { kind: 'none' }
  generateInput.value?.click()
}

function handleOverrideToggle() {
  builderStatusState.value = { kind: 'none' }
  if (usingOverride.value) {
    setOverrideReference(null)
    invalidateBundledCache()
    sigCache = null
    usingOverride.value = false
    referenceCount.value = getBundledReferenceCount()
    return
  }
  overrideInput.value?.click()
}

async function handleGenerateFolder(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  builderMode.value = 'generate'
  builderBusy.value = true
  try {
    const { signatures, skipped } = await buildSignaturesFromFiles(files)
    const count = Object.keys(signatures).length
    if (count === 0) {
      builderStatusState.value = { kind: 'no-images' }
      return
    }
    downloadSignaturesFile(serializeSignaturesModule(signatures))
    builderStatusState.value = { kind: 'generated', count, skipped: skipped.length }
  } finally {
    builderBusy.value = false
    builderMode.value = null
    if (generateInput.value) generateInput.value.value = ''
  }
}

async function handleOverrideFolder(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  builderMode.value = 'override'
  builderBusy.value = true
  try {
    const { signatures, skipped } = await buildSignaturesFromFiles(files)
    const count = Object.keys(signatures).length
    if (count === 0) {
      builderStatusState.value = { kind: 'no-images' }
      return
    }
    setOverrideReference(signatures)
    sigCache = null
    usingOverride.value = true
    referenceCount.value = count
    builderStatusState.value = { kind: 'override-active', count, skipped: skipped.length }
  } finally {
    builderBusy.value = false
    builderMode.value = null
    if (overrideInput.value) overrideInput.value.value = ''
  }
}

let sigCache: Record<string, Float32Array> | null = null

async function getSignatures(): Promise<Record<string, Float32Array>> {
  if (sigCache) return sigCache
  sigCache = await loadBundledReferenceSignatures()
  return sigCache
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) loadScreenshot(file)
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) loadScreenshot(file)
}

async function loadScreenshot(file: File) {
  busy.value = true
  try {
    if (uploadedSrc.value) URL.revokeObjectURL(uploadedSrc.value)
    uploadedSrc.value = URL.createObjectURL(file)
    uploadedImage.value = await loadImage(uploadedSrc.value)
    cropRect.value = await suggestGridCrop(uploadedImage.value)
    phase.value = 'crop'
  } finally {
    busy.value = false
  }
}

function resetCropToFull() {
  cropRect.value = { x: 0, y: 0, w: 1, h: 1 }
}

function backToCrop() {
  detections.value = []
  activePicker.value = null
  phase.value = 'crop'
}

async function runDetection() {
  if (!uploadedImage.value || !cropRect.value) return
  busy.value = true
  try {
    const sigs = await getSignatures()
    detections.value = await detectPool(uploadedImage.value, sigs, {
      rows: rows.value,
      cols: cols.value,
      crop: cropRect.value,
    })
    phase.value = 'review'
  } finally {
    busy.value = false
  }
}

interface DragState {
  originX: number
  originY: number
  rect: DOMRect
}

let dragState: DragState | null = null

function clientToRatio(clientX: number, clientY: number, rect: DOMRect) {
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  return { x, y }
}

function startDrag(event: MouseEvent) {
  if (!cropContainer.value) return
  const rect = cropContainer.value.getBoundingClientRect()
  const { x, y } = clientToRatio(event.clientX, event.clientY, rect)
  dragState = { originX: x, originY: y, rect }
  cropRect.value = { x, y, w: 0, h: 0 }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', endDrag)
  event.preventDefault()
}

function startDragTouch(event: TouchEvent) {
  if (!cropContainer.value || event.touches.length === 0) return
  const rect = cropContainer.value.getBoundingClientRect()
  const t = event.touches[0]!
  const { x, y } = clientToRatio(t.clientX, t.clientY, rect)
  dragState = { originX: x, originY: y, rect }
  cropRect.value = { x, y, w: 0, h: 0 }
  window.addEventListener('touchmove', onDragMoveTouch, { passive: false })
  window.addEventListener('touchend', endDrag)
}

function updateRectFromClient(clientX: number, clientY: number) {
  if (!dragState) return
  const { originX, originY, rect } = dragState
  const { x, y } = clientToRatio(clientX, clientY, rect)
  cropRect.value = {
    x: Math.min(originX, x),
    y: Math.min(originY, y),
    w: Math.abs(x - originX),
    h: Math.abs(y - originY),
  }
}

function onDragMove(event: MouseEvent) {
  updateRectFromClient(event.clientX, event.clientY)
}

function onDragMoveTouch(event: TouchEvent) {
  if (event.touches.length === 0) return
  event.preventDefault()
  const t = event.touches[0]!
  updateRectFromClient(t.clientX, t.clientY)
}

function endDrag() {
  dragState = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onDragMoveTouch)
  window.removeEventListener('touchend', endDrag)
}

function onPaste(event: ClipboardEvent) {
  if (phase.value !== 'upload' || busy.value) return
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        loadScreenshot(file)
        return
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  endDrag()
  window.removeEventListener('paste', onPaste)
  if (uploadedSrc.value) URL.revokeObjectURL(uploadedSrc.value)
})

function confidenceClass(d: PoolDetection): string {
  if (!d.hero) return 'unknown'
  if (d.distance <= 0.2) return 'high'
  if (d.distance <= 0.35) return 'medium'
  return 'low'
}

const confirmedCount = computed(() => detections.value.filter((d) => d.hero).length)

const filteredHeroes = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  return props.allHeroes.filter(
    (h) => !q || h.toLowerCase().includes(q) || formatName(h).toLowerCase().includes(q),
  )
})

function openPicker(index: number) {
  activePicker.value = index
  pickerQuery.value = ''
}

function applyPick(hero: string) {
  if (activePicker.value === null) return
  const target = detections.value[activePicker.value]
  if (target) {
    target.hero = hero
    target.distance = 0
  }
  activePicker.value = null
}

function confirm() {
  const pool = detections.value.map((d) => d.hero).filter((h): h is string => !!h)
  emit('apply', pool)
  reset()
}

function reset() {
  detections.value = []
  activePicker.value = null
  pickerQuery.value = ''
  phase.value = 'upload'
  cropRect.value = null
  uploadedImage.value = null
  if (uploadedSrc.value) {
    URL.revokeObjectURL(uploadedSrc.value)
    uploadedSrc.value = ''
  }
  if (fileInput.value) fileInput.value.value = ''
  emit('cancel')
}
</script>

<style scoped>
.pool-import {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.reference-bar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: 0;
  font-size: 0.8rem;
}

.reference-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  align-self: flex-start;
}

.reference-toggle:hover {
  color: var(--color-text-primary);
}

.reference-toggle:focus {
  outline: none;
}

.toggle-arrow {
  display: inline-block;
  width: 12px;
  font-size: 0.7rem;
}

.override-tag {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-primary);
  color: white;
  font-size: 0.68rem;
  font-weight: 600;
}

.reference-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-primary);
}

.reference-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.ref-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 400;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.ref-btn:focus {
  outline: none;
}

.ref-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ref-btn:hover:not(:disabled) {
  border-color: var(--color-text-secondary);
  color: var(--color-text-primary);
}

.train-status {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  background: var(--color-bg-secondary);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.reference-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-secondary);
}

.status-ok {
  color: var(--color-success);
  font-weight: 700;
}

.status-warn {
  color: #d97706;
  font-weight: 700;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff4e0;
}

.reference-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.ref-btn {
  padding: 4px var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 0.78rem;
}

.ref-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.ref-btn.danger:hover {
  background: var(--color-error);
  border-color: var(--color-error);
}

.train-status {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  background: var(--color-bg-secondary);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.upload-zone {
  cursor: pointer;
}

.drop-target {
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xl);
  text-align: center;
  background: var(--color-bg-secondary);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.drop-target.dragging {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

.drop-target.busy {
  opacity: 0.7;
}

.crop-instructions {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-small);
}

.crop-container {
  position: relative;
  display: block;
  max-width: 100%;
  max-height: 70vh;
  width: fit-content;
  margin: 0 auto;
  background: #000;
  border-radius: var(--radius-small);
  user-select: none;
  cursor: crosshair;
  overflow: hidden;
}

.crop-image {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  pointer-events: none;
}

.crop-rect {
  position: absolute;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.grid-line-v,
.grid-line-h {
  position: absolute;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.grid-line-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

.grid-line-h {
  left: 0;
  right: 0;
  height: 1px;
}

.busy-indicator {
  font-weight: 600;
  color: var(--color-primary);
}

.drop-title {
  font-weight: 700;
  color: var(--color-text-primary);
}

.drop-subtitle {
  margin-top: var(--spacing-xs);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.busy-indicator {
  font-weight: 600;
  color: var(--color-primary);
}

.hidden-input {
  display: none;
}

.detections-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.detections-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.detections-summary {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.detections-grid {
  display: grid;
  gap: var(--spacing-sm);
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: var(--radius-small);
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.cell:hover {
  border-color: var(--color-primary);
}

.cell.high {
  border-color: var(--color-success);
}

.cell.medium {
  border-color: #d97706;
}

.cell.low {
  border-color: var(--color-error);
}

.cell.unknown {
  border-color: var(--color-error);
  border-style: dashed;
}

.cell-crop {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius-small);
}

.cell-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}

.cell-portrait {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
}

.cell-unknown {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-error);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.cell-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.action-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.danger:hover {
  background: var(--color-error);
  border-color: var(--color-error);
}

.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.picker-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius-medium);
  padding: var(--spacing-lg);
  width: min(600px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.picker-title {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 1rem;
}

.picker-close {
  cursor: pointer;
  color: var(--color-text-secondary);
}

.picker-close:hover {
  color: var(--color-text-primary);
}

.picker-search {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  font-size: 0.9rem;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--spacing-xs);
  overflow-y: auto;
}

.picker-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-xs);
  border: 1px solid transparent;
  border-radius: var(--radius-small);
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
}

.picker-option:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.picker-option img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
}
</style>
