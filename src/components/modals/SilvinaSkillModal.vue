<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

import GridSnippet from '../GridSnippet.vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()

const gridStyle = {
  numericLabel: {
    42: 1,
    39: 2,
    33: 3,
    30: 4,
    34: 5,
    40: 6,
    44: 8,
    41: 9,
    36: 10,
    29: 11,
    26: 12,
    23: 13,
    27: 14,
    31: 15,
    38: 16,
    43: 17,
    45: 18,
  },
  highlight: [9, 37],
  highlight2: [30, 33, 34, 39, 40, 42],
  highlight3: [23, 26, 27, 29, 31, 36, 38, 41, 43, 44, 45],
  character: {
    silvina: 9,
  },
  imaginaryHexes: [
    {
      relativeToHex: 45,
      direction: 'east' as const,
      label: 7,
    },
  ],
}

// Handle escape key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

// Handle click outside
const handleClickOutside = (e: MouseEvent) => {
  if (modalRef.value && !modalRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClickOutside">
        <div ref="modalRef" class="modal-container" @click.stop>
          <button class="modal-close" @click="emit('close')" aria-label="Close">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div class="modal-content">
            <h1>Silvina - First Strike</h1>
            <p>
              Silvina marks the closest enemy in a symmetrical position, flashes next to them, and
              launches an attack when a battle starts.
            </p>

            <h2>How It Works</h2>
            <p>
              Silvina first checks her symmetrical tile (the mirror position across the grid's
              center). If an enemy is there, they become the target.
            </p>
            <p>
              If the symmetrical tile is empty, Silvina searches for the nearest enemy to that
              position using an expanding clockwise spiral pattern:
            </p>
            <ul>
              <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
              <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
              <li>And so on...</li>
            </ul>
            <GridSnippet :gridStyle="gridStyle" />
            <p>
              Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally)
              walks counter-clockwise from bottom-left (180° rotation).
            </p>
            <p>
              (Credit: rkkñ for providing the exact algorithm for Silvina's targeting mechanics)
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  z-index: 9998;
  padding: 40px 20px;
}

.modal-container {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  max-width: 800px;
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 1;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.modal-content {
  padding: 24px 32px 32px 32px;
  color: #fff;
}

.modal-content h1 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.modal-content h2 {
  margin: 28px 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.modal-content p {
  margin: 12px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content ul {
  margin: 12px 0;
  padding-left: 20px;
}

.modal-content li {
  margin: 6px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content strong {
  color: white;
  font-weight: 600;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(3px);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 20px;
  }

  .modal-container {
    max-width: 100%;
  }

  .modal-content {
    padding: 24px;
    padding-top: 60px;
  }

  .modal-content h1 {
    font-size: 22px;
  }

  .modal-content h2 {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 15px;
  }

  .modal-content {
    padding: 20px;
    padding-top: 56px;
  }

  .modal-content h1 {
    font-size: 20px;
  }

  .modal-content h2 {
    font-size: 16px;
  }
}
</style>
