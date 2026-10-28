<script lang="ts">
import type { Point } from '@/lib/layout'
import type { TeamSide } from '@/lib/pvp/sl/www/panel'

export interface WwwSlotHero {
  id: number
  paragon: number
  refinement: number
}

export interface WwwTeamState {
  heroes: (WwwSlotHero | null)[]
  artifact: number | null
}

export type WwwLevelAttr = 'paragon' | 'refinement'

export const sideLabelKey = (side: TeamSide): string =>
  side === 'a' ? 'app.www-team-a' : 'app.www-team-b'
</script>

<script setup lang="ts">
/* One team's row, from the outside in: its artifact, phantimal and five
   heroes. Team B's row runs the other way, so both teams' heroes meet in the
   middle. Where the rows do not fit side by side, each team is a column. The
   phantimal follows from the heroes by the game's faction rule. */

import { computed } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import SlPortrait from '@/components/guide/sl/SlPortrait.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName, phantimalDisplayName } from '@/utils/nameFormatting'
import { curatedHeroName } from '@/utils/skillLabels'

const { side, team, target } = defineProps<{
  side: TeamSide
  team: WwwTeamState
  // The slot the hero grid fills next, when it is on this team.
  target: number | null
}>()

const emit = defineEmits<{
  // `under`: below the clicked slot's whole cell, clear of its pill or tag,
  // where a picker opens.
  slot: [index: number, under: Point]
  artifact: [under: Point]
  level: [index: number, attr: WwwLevelAttr, level: number]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const heroIds = computed(() => team.heroes.flatMap((h) => (h ? [h.id] : [])))
const phantimal = computed(() =>
  heroIds.value.length
    ? gameData.phantimals.find((p) =>
        lineupQualifies(p, heroIds.value, gameData.getCharacterFaction),
      )
    : undefined,
)
const artifact = computed(() =>
  team.artifact === null ? undefined : gameData.getArtifactById(team.artifact),
)

const underCell = (event: MouseEvent): Point => {
  const button = event.currentTarget as HTMLElement
  return {
    x: button.getBoundingClientRect().left,
    y: button.parentElement!.getBoundingClientRect().bottom,
  }
}

const heroName = (id: number): string =>
  curatedHeroName(gameData.getCharacterNameById(id) ?? '', i18n.currentLocale)
</script>

<template>
  <div class="www-team" :class="side">
    <span class="www-team-label">{{ i18n.t(sideLabelKey(side)) }}</span>
    <div class="www-extras">
      <div class="www-cell">
        <button
          type="button"
          class="www-round www-artifact"
          :class="{ empty: !artifact }"
          :aria-label="
            artifact
              ? localizedDisplayName(i18n.t, 'artifact', artifact.name)
              : i18n.t('app.www-pick-artifact')
          "
          @click="emit('artifact', underCell($event))"
        >
          <ArtifactImage v-if="artifact" :artifact />
        </button>
        <span v-if="!artifact" class="www-tag">{{ i18n.t('app.www-none') }}</span>
      </div>
      <div class="www-cell">
        <span
          class="www-round www-phantimal"
          :class="{ empty: !phantimal }"
          :title="phantimal ? phantimalDisplayName(i18n.currentLocale, phantimal.name) : undefined"
        >
          <img v-if="phantimal" :src="gameData.getCharacterImage(phantimal.name)" alt="" />
        </span>
        <span v-if="!phantimal" class="www-tag">{{ i18n.t('app.www-auto') }}</span>
      </div>
    </div>
    <div class="www-heroes">
      <div v-for="(hero, index) in team.heroes" :key="index" class="www-cell">
        <button
          type="button"
          class="www-round www-slot"
          :class="{ empty: !hero, target: target === index }"
          :aria-label="hero ? heroName(hero.id) : i18n.t('app.www-pick-hero')"
          :aria-pressed="target === index"
          @click="emit('slot', index, underCell($event))"
        >
          <SlPortrait v-if="hero" :id="hero.id" />
        </button>
        <UpgradePill
          :paragon="hero?.paragon ?? 0"
          :refinement="hero?.refinement ?? 0"
          :reserved="!hero"
          :editable="!!hero"
          @paragon="emit('level', index, 'paragon', $event)"
          @refinement="emit('level', index, 'refinement', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.www-team {
  --slot: clamp(40px, 6cqi - 6px, 64px);
  display: grid;
  grid-template-areas:
    '. head'
    'extras heroes';
  align-items: start;
  gap: 6px 10px;
}

.a {
  --ring: var(--unit-frame-ally);
}

.b {
  --ring: var(--unit-frame-enemy);
  grid-template-areas:
    'head .'
    'heroes extras';
}

.www-team-label {
  grid-area: head;
  justify-self: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ring);
}

.www-extras,
.www-heroes {
  display: flex;
  align-items: flex-start;
  gap: 3px;
}

.www-extras {
  grid-area: extras;
}

.www-heroes {
  grid-area: heroes;
}

.b .www-extras {
  flex-direction: row-reverse;
}

.www-cell {
  --upill-min-width: 21px;
  --upill-pad-inline: 4px;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: calc(var(--slot) + 2 * var(--www-cell-inset));
}

.www-round {
  --pt: var(--slot);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--slot);
  height: var(--slot);
  padding: 0;
  border: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-secondary);
  font: inherit;
  color: inherit;
}

button.www-round {
  cursor: pointer;
}

.www-round.empty {
  border: 2px dashed var(--color-border-primary);
  background: transparent;
}

.www-slot:not(.empty) {
  box-shadow: 0 0 0 2px var(--ring);
}

.www-slot.target {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

.www-slot.empty.target {
  border-color: var(--ring);
}

.www-artifact:not(.empty) {
  border: 2px solid var(--color-bg-secondary);
}

.www-phantimal:not(.empty) {
  box-shadow: 0 0 0 1.5px var(--color-text-secondary);
}

.www-phantimal img {
  width: 92%;
  height: 92%;
  object-fit: cover;
  object-position: center 35%;
}

.www-tag {
  font-size: 9.5px;
  font-weight: 700;
  line-height: 15px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

@container (max-width: 779px) {
  .www-team,
  .b {
    --slot: 48px;
    grid-template-areas:
      'head'
      'heroes'
      'extras';
  }
  .www-extras {
    margin-top: 8px;
  }
  .www-heroes {
    flex-direction: column;
    gap: 8px;
  }
  .www-extras,
  .b .www-extras {
    flex-direction: column-reverse;
    gap: 8px;
  }
  .a .www-heroes,
  .a .www-extras {
    align-items: flex-end;
  }
  .www-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    width: auto;
  }
  .a .www-cell {
    flex-direction: row-reverse;
  }
}
</style>
