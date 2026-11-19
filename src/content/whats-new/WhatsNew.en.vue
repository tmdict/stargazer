<script setup lang="ts">
import { RouterLink } from 'vue-router'

import HelpDuelPicture from '@/components/help/HelpDuelPicture.vue'
import HelpShopPicture from '@/components/help/HelpShopPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import { guidePath, HD_SHOP_PATH, HD_SHOP_PROBABILITY_PATH } from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'
import { SITE_HOST } from '@/lib/site'

const editionDate = whatsNewEditionDate('en')
</script>

<template>
  <article>
    <h1>What's New · {{ editionDate }}</h1>

    <section class="whats-new-entry">
      <h2>Working with Honor Duel Lab</h2>
      <p>
        Stargazer is now working with Toto and Honor Duel Lab. Over the next few months, Honor Duel
        features will come to Stargazer a few at a time, starting with the ones below.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PATH">Honor Duel Shop Calculator</LinkHeading>
      <WhatsNewPicture><HelpShopPicture /></WhatsNewPicture>
      <p>
        Enter the Honor Duel shop in front of you and the heroes or equipment you are looking for.
        It shows the move with the best chance of finishing this round, the move that costs the
        fewest badges, and when it is better to stop for the round.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Honor Duel grid</h2>
      <WhatsNewPicture><HelpDuelPicture /></WhatsNewPicture>
      <p>
        The Arena has an <b>Honor Duel</b> tab with a grid of its own. Place heroes and Trial units,
        set their tiers and equipment, and give each side an artifact. Each side's faction bonus
        shows next to its artifact.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PROBABILITY_PATH">Honor Duel Shop Probability</LinkHeading>
      <p>
        A guide to the odds behind the shop: how likely a card or a hero is to show, how many
        rerolls and badges it takes on average, and when a pack or a lock is worth it.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>New guide pages</h2>
      <p>
        <RouterLink :to="guidePath('factions')">Faction Bonus</RouterLink> lists the ATK and HP a
        team gains from heroes of one faction, and the damage change between factions that counter
        each other. <RouterLink :to="guidePath('damage')">Damage Types</RouterLink> tells physical,
        magic and true damage and HP loss apart, and says which effects raise or stop each. The
        <RouterLink :to="guidePath('glossary')">Glossary</RouterLink> explains the stats, statuses
        and other terms in skill text.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>New address</h2>
      <p>
        Stargazer has moved to <b>{{ SITE_HOST }}</b
        >. Links to the old address still bring you here.
      </p>
    </section>

    <section class="whats-new-also">
      <h2>Also new</h2>
      <ul>
        <li>
          The <b>Seasonal</b> tab lists the season's charms and the Mythic charm types, each with
          the heroes who can use it.
        </li>
        <li>
          Buff tiles are marked on the Supreme League and Guild Duel maps when <b>Grid Info</b> is
          on<span class="help-mouse">. Rest the mouse on one to read its buff</span>.
        </li>
        <li>
          The <a :href="pvpReportHref(8, 'en')">Season 8 PvP report</a> now includes the second
          Supreme League's data.
        </li>
      </ul>
    </section>
  </article>
</template>
