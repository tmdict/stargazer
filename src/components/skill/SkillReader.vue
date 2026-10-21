<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import SkillSections from './SkillSections.vue'
import IconGlobe from '@/components/ui/IconGlobe.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { useRecentHeroes } from '@/composables/useRecentHeroes'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { hasSkillLocale } from '@/utils/dataLoader'

import '@/styles/content.css'

const props = defineProps<{
  slug: string | null
  lang: SkillLocale
}>()

// Tapping the empty placeholder reveals the hero list (the mobile sheet); the
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
  (picked) => {
    if (picked && showLocaleHint.value) dismissLocaleHint()
  },
)
</script>

<template>
  <!-- .container + .content from content.css: visual match to SkillModal. -->
  <div class="container page-panel">
    <div class="content">
      <NoticeBanner
        v-if="visibleSlug && showLocaleHint"
        dark
        :icon="IconGlobe"
        :message="i18n.t('app.skill-locale-hint')"
        @dismiss="dismissLocaleHint"
      />
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
/* content.css centers .container with `margin: auto`, which would
   vertically center the panel in its flex slot. */
.container {
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

@media (max-width: 768px) {
  .empty-state {
    cursor: pointer;
  }
}
</style>
