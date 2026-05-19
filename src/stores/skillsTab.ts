import { ref } from 'vue'
import { defineStore } from 'pinia'

/** Bridges the Skills tab's right-column list to the left-column display:
 * list writes the slug, display reads it. */
export const useSkillsTabStore = defineStore('skillsTab', () => {
  const selectedSlug = ref<string | null>(null)

  const setSelectedSlug = (slug: string | null) => {
    selectedSlug.value = slug
  }

  return { selectedSlug, setSelectedSlug }
})
