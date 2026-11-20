<script lang="ts">
// `key` is also the content slot name TabView renders for this tab.
export interface TabItem {
  key: string
  label: string
  // Replaces `label` where the strip is tight: on mobile, where a full strip must
  // fit the sheet's width, and in a wide-screen strip too narrow for the labels.
  shortLabel?: string
  badge?: number | string
}
</script>

<script setup lang="ts" generic="T extends string">
import { computed, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'

const { tabs, ariaId } = defineProps<{
  tabs: TabItem[]
  // Prefix linking each tab button to its TabView pane (aria-controls).
  ariaId?: string
}>()

const active = defineModel<T>({ required: true })

const showStrip = computed(() => tabs.length > 1)

// Keys come from the host's own tabs array, so they satisfy the host's model type.
const select = (tab: TabItem) => {
  active.value = tab.key as T
}

// A wide-screen strip too narrow for its tabs scrolls sideways and shows no
// scrollbar, so the open tab is brought back into sight whenever it may have
// left: a tab opened by a link may be the last in the strip, and a narrowing
// window cuts the strip short.
const strip = useTemplateRef<HTMLElement>('strip')
const revealActive = () => {
  const tab = strip.value?.querySelector('.tab-btn.active')
  if (!strip.value || !tab) return
  const box = strip.value.getBoundingClientRect()
  const at = tab.getBoundingClientRect()
  if (at.left < box.left) strip.value.scrollLeft += at.left - box.left
  else if (at.right > box.right) strip.value.scrollLeft += at.right - box.right
}
let observer: ResizeObserver | undefined
onMounted(() => {
  revealActive()
  if (typeof ResizeObserver === 'undefined' || !strip.value) return
  observer = new ResizeObserver(revealActive)
  observer.observe(strip.value)
})
onUnmounted(() => observer?.disconnect())
watch([active, () => tabs.length], revealActive, { flush: 'post' })
</script>

<template>
  <div v-if="showStrip" class="tab-bar">
    <div ref="strip" class="tab-buttons" role="tablist">
      <template v-for="(tab, index) in tabs" :key="tab.key">
        <span v-if="index" class="tab-gap" role="presentation" />
        <button
          :id="ariaId ? `${ariaId}-tab-${tab.key}` : undefined"
          type="button"
          role="tab"
          :aria-selected="active === tab.key"
          :aria-controls="ariaId ? `${ariaId}-panel-${tab.key}` : undefined"
          :class="['tab-btn', { active: active === tab.key }]"
          @click="select(tab)"
        >
          <span :class="{ 'tab-label-long': tab.shortLabel }">{{ tab.label }}</span>
          <span v-if="tab.shortLabel" class="tab-label-short">{{ tab.shortLabel }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </button>
      </template>
    </div>
    <div v-if="$slots.actions" class="tab-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-buttons {
  display: flex;
  flex-wrap: wrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  cursor: pointer;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--tab-font-size);
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.tab-label-short {
  display: none;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: var(--spacing-xs);
  padding: 0 4px;
  border-radius: 9px;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
}

@media (min-width: 769px) {
  .tab-bar {
    flex-wrap: nowrap;
    padding: 0 var(--spacing-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .tab-buttons {
    flex: 1 1 0;
    flex-wrap: nowrap;
    min-width: 0;
    margin-bottom: -1px;
    overflow-x: auto;
    scrollbar-width: none;
    container-type: inline-size;
  }

  .tab-buttons::-webkit-scrollbar {
    display: none;
  }

  .tab-gap {
    flex: 0 1000 auto;
    width: var(--spacing-lg);
  }

  .tab-btn {
    flex: 0 1 auto;
    display: inline-grid;
    grid-template-columns: minmax(9px, var(--spacing-lg)) auto auto minmax(9px, var(--spacing-lg));
    border-bottom: 2.5px solid transparent;
    padding: var(--spacing-lg) 0 var(--spacing-md);
    white-space: nowrap;
  }

  .tab-btn > span {
    grid-area: 1 / 2;
  }

  .tab-btn > .tab-badge {
    grid-column: 3;
  }

  .tab-btn:focus-visible {
    outline-offset: -2px;
  }

  .tab-btn:hover:not(.active) {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-border-primary);
  }

  .tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-actions {
    flex: none;
    align-self: center;
  }

  @container (max-width: 558px) {
    .tab-label-long {
      display: none;
    }

    .tab-label-short {
      display: inline;
    }
  }
}

@media (max-width: 768px) {
  .tab-bar {
    overflow-x: clip;
  }

  .tab-gap {
    display: none;
  }

  .tab-label-long {
    display: none;
  }

  .tab-label-short {
    display: inline;
  }

  .tab-buttons {
    flex: 1 1 auto;
    gap: 0;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-primary);
    border-inline-width: var(--tabview-side-border, 2px);
    border-bottom: none;
    border-radius: var(--tabview-radius, var(--radius-large))
      var(--tabview-radius, var(--radius-large)) 0 0;
  }

  .tab-btn {
    flex: 1 1 var(--tabview-tab-basis, auto);
    min-width: 100px;
    justify-content: center;
    margin: 0 -1px -1px 0;
    padding: var(--spacing-sm) var(--spacing-lg);
    line-height: 1.2;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    position: relative;
  }

  .tab-btn:first-child {
    border-top-left-radius: var(--tabview-radius, var(--radius-large));
  }

  .tab-btn:hover:not(.active) {
    background: var(--color-bg-tertiary);
    color: var(--color-primary);
  }

  .tab-btn.active {
    background: var(--color-bg-primary);
    color: var(--color-primary);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-primary);
  }
}

@media (max-width: 480px) {
  .tab-buttons {
    flex-wrap: nowrap;
    min-width: 0;
  }

  .tab-btn {
    min-width: 0;
    padding: var(--spacing-sm) 6px;
    letter-spacing: 0.03em;
  }
}
</style>
