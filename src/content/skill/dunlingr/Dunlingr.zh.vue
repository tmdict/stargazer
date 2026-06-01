<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="mechanic-targeting">
        <p>顿里尔会自动识别并锁定距离他所在格子最远的友方角色。</p>
        <p>距离计算使用六边形网格距离来确定最远的队友。</p>
        <p>当多个队友距离相等时：</p>
        <ul>
          <li><strong>友方顿里尔：</strong>优先选择格子ID较小的队友</li>
          <li><strong>敌方顿里尔：</strong>优先选择格子ID较大的队友（180°旋转）</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
