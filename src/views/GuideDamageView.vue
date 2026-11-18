<script setup lang="ts">
/* Guide page for the damage types: a card per type with the wording that
   gives it away in skill text, the effects that apply to each as one table,
   and what strengthens HP loss. */

import { computed } from 'vue'

import { DAMAGE_RULES, DAMAGE_TYPES, type DamageType } from '@/lib/damageTypes'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { interpolate } from '@/utils/interpolate'
import { appLabel, gameLabel } from '@/utils/skillLabels'

import '@/styles/content.css'
import '@/styles/guide.css'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupGuideContentMeta(lang, 'damage')

const label = (key: string): string => appLabel(key, lang.value)
const term = (key: string): string => gameLabel(key, lang.value)

const terms = computed(() => ({
  atk: term('atk'),
  hp: term('hp'),
  haste: term('haste'),
  atkSpd: term('atk-spd'),
  crit: term('crit'),
  physDef: term('phys-def'),
  magicDef: term('magic-def'),
  lifeDrain: term('life-drain'),
}))

const text = (key: string): string => interpolate(label(key), terms.value)

// Every type but the first is named by the label of its own key.
const typeName = (type: DamageType): string =>
  type === 'regular' ? `${term('physical')} / ${term('magic')}` : label(type)

interface TypeCard {
  type: DamageType
  info: string
  quote?: string
  unofficial?: boolean
}

const CARDS: readonly TypeCard[] = [
  { type: 'regular', info: 'damage-regular-info', quote: 'damage-quote-regular' },
  { type: 'true-damage', info: 'damage-true-info', quote: 'damage-quote-true' },
  { type: 'hp-loss', info: 'damage-hp-loss-info', quote: 'damage-quote-hp-loss' },
  { type: 'absolute-hp-loss', info: 'damage-absolute-info', unofficial: true },
]
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content">
        <h1>{{ label('damage-types') }}</h1>
        <p>{{ label('damage-intro') }}</p>

        <h2>{{ label('damage-tell-title') }}</h2>
        <div class="types">
          <section v-for="card in CARDS" :key="card.type" class="type">
            <h3>
              {{ typeName(card.type) }}
              <span v-if="card.unofficial" class="tag">{{ label('unofficial-name') }}</span>
            </h3>
            <p>{{ label(card.info) }}</p>
            <p v-if="card.quote" class="quote">{{ label(card.quote) }}</p>
          </section>
        </div>

        <h2>{{ label('damage-affects-title') }}</h2>
        <table class="guide-table rules">
          <thead>
            <tr>
              <td></td>
              <th v-for="type in DAMAGE_TYPES" :key="type" scope="col">{{ typeName(type) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in DAMAGE_RULES" :key="rule.key">
              <th scope="row">
                {{ text(`damage-row-${rule.key}`) }}
                <small v-if="rule.note">{{ text(`damage-row-${rule.key}-note`) }}</small>
              </th>
              <td v-for="(applies, i) in rule.applies" :key="i" :class="applies ? 'yes' : 'no'">
                <span aria-hidden="true">{{ applies ? '✓' : '✕' }}</span>
                <span class="visually-hidden">{{ label(applies ? 'yes' : 'no') }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <h2>{{ label('hp-loss') }}</h2>
        <ul>
          <li>{{ label('damage-hp-loss-base') }}</li>
          <li>{{ text('damage-hp-loss-stats') }}</li>
          <li>{{ label('damage-hp-loss-endless') }}</li>
        </ul>
      </div>
    </article>
  </main>
</template>

<style scoped>
.types {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0 6px;
}
.type {
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-medium);
  background: rgba(255, 255, 255, 0.04);
}
.content .type h3 {
  margin: 0 0 4px;
  font-size: 14px;
}
.content .type p {
  margin: 0;
  font-size: var(--reading-small-size);
  line-height: 1.45;
}
.content .type .quote {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  font-style: italic;
  opacity: 1;
}
.tag {
  display: inline-block;
  padding: 1px 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--reading-muted);
  vertical-align: 1px;
}

.rules tbody th {
  width: 46%;
  text-align: left;
}
.rules small {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.35;
  color: var(--reading-muted);
}
.rules td {
  font-size: 16px;
  font-weight: 700;
}
.yes {
  color: var(--color-success);
}
.no {
  color: var(--reading-muted);
}

@container (max-width: 640px) {
  .types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rules tbody th {
    width: auto;
  }
  .guide-table th,
  .guide-table td {
    padding: 8px 4px;
  }
}
</style>
