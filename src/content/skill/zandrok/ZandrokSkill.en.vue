<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Zandrok · Skills',
  description:
    'When a battle starts, Zandrok summons illusions of himself that charge forward in a 5-tile-wide wedge formation toward the enemy side, dealing 10% damage and destroying all obstacles in their path. Any allies they pass through, including Zandrok, become inspired. Inspired Zandrok and allies gain 50% and 20% extra max HP respectively until the battle ends, with their current HP remaining unchanged. They also increase their Life Drain by 40, Haste by 20, and movement speed by 100% for 8s.',
  url: 'skill/zandrok',
  locale: 'en',
  keywords: ['Zandrok', '赞东', '人马'],
})
</script>

<template>
  <article>
    <h1>Zandrok</h1>

    <h2>Non-Permanent Buff</h2>

    <h3>Skill</h3>
    <p>
      <strong>Passive.</strong> When a battle starts, Zandrok summons illusions of himself that
      charge forward in a 5-tile-wide wedge formation toward the enemy side, dealing 10% damage and
      destroying all obstacles in their path. Any allies they pass through, including Zandrok,
      become inspired. Inspired Zandrok and allies gain 50% and 20% extra max HP respectively until
      the battle ends, with their current HP remaining unchanged. They also increase their Life
      Drain by 40, Haste by 20, and movement speed by 100% for 8s.
    </p>
    <p>
      <strong>Active.</strong> Zandrok inspires allies within 2 tiles, increasing their Life Drain
      by 25 and Haste by 14 for 8s. Unstackable.
    </p>
  </article>
</template>
