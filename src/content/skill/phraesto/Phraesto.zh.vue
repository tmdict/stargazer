<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('phraesto', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>普鲁斯托 (蝎子)</h1>

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        被动地，普鲁斯托的最大生命值降低[[12%]]，但玩家在备战时可以额外布置一个以假乱真的幻象。幻象继承普鲁斯托[[100%]]属性，且可以使用全部技能。当本体与幻象布阵在同一行时，双方将会获得[[30%]]减伤效果，持续至其中一方被击败。
      </p>

      <h3>专武技能</h3>
      <p>
        <strong>4级：</strong
        >若幻象先于本体被击败，则普鲁斯托会重新在自己身前召唤一个新的幻象，该幻象只继承本体[[60%]]最大生命值。本效果每场战斗最多触发1次。
      </p>

      <strong>技能机制</strong>
      <p>
        普鲁斯托在备战阶段放置的第一个幻象不是召唤物，但当第一个幻象被击败后生成的第二个幻象是召唤物。
      </p>
    </article>
  </StyledText>
</template>
