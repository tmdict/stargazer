import { ref } from 'vue'
import { defineStore } from 'pinia'

/** Bridges the Skills page's right-column list to the left-column display:
 * list writes the slug, display reads it. */
export const useSkillsStore = defineStore('skills', () => {
  const selectedSlug = ref<string | null>(null)

  const setSelectedSlug = (slug: string | null) => {
    selectedSlug.value = slug
  }

  return { selectedSlug, setSelectedSlug }
})
