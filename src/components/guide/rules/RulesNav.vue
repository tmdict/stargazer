<script setup lang="ts">
/* The page's column of rules: a search, every unit with rules by kind, each
   with a dot for each team its rules are for, and the parts every team shares. */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconGem from '@/components/ui/IconGem.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import type { RuleUnitKind } from '@/lib/placement/formationRules'
import { useGameDataStore } from '@/stores/gameData'
import {
  heroOf,
  RULE_LISTS,
  RULE_UNITS,
  SHARED_VIEWS,
  useRulesNames,
  type RulesUnit,
} from './useRules'

const { current } = defineProps<{ current: string }>()

const emit = defineEmits<{ go: [view: string] }>()

const query = defineModel<string>('query', { required: true })

const gameData = useGameDataStore()
const { lang, t, game, heroName, unitName, unitSub } = useRulesNames()

const GROUPS: { kind: RuleUnitKind; label: () => string }[] = [
  { kind: 'hero', label: () => t('heroes') },
  { kind: 'phantimal', label: () => game('phantimal') },
  { kind: 'artifact', label: () => game('artifact') },
  { kind: 'charm', label: () => t('rules-charms') },
]

const teamsOf = (unit: RulesUnit) => [...new Set(unit.cards.map((card) => card.team))]

// Heroes match by their name in any language, as the hero searches do; a unit
// also matches by the heroes it holds and the heroes its lists rank.
const matches = computed(() => {
  const searched = query.value.trim().toLowerCase()
  if (!searched) return null
  const heroes = matchCharacterNames(searched)
  const units = new Set(
    RULE_UNITS.filter((unit) => {
      const named = [
        ...(unit.kind === 'hero' ? [unit.id] : []),
        ...(unit.holders ?? []),
        ...unit.cards.flatMap((card) =>
          (card.list ? (RULE_LISTS[card.list]?.ranked ?? []) : []).flatMap((group) =>
            group.heroes.flatMap((id) => heroOf(id)?.name ?? []),
          ),
        ),
      ]
      return (
        unitName(unit).toLowerCase().includes(searched) || named.some((slug) => heroes.has(slug))
      )
    }).map((unit) => unit.id),
  )
  return { searched, units }
})

const shown = (id: string, label: string): boolean =>
  !matches.value ||
  matches.value.units.has(id) ||
  label.toLowerCase().includes(matches.value.searched)

const groups = computed(() =>
  GROUPS.map(({ kind, label }) => {
    const units = RULE_UNITS.filter((unit) => unit.kind === kind)
    return {
      kind,
      label: label(),
      count: units.length,
      units: units.filter((u) => shown(u.id, '')),
    }
  }).filter((group) => group.units.length),
)
const shared = computed(() =>
  SHARED_VIEWS.map((id) => ({ id, label: t(`rules-${id}`) })).filter(({ id, label }) =>
    shown(id, label),
  ),
)
const how = computed(() => shown('how', t('rules-how')))
const nothing = computed(() => !how.value && !groups.value.length && !shared.value.length)

const picture = (unit: RulesUnit): string | null => {
  if (unit.kind === 'phantimal') return gameData.getCharacterImage(unit.id)
  if (unit.kind === 'artifact') return gameData.getArtifactImage(unit.id)
  return null
}

function go(event: MouseEvent, id: string): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('go', id)
}
</script>

<template>
  <div class="rules-index">
    <label class="search">
      <IconSearch :size="15" />
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="t('rules-find')"
        :aria-label="t('rules-find')"
      />
    </label>
    <p class="legend" data-theme="dark">
      <span><i class="dot ally" />{{ t('rules-on-ours') }}</span>
      <span><i class="dot enemy" />{{ t('rules-on-theirs') }}</span>
    </p>

    <a
      v-if="how"
      href="#how"
      class="item plain"
      :aria-current="current === 'how' ? 'true' : undefined"
      @click="go($event, 'how')"
    >
      <span class="name">{{ t('rules-how') }}</span>
    </a>

    <template v-for="group in groups" :key="group.kind">
      <h3>
        {{ group.label }} <span>{{ group.count }}</span>
      </h3>
      <a
        v-for="unit in group.units"
        :key="unit.id"
        :href="`#${unit.id}`"
        class="item"
        :aria-current="current === unit.id ? 'true' : undefined"
        @click="go($event, unit.id)"
      >
        <GuidePortrait v-if="unit.kind === 'hero'" :slug="unit.id" :lang :size="26" />
        <GuideDisc v-else :size="26" class="mark">
          <img v-if="picture(unit)" :src="picture(unit)!" alt="" />
          <IconGem v-else :size="16" />
        </GuideDisc>
        <span class="words">
          <span class="name">{{ unit.kind === 'hero' ? heroName(unit.id) : unitName(unit) }}</span>
          <span v-if="unitSub(unit)" class="sub">{{ unitSub(unit) }}</span>
        </span>
        <span class="dots" data-theme="dark">
          <i v-for="team in teamsOf(unit)" :key="team" class="dot" :class="team" />
        </span>
      </a>
    </template>

    <template v-if="shared.length">
      <h3>{{ t('rules-everyone') }}</h3>
      <a
        v-for="view in shared"
        :key="view.id"
        :href="`#${view.id}`"
        class="item plain"
        :aria-current="current === view.id ? 'true' : undefined"
        @click="go($event, view.id)"
      >
        <span class="name">{{ view.label }}</span>
      </a>
    </template>

    <p v-if="nothing" class="none">{{ t('rules-none') }}</p>
  </div>
</template>

<style scoped>
.rules-index {
  padding: 8px;
  font-family: var(--font-ui);
  color: var(--reading-text);
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 2px 6px;
  padding: 0 10px;
  border: 1px solid var(--chip-dark-border-color);
  border-radius: var(--radius-large);
  background: var(--field-dark-background);
  color: var(--reading-muted);
  cursor: text;
}

.search:focus-within {
  border-color: var(--color-accent);
}

.search input {
  flex: 1;
  min-width: 0;
  padding: 7px 0;
  border: 0;
  outline: none;
  background: none;
  color: var(--reading-text);
  font: inherit;
  font-size: max(14px, var(--field-min-font-size));
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin: 4px 8px 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--reading-muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

h3 {
  display: flex;
  justify-content: space-between;
  margin: 14px 8px 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--reading-muted);
}

h3 span {
  letter-spacing: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: var(--radius-medium);
  font-weight: normal;
  color: inherit;
  text-decoration: none;
}

.item.plain {
  padding: 7px 8px;
}

.item:hover {
  background: var(--field-dark-background);
  color: inherit;
}

.item[aria-current='true'] {
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.mark {
  color: var(--color-header-gold);
}

.words {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sub {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--reading-muted);
}

.dots {
  display: inline-flex;
  gap: 3px;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.ally {
  background: var(--unit-frame-ally);
}

.dot.enemy {
  background: var(--unit-frame-enemy);
}

.none {
  margin: 8px;
  font-size: 13px;
  color: var(--reading-muted);
}
</style>
