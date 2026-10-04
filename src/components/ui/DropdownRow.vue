<script setup lang="ts">
/* One row of a dropdown's list: a label and an optional trailing detail such
   as a count. A button, or a link when it has somewhere to go. Every
   DropdownSelect list is built from these, so their rows cannot differ. */

import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  label: string
  meta?: string | number
  selected?: boolean
  // Nested under the row above it.
  sub?: boolean
  // Does something other than choose (Manage, a link); set apart by a rule.
  action?: boolean
  to?: RouteLocationRaw
}>()
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to
    :type="to ? undefined : 'button'"
    class="row"
    :class="{ selected, sub, action }"
  >
    <span class="label">{{ label }}</span>
    <span v-if="meta !== undefined" class="meta">{{ meta }}</span>
  </component>
</template>

<style scoped>
.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-lg);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.row:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.row.selected {
  background: var(--color-primary);
  color: #fff;
}

.row:disabled {
  opacity: 0.4;
  cursor: default;
}

.row:disabled:hover {
  background: transparent;
  color: var(--color-text-secondary);
}

.row.action {
  border-top: 1px solid var(--color-border-light);
  color: var(--color-primary);
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  padding-left: calc(var(--spacing-lg) + var(--dropdown-sub-indent));
}

.sub .label::before {
  content: '↳';
  margin-right: 6px;
  opacity: 0.55;
}

.meta {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
</style>
