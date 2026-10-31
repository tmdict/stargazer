<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Saida.data'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Saida looks for teammates starting from the tiles next to her and moving outward. The
          first 2 teammates she finds get the Drain Seeds:
        </p>
        <ul>
          <li>
            <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from frontmost row to
            rearmost row, and right to left (lower hex ID) within a row.
          </li>
          <li><strong>Ring 2:</strong> 12 tiles at distance 2, in the same order.</li>
          <li>And so on...</li>
        </ul>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.order" layout="inline" />
          <GridSnippet :grid-style="gridStyles.example" layout="inline" />
        </div>
        <p>
          When Saida is on the enemy team, the order within a row is flipped, from the higher hex ID
          to the lower (180° rotation).
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
