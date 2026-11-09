<script setup lang="ts">
/* One rule: a header naming the unit and the team it is on, the effect as a
   board card words it, the rule's note, then its details on labelled lines. */

import { computed } from 'vue'

import RulesListChip from './RulesListChip.vue'
import type { RuleCard } from '@/lib/placement/formationRules'
import { RULE_LISTS, useRulesNames } from './useRules'

// who: the unit's name as a sentence reads it.
const { card, who, openList } = defineProps<{
  card: RuleCard
  who: string
  openList: string | null
}>()

const emit = defineEmits<{ open: [list: string] }>()

const { t } = useRulesNames()

const effect = computed(() => {
  if (card.effect === 'back')
    return { lead: t('placement-stands'), text: t('placement-stands-back-half') }
  if (!card.effect) return null
  return {
    lead: t(`placement-${card.effect.verb}`),
    // A board card names the heroes it went to; a rule has none yet.
    text: t(card.effect.key).replace(/\s*[(（]\{heroes\}[)）]/, ''),
  }
})

const list = computed(() => (card.list && RULE_LISTS[card.list] ? card.list : null))
const use = computed(() => {
  if (!card.use) return null
  const label = card.use === 'avoid' ? 'keep-away' : card.use === 'every' ? 'counts' : 'goes-to'
  return { label: t(`rules-row-${label}`), text: t(`rules-use-${card.use}`) }
})
</script>

<template>
  <article class="rules-box" :class="card.team">
    <header class="tag" data-theme="dark">
      {{ t(card.team === 'ally' ? 'rules-on-our-team' : 'rules-on-enemy-team', { name: who }) }}
    </header>
    <p v-if="effect" class="effect">
      <b>{{ effect.lead }}</b> {{ effect.text }}
    </p>
    <p :class="{ 'reading-secondary': effect }">{{ t(card.note) }}</p>
    <dl v-if="card.targets || list || use || card.tile || card.weight" class="rows">
      <template v-if="card.targets">
        <dt>{{ t('rules-row-targets') }}</dt>
        <dd>
          <p class="reading-secondary">{{ t(card.targets) }}</p>
        </dd>
      </template>
      <template v-if="list">
        <dt class="for-chip">{{ t('rules-row-list') }}</dt>
        <dd>
          <RulesListChip :name="list" :pressed="openList === list" @open="emit('open', $event)" />
        </dd>
      </template>
      <template v-if="use">
        <dt>{{ use.label }}</dt>
        <dd>
          <p class="reading-secondary">{{ use.text }}</p>
        </dd>
      </template>
      <template v-if="card.tile">
        <dt>{{ t('rules-row-tile') }}</dt>
        <dd>
          <p class="reading-secondary">{{ t(`rules-tile-${card.tile}`) }}</p>
        </dd>
      </template>
      <template v-if="card.weight">
        <dt>{{ t('rules-row-weight') }}</dt>
        <dd>
          <p class="reading-secondary">{{ t(`rules-weight-${card.weight}`) }}</p>
        </dd>
      </template>
    </dl>
  </article>
</template>

<style scoped>
.tag {
  margin: -12px -16px 2px;
  padding: 7px 16px 6px;
  border-bottom: 2px solid var(--panel-dark-edge);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ally .tag {
  color: var(--unit-frame-ally);
}

.enemy .tag {
  color: var(--unit-frame-enemy);
}

.effect + p {
  margin-top: -6px;
}

.rows {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 18px;
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--panel-dark-edge);
}

dt {
  min-width: 100px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--reading-muted);
}

dt.for-chip {
  align-self: center;
}

dd {
  margin: 0;
}

dd p {
  margin: 0;
}

@media (max-width: 700px) {
  .tag {
    margin: -12px -12px 2px;
    padding: 7px 12px 6px;
  }

  .rows {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }

  dt:not(:first-child) {
    margin-top: 8px;
  }

  dt.for-chip {
    align-self: auto;
  }
}
</style>
