<script setup lang="ts">
/* Who Would Win?'s import review: the match's games in the screen's order,
   each with Team A's artifact and five cards above Team B's, an empty slot
   shown as one. A card is one
   cell however many screenshots show it, its edits applying to each reading;
   one the screenshots read differently is tagged, and so is a hero or an
   artifact its side fields twice. An artifact not recognised stays empty
   until one is picked. The name opens the hero picker with the reader's
   candidates pinned, the artifact the artifact palette. Every edit is emitted
   for the import's plan to apply. */

import { computed, ref } from 'vue'

import ImportArtifactButton from '@/components/import/ImportArtifactButton.vue'
import ImportArtifactPicker from '@/components/import/ImportArtifactPicker.vue'
import ImportCell from '@/components/import/ImportCell.vue'
import ImportCellGrid from '@/components/import/ImportCellGrid.vue'
import ImportCellState from '@/components/import/ImportCellState.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import ImportHeroPicker from '@/components/import/ImportHeroPicker.vue'
import ImportSideHead from '@/components/import/ImportSideHead.vue'
import type { ShotRef } from '@/composables/useImportShotList'
import type { WwwImportShot } from '@/composables/useWwwImport'
import type { Point } from '@/lib/layout'
import { SIDES, type TeamSide } from '@/lib/pvp/www/panel'
import {
  filledSlots,
  type WwwCard,
  type WwwImportPlan,
  type WwwIssue,
  type WwwSlot,
  type WwwTeamPlan,
} from '@/lib/pvp/www/wwwImport'
import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { plan, shots } = defineProps<{
  plan: WwwImportPlan
  shots: readonly WwwImportShot[]
}>()

const emit = defineEmits<{
  setHero: [cards: WwwCard[], characterId: number | null]
  setLevel: [cards: ShotRef[], field: 'paragon' | 'refinement', level: number]
  setArtifact: [teams: ShotRef[], artifactId: number | null]
  confirmAll: []
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const SIDE_LABEL: Record<TeamSide, string> = { a: 'app.www-team-a', b: 'app.www-team-b' }

const ISSUE_TAG: Record<WwwIssue, string> = {
  differ: 'app.www-import-differ',
  twice: 'app.picked-twice',
}
const ISSUE_TEXT: Record<WwwIssue, string> = {
  differ: 'app.www-import-differ-note',
  twice: 'app.www-import-twice-note',
}

const teams = computed(() => plan.games.flatMap((game) => (game ? [game.a, game.b] : [])))

// Each tag shown is explained once, above the games.
const legend = computed(() =>
  (['differ', 'twice'] as const).filter((issue) =>
    teams.value.some(
      (team) =>
        team.artifactIssues.includes(issue) ||
        filledSlots(team).some((s) => s.issues.includes(issue)),
    ),
  ),
)

const image = (ref: ShotRef, of: 'cards' | 'badges'): string =>
  shots.find((s) => s.id === ref.shotId)?.[of][ref.key] ?? ''

// A hero twice on a side shows as picked twice on the cell itself.
const slotTags = (slot: WwwSlot): WwwIssue[] => slot.issues.filter((issue) => issue !== 'twice')

interface ArtifactView {
  artifact: ArtifactType | null
  name: string
  // Neither picked nor read surely: a badge with no artifact reads surely.
  unrecognised: boolean
}

const artifactView = (team: WwwTeamPlan): ArtifactView => {
  const artifact =
    team.artifactId === null ? null : (gameData.getArtifactById(team.artifactId) ?? null)
  const unrecognised =
    !team.artifactEdited && team.artifactId === null && !team.badges.some((b) => b.reading.sure)
  return {
    artifact,
    name: artifact
      ? localizedDisplayName(i18n.t, 'artifact', artifact.name)
      : i18n.t(unrecognised ? 'app.import-unrecognised' : 'app.import-none'),
    unrecognised,
  }
}

const artifacts = computed(() =>
  plan.games.map((game) => game && { a: artifactView(game.a), b: artifactView(game.b) }),
)

const anchorBelow = (event: MouseEvent): Point => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.left, y: rect.bottom + 4 }
}

// The pickers follow the card, or the team's artifact, they opened on, so a
// screenshot read while one is open, which can move a card to another game,
// never loses it.
const picker = ref<{ card: ShotRef; position: Point } | null>(null)
const artifactPicker = ref<{ badge: ShotRef; position: Point } | null>(null)

const holds = (refs: readonly ShotRef[], ref: ShotRef): boolean =>
  refs.some((r) => r.shotId === ref.shotId && r.key === ref.key)

const pickerSlot = computed(() => {
  const card = picker.value?.card
  if (!card) return null
  return teams.value.flatMap(filledSlots).find((slot) => holds(slot.cards, card)) ?? null
})
const artifactTeam = computed(() => {
  const badge = artifactPicker.value?.badge
  return badge ? (teams.value.find((team) => holds(team.badges, badge)) ?? null) : null
})

const togglePicker = (slot: WwwSlot, event: MouseEvent): void => {
  artifactPicker.value = null
  const { shotId, key } = slot.cards[0]!
  picker.value =
    pickerSlot.value === slot ? null : { card: { shotId, key }, position: anchorBelow(event) }
}

const setPicked = (characterId: number | null): void => {
  const slot = pickerSlot.value
  picker.value = null
  if (slot) emit('setHero', slot.cards, characterId)
}

const toggleArtifactPicker = (team: WwwTeamPlan, event: MouseEvent): void => {
  picker.value = null
  const { shotId, key } = team.badges[0]!
  artifactPicker.value =
    artifactTeam.value === team ? null : { badge: { shotId, key }, position: anchorBelow(event) }
}

const setArtifactPicked = (artifactId: number | null): void => {
  const team = artifactTeam.value
  artifactPicker.value = null
  if (team) emit('setArtifact', team.badges, artifactId)
}

// The modal stops clicks before they reach the document, where the popup's
// own click-outside listens, so a tap elsewhere in the review closes the
// pickers here.
const closePickers = (event: MouseEvent): void => {
  if ((event.target as HTMLElement).closest('.cell-name, .artifact-btn')) return
  picker.value = null
  artifactPicker.value = null
}
</script>

<template>
  <div class="www-review" @click="closePickers">
    <p v-if="plan.otherMatch" class="note error">{{ i18n.t('app.www-import-other-match') }}</p>
    <div v-if="plan.confirmable.length" class="group-head">
      <ImportCellState state="review" @confirm="emit('confirmAll')">
        {{ i18n.t('app.roster-import-confirm-all', { count: plan.confirmable.length }) }}
      </ImportCellState>
    </div>
    <ul v-if="legend.length" class="legend">
      <li v-for="issue in legend" :key="issue" class="note">
        <span class="tag">{{ i18n.t(ISSUE_TAG[issue]) }}</span>
        {{ i18n.t(ISSUE_TEXT[issue]) }}
      </li>
    </ul>

    <section v-for="(game, g) in plan.games" :key="g" class="game">
      <div class="group-label">{{ i18n.t('app.www-game', { n: g + 1 }) }}</div>
      <p v-if="!game" class="note">{{ i18n.t('app.www-import-game-missing') }}</p>
      <template v-else>
        <div v-for="side in SIDES" :key="side" class="side" :class="side">
          <ImportSideHead :label="i18n.t(SIDE_LABEL[side])">
            <ImportArtifactButton
              compact
              :card="game[side].badges[0] && image(game[side].badges[0], 'badges')"
              :artifact="artifacts[g]![side].artifact"
              :name="artifacts[g]![side].name"
              :unrecognised="artifacts[g]![side].unrecognised"
              :open="artifactTeam === game[side]"
              @pick="toggleArtifactPicker(game[side], $event)"
            >
              <span v-for="issue in game[side].artifactIssues" :key="issue" class="tag">
                {{ i18n.t(ISSUE_TAG[issue]) }}
              </span>
              <ImportCellState
                v-if="game[side].artifactEdited && !game[side].artifactIssues.length"
                state="edited"
              />
            </ImportArtifactButton>
          </ImportSideHead>
          <ImportCellGrid>
            <div v-for="(slot, k) in game[side].slots" :key="k" class="placed">
              <ImportCell v-if="!slot" class="empty" card="" :portrait="null">
                <template #name>
                  <span class="empty-name">{{ i18n.t('app.www-empty-slot') }}</span>
                </template>
              </ImportCell>
              <ImportHeroCell
                v-else
                :card="image(slot.cards[0]!, 'cards')"
                :character-id="slot.characterId"
                :paragon="slot.paragon"
                :refinement="slot.refinement"
                :state="slot.state"
                :doubtful="slot.doubtful"
                :edited="slot.edited"
                :open="pickerSlot === slot"
                @pick="togglePicker(slot, $event)"
                @hero="emit('setHero', slot.cards, $event)"
                @paragon="emit('setLevel', slot.cards, 'paragon', $event)"
                @refinement="emit('setLevel', slot.cards, 'refinement', $event)"
              />
              <span v-if="slot && slotTags(slot).length" class="tags">
                <span v-for="issue in slotTags(slot)" :key="issue" class="tag">
                  {{ i18n.t(ISSUE_TAG[issue]) }}
                </span>
              </span>
            </div>
          </ImportCellGrid>
        </div>
      </template>
    </section>

    <ImportHeroPicker
      v-if="picker && pickerSlot"
      :position="picker.position"
      :candidates="pickerSlot.cards[0]!.cell.candidates"
      :removable="pickerSlot.characterId !== null"
      @pick="setPicked"
      @close="picker = null"
    />
    <ImportArtifactPicker
      v-if="artifactPicker && artifactTeam"
      :position="artifactPicker.position"
      :removable="artifactTeam.artifactId !== null"
      @pick="setArtifactPicked"
      @close="artifactPicker = null"
    />
  </div>
</template>

<style scoped>
.www-review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.group-head {
  display: flex;
  justify-content: flex-end;
}

.legend {
  margin: 0;
  padding: 0;
  list-style: none;
}

.game {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--import-border);
}

.game .note {
  margin: 0;
}

.placed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.placed > .empty {
  border-style: dashed;
}

.empty-name {
  padding: 4px 6px;
  font-size: 0.78rem;
  color: var(--import-text-dim);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--import-bad);
}

.side.a :deep(.side-label) {
  color: var(--unit-frame-ally);
}

.side.b :deep(.side-label) {
  color: var(--unit-frame-enemy);
}
</style>
