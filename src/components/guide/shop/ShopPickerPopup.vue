<script setup lang="ts">
/* The popup every shop picker opens in: at a point, or in the middle of the
   screen on a phone, and open until a press outside it, Escape or its close
   button. */

import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import type { Point } from '@/lib/layout'
import { onPhone } from './popupLayout'

defineProps<{ position: Point }>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <SelectionPopup
      class="shop-picker-popup"
      :position
      :centered="onPhone()"
      keep-on-leave
      @close="emit('close')"
    >
      <slot />
    </SelectionPopup>
  </Teleport>
</template>
