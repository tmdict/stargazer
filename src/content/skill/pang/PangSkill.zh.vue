<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '缇洛亚 · 技能',
  url: 'skill/velara',
  locale: 'zh',
  keywords: ['Velara', '奎茵'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>潘 (熊猫)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        主动释放时蓄力，之后获得一个[[340%]]的苍竹护盾持续[[9]]秒，苍竹护盾存在时提供[[霸体]]效果。
      </p>

      <h3>专武技能</h3>
      <p>苍竹护盾存在期间，其携带者的攻击力提升[[15%]]。</p>
      <p>
        <strong>3级：</strong
        >潘能感知场上的“真气”并在适当时候支援场上的友方英雄，每当自身以外的友方英雄能量到达[[850]]及以上时，使其获得苍竹护盾，该效果对同一名角色每[[15]]秒最多触发一次。
      </p>
    </article>
  </StyledText>
</template>
