<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '尼汝 · 技能',
  description:
    '尼汝对1名友军释放咒语。这名友军受到最后一击后，不会被击败，生命值恢复至最大生命值的45%，并进入“灵魂形态”。“灵魂形态”下的角色可以继续照常战斗，但只能造成45%的伤害，每秒失去生命值，并且失去生命值的速度逐渐提升，直至耗尽后将被彻底击败。本技能优先选择最虚弱的友军作为目标。',
  url: 'skill/niru',
  locale: 'zh',
  keywords: ['Niru', '尼汝'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>尼汝</h1>

      <h2>开局开大招</h2>

      <h3>终极技能</h3>
      <p>
        尼汝对1名友军释放咒语。这名友军受到[[最后一击]]后，不会被击败，生命值恢复至最大生命值的[[45%]]，并进入“灵魂形态”。“灵魂形态”下的角色可以继续照常战斗，但只能造成[[45%]]的伤害，每秒失去生命值，并且失去生命值的速度逐渐提升，直至耗尽后将被彻底击败。本技能优先选择[[最虚弱的]]友军作为目标。
      </p>

      <h3>专武技能</h3>
      <p>战斗开始时，尼汝不消耗能量对最近的友军释放终极技能，优先以自己身后的友军作为目标。</p>
    </article>
  </StyledText>
</template>
