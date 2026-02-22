<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './GalahadSkill.data'

setupSkillContentMeta('galahad', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Galahad</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Galahad casts a protection spell on the [[weakest]] ally, granting them a [[480%]] shield
        that lasts for [[8]]s. When the shield expires, it deals [[240%]] damage to adjacent
        enemies.
      </p>

      <h2>Summon · Targeting Mechanics</h2>

      <h3>Ultimate</h3>
      <p>
        When Galahad casts her Ultimate, she consumes [[400]] Energy to deal [[340%]] damage to all
        enemies. She then begins forming a 2-tile-radius magic circle centered on her position. The
        circle remains active as long as Galahad stays at its center.
      </p>
      <p>
        While the magic circle is forming, Galahad consumes [[60]] Energy every second to increase
        the circle's forming progress by 10%. When the forming progress reaches 100%, she stops
        consuming Energy and gains [[30]] Haste.
      </p>
      <p>
        Enemies inside the magic circle lose [[10]] Haste and [[16%]] movement speed for every 10%
        of the circle's forming progress, up to a max reduction of [[50]] Haste and [[80%]] movement
        speed. While Galahad stays at the center of her circle, whenever she casts a skill, a shadow
        of herself appears shortly after and casts the same skill. The shadow inherits [[60%]] of
        Galahad's stats.
      </p>

      <h3>EX Skill</h3>
      <p>
        When a battle starts, Galahad marks the nearest allied hero, prioritizing the one behind
        her. When Galahad's magic circle is fully formed for the first time, she summons a shadow
        that recreates the marked ally as they were at the start of battle.
      </p>
      <p>
        The shadow remains on the battlefield for [[12]]s, inheriting [[80%]] of the ally's basic
        stats and starting with [[400]] extra Initial Energy. A shadow is not considered a living
        hero and cannot be targeted by enemies.
      </p>

      <strong>How It Works</strong>
      <p>
        Galahad looks for ally characters starting from tiles adjacent to her and expanding
        outwards, prioritizing characters in the back. When multiple characters are in the same row,
        Galahad will prioritize the character to the right (lower hex ID):
      </p>
      <ul>
        <li>
          <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from rearmost row to
          frontmost row, and right to left (lower hex ID).
        </li>
        <li>
          <strong>Ring 2:</strong> 12 tiles at distance 2, starting from rearmost row to frontmost
          row, and right to left (lower hex ID).
        </li>
        <li>And so on...</li>
      </ul>
      <p>When on enemy team, Galahad prioritize teammates with the higher hex ID (180° rotation)</p>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <p>
        Galahad will only target main characters, skipping summons and clones such as Phraesto's
        clone or Elijah & Lailah's Lailah (pink twin).
      </p>
      <p>Both Galahad's shadow, as well as the marked ally's shadow, are considered summons.</p>
    </article>
  </StyledText>
</template>
