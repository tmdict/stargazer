<script setup lang="ts">
import { computed, ref } from 'vue'

import PhantimalModal from './modals/PhantimalModal.vue'
import InfoPill from './ui/InfoPill.vue'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useI18nStore } from '@/stores/i18n'
import { phantimalImageSources } from '@/utils/artifactImage'

const props = defineProps<{
  phantimals: readonly PhantimalType[]
}>()

const i18n = useI18nStore()

const sorted = computed(() => [...props.phantimals].sort((a, b) => a.id - b.id))

// "Season 7 Phantimals" — season number comes from the data.
const heading = computed(() => {
  const season = sorted.value[0]?.season ?? 0
  return `${i18n.t('game.season')} ${season} ${i18n.t('game.phantimal')}`
})

const selected = ref<PhantimalType | null>(null)
const showModal = ref(false)
const openModal = (phantimal: PhantimalType) => {
  selected.value = phantimal
  showModal.value = true
}
</script>

<template>
  <section v-if="sorted.length" class="phantimal-section">
    <h3 class="phantimal-section-title">{{ heading }}</h3>
    <div class="phantimals">
      <div v-for="phantimal in sorted" :key="phantimal.id" class="phantimal-profile">
        <button type="button" class="phantimal" @click="openModal(phantimal)">
          <picture class="portrait-pic">
            <source :srcset="phantimalImageSources(phantimal.name).avif" type="image/avif" />
            <source :srcset="phantimalImageSources(phantimal.name).webp" type="image/webp" />
            <img
              :src="phantimalImageSources(phantimal.name).png"
              :alt="phantimal.name"
              class="portrait"
              loading="lazy"
            />
          </picture>
        </button>
        <InfoPill :label="i18n.t(`game.${phantimal.faction}`)" @click="openModal(phantimal)" />
      </div>
    </div>

    <PhantimalModal
      v-if="selected"
      :show="showModal"
      :phantimal="selected"
      @close="showModal = false"
    />
  </section>
</template>

<style scoped>
.phantimal-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.phantimal-section-title {
  margin: 0;
  padding: 0 var(--spacing-lg);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary, var(--color-text-primary));
}

.phantimals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  justify-content: flex-start;
  padding: var(--spacing-lg);
}

.phantimal-profile {
  text-align: center;
  margin-top: var(--spacing-xs);
}

.phantimal {
  width: 70px;
  height: 70px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-white);
  background: #fff;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--color-bg-white);
  padding: 0;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.phantimal:hover {
  transform: scale(1.05);
}

/* display: contents so the <picture> doesn't add a box around the image. */
.portrait-pic {
  display: contents;
}

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
