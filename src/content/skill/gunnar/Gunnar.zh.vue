<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('gunnar', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>勒图姆 (炮魔)</h1>

      <h2>非永久增益 (开局)</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时，若勒图姆身后1格存在友军，则会在该位置生成“灾厄枢纽”，使该友军提升3格普通攻击距离，提高相当于勒图姆初始攻击力[[25%]]的攻击力，并使这名友军和勒图姆处于[[稳定]]状态，直至该友军离开“灾厄枢纽”持续[[3]]秒或勒图姆被击败。在战斗中，勒图姆会锁定并优先攻击“灾厄枢纽”上友军的当前目标。
      </p>

      <h3>技能</h3>
      <p>
        发出怒吼，为自己施加抵御值等同于[450%]的护盾，并为比自身[[更靠后]]的每位友军施加抵御值等同于[400%]的护盾，持续6秒。若场上存在“灾厄枢纽”，则还会使其获得强化，在后续[[8]]秒内额外为其中的友军提高[[40]]点攻击速度。
      </p>

      <strong>技能机制</strong>
      <p>格位增益效果视为非永久增益效果。</p>
    </article>
  </StyledText>
</template>
