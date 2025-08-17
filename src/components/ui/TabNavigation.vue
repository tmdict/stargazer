<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

import { useI18nStore } from '../../stores/i18n'

interface MapInfo {
  key: string
  name: string
}

const i18n = useI18nStore()

const props = defineProps<{
  activeTab: string
  availableMaps: MapInfo[]
  selectedMap: string
}>()

const emit = defineEmits<{
  tabChange: [tab: string]
  mapChange: [mapKey: string]
}>()

const showMapDropdown = ref(false)
let closeTimeout: number | null = null

const setActiveTab = (tab: string) => {
  emit('tabChange', tab)
  showMapDropdown.value = false // Close dropdown when switching tabs
}

const toggleMapDropdown = () => {
  showMapDropdown.value = !showMapDropdown.value
}

const openMapDropdown = () => {
  // Clear any pending close timeout
  if (closeTimeout) {
    clearTimeout(closeTimeout)
    closeTimeout = null
  }
  showMapDropdown.value = true
}

const closeMapDropdown = () => {
  // Add a small delay before closing to allow mouse to cross the gap
  closeTimeout = setTimeout(() => {
    showMapDropdown.value = false
    closeTimeout = null
  }, 100) as unknown as number
}

const handleMapChange = (mapKey: string) => {
  emit('mapChange', mapKey)
  showMapDropdown.value = false // Close dropdown after selection
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const dropdown = document.querySelector('.tab-dropdown')
  if (dropdown && !dropdown.contains(event.target as Node)) {
    showMapDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="tab-container">
    <div class="tab-buttons">
      <button
        @click="setActiveTab('characters')"
        :class="['tab-btn', { active: activeTab === 'characters' }]"
      >
        {{ i18n.t('app.characters') }}
      </button>
      <button
        @click="setActiveTab('skills')"
        :class="['tab-btn', { active: activeTab === 'skills' }]"
      >
        {{ i18n.t('app.skills') }}
      </button>
      <button
        @click="setActiveTab('artifacts')"
        :class="['tab-btn', { active: activeTab === 'artifacts' }]"
      >
        {{ i18n.t('app.artifacts') }}
      </button>
      <button
        @click="setActiveTab('mapEditor')"
        :class="['tab-btn', { active: activeTab === 'mapEditor' }]"
      >
        {{ i18n.t('app.editor') }}
      </button>
      <div class="tab-dropdown" @mouseenter="openMapDropdown" @mouseleave="closeMapDropdown">
        <button @click="toggleMapDropdown" class="tab-btn dropdown-btn">
          {{
            `${i18n.t('app.arena')} ${availableMaps.find((m) => m.key === selectedMap)?.name || 'I'}`
          }}
          ▼
        </button>
        <div
          v-if="showMapDropdown"
          class="dropdown-content"
          @mouseenter="openMapDropdown"
          @mouseleave="closeMapDropdown"
        >
          <button
            v-for="map in availableMaps"
            :key="map.key"
            @click="handleMapChange(map.key)"
            :class="['dropdown-item', { selected: selectedMap === map.key }]"
          >
            {{ `${i18n.t('app.arena')} ${map.name}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Tab Content Slot -->
    <div class="tab-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tab-container {
  margin: -2em;
}

.tab-buttons {
  display: flex;
  justify-content: flex-start;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-large) var(--radius-large) 0 0;
  padding: 0;
  overflow: visible;
  border: 2px solid var(--color-border-primary);
  border-bottom: none;
}

.tab-btn:first-child {
  border-top-left-radius: var(--radius-large);
}

.tab-btn {
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-lg) var(--spacing-2xl);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  border-right: 1px solid var(--color-border-primary);
  position: relative;
}

@media (min-width: 1281px) {
  .tab-btn {
    font-size: 0.9rem;
  }
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.tab-btn.active {
  background: var(--color-bg-primary);
  color: var(--color-primary);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
}

.tab-content {
  background: var(--color-bg-primary);
  border-radius: 0 0 var(--radius-large) var(--radius-large);
}

.tab-dropdown {
  position: relative;
  display: inline-block;
  overflow: visible;
  margin-left: auto;
}

.dropdown-btn {
  border-right: 1px solid var(--color-border-primary);
}

.dropdown-content {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  z-index: var(--z-dropdown, 9999);
  max-height: 400px;
  overflow-y: auto;
  min-width: 120px;
  box-shadow: var(--shadow-medium);
}

.dropdown-item {
  width: 100%;
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  text-align: center;
  border-bottom: 1px solid var(--color-bg-secondary);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.dropdown-item.selected {
  background: var(--color-primary);
  color: white;
}

@media (max-width: 768px) {
  .tab-container {
    margin: -1em;
  }

  .tab-buttons {
    flex-wrap: wrap;
    gap: 0;
  }

  .tab-btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 0.9rem;
    flex: 1 1 auto;
    min-width: 100px;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    margin-bottom: -1px;
    margin-right: -1px;
  }

  .tab-btn:first-child {
    border-top-left-radius: var(--radius-large);
  }

  .tab-dropdown {
    margin-left: 0;
    flex: 1 1 100%;
  }

  .dropdown-btn {
    width: 100%;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    margin-bottom: -1px;
    margin-right: -1px;
  }

  .dropdown-content {
    left: 0;
    right: 0;
  }
}

@media (max-width: 480px) {
  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.85rem;
    min-width: 80px;
  }
}
</style>
