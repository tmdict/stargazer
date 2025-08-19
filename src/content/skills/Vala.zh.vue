<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '维拉 · 行动预告',
  description:
    '在战斗开始前指定一个敌方角色。在战斗中，维拉会优先攻击被标记的敌人，并且每次攻击时会吸收能量。',
  url: 'skill/vala',
  keywords: ['Vala', '维拉'],
  locale: 'zh',
})
</script>

<template>
  <article>
    <h1>维拉 · 行动预告</h1>
    <p>
      在战斗开始前指定一个敌方角色。在战斗中，维拉会优先攻击被标记的敌人，并且每次攻击时会吸收能量。
    </p>

    <h2>详细信息</h2>
    <p>维拉会自动识别并标记距离她当前格子最远的敌方角色。</p>
    <p>距离计算使用六边形网格距离来确定最远的敌人。</p>
    <p>当多个敌人距离相等时：</p>
    <ul>
      <li><strong>友方维拉：</strong>优先选择格子ID更低的敌人</li>
      <li><strong>敌方维拉：</strong>优先选择格子ID更高的敌人（180°旋转）</li>
    </ul>
  </article>
</template>
