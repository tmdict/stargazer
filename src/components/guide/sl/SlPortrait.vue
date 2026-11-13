<script setup lang="ts">
/* A hero portrait under a generated set's board, sized by its host's --pt, and
   titled with the hero's name unless a card names it. */

import { computed } from 'vue'

import HoldRing from '@/components/ui/HoldRing.vue'
import { unitInspectTarget, useInspect, type InspectTarget } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'

const {
  id,
  titled = true,
  inspectable = false,
} = defineProps<{
  id: number
  titled?: boolean
  // Right-click or a hold opens the hero's skills.
  inspectable?: boolean
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const slug = computed(() => gameData.getCharacterNameById(id) ?? '')

const target = computed(() => (inspectable ? unitInspectTarget(id) : null))
const { inspect } = useInspect()
const { pressing, start, onContextMenu } = useLongPress<InspectTarget>(
  (inspected) => void inspect(inspected),
)
</script>

<template>
  <!-- The frame holds the hold ring outside the portrait's clipped circle. -->
  <span
    class="pt-frame"
    :class="{ inspectable: target }"
    @pointerdown="target && start($event, target)"
    @contextmenu="target && onContextMenu($event, target)"
  >
    <span class="pt" :title="titled ? curatedHeroName(slug, i18n.currentLocale) : undefined">
      <img :src="gameData.getCharacterImage(slug)" alt="" draggable="false" />
    </span>
    <HoldRing v-if="pressing" />
  </span>
</template>

<style scoped>
.pt-frame {
  position: relative;
  display: inline-flex;
  flex: none;
}

.pt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--pt, 40px);
  height: var(--pt, 40px);
  border-radius: 50%;
  border: 1px solid var(--color-border-light);
  background: #555;
  overflow: hidden;
}

.pt img {
  width: calc(var(--pt, 40px) + 5px);
  height: calc(var(--pt, 40px) + 5px);
  object-fit: cover;
}
</style>
