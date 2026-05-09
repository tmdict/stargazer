<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('evie', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Evie</h1>

      <h2>Non-Permanent Buff (Instant)</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Evie summons a quill to follow the [[rearmost]] ally. Afterward, every
        [[3]]s, the quill switches to the ally with the highest cumulative damage dealt, restoring
        [[120%]] HP to them every second and increasing their ATK by [[20%]].
      </p>

      <h3>Enhance Force</h3>
      <p>
        After gathering intel on all surviving enemy heroes while concealed, Evie summons an extra
        quill to follow the ally with the second-highest cumulative damage dealt. Each ally can only
        be followed by one quill.
      </p>

      <h2>Ultimate Negation</h2>

      <h3>Ultimate</h3>
      <p>
        Active. Evie interrogates the enemy with the highest cumulative damage dealt for [[6]]s.
        During the interrogation, she deals [[180%]] damage to the enemy every second and
        [[immobilizes]] them. If she has already gathered intel on the target, the skill also
        silences them during the interrogation.
      </p>
    </article>
  </StyledText>
</template>
