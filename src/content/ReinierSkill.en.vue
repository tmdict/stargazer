<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './ReinierSkill.data'

setupContentMeta({
  title: 'Reinier · Skills',
  description:
    "Reinier prioritizes connecting an adjacent ally's position with an enemy hero if they're in a symmetrical position at the start of the battle. After the battle starts, the connected ally and enemy's positions are swapped, the ally receives a buff and the enemy receives a debuff.",
  url: 'skill/reinier',
  locale: 'en',
  keywords: ['Reinier', '雷内亚'],
})
</script>

<template>
  <article>
    <h1>Reinier</h1>

    <h2>Dynamic Balance</h2>
    <p>
      Reinier prioritizes connecting an adjacent ally's position with an enemy hero if they're in a
      symmetrical position at the start of the battle. After the battle starts, the connected ally
      and enemy's positions are swapped, the ally receives a buff and the enemy receives a debuff.
    </p>

    <h3>How It Works</h3>
    <p>
      Reinier identifies symmetrical hex pairs where one contains an ally and the other contains an
      enemy.
    </p>
    <p>When multiple ally-enemy pairs are present, use the following rules to handle tie-break:</p>
    <ul>
      <li>
        <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left → Left →
        Bottom-right → Right → Top-left → Top-right
      </li>
      <li>
        <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right → Top-left →
        Right → Bottom-right → Left → Bottom-left (180° rotation)
      </li>
    </ul>

    <GridSnippet :grid-style="gridStyles.main" :images />
  </article>
</template>
