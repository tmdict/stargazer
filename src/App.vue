<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import rowanSvg from '@/assets/rowan.svg'
import rowanGif from '@/assets/rowan.gif'
import DragPreview from './components/DragPreview.vue'

const isLogoHovered = ref(false)
</script>

<template>
  <header>
    <nav>
      <RouterLink
        to="/"
        class="logo-link"
        @mouseenter="isLogoHovered = true"
        @mouseleave="isLogoHovered = false"
      >
        <img alt="logo" class="logo" :src="isLogoHovered ? rowanGif : rowanSvg" />
      </RouterLink>

      <ul class="menu">
        <li><RouterLink to="/about">About</RouterLink></li>
        <li><RouterLink to="/link">Resources</RouterLink></li>
      </ul>
    </nav>
  </header>

  <RouterView />

  <!-- Global drag preview -->
  <DragPreview />
</template>

<style scoped>
header {
  background-color: #282c34;
  border-bottom: 3px solid #f7d87c;
  padding: 0.5rem 0;
}

nav {
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: none;
  margin: 0;
  padding: 0 2.5em 0 2em;
}

nav ul {
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
}

.menu a {
  color: #ddd;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 600;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.menu a:hover {
  color: #f7d87c;
  background: rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  nav {
    padding: 0 1.5em 0 1em;
  }

  .logo {
    height: 50px;
  }

  .menu a {
    font-size: 1rem;
    padding: 0.5rem 1rem;
  }
}

@media (max-width: 480px) {
  header {
    padding: 0.25rem 0;
  }

  nav {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem 0;
  }

  .menu {
    flex-direction: row;
    gap: 0.5rem;
    margin: 0;
    padding-bottom: 0;
  }

  .menu a {
    font-size: 0.9rem;
    padding: 0.4rem 0.8rem;
  }

  .logo {
    height: 55px;
  }

  .logo:hover {
    transform: scale(1.1);
  }
}
</style>
