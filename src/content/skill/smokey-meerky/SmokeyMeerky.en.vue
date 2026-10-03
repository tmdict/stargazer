<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Energizing Formula's temp buff reaches allies through the aroma that Special Aroma creates
          at the start of battle.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
