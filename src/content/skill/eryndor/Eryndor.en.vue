<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="debuff">
        <p>
          Stat reductions include ATK, DEF, Haste, Vitality, movement speed and Energy recovery.
        </p>
        <p>
          Each ally can add only one Woe per enemy, even with several debuffs. Woe stays after the
          debuff ends.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
