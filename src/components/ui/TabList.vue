<script lang="ts">
// `key` is also the content slot name TabView renders for this tab.
export interface TabItem {
  key: string
  label: string
  badge?: number | string
  hideMobile?: boolean
}
</script>

<script setup lang="ts" generic="T extends string">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

const { tabs, ariaId } = defineProps<{
  tabs: TabItem[]
  // Prefix linking each tab button to its TabView pane (aria-controls).
  ariaId?: string
}>()

const active = defineModel<T>({ required: true })

const showStrip = computed(() => tabs.length > 1)

// A strip whose hideMobile tabs leave at most one visible button is pure chrome
// on mobile; hide it entirely there (CSS, so SSG markup stays viewport-agnostic).
const stripHiddenOnMobile = computed(() => tabs.filter((t) => !t.hideMobile).length <= 1)

// Keys come from the host's own tabs array, so they satisfy the host's model type.
const select = (tab: TabItem) => {
  active.value = tab.key as T
}

// hideMobile hides a tab's button with CSS, but the ACTIVE tab must never be a
// hidden one (no highlighted button, and its pane would stay live); when the
// viewport crosses into mobile, fall back to the first visible tab.
const isMobile = ref(false)
let mq: MediaQueryList | undefined
const syncMobile = () => {
  isMobile.value = mq?.matches ?? false
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  syncMobile()
  mq.addEventListener('change', syncMobile)
})
onUnmounted(() => mq?.removeEventListener('change', syncMobile))
watchEffect(() => {
  if (!isMobile.value) return
  if (!tabs.find((t) => t.key === active.value)?.hideMobile) return
  const fallback = tabs.find((t) => !t.hideMobile)
  if (fallback) select(fallback)
})
</script>

<template>
  <div v-if="showStrip" class="tab-bar" :class="{ 'mobile-hidden': stripHiddenOnMobile }">
    <div class="tab-buttons" role="tablist">
      <button
        v-for="tab in tabs"
        :id="ariaId ? `${ariaId}-tab-${tab.key}` : undefined"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="active === tab.key"
        :aria-controls="ariaId ? `${ariaId}-panel-${tab.key}` : undefined"
        :class="['tab-btn', { active: active === tab.key, 'hide-mobile': tab.hideMobile }]"
        @click="select(tab)"
      >
        {{ tab.label }}
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>
    <div v-if="$slots.actions" class="tab-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* Two distinct looks by width: underline on desktop, a boxed bar on mobile.
   .tab-bar holds the tablist plus an optional trailing actions slot. */
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
  gap: var(--spacing-xs);
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

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
}

@media (min-width: 769px) {
  /* Baseline the active ink-bar sits on; spans the full strip incl. the actions slot. */
  .tab-bar {
    padding: 0 var(--spacing-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .tab-buttons {
    gap: var(--spacing-lg);
  }

  .tab-btn {
    /* Transparent bar reserves the active height (no shift on select); -1px
       lands the active bar on the strip's baseline. */
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
    /* Bottom < top to optically center the label over the ink-bar. */
    padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
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
    margin-left: auto;
    align-self: center;
  }
}

@media (max-width: 768px) {
  .hide-mobile,
  .tab-bar.mobile-hidden {
    display: none;
  }

  .tab-buttons {
    flex: 1 1 auto;
    gap: 0;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-primary);
    border-bottom: none;
    border-radius: var(--radius-large) var(--radius-large) 0 0;
  }

  .tab-btn {
    flex: 1 1 auto;
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
    border-top-left-radius: var(--radius-large);
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
  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    min-width: 80px;
  }
}
</style>
