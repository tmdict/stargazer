<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './AlicethSkill.data'

setupContentMeta({
  title: '亚莉克希 (弓神) · 技能',
  description:
    '被动地，亚莉克希特“光翼”权能赋予一名友军，使其在对敌人造成3次远程伤害时发射1枚飞羽，对敌人造成120%伤害，每0.5秒至多触发一次。若拥有“光翼”权能的友军为远程角色还会额外提升5格普通攻击的攻击距离。亚莉克希优先选择同排最近的友军赋予权能。且这名友军会在被击败后失去权能。',
  url: 'skill/aliceth',
  locale: 'zh',
  keywords: ['Aliceth', '亚莉克希', '弓神'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>亚莉克希 (弓神)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        被动地，亚莉克希特“光翼”权能赋予一名友军，使其在对敌人造成[[3]]次远程伤害时发射1枚飞羽，对敌人造成[[120%]]伤害，每[[0.5]]秒至多触发一次。若拥有“光翼”权能的友军为远程角色还会额外提升5格普通攻击的攻击距离。亚莉克希优先选择同排最近的友军赋予权能。且这名友军会在被击败后失去权能。
      </p>
      <p>
        战斗开始时，亚莉克希使用“辉煌圣瞳”锁定场上最远的敌人，使自身和“光翼”权能的友军优先对其进行攻击，并且对这名敌人造成的伤害额外提升[[35]]点穿透。
      </p>

      <strong>技能机制（友方）</strong>
      <p>
        亚莉克希首先检查与她同排的友方角色。当同排有多个友方角色时，亚莉克希会选择距离更近的队友，当距离相同时，优先选择位置更靠左的角色（较高ID的格子）。
      </p>
      <p>当同排没有友方角色时，亚莉克希会搜索与她相邻格子上的角色，并向外扩展：</p>
      <ul>
        <li><strong>第1环：</strong>紧邻的6个格子，从最前排到最后排，从左到右。</li>
        <li><strong>第2环：</strong>距离为2的12个格子，从最前排到最后排，从左到右。</li>
        <li>以此类推...</li>
      </ul>

      <div style="text-align: center">
        <GridSnippet :grid-style="gridStyles.rowScan1" :images layout="inline" />
        <GridSnippet :grid-style="gridStyles.rowScan2" :images layout="inline" />
      </div>

      <p>
        另一种理解方式：亚莉克希从与她相邻的格子开始扫描，向外扩展，按照从最高格子ID到最低ID的顺序，锁定找到的第一个队友。
      </p>
      <p>
        敌方亚莉克希锁定队友时，此行为会被翻转（180°旋转）。亚莉克希会从右侧（较低ID）扫描到左侧（较高ID）。
      </p>

      <strong>技能机制（敌方）</strong>
      <p>亚莉克希会自动识别并标记距离她当前格子最远的敌方角色。</p>
      <p>距离计算使用六边形网格距离来确定最远的敌人。</p>
      <p>当多个敌人距离相等时：</p>
      <ul>
        <li><strong>友方亚莉克希：</strong>优先选择格子ID更低的敌人</li>
        <li><strong>敌方亚莉克希：</strong>优先选择格子ID更高的敌人（180°旋转）</li>
      </ul>
    </article>
  </StyledText>
</template>
