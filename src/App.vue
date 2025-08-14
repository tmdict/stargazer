<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import rowanSvg from '@/assets/rowan.svg'
import rowanGif from '@/assets/rowan.gif'
import { useI18nStore } from './stores/i18n'
import AboutModal from './components/AboutModal.vue'
import DragPreview from './components/DragPreview.vue'
import GitHubIcon from './components/GitHubIcon.vue'
import InfoIcon from './components/InfoIcon.vue'
import LanguageToggle from './components/LanguageToggle.vue'

const isLogoHovered = ref(false)
const showAboutModal = ref(false)
const i18n = useI18nStore()

// Keyboard shortcut handler
const handleKeyDown = (e: KeyboardEvent) => {
  // Alt+L to toggle language
  if (e.altKey && e.key === 'l') {
    e.preventDefault()
    i18n.toggleLocale()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <header>
    <nav>
      <a
        href="/"
        class="logo-link"
        @mouseenter="isLogoHovered = true"
        @mouseleave="isLogoHovered = false"
      >
        <img alt="logo" class="logo" :src="isLogoHovered ? rowanGif : rowanSvg" />
      </a>

      <ul class="menu">
        <li>
          <LanguageToggle class="icon-link" />
        </li>
        <li>
          <a href="https://github.com/tmdict/stargazer/" class="icon-link" :title="i18n.t('app.code')">
            <GitHubIcon />
          </a>
        </li>
        <li>
          <button @click="showAboutModal = true" class="icon-link icon-button" :title="i18n.t('app.about')">
            <InfoIcon />
          </button>
        </li>
      </ul>
    </nav>
  </header>

  <RouterView />

  <!-- Global drag preview -->
  <DragPreview />

  <!-- About modal -->
  <AboutModal :show="showAboutModal" @close="showAboutModal = false" />
</template>

<style scoped>
header {
  background-color: #282c34;
  border-bottom: 3px solid #f7d87c;
  padding: 0.5rem 0;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  max-width: none;
  margin: 0;
  padding: 0 2.5em 0 2em;
}

nav ul {
  margin-bottom: 0;
}

nav ul li {
  margin-bottom: 0;
}

.logo-link {
  display: inline-block;
  line-height: 0;
}

.logo {
  height: 70px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.logo:hover {
  transform: scale(1.25);
}

.menu {
  display: flex;
  list-style: none;
  align-items: center;
}

.menu a,
.menu button {
  color: #ddd;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 600;
  margin-left: 1.5rem;
  border-radius: 6px;
}

.menu a:hover,
.menu button:hover {
  color: #f7d87c;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: -5px;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

@media (max-width: 768px) {
  nav {
    padding: 0 1.5em 0 1em;
  }

  .logo {
    height: 50px;
  }

  .menu a,
  .menu button {
    font-size: 1rem;
    padding: 0.5rem;
  }
}

@media (max-width: 480px) {
  header {
    padding: 0.25rem 0;
  }

  nav {
    padding: 0.5rem 1rem 0;
  }

  .menu {
    flex-direction: row;
    gap: 0.5rem;
    margin: 0;
    padding-bottom: 0;
  }

  .menu a,
  .menu button {
    font-size: 0.9rem;
    padding: 0;
  }

  .logo {
    height: 55px;
  }

  .logo:hover {
    transform: scale(1.1);
  }
}
</style>
