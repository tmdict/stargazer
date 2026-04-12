<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('contess', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>康缇丝 (书魔)</h1>

      <h2>大招打断</h2>

      <h3>技能</h3>
      <p>
        校规【禁止喧哗】：战场中的角色释放终极技能视为违反该校规，每名角色每[[6]]秒至多违反一次该校规。
      </p>
      <p>主动释放时，使累计释放终极技能次数最多的2名敌人降低[[14%]]回能效率持续[[6]]秒。</p>

      <h3>专武技能</h3>
      <p>
        因违反校规被康缇丝惩罚超过[[6]]次的角色，会被康缇丝永久开除，使其遭受学院规则的重压，永久进入无视霸体的沉默状态（对首领敌人无效），且受到的生命损耗提高[[18%]]。拥有己方康缇丝终极技能赋予“豁免权”的角色，不受康缇丝该技能效果的影响。
      </p>

      <h3>觉醒之力</h3>
      <p>
        非首领模式下，违反校规【禁止打闹】的敌人额外被眩晕[[2]]秒，违反校规【禁止喧哗】的敌人额外被沉默[[6]]秒；首领模式下，敌人违反校规会被额外惩罚一次。
      </p>
    </article>
  </StyledText>
</template>
