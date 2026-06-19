<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Evie.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>
          When the battle starts, Evie targets her symmetrical tile (the mirror position across the
          grid's center). The scanned tiles are her symmetrical tile plus the six tiles around it.
        </p>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.enemyTarget1" :images layout="inline" />
          <GridSnippet :grid-style="gridStyles.enemyTarget2" :images layout="inline" />
        </div>
      </SkillSnippet>
    </template>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          When the battle starts, Evie's quill follows the rearmost ally (the teammate positioned
          furthest back in the formation), Evie herself is excluded.
        </p>
        <p>Rearmost is decided by hex ID:</p>
        <ul>
          <li><strong>Ally Team Evie:</strong> the ally on the lowest hex ID.</li>
          <li><strong>Enemy Team Evie:</strong> the ally on the highest hex ID (180° rotation).</li>
        </ul>
        <p>
          The targeting arrow shows only the initial target, later in the battle the quill moves to
          the ally with the highest cumulative damage dealt.
        </p>
        <GridSnippet :grid-style="gridStyles.allyTarget" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
