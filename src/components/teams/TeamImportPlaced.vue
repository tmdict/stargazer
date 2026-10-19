<script setup lang="ts">
/* An import review's "As placed" board, showing the sides where the plan will
   place them. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import { useUnitLabels } from '@/composables/useUnitLabels'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import { SIDES } from '@/lib/teams/teamImport'
import type { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const { sides, pointed } = defineProps<{
  mapKey: string
  sides: Partial<Record<Team, SideLoadBoard>>
  // The team is a board side, so a swapped import passes the opposite of the
  // screenshot column.
  pointed: { team: Team; unitId: number } | null
}>()

const i18n = useI18nStore()
const { unitName, unitImage } = useUnitLabels()

const units = computed((): ThumbnailUnit[] =>
  SIDES.flatMap((team) => {
    const side = sides[team]
    if (!side) return []
    return [...side.mains, ...side.companions, ...(side.phantimal ? [side.phantimal] : [])].flatMap(
      ({ unitId, hexId }) =>
        hexId === undefined
          ? []
          : [
              {
                hexId,
                team,
                image: unitImage(unitId),
                title: unitName(unitId),
                highlight: team === pointed?.team && unitId === pointed.unitId,
              },
            ],
    )
  }),
)
</script>

<template>
  <figure class="placed">
    <BoardThumbnail class="placed-view" :map-key :units :hex-size="16" crisp numbered />
    <figcaption>{{ i18n.t('app.import-on-board') }}</figcaption>
  </figure>
</template>

<style scoped>
.placed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  min-width: 0;
}

.placed figcaption {
  font-size: 0.72rem;
  color: var(--import-text-dim);
}

.placed-view {
  display: block;
  width: 100%;
  height: auto;
  max-height: var(--placed-max-height, none);
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}
</style>
