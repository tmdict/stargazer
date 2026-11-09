<script setup lang="ts">
/* The open list's Read by row, folded by default so the list comes first:
   each rule that reads the list, as the Formation engine rules page words it, the
   lists that bring it in, and how to edit it. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
import { SL_RULES_PATH } from '@/lib/guide'
import { unitPicture } from '../rules/useRules'
import { readersOf, useListEditor, useListWords } from './useListEditor'

const { name } = defineProps<{ name: string }>()

const emit = defineEmits<{ go: [name: string] }>()

const open = defineModel<boolean>('open', { required: true })

const editor = useListEditor()
const { lang, t, proseName, unitName, listName, cardUse, readersLine } = useListWords()

const readers = computed(() => readersOf(name))
const parents = computed(() => editor.parentsOf(name))
const line = computed(() =>
  readersLine(
    name,
    parents.value.map((parent) => parent.list),
  ),
)
const hasLine = computed(() => editor.layouts.value[name]!.hasLine)
const counts = computed(() => editor.usesOf(name).has('every'))

// The sentence around the link to the list that brings this one in.
const broughtInto = (parent: { list: string; entry: number; below: boolean }) => {
  const [before = '', after = ''] = t(parent.below ? 'lists-brought-below' : 'lists-brought-at', {
    n: parent.entry,
  }).split('{list}')
  return { before, after }
}
</script>

<template>
  <details class="about" :open @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary>
      <span class="label">{{ t('lists-read-by') }}</span>
      <span class="who">{{ line }}</span>
      <span class="more">{{ t(open ? 'lists-read-hide' : 'lists-read-more') }}</span>
    </summary>
    <ul>
      <li v-for="(reader, index) in readers" :key="index" class="reader" :class="reader.card.team">
        <GuidePortrait
          v-if="reader.unit.kind === 'hero'"
          :slug="reader.unit.id"
          :lang
          :size="28"
          class="face"
        />
        <span v-else class="face mark">
          <img v-if="unitPicture(reader.unit)" :src="unitPicture(reader.unit)!" alt="" />
          <IconSparkle v-else :size="18" />
        </span>
        <span class="team" data-theme="dark">
          {{
            t(reader.card.team === 'ally' ? 'rules-on-our-team' : 'rules-on-enemy-team', {
              name: proseName(unitName(reader.unit)),
            })
          }}
        </span>
        <RouterLink :to="`${SL_RULES_PATH}#${reader.unit.id}`" class="rule">
          {{ t('lists-rule') }}<IconChevronRight :size="12" />
        </RouterLink>
        <p class="note">{{ t(reader.card.note) }}</p>
        <p v-if="reader.card.targets" class="how">
          <b>{{ t('rules-row-targets') }}</b
          >{{ t(reader.card.targets) }}
        </p>
        <p v-if="cardUse(reader.card)" class="how">
          <b>{{ cardUse(reader.card)!.label }}</b
          >{{ cardUse(reader.card)!.text }}
        </p>
      </li>
      <li v-for="parent in parents" :key="parent.list" class="via">
        <p>
          {{ broughtInto(parent).before
          }}<a :href="`#${parent.list}`" @click.prevent="emit('go', parent.list)">{{
            listName(parent.list)
          }}</a
          >{{ broughtInto(parent).after }}
        </p>
      </li>
      <li v-if="!readers.length && !parents.length" class="via">
        <p>{{ t('lists-no-rule-reads') }}</p>
      </li>
    </ul>
    <div class="help">
      <p v-if="hasLine">{{ t(counts ? 'lists-help-line-every' : 'lists-help-line') }}</p>
      <p>{{ t('lists-help-edit') }}</p>
    </div>
  </details>
</template>

<style scoped>
.about {
  margin: 0 0 12px;
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-small);
  font-family: var(--font-ui);
}

summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 14px;
  list-style: none;
  cursor: pointer;
}

summary::-webkit-details-marker {
  display: none;
}

summary::after {
  content: '▸';
  margin-left: auto;
  color: var(--reading-muted);
}

.about[open] summary {
  border-bottom: 2px solid var(--panel-dark-edge);
}

.about[open] summary::after {
  content: '▾';
}

.label {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--reading-muted);
}

.who {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.more {
  flex: none;
  font-size: 13px;
  color: var(--color-accent);
}

ul {
  margin: 0;
  padding: 4px 14px;
  list-style: none;
}

li {
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid var(--panel-dark-edge);
}

li:first-child {
  border-top: 0;
}

.reader {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 2px 10px;
}

.face {
  grid-row: span 4;
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--color-header-gold);
}

.mark img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.team {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.ally .team {
  color: var(--unit-frame-ally);
}

.enemy .team {
  color: var(--unit-frame-enemy);
}

.rule {
  display: inline-flex;
  grid-row: 1;
  grid-column: 3;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: normal;
  white-space: nowrap;
  color: var(--color-accent);
}

.rule:hover {
  text-decoration: underline;
}

.note,
.how {
  grid-column: 2 / -1;
  margin: 0;
}

.note {
  font-size: 14px;
  line-height: 1.45;
  color: var(--reading-text);
}

.how {
  font-size: 13px;
  line-height: 1.45;
  color: var(--reading-muted);
}

.how b {
  margin-right: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.via p {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
}

.via a {
  font-weight: 500;
  color: var(--color-accent);
}

.help {
  padding: 8px 14px 10px;
  border-top: 1px solid var(--panel-dark-edge);
}

.help p {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--reading-muted);
}

.help p:last-child {
  margin-bottom: 0;
}

@media (max-width: 700px) {
  .more {
    display: none;
  }
}
</style>
