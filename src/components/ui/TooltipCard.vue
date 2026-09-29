<script setup lang="ts">
/* Body of a detailed TooltipPopup for a hero, artifact or phantimal: a name,
   label/value rows, any extra lines from the slot, and a hint. Text size and
   colours come from TooltipPopup. */

defineProps<{
  name?: string
  rows?: { label: string; value: string | number; icon?: string; iconClass?: string }[]
  hint?: string
}>()
</script>

<template>
  <div v-if="name" class="tooltip-card-name">{{ name }}</div>
  <div v-if="rows?.length" class="tooltip-card-rows">
    <template v-for="row in rows" :key="row.label">
      <span class="tooltip-card-label">
        <img
          v-if="row.icon"
          :src="row.icon"
          alt=""
          class="tooltip-card-icon"
          :class="row.iconClass"
        />{{ row.label }}
      </span>
      <span class="tooltip-card-value">{{ row.value }}</span>
    </template>
  </div>
  <slot />
  <div v-if="hint" class="tooltip-card-hint">{{ hint }}</div>
</template>

<style scoped>
.tooltip-card-name {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tooltip-divider);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.tooltip-card-rows {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 6px 12px;
}

.tooltip-card-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tooltip-muted);
}

/* Labels without an icon line up with the ones that have one. */
.tooltip-card-rows:has(.tooltip-card-icon) .tooltip-card-label:not(:has(.tooltip-card-icon)) {
  padding-left: 28px;
}

.tooltip-card-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.tooltip-card-value {
  font-weight: 500;
  text-transform: capitalize;
}

.tooltip-card-hint {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--tooltip-divider);
  font-size: 12px;
  color: var(--tooltip-muted);
  text-align: center;
}
</style>
