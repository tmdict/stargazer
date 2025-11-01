<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Thador · Skills',
  description:
    'During battle preparation, Thador designates the ally placed 1 tile behind him as his lieutenant.',
  url: 'skill/thador',
  locale: 'en',
  keywords: ['Thador', '都铎'],
})
</script>

<template>
  <article>
    <h1>Thador</h1>

    <h2>Energy Recharge</h2>

    <h3>Skill</h3>
    <p>
      <strong>Passive.</strong> During battle preparation, Thador designates the ally placed 1 tile
      behind him as his lieutenant.
    </p>

    <h3>EX Skill</h3>
    <p><strong>Level 3:</strong> Grants Thador's lieutenant 350 Energy when a battle starts.</p>
  </article>
</template>
