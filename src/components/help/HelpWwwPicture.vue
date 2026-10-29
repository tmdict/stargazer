<script setup lang="ts">
import { computed } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import SlPortrait from '@/components/guide/sl/SlPortrait.vue'
import WwwChances from '@/components/guide/www/WwwChances.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { interpolate } from '@/utils/interpolate'
import { appLabel } from '@/utils/skillLabels'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

const modes = computed(() => [
  { key: 'one', label: label('www-one-game'), selected: true },
  { key: 'match', label: label('www-match'), selected: false },
])

// Team A at a roster's levels and Team B at the top levels, as the page starts
// them; the artifact is a permanent one, so the picture outlasts a season.
const TEAMS = [
  {
    side: 'a',
    name: 'www-team-a',
    artifact: 'starshard',
    heroes: [
      { slug: 'frieren', paragon: 4, refinement: 4 },
      { slug: 'valen', paragon: 4, refinement: 2 },
      { slug: 'koko', paragon: 3, refinement: 4 },
      { slug: 'gerda', paragon: 4, refinement: 4 },
      { slug: 'alna', paragon: 4, refinement: 4 },
    ],
  },
  {
    side: 'b',
    name: 'www-team-b',
    artifact: null,
    heroes: [
      { slug: 'thoran', paragon: 4, refinement: 4 },
      { slug: 'odie', paragon: 4, refinement: 4 },
      { slug: 'vala', paragon: 4, refinement: 4 },
      { slug: 'rhys', paragon: 4, refinement: 4 },
      { slug: 'lyca', paragon: 4, refinement: 4 },
    ],
  },
] as const

const teams = computed(() =>
  TEAMS.map((team) => ({
    ...team,
    artifact: gameData.artifacts.find((a) => a.name === team.artifact),
  })),
)

// Points toward Team A. As on the page, they add up to its chance less 50.
const REASONS = [
  { key: 'heroes', points: 21.4 },
  { key: 'www-counters', points: -1.6 },
  { key: 'www-artifacts', points: 3.2 },
  { key: 'upgrades', points: -0.6 },
]
const CHANCE = 0.5 + REASONS.reduce((sum, reason) => sum + reason.points, 0) / 100
// The page's bars fill at 50 points.
const barWidth = (points: number): string => `${Math.min(Math.abs(points) / 50, 1) * 100}%`

const characterId = (slug: string): number =>
  gameData.characters.find((c) => c.name === slug)?.id ?? 0
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('www-title')" data-theme="dark">
        <div class="help-mock-bar centered">
          <SegmentedPicker :segments="modes" />
        </div>
        <template v-for="(team, t) in teams" :key="team.side">
          <span v-if="t" class="help-www-vs">VS</span>
          <div class="help-www-team" :class="team.side">
            <span class="help-www-label">{{ label(team.name) }}</span>
            <span class="help-www-cells">
              <span class="help-www-cell">
                <span class="help-www-round" :class="{ empty: !team.artifact }">
                  <ArtifactImage v-if="team.artifact" :artifact="team.artifact" />
                </span>
                <span v-if="!team.artifact" class="help-www-tag">{{ label('www-none') }}</span>
              </span>
              <span v-for="hero in team.heroes" :key="hero.slug" class="help-www-cell">
                <span class="help-www-round slot"><SlPortrait :id="characterId(hero.slug)" /></span>
                <UpgradePill :paragon="hero.paragon" :refinement="hero.refinement" />
              </span>
            </span>
          </div>
        </template>
        <div class="help-www-predict">
          <span class="solid-btn help-sl-action">{{ label('www-predict') }}</span>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('www-why')" data-theme="dark">
        <WwwChances :chance="CHANCE" />
        <p class="help-www-verdict">
          {{ interpolate(label('www-verdict-favoured'), { team: label('www-team-a') }) }}
        </p>
        <div class="help-www-rows">
          <div v-for="reason in REASONS" :key="reason.key" class="help-www-row">
            <span class="l"
              ><i v-if="reason.points > 0" :style="{ width: barWidth(reason.points) }"
            /></span>
            <span class="c">
              {{ label(reason.key) }}
              <b :class="reason.points > 0 ? 'a' : 'b'"
                >+{{ Math.abs(reason.points).toFixed(1) }}</b
              >
            </span>
            <span class="r"
              ><i v-if="reason.points < 0" :style="{ width: barWidth(reason.points) }"
            /></span>
          </div>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.a {
  --ring: var(--unit-frame-ally);
}

.b {
  --ring: var(--unit-frame-enemy);
}

.help-www-team {
  display: grid;
  justify-items: start;
  gap: 4px;
}

.help-www-team.b {
  justify-items: end;
}

.help-www-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ring);
}

.help-www-cells {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.b .help-www-cells {
  flex-direction: row-reverse;
}

.help-www-cell {
  --upill-min-width: 18px;
  --upill-pad-inline: 3px;
  display: grid;
  justify-items: center;
  gap: 3px;
  width: 38px;
}

.help-www-round {
  --pt: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.help-www-round.empty {
  border: 2px dashed var(--color-border-primary);
  background: transparent;
}

.help-www-round.slot {
  box-shadow: 0 0 0 2px var(--ring);
}

.help-www-tag {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.help-www-vs {
  display: block;
  margin: 2px 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
  color: var(--color-text-secondary);
}

.help-www-predict {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.help-www-verdict {
  margin: 8px 0 12px;
  font-size: 0.9rem;
  text-align: center;
}

.help-www-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.2rem minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--color-border-light);
}

.help-www-row > .l {
  display: flex;
  justify-content: flex-end;
}

.help-www-row > .c {
  display: grid;
  justify-items: center;
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.help-www-row > .c b {
  font-size: 0.9rem;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  color: var(--ring);
}

.help-www-row i {
  display: block;
  height: 4px;
  border-radius: 2px;
}

.l > i {
  background: var(--unit-frame-ally);
}

.r > i {
  background: var(--unit-frame-enemy);
}
</style>
