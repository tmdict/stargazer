<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '维拉 · 技能',
  description:
    '战斗开始时，对最远的敌人发出“预告”，自身会优先攻击“预告”的敌人，并且每次攻击时会吸收90点能量。',
  url: 'skill/vala',
  locale: 'zh',
  keywords: ['Vala', '维拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>维拉</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，对最远的敌人发出“预告”，自身会优先攻击“预告”的敌人，并且每次攻击时会吸收[[90]]点能量。
      </p>

      <h3>详细信息</h3>
      <p>维拉会自动识别并标记距离她当前格子最远的敌方角色。</p>
      <p>距离计算使用六边形网格距离来确定最远的敌人。</p>
      <p>当多个敌人距离相等时：</p>
      <ul>
        <li><strong>友方维拉：</strong>优先选择格子ID更低的敌人</li>
        <li><strong>敌方维拉：</strong>优先选择格子ID更高的敌人（180°旋转）</li>
      </ul>
    </article>
  </StyledText>
</template>
