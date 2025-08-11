<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()

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
            <h1>AFK Journey Arena Simulator</h1>
            <p>
              Stargazer is a AFKJ arena simulator and planning tool. It lets you experiment with
              different hero positions and team compositions on a hexagonal grid, just like the
              actual game's battle arena.
            </p>
            <p>
              Whether you're preparing for Arena, Supreme Arena, or other PvP modes, you can test
              strategies before committing resources in-game. Place heroes, visualize their attack
              ranges, and share your formations with friends or guild members to discuss tactics.
            </p>
            <p>
              The purpose of this tool is to allow rapid testing and sharing of skill targeting
              strategies with different arena formations. For comprehensive formation building with
              full features, we recommend using
              <a href="https://www.yaphalla.com/editor" target="_blank" rel="noopener"
                >Yaphalla's builder</a
              >.
            </p>

            <h2>How to Use</h2>
            <ul>
              <li>
                <strong>Place Heroes:</strong> Drag characters onto the grid or click them to
                add/remove
              </li>
              <li>
                <strong>Build Teams:</strong> Click and drag to move heroes around and switch teams
              </li>
              <li><strong>Add Artifacts:</strong> Click the Artifacts tab to equip team bonuses</li>
              <li>
                <strong>Simulation Details:</strong> Toggle to show/hide different simulation
                information:
                <ul>
                  <li>
                    <strong>Flat View:</strong> Display the grid in a top-down flat view, similar to
                    Yaphalla's builder
                  </li>
                  <li><strong>Grid Info:</strong> Show hex coordinates and tile information</li>
                  <li>
                    <strong>Skills:</strong> Simulate skill effects of character currently on the
                    map
                  </li>
                  <li><strong>Targeting:</strong> Simulate attack ranges and movement paths</li>
                  <li><strong>Debug:</strong> Show debug information for troubleshooting</li>
                </ul>
              </li>
              <li><strong>Create Maps:</strong> Use Map Editor tab to design custom arenas</li>
              <li>
                <strong>Share Teams:</strong> Click "Link" for shareable URL, "Copy" for image to
                clipboard, or "Download" to save image
              </li>
            </ul>

            <h2>Tips</h2>
            <ul>
              <li>Heroes with special abilities will modify the map or display special effects</li>
              <li>Click any grid tile to quickly place characters via a popup menu</li>
              <li>
                The grid is fully responsive - works seamlessly on mobile, tablet, and desktop!
              </li>
            </ul>

            <h2>Useful Links and Resources</h2>
            <ul>
              <li>
                <a href="https://www.yaphalla.com/" target="_blank" rel="noopener">Yaphalla</a>:
                Team formation builder, priority list builder, and database.
              </li>
              <li>
                <a href="https://www.prydwen.gg/afk-journey/" target="_blank" rel="noopener"
                  >Prydwen</a
                >: AFKJ database and guides.
              </li>
            </ul>
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
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
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

.modal-content ul ul {
  margin-top: 8px;
  margin-bottom: 8px;
}

.modal-content a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.modal-content a:hover {
  color: var(--color-danger);
  text-decoration: underline;
}

.modal-content strong {
  color: white;
  font-weight: 600;
}

/* Transitions - matching tooltip animation */
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
    padding-top: 60px; /* Space for close button */
  }

  .modal-content h1 {
    font-size: 24px;
  }

  .modal-content h2 {
    font-size: 18px;
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
    font-size: 22px;
  }

  .modal-content h2 {
    font-size: 17px;
  }
}
</style>
