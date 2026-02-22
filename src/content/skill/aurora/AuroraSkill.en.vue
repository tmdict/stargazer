<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('aurora', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Aurora</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        Aurora summons her unicorn Sonny to her side and drifts into a deep sleep. Sonny inherits
        [[140%]] of Aurora's HP and [[120%]] of her other [[basic stats]], then creates a rainbow
        aura that inspires allies. All inspired allied summons gain [[50]] Haste, and their movement
        becomes smoother, letting them move past enemies and obstacles more easily. This skill can
        be cast even when Aurora is under control effects.
      </p>
      <p>
        While asleep, Aurora stays [[invincible]]. For normal attacks, she conjures objects from her
        dreams and hurls them at enemies to deal [[320%]] damage. If Sonny gets defeated in battle,
        Aurora jolts awake. Once awake, she becomes vulnerable to enemy attacks and can't use any
        skills except her Ultimate.
      </p>
      <p>
        <strong>Passive.</strong> When a battle starts, Aurora immediately falls asleep, and Sonny
        appears at her side. The frontmost enemy hero gets marked as the Nightmare. The mark reduces
        their Haste by [[40]], but increases their ATK by [[2%]]. Sonny rallies all allied summons
        to focus their attacks on the Nightmare.
      </p>

      <h3>Skill</h3>
      <p>
        This skill can only be used while Aurora is asleep. Aurora summons a magical bunny beside
        her that lasts for up to [[12]]s. The magical bunny inherits [[100%]] of Aurora's HP and
        [[80%]] of her other [[basic stats]], and deals [[100%]] damage with its normal attack. When
        the magical bunny's duration ends, it leaps at the nearest enemy within 2 tiles and
        detonates, dealing [[340%]] damage to all adjacent enemies.
      </p>
    </article>
  </StyledText>
</template>
