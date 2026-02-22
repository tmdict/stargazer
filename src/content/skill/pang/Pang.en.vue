<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('pang', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Pang</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        <strong>Active.</strong> Pang channels his chi, gaining a [[340%]] Chi Barrier for [[9]]s.
        While the barrier is active, Pang remains [[unaffected]].
      </p>

      <h3>EX Skill</h3>
      <p>Pang increases the ATK of any unit shielded by his Chi Barrier by [[15%]].</p>
      <p>
        <strong>Level 3:</strong> Pang draws on the chi around him to protect an ally. When an
        allied hero (other than Pang) reaches [[850]] Energy or higher, Pang grants them a Chi
        Barrier. He can only shield the same ally once every [[15]]s.
      </p>
    </article>
  </StyledText>
</template>
