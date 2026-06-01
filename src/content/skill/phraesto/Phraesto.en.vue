<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="mechanic-companion">
        <p>
          Phraesto's first clone placed during battle preparation is not a summon, but his second
          clone created when the first dies is a summon.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
