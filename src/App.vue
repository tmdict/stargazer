<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import DragPreview from '@/components/DragPreview.vue'
import AboutModal from '@/components/modals/AboutModal.vue'
import IconGitHub from '@/components/ui/IconGitHub.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import rowanGif from '@/assets/rowan.gif'
import rowanSvg from '@/assets/rowan.svg'
import { useI18nStore } from '@/stores/i18n'

const isLogoHovered = ref(false)
const showAboutModal = ref(false)
const i18n = useI18nStore()
const route = useRoute()

// Header renders on every route; init here so SSG-only routes whose views
// don't call initialize (about, skill/*) still get translations. Idempotent.
i18n.initialize()

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

      <div class="nav-right">
        <a href="/skills" class="nav-text-link" :class="{ active: route.path === '/skills' }">{{
          i18n.t('app.skills')
        }}</a>
        <a href="/wandwars" class="nav-text-link" :class="{ active: route.path === '/wandwars' }">{{
          i18n.t('wandwars.wand-wars')
        }}</a>
        <ul class="menu">
          <li>
            <LanguageToggle class="icon-link" />
          </li>
          <li>
            <a
              href="https://github.com/tmdict/stargazer/"
              class="icon-link"
              :title="i18n.t('app.code')"
            >
              <IconGitHub />
            </a>
          </li>
          <li>
            <button
              @click="showAboutModal = true"
              class="icon-link icon-button"
              :title="i18n.t('app.about')"
            >
              <IconInfo />
            </button>
          </li>
        </ul>
      </div>
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

.nav-right {
  display: flex;
  align-items: center;
}

.nav-text-link {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ddd;
  text-decoration: none;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  margin-bottom: 0.2rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
}

/* Space between consecutive pills. */
.nav-text-link + .nav-text-link {
  margin-left: 1.5rem;
}

/* Tuck the last pill close to the menu icons. */
.nav-text-link:last-of-type {
  margin-right: -0.8rem;
}

.nav-text-link:hover {
  color: #f7d87c;
  background: rgba(255, 255, 255, 0.18);
}

.nav-text-link.active {
  color: #f7d87c;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

  .menu {
    margin-bottom: -0.5rem;
  }

  .menu a,
  .menu button {
    font-size: 1rem;
    padding: 0.5rem;
    margin-left: 0.7rem;
  }

  .nav-text-link {
    font-size: 0.75rem;
    padding: 3px 8px;
    margin-bottom: -0.75rem;
  }
  .nav-text-link + .nav-text-link {
    margin-left: 0.6rem;
  }
  .nav-text-link:last-of-type {
    margin-right: 0;
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
    margin-bottom: -0.3rem;
    padding-bottom: 0;
  }

  .menu a,
  .menu button {
    font-size: 0.9rem;
    padding: 0;
    margin-left: 0.5rem;
  }

  .logo {
    height: 55px;
  }

  .logo:hover {
    transform: scale(1.1);
  }

  .nav-text-link {
    font-size: 0.65rem;
    padding: 2px 6px;
    margin-bottom: -0.1rem;
  }
  .nav-text-link + .nav-text-link {
    margin-left: 0.4rem;
  }
  .nav-text-link:last-of-type {
    margin-right: -0.1rem;
  }
}
</style>
