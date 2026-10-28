<script setup lang="ts">
/* Who Would Win?: two five-hero teams at their levels, each with an optional
   artifact, and which should win and why from this season's recorded Supreme
   League games (lib/pvp/sl/www), worked out in the Supreme League worker
   (useSlEngine). A tap on a slot, then a hero in the grid, fills the slot.
   Wider than a tablet, a click on an empty slot also opens the board's hero
   picker under it, which fills the team's open slots in turn, as the board's
   popup fills a team's tiles; narrower, the grid is a bottom sheet and the
   tap opens it, as a board's tile tap does. As on a board, a click on a hero
   or an artifact takes it off. A hero added to Team A starts at the active
   roster's levels and one added to Team B at the top levels, as the
   generator treats a visitor and their opponents. The result stays as it was
   made until Predict winner is pressed again. The teams live in the page
   alone. It is pre-rendered with its heading alone, and the teams and the
   result are drawn after mount. */

import { computed, nextTick, ref, useTemplateRef } from 'vue'

import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import SlAbout from '@/components/guide/sl/SlAbout.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import WwwHeroGrid from '@/components/guide/www/WwwHeroGrid.vue'
import WwwResult from '@/components/guide/www/WwwResult.vue'
import WwwTeamLevels from '@/components/guide/www/WwwTeamLevels.vue'
import WwwTeamRow, {
  type WwwLevelAttr,
  type WwwSlotHero,
  type WwwTeamState,
} from '@/components/guide/www/WwwTeamRow.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ClearButton from '@/components/ui/ClearButton.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import { useSlFile } from '@/components/guide/sl/useSlFile'
import { useNarrowViewport } from '@/composables/useNarrowViewport'
import { useSlEngine } from '@/composables/useSlEngine'
import { ATTR_PARAGON, ATTR_REFINEMENT, TOP_LEVELS } from '@/lib/characters/attributes'
import { compareCharacters } from '@/lib/filterOrder'
import { BASE_TEAM_SIZE } from '@/lib/grid'
import type { Point } from '@/lib/layout'
import type { SlFamily } from '@/lib/pvp/sl/data/types'
import type { Pair, TeamSide, WwwPanel, WwwTeam } from '@/lib/pvp/sl/www/panel'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { setupWwwContentMeta } from '@/utils/contentMeta'

import '@/components/guide/sl/sl.css'

const i18n = useI18nStore()
setupWwwContentMeta(computed(() => i18n.currentLocale))

const gameData = useGameDataStore()
gameData.initializeData()
const rosters = useRosters()
const { status: engineStatus, predict } = useSlEngine()
const { file: slFile, heading, failed, mounted } = useSlFile()
const aboutOpen = ref(false)

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

const emptyTeam = (): WwwTeamState => ({
  heroes: Array.from({ length: BASE_TEAM_SIZE }, () => null),
  artifact: null,
})
const teams = ref<Pair<WwwTeamState>>({ a: emptyTeam(), b: emptyTeam() })
const target = ref<{ side: TeamSide; slot: number } | null>({ side: 'a', slot: 0 })
const sheetExpanded = ref(false)

const SIDES: readonly TeamSide[] = ['a', 'b']
const other = (side: TeamSide): TeamSide => (side === 'a' ? 'b' : 'a')
const ids = (side: TeamSide): number[] =>
  teams.value[side].heroes.flatMap((hero) => (hero ? [hero.id] : []))
const taken = computed(() => (target.value ? ids(target.value.side) : []))

const startLevels = (side: TeamSide, id: number): Omit<WwwSlotHero, 'id'> => {
  const record = side === 'a' && rosters.active ? (rosters.active.heroes[id] ?? {}) : TOP_LEVELS
  return { paragon: record[ATTR_PARAGON] ?? 0, refinement: record[ATTR_REFINEMENT] ?? 0 }
}

// The next empty slot after `from` on its team, then on the other team.
const nextOpen = (from: { side: TeamSide; slot: number }): typeof target.value => {
  for (const side of [from.side, other(from.side)]) {
    const slots = teams.value[side].heroes
    for (let step = 1; step <= slots.length; step++) {
      const slot = (from.slot + step) % slots.length
      if (!slots[slot]) return { side, slot }
    }
  }
  return null
}

const narrow = useNarrowViewport()
const heroPicker = ref<{ side: TeamSide; position: { x: number; y: number } } | null>(null)
const pickerHeroes = computed(() => {
  const side = heroPicker.value?.side
  if (!side) return []
  const on = ids(side)
  return heroes.value.filter((c) => !on.includes(c.id)).sort(compareCharacters)
})

// A hero taken off leaves its slot the one to fill next.
const pickSlot = (side: TeamSide, slot: number, under: Point): void => {
  target.value = { side, slot }
  const slots = teams.value[side].heroes
  if (slots[slot]) {
    slots[slot] = null
    return
  }
  if (!narrow.value) {
    heroPicker.value = { side, position: { x: under.x, y: under.y + 4 } }
    return
  }
  sheetExpanded.value = true
}

const pickHero = (character: CharacterType): void => {
  const at = target.value
  if (!at) return
  const slots = teams.value[at.side].heroes
  const held = slots.findIndex((hero) => hero?.id === character.id)
  if (held >= 0) {
    slots[held] = null
    target.value = { side: at.side, slot: held }
    return
  }
  slots[at.slot] = { id: character.id, ...startLevels(at.side, character.id) }
  target.value = nextOpen(at)
  sheetExpanded.value = false
}

// The picker stays open while its team has an open slot.
const pickFromPicker = (character: CharacterType): void => {
  const side = heroPicker.value?.side
  pickHero(character)
  if (target.value?.side !== side) heroPicker.value = null
}

const setLevel = (side: TeamSide, slot: number, attr: WwwLevelAttr, level: number): void => {
  const hero = teams.value[side].heroes[slot]
  if (hero) hero[attr] = level
}

const setTeamLevel = (side: TeamSide, attr: WwwLevelAttr, level: number): void => {
  for (const hero of teams.value[side].heroes) if (hero) hero[attr] = level
}

const artifactPicker = ref<{ side: TeamSide; position: { x: number; y: number } } | null>(null)
const pickArtifact = (side: TeamSide, under: Point): void => {
  if (teams.value[side].artifact !== null) {
    teams.value[side].artifact = null
    return
  }
  artifactPicker.value =
    artifactPicker.value?.side === side ? null : { side, position: { x: under.x, y: under.y + 4 } }
}
const setArtifact = (id: number): void => {
  const picker = artifactPicker.value
  if (!picker) return
  teams.value[picker.side].artifact = id
  artifactPicker.value = null
}

const swapSides = (): void => {
  teams.value = { a: teams.value.b, b: teams.value.a }
  if (target.value) target.value = { side: other(target.value.side), slot: target.value.slot }
}

const clear = (): void => {
  teams.value = { a: emptyTeam(), b: emptyTeam() }
  target.value = { side: 'a', slot: 0 }
}

const full = computed(
  () => ids('a').length === BASE_TEAM_SIZE && ids('b').length === BASE_TEAM_SIZE,
)
const ready = computed(() => !!heading.value && engineStatus.value === 'ready')

const shown = ref<{
  panel: WwwPanel
  groups: Pair<Pick<SlFamily, 'name' | 'core'> | null>
} | null>(null)
const busy = ref(false)
const resultEl = useTemplateRef<HTMLElement>('result')

// Plain copies: the worker cannot take Vue's reactive objects.
const teamFor = (side: TeamSide): WwwTeam => ({
  heroes: teams.value[side].heroes.flatMap((hero) => {
    const character = hero && gameData.getCharacterById(hero.id)
    return hero && character ? [{ ...hero, faction: character.faction }] : []
  }),
  artifact: teams.value[side].artifact,
})

const predictWinner = async (): Promise<void> => {
  const file = slFile()
  if (!file || !full.value) return
  busy.value = true
  try {
    const panel = await predict({ a: teamFor('a'), b: teamFor('b') })
    const group = (kind: number | null) => (kind === null ? null : file.families[kind]!)
    shown.value = { panel, groups: { a: group(panel.kinds.a), b: group(panel.kinds.b) } }
    failed.value = false
  } catch {
    // A file whose parts do not line up passes the shape check and fails in
    // the worker.
    shown.value = null
    failed.value = true
  } finally {
    busy.value = false
  }
  await nextTick()
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <main class="sl-page www-page" data-theme="dark">
    <SlHead :title="i18n.t('app.www-title')" :records="heading" @about="aboutOpen = true" />
    <SlAbout
      v-if="heading"
      :show="aboutOpen"
      page="www"
      :season="heading.season"
      :date="heading.date"
      :sample="heading.sample"
      :before="null"
      @close="aboutOpen = false"
    />
    <p v-if="heading?.retired" class="sl-line sl-note">{{ i18n.t('app.www-previous-season') }}</p>
    <p v-if="failed || engineStatus === 'failed'" class="sl-line sl-note">
      {{ i18n.t('app.sl-load-failed') }}
    </p>

    <section v-if="mounted" class="sl-panel www-match">
      <div class="www-teams">
        <template v-for="side in SIDES" :key="side">
          <span v-if="side === 'b'" class="www-vs" aria-hidden="true">VS</span>
          <WwwTeamRow
            :side
            :team="teams[side]"
            :target="target?.side === side ? target.slot : null"
            @slot="(slot, under) => pickSlot(side, slot, under)"
            @artifact="pickArtifact(side, $event)"
            @level="(slot, attr, level) => setLevel(side, slot, attr, level)"
          />
        </template>
      </div>
      <div class="www-actions">
        <WwwTeamLevels
          side="a"
          :team="teams.a"
          @level="(attr, level) => setTeamLevel('a', attr, level)"
        />
        <div class="www-buttons">
          <button type="button" class="solid-btn sl-action outline" @click="swapSides">
            <IconSwap :size="14" />
            {{ i18n.t('app.swap-sides') }}
          </button>
          <ClearButton confirm-first @click="clear" />
          <button
            type="button"
            class="solid-btn sl-action"
            :disabled="!ready || !full || busy"
            :aria-busy="busy"
            @click="predictWinner"
          >
            {{
              i18n.t(
                busy
                  ? 'app.www-predicting'
                  : !failed && engineStatus === 'loading'
                    ? 'app.sl-getting-ready'
                    : 'app.www-predict',
              )
            }}
          </button>
        </div>
        <WwwTeamLevels
          side="b"
          :team="teams.b"
          @level="(attr, level) => setTeamLevel('b', attr, level)"
        />
      </div>
    </section>

    <div v-if="mounted" ref="result" class="www-result-slot">
      <WwwResult v-if="shown" :panel="shown.panel" :groups="shown.groups" />
    </div>

    <BottomSheet v-if="mounted" v-model:expanded="sheetExpanded" :desktop-rail="false">
      <WwwHeroGrid :characters="heroes" :taken @pick="pickHero" />
    </BottomSheet>

    <Teleport to="body">
      <SelectionPopup v-if="heroPicker" :position="heroPicker.position" @close="heroPicker = null">
        <CharacterSelectionPalette
          :characters="pickerHeroes"
          :enter-hint="i18n.t('app.place-hero')"
          @pick="pickFromPicker"
        />
      </SelectionPopup>
      <SelectionPopup
        v-if="artifactPicker"
        :position="artifactPicker.position"
        @close="artifactPicker = null"
      >
        <ArtifactSelectionPalette
          :artifacts="gameData.pickerArtifacts"
          @pick="setArtifact($event.id)"
        />
      </SelectionPopup>
    </Teleport>
  </main>
</template>

<style scoped>
.www-page {
  max-width: 1280px;
  margin-inline: auto;
}

.www-match {
  --www-cell-inset: 4px;
  display: grid;
  justify-content: center;
  gap: 24px;
  padding: 14px 16px 16px;
  container-type: inline-size;
}

.www-teams {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px 14px;
}

.www-vs {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.www-actions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px var(--spacing-sm);
  padding-inline: var(--www-cell-inset);
}

.www-actions > :first-child {
  justify-self: start;
}

.www-actions > :last-child {
  justify-self: end;
}

.www-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.www-result-slot {
  scroll-margin-top: var(--spacing-lg);
}

.www-result-slot:empty {
  display: none;
}

@container (max-width: 779px) {
  .www-teams {
    gap: 12px;
  }
  .www-actions {
    grid-template-columns: 1fr 1fr;
    padding-inline: 0;
  }
  .www-buttons {
    grid-row: 2;
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .www-page {
    padding-bottom: calc(40px + var(--bottom-sheet-clearance));
  }
  .www-match {
    padding: 12px;
  }
}
</style>
