<script setup lang="ts">
/* The artifact picker a review opens under a side's artifact: every artifact
   the pickers offer, and Remove while the side has one. */

import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  position: { x: number; y: number }
  removable: boolean
}>()

const emit = defineEmits<{ pick: [artifactId: number | null]; close: [] }>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
</script>

<template>
  <!-- Outside the modal's container, so its clicks and Escape are stopped
       here rather than reaching the modal's own close listeners on document. -->
  <Teleport to="body">
    <SelectionPopup
      :position
      over-modal
      keep-on-leave
      @close="emit('close')"
      @click.stop
      @keydown.esc.stop="emit('close')"
    >
      <ArtifactSelectionPalette
        :artifacts="gameData.pickerArtifacts"
        @pick="emit('pick', $event.id)"
      />
      <button v-if="removable" type="button" class="picker-remove" @click="emit('pick', null)">
        {{ i18n.t('app.remove-artifact') }}
      </button>
    </SelectionPopup>
  </Teleport>
</template>
