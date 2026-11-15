<script setup lang="ts">
/* Heroes of a charm popup, each a portrait over its name, with a thumbs up on
   the corner of a recommended one. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconThumbsUp from '@/components/ui/IconThumbsUp.vue'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { heroDisplayName } from '@/utils/skillLabels'

const { recommended = [] } = defineProps<{
  heroes: readonly string[]
  recommended?: readonly string[]
  // The language of the names, the popup's own.
  lang: SkillLocale
}>()

const i18n = useI18nStore()
</script>

<template>
  <!-- Not a ul: popup text styles dim every li, and these hold portraits. -->
  <div class="charm-heroes" role="list">
    <div v-for="slug in heroes" :key="slug" class="hero" role="listitem">
      <span class="portrait">
        <GuidePortrait :slug :lang="i18n.currentLocale" />
        <span
          v-if="recommended.includes(slug)"
          class="thumb"
          role="img"
          :title="i18n.t('app.recommended')"
          :aria-label="i18n.t('app.recommended')"
        >
          <IconThumbsUp :size="11" />
        </span>
      </span>
      <span class="name reading-meta">{{ heroDisplayName(slug, lang) }}</span>
    </div>
  </div>
</template>

<style scoped>
.charm-heroes {
  --size: 44px;
  --disc-ring: rgba(255, 255, 255, 0.25);
  display: flex;
  flex-wrap: wrap;
  gap: 12px 6px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 72px;
}

.portrait {
  position: relative;
  display: flex;
}

.thumb {
  position: absolute;
  top: -4px;
  right: -6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-round);
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 0 0 2px #1e1e1e;
}

.name {
  overflow-wrap: anywhere;
  line-height: 1.2;
  text-align: center;
}
</style>
