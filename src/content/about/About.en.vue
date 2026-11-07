<script setup lang="ts">
import { guidePath, SL_GENERATOR_PATH } from '@/lib/guide'
import { helpPath } from '@/lib/help'
</script>

<template>
  <article>
    <h1>AFK Journey Team Builder & PvP Helper</h1>
    <p>
      Stargazer is a team builder and PvP helper for AFK Journey. It lets you try different team
      compositions on arena maps, see how positioning affects hero skills, and share formations with
      friends or guildmates to discuss tactics. You can also:
    </p>
    <ul>
      <li>
        Use the <RouterLink :to="SL_GENERATOR_PATH">PvP team generator</RouterLink> to find a team
        for each map with heroes from your roster.
      </li>
      <li>
        Browse the <RouterLink :to="guidePath('index')">PvP reports</RouterLink> for teams, counters
        and map data from each Supreme League season.
      </li>
      <li>
        Manage your roster and save lineups for 1, 3 or 5 maps on the
        <RouterLink to="/teams">Teams page</RouterLink>.
      </li>
      <li>
        Find heroes by skill mechanic in the <RouterLink to="/skills">skill database</RouterLink>.
      </li>
    </ul>
    <p>
      To learn how each feature works, see
      <RouterLink :to="helpPath('en')">How to use Stargazer</RouterLink>.
    </p>

    <h2>Links and Credits</h2>
    <ul>
      <li>
        <a href="https://www.yaphalla.com/">Yaphalla</a>: Team formation builder, priority list
        builder, and database.
      </li>
      <li><a href="https://www.prydwen.gg/afk-journey/">Prydwen</a>: AFKJ database and guides.</li>
      <li>
        Thanks to the AFKJ communities, including Yaphalla and Toto's Honor Duel Archive, for hero
        information and for testing how several skills work.
      </li>
      <li>
        Images and other assets courtesy of Yaphalla,
        <a href="https://drive.google.com/drive/folders/1rDfDEFJWSASMfCDAuBosoyocN7UZZPoe"
          >AFKJ UGC Asset Library</a
        >
        and <a href="https://afk-journey.fandom.com/wiki/AFK_Journey_Wiki">AFK Journey Wiki</a>.
      </li>
    </ul>
  </article>
</template>
