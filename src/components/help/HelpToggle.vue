<script setup lang="ts">
/* Look-only copy of GridControls' display toggle. `split` adds Grid Info's
   options caret; `menu` is the Format button, which has no tick. */

defineProps<{ label: string; on?: boolean; split?: boolean; menu?: boolean }>()
</script>

<template>
  <span class="help-toggle" :class="{ on }">
    <input v-if="!menu" type="checkbox" :checked="on" tabindex="-1" aria-hidden="true" />{{ label
    }}<span v-if="split" class="help-toggle-split">▾</span
    ><span v-else-if="menu" class="help-toggle-arrow">▾</span>
  </span>
</template>

<style scoped>
.help-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 3px 10px;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
}

.help-toggle input {
  width: 0.85rem;
  height: 0.85rem;
  margin: 0;
  accent-color: var(--color-primary);
  pointer-events: none;
}

.help-toggle-arrow {
  font-size: 0.6rem;
}

.help-toggle-split {
  display: inline-flex;
  align-self: stretch;
  align-items: center;
  margin: -3px -10px -3px 6px;
  padding: 0 7px;
  border-left: 2px solid var(--color-border-primary);
  font-size: 0.6rem;
}

@media (max-width: 768px) {
  .help-toggle-arrow {
    margin-left: 2px;
  }

  .help-toggle {
    gap: 0;
    padding: 4px 11px;
    border-width: 1px;
    border-radius: 999px;
    background: var(--color-bg-secondary);
    font-size: 0.78rem;
  }

  .help-toggle input {
    display: none;
  }

  .help-toggle.on {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }

  .help-toggle-split {
    margin: -4px -11px -4px 6px;
    border-left-width: 1px;
  }
}
</style>
