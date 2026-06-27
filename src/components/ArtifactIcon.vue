<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactImage from './ArtifactImage.vue'
import ArtifactTooltip from './ArtifactTooltip.vue'
import ArtifactModal from './modals/ArtifactModal.vue'
import InfoPill from './ui/InfoPill.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const i18n = useI18nStore()

const props = defineProps<{
  artifact: ArtifactType
  isPlaced?: boolean
  showSimpleTooltip?: boolean
}>()

const emit = defineEmits<{
  artifactClick: [artifact: ArtifactType]
}>()

const { showTooltip, onMouseEnter, onMouseLeave, onTouchStart } = useHoverTooltip()

const artifactElement = ref<HTMLElement>()

const formattedArtifactName = computed(() =>
  localizedDisplayName(i18n.t, 'artifact', props.artifact.name),
)

// Effects live in a popup modal (info button), not the hover tooltip.
const showInfoModal = ref(false)
const openInfoModal = () => {
  showInfoModal.value = true
}

const handleClick = () => {
  emit('artifactClick', props.artifact)
}
</script>

<template>
  <div class="artifact-wrapper">
    <div
      ref="artifactElement"
      class="artifact"
      :class="{ placed: isPlaced }"
      @click="handleClick"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchStart"
    >
      <ArtifactImage :artifact />
    </div>

    <InfoPill :label="formattedArtifactName" @click="openInfoModal" />

    <ArtifactModal :show="showInfoModal" :artifact @close="showInfoModal = false" />

    <ArtifactTooltip
      v-if="showTooltip && artifactElement"
      :artifact
      :target-element="artifactElement"
      :variant="showSimpleTooltip ? 'simple' : 'detailed'"
    />
  </div>
</template>

<style scoped>
/* Center the icon and the (wider, name-bearing) info pill on one column. */
.artifact-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.artifact {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-round);
  border: 2px solid var(--color-bg-white);
  /* White backing for every season (icons may have transparency). */
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--color-bg-white);
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  margin-top: var(--spacing-xs);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.artifact::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-round);
  background: #fff4;
}

.artifact:hover {
  transform: scale(1.05);
}

/* Placed on either team: desaturate + dim the fill like the character roster,
   keeping the white border/ring. */
.artifact.placed {
  filter: var(--placed-filter);
}
.artifact.placed::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: var(--placed-overlay);
  pointer-events: none;
}
</style>
