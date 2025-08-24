<script setup lang="ts">
import { useToast } from '../../composables/useToast'

import ToastMessage from './ToastMessage.vue'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="toast-container">
    <ToastMessage
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :show="true"
      @close="remove(toast.id)"
    />
  </div>
</template>

<style scoped>
.toast-container {
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}
</style>
