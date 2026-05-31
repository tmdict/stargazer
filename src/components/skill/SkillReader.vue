<script setup lang="ts">
import { computed } from 'vue'

import SkillSections from './SkillSections.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import { useI18nStore } from '@/stores/i18n'
import { hasSkillLocale } from '@/utils/dataLoader'

import '@/styles/content.css'

const props = defineProps<{
  slug: string | null
  lang: 'en' | 'zh'
}>()

const i18n = useI18nStore()

// hasSkillLocale also covers the null-selection case (the /skills index).
const visibleSlug = computed(() => (props.slug && hasSkillLocale(props.slug) ? props.slug : null))
</script>

<template>
  <!-- .container + .content from modal.css — visual match to SkillModal. -->
  <div class="container">
    <div class="content">
      <!-- :key remounts the chip strip on each hero (SkillSections caches activeChips). -->
      <SkillSections v-if="visibleSlug" :key="visibleSlug" :slug="visibleSlug" :lang />
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
