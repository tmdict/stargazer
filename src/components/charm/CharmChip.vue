<script setup lang="ts">
/* A season charm on the Seasonal tab: how many heroes share it and its newest
   heroes, with its text and every hero in a hover card. */

import { computed, ref } from 'vue'

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

const SHOWN = 6

const { charm, heroes, text } = defineProps<{
  charm: CharmData
  // The heroes sharing the charm, oldest first.
  heroes: readonly string[]
  // The charm's top tier text, in `lang`; absent until that language loads.
  text?: string
  lang: SkillLocale
}>()

const i18n = useI18nStore()

const newest = computed(() => heroes.slice(-SHOWN))
const older = computed(() => heroes.length - newest.value.length)
const html = computed(() => (text ? highlightSkillText(text) : ''))

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
      <span v-if="older" class="older">+{{ older }}</span>
      <span class="faces">
        <GuidePortrait v-for="slug in newest" :key="slug" :slug :lang="i18n.currentLocale" />
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
  max-width: 100%;
}

.charm-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 228px;
  max-width: 100%;
  padding: 4px 10px 4px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 22px;
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

.older {
  flex: none;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.faces {
  --size: 30px;
  --disc-ring: var(--color-bg-raised);
  display: inline-flex;
  flex: none;
  pointer-events: none;
}

.faces > * + * {
  margin-left: -9px;
}

.ring {
  top: -4px;
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
