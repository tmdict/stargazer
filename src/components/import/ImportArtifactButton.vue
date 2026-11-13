<script setup lang="ts">
/* A side's artifact in an import review: the badge as the reader located it,
   then the artifact it is taken for on a button that opens the artifact
   picker. What the review says about it (its state, its tags) goes in the
   default slot. */

import ArtifactImage from '@/components/ArtifactImage.vue'
import type { ArtifactType } from '@/lib/types/artifact'

defineProps<{
  label?: string
  // The badge crop; absent when the reader located none.
  card?: string
  artifact: ArtifactType | null
  name: string
  unsure?: boolean
  unrecognised?: boolean
  open: boolean
  compact?: boolean
}>()

const emit = defineEmits<{ pick: [event: MouseEvent] }>()
</script>

<template>
  <span class="artifact" :class="{ compact }">
    <span v-if="label">{{ label }}</span>
    <img v-if="card !== undefined" class="artifact-card" :src="card" alt="" />
    <button
      type="button"
      class="artifact-btn"
      :class="{ unsure, unrecognised, open }"
      :title="name"
      @click="emit('pick', $event)"
    >
      <span class="artifact-icon" :class="{ empty: artifact === null }">
        <ArtifactImage v-if="artifact" :artifact decorative />
      </span>
      <span class="artifact-name">{{ name }}</span>
    </button>
    <slot />
  </span>
</template>

<style scoped>
.artifact {
  --artifact-card-size: 52px;
  --artifact-icon-size: 40px;
  margin-left: auto;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--import-text-dim);
}

.artifact.compact {
  --artifact-card-size: 44px;
  --artifact-icon-size: 32px;
}

.artifact-card {
  width: var(--artifact-card-size);
  height: var(--artifact-card-size);
  flex-shrink: 0;
  object-fit: cover;
  border-radius: var(--radius-medium);
}

.artifact-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;
  min-width: 0;
  padding: 3px 8px 3px 3px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.artifact-btn:hover,
.artifact-btn:focus-visible,
.artifact-btn.open {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.artifact-btn.unsure {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
}

.artifact-btn.unrecognised {
  border-style: dashed;
  color: var(--import-text-dim);
}

.artifact-icon {
  position: relative;
  flex-shrink: 0;
  width: var(--artifact-icon-size);
  height: var(--artifact-icon-size);
  border-radius: 50%;
  overflow: hidden;
  background: #fff;
}

.artifact-icon.empty {
  background: rgba(255, 255, 255, 0.12);
}

.artifact-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
