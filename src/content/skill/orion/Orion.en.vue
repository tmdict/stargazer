<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff" body-key="temp-buff-definition">
        <p>
          Each ally can become a Supporter only once. More buffs from the same ally do not extend
          the enchantment again.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
