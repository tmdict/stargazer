<template>
  <article>
    <h1>Reinier - Dynamic Balance</h1>
    <p>
      Reinier prioritizes connecting an adjacent ally's position with an enemy hero if they're in a
      symmetrical position at the start of the battle. After the battle starts, the connected ally
      and enemy's positions are swapped, the ally receives a buff and the enemy receives a debuff.
    </p>

    <h2>How It Works</h2>
    <p>
      Reinier identifies symmetrical hex pairs where one contains an ally and the other contains an
      enemy.
    </p>

    <h2>Tie-Breaking Rules</h2>
    <p>When multiple ally-enemy pairs are present, use the following rules to handle tie-break:</p>
    <ul>
      <li>
        <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left > Left >
        Bottom-right > Right > Top-left > Top-right
      </li>
      <li>
        <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right > Top-left >
        Right > Bottom-right > Left > Bottom-left (180° rotation)
      </li>
    </ul>

    <GridSnippet :gridStyle="gridStyles.main" />
  </article>
</template>

<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { gridStyles } from './Reinier.data'
</script>
