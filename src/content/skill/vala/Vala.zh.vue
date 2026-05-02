<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('vala', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>维拉</h1>

      <h2>削能 · 特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，对最远的敌人发出“预告”，自身会优先攻击“预告”的敌人，并且每次攻击时会吸收[[90]]点能量。当“预告”的敌人被击败后，维拉夫人会立即根据自身当前持枪或持剑分别对离自身最远或最近的敌人使用“行动预告”。
      </p>

      <strong>技能机制</strong>
      <p>维拉会自动识别并锁定距离她所在格子最远的敌方角色。</p>
      <p>距离计算使用六边形网格距离来确定最远的敌人。</p>
      <p>当多个敌人距离相等时：</p>
      <ul>
        <li><strong>友方维拉：</strong>优先选择格子ID较小的敌人</li>
        <li><strong>敌方维拉：</strong>优先选择格子ID较大的敌人（180°旋转）</li>
      </ul>
    </article>
  </StyledText>
</template>
