<script setup lang="ts">
import { computed } from 'vue'

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { pillFill } from '@/lib/characters/upgradeStats'
import { useI18nStore } from '@/stores/i18n'

const {
  paragon,
  refinement,
  reserved = false,
} = defineProps<{
  paragon: number
  refinement: number
  reserved?: boolean
}>()

const i18n = useI18nStore()
const tracks = computed(() => [
  { attrId: ATTR_PARAGON, level: paragon },
  { attrId: ATTR_REFINEMENT, level: refinement },
])
</script>

<template>
  <span
    class="upgrade-bars"
    :class="{ empty: reserved || (paragon === 0 && refinement === 0) }"
    role="img"
    :aria-label="`${i18n.t('app.paragon')} ${paragon}, ${i18n.t('app.refinement')} ${refinement}`"
    :aria-hidden="reserved || undefined"
  >
    <span
      v-for="track in tracks"
      :key="track.attrId"
      class="track"
      :style="{ '--upgrade-fill': pillFill(track.attrId, track.level) }"
    >
      <span
        v-for="step in attrMax(track.attrId)"
        :key="step"
        class="segment"
        :class="{ filled: step <= track.level }"
      />
    </span>
  </span>
</template>

<style scoped>
.upgrade-bars {
  display: grid;
  gap: 2px;
  width: 35px;
  /* Clear the portrait's outline even while it grows on hover. */
  margin-top: 3px;
}

.track {
  display: flex;
  gap: 2px;
  height: 3px;
}

.segment {
  flex: 1;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.17);
}

.filled {
  background: var(--upgrade-fill);
}

.empty {
  display: none;
}
</style>
