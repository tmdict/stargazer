<script setup lang="ts">
/* The Damage Types guide's table in small: two of its rules against the four
   types. */

import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { DAMAGE_RULES, DAMAGE_TYPES, type DamageType } from '@/lib/damageTypes'
import { appLabel, gameLabel } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)

const typeName = (type: DamageType): string =>
  type === 'regular'
    ? `${gameLabel('physical', lang.value)} / ${gameLabel('magic', lang.value)}`
    : label(type)

const SHOWN = ['crit', 'shields']
const RULES = DAMAGE_RULES.filter(({ key }) => SHOWN.includes(key))
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock>
        <table class="rules">
          <thead>
            <tr>
              <td></td>
              <th v-for="type in DAMAGE_TYPES" :key="type" scope="col">{{ typeName(type) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in RULES" :key="rule.key">
              <th scope="row">{{ label(`damage-row-${rule.key}`) }}</th>
              <td v-for="(applies, i) in rule.applies" :key="i" :class="applies ? 'yes' : 'no'">
                {{ applies ? '✓' : '✕' }}
              </td>
            </tr>
          </tbody>
        </table>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.rules {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.rules :is(th, td) {
  padding: 4px 2px;
  border-top: 1px solid var(--color-border-primary);
  text-align: center;
}

.rules thead :is(th, td) {
  border-top: none;
  font-size: 0.52rem;
  font-weight: 700;
  vertical-align: bottom;
}

.rules tbody th {
  font-weight: 500;
  text-align: left;
}

.rules tbody td {
  font-size: 0.95rem;
  font-weight: 700;
}

.yes {
  color: var(--color-success);
}

.no {
  color: var(--color-text-secondary);
}
</style>
