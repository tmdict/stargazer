<script setup lang="ts">
import { computed } from 'vue'

import SkillSections from './SkillSections.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useI18nStore } from '@/stores/i18n'
import { useSkillsStore } from '@/stores/skills'
import { hasSkillLocale } from '@/utils/dataLoader'

import '@/styles/modal.css'

const skillsStore = useSkillsStore()
const i18n = useI18nStore()

const lang = computed<'en' | 'zh'>(() => (i18n.currentLocale === 'zh' ? 'zh' : 'en'))

// hasSkillLocale also covers the null-selection case.
const visibleSlug = computed(() => {
  const slug = skillsStore.selectedSlug
  return slug && hasSkillLocale(slug) ? slug : null
})

const linkHref = computed(() =>
  visibleSlug.value ? `/${lang.value}/skill/${visibleSlug.value}` : '',
)
</script>

<template>
  <!-- .container + .content from modal.css — visual match to SkillModal / SkillView. -->
  <div class="container">
    <div v-if="visibleSlug" class="buttons">
      <a
        :href="linkHref"
        class="button"
        :aria-label="i18n.t('app.link')"
        :title="i18n.t('app.link')"
      >
        <IconLink :size="16" />
      </a>
    </div>
    <div class="content">
      <!-- :key remounts the chip strip on each hero (SkillSections caches activeChips). -->
      <SkillSections v-if="visibleSlug" :key="visibleSlug" :slug="visibleSlug" :lang="lang" />
      <div v-else class="empty-state">
        <IconInfo :size="40" class="empty-icon" />
        <p class="empty-tip">{{ i18n.t('app.skill-empty-hint') }}</p>
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
  font-size: 0.95rem;
  max-width: 320px;
}

/* Edge-to-edge on small screens, matching the grid section's responsive
   chrome. Overrides modal.css's `max-width: 90% !important`. */
@media (max-width: 768px) {
  .container {
    max-width: 100% !important;
  }
}
@media (max-width: 480px) {
  .container {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
}
</style>
