<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="mechanic-targeting">
        <p>维拉会自动识别并锁定距离她所在格子最远的对手。</p>
        <p>距离计算使用六边形网格距离来确定最远的对手。</p>
        <p>当多个对手距离相等时：</p>
        <ul>
          <li><strong>友方维拉：</strong>优先选择格子ID较小的对手</li>
          <li><strong>敌方维拉：</strong>优先选择格子ID较大的对手（180°旋转）</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
