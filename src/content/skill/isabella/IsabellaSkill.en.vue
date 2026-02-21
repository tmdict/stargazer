<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './IsabellaSkill.data'

setupSkillContentMeta('isabella', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Isabella</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        When a battle starts, Isabella selects the [[frontmost]] allied hero as her companion. If
        the companion is defeated, Isabella will select a new one. Whenever the companion receives a
        stat boost to ATK, ATK SPD, Haste, Phys DEF, Magic DEF, or Vitality, Isabella gains a
        permanent stack of spell note corresponding to that stat. Each type of spell note can stack
        up to 3 times. Note that stat boosts granted by Isabella's spell notes themselves do not
        trigger additional stacks of spell notes.
      </p>
      <p>
        When Isabella casts her Ultimate, she increases her companion's ATK by [[15%]] and their
        Haste by [[15]] for [[6]]s.
      </p>
      <p>Additionally, each spell note stack buffs the companion's corresponding stat:</p>
      <ul>
        <li>ATK, Phys DEF, and Magic DEF: +[[15%]] per stack.</li>
        <li>ATK SPD, Haste, and Vitality: +[[15]] per stack.</li>
      </ul>

      <h2>Targeting Mechanics</h2>

      <strong>How It Works</strong>
      <p>
        The grid is organized into horizontal rows, with row 15 (hexes 44, 45) being the rearmost
        position for the enemy team, and row 1 (hexes 1, 2) being the rearmost for the ally team.
      </p>
      <p>
        Within the same row, leftmost (higher hex IDs) tiles are considered "further in front" on
        the ally side, while rightmost (lower hex IDs) tiles are "further in front" on the enemy
        side.
      </p>
      <p>The frontmost character is determined by their position on the hexagonal grid:</p>
      <ul>
        <li>
          <strong>Ally Team Isabella:</strong> Scans ally positions starting from the frontmost row,
          from left to right (highest tile ID to lowest), targeting the first ally found.
        </li>
        <li>
          <strong>Enemy Team Isabella:</strong> Scans enemy positions in reverse orer, from right to
          left (lowest tile ID to highest), targeting the first ally found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
