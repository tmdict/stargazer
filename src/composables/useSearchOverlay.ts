import { ref } from 'vue'

// Shared state for the skill search overlay. Module scope: the triggers (in
// the roster panels) and the overlay (mounted at App root) sit far apart in
// the component tree, and the query surviving close/reopen within a session
// is a feature (reopening restores the last search, pre-selected).
//
// Two flavors share the one overlay: `open()` is the navigate flavor (rows
// route to skill pages); `openSelect(handler)` is the select flavor (rows
// hand the chosen slug to the opener, e.g. the arena roster placing a hero).
// Each open() call resets the flavor, so a stale handler never outlives its
// context.
const isOpen = ref(false)
const query = ref('')
const selectHandler = ref<((slug: string) => void) | null>(null)

export function useSearchOverlay() {
  const open = () => {
    selectHandler.value = null
    isOpen.value = true
  }
  const openSelect = (handler: (slug: string) => void) => {
    selectHandler.value = handler
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
    // Callers read the handler before close(); clearing here keeps a closed
    // overlay from retaining the opener's closure (and its captured stores).
    selectHandler.value = null
  }
  return { isOpen, query, selectHandler, open, openSelect, close }
}
