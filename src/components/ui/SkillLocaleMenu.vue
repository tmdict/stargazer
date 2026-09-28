<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import IconGlobe from './IconGlobe.vue'
import { useDropdown } from '@/composables/useDropdown'
import { usePanelFit } from '@/composables/usePanelFit'
import { SKILL_LOCALES, type SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

// Globe dropdown for the skill-text language, distinct from the header en/中
// chrome toggle. `links` mode (skill pages) renders real hrefs to the sibling
// locale URLs; `select` mode (skill modal) emits and lets the caller own the
// chunk loading. An explicit pick persists the preference in both modes; only
// picks persist (URL visits never do).
const props = defineProps<{
  current: SkillLocale
  mode: 'links' | 'select'
  /** Hero slug for links mode. */
  slug?: string
}>()

const emit = defineEmits<{ select: [locale: SkillLocale] }>()

const i18n = useI18nStore()

const root = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const { open, hide, toggle, onMouseEnter, onMouseLeave, onTouchStart } = useDropdown({
  rootRef: root,
  hover: true,
})
const panelMaxHeight = usePanelFit(panel, () => open.value)

const currentDef = computed(() => SKILL_LOCALES.find((l) => l.code === props.current))
// Teal state signals the text language differs from the site chrome.
const isActive = computed(() => props.current !== i18n.currentLocale)

const pickLink = (locale: SkillLocale) => {
  i18n.setSkillLocale(locale)
  hide()
}

const pickSelect = (locale: SkillLocale) => {
  i18n.setSkillLocale(locale)
  emit('select', locale)
  hide()
}
</script>

<template>
  <div
    ref="root"
    class="locale-menu"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @touchstart.passive="onTouchStart"
  >
    <button
      type="button"
      class="trigger"
      :class="{ 'is-active': isActive }"
      :aria-label="i18n.t('app.skill-locale')"
      :aria-expanded="open"
      @click="toggle"
    >
      <IconGlobe :size="16" aria-hidden="true" />
      <span class="trigger-label">{{ currentDef?.native ?? current }}</span>
      <span class="trigger-caret" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <!-- Plain links/buttons in a disclosure (no ARIA menu roles, which would
         promise arrow-key navigation). v-show (not v-if) keeps all locale
         links in the DOM, so the baked HTML carries crawlable hrefs to every
         language of this page. -->
    <div v-show="open" ref="panel" class="panel" :style="{ maxHeight: panelMaxHeight }">
      <template v-if="mode === 'links' && slug">
        <RouterLink
          v-for="l in SKILL_LOCALES"
          :key="l.code"
          :to="`/${l.code}/skill/${slug}`"
          class="item"
          :class="{ 'is-selected': l.code === current }"
          @click="pickLink(l.code)"
        >
          {{ l.native }}
        </RouterLink>
      </template>
      <template v-else>
        <button
          v-for="l in SKILL_LOCALES"
          :key="l.code"
          type="button"
          class="item"
          :class="{ 'is-selected': l.code === current }"
          @click="pickSelect(l.code)"
        >
          {{ l.native }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.locale-menu {
  position: relative;
  display: inline-block;
}

/* Mirrors the modal header's 32px translucent .button chrome. */
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  min-width: 32px;
  padding: 0 9px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
}

.trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.trigger.is-active {
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
  color: var(--color-accent-text);
}

.trigger-caret {
  font-size: 9px;
  opacity: 0.8;
}

/* The globe alone reads as a menu button on mobile. */
@media (max-width: 768px) {
  .trigger-caret {
    display: none;
  }
}

.panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  /* Content-sized: just wider than the longest native name, never narrower
     than the trigger. */
  width: max-content;
  min-width: 100%;
  /* Scrolls only past the viewport (usePanelFit). */
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  padding: 6px;
  background: #15171c;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  z-index: 20;
}

.item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-radius: 7px;
  background: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13.5px;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.item.is-selected {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

@media (max-width: 480px) {
  .trigger-label {
    display: none;
  }
}
</style>
