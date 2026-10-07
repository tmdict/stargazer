<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>방어력 버프는 보석에 맞은 적군으로부터 1칸 이내에 있는 아군에게만 적용됩니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
