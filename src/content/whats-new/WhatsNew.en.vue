<script setup lang="ts">
import HelpDuelPicture from '@/components/help/HelpDuelPicture.vue'
import HelpShopPicture from '@/components/help/HelpShopPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import RunePicture from '@/components/ui/RunePicture.vue'
import WhatsNewBuffTilesPicture from '@/components/whats-new/WhatsNewBuffTilesPicture.vue'
import WhatsNewCharmsPicture from '@/components/whats-new/WhatsNewCharmsPicture.vue'
import WhatsNewDamagePicture from '@/components/whats-new/WhatsNewDamagePicture.vue'
import WhatsNewFactionsPicture from '@/components/whats-new/WhatsNewFactionsPicture.vue'
import WhatsNewGlossaryPicture from '@/components/whats-new/WhatsNewGlossaryPicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import {
  guidePath,
  HD_SHOP_PATH,
  HD_SHOP_PROBABILITY_PATH,
  TOTO_DISCORD_URL,
  TOTO_SITE_URL,
} from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'
import { SITE_HOST } from '@/lib/site'

const editionDate = whatsNewEditionDate('en')
</script>

<template>
  <article>
    <h1>What's New · {{ editionDate }}</h1>

    <section class="whats-new-entry">
      <h2>Stargazer × Honor Duel Lab Collab</h2>
      <p>
        Stargazer is partnering with Toto's
        <a :href="TOTO_SITE_URL" target="_blank" rel="noopener noreferrer">Honor Duel Lab</a> to
        bring its Honor Duel tools and guides to Stargazer. Over the next few months, look out for
        exciting new Honor Duel features and general PvP mechanics guides as they arrive. Join
        <a :href="TOTO_DISCORD_URL" target="_blank" rel="noopener noreferrer">Toto's Discord</a>
        to talk Honor Duel and follow what is coming next.
      </p>
      <p>To kick things off, check out our first batch of features:</p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="HD_SHOP_PATH">Honor Duel Shop Calculator</LinkHeading>
      <RunePicture><HelpShopPicture /></RunePicture>
      <p>
        Enter the Honor Duel shop in front of you and the heroes or equipment you are looking for.
        It shows the move with the best chance of finishing this round, the move that costs the
        fewest badges, and when it is better to stop for the round.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Honor Duel grid</h2>
      <RunePicture><HelpDuelPicture /></RunePicture>
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
      <h2>New guides</h2>
      <div class="whats-new-guides">
        <div class="link-area">
          <LinkHeading sub :to="guidePath('factions')">Faction Bonus</LinkHeading>
          <RunePicture><WhatsNewFactionsPicture /></RunePicture>
          <p>
            The ATK and HP a team gains from heroes of one faction, and how much more or less damage
            factions deal to the ones they counter.
          </p>
        </div>
        <div class="link-area">
          <LinkHeading sub :to="guidePath('damage')">Damage Types</LinkHeading>
          <RunePicture><WhatsNewDamagePicture /></RunePicture>
          <p>
            Physical, magic and true damage and HP loss, told apart: how to spot each in skill text,
            and which effects raise or stop it.
          </p>
        </div>
        <div class="link-area">
          <LinkHeading sub :to="guidePath('glossary')">Glossary</LinkHeading>
          <RunePicture><WhatsNewGlossaryPicture /></RunePicture>
          <p>
            The stats, statuses and other terms in skill text, each explained. Search for a term or
            jump to its group.
          </p>
        </div>
      </div>
    </section>

    <section class="whats-new-entry">
      <h2>Charms</h2>
      <RunePicture><WhatsNewCharmsPicture /></RunePicture>
      <p>
        The <b>Seasonal</b> tab lists the season's charms and the Mythic charm types, each with the
        heroes who can use it.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Buff tiles</h2>
      <RunePicture><WhatsNewBuffTilesPicture /></RunePicture>
      <p>
        Buff tiles are marked on the Supreme League and Guild Duel maps when <b>Grid Info</b> is
        on<span class="help-mouse">. Rest the mouse on one to read its buff</span>.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :href="pvpReportHref(8, 'en')">Season 8 PvP report</LinkHeading>
      <p>The report now includes the second Supreme League's data.</p>
    </section>

    <section class="whats-new-entry">
      <h2>New address</h2>
      <p>
        Stargazer has moved to <b>{{ SITE_HOST }}</b
        >. Links to the old address still bring you here.
      </p>
    </section>
  </article>
</template>
