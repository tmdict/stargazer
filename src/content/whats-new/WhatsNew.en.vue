<script setup lang="ts">
import HelpGenerateButton from '@/components/help/HelpGenerateButton.vue'
import HelpGeneratorPicture from '@/components/help/HelpGeneratorPicture.vue'
import HelpWwwPicture from '@/components/help/HelpWwwPicture.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'
import WhatsNewPicture from '@/components/whats-new/WhatsNewPicture.vue'
import WhatsNewPlacementPicture from '@/components/whats-new/WhatsNewPlacementPicture.vue'
import WhatsNewSkillsPicture from '@/components/whats-new/WhatsNewSkillsPicture.vue'
import WhatsNewThemePicture from '@/components/whats-new/WhatsNewThemePicture.vue'
import { whatsNewEditionDate } from '@/composables/useWhatsNew'
import { SL_GENERATOR_PATH, WWW_PATH } from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'

const updated = whatsNewEditionDate('en')
</script>

<template>
  <article>
    <h1>What's New</h1>
    <p class="whats-new-updated reading-meta">Updated {{ updated }}</p>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="SL_GENERATOR_PATH">PvP team generator</LinkHeading>
      <WhatsNewPicture><HelpGeneratorPicture /></WhatsNewPicture>
      <p>
        Get a team for each map of a 1v1, 3v3 or 5v5 match, Supreme League and Guild Duel included,
        made from your own heroes and picked from games players recorded. On the Arena and Teams
        pages,
        <HelpGenerateButton />
        fills your side of the grids from your roster in one press.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Placement tips</h2>
      <WhatsNewPicture><WhatsNewPlacementPicture /></WhatsNewPicture>
      <p>
        <span class="help-mouse">Rest the mouse on</span><span class="help-touch">Tap</span> one of
        your heroes on the Arena or Teams page to see why it stands well where it is: what its
        skills give and to whom, the side it leans to, and any tile that would suit it better,
        outlined in green. Turn on <b>Grid Info</b> to see them. <b>Placement tips</b> is already
        ticked in its menu.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Skill visuals by hero</h2>
      <WhatsNewPicture><WhatsNewSkillsPicture /></WhatsNewPicture>
      <p>
        The <b>Skills</b> menu turns arrows and skill ranges off for one hero or artifact at a time,
        or for all of Ally or Enemy. Your choice lasts until the page reloads.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :to="WWW_PATH">Who Would Win?</LinkHeading>
      <WhatsNewPicture><HelpWwwPicture /></WhatsNewPicture>
      <p>
        Set up two Supreme League teams and see which should win, and why. <b>Match</b> plays out
        the five games of a Supreme League match.
      </p>
    </section>

    <section class="whats-new-entry link-area">
      <LinkHeading :href="pvpReportHref(8, 'en')">Season 8 PvP report</LinkHeading>
      <p>
        The report, with Supreme League's teams, counters and map data, now includes the games of
        the second Supreme League.
      </p>
    </section>

    <section class="whats-new-entry">
      <h2>Dark mode</h2>
      <WhatsNewPicture><WhatsNewThemePicture /></WhatsNewPicture>
      <p>
        Stargazer follows your device's light or dark setting. Press the sun or moon button at the
        top to choose one, and the site keeps it.
      </p>
    </section>

    <section class="whats-new-also">
      <h2>Also new</h2>
      <ul>
        <li>
          <b>Screenshots</b> on the Rosters tab makes a roster from screenshots of your heroes in
          the Resonating Hall.
        </li>
        <li>
          Paragon and refinement levels show as a crown <UpgradeIcon kind="paragon" /> and a star
          <UpgradeIcon kind="refinement" /> in place of P and R.
        </li>
        <li>Saved teams can be searched by artifact as well as by hero.</li>
        <li>
          Resting the mouse on a hero in the hero list shows its outfit, and <b>Hero skin</b> under
          <b>Grid Info</b> puts outfits on the grid.
        </li>
        <li>
          <b>Haste</b> and <b>Airborne</b> in <b>Mechanics</b> find heroes that give allies Haste or
          knock enemies into the air.
        </li>
        <li>
          Artifact and phantimal text can be read in every skill language, from the skill window's
          language menu.
        </li>
      </ul>
    </section>
  </article>
</template>
