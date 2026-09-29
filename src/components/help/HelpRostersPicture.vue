<script setup lang="ts">
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeDockChip from '@/components/ui/UpgradeDockChip.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { ATTR_PARAGON } from '@/lib/characters/attributes'
import { useGameDataStore } from '@/stores/gameData'
import { appLabel } from '@/utils/skillLabels'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

// New rosters are auto-named "Roster N" in every language.
const ROSTER_NAME = 'Roster 1'

const HEROES = [
  { slug: 'frieren', paragon: 4, refinement: 4, owned: true },
  { slug: 'valen', paragon: 2, refinement: 2, owned: true },
  { slug: 'alna', paragon: 0, refinement: 0, owned: false },
  { slug: 'gerda', paragon: 1, refinement: 3, owned: true },
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('rosters')">
        <div class="help-mock-bar">
          <span class="help-dd">{{ ROSTER_NAME }}</span>
          <IconEdit :size="13" class="help-mock-muted" />
          <span class="help-mock-fill" />
          <span class="control-btn compact danger">
            <IconFilePlus :size="13" class="btn-icon" /><span class="btn-text">{{
              label('new')
            }}</span>
          </span>
          <span class="control-btn compact">
            <IconUpload :size="13" class="btn-icon" /><span class="btn-text">{{
              label('import')
            }}</span>
          </span>
        </div>
        <UpgradeDock class="help-mock-dock">
          <UpgradeDockLabel>{{ label('heroes') }}</UpgradeDockLabel>
          <span class="help-mock-chips">
            <UpgradeDockChip text :tip="label('all')">{{ label('all') }}</UpgradeDockChip>
            <UpgradeDockChip text danger :tip="label('clear')">{{
              label('clear')
            }}</UpgradeDockChip>
          </span>
          <UpgradeDockLabel>{{ label('upgrades') }}</UpgradeDockLabel>
          <span class="help-mock-chips">
            <UpgradeLayerChips :lit="ATTR_PARAGON" />
            <UpgradeDockChip tip="+1">+1</UpgradeDockChip>
          </span>
        </UpgradeDock>
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
      <HelpMock :caption="label('characters')">
        <div class="help-mock-bar">
          <span class="help-dd">{{ ROSTER_NAME }}</span>
          <span class="help-mock-search">
            <IconSearch :size="11" />{{ label('search-heroes-placeholder') }}
          </span>
        </div>
        <div class="help-heroes">
          <span v-for="hero in HEROES.filter((h) => h.owned)" :key="hero.slug" class="help-hero">
            <GuidePortrait :slug="hero.slug" :lang :size="34" />
            <UpgradePill :paragon="hero.paragon" :refinement="hero.refinement" />
          </span>
          <span class="help-hero">
            <img class="help-faction" :src="gameData.getIcon('faction-lightbearer')" alt="" />
            <UpgradePill :paragon="0" :refinement="0" reserved />
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-mock-fill {
  flex: 1;
}

.help-mock-muted {
  color: var(--color-text-secondary);
}

/* Outweighs UpgradeDock's own layout. */
.help-mock .help-mock-dock {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 14px;
}

.help-mock-chips {
  display: flex;
  align-items: center;
  gap: 5px;
}

.help-mock-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 5px 11px;
  overflow: hidden;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  font-size: 0.85rem;
}

.help-heroes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.help-hero {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

.help-hero .upill {
  position: relative;
  z-index: 3;
  margin-top: -2px;
}

.help-faction {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
}

/* Copy of DropdownSelect's pill variant. */
.help-dd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 12px;
  white-space: nowrap;
  color: var(--color-primary);
  background: var(--color-bg-white);
  border: 1.5px solid var(--color-primary);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.help-dd::after {
  content: '▾';
  font-size: 0.6rem;
}
</style>
