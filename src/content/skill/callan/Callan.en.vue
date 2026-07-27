<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Callan.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>
          The shield's 2-tile radius covers the 6 tiles adjacent to Callan (labeled 1 below) and the
          circle around them (labeled 2); allies standing on those tiles have half the damage they
          take absorbed by the shield while it holds.
        </p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
