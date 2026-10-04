<script setup lang="ts">
/* Picks the active roster: the picker's source of heroes, and the roster the
   Rosters tab edits. The Characters tab and the on-grid popup add a Manage
   entry that jumps to that tab; the popup uses the dark variant, whose list
   stays inside the popup so hovering it never trips the popup's mouse-leave
   dismissal. In the side panels the list floats, since a panel scrolls and
   can be shorter than the list. */

import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import IconUser from '@/components/ui/IconUser.vue'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

const { manage = false, dark = false } = defineProps<{
  manage?: boolean
  dark?: boolean
  large?: boolean
}>()

const emit = defineEmits<{ manage: [] }>()

const rosters = useRosters()
const i18n = useI18nStore()

// Roster ids are never empty (validateRoster), so the empty key cannot collide.
const ALL_HEROES = ''

const items = computed((): DropdownItem[] => [
  { key: ALL_HEROES, label: i18n.t('app.all-heroes'), selected: !rosters.active },
  ...rosters.rosters.map((roster) => ({
    key: roster.id,
    label: roster.name,
    meta: Object.keys(roster.heroes).length,
    selected: rosters.active?.id === roster.id,
  })),
])
</script>

<template>
  <DropdownSelect
    class="roster-menu"
    :variant="dark ? 'dark' : 'pill'"
    :large
    :floating="!dark"
    :label="rosters.active?.name ?? i18n.t('app.all-heroes')"
    :title="rosters.active?.name"
    :lit="!!rosters.active"
    :items
    :action="manage ? i18n.t('app.manage-rosters') : undefined"
    @select="rosters.setActive($event === ALL_HEROES ? null : $event)"
    @action="emit('manage')"
  >
    <template v-if="large" #icon>
      <IconUser :size="15" />
    </template>
  </DropdownSelect>
</template>

<style scoped>
/* Fixed width so the bar doesn't shift as rosters change; in the popup it
   spans the palette like the search box. */
.roster-menu {
  --dropdown-trigger-width: 10rem;
}

.roster-menu.large {
  --dropdown-trigger-width: var(--dropdown-large-width);
}

.roster-menu.dark {
  --dropdown-trigger-width: 100%;
}
</style>
