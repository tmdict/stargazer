<script setup lang="ts">
/* A season charm on the Seasonal tab: how many heroes share it and its newest
   heroes, with its text and every hero in a hover card. */

import { computed, onMounted, onUnmounted, onUpdated, ref } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import HoldRing from '@/components/ui/HoldRing.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInspectOnClick } from '@/composables/useInspectOnClick'
import type { SkillLocale } from '@/lib/types/i18n'
import type { CharmData } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'
import { highlightSkillText } from '@/utils/textHighlight'

const { charm, heroes, text } = defineProps<{
  charm: CharmData
  // The heroes sharing the charm, oldest first.
  heroes: readonly string[]
  // The charm's top tier text, in `lang`; absent until that language loads.
  text?: string
  lang: SkillLocale
}>()

const i18n = useI18nStore()

const strip = ref<HTMLElement>()
// What a chip of the list's usual width holds, until the strip is measured.
const shown = ref(6)

const newest = computed(() => heroes.slice(-shown.value))
const older = computed(() => heroes.length - newest.value.length)
const html = computed(() => (text ? highlightSkillText(text) : ''))

/* The faces fill the strip after the count: every hero when they all fit, else
 * the newest that leave room for the "+N" after them. The strip's width comes
 * from the chip, never from what it holds, so the count can't feed back into
 * the width it was measured from. */
const fitFaces = (): void => {
  const el = strip.value
  // A hidden tab has no width to measure.
  if (!el?.clientWidth) return
  const style = getComputedStyle(el)
  const size = parseFloat(style.getPropertyValue('--size'))
  const step = size - parseFloat(style.getPropertyValue('--overlap'))
  const fit = Math.floor((el.clientWidth - size) / step) + 1
  shown.value = Math.min(heroes.length, Math.max(1, fit))
}

// Once the "+N" shows, the last face may have to make room for it.
const makeRoomForOlder = (): void => {
  const el = strip.value
  if (el && shown.value > 1 && el.scrollWidth > el.clientWidth) shown.value--
}

let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !strip.value) return
  observer = new ResizeObserver(fitFaces)
  observer.observe(strip.value)
})
onUpdated(makeRoomForOlder)
onUnmounted(() => observer?.disconnect())

const label = computed(
  () =>
    `${i18n.t('app.charm')}: ${heroes.map((slug) => curatedHeroName(slug, i18n.currentLocale)).join(', ')}`,
)

const chip = ref<HTMLElement>()
const { showTooltip, onMouseEnter, onMouseLeave, open, pressing, onPointerDown, onContextMenu } =
  useInspectOnClick(() => ({ kind: 'charm', charm }))
</script>

<template>
  <div class="charm-chip-frame">
    <button
      ref="chip"
      type="button"
      class="charm-chip inspectable"
      :aria-label="label"
      @click="open"
      @pointerdown="onPointerDown"
      @contextmenu="onContextMenu"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <span class="count">{{ heroes.length }}</span>
      <span ref="strip" class="strip">
        <span class="faces">
          <GuidePortrait v-for="slug in newest" :key="slug" :slug :lang="i18n.currentLocale" />
        </span>
        <span v-if="older" class="older">+{{ older }}</span>
      </span>
    </button>
    <HoldRing v-if="pressing" class="ring" />

    <TooltipPopup v-if="showTooltip && chip" :target-element="chip" max-width="340px">
      <template #content>
        <TooltipCard :hint="i18n.t('app.hold-for-details')">
          <div v-if="html" class="text" :lang v-html="html" />
          <div class="everyone">
            <GuidePortrait v-for="slug in heroes" :key="slug" :slug :lang="i18n.currentLocale" />
          </div>
        </TooltipCard>
      </template>
    </TooltipPopup>
  </div>
</template>

<style scoped>
.charm-chip-frame {
  position: relative;
}

.charm-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 10px 5px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 999px;
  background: var(--color-bg-raised);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.charm-chip:hover {
  border-color: var(--color-accent);
}

.count {
  flex: none;
  min-width: 20px;
  font-size: 15px;
  font-weight: 700;
  text-align: right;
  color: var(--color-primary);
}

.strip {
  --size: 30px;
  --overlap: 9px;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.older {
  flex: none;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.faces {
  --disc-ring: var(--color-bg-raised);
  display: inline-flex;
  flex: none;
  pointer-events: none;
}

.faces > * + * {
  margin-left: calc(-1 * var(--overlap));
}

.ring {
  top: calc(50% - 25px);
  left: calc(50% - 25px);
  width: 50px;
  height: 50px;
}

.text {
  margin-bottom: 10px;
}

.everyone {
  --size: 32px;
  --disc-ring: transparent;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
