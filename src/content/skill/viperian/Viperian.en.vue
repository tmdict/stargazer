<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('viperian', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Viperian</h1>

      <h2>Energy Reduction</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Passive.</strong> Viperian burns HP as much as possible when a battle starts,
        sending Darkvipers to possess all enemies until his HP is below [[60%]]. During this skill,
        he is [[unaffected]] while losing [[7%]] max HP for each Darkviper deployed. Every possessed
        enemy drops [[20]] Energy on Hit, losing [[1%]] HP per second to sustain the survivability
        of the Darkviper on them. Viperian calls a Darkviper back to recover [[14%]] HP when his HP
        ratio is below [[30%]].
      </p>

      <h3>Skill</h3>
      <p>
        <strong>Active.</strong> Viperian burns [[10%]] max HP to enhance the next Tearing Bite,
        dealing [[140%]] damage to the target and reducing their Energy by [[60]].
      </p>
    </article>
  </StyledText>
</template>
