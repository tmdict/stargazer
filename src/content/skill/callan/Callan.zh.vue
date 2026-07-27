<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Callan.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>
          护盾的2格范围包括紧邻铐兰的6个格子（下图标记为1）以及外侧一圈（标记为2）。护盾存在期间，站在这些格子上的友军受到的伤害有一半由护盾承担。
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
