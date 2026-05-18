<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="how-it-works">
        <p>战斗开始时：</p>
        <ul>
          <li>如果五月处于防守一方且有多个目标可以打断，她会优先选择最前方的对手。</li>
          <li>如果五月处于进攻一方且有多个目标可以打断，她会优先选择最后方的对手。</li>
          <li>如果五月没有可以打断的目标，她将改为使用"疾雨之舞"。</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
