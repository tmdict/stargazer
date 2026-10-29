<script setup lang="ts">
/* Who Would Win?: two teams of heroes at their levels, each with an optional
   artifact, and which should win and why from this season's recorded Supreme
   League games (lib/pvp/sl/www), worked out in the Supreme League worker
   (useSlEngine). One game holds one such game, and Match the five games of a
   Supreme League match, with Team A's chance to win the match; useWwwGames
   holds the games, and Screenshots fills all five from screenshots of the
   Supreme League's knockout list (WwwImportButton). A tap on a slot, then a
   hero in the grid, fills the slot. Wider than a tablet, a click on an empty
   slot also opens the board's hero picker under it, which fills the team's
   open slots in turn, as the board's popup fills a team's tiles; narrower, the
   grid is a bottom sheet and the tap opens it, as a board's tile tap does. As
   on a board, a click on a hero or an artifact takes it off. Each mode keeps
   the result last made in it, which stays as it was made until Predict winner
   is pressed again. It is pre-rendered with its heading alone, and the games
   and the result are drawn after mount. */

import { computed, nextTick, ref, useTemplateRef } from 'vue'

import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import SlAbout from '@/components/guide/sl/SlAbout.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import WwwGame from '@/components/guide/www/WwwGame.vue'
import WwwHeroGrid from '@/components/guide/www/WwwHeroGrid.vue'
import WwwImportButton from '@/components/guide/www/WwwImportButton.vue'
import WwwMatchResult from '@/components/guide/www/WwwMatchResult.vue'
import WwwResult, { type WwwShown } from '@/components/guide/www/WwwResult.vue'
import WwwTeamLevels from '@/components/guide/www/WwwTeamLevels.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ClearButton from '@/components/ui/ClearButton.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import { useSlFile } from '@/components/guide/sl/useSlFile'
import { useWwwGames, type WwwMode, type WwwSlotAt } from '@/components/guide/www/useWwwGames'
import { useNarrowViewport } from '@/composables/useNarrowViewport'
import { useSlEngine } from '@/composables/useSlEngine'
import { compareCharacters } from '@/lib/filterOrder'
import type { Point } from '@/lib/layout'
import type { TeamSide, WwwTeam } from '@/lib/pvp/sl/www/panel'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupWwwContentMeta } from '@/utils/contentMeta'

import '@/components/guide/sl/sl.css'

const i18n = useI18nStore()
setupWwwContentMeta(computed(() => i18n.currentLocale))

const gameData = useGameDataStore()
gameData.initializeData()
const { status: engineStatus, predict } = useSlEngine()
const { file: slFile, heading, failed, mounted } = useSlFile()
const aboutOpen = ref(false)

const {
  mode,
  games,
  target,
  showing,
  fielded,
  heroIds,
  elsewhere,
  setMode,
  selectSlot,
  toggleHero,
  setLevel,
  setTeamLevel,
  setArtifact,
  swapSides,
  clear,
  fill,
} = useWwwGames()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))
const sheetExpanded = ref(false)

const MODES: readonly { key: WwwMode; label: string }[] = [
  { key: 'one', label: 'app.www-one-game' },
  { key: 'match', label: 'app.www-match' },
]
const modes = computed(() =>
  MODES.map(({ key, label }) => ({ key, label: i18n.t(label), selected: mode.value === key })),
)

const taken = computed(() => (target.value ? heroIds(target.value) : []))
const gridHeroes = computed(() => {
  if (!target.value) return heroes.value
  const out = elsewhere(target.value).heroes
  return heroes.value.filter((c) => !out.has(c.id))
})
const sideSlots = (side: TeamSide) =>
  showing.value.flatMap((game) => games.value[game]![side].heroes)

const narrow = useNarrowViewport()
const heroPicker = ref<{ game: number; side: TeamSide; position: Point } | null>(null)
const pickerHeroes = computed(() => {
  const at = heroPicker.value
  if (!at) return []
  const on = heroIds(at)
  const out = elsewhere(at).heroes
  return heroes.value.filter((c) => !on.includes(c.id) && !out.has(c.id)).sort(compareCharacters)
})

const pickSlot = (at: WwwSlotAt, under: Point): void => {
  if (!selectSlot(at)) return
  if (!narrow.value) {
    heroPicker.value = { game: at.game, side: at.side, position: { x: under.x, y: under.y + 4 } }
    return
  }
  sheetExpanded.value = true
}

const pickHero = (character: CharacterType): void => {
  if (toggleHero(character.id)) sheetExpanded.value = false
}

// The picker stays open while its team has an open slot.
const pickFromPicker = (character: CharacterType): void => {
  const at = heroPicker.value
  pickHero(character)
  if (target.value?.game !== at?.game || target.value?.side !== at?.side) heroPicker.value = null
}

const artifactPicker = ref<{ game: number; side: TeamSide; position: Point } | null>(null)
const pickArtifact = (game: number, side: TeamSide, under: Point): void => {
  if (games.value[game]![side].artifact !== null) {
    setArtifact({ game, side }, null)
    return
  }
  const open = artifactPicker.value
  artifactPicker.value =
    open?.game === game && open.side === side
      ? null
      : { game, side, position: { x: under.x, y: under.y + 4 } }
}
const pickerArtifacts = computed(() => {
  const at = artifactPicker.value
  if (!at) return []
  const out = elsewhere(at).artifacts
  return gameData.pickerArtifacts.filter((artifact) => !out.has(artifact.id))
})
const pickedArtifact = (id: number): void => {
  const at = artifactPicker.value
  if (!at) return
  setArtifact(at, id)
  artifactPicker.value = null
}

const ready = computed(() => !!heading.value && engineStatus.value === 'ready')

const results = ref<Record<WwwMode, WwwShown[] | null>>({ one: null, match: null })
const shown = computed(() => results.value[mode.value])
const busy = ref(false)
const resultEl = useTemplateRef<HTMLElement>('result')

// Plain copies: the worker cannot take Vue's reactive objects.
const teamFor = (game: number, side: TeamSide): WwwTeam => {
  const team = games.value[game]![side]
  return {
    heroes: team.heroes.flatMap((hero) => {
      const character = hero && gameData.getCharacterById(hero.id)
      return hero && character ? [{ ...hero, faction: character.faction }] : []
    }),
    artifact: team.artifact,
  }
}

// One request a game; the worker answers them in turn.
const predictWinner = async (): Promise<void> => {
  const file = slFile()
  if (!file || !fielded.value) return
  const made = mode.value
  busy.value = true
  try {
    const group = (kind: number | null) => (kind === null ? null : file.families[kind]!)
    results.value[made] = await Promise.all(
      showing.value.map(async (game) => {
        const panel = await predict({ a: teamFor(game, 'a'), b: teamFor(game, 'b') })
        return { panel, groups: { a: group(panel.kinds.a), b: group(panel.kinds.b) } }
      }),
    )
    failed.value = false
  } catch {
    // A file whose parts do not line up passes the shape check and fails in
    // the worker.
    results.value[made] = null
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

    <section v-if="mounted" class="sl-panel www-editor">
      <SegmentedPicker class="www-mode" :segments="modes" @select="setMode" />
      <div class="www-games">
        <WwwGame
          v-for="game in showing"
          :key="game"
          :game="games[game]!"
          :number="mode === 'match' ? game + 1 : null"
          :target="target?.game === game ? target : null"
          @slot="(side, slot, under) => pickSlot({ game, side, slot }, under)"
          @artifact="(side, under) => pickArtifact(game, side, under)"
          @level="(side, slot, attr, level) => setLevel({ game, side, slot }, attr, level)"
        />
      </div>
      <div class="www-actions">
        <WwwTeamLevels
          side="a"
          :slots="sideSlots('a')"
          @level="(attr, level) => setTeamLevel('a', attr, level)"
        />
        <div class="www-buttons">
          <WwwImportButton @fill="fill" />
          <button type="button" class="solid-btn sl-action outline" @click="swapSides">
            <IconSwap :size="14" />
            {{ i18n.t('app.swap-sides') }}
          </button>
          <ClearButton confirm-first @click="clear" />
          <button
            type="button"
            class="solid-btn sl-action"
            :disabled="!ready || !fielded || busy"
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
          :slots="sideSlots('b')"
          @level="(attr, level) => setTeamLevel('b', attr, level)"
        />
      </div>
    </section>

    <div v-if="mounted" ref="result" class="www-result-slot">
      <template v-if="shown">
        <WwwMatchResult v-if="mode === 'match'" :games="shown" />
        <WwwResult v-else :panel="shown[0]!.panel" :groups="shown[0]!.groups" />
      </template>
    </div>

    <BottomSheet v-if="mounted" v-model:expanded="sheetExpanded" :desktop-rail="false">
      <WwwHeroGrid :characters="gridHeroes" :taken @pick="pickHero" />
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
        <ArtifactSelectionPalette :artifacts="pickerArtifacts" @pick="pickedArtifact($event.id)" />
      </SelectionPopup>
    </Teleport>
  </main>
</template>

<style scoped>
.www-page {
  padding-inline: max(var(--sl-page-gutter), 50% - 640px + var(--sl-page-gutter));
}

.www-editor {
  --www-cell-inset: 4px;
  display: grid;
  justify-content: center;
  gap: 24px;
  padding: 14px 16px 16px;
  container-type: inline-size;
}

.www-mode {
  justify-self: center;
}

.www-games {
  display: grid;
  gap: 18px;
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
  .www-editor {
    padding: 12px;
  }
}
</style>
