<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          With Enhance Force, the shielded ally also gets a temporary Phys &amp; Magic DEF buff. The
          shield alone does not count as a temporary stat buff.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
