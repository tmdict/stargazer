<script setup lang="ts">
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import SlIcon from '@/components/guide/sl/SlIcon.vue'
import SlPortrait from '@/components/guide/sl/SlPortrait.vue'
import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import DropdownSelect from '@/components/ui/DropdownSelect.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { interpolate } from '@/utils/interpolate'
import { appLabel } from '@/utils/skillLabels'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

// New rosters are auto-named "Roster N" in every language.
const ROSTER_NAME = 'Roster 1'

const HEROES = [
  { slug: 'frieren', paragon: 4, refinement: 4, owned: true },
  { slug: 'valen', paragon: 4, refinement: 2, owned: true },
  { slug: 'alna', paragon: 0, refinement: 0, owned: false },
  { slug: 'koko', paragon: 3, refinement: 4, owned: true },
  { slug: 'gerda', paragon: 4, refinement: 4, owned: true },
  { slug: 'lyca', paragon: 2, refinement: 1, owned: true },
]

const TEAM = [
  { slug: 'frieren', at: [2, 0] as const },
  { slug: 'valen', at: [2, 1] as const },
  { slug: 'koko', at: [2, 2] as const },
  { slug: 'gerda', at: [2, 3] as const },
  { slug: 'lyca', at: [2, 4] as const },
]

const CORE = ['frieren', 'gerda']
const SWAP = { out: 'koko', options: ['odie', 'vala'] }

const characterId = (slug: string): number =>
  gameData.characters.find((c) => c.name === slug)?.id ?? 0
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('sl-title')" data-theme="dark">
        <div class="help-mock-bar">
          <UpgradeDockLabel>{{ label('sl-roster') }}</UpgradeDockLabel>
          <DropdownSelect :label="ROSTER_NAME" lit />
        </div>
        <div class="help-mock-bar">
          <TeamVariantPicker active-mode="5v5" match="sl" :source-id="null" :has-content="false" />
          <span class="solid-btn help-sl-action">{{ label('sl-generate') }}</span>
        </div>
        <div class="help-heroes">
          <span v-for="hero in HEROES" :key="hero.slug" class="help-hero">
            <GuidePortrait :slug="hero.slug" :lang :size="34" :class="{ placed: !hero.owned }" />
            <UpgradePill
              :paragon="hero.paragon"
              :refinement="hero.refinement"
              :reserved="!hero.owned"
            />
          </span>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="interpolate(label('sl-map'), { n: 1 })" data-theme="dark">
        <HelpBoard class="help-sl-board" :tokens="TEAM" />
        <div class="help-sl-aside">
          <span />
          <span class="help-sl-stats">
            <span><SlIcon name="players" class="help-sl-small" /><b>14</b></span>
            <span>
              <SlIcon name="record" class="help-sl-small" /><b class="good">68%</b>
              <small>19–9</small>
            </span>
          </span>
          <SlIcon name="lock" class="help-sl-label" />
          <span class="help-sl-faces">
            <SlPortrait v-for="slug in CORE" :id="characterId(slug)" :key="slug" />
          </span>
          <SlIcon name="swap" class="help-sl-label" />
          <span class="help-sl-faces">
            <SlPortrait :id="characterId(SWAP.out)" />
            <SlIcon name="arrow" class="help-sl-arrow" />
            <SlPortrait v-for="slug in SWAP.options" :id="characterId(slug)" :key="slug" />
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-sl-board {
  display: block;
  width: 190px;
  margin: 4px auto 0;
}

.help-sl-aside {
  --pt: 28px;
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  gap: 8px 10px;
  margin-top: 12px;
}

.help-sl-stats {
  display: inline-flex;
  gap: 12px;
  font-size: 0.9rem;
}

.help-sl-stats > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.help-sl-stats small {
  color: var(--color-text-secondary);
}

.help-sl-stats .good {
  color: var(--color-success);
}

.help-sl-small {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
}

.help-sl-label {
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
}

.help-sl-faces {
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-sl-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-primary);
}
</style>
