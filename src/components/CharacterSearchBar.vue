<script setup lang="ts">
const query = defineModel<string>({ required: true })

defineProps<{
  placeholder: string
  /** Result count shown beside the input; null hides it. */
  count?: number | null
  countLabel?: string
}>()
</script>

<template>
  <!-- type="search" for the native WebKit clear button. -->
  <div class="search-row">
    <input v-model="query" type="search" class="search-input" :placeholder />
    <span v-if="count != null" class="search-count">{{ count }} {{ countLabel }}</span>
  </div>
</template>

<style scoped>
.search-row {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  align-items: center;
  /* Clear the panel's scrollbar on desktop (mobile sets its own inset below). */
  padding-right: var(--spacing-lg);
}

.search-input {
  flex: 1;
  min-width: 240px;
  max-width: 640px;
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-size: 1rem;
  /* Soft corners + faint inset + muted text; full-weight border keeps the edge clear. */
  color: #5a5a5a;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.65;
}

/* WebKit-only: Firefox has no styleable pseudo for the clear glyph. */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  width: 14px;
  margin-left: 4px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23666' stroke-width='1.4' stroke-linecap='round'><path d='M2 2 L10 10 M10 2 L2 10'/></svg>")
    no-repeat center / 12px 12px;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 120ms ease;
}

.search-input::-webkit-search-cancel-button:hover {
  opacity: 1;
}

.search-count {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  white-space: nowrap;
}

/* In the mobile roster sheet the panel goes edge-to-edge; keep a horizontal
   inset so the input isn't flush against the sheet edges. */
@media (max-width: 768px) {
  .search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .search-input {
    min-width: 0;
    max-width: none;
  }
}

@media (max-width: 480px) {
  .search-row {
    padding: var(--spacing-sm) var(--spacing-sm) 0;
  }
}
</style>
