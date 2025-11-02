<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './PandoraSkill.data'

setupContentMeta({
  title: '潘多拉 · 技能',
  description:
    '战斗开始时，将最靠后的一名友军吸入魔盒中，使其处于无敌状态，但无法释放任何技能。经过4秒后，将其从魔盒内放出。若放出该友军时潘多拉依然存活，则该名友军获得1000点能量，并在接下来10秒内攻击力增加35%。',
  url: 'skill/pandora',
  locale: 'zh',
  keywords: ['Pandora', '潘多拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>潘多拉</h1>

      <h2>充能 · 非永久增益</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，将[[最靠后]]的一名友军吸入魔盒中，使其处于[[无敌]]状态，但无法释放任何技能。经过[[4]]秒后，将其从魔盒内放出。若放出该友军时潘多拉依然存活，则该名友军获得[[1000]]点能量，并在接下来[[10]]秒内攻击力增加[[35%]]。
      </p>
      <p>
        被动地，潘多拉每次释放普通攻击以外的技能时，为从魔盒中放出的友军恢复[[290%]]生命值和[[90]]点能量。
      </p>

      <h2>特殊目标机制</h2>

      <h3>技能机制</h3>
      <p>
        网格被组织成水平行，第15行（格子44、45）是敌方队伍的最后排，第1行（格子1、2）是友方队伍的最后排。
      </p>
      <p>
        在同一行内，靠左（较高ID）的格子在敌方一侧被认为“更靠后”，而靠右（较低ID）的格子在友方一侧被认为“更靠后”。
      </p>
      <p>最后排角色是根据他们在地图上的位置确定的：</p>
      <ul>
        <li>
          <strong>友方潘多拉：</strong
          >从最后排开始扫描队友位置，从右到左（最低格子ID到最高），瞄准找到的第一个队友。
        </li>
        <li>
          <strong>敌方潘多拉：</strong
          >以相反顺序扫描敌人位置，从左到右（最高格子ID到最低），瞄准找到的第一个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
