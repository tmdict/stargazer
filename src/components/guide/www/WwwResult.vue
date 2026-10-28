<script lang="ts">
import { sideLabelKey } from './WwwTeamRow.vue'
import type { SlFamily } from '@/lib/pvp/sl/data/types'
import type { Pair, WwwPanel } from '@/lib/pvp/sl/www/panel'

// A game's result as the page keeps it: the worker's panel and each team's group.
export interface WwwShown {
  panel: WwwPanel
  groups: Pair<Pick<SlFamily, 'name' | 'core'> | null>
}
</script>

<script setup lang="ts">
/* Who Would Win?'s result for one game: each team's chance with the verdict
   and a mark whose hover card holds the warnings, the four reasons in points
   of chance with a detail under each, and From the records. Team A is on the
   left and Team B on the right in every row. A reason's bar grows from the
   middle toward the team it helps, its full length 50 points, so the same
   length means the same in every prediction; a detail's bars are on their own
   scale, filled where the number helps that team and hollow where it hurts. */

import { computed, ref } from 'vue'

import WwwChances from './WwwChances.vue'
import ArtifactImage from '@/components/ArtifactImage.vue'
import SlPortrait from '@/components/guide/sl/SlPortrait.vue'
import IconAlertSmall from '@/components/ui/IconAlertSmall.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useSlNames } from '@/components/guide/sl/useSlNames'
import { useInfoTip } from '@/composables/useInfoTip'
import type { WinLoss } from '@/lib/pvp/sl/data/records'
import { REASONS, type Reason } from '@/lib/pvp/sl/model/types'
import type { TeamSide, WwwLine, WwwWarning } from '@/lib/pvp/sl/www/panel'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'
import { curatedHeroName, textGap } from '@/utils/skillLabels'

// The match result names the game shown at the top of its panel.
const { panel, groups, title } = defineProps<WwwShown & { title?: string }>()

const i18n = useI18nStore()
const gameData = useGameDataStore()
const { groupName } = useSlNames()

const SIDES: readonly TeamSide[] = ['a', 'b']
const REASON_LABELS: Record<Reason, string> = {
  heroes: 'app.heroes',
  counters: 'app.www-counters',
  artifacts: 'app.www-artifacts',
  upgrades: 'app.upgrades',
}
const FULL_BAR = 500

const open = ref<Reason | null>(null)
const toggle = (reason: Reason): void => {
  open.value = open.value === reason ? null : reason
}

const teamName = (side: TeamSide): string => i18n.t(sideLabelKey(side))
const toward = (tenths: number): TeamSide | null => (tenths > 0 ? 'a' : tenths < 0 ? 'b' : null)
const tenthsText = (tenths: number): string =>
  `${tenths === 0 ? '' : '+'}${(Math.abs(tenths) / 10).toFixed(1)}`
const barWidth = (tenths: number): string => `${Math.min(Math.abs(tenths) / FULL_BAR, 1) * 100}%`
const recordText = (record: WinLoss): string => `${record.wins}–${record.losses}`
const numberText = (n: number): string =>
  new Intl.NumberFormat(i18n.currentLocale, { maximumFractionDigits: 1 }).format(n)

const heroName = (id: number): string =>
  curatedHeroName(gameData.getCharacterNameById(id) ?? '', i18n.currentLocale)
const artifactOf = (id: number) => gameData.getArtifactById(id)
const artifactName = (id: number): string =>
  localizedDisplayName(i18n.t, 'artifact', artifactOf(id)?.name ?? String(id))

const total = computed(() => panel.shown - 500)

const {
  anchor: warnAnchor,
  hoverOpen: warnOpen,
  hoverClose: warnClose,
  toggle: warnToggle,
  onTouchStart: warnTouchStart,
} = useInfoTip()
const verdict = computed(() =>
  i18n.t(`app.www-verdict-${panel.verdict}`, { team: teamName(panel.shown >= 500 ? 'a' : 'b') }),
)

// A detail's lines side by side, Team A's i-th strongest beside Team B's.
const paired = (lines: WwwLine[]): [WwwLine | undefined, WwwLine | undefined][] => {
  const of = (side: TeamSide) => lines.filter((line) => line.side === side)
  const a = of('a')
  const b = of('b')
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
}
const strength = (value: number, lines: readonly { value: number }[]): string => {
  const largest = Math.max(...lines.map((line) => Math.abs(line.value)))
  return largest > 0 ? `${(Math.abs(value) / largest) * 100}%` : '0%'
}

const heroRows = computed(() => paired(panel.heroes))
const counterRows = computed(() => paired(panel.counters))
const artifactLines = computed(() => SIDES.map((side) => ({ side, ...panel.artifacts[side] })))

const countersNote = computed(() => {
  const side = toward(panel.reasons.counters)
  return [
    i18n.t('app.www-counters-note'),
    side
      ? i18n.t('app.www-counters-for', { team: teamName(side) })
      : i18n.t('app.www-counters-even'),
  ].join(textGap(i18n.currentLocale))
})

const lineName = (line: WwwLine): string =>
  line.id === null ? i18n.t('app.www-five-together') : heroName(line.id)

const warningText = (warning: WwwWarning): string => {
  switch (warning.type) {
    case 'hero-unrecorded':
      return i18n.t('app.www-warn-hero-unrecorded', { hero: heroName(warning.hero) })
    case 'hero-few':
      return i18n.t('app.www-warn-hero-few', {
        hero: heroName(warning.hero),
        games: warning.games,
      })
    case 'artifact-unrecorded':
      return i18n.t('app.www-warn-artifact-unrecorded', {
        artifact: artifactName(warning.artifact),
      })
    case 'artifact-few-on-kind':
      return i18n.t('app.www-warn-artifact-few', {
        artifact: artifactName(warning.artifact),
        games: warning.games,
      })
    case 'no-group':
      return i18n.t('app.www-warn-no-group', { team: teamName(warning.side) })
  }
}
</script>

<template>
  <section class="sl-panel www-result">
    <p v-if="title" class="www-title">{{ title }}</p>
    <WwwChances :chance="panel.shown / 1000" />
    <p class="www-verdict">
      {{ verdict
      }}<button
        v-if="panel.warnings.length"
        type="button"
        class="sl-help"
        :aria-label="panel.warnings.map(warningText).join('. ')"
        @mouseenter="warnOpen"
        @mouseleave="warnClose"
        @focus="warnOpen"
        @blur="warnClose"
        @click="warnToggle"
        @touchstart.passive="warnTouchStart"
      >
        <IconAlertSmall :size="14" class="sl-help-mark" aria-hidden="true" />
      </button>
    </p>

    <p class="www-sub">{{ i18n.t('app.www-why') }}</p>
    <div class="www-rows">
      <template v-for="reason in REASONS" :key="reason">
        <button
          type="button"
          class="www-row www-reason"
          :class="{ open: open === reason }"
          :aria-expanded="open === reason"
          @click="toggle(reason)"
        >
          <span class="l">
            <i
              v-if="panel.reasons[reason] > 0"
              class="www-bar"
              :style="{ width: barWidth(panel.reasons[reason]) }"
            />
          </span>
          <span class="c">
            {{ i18n.t(REASON_LABELS[reason]) }}
            <b :class="toward(panel.reasons[reason])">{{ tenthsText(panel.reasons[reason]) }}</b>
          </span>
          <span class="r">
            <i
              v-if="panel.reasons[reason] < 0"
              class="www-bar"
              :style="{ width: barWidth(panel.reasons[reason]) }"
            />
          </span>
        </button>

        <div v-if="open === reason" class="www-detail">
          <template v-if="reason === 'heroes'">
            <div v-for="(row, i) in heroRows" :key="i" class="www-row www-pair">
              <span v-for="(line, s) in row" :key="s" :class="s === 0 ? 'l' : 'r'">
                <template v-if="line">
                  <span class="www-who">
                    <span class="www-rec">{{
                      line.record ? recordText(line.record) : i18n.t('app.www-no-record')
                    }}</span>
                    <span class="www-name">{{ lineName(line) }}</span>
                    <SlPortrait v-if="line.id !== null" :id="line.id" class="www-mini" />
                  </span>
                  <span class="www-strength"
                    ><i
                      :class="{ hollow: line.value < 0 }"
                      :style="{ width: strength(line.value, panel.heroes) }"
                  /></span>
                </template>
              </span>
            </div>
          </template>

          <template v-else-if="reason === 'counters'">
            <template v-if="panel.counters.length">
              <div class="www-row www-pair www-detail-head">
                <span class="l">{{
                  panel.kinds.b === null
                    ? ''
                    : i18n.t('app.www-against', { group: groupName(groups.b) })
                }}</span>
                <span class="r">{{
                  panel.kinds.a === null
                    ? ''
                    : i18n.t('app.www-against', { group: groupName(groups.a) })
                }}</span>
              </div>
              <div v-for="(row, i) in counterRows" :key="i" class="www-row www-pair">
                <span v-for="(line, s) in row" :key="s" :class="s === 0 ? 'l' : 'r'">
                  <template v-if="line">
                    <span class="www-who">
                      <span class="www-rec">{{
                        line.record ? recordText(line.record) : i18n.t('app.www-few-games')
                      }}</span>
                      <span class="www-name">{{ lineName(line) }}</span>
                      <SlPortrait v-if="line.id !== null" :id="line.id" class="www-mini" />
                    </span>
                    <span class="www-strength"
                      ><i
                        :class="{ hollow: line.value < 0 }"
                        :style="{ width: strength(line.value, panel.counters) }"
                    /></span>
                  </template>
                </span>
              </div>
              <p class="www-explain">{{ countersNote }}</p>
            </template>
            <p v-else class="www-explain">{{ i18n.t('app.www-counters-none') }}</p>
          </template>

          <template v-else-if="reason === 'artifacts'">
            <div class="www-row www-pair">
              <span
                v-for="line in artifactLines"
                :key="line.side"
                :class="line.side === 'a' ? 'l' : 'r'"
              >
                <span v-if="line.id === null" class="www-quiet">{{
                  i18n.t('app.www-artifact-none')
                }}</span>
                <template v-else>
                  <span class="www-who">
                    <span v-if="line.record" class="www-rec">{{ recordText(line.record) }}</span>
                    <span class="www-name">{{ artifactName(line.id) }}</span>
                    <span v-if="artifactOf(line.id)" class="www-mini www-mini-artifact">
                      <ArtifactImage :artifact="artifactOf(line.id)!" />
                    </span>
                  </span>
                  <template v-if="line.record">
                    <span class="www-strength"
                      ><i
                        :class="{ hollow: line.value < 0 }"
                        :style="{ width: strength(line.value, artifactLines) }"
                    /></span>
                    <span v-if="line.onKind" class="www-quiet">
                      {{
                        i18n.t('app.www-artifact-on-kind', {
                          record: recordText(line.onKind),
                          group: groupName(groups[line.side]),
                        })
                      }}
                    </span>
                  </template>
                  <span v-else class="www-quiet">{{ i18n.t('app.www-artifact-unrecorded') }}</span>
                </template>
              </span>
            </div>
          </template>

          <template v-else>
            <div class="www-row www-figures">
              <span class="l">{{ numberText(panel.points.a) }}</span>
              <span class="c">{{ i18n.t('app.www-rivalry-points') }}</span>
              <span class="r">{{ numberText(panel.points.b) }}</span>
            </div>
            <div class="www-row www-figures">
              <span class="l a">{{
                panel.points.a > panel.points.b
                  ? `+${numberText(panel.points.a - panel.points.b)}`
                  : ''
              }}</span>
              <span class="c">{{ i18n.t('app.www-gap') }}</span>
              <span class="r b">{{
                panel.points.b > panel.points.a
                  ? `+${numberText(panel.points.b - panel.points.a)}`
                  : ''
              }}</span>
            </div>
            <div class="www-row">
              <span v-for="side in SIDES" :key="side" :class="side === 'a' ? 'l' : 'r'">
                <span v-if="!panel.short[side].length" class="www-quiet">{{
                  i18n.t('app.www-at-top')
                }}</span>
                <span v-for="hero in panel.short[side]" :key="hero.id" class="www-who">
                  <span class="www-rec">−{{ numberText(hero.points) }}</span>
                  <span class="www-name">{{ heroName(hero.id) }}</span>
                  <SlPortrait :id="hero.id" class="www-mini" />
                </span>
              </span>
              <span class="c">{{ i18n.t('app.www-below-top') }}</span>
            </div>
          </template>
        </div>
      </template>

      <div class="www-row www-total">
        <span class="l"
          ><i v-if="total > 0" class="www-bar" :style="{ width: barWidth(total) }"
        /></span>
        <span class="c">
          {{ i18n.t('app.www-total') }}
          <b :class="toward(total)">{{ tenthsText(total) }}</b>
        </span>
        <span class="r"
          ><i v-if="total < 0" class="www-bar" :style="{ width: barWidth(total) }"
        /></span>
      </div>
    </div>

    <p class="www-sub">{{ i18n.t('app.www-records') }}</p>
    <div class="www-rows www-evidence">
      <div class="www-row">
        <span class="l">{{
          panel.lineups.a ? recordText(panel.lineups.a) : i18n.t('app.www-no-record')
        }}</span>
        <span class="c">{{ i18n.t('app.www-lineup-record') }}</span>
        <span class="r">{{
          panel.lineups.b ? recordText(panel.lineups.b) : i18n.t('app.www-no-record')
        }}</span>
      </div>
      <div class="www-row">
        <span class="l">{{ panel.met.a }}</span>
        <span class="c">{{ i18n.t('app.www-head-to-head') }}</span>
        <span class="r">{{ panel.met.b }}</span>
      </div>
      <div class="www-row">
        <span v-for="side in SIDES" :key="side" :class="side === 'a' ? 'l' : 'r'">
          {{
            i18n.t('app.www-range', {
              fewest: panel.heroGames[side][0],
              most: panel.heroGames[side][1],
            })
          }}
        </span>
        <span class="c">{{ i18n.t('app.www-hero-games') }}</span>
      </div>
      <div class="www-row">
        <span class="l">{{ numberText(panel.points.a) }}</span>
        <span class="c">{{ i18n.t('app.www-rivalry-points') }}</span>
        <span class="r">{{ numberText(panel.points.b) }}</span>
      </div>
    </div>

    <Teleport v-if="warnAnchor" to="body">
      <TooltipPopup :target-element="warnAnchor" variant="detailed" max-width="290px">
        <template #content>
          <span v-for="(warning, i) in panel.warnings" :key="i" class="www-warning">{{
            warningText(warning)
          }}</span>
        </template>
      </TooltipPopup>
    </Teleport>
  </section>
</template>

<style scoped>
.www-result {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px 16px;
  container-type: inline-size;
}

.a {
  color: var(--unit-frame-ally);
}

.b {
  color: var(--unit-frame-enemy);
}

.www-verdict {
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: var(--color-text-primary);
}

.www-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-primary);
}

.www-sub {
  margin: 6px 0 0;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-rows {
  display: grid;
}

.www-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.2rem minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--color-border-light);
}

.www-row > .l,
.www-row > .c,
.www-row > .r {
  grid-row: 1;
  min-width: 0;
}

.www-row > .l {
  grid-column: 1;
  display: flex;
  justify-content: flex-end;
}

.www-row > .r {
  grid-column: 3;
  display: flex;
  justify-content: flex-start;
}

.www-row > .c {
  grid-column: 2;
  display: grid;
  justify-items: center;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-row > .c b {
  font-size: 14px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.www-reason {
  width: 100%;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.www-reason:hover,
.www-reason.open {
  background: var(--color-bg-raised);
}

.www-bar {
  display: block;
  height: 4px;
  border-radius: 2px;
}

.l > .www-bar {
  background: var(--unit-frame-ally);
}

.r > .www-bar {
  background: var(--unit-frame-enemy);
}

.www-total {
  border-top-color: var(--color-text-secondary);
}

.www-total .www-bar {
  height: 6px;
  border-radius: 3px;
}

.www-total > .c {
  color: var(--color-text-primary);
}

.www-detail {
  display: grid;
  padding: 2px 0 8px;
  background: var(--color-bg-raised);
}

.www-detail .www-row {
  padding: 3px 0;
  border-top: 0;
}

.www-detail .www-row > .l,
.www-detail .www-row > .r {
  display: grid;
  align-content: start;
  gap: 3px;
  font-size: 12.5px;
}

.www-detail .www-row > .l {
  justify-items: end;
  text-align: right;
}

.www-detail .www-row > .r {
  justify-items: start;
}

.www-who {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.r .www-who {
  flex-direction: row-reverse;
}

.www-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.www-rec {
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

.www-mini {
  --pt: 22px;
}

.www-mini-artifact {
  display: inline-flex;
  flex: none;
  width: 22px;
  height: 22px;
  overflow: hidden;
  border: 1.5px solid var(--color-bg-secondary);
  border-radius: 50%;
}

.www-strength {
  display: flex;
  width: 60%;
  height: 4px;
}

.l .www-strength {
  justify-content: flex-end;
}

.www-strength i {
  display: block;
  height: 100%;
  border-radius: 2px;
}

.l .www-strength i {
  background: var(--unit-frame-ally);
}

.r .www-strength i {
  background: var(--unit-frame-enemy);
}

.www-strength i.hollow {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--color-text-secondary);
}

.www-quiet {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.www-detail-head > .l,
.www-detail-head > .r {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.www-explain {
  margin: 4px 12px 0;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-figures > .l,
.www-figures > .r,
.www-evidence .www-row > .l,
.www-evidence .www-row > .r {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.www-evidence .www-row {
  padding: 4px 0;
}

.www-evidence .www-row > .c {
  font-weight: 500;
}

.www-warning {
  display: block;
}

.www-warning + .www-warning {
  margin-top: 6px;
}

@container (max-width: 519px) {
  .www-pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
  }
  .www-pair > .r {
    grid-column: 2;
  }
  .www-pair .www-who {
    flex-wrap: wrap;
    justify-content: flex-end;
    row-gap: 0;
  }
  .www-pair .www-rec {
    order: 1;
    flex-basis: 100%;
  }
}

@container (min-width: 520px) {
  .www-row {
    grid-template-columns: minmax(0, 1fr) 8rem minmax(0, 1fr);
  }
}
</style>
