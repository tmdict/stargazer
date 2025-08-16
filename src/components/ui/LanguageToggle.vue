<script setup lang="ts">
import { useI18nStore } from '../../stores/i18n'

const i18n = useI18nStore()
</script>

<template>
  <button
    @click="i18n.toggleLocale()"
    class="language-toggle"
    :aria-label="`Switch to ${i18n.currentLocale === 'en' ? 'Chinese' : 'English'}`"
  >
    <!-- Show Chinese icon when current locale is English (to switch to Chinese) -->
    <svg
      v-if="i18n.currentLocale === 'en'"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      class="language-icon"
    >
      <defs>
        <mask id="zh-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <text
            x="12"
            y="17"
            text-anchor="middle"
            fill="black"
            font-size="13"
            font-weight="900"
            font-family="system-ui, -apple-system, sans-serif"
          >
            中
          </text>
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" mask="url(#zh-mask)" />
    </svg>

    <!-- Show English icon when current locale is Chinese (to switch to English) -->
    <svg
      v-else
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      class="language-icon"
    >
      <defs>
        <mask id="en-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <text
            x="12"
            y="16.5"
            text-anchor="middle"
            fill="black"
            font-size="11"
            font-weight="900"
            font-family="system-ui, -apple-system, sans-serif"
          >
            EN
          </text>
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" mask="url(#en-mask)" />
    </svg>
  </button>
</template>

<style scoped>
.language-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.language-toggle:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.language-toggle:active {
  transform: scale(0.95);
}

.language-icon {
  width: 24px;
  height: 24px;
}

/* Animation for smooth icon transition */
.language-icon {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
