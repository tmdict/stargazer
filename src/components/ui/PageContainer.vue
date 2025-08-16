<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'
import IconClose from './IconClose.vue'

interface Props {
  maxWidth?: string
}

withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
})

const i18n = useI18nStore()

// Initialize i18n if not already initialized
i18n.initialize()
</script>

<template>
  <div class="page-overlay">
    <div class="page-container" :style="{ maxWidth }">
      <div class="page-buttons">
        <a href="/" class="page-close" :aria-label="i18n.t('app.home')" :title="i18n.t('app.home')">
          <IconClose />
        </a>
      </div>

      <div class="page-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 40px 20px;
}

.page-container {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
}

.page-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 1;
}

.page-close {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.page-content {
  padding: 24px 32px 32px 32px;
  color: #fff;
}

/* Typography styles for content */
.page-content :deep(h1) {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.page-content :deep(h2) {
  margin: 28px 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.page-content :deep(p) {
  margin: 12px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.page-content :deep(ul),
.page-content :deep(ol) {
  margin: 12px 0;
  padding-left: 20px;
}

.page-content :deep(li) {
  margin: 6px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.page-content :deep(ul ul) {
  margin-top: 8px;
  margin-bottom: 8px;
}

.page-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.page-content :deep(a:hover) {
  color: var(--color-danger);
  text-decoration: underline;
}

.page-content :deep(strong) {
  color: white;
  font-weight: 600;
}

@media (max-width: 768px) {
  .page-overlay {
    padding: 20px;
  }

  .page-container {
    max-width: 90% !important;
  }

  .page-content {
    padding: 24px;
    padding-top: 60px;
  }

  .page-content :deep(h1) {
    font-size: 22px;
  }

  .page-content :deep(h2) {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .page-overlay {
    padding: 15px;
  }

  .page-content {
    padding: 20px;
    padding-top: 56px;
  }

  .page-content :deep(h1) {
    font-size: 20px;
  }

  .page-content :deep(h2) {
    font-size: 16px;
  }
}
</style>
