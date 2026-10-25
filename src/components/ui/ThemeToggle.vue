<script setup lang="ts">
import { ref } from 'vue'

import IconMoon from '@/components/ui/IconMoon.vue'
import IconSun from '@/components/ui/IconSun.vue'
import { useTheme } from '@/composables/useTheme'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { theme, toggle } = useTheme()

const pressed = ref(false)

const onClick = (): void => {
  pressed.value = true
  toggle()
}
</script>

<template>
  <!-- Both icons are rendered and [data-theme] shows one, so a pre-rendered
       page has the right icon in its first frame. -->
  <button
    type="button"
    class="theme-toggle"
    :class="{ pressed }"
    :title="i18n.t('app.dark-mode')"
    :aria-label="i18n.t('app.dark-mode')"
    :aria-pressed="theme === 'dark'"
    @click="onClick"
  >
    <IconMoon class="moon" aria-hidden="true" />
    <IconSun class="sun" aria-hidden="true" />
  </button>
</template>

<style scoped>
.moon {
  color: #72a6c0;
}

.sun {
  color: #f7d87c;
  display: none;
}

.theme-toggle:hover svg {
  color: #eee;
}

[data-theme='dark'] .moon {
  display: none;
}

[data-theme='dark'] .sun {
  display: block;
}

.pressed svg {
  animation: theme-toggle-spin 575ms cubic-bezier(0.075, 0.82, 0.17, 1.135);
}

@keyframes theme-toggle-spin {
  from {
    transform: scale(0) rotate(0deg);
  }

  to {
    transform: scale(1) rotate(-720deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pressed svg {
    animation: none;
  }
}
</style>
