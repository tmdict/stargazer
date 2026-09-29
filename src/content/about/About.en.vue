<script setup lang="ts">
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>AFK Journey Arena Simulator</h1>
    <p>
      Stargazer is an AFK Journey arena simulator and planning tool, plus a few companion utilities.
      It lets you experiment with different hero positions and team compositions on a hexagonal
      grid, just like the actual game's battle arena.
    </p>
    <p>
      The purpose of this tool is to allow rapid testing of skill mechanics with different arena
      formations, visualize their attack ranges, and share your formations with friends or guild
      members to discuss tactics. For comprehensive formation building with full features, we
      recommend using <a href="https://www.yaphalla.com/editor">Yaphalla's builder</a>.
    </p>
    <p>
      For a walkthrough of the features, see
      <RouterLink :to="helpPath('en')">How to use Stargazer</RouterLink>.
    </p>

    <h2>Useful Links and Resources</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>: Team formation builder, priority list
        builder, and database.
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>: AFKJ database and guides.</li>
      <li>
        Image assets courtesy of <a href="https://www.yaphalla.com/">Yaphalla</a> and
        <a href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >.
      </li>
    </ul>
  </article>
</template>
