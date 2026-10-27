<script lang="ts">
import type { TeamSide } from '@/lib/pvp/sl/www/panel'

// A hero in one of a team's slots, at its levels.
export interface WwwSlotHero {
  id: number
  paragon: number
  refinement: number
}

export interface WwwTeamState {
  heroes: (WwwSlotHero | null)[]
  artifact: number | null
}

export const sideLabelKey = (side: TeamSide): string =>
  side === 'a' ? 'app.www-team-a' : 'app.www-team-b'
</script>

<script setup lang="ts">
/* One team's row, from the outside in: its artifact, its phantimal and its
   five heroes, each hero with the P/R pill that steps its levels. Team B's
   row runs the other way, so both teams' heroes meet in the middle. The
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
  slot: [index: number]
  artifact: [event: MouseEvent]
  level: [index: number, attr: 'paragon' | 'refinement', level: number]
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

const heroName = (id: number): string =>
  curatedHeroName(gameData.getCharacterNameById(id) ?? '', i18n.currentLocale)
</script>

<template>
  <div class="www-team" :class="side">
    <span class="www-team-label">{{ i18n.t(sideLabelKey(side)) }}</span>
    <div class="www-team-row">
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
            @click="emit('artifact', $event)"
          >
            <ArtifactImage v-if="artifact" :artifact />
          </button>
          <span v-if="!artifact" class="www-tag">{{ i18n.t('app.www-none') }}</span>
        </div>
        <div class="www-cell">
          <span
            class="www-round www-phantimal"
            :class="{ empty: !phantimal }"
            :title="
              phantimal ? phantimalDisplayName(i18n.currentLocale, phantimal.name) : undefined
            "
          >
            <img v-if="phantimal" :src="gameData.getCharacterImage(phantimal.name)" alt="" />
          </span>
          <span class="www-tag">{{ i18n.t('app.www-auto') }}</span>
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
            @click="emit('slot', index)"
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
  </div>
</template>

<style scoped>
.www-team {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.a {
  --ring: var(--unit-frame-ally);
}

.b {
  --ring: var(--unit-frame-enemy);
}

.www-team-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ring);
}

.www-team-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.www-extras,
.www-heroes {
  display: flex;
  align-items: flex-start;
  gap: 3px;
}

.b .www-team-row,
.b .www-extras {
  flex-direction: row-reverse;
}

.www-cell {
  --upill-min-width: 21px;
  --upill-pad-inline: 4px;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: 48px;
}

.www-round {
  --pt: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
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
  .www-team-row {
    display: grid;
    grid-template-columns: repeat(5, 48px);
    gap: 8px 3px;
  }
  .www-heroes {
    grid-column: 1 / -1;
  }
  .a .www-extras {
    grid-row: 1;
    grid-column: 1 / 3;
  }
  .a .www-heroes {
    grid-row: 2;
  }
  .b .www-heroes {
    grid-row: 1;
  }
  .b .www-extras {
    grid-row: 2;
    grid-column: 4 / 6;
  }
}
</style>
