<script setup lang="ts">
import { computed } from 'vue'

import HoldRing from '@/components/ui/HoldRing.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import type { GridContext } from '@/composables/useGridContext'
import { useInfoTip } from '@/composables/useInfoTip'
import { heroInspectTarget, useInspect, type InspectTarget } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax, UPGRADE_ATTRS } from '@/lib/characters/attributes'
import { getTilesWithCharactersByTeam, isRealHeroId } from '@/lib/characters/character'
import { teamPowerNet } from '@/lib/characters/paragon'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  context: GridContext
  // Pill display, both layers together (one Grid Info toggle governs them);
  // the layer choice (useAttrLayerSelection) decides which layers portrait
  // taps edit. Off, the panel is portraits and names.
  showUpgrades: boolean
  readonly?: boolean
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const { effectiveLayers } = useAttrLayerSelection()

interface PanelHero {
  characterId: number
  name: string
  image: string
  paragon: number
  refinement: number
  faction?: string
  inspectTarget: InspectTarget | null
}

// Only real heroes carry upgrade attrs.
const heroesFor = (team: Team): PanelHero[] =>
  getTilesWithCharactersByTeam(props.context.grid, team)
    .filter((tile) => tile.characterId !== undefined && isRealHeroId(tile.characterId))
    .map((tile) => {
      const characterId = tile.characterId!
      const character = gameData.getCharacterById(characterId)
      const canonicalName = character?.name ?? ''
      return {
        characterId,
        name: localizedDisplayName(i18n.t, 'character', canonicalName),
        image: gameData.getCharacterImage(canonicalName),
        paragon: props.context.getAttr(team, characterId, ATTR_PARAGON),
        refinement: props.context.getAttr(team, characterId, ATTR_REFINEMENT),
        faction: character?.faction,
        inspectTarget: character ? heroInspectTarget(character) : null,
      }
    })

const allyHeroes = computed(() => heroesFor(Team.ALLY))
const enemyHeroes = computed(() => heroesFor(Team.ENEMY))

// Net Rivalry-mode stat (Inspiration minus the enemy's Intimidation), driven by
// paragon alone. The enemy's is the negation of the ally's (the two mirror).
const allyRivalryStat = computed(() =>
  teamPowerNet(
    allyHeroes.value.map((hero) => ({ level: hero.paragon, faction: hero.faction })),
    enemyHeroes.value.map((hero) => ({ level: hero.paragon, faction: hero.faction })),
  ),
)

const visibleAttrIds = computed(() => (props.showUpgrades ? UPGRADE_ATTRS : []))

// A hidden layer is never edited: taps act on the chosen layer restricted to
// the visible ones (falling back to the visible layers), and with no layer
// visible they no-op.
const editLayers = computed(() => (props.readonly ? [] : effectiveLayers(visibleAttrIds.value)))
const canEdit = computed(() => editLayers.value.length > 0)

const sides = computed(() => [
  { team: Team.ALLY, klass: 'ally', heroes: allyHeroes.value, rivalryStat: allyRivalryStat.value },
  {
    team: Team.ENEMY,
    klass: 'enemy',
    heroes: enemyHeroes.value,
    rivalryStat: -allyRivalryStat.value,
  },
])

// An empty side would render as a blank half; team view crops the grid to the
// ally side, so the panel follows.
const visibleSides = computed(() => {
  const populated = sides.value.filter((side) => side.heroes.length > 0)
  return props.context.teamView ? populated.filter((side) => side.team === Team.ALLY) : populated
})

// One layer cycles with wrap. ALL: +1 clamped so counters at different values
// can't desync — except when every layer is already maxed, when the tap wraps
// them all to 0 together.
const cycle = (team: Team, hero: PanelHero): void => {
  const layers = editLayers.value
  if (layers.length === 1) {
    const attrId = layers[0]!
    const current = props.context.getAttr(team, hero.characterId, attrId)
    props.context.setAttr(team, hero.characterId, attrId, (current + 1) % (attrMax(attrId) + 1))
    return
  }
  const values = layers.map(
    (attrId) => [attrId, props.context.getAttr(team, hero.characterId, attrId)] as const,
  )
  const allMaxed = values.every(([attrId, value]) => value >= attrMax(attrId))
  for (const [attrId, value] of values) {
    props.context.setAttr(team, hero.characterId, attrId, allMaxed ? 0 : value + 1)
  }
}

// Right-click or hold opens the hero's skills, as on the board. Not gated on
// readonly: a shared board inspects too.
const { inspect } = useInspect()
const {
  pressing,
  start: startHold,
  onContextMenu,
} = useLongPress<PanelHero>((hero) => {
  if (hero.inspectTarget) void inspect(hero.inspectTarget)
})

const heroAria = (hero: PanelHero): string => {
  const parts = [hero.name]
  if (props.showUpgrades) {
    parts.push(`${i18n.t('app.paragon')} ${hero.paragon}`)
    parts.push(`${i18n.t('app.refinement')} ${hero.refinement}`)
  }
  return parts.join(', ')
}

const rivalryStatClass = (stat: number): string => (stat > 0 ? 'pos' : stat < 0 ? 'neg' : 'zero')

// The label is hidden when the stat is 0 (the v-if), so only the two signs reach here.
const rivalryStatName = (stat: number): string =>
  stat > 0 ? i18n.t('app.inspiration') : i18n.t('app.intimidation')

// Inspiration (positive) and Intimidation (negative) have separate in-game
// descriptions; the panel hides the tooltip at 0, so even never reaches here.
const rivalryStatInfo = (stat: number): string =>
  stat < 0 ? i18n.t('app.intimidation-info') : i18n.t('app.inspiration-info')

const formatRivalryStat = (stat: number): string => {
  const magnitude = Number.isInteger(stat) ? String(Math.abs(stat)) : Math.abs(stat).toFixed(1)
  const sign = stat > 0 ? '+' : stat < 0 ? '-' : ''
  return `${sign}${magnitude}`
}

// Track the hovered side, not its value, so the tooltip text stays live if the stat
// flips sign while the label is hovered.
const {
  anchor: hoveredStatEl,
  payload: hoveredTeam,
  hoverOpen: onStatEnter,
  hoverClose: onStatLeave,
  toggle: onStatToggle,
  onTouchStart: onStatTouchStart,
} = useInfoTip<Team>()
const hoveredStat = computed(
  () => sides.value.find((side) => side.team === hoveredTeam.value)?.rivalryStat ?? 0,
)
</script>

<template>
  <div
    v-if="visibleSides.length > 0"
    class="team-power capture-exclude"
    :class="{ single: visibleSides.length === 1 }"
  >
    <div v-for="side in visibleSides" :key="side.klass" class="tp-block" :class="side.klass">
      <div v-if="showUpgrades" class="tp-head">
        <span class="stat" :class="rivalryStatClass(side.rivalryStat)">
          <span class="stat-num">{{ formatRivalryStat(side.rivalryStat) }}</span>
          <span
            v-if="side.rivalryStat !== 0"
            class="stat-label"
            @mouseenter="onStatEnter($event, side.team)"
            @mouseleave="onStatLeave"
            @click="onStatToggle($event, side.team)"
            @touchstart.passive="onStatTouchStart"
          >
            {{ rivalryStatName(side.rivalryStat) }}
          </span>
        </span>
      </div>
      <div class="heroes">
        <button
          v-for="hero in side.heroes"
          :key="hero.characterId"
          type="button"
          class="hero"
          :class="{ static: !canEdit }"
          :aria-label="heroAria(hero)"
          :title="canEdit ? i18n.t('app.upgrade-cycle') : undefined"
          @click="canEdit && cycle(side.team, hero)"
          @pointerdown="hero.inspectTarget && startHold($event, hero)"
          @contextmenu="hero.inspectTarget && onContextMenu($event, hero)"
        >
          <!-- The frame holds the hold ring outside the portrait's clipped circle.
               draggable=false: a native image drag would start inside the
               hold's move tolerance and abandon it. -->
          <span class="portrait-frame">
            <span class="portrait">
              <img
                v-if="hero.image"
                class="portrait-img"
                :src="hero.image"
                alt=""
                draggable="false"
              />
            </span>
            <HoldRing v-if="pressing === hero" />
          </span>
          <UpgradePill
            v-if="showUpgrades"
            class="pill"
            :paragon="hero.paragon"
            :refinement="hero.refinement"
            nested
          />
          <span class="hero-name" :title="hero.name">{{ hero.name }}</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <TooltipPopup
        v-if="hoveredStatEl && hoveredStat !== 0"
        :target-element="hoveredStatEl"
        variant="detailed"
        max-width="260px"
      >
        <template #content>{{ rivalryStatInfo(hoveredStat) }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.team-power {
  container-type: inline-size;
  display: flex;
  width: 100%;
  margin-top: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
}

.tp-block {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-md) var(--spacing-md);
}
.tp-block.ally {
  background: color-mix(in srgb, var(--color-ally) 5%, transparent);
}
.tp-block.enemy {
  background: color-mix(in srgb, var(--color-enemy) 5%, transparent);
  border-left: 1px solid var(--color-border-primary);
}
.team-power.single .heroes {
  justify-content: space-evenly;
}
.team-power.single .tp-block.enemy {
  border-left: none;
}

.tp-head {
  display: flex;
  min-height: 28px;
  margin-bottom: var(--spacing-md);
}
.tp-block.enemy .tp-head {
  justify-content: flex-end;
}
.tp-block.enemy .stat {
  flex-direction: row-reverse;
}

.stat {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}
.stat-label {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px dotted var(--color-border-primary);
  cursor: help;
}
@container (max-width: 319px) {
  .stat-label {
    display: none;
  }
}
.stat-num {
  font-weight: 700;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1;
}
.stat.pos .stat-num {
  color: var(--color-success);
}
.stat.neg .stat-num {
  color: var(--color-danger);
}
.stat.zero .stat-num {
  color: var(--color-text-secondary);
}

.heroes {
  display: flex;
  flex-wrap: nowrap;
  --hero-gap: 4px;
  gap: var(--hero-gap);
}
.tp-block.enemy .heroes {
  justify-content: flex-end;
}

.hero {
  flex: 0 0 calc((100% - 4 * var(--hero-gap)) / 5);
  min-width: 0;
  max-width: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
  /* A long-press is the inspect gesture: iOS would otherwise answer it with the
     image callout, and every touch browser with text selection. */
  -webkit-touch-callout: none;
  user-select: none;
}
.portrait-frame {
  position: relative;
  width: 100%;
}
.portrait {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid #fff;
  background-color: var(--color-bg-secondary);
  transition: transform 0.12s ease;
}
.portrait-img {
  display: block;
  width: 116%;
  height: 116%;
  object-fit: cover;
}
.hero:hover .portrait {
  transform: scale(1.06);
}
.hero.static {
  cursor: default;
}
.hero.static:hover .portrait {
  transform: none;
}
.pill {
  margin-top: -6px;
  position: relative;
  z-index: 1;
  --upill-font-size: 7.5px;
  --upill-min-width: 17px;
  --upill-pad-block: 2px;
  --upill-pad-inline: 3px;
}
.hero-name {
  display: none;
  max-width: 100%;
  font-size: 0.64rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@container (min-width: 480px) {
  .tp-block {
    padding: var(--spacing-md) var(--spacing-lg);
  }
  .stat-num {
    font-size: 1.3rem;
  }
  .hero-name {
    display: block;
  }
  .pill {
    margin-top: -7px;
    --upill-font-size: 9px;
    --upill-min-width: 21px;
    --upill-pad-block: 2.5px;
    --upill-pad-inline: 4px;
  }
}
</style>
