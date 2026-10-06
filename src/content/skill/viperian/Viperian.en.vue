<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="energy-denial">
        <p>
          Darkviper possession reduces the Energy an enemy gains from being hit. It does not drain
          Energy they already have.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
