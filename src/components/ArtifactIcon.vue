<script setup lang="ts">
import { ref } from 'vue'

import ArtifactImage from './ArtifactImage.vue'
import ArtifactTooltip from './ArtifactTooltip.vue'
import HoldRing from './ui/HoldRing.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

defineProps<{
  artifact: ArtifactType
  isPlaced?: boolean
  showSimpleTooltip?: boolean
  // Right-click or hold opens the artifact's details, as on the board (the
  // Seasonal tab).
  inspectable?: boolean
}>()

const emit = defineEmits<{
  artifactClick: [artifact: ArtifactType]
}>()

const { showTooltip, onMouseEnter, onMouseLeave, onTouchStart } = useHoverTooltip()

const artifactElement = ref<HTMLElement>()

const { inspect } = useInspect()
const {
  pressing,
  start: startHold,
  onContextMenu,
} = useLongPress<ArtifactType>((artifact) => {
  showTooltip.value = false
  void inspect({ kind: 'artifact', artifact })
})
</script>

<template>
  <!-- The frame holds the hold ring outside the icon's clipped circle. -->
  <div class="artifact-frame">
    <div
      ref="artifactElement"
      class="artifact"
      :class="{ placed: isPlaced, inspectable }"
      @click="emit('artifactClick', artifact)"
      @pointerdown="inspectable && startHold($event, artifact)"
      @contextmenu="inspectable && onContextMenu($event, artifact)"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchStart"
    >
      <ArtifactImage :artifact />
    </div>
    <HoldRing v-if="pressing" />

    <ArtifactTooltip
      v-if="showTooltip && artifactElement"
      :artifact
      :target-element="artifactElement"
      :variant="showSimpleTooltip ? 'simple' : 'detailed'"
      :hint="inspectable ? i18n.t('app.hold-for-details') : undefined"
    />
  </div>
</template>

<style scoped>
.artifact-frame {
  position: relative;
  width: fit-content;
  margin-top: var(--spacing-xs);
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
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

/* A long-press is the inspect gesture: iOS would otherwise answer it with the
   image callout, and every touch browser with text selection. */
.artifact.inspectable {
  -webkit-touch-callout: none;
  user-select: none;
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

/* Placed on either team: desaturate + dim the fill like the character picker,
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
