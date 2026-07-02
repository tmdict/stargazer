<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import SkillSections from './SkillSections.vue'
import IconGlobe from '@/components/ui/IconGlobe.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import { useRecentHeroes } from '@/composables/useRecentHeroes'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { hasSkillLocale } from '@/utils/dataLoader'

import '@/styles/content.css'

const props = defineProps<{
  slug: string | null
  lang: SkillLocale
}>()

// Tapping the empty placeholder reveals the roster (the mobile sheet); the
// parent decides what that means.
const emit = defineEmits<{ emptyClick: [] }>()

const i18n = useI18nStore()

// hasSkillLocale also covers the null-selection case (the /skills index).
const visibleSlug = computed(() => (props.slug && hasSkillLocale(props.slug) ? props.slug : null))

// Feeds the search overlay's empty state. Post-mount: SSG must not record.
const { record: recordRecentHero } = useRecentHeroes()
onMounted(() => {
  watch(visibleSlug, (slug) => slug && recordRecentHero(slug), { immediate: true })
})

// Remount per hero AND per text locale: SkillSections writes head meta and
// the html-lang override in setup, so a locale switch must re-run it.
const sectionsKey = computed(() => `${visibleSlug.value}:${props.lang}`)

// One-time tip that skill text has more languages than the site. Read
// post-mount so the baked HTML (which has no hint) hydrates unchanged.
const HINT_SEEN_KEY = 'stargazer.skillLocaleHintSeen'
const showLocaleHint = ref(false)
onMounted(() => {
  try {
    showLocaleHint.value = !localStorage.getItem(HINT_SEEN_KEY)
  } catch {
    // localStorage unavailable: hint stays hidden rather than nagging forever
  }
})
const dismissLocaleHint = () => {
  showLocaleHint.value = false
  try {
    localStorage.setItem(HINT_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}

// A globe pick proves the feature is discovered, which is all the hint
// teaches; treat it as a dismissal.
watch(
  () => i18n.skillLocale,
  () => {
    if (showLocaleHint.value) dismissLocaleHint()
  },
)
</script>

<template>
  <!-- .container + .content from content.css: visual match to SkillModal. -->
  <div class="container">
    <div class="content">
      <!-- Chrome-language sentence inside the content region: own lang. -->
      <div v-if="visibleSlug && showLocaleHint" class="locale-hint" :lang="i18n.currentLocale">
        <IconGlobe :size="15" class="locale-hint-icon" aria-hidden="true" />
        <span>{{ i18n.t('app.skill-locale-hint') }}</span>
        <button
          type="button"
          class="locale-hint-dismiss"
          aria-label="Close"
          @click="dismissLocaleHint"
        >
          ✕
        </button>
      </div>
      <SkillSections v-if="visibleSlug" :key="sectionsKey" :slug="visibleSlug" :lang />
      <div v-else class="empty-state" @click="emit('emptyClick')">
        <IconInfo :size="40" class="empty-icon" />
        <p class="empty-tip">{{ i18n.t('app.skill-empty-hint') }}</p>
        <!-- Permanent counterpart of the locale-hint banner: states the fact
             without naming the globe menu, which isn't on screen here. -->
        <p class="empty-locale">
          <IconGlobe :size="14" aria-hidden="true" />
          {{ i18n.t('app.skill-locale-empty') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slightly lighter than modal.css's default so the inline panel reads as a
   distinct surface from the popup modal. `margin: 0` overrides the modal-
   context `margin: auto`, which would otherwise vertical-center the panel
   inside its flex slot. */
.container {
  background: #262626;
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 540px;
  padding-top: var(--spacing-2xl);
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: var(--spacing-md);
}

.empty-tip {
  margin: 0;
  font-size: 1rem;
  max-width: 320px;
}

.empty-locale {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: var(--spacing-sm) 0 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.4);
}

.locale-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  border-radius: var(--radius-medium);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-accent-text);
  font-size: 12.5px;
}

.locale-hint-icon {
  flex-shrink: 0;
}

.locale-hint-dismiss {
  margin-left: auto;
  padding: 0 2px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.locale-hint-dismiss:hover {
  color: rgba(255, 255, 255, 0.9);
}

/* Mobile: drop the modal card chrome (border, shadow, large radius) so the
   reader fills the width edge-to-edge like the grid page's panel, and tighten
   the prose inset so it doesn't waste horizontal space. Mirrors `.section`'s
   responsive chrome (radius-medium at ≤768, flat at ≤480). Overrides
   content.css's `max-width: 90% !important` and the card border/shadow. */
@media (max-width: 768px) {
  .container {
    max-width: 100% !important;
    border: none;
    box-shadow: none;
    border-radius: var(--radius-medium);
  }
  .content {
    padding: var(--spacing-lg);
  }
  /* On mobile the empty placeholder is a tap target that reveals the roster. */
  .empty-state {
    cursor: pointer;
  }
}
@media (max-width: 480px) {
  .container {
    border-radius: 0;
  }
  .content {
    padding: var(--spacing-md);
  }
}
</style>
